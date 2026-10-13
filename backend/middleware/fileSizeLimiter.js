// middleware/fileSizeLimiter.js
// Freemium file-size gate.
//
// FREE limits — guests AND free-plan users are capped.
// PRO/Enterprise users have no size restriction.
//
// Usage in server.js:
//   const { fileSizeLimiter } = require('./middleware/fileSizeLimiter')
//   app.post('/api/compress-pdf-batch', fileSizeLimiter('compress-pdf'), upload.array(...), ...)

const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production'

// ── Free-tier limits (bytes) ────────────────────────────────────────────────
// Any tool not listed here falls back to FREE_DEFAULT (10 MB)
// Must mirror frontend/hooks/useFileSizeGuard.js FREE_LIMITS exactly.
const FREE_DEFAULT = 10 * 1024 * 1024 // 10 MB

const FREE_LIMITS = {
  // PDF utilities
  'ocr-pdf':         10 * 1024 * 1024,   //  10 MB
  'merge-pdf':       25 * 1024 * 1024,   //  25 MB
  'split-pdf':       10 * 1024 * 1024,   //  10 MB
  'compress-pdf':    20 * 1024 * 1024,   //  20 MB
  'unlock-pdf':      10 * 1024 * 1024,   //  10 MB
  'rotate-pdf':      10 * 1024 * 1024,   //  10 MB
  'protect-pdf':     10 * 1024 * 1024,   //  10 MB
  'redact-pdf':      10 * 1024 * 1024,   //  10 MB
  'edit-pdf':        10 * 1024 * 1024,   //  10 MB

  // Office conversions
  'word-to-pdf':      5 * 1024 * 1024,   //   5 MB
  'ppt-to-pdf':       5 * 1024 * 1024,   //   5 MB
  'excel-to-pdf':     5 * 1024 * 1024,   //   5 MB
  'pdf-to-word':      5 * 1024 * 1024,   //   5 MB
  'pdf-to-ppt':       5 * 1024 * 1024,   //   5 MB
  'pdf-to-excel':     5 * 1024 * 1024,   //   5 MB

  // Image/PDF conversions
  'pdf-to-jpg':       5 * 1024 * 1024,   //   5 MB
  'pdf-to-png':       5 * 1024 * 1024,   //   5 MB
  'jpg-to-pdf':       5 * 1024 * 1024,   //   5 MB
  'png-to-pdf':       5 * 1024 * 1024,   //   5 MB
  'webp-to-png':      5 * 1024 * 1024,   //   5 MB
  'png-to-webp':      5 * 1024 * 1024,   //   5 MB
  'heic-to-jpg':     10 * 1024 * 1024,   //  10 MB
  'heic-to-png':     10 * 1024 * 1024,   //  10 MB
  'compress-image':  15 * 1024 * 1024,   //  15 MB
}

// ── Starter-tier limits (bytes) ─────────────────────────────────────────────
// Must mirror frontend/hooks/useFileSizeGuard.js STARTER_LIMITS exactly.
// Starter: 100 MB for PDF tools, 20 MB for office & image conversions
const STARTER_DEFAULT = 100 * 1024 * 1024 // 100 MB

