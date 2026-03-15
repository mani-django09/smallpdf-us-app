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
const { dbRun, dbGet } = require('../database')

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production'
const JWT_EXPIRES_IN = '7d'
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://smallpdf.us'

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

    await dbRun(
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

    res.status(201).json({ message: 'Account created. Please check your email to verify your account.' })
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
      `SELECT id, name, email, plan, avatar, created_at, last_login_at FROM users WHERE id = ?`,
      [req.user.id]
    )
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data' })
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