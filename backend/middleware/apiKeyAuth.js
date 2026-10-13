// middleware/apiKeyAuth.js
// Authenticates /api/v1/* requests via an "X-API-Key" header (or Bearer token).
// Loads the owning user, enforces the monthly quota for their plan, meters usage,
// and sets req.user + quota headers. Used instead of JWT for the developer API.

const { dbGet, dbRun } = require('../database')
const { getEffectivePlan } = require('./authMiddleware')
const { quotaForPlan, currentPeriod, getUsage, incrementUsage, findKeyRecord, touchKey } = require('../api/apiKeys')

function extractKey(req) {
  const h = req.headers['x-api-key']
  if (h && typeof h === 'string') return h.trim()
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim()
    if (t.startsWith('sk_')) return t   // only treat sk_ tokens as API keys
  }
  return null
}

async function apiKeyAuth(req, res, next) {
  try {
    // ── RapidAPI gateway ──────────────────────────────────────────────────
    // When listed on RapidAPI, requests arrive through their proxy carrying a
    // secret header. RapidAPI authenticates the developer and enforces the
    // plan/quota on its side, so we trust the proxy secret and skip our own
    // key check + metering for these calls.
    const rapidSecret = process.env.RAPIDAPI_PROXY_SECRET
    if (rapidSecret && req.headers['x-rapidapi-proxy-secret'] === rapidSecret) {
      req.user = { id: null, plan: 'rapidapi', via: 'rapidapi' }
      req.meterUsage = async () => {}
      return next()
    }

    const rawKey = extractKey(req)
    if (!rawKey) {
      return res.status(401).json({ error: 'Missing API key. Pass it in the "X-API-Key" header.', code: 'NO_API_KEY' })
    }

    const record = await findKeyRecord(rawKey)
    if (!record) {
      return res.status(401).json({ error: 'Invalid or revoked API key.', code: 'BAD_API_KEY' })
    }

    const user = await dbGet(
      'SELECT id, email, name, plan, plan_expires_at, is_banned FROM users WHERE id = ?',
      [record.user_id]
    )
    if (!user) return res.status(401).json({ error: 'Account not found.', code: 'NO_USER' })
    if (user.is_banned) return res.status(403).json({ error: 'Account suspended.', code: 'BANNED' })

    const plan = getEffectivePlan(user)
    const quota = quotaForPlan(plan)
    const period = currentPeriod()
    const used = await getUsage(user.id, period)

    // Quota headers on every response (success or 429).
    res.set('X-RateLimit-Limit', String(quota))
    res.set('X-RateLimit-Remaining', String(Math.max(0, quota - used)))
    res.set('X-RateLimit-Period', period)

    if (used >= quota) {
      return res.status(429).json({
        error: `Monthly API quota reached (${quota} requests on the "${plan}" plan). Upgrade for a higher limit.`,
        code: 'QUOTA_EXCEEDED',
        quota, used, period,
      })
    }

    touchKey(record.id)
    req.user = { id: user.id, email: user.email, name: user.name, plan }
    req.apiKeyId = record.id
    // Handlers call req.meterUsage() AFTER successful processing so failed
    // requests don't consume the caller's quota.
    req.meterUsage = () => incrementUsage(user.id, period)
    next()
  } catch (err) {
    console.error('[apiKeyAuth] error:', err.message)
    res.status(500).json({ error: 'Internal authentication error.', code: 'AUTH_ERROR' })
  }
}

module.exports = { apiKeyAuth }
