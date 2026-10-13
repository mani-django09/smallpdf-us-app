// api/v1Routes.js
// Public, versioned PDF API for developers. Authenticated by API key
// (X-API-Key header) and metered per the caller's plan quota.
//
// Unlike the website routes (which return a downloadUrl), these endpoints
// stream the resulting PDF back directly — the natural shape for an API.

const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const util = require('util')
const crypto = require('crypto')
const { execFile } = require('child_process')
const execFileP = util.promisify(execFile)
const { PDFDocument, degrees } = require('pdf-lib')
const sharp = require('sharp')
const { apiKeyAuth } = require('../middleware/apiKeyAuth')
const { virusScan } = require('../middleware/virusScan')
const { buildSpec } = require('./openapiSpec')

const TMP_DIR = path.join(__dirname, '..', 'uploads', 'api')
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => { try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch (_) {} ; cb(null, TMP_DIR) },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + path.extname(file.originalname || '.pdf')),
})
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })

const router = express.Router()

// Public OpenAPI spec — import this URL into RapidAPI / Postman / Swagger.
router.get('/openapi.json', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.json(buildSpec())
})

function cleanup(paths) {
  for (const p of paths) { try { if (p && fs.existsSync(p)) fs.unlinkSync(p) } catch (_) {} }
}

