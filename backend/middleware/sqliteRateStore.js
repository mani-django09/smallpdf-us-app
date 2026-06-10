// middleware/sqliteRateStore.js
// Persistent rate-limit storage backed by the existing SQLite database.
//
// Replaces the default in-memory MemoryStore of express-rate-limit (which resets
// on every server restart and is not shared across instances) and the in-memory
// ocrDailyMap used for the free-plan OCR quota.
//
// All state lives in the `rate_limits` table (see database.js):
//   bucket | ident | count | expires_at(ms)

const { dbRun, dbGet } = require('../database')

// ── express-rate-limit Store (v7 async interface) ────────────────────────────
// Usage: new SQLiteRateStore('api')  → pass as `store` to rateLimit({...})
class SQLiteRateStore {
  constructor(bucket) {
    this.bucket = bucket
    this.windowMs = 60 * 1000 // overwritten by init() with the limiter's real value
  }

  // express-rate-limit calls this once with the limiter options.
  init(options) {
    if (options && typeof options.windowMs === 'number') {
      this.windowMs = options.windowMs
    }
  }

  async increment(key) {
    const now = Date.now()
    const expires = now + this.windowMs
    // Atomic upsert: start a fresh window if the old one expired, else +1.
    await dbRun(
      `INSERT INTO rate_limits (bucket, ident, count, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket, ident) DO UPDATE SET
         count      = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
         expires_at = CASE WHEN rate_limits.expires_at <= ? THEN ? ELSE rate_limits.expires_at END`,
      [this.bucket, key, expires, now, now, expires]
    )
    const row = await dbGet(
      'SELECT count, expires_at FROM rate_limits WHERE bucket = ? AND ident = ?',
      [this.bucket, key]
    )
    return { totalHits: row ? row.count : 1, resetTime: new Date(row ? row.expires_at : expires) }
  }

  async decrement(key) {
    await dbRun(
      'UPDATE rate_limits SET count = MAX(0, count - 1) WHERE bucket = ? AND ident = ? AND expires_at > ?',
      [this.bucket, key, Date.now()]
    )
  }

  async resetKey(key) {
    await dbRun('DELETE FROM rate_limits WHERE bucket = ? AND ident = ?', [this.bucket, key])
  }

  async resetAll() {
    await dbRun('DELETE FROM rate_limits WHERE bucket = ?', [this.bucket])
  }

  async get(key) {
    const row = await dbGet(
      'SELECT count, expires_at FROM rate_limits WHERE bucket = ? AND ident = ?',
      [this.bucket, key]
    )
    if (!row || row.expires_at <= Date.now()) return undefined
    return { totalHits: row.count, resetTime: new Date(row.expires_at) }
  }
}

// ── Free-plan OCR daily quota (resets at UTC midnight) ───────────────────────
const OCR_BUCKET = 'ocr-daily'

function nextUtcMidnight() {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0) // rolls into tomorrow 00:00 UTC
  return d.getTime()
}

// Returns true if the IP may still run an OCR today (under `max`).
async function ocrCheckDaily(ip, max = 1) {
  const row = await dbGet(
    'SELECT count, expires_at FROM rate_limits WHERE bucket = ? AND ident = ?',
    [OCR_BUCKET, ip]
  )
  if (!row || row.expires_at <= Date.now()) return true // new day → fresh quota
  return row.count < max
}

// Records one successful OCR for the IP for today.
async function ocrIncrementDaily(ip) {
  const now = Date.now()
  const expires = nextUtcMidnight()
  await dbRun(
    `INSERT INTO rate_limits (bucket, ident, count, expires_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(bucket, ident) DO UPDATE SET
       count      = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
       expires_at = CASE WHEN rate_limits.expires_at <= ? THEN ? ELSE rate_limits.expires_at END`,
    [OCR_BUCKET, ip, expires, now, now, expires]
  )
}

// Deletes expired rows so the table doesn't grow unbounded. Call on a schedule.
async function cleanupExpiredRateLimits() {
  try {
    const { changes } = await dbRun('DELETE FROM rate_limits WHERE expires_at <= ?', [Date.now()])
    return changes || 0
  } catch (err) {
    console.error('Rate-limit cleanup error:', err.message)
    return 0
  }
}

