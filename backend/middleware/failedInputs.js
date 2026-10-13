// middleware/failedInputs.js
// Keeps the uploaded input of a FAILED conversion for 24 hours so the cause
// can be diagnosed (successful conversions are not touched). Requested by the
// owner on 2026-10-13: failed files used to be deleted at once, so "the file
// was damaged" could never be confirmed.
//
// How: right after multer has stored the upload, each file gets a hard link in
// failed-inputs/.pending (no extra disk space, and it survives the route's own
// unlink). When the response ends, the links are either dropped (success) or
// moved to failed-inputs/<time>-<tool>-<status>/ next to a meta.json.
//
// The folder is NOT served by express or nginx, is readable by root only, is
// swept after 24 h and is capped at MAX_TOTAL_BYTES (oldest removed first).

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DIR = path.join(__dirname, '..', 'failed-inputs')
const PENDING = path.join(DIR, '.pending')
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024
// Not conversion failures: auth, too large, rate/daily limits.
const IGNORED_STATUS = new Set([401, 403, 413, 429])
// A dropped connection only counts when the job ran this long (a timeout);
// shorter ones are just visitors closing the tab.
const ABORT_MIN_MS = 60 * 1000

function ensureDirs() {
  fs.mkdirSync(PENDING, { recursive: true, mode: 0o700 })
}

function uploadedFiles(req) {
  if (Array.isArray(req.files)) return req.files
  if (req.files && typeof req.files === 'object') return Object.values(req.files).flat()
  return req.file ? [req.file] : []
}

function track(req, res) {
  const files = uploadedFiles(req).filter((f) => f && f.path)
  if (!files.length) return
  ensureDirs()
  const held = []
  for (const f of files) {
    const link = path.join(PENDING, crypto.randomBytes(8).toString('hex') + '-' + path.basename(f.path))
    try {
      try { fs.linkSync(f.path, link) } catch (_) { fs.copyFileSync(f.path, link) }
      held.push({ link, originalname: f.originalname, size: f.size })
    } catch (_) { /* never let diagnostics break an upload */ }
  }
  if (!held.length) return

  const started = Date.now()
  let errorCode = null
  let errorMessage = null
  const origJson = res.json.bind(res)
  res.json = (body) => {
    try {
      if (body && typeof body === 'object') {
        if (typeof body.error === 'string') errorCode = body.error.slice(0, 200)
        if (typeof body.message === 'string') errorMessage = body.message.slice(0, 300)
      }
    } catch (_) {}
    return origJson(body)
  }

  let settled = false
  const settle = (aborted) => {
    if (settled) return
    settled = true
    const status = res.statusCode
    const ms = Date.now() - started
    const failed = aborted ? ms >= ABORT_MIN_MS : status >= 400 && !IGNORED_STATUS.has(status)
    try {
      if (!failed) {
        for (const h of held) try { fs.unlinkSync(h.link) } catch (_) {}
        return
      }
      const tool = String(req.path || '').replace(/^\/api\//, '').replace(/[^a-z0-9-]/gi, '_').slice(0, 40) || 'unknown'
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const dest = path.join(DIR, `${stamp}-${tool}-${aborted ? 'aborted' : status}-${crypto.randomBytes(3).toString('hex')}`)
      fs.mkdirSync(dest, { recursive: true, mode: 0o700 })
      const meta = { time: new Date().toISOString(), tool, status: aborted ? null : status, aborted, durationMs: ms, error: errorCode, message: errorMessage, files: [] }
      held.forEach((h, i) => {
        const ext = path.extname(h.originalname || '').slice(0, 10).replace(/[^.a-z0-9]/gi, '')
        const name = `input-${i + 1}${ext}`
        try {
          fs.renameSync(h.link, path.join(dest, name))
          meta.files.push({ stored: name, originalname: h.originalname, size: h.size })
        } catch (_) { try { fs.unlinkSync(h.link) } catch (_e) {} }
      })
      fs.writeFileSync(path.join(dest, 'meta.json'), JSON.stringify(meta, null, 2), { mode: 0o600 })
    } catch (_) {
      for (const h of held) try { fs.unlinkSync(h.link) } catch (_e) {}
    }
  }
  res.on('finish', () => settle(false))
  res.on('close', () => { if (!res.writableFinished) settle(true) })
}

// Patch a multer instance so every upload it handles is tracked.
function keepInputsOnFailure(upload) {
  for (const method of ['single', 'array', 'fields', 'any']) {
    if (typeof upload[method] !== 'function') continue
    const orig = upload[method].bind(upload)
    upload[method] = (...args) => {
      const mw = orig(...args)
      return (req, res, next) =>
        mw(req, res, (err) => {
          if (!err) { try { track(req, res) } catch (_) {} }
          next(err)
        })
    }
  }
  return upload
}

function dirSize(p) {
  let total = 0
  try { for (const f of fs.readdirSync(p)) { try { total += fs.statSync(path.join(p, f)).size } catch (_) {} } } catch (_) {}
  return total
}

// Delete kept inputs older than 24 h, stale pending links, and the oldest
// entries while the folder is over its size cap.
function sweepFailedInputs() {
  try {
    if (!fs.existsSync(DIR)) return
    const now = Date.now()
    let removed = 0
    if (fs.existsSync(PENDING)) {
      for (const f of fs.readdirSync(PENDING)) {
        const p = path.join(PENDING, f)
        try { if (now - fs.statSync(p).mtimeMs > 60 * 60 * 1000) fs.unlinkSync(p) } catch (_) {}
      }
    }
    const entries = []
    for (const e of fs.readdirSync(DIR)) {
      if (e === '.pending') continue
      const p = path.join(DIR, e)
      try {
        const st = fs.statSync(p)
        if (now - st.mtimeMs > MAX_AGE_MS) { fs.rmSync(p, { recursive: true, force: true }); removed++ }
        else entries.push({ p, mtime: st.mtimeMs, size: st.isDirectory() ? dirSize(p) : st.size })
      } catch (_) {}
    }
    entries.sort((a, b) => a.mtime - b.mtime)
    let total = entries.reduce((s, e) => s + e.size, 0)
    while (total > MAX_TOTAL_BYTES && entries.length) {
      const e = entries.shift()
      try { fs.rmSync(e.p, { recursive: true, force: true }); removed++ } catch (_) {}
      total -= e.size
    }
    if (removed > 0) console.log(`🧹 Failed-inputs sweep: removed ${removed} item(s)`)
  } catch (err) {
    console.error('Failed-inputs sweep error:', err.message)
  }
}

module.exports = { keepInputsOnFailure, sweepFailedInputs, FAILED_INPUTS_DIR: DIR }