function sendPdf(res, buffer, filename) {
  res.set('Content-Type', 'application/pdf')
  res.set('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
}

// Wrap an async handler so thrown errors return JSON 500 and temp files clean up.
function isPdf(file) {
  return file && (file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf'))
}

// ── POST /v1/merge ──────────────────────────────────────────────────────────
router.post('/merge', apiKeyAuth, upload.array('files', 100), virusScan, async (req, res) => {
  const paths = (req.files || []).map((f) => f.path)
  try {
    if (!req.files || req.files.length < 2) {
      cleanup(paths)
      return res.status(400).json({ error: 'Provide at least 2 PDF files in the "files" field.', code: 'BAD_INPUT' })
    }
    const merged = await PDFDocument.create()
    for (const f of req.files) {
      if (!isPdf(f)) { cleanup(paths); return res.status(400).json({ error: `Not a PDF: ${f.originalname}`, code: 'BAD_INPUT' }) }
      const src = await PDFDocument.load(fs.readFileSync(f.path), { ignoreEncryption: true })
      const pages = await merged.copyPages(src, src.getPageIndices())
      pages.forEach((p) => merged.addPage(p))
    }
    const out = Buffer.from(await merged.save())
    cleanup(paths)
    await req.meterUsage()
    sendPdf(res, out, 'merged.pdf')
  } catch (err) {
    cleanup(paths)
    console.error('[v1/merge]', err.message)
    res.status(500).json({ error: 'Merge failed. Ensure all files are valid PDFs.', code: 'PROCESSING_ERROR' })
  }
})

// ── POST /v1/rotate ─────────────────────────────────────────────────────────
router.post('/rotate', apiKeyAuth, upload.single('file'), virusScan, async (req, res) => {
  const p = req.file?.path
  try {
    if (!isPdf(req.file)) { cleanup([p]); return res.status(400).json({ error: 'Provide a PDF in the "file" field.', code: 'BAD_INPUT' }) }
    let angle = parseInt(req.body.angle, 10)
    if (isNaN(angle)) angle = 90
    const delta = ((angle % 360) + 360) % 360
    const pdf = await PDFDocument.load(fs.readFileSync(p), { ignoreEncryption: true })
    pdf.getPages().forEach((pg) => pg.setRotation(degrees(((pg.getRotation().angle || 0) + delta) % 360)))
    const out = Buffer.from(await pdf.save())
    cleanup([p])
    await req.meterUsage()
    sendPdf(res, out, 'rotated.pdf')
  } catch (err) {
    cleanup([p])
    console.error('[v1/rotate]', err.message)
    res.status(500).json({ error: 'Rotation failed.', code: 'PROCESSING_ERROR' })
  }
})

// ── POST /v1/protect ────────────────────────────────────────────────────────
router.post('/protect', apiKeyAuth, upload.single('file'), virusScan, async (req, res) => {
  const p = req.file?.path
  const out = p ? p.replace(/\.pdf$/i, '') + '-enc.pdf' : null
  try {
    if (!isPdf(req.file)) { cleanup([p]); return res.status(400).json({ error: 'Provide a PDF in the "file" field.', code: 'BAD_INPUT' }) }
    const password = (req.body.password || '').toString()
    if (!password) { cleanup([p]); return res.status(400).json({ error: 'A "password" field is required.', code: 'BAD_INPUT' }) }
    try {
      await execFileP('qpdf', ['--encrypt', password, password, '256', '--', p, out])
    } catch (e) {
      if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw e
    }
    const buf = fs.readFileSync(out)
    cleanup([p, out])
    await req.meterUsage()
    sendPdf(res, buf, 'protected.pdf')
  } catch (err) {
    cleanup([p, out])
    console.error('[v1/protect]', err.message)
    res.status(500).json({ error: 'Could not protect the PDF.', code: 'PROCESSING_ERROR' })
  }
})

// ── POST /v1/compress ───────────────────────────────────────────────────────
router.post('/compress', apiKeyAuth, upload.single('file'), virusScan, async (req, res) => {
  const p = req.file?.path
  const out = p ? p.replace(/\.pdf$/i, '') + '-min.pdf' : null
  try {
    if (!isPdf(req.file)) { cleanup([p]); return res.status(400).json({ error: 'Provide a PDF in the "file" field.', code: 'BAD_INPUT' }) }
    try {
      await execFileP('qpdf', ['--compress-streams=y', '--object-streams=generate', '--recompress-flate', '--compression-level=9', '--linearize', p, out])
    } catch (e) {
      if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw e
    }
    // Never return a bigger file than the input.
    const inSize = fs.statSync(p).size
    const best = (fs.existsSync(out) && fs.statSync(out).size > 0 && fs.statSync(out).size < inSize) ? out : p
    const buf = fs.readFileSync(best)
    cleanup([p, out])
    await req.meterUsage()
    sendPdf(res, buf, 'compressed.pdf')
  } catch (err) {
    cleanup([p, out])
    console.error('[v1/compress]', err.message)
    res.status(500).json({ error: 'Compression failed.', code: 'PROCESSING_ERROR' })
  }
})

// ── Shared helpers for the conversion endpoints ─────────────────────────────
const archiver = require('archiver')

function getGhostscriptPath() {
  const c = ['/usr/bin/gs', '/usr/local/bin/gs', '/opt/homebrew/bin/gs',
    'C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe']
  for (const p of c) { try { if (fs.existsSync(p)) return p } catch (_) {} }
  return 'gs'
}
function getLibreOfficePath() {
  const c = ['/usr/bin/soffice', '/usr/bin/libreoffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe']
  for (const p of c) { try { if (fs.existsSync(p)) return p } catch (_) {} }
  return 'soffice'
}
function makeWork() {
  const d = path.join(TMP_DIR, Date.now() + '-' + crypto.randomBytes(6).toString('hex'))
  fs.mkdirSync(d, { recursive: true })
  return d
}
function rmrf(d) { try { fs.rmSync(d, { recursive: true, force: true }) } catch (_) {} }

function sendZip(res, dir, files, zipName) {
  res.set('Content-Type', 'application/zip')
  res.set('Content-Disposition', `attachment; filename="${zipName}"`)
  const arch = archiver('zip', { zlib: { level: 9 } })
  arch.on('error', () => { try { res.end() } catch (_) {} })
  arch.pipe(res)
  for (const f of files) arch.file(path.join(dir, f), { name: f })
  arch.finalize()
}

// "1,3,5-7" → [1,3,5,6,7] (1-based, clamped to 1..total)
function parsePages(str, total) {
  const out = new Set()
  for (const part of String(str).split(',')) {
    const s = part.trim(); if (!s) continue
    const m = s.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) { let a = +m[1], b = +m[2]; if (a > b) [a, b] = [b, a]; for (let i = a; i <= b; i++) if (i >= 1 && i <= total) out.add(i) }
    else if (/^\d+$/.test(s)) { const n = +s; if (n >= 1 && n <= total) out.add(n) }
  }
  return [...out].sort((a, b) => a - b)
}

// Run a LibreOffice headless conversion with a per-request profile (avoids
// lock conflicts under concurrency). Output lands in outDir as <base>.<target>.
async function runLO(input, target, outDir) {
  const profile = 'file://' + path.join(outDir, 'lo_profile')
  await execFileP(getLibreOfficePath(),
    ['--headless', `-env:UserInstallation=${profile}`, '--convert-to', target, '--outdir', outDir, input],
    { timeout: 180000, maxBuffer: 100 * 1024 * 1024 })
}

// ── POST /v1/split ──────────────────────────────────────────────────────────
// No "pages" field → ZIP with one PDF per page. With "pages" (e.g. 1,3,5-7) →
// a single PDF containing just those pages.
router.post('/split', apiKeyAuth, upload.single('file'), virusScan, async (req, res) => {
  const p = req.file?.path
  const work = makeWork()
  try {
    if (!isPdf(req.file)) { cleanup([p]); rmrf(work); return res.status(400).json({ error: 'Provide a PDF in the "file" field.', code: 'BAD_INPUT' }) }
    const src = await PDFDocument.load(fs.readFileSync(p), { ignoreEncryption: true })
    const total = src.getPageCount()

    // RapidAPI/clients sometimes send optional fields as the literal string
    // "undefined"/"null" — treat those (and blanks) as "not provided".
    const pagesRaw = req.body.pages
    const pagesParam = pagesRaw && !['undefined', 'null', ''].includes(String(pagesRaw).trim()) ? pagesRaw : null
    if (pagesParam) {
      const subset = parsePages(pagesParam, total)
      if (!subset.length) { cleanup([p]); rmrf(work); return res.status(400).json({ error: 'No valid pages in "pages" range.', code: 'BAD_INPUT' }) }
      const out = await PDFDocument.create()
      const copied = await out.copyPages(src, subset.map((n) => n - 1))
      copied.forEach((pg) => out.addPage(pg))
      const buf = Buffer.from(await out.save())
      cleanup([p]); rmrf(work)
      await req.meterUsage()
      return sendPdf(res, buf, 'split.pdf')
    }

    const names = []
    for (let i = 0; i < total; i++) {
      const out = await PDFDocument.create()
      const [pg] = await out.copyPages(src, [i]); out.addPage(pg)
      const name = `page-${i + 1}.pdf`
      fs.writeFileSync(path.join(work, name), await out.save()); names.push(name)
    }
    cleanup([p])
    await req.meterUsage()
    res.on('close', () => rmrf(work))
    sendZip(res, work, names, 'split-pages.zip')
  } catch (err) {
    cleanup([p]); rmrf(work)
    console.error('[v1/split]', err.message)
    res.status(500).json({ error: 'Split failed.', code: 'PROCESSING_ERROR' })
  }
})

// ── POST /v1/jpg-to-pdf  &  /v1/png-to-pdf ──────────────────────────────────
// Both accept multiple images in "files" and produce one PDF (one image/page).
async function imagesToPdf(req, res) {
  const paths = (req.files || []).map((f) => f.path)
  try {
    if (!req.files || !req.files.length) { cleanup(paths); return res.status(400).json({ error: 'Provide image(s) in the "files" field.', code: 'BAD_INPUT' }) }
    const pdf = await PDFDocument.create()
    for (const f of req.files) {
      // Normalise via sharp → PNG (handles any JPG/PNG/WebP reliably; avoids
      // pdf-lib's strict JPEG parser). Then embed.
      let pngBuf
      try { pngBuf = await sharp(f.path).png().toBuffer() }
      catch (_) { cleanup(paths); return res.status(400).json({ error: `Unsupported or corrupt image: ${f.originalname}`, code: 'BAD_INPUT' }) }
      const img = await pdf.embedPng(pngBuf)
      const page = pdf.addPage([img.width, img.height])
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    }
    const buf = Buffer.from(await pdf.save())
    cleanup(paths)
    await req.meterUsage()
    sendPdf(res, buf, 'images.pdf')
  } catch (err) {
    cleanup(paths)
    console.error('[v1/img2pdf]', err.message)
    res.status(500).json({ error: 'Conversion failed.', code: 'PROCESSING_ERROR' })
  }
}
router.post('/jpg-to-pdf', apiKeyAuth, upload.array('files', 100), virusScan, imagesToPdf)
router.post('/png-to-pdf', apiKeyAuth, upload.array('files', 100), virusScan, imagesToPdf)

// ── POST /v1/pdf-to-jpg  &  /v1/pdf-to-png ──────────────────────────────────
// Renders each page to an image via Ghostscript, returns a ZIP. Optional
// "quality" = standard (150 dpi) | high (300) | maximum (600).
function pdfToImages(device, ext) {
  return async (req, res) => {
    const p = req.file?.path
    const work = makeWork()
    try {
      if (!isPdf(req.file)) { cleanup([p]); rmrf(work); return res.status(400).json({ error: 'Provide a PDF in the "file" field.', code: 'BAD_INPUT' }) }
      let dpi = 150
      if (req.body.quality === 'high') dpi = 300
      if (req.body.quality === 'maximum') dpi = 600
      const pattern = path.join(work, `page-%d.${ext}`)
      const args = ['-dNOPAUSE', '-dBATCH', '-dSAFER', `-sDEVICE=${device}`,
        ...(device === 'jpeg' ? ['-dJPEGQ=95'] : []), `-r${dpi}`, `-sOutputFile=${pattern}`, p]
      await execFileP(getGhostscriptPath(), args, { timeout: 180000, maxBuffer: 100 * 1024 * 1024 })
      const names = fs.readdirSync(work)
        .filter((f) => f.endsWith('.' + ext))
        .sort((a, b) => (parseInt(a.match(/-(\d+)\./)?.[1] || '0') - parseInt(b.match(/-(\d+)\./)?.[1] || '0')))
      if (!names.length) throw new Error('no output produced')
      cleanup([p])
      await req.meterUsage()
      res.on('close', () => rmrf(work))
      sendZip(res, work, names, `pdf-to-${ext}.zip`)
    } catch (err) {
      cleanup([p]); rmrf(work)
      console.error('[v1/pdf2img]', err.message)
      res.status(500).json({ error: 'Conversion failed.', code: 'PROCESSING_ERROR' })
    }
  }
}
router.post('/pdf-to-jpg', apiKeyAuth, upload.single('file'), virusScan, pdfToImages('jpeg', 'jpg'))
router.post('/pdf-to-png', apiKeyAuth, upload.single('file'), virusScan, pdfToImages('png16m', 'png'))

// ── POST /v1/word-to-pdf ────────────────────────────────────────────────────
router.post('/word-to-pdf', apiKeyAuth, upload.single('file'), virusScan, async (req, res) => {
  const p = req.file?.path
  const work = makeWork()
  try {
    const ext = (path.extname(req.file?.originalname || '') || '').toLowerCase()
    if (!['.doc', '.docx', '.odt', '.rtf'].includes(ext)) { cleanup([p]); rmrf(work); return res.status(400).json({ error: 'Provide a Word document (.doc, .docx, .odt, .rtf) in "file".', code: 'BAD_INPUT' }) }
    await runLO(p, 'pdf', work)
    const out = fs.readdirSync(work).find((f) => f.toLowerCase().endsWith('.pdf'))
    if (!out) throw new Error('no output')
    const buf = fs.readFileSync(path.join(work, out))
    cleanup([p]); rmrf(work)
    await req.meterUsage()
    sendPdf(res, buf, 'converted.pdf')
  } catch (err) {
    cleanup([p]); rmrf(work)
    console.error('[v1/word2pdf]', err.message)
    res.status(500).json({ error: 'Conversion failed. Ensure the file is a valid Word document.', code: 'PROCESSING_ERROR' })
  }
})

// ── POST /v1/pdf-to-word ────────────────────────────────────────────────────
// Primary: Python pdf2docx (best layout). Fallback: LibreOffice. Mirrors the
// website route — LO alone is unreliable for PDF→DOCX.
router.post('/pdf-to-word', apiKeyAuth, upload.single('file'), virusScan, async (req, res) => {
  const p = req.file?.path
  const work = makeWork()
  const outDocx = path.join(work, 'out.docx')
  try {
    if (!isPdf(req.file)) { cleanup([p]); rmrf(work); return res.status(400).json({ error: 'Provide a PDF in the "file" field.', code: 'BAD_INPUT' }) }

    const SCRIPT = path.join(__dirname, '..', 'pdf_to_word_converter.py')
    const PYBIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
    let ok = false

    if (fs.existsSync(SCRIPT)) {
      try {
        await execFileP(PYBIN, [SCRIPT, p, outDocx], { timeout: 300000, maxBuffer: 100 * 1024 * 1024 })
        if (fs.existsSync(outDocx) && fs.statSync(outDocx).size > 1000) ok = true
      } catch (e) { console.warn('[v1/pdf2word] python failed:', e.message) }
    }

    if (!ok) {
      // LibreOffice fallback — output named after the input's temp basename.
      await runLO(p, 'docx', work)
      const f = fs.readdirSync(work).find((x) => x.toLowerCase().endsWith('.docx'))
      if (f) {
        const fp = path.join(work, f)
        if (fp !== outDocx) fs.renameSync(fp, outDocx)
        ok = fs.existsSync(outDocx) && fs.statSync(outDocx).size > 0
      }
    }

    if (!ok) throw new Error('conversion produced no output')
    const buf = fs.readFileSync(outDocx)
    cleanup([p]); rmrf(work)
    await req.meterUsage()
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.set('Content-Disposition', 'attachment; filename="converted.docx"')
    res.send(buf)
  } catch (err) {
    cleanup([p]); rmrf(work)
    console.error('[v1/pdf2word]', err.message)
    res.status(500).json({ error: 'Conversion failed.', code: 'PROCESSING_ERROR' })
  }
})

module.exports = { router }