// ── Free-plan daily conversion quota ────────────────────────────────────────
// Counts every successful conversion request (per-IP for guests, per-user-id
// for logged-in users). Resets at UTC midnight.
//
// Limits:
//   guest (no account)  →  3 / day   (strong push to sign up)
//   free plan (account) →  5 / day   (push to upgrade)
//   starter / pro / … → unlimited (0 = skip check)
//
// Usage in server.js  (place AFTER fileSizeLimiter / batchLimiter, BEFORE handler):
//   const { dailyConversionLimiter } = require('./middleware/sqliteRateStore')
//   app.post('/api/compress-pdf-batch', upload.array(...), fileSizeLimiter(...),
//            batchLimiter(...), dailyConversionLimiter(), fileValidation, handler)

const fs  = require('fs')
const jwt = require('jsonwebtoken')
const JWT_SECRET_DC = process.env.JWT_SECRET || 'change-this-secret-in-production'

const DAILY_CONV_BUCKET = 'conv-daily'

const DAILY_CONV_LIMITS = {
  guest:   3,   // not logged in
  free:    5,   // logged in, free plan
  starter: 0,   // 0 = unlimited
  pro:     0,
  agency:  0,
  enterprise: 0,
}

function getUserFromRequestDC(req) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return null
    return jwt.verify(header.replace('Bearer ', '').trim(), JWT_SECRET_DC)
  } catch { return null }
}

function cleanupUploadedFiles(req) {
  const files = Array.isArray(req.files) ? req.files
              : req.files ? Object.values(req.files).flat()
              : req.file  ? [req.file]
              : []
  for (const f of files) {
    try { if (f?.path && fs.existsSync(f.path)) fs.unlinkSync(f.path) } catch (_) {}
  }
}

async function dailyConvCheckAndIncrement(identifier, limit) {
  const now     = Date.now()
  const expires = nextUtcMidnight()
  // Atomic upsert — same pattern as OCR quota above
  await dbRun(
    `INSERT INTO rate_limits (bucket, ident, count, expires_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(bucket, ident) DO UPDATE SET
       count      = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
       expires_at = CASE WHEN rate_limits.expires_at <= ? THEN ? ELSE rate_limits.expires_at END`,
    [DAILY_CONV_BUCKET, identifier, expires, now, now, expires]
  )
  const row = await dbGet(
    'SELECT count, expires_at FROM rate_limits WHERE bucket = ? AND ident = ?',
    [DAILY_CONV_BUCKET, identifier]
  )
  const count = row ? row.count : 1
  return { allowed: count <= limit, count, limit, resetTime: new Date(row ? row.expires_at : expires) }
}

/**
 * Middleware factory — drop into any conversion route.
 * Returns 429 { error: 'DAILY_LIMIT_EXCEEDED', ... } when over limit.
 */
function dailyConversionLimiter() {
  return async (req, res, next) => {
    try {
      // Identify user & plan
      const user   = getUserFromRequestDC(req)
      const plan   = user?.plan || (user ? 'free' : 'guest')
      const dlimit = DAILY_CONV_LIMITS[plan] ?? DAILY_CONV_LIMITS.free

      // Paid plans: skip entirely
      if (dlimit === 0) return next()

      // Identifier: prefer user-id (survives IP change), fallback to IP
      const identifier = user?.id
        ? `u:${user.id}`
        : `ip:${req.clientIP || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown'}`

      const { allowed, count, limit, resetTime } = await dailyConvCheckAndIncrement(identifier, dlimit)

      if (allowed) return next()

      // Over limit — discard uploaded files and respond
      cleanupUploadedFiles(req)

      const resetHr = resetTime
        ? resetTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
        : 'midnight UTC'

      return res.status(429).json({
        error:      'DAILY_LIMIT_EXCEEDED',
        count,
        limit,
        resetTime:  resetTime?.toISOString(),
        resetHr,
        isGuest:    !user,
        plan,
        upgradeUrl: '/pricing',
        loginUrl:   '/auth/login',
        message: !user
          ? `You've used all ${limit} free conversions for today. Create a free account for ${DAILY_CONV_LIMITS.free}/day, or upgrade to Pro for unlimited.`
          : `You've reached your ${limit} free conversions for today. Upgrade to Pro for unlimited conversions. Resets at ${resetHr}.`,
      })
    } catch (err) {
      // Never block a conversion due to a quota-check error
      console.error('[dailyConversionLimiter] error:', err.message)
      return next()
    }
  }
}

module.exports = {
  SQLiteRateStore,
  ocrCheckDaily,
  ocrIncrementDaily,
  cleanupExpiredRateLimits,
  dailyConversionLimiter,
  DAILY_CONV_LIMITS,
}
