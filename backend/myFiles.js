// myFiles.js
// "My Files" history for logged-in users.
//
// When a logged-in user runs a tool, the produced output file is recorded here
// with a retention window based on their plan:
//   • free    → 1 hour
//   • starter → 24 hours
//   • pro / agency → 48 hours   (as promised in the /pricing comparison table)
// A background sweep deletes the physical file and the DB row once expired, so
// nothing lingers beyond the promised window (privacy + disk hygiene).
//
// Storage is the existing local disk — we only store METADATA + a pointer to
// the already-produced output file; we do not copy the file anywhere.

const express = require('express')
const fs = require('fs')
const path = require('path')
const { dbRun, dbGet, dbAll } = require('./database')
const { requireAuth } = require('./middleware/authMiddleware')

const HOUR = 60 * 60 * 1000
const RETENTION_MS = {
  free: HOUR,
  starter: 24 * HOUR,
  pro: 48 * HOUR,
  agency: 48 * HOUR,
  enterprise: 48 * HOUR,
}

// ── Schema ──────────────────────────────────────────────────────────────────
function initMyFilesTable() {
  return new Promise((resolve) => {
    dbRun(`
      CREATE TABLE IF NOT EXISTS user_files (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL,
        tool          TEXT,
        original_name TEXT,
        job_id        TEXT,
        stored_path   TEXT NOT NULL,
        download_url  TEXT,
        file_size     INTEGER,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at    INTEGER NOT NULL
      )
    `).then(() => {
      dbRun('CREATE INDEX IF NOT EXISTS idx_user_files_user ON user_files(user_id)').catch(() => {})
      dbRun('CREATE INDEX IF NOT EXISTS idx_user_files_expires ON user_files(expires_at)').catch(() => {})
      console.log('✓ user_files table ready')
      resolve()
    }).catch((err) => {
      console.error('Error creating user_files table:', err.message)
      resolve()
    })
  })
}

// ── Recording ────────────────────────────────────────────────────────────────
// Call after a tool produces output. Safe to call for anonymous requests — it
// no-ops when there is no userId. Never throws into the request path.
async function recordUserFile({ userId, plan, tool, originalName, jobId, storedPath, downloadUrl, fileSize }) {
  try {
    if (!userId || !storedPath) return
    const ttl = RETENTION_MS[plan] || RETENTION_MS.free
    const expiresAt = Date.now() + ttl

    await dbRun(
      `INSERT INTO user_files (user_id, tool, original_name, job_id, stored_path, download_url, file_size, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, tool || null, originalName || null, jobId || null, storedPath, downloadUrl || null, fileSize || null, expiresAt]
    )
  } catch (err) {
    console.error('[myFiles] recordUserFile failed:', err.message)
  }
}

// ── Retention sweep ──────────────────────────────────────────────────────────
async function sweepExpiredFiles() {
  try {
    const now = Date.now()
    const expired = await dbAll('SELECT id, stored_path FROM user_files WHERE expires_at <= ?', [now])
    for (const row of expired) {
      try {
        if (row.stored_path && fs.existsSync(row.stored_path)) {
          fs.unlinkSync(row.stored_path)
          // Clean up the job folder if it's now empty (compressed/<jobId>/ etc.)
          const dir = path.dirname(row.stored_path)
          if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
            fs.rmdirSync(dir)
          }
        }
      } catch (_) { /* ignore individual file errors */ }
    }
    if (expired.length > 0) {
      await dbRun('DELETE FROM user_files WHERE expires_at <= ?', [now])
      console.log(`🧹 [myFiles] swept ${expired.length} expired file(s)`)
    }
  } catch (err) {
    console.error('[myFiles] sweep error:', err.message)
  }
}

function startFileRetentionSweep(intervalMs = 10 * 60 * 1000) {
  sweepExpiredFiles() // run once on boot
  const timer = setInterval(sweepExpiredFiles, intervalMs)
  if (timer.unref) timer.unref()
  return timer
}

// ── Router ───────────────────────────────────────────────────────────────────
const router = express.Router()

// List the current user's non-expired files (newest first).
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id, tool, original_name, job_id, download_url, file_size, created_at, expires_at
       FROM user_files
       WHERE user_id = ? AND expires_at > ?
       ORDER BY created_at DESC`,
      [req.user.id, Date.now()]
    )
    res.json({
      success: true,
      files: rows.map((r) => ({
        id: r.id,
        tool: r.tool,
        name: r.original_name,
        jobId: r.job_id,
        downloadUrl: r.download_url,
        size: r.file_size,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        expiresInMs: r.expires_at - Date.now(),
      })),
    })
  } catch (err) {
    console.error('[myFiles] list error:', err.message)
    res.status(500).json({ success: false, error: 'Could not load your files' })
  }
})

// Stream a file the user owns (if still present and not expired).
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT * FROM user_files WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!row) return res.status(404).json({ success: false, error: 'File not found' })
    if (row.expires_at <= Date.now()) return res.status(410).json({ success: false, error: 'This file has expired' })
    if (!row.stored_path || !fs.existsSync(row.stored_path)) {
      return res.status(404).json({ success: false, error: 'File is no longer available' })
    }
    res.download(row.stored_path, row.original_name || path.basename(row.stored_path))
  } catch (err) {
    console.error('[myFiles] download error:', err.message)
    res.status(500).json({ success: false, error: 'Download failed' })
  }
})

// Delete a file the user owns (removes row + physical file immediately).
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT * FROM user_files WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!row) return res.status(404).json({ success: false, error: 'File not found' })

    try {
      if (row.stored_path && fs.existsSync(row.stored_path)) fs.unlinkSync(row.stored_path)
    } catch (_) { /* ignore */ }

    await dbRun('DELETE FROM user_files WHERE id = ?', [row.id])
    res.json({ success: true })
  } catch (err) {
    console.error('[myFiles] delete error:', err.message)
    res.status(500).json({ success: false, error: 'Delete failed' })
  }
})

module.exports = {
  router,
  initMyFilesTable,
  recordUserFile,
  startFileRetentionSweep,
  sweepExpiredFiles,
}
