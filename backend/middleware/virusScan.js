// middleware/virusScan.js
// Lightweight malware gate using the VirusTotal v3 API.
//
// Strategy: hash-only lookup. We never UPLOAD user files to VirusTotal — we
// compute the SHA-256 locally and ask VT whether that hash is already known to
// be malicious (GET /api/v3/files/{sha256}). This is:
//   • Private  — the file content never leaves our server.
//   • Fast     — a single small GET, no upload/poll cycle.
//   • Free-tier friendly — fits the 4 requests/min public-API budget.
//
// If VIRUSTOTAL_API_KEY is not configured the middleware is a no-op, so the app
// keeps working in dev / before the key is added. A network/API error also
// fails OPEN (allows the file) — we don't want VT downtime to break uploads;
// the existing fileValidation() already blocks executables by signature.
//
// Usage (after multer + fileValidation):
//   app.post('/api/merge-pdf', upload.array('files'), fileValidation, virusScan, handler)

const fs = require('fs')
const crypto = require('crypto')

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY || ''
const VT_LOOKUP_URL = 'https://www.virustotal.com/api/v3/files/'
// How many engines must flag a file before we reject it. >0 means "any engine".
const MALICIOUS_THRESHOLD = Number(process.env.VIRUSTOTAL_THRESHOLD || 1)

function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

// Returns { malicious: boolean, stats } or null when the hash is unknown to VT.
async function lookupHash(sha256) {
  if (typeof fetch !== 'function') {
    console.warn('[virusScan] global fetch unavailable (Node < 18) — skipping')
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const resp = await fetch(VT_LOOKUP_URL + sha256, {
      headers: { 'x-apikey': VT_API_KEY },
      signal: controller.signal,
    })

    // 404 = VT has never seen this file → not known-bad, allow it.
    if (resp.status === 404) return null
    if (!resp.ok) {
      console.warn(`[virusScan] VT lookup HTTP ${resp.status} — failing open`)
      return null
    }

    const json = await resp.json()
    const stats = json?.data?.attributes?.last_analysis_stats || {}
    const malicious = (stats.malicious || 0) >= MALICIOUS_THRESHOLD
    return { malicious, stats }
  } catch (err) {
    console.warn('[virusScan] VT lookup failed — failing open:', err.message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function deleteQuietly(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (_) { /* ignore */ }
}

async function virusScan(req, res, next) {
  // No key configured → feature disabled, behave transparently.
  if (!VT_API_KEY) return next()

  const files = req.files || (req.file ? [req.file] : [])
  if (files.length === 0) return next()

  try {
    for (const file of files) {
      if (!file?.path) continue
      const sha256 = await sha256OfFile(file.path)
      const result = await lookupHash(sha256)

      if (result && result.malicious) {
        // Purge every uploaded file in this request — don't keep anything
        // from a request that contained malware.
        for (const f of files) deleteQuietly(f.path)

        console.warn(`[virusScan] BLOCKED ${file.originalname} sha256=${sha256} stats=${JSON.stringify(result.stats)}`)
        return res.status(422).json({
          success: false,
          error: 'This file was flagged as malicious by our security scan and cannot be processed.',
          code: 'MALWARE_DETECTED',
        })
      }
    }
    return next()
  } catch (err) {
    // Never block legitimate users on an internal scan error — fail open.
    console.error('[virusScan] unexpected error — failing open:', err.message)
    return next()
  }
}

module.exports = { virusScan, sha256OfFile }
