// middleware/authMiddleware.js
// Shared JWT verification — used by paymentRoutes.js
// Reads JWT_SECRET from .env (loaded by server.js via dotenv)

const jwt = require('jsonwebtoken')

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header) return res.status(401).json({ error: 'Authentication required' })

    const token = header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : header.trim()

    if (!token) return res.status(401).json({ error: 'Authentication required' })

    // Read JWT_SECRET at call-time (not module load-time)
    // This guarantees dotenv has already run in server.js before we read it
    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('❌ JWT_SECRET is not set in .env!')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    req.user = jwt.verify(token, secret)
    next()
  } catch (err) {
    console.error('Auth failed:', err.message)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth }