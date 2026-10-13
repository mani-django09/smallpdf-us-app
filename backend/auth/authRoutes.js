// auth/authRoutes.js
// Drop-in auth routes for smallpdf.us
// Mount in server.js with: app.use('/api/auth', require('./auth/authRoutes'))

const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { OAuth2Client } = require('google-auth-library')
const { dbRun, dbGet, dbAll } = require('../database')

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production'
const JWT_EXPIRES_IN = '7d'
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://smallpdf.us'

// Returns 'free' if plan_expires_at has passed, otherwise the stored plan.
function getEffectivePlan(user) {
  if (!user || user.plan === 'free') return 'free'
  if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) return 'free'
  return user.plan
}

// ─── Email Transporter ──────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter()
  await transporter.sendMail({
    from: `"SmallPDF.us" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  })
}

// ─── Middleware: verify JWT ──────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── POST /api/auth/signup ──────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email, and password are required' })

    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email))
      return res.status(400).json({ error: 'Invalid email address' })

    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

    const passwordHash = await bcrypt.hash(password, 12)
    const verifyToken = crypto.randomBytes(32).toString('hex')
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { id: newUserId } = await dbRun(
      `INSERT INTO users (name, email, password_hash, email_verify_token, email_verify_expires)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), email.toLowerCase(), passwordHash, verifyToken, verifyExpires]
    )

    // Send verification email
    const verifyUrl = `${FRONTEND_URL}/auth/verify-email?token=${verifyToken}`
    await sendEmail({
      to: email,
      subject: 'Verify your SmallPDF.us account',
      html: emailTemplate({
        title: 'Verify your email',
        body: `<p>Hi ${name},</p>
               <p>Thanks for signing up! Click the button below to verify your email address.</p>`,
        buttonText: 'Verify Email',
        buttonUrl: verifyUrl,
        footer: 'This link expires in 24 hours. If you didn\'t create an account, you can ignore this email.',
      }),
    })

    // Welcome email sequence — sent in background (non-blocking)
    scheduleWelcomeSequence({ name: name.trim(), email: email.toLowerCase() }).catch(() => {})

    // Log the user in immediately so their daily free-conversion quota (5/day)
    // applies right away — otherwise they'd stay on the guest quota (3/day)
    // until they verify their email and log in separately.
    const token = jwt.sign(
      { id: newUserId, email: email.toLowerCase(), name: name.trim(), plan: 'free' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.status(201).json({
      message: 'Account created. Please check your email to verify your account.',
      token,
      user: {
        id: newUserId,
        name: name.trim(),
        email: email.toLowerCase(),
        plan: 'free',
        avatar: null,
      },
    })
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Failed to create account. Please try again.' })
  }
})

// ─── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' })

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    if (user.is_banned)
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.' })

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' })

    if (!user.email_verified)
      return res.status(403).json({ error: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED' })

    // Check plan expiry — downgrade to free before issuing JWT
    const effectivePlan = getEffectivePlan(user)
    if (effectivePlan !== user.plan) {
      await dbRun(`UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ?`, [user.id])
      user.plan = 'free'
      user.plan_expires_at = null
      console.log(`⏰ Plan auto-expired at login for userId=${user.id}`)
    }

    // Update last login
    await dbRun('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id])

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, plan: user.plan },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        avatar: user.avatar,
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// ─── GET /api/auth/verify-email ─────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Verification token is required' })

    const user = await dbGet(
      `SELECT * FROM users WHERE email_verify_token = ? AND email_verify_expires > datetime('now')`,
      [token]
    )

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link. Please request a new one.' })

    await dbRun(
      `UPDATE users SET email_verified = 1, email_verify_token = NULL, email_verify_expires = NULL WHERE id = ?`,
      [user.id]
    )

    res.json({ message: 'Email verified successfully! You can now log in.' })
  } catch (err) {
    console.error('Verify email error:', err)
    res.status(500).json({ error: 'Verification failed. Please try again.' })
  }
})

// ─── POST /api/auth/resend-verification ────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email?.toLowerCase()])

    // Always return success (don't leak whether email exists)
    if (!user || user.email_verified) {
      return res.json({ message: 'If that email exists and is unverified, a new link has been sent.' })
    }

    const verifyToken = crypto.randomBytes(32).toString('hex')
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await dbRun(
      `UPDATE users SET email_verify_token = ?, email_verify_expires = ? WHERE id = ?`,
      [verifyToken, verifyExpires, user.id]
    )

    const verifyUrl = `${FRONTEND_URL}/auth/verify-email?token=${verifyToken}`
    await sendEmail({
      to: user.email,
      subject: 'Verify your SmallPDF.us account',
      html: emailTemplate({
        title: 'Verify your email',
        body: `<p>Hi ${user.name},</p><p>Here's your new email verification link.</p>`,
        buttonText: 'Verify Email',
        buttonUrl: verifyUrl,
        footer: 'This link expires in 24 hours.',
      }),
    })

    res.json({ message: 'If that email exists and is unverified, a new link has been sent.' })
  } catch (err) {
    console.error('Resend verification error:', err)
    res.status(500).json({ error: 'Failed to resend verification email.' })
  }
})

