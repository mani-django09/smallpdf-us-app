// api/apiKeys.js
// Developer API keys + monthly usage metering for the paid PDF API.
//
// Keys are shown to the user ONCE at creation; we store only a SHA-256 hash
// (like Stripe/GitHub). Lookups hash the incoming key and match. A short,
// non-secret prefix is stored for display ("sk_live_ab12…").
//
// Monthly quota is tied to the user's existing plan — no new billing needed.

const express = require('express')
const crypto = require('crypto')
const { dbRun, dbGet, dbAll } = require('../database')
const { requireAuth } = require('../middleware/authMiddleware')

// Monthly API call quota per plan. Free gets a small trial allowance.
const PLAN_QUOTAS = {
  free:       50,
  starter:    1000,
  pro:        10000,
  agency:     100000,
  enterprise: 500000,
}

function quotaForPlan(plan) {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free
}

function currentPeriod() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// ── Schema ────────────────────────────────────────────────────────────────
function initApiTables() {
  return new Promise((resolve) => {
    dbRun(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        name        TEXT,
        key_hash    TEXT UNIQUE NOT NULL,
        key_prefix  TEXT NOT NULL,
        revoked     INTEGER DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME
      )
    `).then(() =>
      dbRun(`
        CREATE TABLE IF NOT EXISTS api_usage (
          user_id INTEGER NOT NULL,
          period  TEXT NOT NULL,
          count   INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, period)
        )
      `)
    ).then(() => {
      dbRun('CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)').catch(() => {})
      dbRun('CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)').catch(() => {})
      console.log('✓ API keys + usage tables ready')
      resolve()
    }).catch((err) => {
      console.error('Error creating API tables:', err.message)
      resolve()
    })
  })
}

// ── Usage helpers (used by apiKeyAuth) ──────────────────────────────────────
async function getUsage(userId, period = currentPeriod()) {
  const row = await dbGet('SELECT count FROM api_usage WHERE user_id = ? AND period = ?', [userId, period])
  return row ? row.count : 0
}

async function incrementUsage(userId, period = currentPeriod()) {
  await dbRun(
    `INSERT INTO api_usage (user_id, period, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, period) DO UPDATE SET count = count + 1`,
    [userId, period]
  )
}

async function findKeyRecord(rawKey) {
  return dbGet('SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0', [hashKey(rawKey)])
}

async function touchKey(id) {
  dbRun('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [id]).catch(() => {})
}

// ── Management router (JWT-authed dashboard) ────────────────────────────────
const router = express.Router()

// List the user's keys (never returns the secret — only prefix).
router.get('/', requireAuth, async (req, res) => {
  try {
    const keys = await dbAll(
      'SELECT id, name, key_prefix, revoked, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    )
    const plan = req.user.plan || 'free'
    const period = currentPeriod()
    const used = await getUsage(req.user.id, period)
    res.json({
      success: true,
      keys,
      usage: { used, quota: quotaForPlan(plan), period, plan },
    })
  } catch (err) {
    console.error('[apiKeys] list error:', err.message)
    res.status(500).json({ success: false, error: 'Could not load API keys' })
  }
})

// Create a new key — returns the full secret exactly once.
router.post('/', requireAuth, async (req, res) => {
  try {
    const existing = await dbAll('SELECT id FROM api_keys WHERE user_id = ? AND revoked = 0', [req.user.id])
    if (existing.length >= 10) {
      return res.status(400).json({ success: false, error: 'Key limit reached (max 10 active). Revoke one first.' })
    }
    const name = (req.body?.name || 'Default').toString().slice(0, 60)
    const rawKey = 'sk_live_' + crypto.randomBytes(24).toString('hex')
    const prefix = rawKey.slice(0, 16) + '…'

    await dbRun(
      'INSERT INTO api_keys (user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?)',
      [req.user.id, name, hashKey(rawKey), prefix]
    )
    res.json({ success: true, key: rawKey, name, note: 'Store this key now — it will not be shown again.' })
  } catch (err) {
    console.error('[apiKeys] create error:', err.message)
    res.status(500).json({ success: false, error: 'Could not create API key' })
  }
})

// Revoke a key the user owns.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const row = await dbGet('SELECT id FROM api_keys WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
    if (!row) return res.status(404).json({ success: false, error: 'Key not found' })
    await dbRun('UPDATE api_keys SET revoked = 1 WHERE id = ?', [row.id])
    res.json({ success: true })
  } catch (err) {
    console.error('[apiKeys] revoke error:', err.message)
    res.status(500).json({ success: false, error: 'Could not revoke key' })
  }
})

module.exports = {
  router,
  initApiTables,
  quotaForPlan,
  currentPeriod,
  getUsage,
  incrementUsage,
  findKeyRecord,
  touchKey,
  PLAN_QUOTAS,
}
