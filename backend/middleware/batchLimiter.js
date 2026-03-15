// middleware/batchLimiter.js
// Server-side batch-file-count safety net.
// The PRIMARY enforcement is client-side (useBatchGuard hook).
// This runs as a backup in case the client check was bypassed.
//
// Place AFTER upload.array(), BEFORE fileValidation:
//   app.post('/api/merge-pdf', upload.array('files', 500), batchLimiter('merge-pdf'), fileValidation, ...)

const jwt = require('jsonwebtoken')
const fs  = require('fs')

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production'

// Limits per plan: free | starter | pro | agency(ent)
// Matches pricing page: Starter=10, Pro=20, Agency=50 files per batch
const BATCH_LIMITS = {
  'ocr-pdf':        { free: 1,  starter: 10, pro: 20, ent: 50 },
  'merge-pdf':      { free: 2,  starter: 10, pro: 20, ent: 50 },
  'split-pdf':      { free: 1,  starter: 10, pro: 20, ent: 50 },
  'compress-pdf':   { free: 2,  starter: 10, pro: 20, ent: 50 },
  'word-to-pdf':    { free: 1,  starter: 10, pro: 20, ent: 50 },
  'ppt-to-pdf':     { free: 1,  starter: 10, pro: 20, ent: 50 },
  'excel-to-pdf':   { free: 1,  starter: 10, pro: 20, ent: 50 },
  'pdf-to-word':    { free: 1,  starter: 10, pro: 20, ent: 50 },
  'pdf-to-ppt':     { free: 1,  starter: 10, pro: 20, ent: 50 },
  'pdf-to-excel':   { free: 1,  starter: 10, pro: 20, ent: 50 },
  'pdf-to-jpg':     { free: 2,  starter: 10, pro: 20, ent: 50 },
  'jpg-to-pdf':     { free: 2,  starter: 10, pro: 20, ent: 50 },
  'png-to-pdf':     { free: 5,  starter: 10, pro: 20, ent: 50 },
  'compress-image': { free: 2,  starter: 10, pro: 20, ent: 50 },
  'webp-to-png':    { free: 2,  starter: 10, pro: 20, ent: 50 },
  'png-to-webp':    { free: 2,  starter: 10, pro: 20, ent: 50 },
}

function getUserFromRequest(req) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return null
    return jwt.verify(header.replace('Bearer ', '').trim(), JWT_SECRET)
  } catch { return null }
}

function cleanupFiles(req) {
  const files = Array.isArray(req.files) ? req.files
              : req.files ? Object.values(req.files).flat()
              : req.file  ? [req.file]
              : []
  for (const f of files) {
    try { if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path) } catch (_) {}
  }
}

function batchLimiter(toolName) {
  const limits = BATCH_LIMITS[toolName]
  if (!limits) return (_req, _res, next) => next()

  return (req, res, next) => {
    const files = Array.isArray(req.files) ? req.files
                : req.files ? Object.values(req.files).flat()
                : req.file  ? [req.file]
                : []

    const fileCount = files.length
    if (fileCount === 0) return next()

    const user    = getUserFromRequest(req)
    const isGuest = !user

    const allowedCount =
      (user?.plan === 'agency' || user?.plan === 'enterprise') ? limits.ent :
      user?.plan === 'pro'     ? limits.pro :
      user?.plan === 'starter' ? limits.starter :
      limits.free

    if (fileCount <= allowedCount) return next()

    // Over limit — clean up uploaded files and reject
    cleanupFiles(req)

    return res.status(429).json({
      error:        'BATCH_LIMIT_EXCEEDED',
      tool:         toolName,
      fileCount,
      allowedCount,
      isGuest,
      upgradeUrl:   '/pricing',
      loginUrl:     '/auth/login',
      message: isGuest
        ? `Free (guest) limit for ${toolName} is ${allowedCount} file(s) per batch. You sent ${fileCount}.`
        : `Your plan allows ${allowedCount} file(s) per batch for ${toolName}. You sent ${fileCount}.`,
    })
  }
}

module.exports = { batchLimiter, BATCH_LIMITS }