// ─── POST /api/auth/forgot-password ────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email?.toLowerCase()])

    // Always respond the same (security: don't reveal if email exists)
    res.json({ message: 'If an account exists with that email, you will receive a password reset link.' })

    if (!user) return

    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    await dbRun(
      `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`,
      [resetToken, resetExpires, user.id]
    )

    const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${resetToken}`
    await sendEmail({
      to: user.email,
      subject: 'Reset your SmallPDF.us password',
      html: emailTemplate({
        title: 'Reset your password',
        body: `<p>Hi ${user.name},</p>
               <p>We received a request to reset your password. Click the button below to set a new password.</p>`,
        buttonText: 'Reset Password',
        buttonUrl: resetUrl,
        footer: 'This link expires in 1 hour. If you didn\'t request this, you can safely ignore this email.',
      }),
    })
  } catch (err) {
    console.error('Forgot password error:', err)
    // Already sent response above
  }
})

// ─── POST /api/auth/reset-password ─────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password)
      return res.status(400).json({ error: 'Token and new password are required' })

    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const user = await dbGet(
      `SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > datetime('now')`,
      [token]
    )

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' })

    const passwordHash = await bcrypt.hash(password, 12)

    await dbRun(
      `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`,
      [passwordHash, user.id]
    )

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' })
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(500).json({ error: 'Failed to reset password. Please try again.' })
  }
})

// ─── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await dbGet(
      `SELECT id, name, email, plan, plan_expires_at, avatar, created_at, last_login_at FROM users WHERE id = ?`,
      [req.user.id]
    )
    if (!user) return res.status(404).json({ error: 'User not found' })

    // ── Auto-expire plan if plan_expires_at has passed ─────────────────────
    // Prevents paid-plan users from staying "paid" after subscription ends
    // if the renewal webhook didn't fire (e.g. webhook misconfigured).
    if (user.plan !== 'free' && user.plan_expires_at) {
      const expiry = new Date(user.plan_expires_at)
      if (expiry < new Date()) {
        await dbRun(
          `UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ?`,
          [user.id]
        )
        user.plan            = 'free'
        user.plan_expires_at = null
        console.log(`⏰ Plan auto-expired for userId=${user.id}`)
      }
    }

    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data' })
  }
})

// ─── POST /api/auth/refresh-token ───────────────────────────────────────────
// Re-issues a JWT with the user's CURRENT plan from the database.
// The old JWT is still valid (signature/expiry untouched) but may carry a
// stale `plan` claim — e.g. right after a payment activates a paid plan, or
// after a subscription lapses. Middleware like fileSizeLimiter/
// dailyConversionLimiter reads `plan` straight off the JWT for speed, so
// callers must swap in this fresh token whenever the plan may have changed
// (checkout success, cancellation) instead of just re-fetching /me.
router.post('/refresh-token', requireAuth, async (req, res) => {
  try {
    const user = await dbGet(
      `SELECT id, name, email, plan, plan_expires_at, avatar, created_at, last_login_at FROM users WHERE id = ?`,
      [req.user.id]
    )
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (user.plan !== 'free' && user.plan_expires_at) {
      const expiry = new Date(user.plan_expires_at)
      if (expiry < new Date()) {
        await dbRun(`UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ?`, [user.id])
        user.plan            = 'free'
        user.plan_expires_at = null
        console.log(`⏰ Plan auto-expired on refresh-token for userId=${user.id}`)
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, plan: user.plan },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.json({ token, user })
  } catch (err) {
    console.error('refresh-token error:', err)
    res.status(500).json({ error: 'Failed to refresh token' })
  }
})

// ─── GET /api/auth/history ─────────────────────────────────────────────────
// Returns the authenticated user's recent conversion + download activity.
// Used by the Account > History page.
router.get('/history', requireAuth, async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page  || '1'))
    const limit   = Math.min(50, Math.max(1, parseInt(req.query.limit || '20')))
    const offset  = (page - 1) * limit

    // We track by ip_address (not user_id) so we join on the IP stored at login time.
    // For logged-in users, use the request IP as a proxy for their recent activity.
    const ip = req.clientIP || req.ip || null

    const [rows, countRow] = await Promise.all([
      dbAll(
        `SELECT id, action, tool, filename, file_size, processing_time, status, created_at
         FROM activity_logs
         WHERE ip_address = ?
           AND type IN ('conversion','download')
           AND tool IS NOT NULL
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [ip, limit, offset]
      ),
      dbGet(
        `SELECT COUNT(*) as total FROM activity_logs
         WHERE ip_address = ? AND type IN ('conversion','download') AND tool IS NOT NULL`,
        [ip]
      ),
    ])

    res.json({
      history:    rows,
      total:      countRow?.total || 0,
      page,
      totalPages: Math.ceil((countRow?.total || 0) / limit),
    })
  } catch (err) {
    console.error('History error:', err)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

// ─── PUT /api/auth/update-profile ──────────────────────────────────────────
router.put('/update-profile', requireAuth, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

    await dbRun('UPDATE users SET name = ? WHERE id = ?', [name.trim(), req.user.id])
    res.json({ message: 'Profile updated successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// ─── PUT /api/auth/change-password ─────────────────────────────────────────
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current and new password are required' })

    if (newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' })

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash)
    if (!passwordMatch) return res.status(401).json({ error: 'Current password is incorrect' })

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id])

    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' })
  }
})


