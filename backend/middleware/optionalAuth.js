// middleware/optionalAuth.js
// Like requireAuth, but NON-blocking: if a valid Bearer token is present it
// populates req.user; otherwise it just continues as an anonymous request.
// Used by tool routes so we can attach converted files to a logged-in user's
// "My Files" history without forcing login on everyone.

const jwt = require('jsonwebtoken')
const { dbGet } = require('../database')

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header) return next()

    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim()
    if (!token) return next()

    const secret = process.env.JWT_SECRET
    if (!secret) return next()

    const decoded = jwt.verify(token, secret)
    const user = await dbGet(
      'SELECT id, email, name, plan, plan_expires_at, is_banned FROM users WHERE id = ?',
      [decoded.id]
    )

    if (user && !user.is_banned) {
      // Effective plan: downgrade to free if the paid plan has lapsed.
      let plan = user.plan
      if (plan !== 'free' && user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) {
        plan = 'free'
      }
      req.user = { id: user.id, email: user.email, name: user.name, plan }
    }
  } catch (_) {
    // Invalid/expired token on an optional route → just treat as anonymous.
  }
  return next()
}

module.exports = { optionalAuth }
