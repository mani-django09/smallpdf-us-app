// payments/appProRoutes.js
// SnapPDF Android app: turns an active Google Play subscription (tracked by
// RevenueCat) into a short-lived JWT with plan:'pro'. The existing limiters
// (fileSizeLimiter, batchLimiter, dailyConversionLimiter) already read the plan
// from the Bearer token, so Pro app users get Pro limits with no other change.
//
// Needs REVENUECAT_SECRET_KEY (RevenueCat → API keys → Secret key, "sk_...")
// in .env. Without it the endpoint answers 503 and nothing else is affected.

const express = require('express')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production'
const TOKEN_TTL = '24h'
const CACHE_MS = 60 * 1000
const cache = new Map() // appUserId -> { active, at }

// RevenueCat anonymous ids look like "$RCAnonymousID:<32 hex>"
const validAppUserId = (id) => typeof id === 'string' && /^[\w$:.\-]{8,128}$/.test(id)

async function hasActiveEntitlement(appUserId) {
  const hit = cache.get(appUserId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.active

  const resp = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    }
  )
  if (!resp.ok) throw new Error(`RevenueCat ${resp.status}`)
  const data = await resp.json()
  const ents = data?.subscriber?.entitlements || {}
  const now = Date.now()
  // expires_date null = lifetime; grace period keeps access a little longer
  const active = Object.values(ents).some((e) => {
    if (!e.expires_date) return true
    const until = Date.parse(e.grace_period_expires_date || e.expires_date)
    return Number.isFinite(until) && until > now
  })
  cache.set(appUserId, { active, at: now })
  if (cache.size > 5000) cache.clear()
  return active
}

router.post('/pro-token', async (req, res) => {
  if (!process.env.REVENUECAT_SECRET_KEY) {
    return res.status(503).json({ error: 'APP_PRO_NOT_CONFIGURED' })
  }
  const appUserId = req.body?.appUserId
  if (!validAppUserId(appUserId)) {
    return res.status(400).json({ error: 'INVALID_APP_USER' })
  }
  try {
    if (!(await hasActiveEntitlement(appUserId))) {
      return res.status(402).json({ error: 'NO_ACTIVE_SUBSCRIPTION' })
    }
    const id = 'app:' + crypto.createHash('sha256').update(appUserId).digest('hex').slice(0, 24)
    const token = jwt.sign({ id, plan: 'pro', source: 'revenuecat' }, JWT_SECRET, { expiresIn: TOKEN_TTL })
    res.json({ token, plan: 'pro', expiresInHours: 24 })
  } catch (err) {
    console.error('[app-pro] verify failed:', err.message)
    res.status(502).json({ error: 'VERIFY_FAILED' })
  }
})

module.exports = { router }