// ─── POST /api/auth/google ──────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body
    if (!credential) return res.status(400).json({ error: 'Google credential is required' })

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const { email, name, picture, sub: googleId } = payload

    if (!email) return res.status(400).json({ error: 'Could not get email from Google account' })

    let user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])

    if (user) {
      if (user.is_banned) return res.status(403).json({ error: 'Your account has been suspended.' })
      await dbRun(
        'UPDATE users SET google_id = COALESCE(google_id, ?), avatar = COALESCE(avatar, ?), last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
        [googleId, picture, user.id]
      )
    } else {
      await dbRun(
        `INSERT INTO users (name, email, password_hash, avatar, google_id, email_verified)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [name, email.toLowerCase(), '', picture, googleId]
      )
      user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])
    }

    // Check plan expiry before issuing JWT
    const effectivePlanGoogle = getEffectivePlan(user)
    if (effectivePlanGoogle !== user.plan) {
      await dbRun(`UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ?`, [user.id])
      user.plan = 'free'
      console.log(`⏰ Plan auto-expired at Google login for userId=${user.id}`)
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, plan: user.plan },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan, avatar: user.avatar },
    })
  } catch (err) {
    console.error('Google auth error:', err)
    res.status(401).json({ error: 'Google sign-in failed. Please try again.' })
  }
})

// ─── Email HTML Template ────────────────────────────────────────────────────
// ─── Welcome Email Sequence ─────────────────────────────────────────────────
// 2-email onboarding drip — fires after signup in background.
//   Day 0 (10 min delay) : Welcome + top 3 tools
//   Day 3               : "Did you know?" feature discovery
//
// The old 3rd email (day-7 upgrade nudge) lived here too, but setTimeout()
// is in-memory — any pm2 restart before it fires (deploys happen often)
// silently loses it, so it was unreliable. That job is replaced by
// sendFreeUserNurtureReminders in payments/paymentRoutes.js, which is
// DB-backed (checks every 6h via setInterval in server.js) and survives
// restarts, so every free user reliably gets exactly one nurture email.
//
// All emails are fire-and-forget (errors logged, never thrown).
async function scheduleWelcomeSequence({ name, email }) {
  const firstName = name.split(' ')[0] || name
  const siteUrl   = process.env.FRONTEND_URL || 'https://smallpdf.us'

  // These timers fire minutes-to-days after signup, so by then the account may
  // have been deleted/banned, or the address may be a typo that never verified.
  // Mailing those bounces (hurting sender reputation) and reaches people who
  // never asked for it. Check the account is still real at send time.
  //   requireVerified=false → Welcome (10 min; the user may not have clicked
  //                           the verify link yet, that's fine)
  //   requireVerified=true  → Day-3 (a still-unverified address by then is
  //                           almost certainly not a working inbox)
  async function accountStillEligible({ requireVerified }) {
    try {
      const row = await dbGet('SELECT email_verified, is_banned FROM users WHERE email = ?', [email])
      if (!row || row.is_banned) return false
      return requireVerified ? !!row.email_verified : true
    } catch {
      return false // can't confirm the account exists → don't risk a bounce
    }
  }

  // ── Email 1: Welcome (10 min delay so verify email lands first) ──────────
  setTimeout(async () => {
    try {
      if (!(await accountStillEligible({ requireVerified: false }))) return
      await sendEmail({
        to: email,
        subject: `Welcome to SmallPDF.us, ${firstName}! 🎉`,
        html: emailTemplate({
          title: `Welcome aboard, ${firstName}!`,
          body: `
<p>We're thrilled to have you. Here are the 3 most popular tools to get you started:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr>
    <td style="padding:12px;background:#fef2f2;border-radius:8px;margin-bottom:8px;">
      <strong style="color:#DC2626;">📄 PDF to Word</strong><br>
      <span style="color:#6b7280;font-size:14px;">Convert any PDF to an editable Word document in seconds.</span><br>
      <a href="${siteUrl}/pdf-to-word/" style="color:#DC2626;font-size:13px;">Try it now →</a>
    </td>
  </tr>
  <tr><td style="height:8px;"></td></tr>
  <tr>
    <td style="padding:12px;background:#fef2f2;border-radius:8px;">
      <strong style="color:#DC2626;">🗜️ Compress PDF</strong><br>
      <span style="color:#6b7280;font-size:14px;">Reduce PDF size by up to 90% without losing quality.</span><br>
      <a href="${siteUrl}/compress-pdf/" style="color:#DC2626;font-size:13px;">Try it now →</a>
    </td>
  </tr>
  <tr><td style="height:8px;"></td></tr>
  <tr>
    <td style="padding:12px;background:#fef2f2;border-radius:8px;">
      <strong style="color:#DC2626;">🔗 Merge PDF</strong><br>
      <span style="color:#6b7280;font-size:14px;">Combine multiple PDFs into one neat document.</span><br>
      <a href="${siteUrl}/merge-pdf/" style="color:#DC2626;font-size:13px;">Try it now →</a>
    </td>
  </tr>
</table>
<p style="color:#6b7280;font-size:14px;">All tools are free to use. No software to install, no sign-in needed for guests.</p>`,
          buttonText: 'Explore All Tools',
          buttonUrl: `${siteUrl}/`,
          footer: `You're receiving this because you signed up at SmallPDF.us. <a href="${siteUrl}/account/" style="color:#DC2626;">Manage your account</a>`,
        }),
      })
    } catch (e) { console.error('[welcome-email-1]', e.message) }
  }, 10 * 60 * 1000) // 10 minutes

  // ── Email 2: Feature discovery (3 days) ──────────────────────────────────
  setTimeout(async () => {
    try {
      if (!(await accountStillEligible({ requireVerified: true }))) return
      await sendEmail({
        to: email,
        subject: `Did you know SmallPDF.us can do this? 🤔`,
        html: emailTemplate({
          title: `More tools you might have missed`,
          body: `
<p>Hi ${firstName},</p>
<p>You've already discovered our PDF tools — here are a few more that power users love:</p>
<ul style="padding-left:20px;color:#374151;line-height:2;">
  <li><strong>OCR PDF</strong> — Extract text from scanned PDFs (supports 100+ languages)</li>
  <li><strong>PDF to Excel</strong> — Convert tables in PDFs directly to .xlsx files</li>
  <li><strong>Unlock PDF</strong> — Remove password protection from any PDF</li>
  <li><strong>Split PDF</strong> — Extract specific pages from a large document</li>
</ul>
<p style="color:#6b7280;font-size:14px;">All of these work right in your browser — no software needed.</p>`,
          buttonText: 'See All 18 Tools',
          buttonUrl: `${siteUrl}/`,
          footer: `You're receiving this because you signed up at SmallPDF.us. <a href="${siteUrl}/account/" style="color:#DC2626;">Manage preferences</a>`,
        }),
      })
    } catch (e) { console.error('[welcome-email-2]', e.message) }
  }, 3 * 24 * 60 * 60 * 1000) // 3 days
}

function emailTemplate({ title, body, buttonText, buttonUrl, footer }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#DC2626;padding:28px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">📄 SmallPDF.us</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;color:#1f2937;font-size:15px;line-height:1.7;">
            <h2 style="margin:0 0 20px;color:#111827;font-size:22px;">${title}</h2>
            ${body}
            <div style="text-align:center;margin:32px 0;">
              <a href="${buttonUrl}" style="background:#DC2626;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">${buttonText}</a>
            </div>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">Or copy this link: <a href="${buttonUrl}" style="color:#DC2626;word-break:break-all;">${buttonUrl}</a></p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:13px;margin:0;line-height:1.5;">${footer}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

module.exports = { router, requireAuth }