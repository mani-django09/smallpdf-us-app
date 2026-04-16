// middleware/authMiddleware.js
// Shared JWT verification — used by paymentRoutes.js
// Reads JWT_SECRET from .env (loaded by server.js via dotenv)

const jwt      = require('jsonwebtoken')
const { dbGet, dbRun } = require('../database')

// Returns 'free' if plan_expires_at has passed, otherwise the stored plan.
function getEffectivePlan(user) {
  if (!user || user.plan === 'free') return 'free'
  if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) return 'free'
  return user.plan
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header) return res.status(401).json({ error: 'Authentication required' })

    const token = header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : header.trim()

    if (!token) return res.status(401).json({ error: 'Authentication required' })

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('❌ JWT_SECRET is not set in .env!')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const decoded = jwt.verify(token, secret)

    // ── Re-fetch user from DB on every request ────────────────────────────
    // The JWT carries the plan at login time. If the plan expired or the
    // webhook updated it since then, req.user would have stale data.
    // Fetching from DB ensures batchLimiter, fileSizeLimiter, and all
    // payment routes always see the current plan.
    const user = await dbGet(
      'SELECT id, email, name, plan, plan_expires_at, is_banned FROM users WHERE id = ?',
      [decoded.id]
    )

    if (!user) return res.status(401).json({ error: 'User not found' })
    if (user.is_banned) return res.status(403).json({ error: 'Your account has been suspended. Contact support.' })

    // ── Auto-expire: downgrade to free if plan_expires_at passed ─────────
    const effectivePlan = getEffectivePlan(user)
    if (effectivePlan !== user.plan) {
      await dbRun(
        `UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ?`,
        [user.id]
      )
      user.plan            = 'free'
      user.plan_expires_at = null
      console.log(`⏰ Plan auto-expired on request for userId=${user.id}`)
    }

    req.user = { ...decoded, plan: user.plan }
    next()
  } catch (err) {
    console.error('Auth failed:', err.message)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth, getEffectivePlan }