const STARTER_LIMITS = {
  // PDF tools: 100 MB (falls through to STARTER_DEFAULT, listed explicitly for clarity)
  'ocr-pdf':         100 * 1024 * 1024,  // 100 MB
  'merge-pdf':       200 * 1024 * 1024,  // 200 MB
  'split-pdf':       100 * 1024 * 1024,  // 100 MB
  'compress-pdf':    100 * 1024 * 1024,  // 100 MB
  'unlock-pdf':      100 * 1024 * 1024,  // 100 MB
  'rotate-pdf':      100 * 1024 * 1024,  // 100 MB
  'protect-pdf':     100 * 1024 * 1024,  // 100 MB
  'redact-pdf':      100 * 1024 * 1024,  // 100 MB
  'edit-pdf':        100 * 1024 * 1024,  // 100 MB
  // Office conversions: 20 MB
  'word-to-pdf':      20 * 1024 * 1024,  //  20 MB
  'ppt-to-pdf':       20 * 1024 * 1024,  //  20 MB
  'excel-to-pdf':     20 * 1024 * 1024,  //  20 MB
  'pdf-to-word':      20 * 1024 * 1024,  //  20 MB
  'pdf-to-ppt':       20 * 1024 * 1024,  //  20 MB
  'pdf-to-excel':     20 * 1024 * 1024,  //  20 MB
  // Image tools: 20 MB
  'pdf-to-jpg':       20 * 1024 * 1024,  //  20 MB
  'pdf-to-png':       20 * 1024 * 1024,  //  20 MB
  'jpg-to-pdf':       20 * 1024 * 1024,  //  20 MB
  'png-to-pdf':       20 * 1024 * 1024,  //  20 MB
  'webp-to-png':      20 * 1024 * 1024,  //  20 MB
  'png-to-webp':      20 * 1024 * 1024,  //  20 MB
  'heic-to-jpg':      40 * 1024 * 1024,  //  40 MB
  'heic-to-png':      40 * 1024 * 1024,  //  40 MB
  'compress-image':   20 * 1024 * 1024,  //  20 MB
}

// ── Helper: decode JWT without throwing ────────────────────────────────────
function getUserFromRequest(req) {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return null
    const token = header.replace('Bearer ', '').trim()
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// ── Helper: format bytes for human-readable error messages ──────────────────
function fmtMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(0) + ' MB'
}

// ── Middleware factory ───────────────────────────────────────────────────────
/**
 * @param {string} toolName  — key from FREE_LIMITS, e.g. 'compress-pdf'
 *
 * Logic:
 *  1. If user is PRO or enterprise → skip limit entirely.
 *  2. Otherwise (guest or free-plan) → sum total upload size across all files.
 *     If total > limit → return 413 with structured JSON the frontend can read.
 *
 * The middleware runs AFTER multer has saved the files to disk, so req.files
 * (or req.file) is already populated when this runs.
 */
function fileSizeLimiter(toolName) {
  const freeLimit    = FREE_LIMITS[toolName]    ?? FREE_DEFAULT
  const starterLimit = STARTER_LIMITS[toolName] ?? STARTER_DEFAULT

  return (req, res, next) => {
    // ── 1. Identify user ───────────────────────────────────────────────────
    const user = getUserFromRequest(req)

    // Pro and Agency/Enterprise users bypass all size limits
    if (user && (user.plan === 'pro' || user.plan === 'agency' || user.plan === 'enterprise')) {
      return next()
    }

    // ── 2. Determine the applicable limit for this user's plan ─────────────
    const limit = (user?.plan === 'starter') ? starterLimit : freeLimit

    // ── 3. Collect uploaded files ──────────────────────────────────────────
    const files = req.files
      ? Array.isArray(req.files) ? req.files : Object.values(req.files).flat()
      : req.file ? [req.file]
      : []

    if (files.length === 0) return next()

    // ── 4. Calculate total size ────────────────────────────────────────────
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)

    if (totalSize <= limit) return next()

    // ── 5. Over limit — clean up temp files then respond ──────────────────
    const fs = require('fs')
    for (const f of files) {
      try { if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path) } catch (_) {}
    }

    const isGuest = !user

    return res.status(413).json({
      error: 'FILE_SIZE_LIMIT_EXCEEDED',
      tool: toolName,
      limitMB: Math.round(limit / (1024 * 1024)),
      uploadedMB: Math.round(totalSize / (1024 * 1024)),
      isGuest,
      message: isGuest
        ? `Files total ${fmtMB(totalSize)} — free limit is ${fmtMB(limit)}. Sign in to unlock larger files.`
        : `Files total ${fmtMB(totalSize)} — your plan limit for this tool is ${fmtMB(limit)}. Upgrade for larger files.`,
      upgradeUrl: '/pricing',
      loginUrl:   '/auth/login',
    })
  }
}

module.exports = { fileSizeLimiter, FREE_LIMITS, FREE_DEFAULT, STARTER_LIMITS, STARTER_DEFAULT }