// server.js - Express Backend with Admin Panel, Activity Tracking & File Validation

// ── DOMMatrix polyfill — required by pdf-parse in Node.js environments ────────
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() { this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0; }
  }
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(w, h) { this.width=w; this.height=h; this.data=new Uint8ClampedArray(w*h*4); }
  }
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {}
}

  require('dotenv').config()
  const express = require("express")
  const multer = require("multer")
  const cors = require("cors")
  const path = require("path")
  const fs = require("fs")
  const { exec } = require("child_process")
  const util = require("util")
  const execPromise = util.promisify(exec)
  const archiver = require("archiver")
  const PDFDocument = require("pdfkit")
  const { PDFDocument: PDFLibDocument } = require("pdf-lib")
  const _imageSize = require("image-size")
  const sizeOf = typeof _imageSize === "function" ? _imageSize : (_imageSize.imageSize || _imageSize.default)
  const sharp = require("sharp")
  const heicConvert = require("heic-convert")
  const { Document, Packer, Paragraph, TextRun } = require("docx")
  const crypto = require("crypto")
  const { 
    db, 
    dbRun, 
    dbGet, 
    dbAll, 
    logActivityToDB,
    getActivityLogsFromDB,
    getStatsFromDB,
    cleanupOldAnalyticsData
  } = require('./database')
  const { router: authRouter } = require('./auth/authRoutes')
  const { batchLimiter } = require('./middleware/batchLimiter')
  const { fileSizeLimiter } = require('./middleware/fileSizeLimiter')
  const { virusScan } = require('./middleware/virusScan')
  const { optionalAuth } = require('./middleware/optionalAuth')
  const {
    router: myFilesRouter,
    initMyFilesTable,
    recordUserFile,
    startFileRetentionSweep,
  } = require('./myFiles')
  const { router: apiKeysRouter, initApiTables } = require('./api/apiKeys')
  const { router: apiV1Router } = require('./api/v1Routes')
  const {
    SQLiteRateStore,
    ocrCheckDaily,
    ocrIncrementDaily,
    cleanupExpiredRateLimits,
    dailyConversionLimiter,
  } = require('./middleware/sqliteRateStore')
  const { router: paymentRouter, webhookHandler, sendAbandonedCheckoutReminders, sendFreeUserNurtureReminders } = require('./payments/paymentRoutes')
  const { router: paypalRouter, paypalWebhookHandler } = require('./payments/paypalRoutes')
  const { router: lsRouter, webhookHandler: lsWebhookHandler } = require('./payments/lemonSqueezyRoutes')
  const { router: appProRouter } = require('./payments/appProRoutes')
  const helmet = require('helmet')
  const rateLimit = require('express-rate-limit')
  // Normalise the client IP for rate-limit keying.
  // Collapses IPv6 to a /64 prefix so limits can't be bypassed by rotating
  // addresses within the same /64 block.
  function rateLimitKey(req) {
    const ip = req.clientIP || req.ip || "unknown"
    if (!ip.includes(':')) return ip           // plain IPv4
    // IPv6 → keep first 4 groups (= /64 prefix)
    const groups = ip.split(':')
    return groups.slice(0, 4).join(':')
  }

  const app = express()
  const PORT = process.env.PORT || 5011

  // Behind Cloudflare / reverse proxy — trust the first proxy hop so req.ip is correct
  app.set('trust proxy', 1)

  // Unguessable job IDs — prevents enumeration/IDOR of other users' converted files.
  // Format: <timestamp>-<random hex>. Download endpoints look up by this exact string,
  // so generation can change freely without touching any lookup code.
  function genJobId() {
    return Date.now().toString() + "-" + crypto.randomBytes(9).toString("hex")
  }

  // Reject job IDs that could escape the storage directory (path traversal) or are malformed.
  function isSafeJobId(jobId) {
    return typeof jobId === "string" && /^[A-Za-z0-9._-]+$/.test(jobId) && !jobId.includes("..")
  }

  // Admin credentials (CHANGE THESE IN PRODUCTION!)
  // No built-in fallback credentials: a default password in the source code works
  // for anyone who has seen the code whenever .env is missing. Without both
  // variables the admin login is simply disabled.
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || ""
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""


  // Middleware
  app.use(cors({
  // localhost origins only on the (Windows) dev machine or when explicitly enabled
  // — both .env files say NODE_ENV=production. On the live server, credentials:true
  // + a localhost origin let any page on a visitor's localhost call the live API.
  origin: (process.platform === 'win32' || process.env.ALLOW_LOCALHOST_ORIGINS === '1')
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3006', 'http://localhost:3002', 'https://smallpdf.us', 'https://www.smallpdf.us']
    : ['https://smallpdf.us', 'https://www.smallpdf.us'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
  // ⚠️ Razorpay webhook MUST be before express.json() — needs raw body
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), webhookHandler)
  // ⚠️ PayPal webhook MUST be before express.json() — needs raw body for signature verification
  app.use('/api/paypal/webhook', express.raw({ type: 'application/json' }), paypalWebhookHandler)
  // ⚠️ Lemon Squeezy webhook MUST be before express.json() — needs raw body for HMAC verification
  app.use('/api/lemonsqueezy/webhook', express.raw({ type: 'application/json' }), lsWebhookHandler)

  app.use(express.json())
  app.use("/uploads", express.static("uploads"))

  // The routers below are mounted BEFORE the global `/api/` limiter further
  // down, so their requests never reached it: login/signup/password-reset had
  // no rate limit at all (unlimited password guessing, and reset/verification
  // emails could be fired in bulk — burning the SMTP daily quota that real
  // welcome/payment emails depend on). req.clientIP isn't set yet at this
  // point, so resolve it here for the key.
  const authKey = (req) => { req.clientIP = req.clientIP || getClientIP(req); return rateLimitKey(req) }
  const authAttemptLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
    keyGenerator: authKey, store: new SQLiteRateStore("auth-attempt"),
    message: { error: "Too many attempts. Please wait 15 minutes and try again." },
  })
  const authEmailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
    keyGenerator: authKey, store: new SQLiteRateStore("auth-email"),
    message: { error: "Too many requests. Please try again in an hour." },
  })
  app.use(["/api/auth/login", "/api/auth/google"], authAttemptLimiter)
  app.use(["/api/auth/signup", "/api/auth/forgot-password", "/api/auth/resend-verification"], authEmailLimiter)

  app.use('/api/auth', authRouter)
  app.use('/api/payments', paymentRouter)
  app.use('/api/paypal', paypalRouter)
  app.use('/api/lemonsqueezy', lsRouter)
  app.use('/api/my-files', myFilesRouter)

  // SnapPDF Android app: exchange an active Play subscription (RevenueCat) for a Pro JWT.
  const appProLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
    keyGenerator: authKey, store: new SQLiteRateStore("app-pro"),
    message: { error: "Too many requests. Please try again later." },
  })
  app.use('/api/app', appProLimiter, express.json({ limit: '4kb' }), appProRouter)

  // "My Files" history: ensure the table exists and start the retention sweep
  // (free = 1h, paid = 24h). Sweep also unrefs so it never blocks shutdown.
  initMyFilesTable().then(() => startFileRetentionSweep())

  // Developer API: key management (JWT dashboard) + versioned public endpoints
  // (X-API-Key auth, metered per plan quota).
  app.use('/api/keys', apiKeysRouter)
  app.use('/api/v1', apiV1Router)
  initApiTables()
// IP DETECTION MIDDLEWARE
// ============================================
function getClientIP(req) {
  // SECURITY: client-supplied headers (CF-Connecting-IP, X-Forwarded-For, …) were
  // trusted from anyone. A request sent straight to the origin (server IP, not
  // through Cloudflare) could set any IP per request and so bypass every
  // IP-based limit — admin-login brute-force protection, daily conversion quota,
  // rate limits. Only nginx on loopback is trusted: it validates CF-Connecting-IP
  // against Cloudflare's ranges (real_ip module) and passes the result as X-Real-IP.
  const peer = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '')
  const viaLocalProxy = peer === '127.0.0.1' || peer === '::1'
  let ip = (viaLocalProxy && req.headers['x-real-ip']) || peer || 'unknown'

  // Clean up IPv6 localhost
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1'

  // Remove IPv6-mapped IPv4 prefix  e.g. ::ffff:1.2.3.4 → 1.2.3.4
  if (ip.startsWith('::ffff:')) ip = ip.substring(7)

  ip = ip.trim()

  // Validate IPv4 — each octet must be 0-255
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = ip.match(ipv4Regex)
  if (match) {
    const valid = [match[1], match[2], match[3], match[4]].every(n => parseInt(n) <= 255)
    if (!valid) return 'unknown'
  }

  return ip
}

// Attach client IP to every request
app.use((req, res, next) => {
  req.clientIP = getClientIP(req)
  next()
})

// Security headers. CSP disabled because the API serves cross-origin file downloads
// and a static admin HTML page; the rest of helmet's defaults are safe here.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }))

// Global rate limiter for the API — blocks spam/abuse of the conversion endpoints
// without affecting normal usage. Keyed on the real client IP (set above).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                 // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  // Admin dashboard calls are JWT-protected (login has its own limiter); don't let them eat the shared quota
  skip: (req) => {
    const u = req.originalUrl
    return (u.startsWith("/api/admin/") && !u.startsWith("/api/admin/login")) || u.startsWith("/api/blog/admin/")
  },
  store: new SQLiteRateStore("api"), // persist across restarts / instances
  message: { error: "Too many requests. Please slow down and try again in a few minutes." },
})
app.use("/api/", apiLimiter)

// Validate any :jobId route param once, globally — guards every download endpoint
// against path traversal and malformed IDs.
app.param("jobId", (req, res, next, jobId) => {
  if (!isSafeJobId(jobId)) {
    return res.status(400).json({ error: "Invalid job ID" })
  }
  next()
})

// Email capture — "notify me about new tools" opt-in on download pages.
// No email service wired up; just stores to email_subscribers for later use/export.
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                   // per IP per window — this is a low-value form, not a login
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  store: new SQLiteRateStore("subscribe"),
  message: { error: "Too many attempts. Please try again later." },
})
app.post("/api/subscribe", subscribeLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase()
    const sourcePage = String(req.body?.source || "").slice(0, 200)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" })
    }
    await dbRun(
      "INSERT OR IGNORE INTO email_subscribers (email, source_page) VALUES (?, ?)",
      [email, sourcePage || null]
    )
    res.json({ success: true })
  } catch (error) {
    console.error("Subscribe error:", error.message)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

  // Upload filenames end up inside shell commands (soffice / gs / qpdf / python,
  // all run through exec with "..." quoting) and in output paths derived from
  // file.originalname. Inside double quotes the shell still expands $(...),
  // backticks and \, and a " ends the argument — so an unsanitized name like
  // `a$(cmd).pdf` executed commands on the server. Normalise the name ONCE here,
  // at upload time, and write it back onto file.originalname so every route
  // (and every path built from it) only ever sees safe characters.
  // Also repairs multer's latin1 decoding of UTF-8 names ("Ã­" → "í"), which made
  // LibreOffice's output name differ from the one we looked for.
  function safeUploadName(name) {
    let n = String(name || '')
    try {
      const utf8 = Buffer.from(n, 'latin1').toString('utf8')
      if (!utf8.includes('�')) n = utf8
    } catch (_) {}
    n = path.basename(n.normalize('NFC'))
    const ext = path.extname(n).replace(/[^A-Za-z0-9.]/g, '').slice(0, 10)
    let base = n.slice(0, n.length - path.extname(n).length)
      .replace(/[^\p{L}\p{M}\p{N} _.()+,@-]/gu, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^[\s.\-_]+|[\s.]+$/g, '')
      .slice(0, 120)
    // Cap by BYTES too: Linux allows 255 bytes per file name, and routes prepend
    // "<timestamp>-compressed-" etc. 120 Japanese characters = 360 bytes, which
    // failed with ENAMETOOLONG.
    while (Buffer.byteLength(base, 'utf8') > 150) base = Array.from(base).slice(0, -1).join('')
    if (!base) base = 'file'
    return base + ext
  }

  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = "./uploads"
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      file.originalname = safeUploadName(file.originalname)
      // Random part: files in uploads/ are served publicly by nginx, and "<ms>-<name>"
      // (also reused for pdf-to-jpg output names) could be guessed.
      cb(null, Date.now() + "-" + require("crypto").randomBytes(6).toString("hex") + "-" + file.originalname)
    },
  })

  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
  })
  // Keep the input of FAILED conversions for 24 h (diagnosis) — see middleware/failedInputs.js
  const { keepInputsOnFailure, sweepFailedInputs } = require("./middleware/failedInputs")
  keepInputsOnFailure(upload)

  // Multer configuration for blog images
  const blogImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = "./uploads/blog"
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      file.originalname = safeUploadName(file.originalname)
      cb(null, uniqueSuffix + "-" + file.originalname)
    },
  })

  const blogImageUpload = multer({
    storage: blogImageStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."))
      }
    },
  })
  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  // Activity logging
  async function logActivity(data) {
    await logActivityToDB(data);
  }

  // Password hashing
  function hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex")
  }
  // Generate slug from title
  function generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  // Manage blog tags
  async function manageTags(tags) {
    const tagIds = []
    
    for (const tagName of tags) {
      let tag = await dbGet('SELECT id FROM blog_tags WHERE name = ?', [tagName.toLowerCase()])
      
      if (!tag) {
        const result = await dbRun('INSERT INTO blog_tags (name) VALUES (?)', [tagName.toLowerCase()])
        tagIds.push(result.id)
      } else {
        tagIds.push(tag.id)
      }
    }
    
    return tagIds
  }

  // Get post with tags
  async function getPostWithTags(post) {
    const tags = await dbAll(`
      SELECT bt.name
      FROM blog_tags bt
      JOIN post_tags pt ON bt.id = pt.tag_id
      WHERE pt.post_id = ?
    `, [post.id])

    return {
      ...post,
      // Map snake_case DB fields → camelCase for frontend
      createdAt:    post.created_at    ?? post.createdAt    ?? null,
      updatedAt:    post.updated_at    ?? post.updatedAt    ?? null,
      featuredImage: post.featured_image ?? post.featuredImage ?? null,
      tags: tags.map(t => t.name),
    }
  }
  // File validation middleware

// REPLACE your existing fileValidation function with this one

const fileValidation = (req, res, next) => {
  if (!req.files && !req.file) {
    return next()
  }

  const files = req.files || [req.file]
  const validationErrors = []

  for (const file of files) {
    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      validationErrors.push({
        file: file.originalname,
        error: "File size exceeds 100MB limit",
      })
      continue
    }

    // Check file extension - UPDATED WITH EXCEL FORMATS
    const ext = path.extname(file.originalname).toLowerCase()
    const allowedExtensions = [
      // .jfif/.jpe are plain JPEGs (Windows names images saved from a browser
      // ".jfif") — ~45 compress-image uploads a fortnight were rejected here.
      ".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".jfif", ".jpe", ".webp",
      ".heic", ".heif",
      ".xlsx", ".xls", ".ods", ".csv",
      ".pptx", ".ppt", ".odp"

    ]

    if (!allowedExtensions.includes(ext)) {
      validationErrors.push({
        file: file.originalname,
        error: `Invalid file type: ${ext}`,
      })
      continue
    }

    // Check MIME type - UPDATED WITH EXCEL FORMATS
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/heic-sequence",
      "image/heif-sequence",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.oasis.opendocument.spreadsheet",
      "text/csv",
      "application/csv",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.oasis.opendocument.presentation"

    ]

    // Some browsers/OSes send an empty or generic MIME type for HEIC/HEIF.
    // Trust the extension in that case since it already passed the allow-list above.
    const isHeicByExt = ext === ".heic" || ext === ".heif"
    const genericMime = !file.mimetype || file.mimetype === "application/octet-stream"
    // Same for office files: devices without Office installed send no MIME type
    // (→ application/octet-stream) for .docx/.xlsx/..., and CSV often arrives as
    // text/plain. The executable-signature check below still applies.
    // (.pdf too: Android pickers / Windows without a PDF app send no MIME type.)
    // (Images too: some browsers/OSes send an empty type for .jpg/.png — the
    // jpg-to-pdf preview then failed with "File validation failed".)
    const isOfficeByExt = [".jpg", ".jpeg", ".jfif", ".jpe", ".png", ".webp", ".pdf", ".csv", ".ods", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odp"].includes(ext)
    const sheetMimeOk = isOfficeByExt && (genericMime || (ext === ".csv" && file.mimetype === "text/plain"))
    if (!allowedMimeTypes.includes(file.mimetype) && !(isHeicByExt && genericMime) && !sheetMimeOk) {
      validationErrors.push({
        file: file.originalname,
        error: `Invalid MIME type: ${file.mimetype}`,
      })
      continue
    }

    // Check for executable signatures (basic malware detection)
    try {
      const fileBuffer = fs.readFileSync(file.path)
      const header = fileBuffer.slice(0, 4).toString("hex")

      // Check for executable signatures
      const executableSignatures = [
        "4d5a9000", // EXE
        "7f454c46", // ELF
        "cafebabe", // Mach-O
        "feedface", // Mach-O
      ]

      if (executableSignatures.some((sig) => header.startsWith(sig))) {
        validationErrors.push({
          file: file.originalname,
          error: "Executable file detected - blocked for security",
        })

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
        continue
      }

      // Verify file header matches extension - UPDATED WITH EXCEL FORMATS
      const fileSignatures = {
        pdf: ["25504446"], // %PDF
        png: ["89504e47"], // PNG signature
        jpg: [
          "ffd8ffe0", "ffd8ffe1", "ffd8ffe2", "ffd8ffe3",
          "ffd8ffe8", "ffd8ffdb", "ffd8ffed",
        ],
        jpeg: [
          "ffd8ffe0", "ffd8ffe1", "ffd8ffe2", "ffd8ffe3",
          "ffd8ffe8", "ffd8ffdb", "ffd8ffed",
        ],
        webp: ["52494646"], // RIFF (WEBP)
        xlsx: ["504b0304"], // ZIP-based (XLSX files are ZIP archives)
        xls: ["d0cf11e0"],  // OLE compound document (older Excel)
        ods: ["504b0304"],  // ZIP-based (ODS files are ZIP archives)
        docx: ["504b0304"], // ZIP-based
        doc: ["d0cf11e0"],  // OLE compound document
        pptx: ["504b0304"],
        odp: ["504b0304"]

      }

      const detectedType = Object.keys(fileSignatures).find((type) =>
        fileSignatures[type].some((sig) => header.startsWith(sig))
      )

      // Allow .jpg/.jpeg interchangeably, skip validation for complex formats
      if (detectedType) {
        const isJpegFile = ext === ".jpg" || ext === ".jpeg" || ext === ".jfif" || ext === ".jpe"
        const isJpegDetected = detectedType === "jpg" || detectedType === "jpeg"
        const isWebpFile = ext === ".webp"
        const isCsvFile = ext === ".csv"
        const isZipBased = ext === ".xlsx" || ext === ".ods" || ext === ".docx"
        const isOleBased = ext === ".xls" || ext === ".doc"
        
        // Allow JPEG variants
        if (isJpegFile && isJpegDetected) {
          // This is fine
        }
        // Skip strict validation for WEBP and CSV (complex/text formats)
        else if (isWebpFile || isCsvFile) {
          // Allow to pass
        }
        // ZIP-based formats (xlsx, ods, docx) all have same signature
        else if (isZipBased && detectedType === "xlsx") {
          // Allow - they're all ZIP archives
        }
        // OLE-based formats (xls, doc) have same signature
        else if (isOleBased && (detectedType === "xls" || detectedType === "doc")) {
          // Allow - they're all OLE compound documents
        }
        // Check other mismatches
        else if (!ext.includes(detectedType) && !(isJpegFile && isJpegDetected)) {
          // For non-matching, only warn in console, don't block
          console.log(`Note: File ${file.originalname} extension ${ext} detected as ${detectedType}`)
        }
      }
    } catch (validationError) {
      console.error("File validation error:", validationError)
    }
  }

  if (validationErrors.length > 0) {
    logActivity({
      type: "security_incident",
      action: "file_validation_failed",
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      errors: validationErrors,
      status: "blocked",
    })

    return res.status(400).json({
      error: "File validation failed",
      details: validationErrors,
    })
  }

  next()
}
  // Admin authentication middleware
  // Admin sessions are signed JWTs that expire (ADMIN_TOKEN_TTL). The old token
  // was base64("user:sha256(password)") — a static credential that never
  // expired, so a leaked copy (browser storage, logs) worked forever.
  // The signing key is derived from JWT_SECRET *and* the admin password, so
  // (a) user JWTs can never pass as admin tokens and (b) changing the admin
  // password instantly invalidates every issued admin token.
  const adminJwt = require("jsonwebtoken")
  const ADMIN_TOKEN_TTL = "12h"
  const ADMIN_TOKEN_AUD = "smallpdf-admin"
  const adminTokenKey = () =>
    crypto.createHmac("sha256", process.env.JWT_SECRET || "change-this-secret-in-production")
      .update("admin-token-v1:" + ADMIN_USERNAME + ":" + ADMIN_PASSWORD)
      .digest()

  function safeEqual(a, b) {
    const ha = crypto.createHash("sha256").update(String(a)).digest()
    const hb = crypto.createHash("sha256").update(String(b)).digest()
    return crypto.timingSafeEqual(ha, hb)
  }

  function adminAuth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json({ error: "No token provided" })
    }

    try {
      const claims = adminJwt.verify(token, adminTokenKey(), { audience: ADMIN_TOKEN_AUD })
      if (claims.role !== "admin") throw new Error("not an admin token")
      next()
    } catch (error) {
      res.status(401).json({
        error: error.name === "TokenExpiredError" ? "Session expired — please log in again" : "Invalid token",
        code: "ADMIN_AUTH",
      })
    }
  }

  // Find LibreOffice executable
  function getLibreOfficePath() {
    const possiblePaths = [
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
      "/usr/bin/soffice",
      "/usr/bin/libreoffice",
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }

    return "soffice"
  }

  // EBUSY/EPERM-safe file delete. On Windows the file is often still locked by
  // LibreOffice/AV for a moment after conversion, so retry with backoff instead
  // of throwing (the old fs.unlinkSync threw EBUSY and failed the request).
  async function safeUnlink(filePath) {
    if (!filePath) return
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        return
      } catch (err) {
        if ((err.code === "EBUSY" || err.code === "EPERM") && attempt < 4) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
          continue
        }
        console.warn(`safeUnlink: could not delete ${filePath}: ${err.message}`)
        return
      }
    }
  }

  // Load a PDF for editing (rotate / split). pdf-lib can't decrypt: with
  // ignoreEncryption:true it copies still-encrypted streams and the result is a
  // corrupt file that the route still reports as a success. So encrypted files
  // are rewritten by qpdf first — permissions-only locks (e-tickets, bank bills)
  // are removed silently; a real open password → err.code PASSWORD_PROTECTED;
  // damaged → CORRUPT_PDF. Callers map err.code to a 422.
  async function loadPdfForEditing(filePath, displayName) {
    const load = async (p) => { const d = await PDFLibDocument.load(fs.readFileSync(p)); d.getPages(); return d }
    try {
      return await load(filePath)
    } catch (loadErr) {
      const fixed = filePath + ".fixed.pdf"
      let qpdfMsg = ""
      try {
        await util.promisify(require("child_process").execFile)("qpdf", ["--decrypt", filePath, fixed], { timeout: 90000 })
      } catch (e) { qpdfMsg = String(e.stderr || e.message || "") /* exit 3 = warnings, output still written */ }
      let doc = null
      if (fs.existsSync(fixed) && fs.statSync(fixed).size > 0) { try { doc = await load(fixed) } catch (_) {} }
      await safeUnlink(fixed)
      if (doc) return doc
      const err = new Error(displayName || "PDF")
      err.code = /encrypt/i.test(loadErr.message) || /password/i.test(qpdfMsg) ? "PASSWORD_PROTECTED" : "CORRUPT_PDF"
      err.fileName = displayName
      throw err
    }
  }

  // HEIC → JPG/PNG for the heic-to-* tools.
  //  • heic-decode gives raw RGBA (2–3× faster than heic-convert's own encoder:
  //    48 MP photo 2.8 s → 1.1 s for JPG, 5.0 s → 1.7 s for PNG).
  //  • Files named .heic that are really JPEG/PNG/AVIF/WebP (iPhone "share" often
  //    converts to JPEG but keeps the .HEIC name) go through sharp instead —
  //    they used to fail with "not a valid HEIC image".
  //  • Rotation/filter picked on the preview page are applied HERE: browsers other
  //    than Safari can't decode HEIC, so baking them client-side failed in Chrome.
  //  • JPG output gets a white background (transparent HEIC came out black).
  // Returns null when the file can't be decoded at all.
  const heicDecode = require("heic-decode")
  const SEPIA = [[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]]
  const blendMatrix = (m, k) => m.map((row, i) => row.map((v, j) => k * v + (1 - k) * (i === j ? 1 : 0)))
  async function convertHeicImage(buf, format, transform = {}) {
    let p = null
    try {
      const img = await heicDecode({ buffer: buf })
      p = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } })
    } catch (_) {
      try {
        await sharp(buf).stats() // full decode — rejects corrupt/truncated data
        p = sharp(buf).rotate() // honour EXIF orientation of real JPEGs
      } catch (_) { return null }
    }
    const rot = ((Math.round((Number(transform.rotation) || 0) / 90) * 90) % 360 + 360) % 360
    if (rot) p = p.rotate(rot)
    // Must match IMAGE_FILTERS in frontend/lib/imageEdit.js
    switch (transform.filterId) {
      case "grayscale": p = p.grayscale(); break
      case "sepia": p = p.recomb(blendMatrix(SEPIA, 0.85)); break
      case "bright": p = p.modulate({ brightness: 1.25 }); break
      case "contrast": p = p.linear(1.3, -0.3 * 128); break
      case "warm": p = p.modulate({ saturation: 1.4 }).recomb(blendMatrix(SEPIA, 0.2)); break
      case "cool": p = p.modulate({ saturation: 1.15, hue: -12 }); break
      case "invert": p = p.negate({ alpha: false }); break
    }
    if (format === "jpeg") return p.flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer()
    // PNG: keep transparency only when the photo actually has some (smaller files)
    const out = await p.png().toBuffer()
    try {
      if ((await sharp(out).stats()).isOpaque) return sharp(out).removeAlpha().png().toBuffer()
    } catch (_) {}
    return out
  }

  // Decode an uploaded photo for PDFKit (which only reads baseline JPEG/PNG).
  // Handles: iPhone HEIC saved/renamed as .jpg (sharp's prebuilt libvips can't
  // decode HEVC → heic-convert), WebP/AVIF inside a .jpg, EXIF orientation, and
  // corrupt/truncated files (→ null, caller skips the file).
  async function prepareImageForPdf(filePath) {
    let buf = fs.readFileSync(filePath)
    let meta = null
    try { meta = await sharp(buf).metadata() } catch (_) {}
    if (!meta || meta.format === "heif") {
      try {
        buf = Buffer.from(await heicConvert({ buffer: buf, format: "JPEG", quality: 0.92 }))
        meta = await sharp(buf).metadata()
      } catch (_) { if (!meta) return null /* AVIF etc.: sharp can still decode */ }
    }
    if (!meta.width || !meta.height) return null
    try {
      const needsReencode = !["jpeg", "png"].includes(meta.format) || (meta.orientation && meta.orientation > 1)
      if (!needsReencode) {
        await sharp(buf).stats() // full decode: rejects truncated/corrupt data up front
        return { source: buf, width: meta.width, height: meta.height }
      }
      const out = await sharp(buf).rotate().jpeg({ quality: 95 }).toBuffer()
      const m2 = await sharp(out).metadata()
      return { source: out, width: m2.width, height: m2.height }
    } catch (_) { return null }
  }

  // Largest DPI ≤ requested that keeps every page ≤ ~100 MP and ≤ 14000 px on
  // its long side. A 36×24 in poster at 600 DPI is 21600×14400 (311 MP) —
  // Ghostscript failed/timed out on the server and such JPGs don't open in
  // most viewers anyway. Normal A4/Letter pages are unaffected (600 DPI ≈ 35 MP).
  async function pdfRasterDpi(pdfPath, dpi) {
    try {
      const d = await PDFLibDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true, updateMetadata: false })
      let maxArea = 0, maxSide = 0
      for (const p of d.getPages()) {
        const { width, height } = p.getSize()
        const w = width / 72, h = height / 72
        maxArea = Math.max(maxArea, w * h)
        maxSide = Math.max(maxSide, w, h)
      }
      if (!maxArea) return dpi
      const cap = Math.floor(Math.min(Math.sqrt(100e6 / maxArea), 14000 / maxSide))
      return Math.max(36, Math.min(dpi, cap))
    } catch (_) { return dpi }
  }

  // True when the PDF needs an OPEN password (qpdf exit 0). Permissions-only
  // locks and plain files exit non-zero → false. Used by tools that hand the file
  // to Ghostscript, which can't open password PDFs and used to fail with a
  // misleading 500 ("please ensure Ghostscript is installed").
  async function pdfRequiresPassword(filePath) {
    try {
      await util.promisify(require("child_process").execFile)("qpdf", ["--requires-password", filePath], { timeout: 30000 })
      return true
    } catch (_) { return false }
  }

  // Run a LibreOffice command with an isolated, per-call user profile so that
  // concurrent conversions don't fight over the same profile lock (a major
  // cause of "soffice exited with code 1" under load). Retries once on failure.
  // `command` must be the full command string starting with the soffice path.
  async function runLibreOffice(command, options = {}) {
    const os = require("os")
    const profileDir = path.join(
      os.tmpdir(),
      `lo-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    // Build a valid file:// URI on both Windows (C:/...) and Linux (/tmp/...)
    const profilePath = profileDir.replace(/\\/g, "/")
    const profileUri = `file://${profilePath.startsWith("/") ? "" : "/"}${profilePath}`
    const profileArg = `-env:UserInstallation=${profileUri}`
    // Inject the isolated profile right after the soffice executable (first token,
    // which may be a quoted path on Windows).
    const injected = command.replace(/^("[^"]+"|\S+)/, `$1 ${profileArg}`)
    const execOpts = { timeout: 120000, maxBuffer: 100 * 1024 * 1024, ...options }
    try {
      try {
        return await execPromise(injected, execOpts)
      } catch (err) {
        // One retry — LibreOffice intermittently fails under concurrency / profile locks.
        await new Promise((r) => setTimeout(r, 1000))
        return await execPromise(injected, execOpts)
      }
    } finally {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true })
      } catch {}
    }
  }

  // Render DPI that keeps one page's bitmap under `maxPixels`. Poster and
  // engineering-drawing pages at a fixed 200–300 DPI exceeded sharp's input
  // limit ("Input image exceeds pixel limit") and could exhaust memory.
  // compress-image: anything over BIG_IMAGE_MAX_PIXELS is downscaled before compressing;
  // BIG_IMAGE_PIXEL_CAP is the hard ceiling (≈32k×32k) so a decompression bomb can't take the box down.
  const BIG_IMAGE_MAX_PIXELS = 100e6
  const BIG_IMAGE_PIXEL_CAP = 1e9

  function safeRenderDpi(widthPt, heightPt, wantDpi, maxPixels = 40e6) {
    const px = (widthPt / 72 * wantDpi) * (heightPt / 72 * wantDpi)
    if (!(px > maxPixels)) return wantDpi
    return Math.max(24, Math.floor(wantDpi * Math.sqrt(maxPixels / px)))
  }

  // A pdf-lib page's size as DISPLAYED (after /Rotate) — what Ghostscript
  // renders and what pdf.js shows in the browser.
  function displaySize(page) {
    const { width, height } = page.getSize()
    const rot = ((((page.getRotation().angle || 0) % 360) + 360) % 360)
    return rot === 90 || rot === 270 ? { width: height, height: width, rot } : { width, height, rot }
  }

  // Find Ghostscript executable
  function getGhostscriptPath() {
    const possiblePaths = [
      "C:\\Program Files\\gs\\gs10.06.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.05.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.05.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.03.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.03.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.02.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.01.2\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.01.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.01.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.00.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs9.56.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs9.55.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs9.54.0\\bin\\gswin64c.exe",
      "C:\\Program Files (x86)\\gs\\gs10.04.0\\bin\\gswin32c.exe",
      "C:\\Program Files (x86)\\gs\\gs10.03.1\\bin\\gswin32c.exe",
      "C:\\Program Files (x86)\\gs\\gs9.56.1\\bin\\gswin32c.exe",
      "/usr/bin/gs",
      "/usr/local/bin/gs",
      "/opt/homebrew/bin/gs",
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log("Found Ghostscript at:", p)
        return p
      }
    }

    return process.platform === "win32" ? "gswin64c" : "gs"
  }

  // Helper function for file size formatting
  function formatFileSize(bytes) {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + " MB"
    }
    return (bytes / 1024).toFixed(1) + " KB"
  }

  // ============================================
  // ADMIN PANEL ROUTES
  // ============================================

  // Strict limiter for the admin login — slows brute-force attempts on credentials.
  const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
    store: new SQLiteRateStore("admin-login"), // persist across restarts / instances
    message: { error: "Too many login attempts. Try again in 15 minutes." },
  })

  // Admin login
  app.post("/api/admin/login", adminLoginLimiter, async (req, res) => {
    const { username, password } = req.body

    // Compare both fields in constant time (and always both) so response
    // timing doesn't reveal how much of the username/password matched.
    const userOk = safeEqual(username || "", ADMIN_USERNAME)
    const passOk = safeEqual(password || "", ADMIN_PASSWORD) && ADMIN_PASSWORD.length >= 8 && !!ADMIN_USERNAME
    if (userOk && passOk) {
      const token = adminJwt.sign({ role: "admin", sub: username }, adminTokenKey(), {
        expiresIn: ADMIN_TOKEN_TTL,
        audience: ADMIN_TOKEN_AUD,
      })

      await logActivity({
        type: "admin",
        action: "login",
        metadata: { username: username },
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "success",
      })

      res.json({
        success: true,
        token: token,
        username: username,
      })
    } else {
      await logActivity({
        type: "admin",
        action: "login_failed",
        metadata: { username: username },
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "failed",
      })

      res.status(401).json({ error: "Invalid credentials" })
    }
  })
// ADDITIONAL ADMIN API ENDPOINTS
// Add these to your server.js file after the existing admin routes

// Get detailed IP information
// New dashboard data endpoints (overview / charts / tools / revenue / health / user detail / exports)
require("./admin/dashboardRoutes")(app, adminAuth)
{ const vt = require("./admin/visitTracking"); vt.registerVisitBeacon(app); vt.registerSourceRoutes(app, adminAuth) }

app.get("/api/admin/ip/:ipAddress", adminAuth, async (req, res) => {
  try {
    const { ipAddress } = req.params
    
    const { getIPDetails } = require('./database')
    const details = await getIPDetails(ipAddress)
    
    if (!details) {
      return res.status(404).json({ error: "IP not found" })
    }
    
    await logActivity({
      type: "admin",
      action: "view_ip_details",
      metadata: { ipAddress: ipAddress },
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "success",
    })
    
    res.json(details)
  } catch (error) {
    console.error("Get IP details error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Block/Unblock IP address
app.post("/api/admin/ip/:ipAddress/block", adminAuth, async (req, res) => {
  try {
    const { ipAddress } = req.params
    const { blocked } = req.body
    
    const { toggleIPBlock } = require('./database')
    const success = await toggleIPBlock(ipAddress, blocked)
    
    if (!success) {
      return res.status(500).json({ error: "Failed to update IP status" })
    }
    
    await logActivity({
      type: "admin",
      action: blocked ? "ip_blocked" : "ip_unblocked",
      metadata: { ipAddress: ipAddress },
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "success",
    })
    
    res.json({
      success: true,
      message: `IP ${blocked ? 'blocked' : 'unblocked'} successfully`,
      ipAddress: ipAddress,
      blocked: blocked,
    })
  } catch (error) {
    console.error("Toggle IP block error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get analytics for specific time range
app.get("/api/admin/analytics/range", adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query
    
    const { dbAll } = require('./database')
    
    let query = `
      SELECT 
        ${groupBy === 'hour' ? "strftime('%Y-%m-%d %H:00', created_at, '+330 minutes')" : "DATE(created_at, '+330 minutes')"} as period,
        COUNT(*) as total,
        SUM(CASE WHEN type = 'conversion' THEN 1 ELSE 0 END) as conversions,
        SUM(CASE WHEN type = 'download' THEN 1 ELSE 0 END) as downloads,
        SUM(CASE WHEN type = 'upload' THEN 1 ELSE 0 END) as uploads,
        SUM(CASE WHEN status IN ('error', 'failed') THEN 1 ELSE 0 END) as errors,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM activity_logs
      WHERE 1=1
    `
    
    const params = []
    
    if (startDate) {
      query += ' AND created_at >= ?'
      params.push(startDate)
    }
    
    if (endDate) {
      query += ' AND created_at <= ?'
      params.push(endDate)
    }
    
    query += ' GROUP BY period ORDER BY period DESC'
    
    const analytics = await dbAll(query, params)
    
    res.json({
      success: true,
      analytics: analytics,
      startDate: startDate,
      endDate: endDate,
      groupBy: groupBy || 'day',
    })
  } catch (error) {
    console.error("Get analytics range error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get tool-specific statistics
app.get("/api/admin/tools/:toolName/stats", adminAuth, async (req, res) => {
  try {
    const { toolName } = req.params
    
    const { dbGet, dbAll } = require('./database')
    
    // Total usage
    const totalUsage = await dbGet(
      'SELECT COUNT(*) as count FROM activity_logs WHERE tool = ?',
      [toolName]
    )
    
    // Success rate
    const successCount = await dbGet(
      "SELECT COUNT(*) as count FROM activity_logs WHERE tool = ? AND status = 'success'",
      [toolName]
    )
    
    // Average processing time
    const avgTime = await dbGet(
      'SELECT AVG(processing_time) as avg FROM activity_logs WHERE tool = ? AND processing_time IS NOT NULL',
      [toolName]
    )
    
    // Daily usage (last 30 days)
    const dailyUsage = await dbAll(`
      SELECT 
        DATE(created_at, '+330 minutes') as date,
        COUNT(*) as count
      FROM activity_logs
      WHERE tool = ?
      AND created_at > datetime('now', '-30 days')
      GROUP BY DATE(created_at, '+330 minutes')
      ORDER BY date DESC
    `, [toolName])
    
    // Top errors
    const topErrors = await dbAll(`
      SELECT 
        error_message,
        COUNT(*) as count
      FROM activity_logs
      WHERE tool = ?
      AND status IN ('error', 'failed')
      AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 5
    `, [toolName])
    
    const successRate = totalUsage.count > 0 
      ? ((successCount.count / totalUsage.count) * 100).toFixed(2)
      : 0
    
    res.json({
      success: true,
      tool: toolName,
      stats: {
        totalUsage: totalUsage.count,
        successCount: successCount.count,
        successRate: successRate,
        avgProcessingTime: avgTime.avg || 0,
        dailyUsage: dailyUsage,
        topErrors: topErrors,
      },
    })
  } catch (error) {
    console.error("Get tool stats error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Export activity logs to CSV
app.get("/api/admin/export/logs", adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query
    
    const { dbAll } = require('./database')
    
    let query = 'SELECT * FROM activity_logs WHERE 1=1'
    const params = []
    
    if (startDate) {
      query += ' AND created_at >= ?'
      params.push(startDate)
    }
    
    if (endDate) {
      query += ' AND created_at <= ?'
      params.push(endDate)
    }
    
    if (type) {
      query += ' AND type = ?'
      params.push(type)
    }
    
    query += ' ORDER BY created_at DESC'
    
    const logs = await dbAll(query, params)
    
    // Convert to CSV
    const headers = [
      'ID', 'Type', 'Action', 'Tool', 'Filename', 'IP Address', 
      'Browser', 'OS', 'Device', 'Status', 'Created At'
    ]
    
    let csv = headers.join(',') + '\n'
    
    logs.forEach(log => {
      const row = [
        log.id,
        log.type,
        log.action,
        log.tool || '',
        log.filename || '',
        log.ip_address || '',
        log.browser || '',
        log.os || '',
        log.device || '',
        log.status,
        log.created_at,
      ]
      csv += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n'
    })
    
    await logActivity({
      type: "admin",
      action: "export_logs",
      metadata: { 
        recordCount: logs.length,
        startDate: startDate,
        endDate: endDate,
      },
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "success",
    })
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${Date.now()}.csv"`)
    res.send(csv)
  } catch (error) {
    console.error("Export logs error:", error)
    res.status(500).json({ error: error.message })
  }
})

// List / export email subscribers captured via the download-page opt-in
app.get("/api/admin/subscribers", adminAuth, async (req, res) => {
  try {
    const subscribers = await dbAll("SELECT * FROM email_subscribers ORDER BY created_at DESC")
    res.json({ subscribers, total: subscribers.length })
  } catch (error) {
    console.error("List subscribers error:", error)
    res.status(500).json({ error: error.message })
  }
})

app.get("/api/admin/subscribers/export", adminAuth, async (req, res) => {
  try {
    const subscribers = await dbAll("SELECT * FROM email_subscribers ORDER BY created_at DESC")

    let csv = "ID,Email,Source Page,Created At\n"
    subscribers.forEach((s) => {
      const row = [s.id, s.email, s.source_page || "", s.created_at]
      csv += row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",") + "\n"
    })

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", `attachment; filename="email_subscribers_${Date.now()}.csv"`)
    res.send(csv)
  } catch (error) {
    console.error("Export subscribers error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get real-time dashboard metrics (for live updates)
app.get("/api/admin/realtime", adminAuth, async (req, res) => {
  try {
    const { dbGet, dbAll } = require('./database')
    
    // Get activity in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const recentActivity = await dbAll(`
      SELECT type, COUNT(*) as count
      FROM activity_logs
      WHERE created_at > ?
      GROUP BY type
    `, [fiveMinutesAgo])
    
    // Active users (unique IPs in last 5 minutes)
    const activeUsers = await dbGet(`
      SELECT COUNT(DISTINCT ip_address) as count
      FROM activity_logs
      WHERE created_at > ?
    `, [fiveMinutesAgo])
    
    // Recent errors
    const recentErrors = await dbGet(`
      SELECT COUNT(*) as count
      FROM activity_logs
      WHERE created_at > ?
      AND status IN ('error', 'failed')
    `, [fiveMinutesAgo])
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        recentActivity: recentActivity.reduce((acc, item) => {
          acc[item.type] = item.count
          return acc
        }, {}),
        activeUsers: activeUsers.count,
        recentErrors: recentErrors.count,
      },
    })
  } catch (error) {
    console.error("Get realtime metrics error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get browser/OS/device breakdown
app.get("/api/admin/analytics/platforms", adminAuth, async (req, res) => {
  try {
    const { timeRange } = req.query // '24h', '7d', '30d', 'all'
    
    const { dbAll } = require('./database')
    
    let timeFilter = ''
    
    switch (timeRange) {
      case '24h':
        timeFilter = "AND created_at > datetime('now', '-1 day')"
        break
      case '7d':
        timeFilter = "AND created_at > datetime('now', '-7 days')"
        break
      case '30d':
        timeFilter = "AND created_at > datetime('now', '-30 days')"
        break
      default:
        timeFilter = ''
    }
    
    // Browser breakdown
    const browsers = await dbAll(`
      SELECT browser, COUNT(*) as count
      FROM activity_logs
      WHERE browser IS NOT NULL ${timeFilter}
      GROUP BY browser
      ORDER BY count DESC
    `)
    
    // OS breakdown
    const os = await dbAll(`
      SELECT os, COUNT(*) as count
      FROM activity_logs
      WHERE os IS NOT NULL ${timeFilter}
      GROUP BY os
      ORDER BY count DESC
    `)
    
    // Device breakdown
    const devices = await dbAll(`
      SELECT device, COUNT(*) as count
      FROM activity_logs
      WHERE device IS NOT NULL ${timeFilter}
      GROUP BY device
      ORDER BY count DESC
    `)
    
    res.json({
      success: true,
      timeRange: timeRange || 'all',
      platforms: {
        browsers: browsers,
        os: os,
        devices: devices,
      },
    })
  } catch (error) {
    console.error("Get platform analytics error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get geographic distribution (if you have country data)
app.get("/api/admin/analytics/geography", adminAuth, async (req, res) => {
  try {
    const { dbAll } = require('./database')
    
    const countries = await dbAll(`
      SELECT 
        country,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(*) as total_requests
      FROM ip_analytics
      WHERE country IS NOT NULL
      GROUP BY country
      ORDER BY total_requests DESC
      LIMIT 20
    `)
    
    const cities = await dbAll(`
      SELECT 
        city,
        country,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(*) as total_requests
      FROM ip_analytics
      WHERE city IS NOT NULL
      GROUP BY city, country
      ORDER BY total_requests DESC
      LIMIT 20
    `)
    
    res.json({
      success: true,
      geography: {
        countries: countries,
        cities: cities,
      },
    })
  } catch (error) {
    console.error("Get geography analytics error:", error)
    res.status(500).json({ error: error.message })
  }
})
  // Get activity logs
  app.get("/api/admin/activity", adminAuth, async (req, res) => {
    try {
      const { page = 1, limit = 50, type, action, status } = req.query

      const result = await getActivityLogsFromDB({
        page,
        limit,
        type,
        action,
        status
      })
      try { await require('./admin/visitTracking').attachSources(result.logs) } catch (_) {}   // traffic source per row

      const stats = {
        total: result.total,
        filtered: result.total,
        byType: {},
        byStatus: {},
        last24Hours: 0,
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      result.logs.forEach(log => {
        stats.byType[log.type] = (stats.byType[log.type] || 0) + 1
        
        if (log.status) {
          stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1
        }
        
        if (log.created_at > twentyFourHoursAgo) {
          stats.last24Hours++
        }
      })

      res.json({
        logs: result.logs,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
        stats: stats,
      })
    } catch (error) {
      console.error("Get activity logs error:", error)
      res.status(500).json({ error: error.message })
    }
  })

  // Get dashboard statistics
  app.get("/api/admin/stats", adminAuth, async (req, res) => {
    try {
      const stats = await getStatsFromDB()
      
      const recentLogs = await getActivityLogsFromDB({ page: 1, limit: 10 })
      stats.recentActivity = recentLogs.logs

      res.json(stats)
    } catch (error) {
      console.error("Get stats error:", error)
      res.status(500).json({ error: error.message })
    }
  })

  // Clear old logs
  app.post("/api/admin/clear-logs", adminAuth, async (req, res) => {
    try {
      const { olderThan } = req.body

      if (!olderThan) {
        return res.status(400).json({ error: "olderThan parameter required" })
      }

      const cutoffDate = new Date(Date.now() - olderThan * 24 * 60 * 60 * 1000).toISOString()

      const result = await dbRun('DELETE FROM activity_logs WHERE created_at < ?', [cutoffDate])

      await logActivity({
        type: "admin",
        action: "clear_logs",
        metadata: {
          logsRemoved: result.changes,
          olderThan: olderThan
        },
        status: "success",
      })

      res.json({
        success: true,
        message: `Removed ${result.changes} log entries`,
        removed: result.changes,
      })
    } catch (error) {
      console.error("Clear logs error:", error)
      res.status(500).json({ error: error.message })
    }
  })
  // ============================================
  // USER MANAGEMENT ADMIN ROUTES
  // ============================================

  // Get user statistics summary
  app.get("/api/admin/users/stats", adminAuth, async (req, res) => {
    try {
      // effective_plan: if plan_expires_at is set and in the past, treat as 'free'
      const stats = await dbGet(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN
            plan = 'free' OR (plan != 'free' AND plan_expires_at IS NOT NULL AND plan_expires_at < datetime('now'))
          THEN 1 ELSE 0 END) as free_users,
          SUM(CASE WHEN plan = 'starter' AND (plan_expires_at IS NULL OR plan_expires_at >= datetime('now')) THEN 1 ELSE 0 END) as starter_users,
          SUM(CASE WHEN plan = 'pro'     AND (plan_expires_at IS NULL OR plan_expires_at >= datetime('now')) THEN 1 ELSE 0 END) as pro_users,
          SUM(CASE WHEN plan = 'agency'  AND (plan_expires_at IS NULL OR plan_expires_at >= datetime('now')) THEN 1 ELSE 0 END) as agency_users,
          SUM(CASE WHEN plan != 'free'   AND (plan_expires_at IS NULL OR plan_expires_at >= datetime('now')) THEN 1 ELSE 0 END) as paid_users,
          SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) as verified_users,
          SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) as banned_users,
          SUM(CASE WHEN date(created_at, '+330 minutes') = date('now', '+330 minutes') THEN 1 ELSE 0 END) as new_today, -- today = IST day
          SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as new_this_week,
          SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as new_this_month
        FROM users
      `)
      res.json(stats)
    } catch (err) {
      console.error("User stats error:", err)
      res.status(500).json({ error: err.message })
    }
  })

  // List users with pagination, search, filter
  app.get("/api/admin/users", adminAuth, async (req, res) => {
    try {
      const { page = 1, limit = 20, search = '', plan = '', verified = '' } = req.query
      const offset = (parseInt(page) - 1) * parseInt(limit)

      const where = []
      const params = []

      if (search) {
        where.push('(name LIKE ? OR email LIKE ?)')
        params.push(`%${search}%`, `%${search}%`)
      }
      if (plan) {
        where.push('plan = ?')
        params.push(plan)
      }
      if (verified !== '') {
        where.push('email_verified = ?')
        params.push(verified === 'true' ? 1 : 0)
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const total = await dbGet(
        `SELECT COUNT(*) as count FROM users ${whereClause}`,
        params
      )
      const users = await dbAll(
        `SELECT id, name, email, plan, plan_expires_at, email_verified, is_banned, ban_reason,
                created_at, last_login_at,
                (google_id IS NOT NULL) as is_google,
                CASE
                  WHEN plan = 'free' THEN 'free'
                  WHEN plan_expires_at IS NOT NULL AND plan_expires_at < datetime('now') THEN 'expired'
                  ELSE plan
                END as effective_plan
         FROM users ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      )

      res.json({
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total.count,
          totalPages: Math.ceil(total.count / parseInt(limit)),
        },
      })
    } catch (err) {
      console.error("List users error:", err)
      res.status(500).json({ error: err.message })
    }
  })

  // Ban / unban a user
  app.put("/api/admin/users/:id/ban", adminAuth, async (req, res) => {
    try {
      const { id } = req.params
      const { banned, reason } = req.body
      await dbRun(
        'UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?',
        [banned ? 1 : 0, banned ? (reason || 'Banned by admin') : null, id]
      )
      res.json({ success: true })
    } catch (err) {
      console.error("Ban user error:", err)
      res.status(500).json({ error: err.message })
    }
  })

  // Change a user's plan manually
  app.put("/api/admin/users/:id/plan", adminAuth, async (req, res) => {
    try {
      const { id } = req.params
      const { plan } = req.body
      const validPlans = ['free', 'starter', 'pro', 'agency']
      if (!validPlans.includes(plan)) {
        return res.status(400).json({ error: 'Invalid plan' })
      }
      // When admin sets a plan:
      // - free → clear expiry + subscription IDs
      // - paid → set expiry 1 year from now + clear subscription IDs (admin override, not billing-tied)
      const expiresAt = plan === 'free'
        ? null
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      await dbRun(
        `UPDATE users SET plan = ?, plan_expires_at = ?,
         razorpay_subscription_id = NULL, paypal_subscription_id = NULL,
         paypal_customer_id = NULL WHERE id = ?`,
        [plan, expiresAt, id]
      )
      console.log(`👑 Admin plan change: userId=${id} → ${plan} expires=${expiresAt || 'never'}`)
      res.json({ success: true, plan, expiresAt })
    } catch (err) {
      console.error("Change plan error:", err)
      res.status(500).json({ error: err.message })
    }
  })

  // EXISTING ROUTES WITH ACTIVITY TRACKING

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "API is running" })
  })

  // BLOG ENDPOINTS (WITH DATABASE)

  // Create blog post
  app.post("/api/blog/create", adminAuth, blogImageUpload.single("featuredImage"), async (req, res) => {
    try {
      const { title, excerpt, content, author, category, tags, status } = req.body

      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" })
      }

      const slug = generateSlug(title)
      
      const existingPost = await dbGet('SELECT id FROM blog_posts WHERE slug = ?', [slug])
      if (existingPost) {
        return res.status(400).json({ error: "A post with this title already exists" })
      }

      const result = await dbRun(`
        INSERT INTO blog_posts (title, slug, excerpt, content, featured_image, author, category, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        title,
        slug,
        excerpt || content.substring(0, 160) + "...",
        content,
        req.file ? `/uploads/blog/${req.file.filename}` : null,
        author || "Admin",
        category || "General",
        status || "published"
      ])

      const postId = result.id

      if (tags) {
        const tagArray = tags.split(",").map(t => t.trim()).filter(t => t)
        const tagIds = await manageTags(tagArray)
        
        for (const tagId of tagIds) {
          await dbRun('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [postId, tagId])
        }
      }

      const newPost = await dbGet('SELECT * FROM blog_posts WHERE id = ?', [postId])
      const postWithTags = await getPostWithTags(newPost)

      await logActivity({
        type: "admin",
        action: "blog_post_created",
        metadata: {
          postId: postId,
          title: title,
          status: status || "published"
        },
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "success",
      })

      res.json({
        success: true,
        message: "Blog post created successfully",
        post: postWithTags,
      })
    } catch (error) {
      console.error("Create blog post error:", error)
      
      await logActivity({
        type: "admin",
        action: "blog_post_create_failed",
        metadata: { error: error.message },
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // Get all blog posts (public)
  app.get("/api/blog/posts", async (req, res) => {
    try {
      const { page = 1, category, tag } = req.query
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100)
      // Public endpoint: always published only. It used to take ?status= from
      // the query string, so ?status=draft exposed unpublished posts to anyone.
      // The admin panel lists drafts via /api/blog/admin/posts instead.
      const status = "published"

      let query = 'SELECT * FROM blog_posts WHERE status = ?'
      const params = [status]

      if (category) {
        query += ' AND category = ?'
        params.push(category)
      }

      if (tag) {
        query += ` AND id IN (
          SELECT pt.post_id FROM post_tags pt
          JOIN blog_tags bt ON pt.tag_id = bt.id
          WHERE bt.name = ?
        )`
        params.push(tag.toLowerCase())
      }

      query += ' ORDER BY created_at DESC'

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
      const { total } = await dbGet(countQuery, params)

      query += ' LIMIT ? OFFSET ?'
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit))

      const posts = await dbAll(query, params)

      const postsWithTags = await Promise.all(posts.map(post => getPostWithTags(post)))

      const categories = await dbAll('SELECT DISTINCT category FROM blog_posts WHERE status = ?', [status])
      const allTags = await dbAll('SELECT name FROM blog_tags')

      res.json({
        success: true,
        posts: postsWithTags,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit),
        },
        categories: categories.map(c => c.category),
        tags: allTags.map(t => t.name),
      })
    } catch (error) {
      console.error("Get blog posts error:", error)
      res.status(500).json({ error: error.message })
    }
  })

  // Get single blog post by slug (public)
  app.get("/api/blog/post/:slug", async (req, res) => {
    try {
      const { slug } = req.params
      
      // Drafts must not be readable by slug on the public site.
      const post = await dbGet("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'", [slug])

      if (!post) {
        return res.status(404).json({ error: "Blog post not found" })
      }

      await dbRun('UPDATE blog_posts SET views = views + 1 WHERE id = ?', [post.id])

      const postWithTags = await getPostWithTags(post)
      postWithTags.views += 1

      const relatedPosts = await dbAll(`
        SELECT * FROM blog_posts 
        WHERE category = ? AND id != ? AND status = 'published'
        ORDER BY created_at DESC
        LIMIT 3
      `, [post.category, post.id])

      const relatedWithTags = await Promise.all(relatedPosts.map(p => getPostWithTags(p)))

      res.json({
        success: true,
        post: postWithTags,
        relatedPosts: relatedWithTags,
      })
    } catch (error) {
      console.error("Get blog post error:", error)
      res.status(500).json({ error: error.message })
    }
  })

  // Update blog post
  app.put("/api/blog/update/:id", adminAuth, blogImageUpload.single("featuredImage"), async (req, res) => {
    try {
      const { id } = req.params
      const { title, excerpt, content, author, category, tags, status } = req.body

      const post = await dbGet('SELECT * FROM blog_posts WHERE id = ?', [id])

      if (!post) {
        return res.status(404).json({ error: "Blog post not found" })
      }

      const updates = []
      const params = []

      if (title) {
        const slug = generateSlug(title)
        updates.push('title = ?', 'slug = ?')
        params.push(title, slug)
      }
      if (excerpt) {
        updates.push('excerpt = ?')
        params.push(excerpt)
      }
      if (content) {
        updates.push('content = ?')
        params.push(content)
      }
      if (author) {
        updates.push('author = ?')
        params.push(author)
      }
      if (category) {
        updates.push('category = ?')
        params.push(category)
      }
      if (status) {
        updates.push('status = ?')
        params.push(status)
      }
      if (req.file) {
        updates.push('featured_image = ?')
        params.push(`/uploads/blog/${req.file.filename}`)
      }

      updates.push('updated_at = CURRENT_TIMESTAMP')
      params.push(id)

      if (updates.length > 0) {
        await dbRun(`UPDATE blog_posts SET ${updates.join(', ')} WHERE id = ?`, params)
      }

      if (tags) {
        await dbRun('DELETE FROM post_tags WHERE post_id = ?', [id])
        
        const tagArray = tags.split(",").map(t => t.trim()).filter(t => t)
        const tagIds = await manageTags(tagArray)
        
        for (const tagId of tagIds) {
          await dbRun('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [id, tagId])
        }
      }

      const updatedPost = await dbGet('SELECT * FROM blog_posts WHERE id = ?', [id])
      const postWithTags = await getPostWithTags(updatedPost)

      await logActivity({
        type: "admin",
        action: "blog_post_updated",
        metadata: {
          postId: id,
          title: updatedPost.title
        },
        ip: req.clientIP,
        status: "success",
      })

      res.json({
        success: true,
        message: "Blog post updated successfully",
        post: postWithTags,
      })
    } catch (error) {
      console.error("Update blog post error:", error)
      
      await logActivity({
        type: "admin",
        action: "blog_post_update_failed",
        metadata: { error: error.message },
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // Delete blog post
  app.delete("/api/blog/delete/:id", adminAuth, async (req, res) => {
    try {
      const { id } = req.params
      
      const post = await dbGet('SELECT * FROM blog_posts WHERE id = ?', [id])

      if (!post) {
        return res.status(404).json({ error: "Blog post not found" })
      }

      if (post.featured_image) {
        const imagePath = path.join(__dirname, post.featured_image)
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath)
        }
      }

      await dbRun('DELETE FROM blog_posts WHERE id = ?', [id])

      await logActivity({
        type: "admin",
        action: "blog_post_deleted",
        metadata: {
          postId: id,
          title: post.title
        },
        ip: req.clientIP,
        status: "success",
      })

      res.json({
        success: true,
        message: "Blog post deleted successfully",
      })
    } catch (error) {
      console.error("Delete blog post error:", error)
      
      await logActivity({
        type: "admin",
        action: "blog_post_delete_failed",
        metadata: { error: error.message },
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // Get all posts for admin (includes drafts)
  app.get("/api/blog/admin/posts", adminAuth, async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query

      const { total } = await dbGet('SELECT COUNT(*) as total FROM blog_posts')
      
      const posts = await dbAll(`
        SELECT * FROM blog_posts 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [parseInt(limit), (parseInt(page) - 1) * parseInt(limit)])

      const postsWithTags = await Promise.all(posts.map(post => getPostWithTags(post)))

      res.json({
        success: true,
        posts: postsWithTags,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error("Get admin blog posts error:", error)
      res.status(500).json({ error: error.message })
    }
  })

  // Search blog posts
  app.get("/api/blog/search", async (req, res) => {
    try {
      const { q } = req.query

      if (!q) {
        return res.status(400).json({ error: "Search query required" })
      }

      const searchTerm = `%${q}%`
      
      const results = await dbAll(`
        SELECT * FROM blog_posts 
        WHERE status = 'published' 
        AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)
        ORDER BY created_at DESC
        LIMIT 50
      `, [searchTerm, searchTerm, searchTerm])

      const resultsWithTags = await Promise.all(results.map(post => getPostWithTags(post)))

      res.json({
        success: true,
        results: resultsWithTags,
        count: resultsWithTags.length,
      })
    } catch (error) {
      console.error("Search blog posts error:", error)
      res.status(500).json({ error: error.message })
    }
  })
  // Word to PDF Conversion
  app.post("/api/word-to-pdf", upload.single("file"), fileSizeLimiter("word-to-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" })
      }

      // A password-protected .docx is not a zip but an encrypted OLE container
      // (D0 CF 11 E0). LibreOffice can't open it headless, and the user used
      // to get "Please ensure LibreOffice is installed" — then retried.
      try {
        const fd = fs.openSync(req.file.path, "r")
        const head = Buffer.alloc(4)
        fs.readSync(fd, head, 0, 4, 0)
        fs.closeSync(fd)
        if (/\.docx$/i.test(req.file.originalname) && head.toString("hex") === "d0cf11e0") {
          await safeUnlink(req.file.path)
          logActivity({ type: "conversion", action: "word_to_pdf_protected", tool: "word-to-pdf",
            filename: req.file.originalname, ip: req.clientIP, status: "warning" })
          return res.status(422).json({
            error: "PASSWORD_PROTECTED",
            message: "This document is password-protected. Open it in Word, remove the password (File → Info → Protect Document), save, and upload it again.",
          })
        }
      } catch (_) {}

      logActivity({
        type: "upload",
        action: "word_uploaded",
        tool: "word-to-pdf",
        filename: req.file.originalname,
        fileSize: req.file.size,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log("File received:", req.file.originalname)

      const inputPath = req.file.path
      const outputDir = path.dirname(inputPath)
      const outputFilename = req.file.filename.replace(/\.(doc|docx)$/i, ".pdf")
      const outputPath = path.join(outputDir, outputFilename)

      const libreOfficePath = getLibreOfficePath()

      const command = `"${libreOfficePath}" --headless --convert-to "pdf:writer_pdf_Export:{\\"ReduceImageResolution\\":false,\\"MaxImageResolution\\":600,\\"Quality\\":90,\\"EmbedStandardFonts\\":true}" --outdir "${outputDir}" "${inputPath}"`

      console.log("Converting with LibreOffice (High Quality Mode)...")

      try {
        await runLibreOffice(command, {
          timeout: 180000,
          maxBuffer: 100 * 1024 * 1024,
        })

        const libreOutputPath = inputPath.replace(/\.(doc|docx)$/i, ".pdf")

        if (fs.existsSync(libreOutputPath)) {
          if (libreOutputPath !== outputPath) {
            fs.renameSync(libreOutputPath, outputPath)
          }

          console.log("Conversion successful:", outputFilename)
          await safeUnlink(inputPath)

          if (req.user) {
            await recordUserFile({
              userId: req.user.id,
              plan: req.user.plan,
              tool: "word-to-pdf",
              originalName: req.file.originalname.replace(/\.(doc|docx)$/i, ".pdf"),
              storedPath: path.resolve(outputPath),
              downloadUrl: `/uploads/${outputFilename}`,
              fileSize: fs.statSync(outputPath).size,
            }).catch(() => {})
          }

          logActivity({
            type: "conversion",
            action: "word_to_pdf_complete",
            tool: "word-to-pdf",
            conversionType: "word-to-pdf",
            filename: req.file.originalname,
            ip: req.clientIP,
            status: "success",
          })

          res.json({
            success: true,
            message: "File converted successfully with high quality",
            downloadUrl: `/uploads/${outputFilename}`,
            originalName: req.file.originalname,
            convertedName: outputFilename,
          })
        } else {
          throw new Error("PDF file not created")
        }
      } catch (conversionError) {
        console.error("LibreOffice conversion error:", conversionError)

        await safeUnlink(inputPath)

        logActivity({
          type: "conversion",
          action: "word_to_pdf_failed",
          tool: "word-to-pdf",
          filename: req.file.originalname,
          error: conversionError.message,
          ip: req.clientIP,
          status: "error",
        })

        res.status(500).json({
          error: "CONVERSION_FAILED",
          message: "We couldn't convert this document. It may be damaged or use an unsupported format — open it in Word, save a new copy as .docx and try again.",
        })
      }
    } catch (error) {
      console.error("Error:", error)
      
      logActivity({
        type: "conversion",
        action: "word_to_pdf_failed",
        tool: "word-to-pdf",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // PNG to PDF - FIXED VERSION
  app.post("/api/png-to-pdf", upload.array("files", 500), fileSizeLimiter("png-to-pdf"), batchLimiter("png-to-pdf"), dailyConversionLimiter(), fileValidation, async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      logActivity({
        type: "upload",
        action: "png_uploaded",
        tool: "png-to-pdf",
        fileCount: req.files.length,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log(`PNG to PDF - ${req.files.length} file(s) received`)

      const pageSize = req.body.pageSize || "a4"
      const orientation = req.body.orientation || "portrait"

      const outputFilename = `images-combined-${genJobId()}.pdf`
      const outputPath = path.join("./uploads", outputFilename)

      const pageSizes = {
        a4: { width: 595.28, height: 841.89 },
        letter: { width: 612, height: 792 },
        legal: { width: 612, height: 1008 },
      }

      const doc = new PDFDocument({
        autoFirstPage: false,
        margin: 0,
      })

      const writeStream = fs.createWriteStream(outputPath)
      doc.pipe(writeStream)

      let successCount = 0
      const errors = []

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i]

        try {
          if (!fs.existsSync(file.path)) {
            throw new Error(`File not found: ${file.path}`)
          }

          // Decode + validate BEFORE addPage (shared with jpg-to-pdf): HEIC saved
          // as .jpg, WebP, EXIF rotation; a truncated PNG used to leave a blank
          // page in the PDF while the response said it was skipped.
          const prepared = await prepareImageForPdf(file.path)
          if (!prepared) throw new Error("Unreadable image")
          let imgWidth = prepared.width
          let imgHeight = prepared.height
          const imgSource = prepared.source

          let pageWidth, pageHeight

          if (pageSize === "fit") {
            pageWidth = (imgWidth * 72) / 96
            pageHeight = (imgHeight * 72) / 96
          } else {
            const size = pageSizes[pageSize] || pageSizes.a4

            if (orientation === "auto") {
              const isLandscape = imgWidth > imgHeight
              pageWidth = isLandscape ? size.height : size.width
              pageHeight = isLandscape ? size.width : size.height
            } else if (orientation === "landscape") {
              pageWidth = size.height
              pageHeight = size.width
            } else {
              pageWidth = size.width
              pageHeight = size.height
            }
          }

          doc.addPage({ size: [pageWidth, pageHeight], margin: 0 })

          const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight)
          const scaledWidth = imgWidth * scale
          const scaledHeight = imgHeight * scale

          const x = (pageWidth - scaledWidth) / 2
          const y = (pageHeight - scaledHeight) / 2

          console.log(`Adding image to PDF: ${file.originalname}`)

          doc.image(imgSource, x, y, { 
            width: scaledWidth, 
            height: scaledHeight,
            fit: [scaledWidth, scaledHeight],
            align: 'center',
            valign: 'center'
          })

          successCount++
          console.log(`✓ Added image ${successCount}/${req.files.length}: ${file.originalname}`)
        } catch (imgError) {
          console.error(`✗ Error processing image ${file.originalname}:`, imgError.message)
          errors.push({ file: file.originalname, error: imgError.message })
        }
      }

      if (successCount === 0) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        }
        
        logActivity({
          type: "conversion",
          action: "png_to_pdf_failed",
          tool: "png-to-pdf",
          error: "No valid images processed",
          ip: req.clientIP,
          status: "error",
        })
        
        // The images themselves are unreadable → 422 with their names.
        return res.status(422).json({
          error: "UNREADABLE_IMAGES",
          files: errors.map((e) => e.file),
          message: "No valid images were processed",
          details: errors 
        })
      }

      doc.end()

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve)
        writeStream.on("error", reject)
      })

      console.log(`✓ PDF created successfully: ${outputFilename}`)
      console.log(`✓ Processed ${successCount}/${req.files.length} images`)

      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path)
          } catch (cleanupError) {
            console.log(`Warning: Could not delete ${file.path}`)
          }
        }
      }

      const stats = fs.statSync(outputPath)
      if (stats.size === 0) {
        logActivity({
          type: "conversion",
          action: "png_to_pdf_failed",
          tool: "png-to-pdf",
          error: "PDF file is empty",
          ip: req.clientIP,
          status: "error",
        })
        
        return res.status(500).json({ 
          error: "PDF file is empty", 
          details: "No content was written to PDF" 
        })
      }

      logActivity({
        type: "conversion",
        action: "png_to_pdf_complete",
        tool: "png-to-pdf",
        conversionType: "png-to-pdf",
        pageCount: successCount,
        ip: req.clientIP,
        status: "success",
      })

      res.json({
        success: true,
        message: `${successCount} image(s) combined into PDF successfully`,
        downloadUrl: `/uploads/${outputFilename}`,
        // Name the download after the user's first image (was "converted-images-<timestamp>.pdf").
        skipped: errors.length ? errors.map((e) => e.file) : undefined,
        convertedName: (() => {
          const first = path.basename(req.files[0].originalname, path.extname(req.files[0].originalname))
          return req.files.length > 1 ? `${first}-and-more.pdf` : `${first}.pdf`
        })(),
        pageCount: successCount,
        errors: errors.length > 0 ? errors : undefined,
        fileSize: stats.size,
      })
    } catch (error) {
      console.error("PNG to PDF Error:", error)
      console.error("Stack:", error.stack)

      if (req.files) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path)
            } catch (cleanupError) {
              console.log(`Warning: Could not delete ${file.path}`)
            }
          }
        }
      }

      logActivity({
        type: "conversion",
        action: "png_to_pdf_failed",
        tool: "png-to-pdf",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })

      res.status(500).json({ 
        error: "Failed to create PDF",
        details: error.message 
      })
    }
  })


  // EXCEL TO PDF ENDPOINTS

// Excel to PDF Conversion
app.post("/api/excel-to-pdf", upload.single("file"), fileSizeLimiter("excel-to-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No Excel file uploaded" })
    }

    // Normalize to array for the rest of the processing logic
    req.files = [req.file]

    logActivity({
      type: "upload",
      action: "excel_uploaded",
      tool: "excel-to-pdf",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`Excel to PDF - ${req.files.length} file(s) received`)

    const jobId = genJobId()
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      fs.mkdirSync(convertedDir, { recursive: true })
    }

    const libreOfficePath = getLibreOfficePath()
    const convertedFiles = []

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]

      // Get file extension
      const ext = path.extname(file.originalname).toLowerCase()
      const validExtensions = [".xlsx", ".xls", ".ods", ".csv"]

      if (!validExtensions.includes(ext)) {
        console.log(`Skipping non-Excel file: ${file.originalname}`)
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
        continue
      }

      const baseName = path.basename(file.originalname, ext)
      const outputFilename = `${baseName}.pdf`
      const expectedOutputPath = path.join(convertedDir, outputFilename)

      try {
        console.log(`Converting: ${file.originalname} to PDF...`)

        const orientation = (req.body && req.body.orientation === "landscape") ? "landscape" : "portrait"
        const fitToPage = !(req.body && req.body.fitToPage === "false")

        // ── Step 1: Pre-process Excel with Python to fix layout before LibreOffice renders ──
        // This fixes: truncated text, scientific notation, misaligned columns, print scaling
        const pythonBin = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3")
        const preparedPath = file.path + ".prepared.xlsx"

        // Page setup only — the user's own formatting is left alone. The old
        // script reset every cell's alignment (wrapped text became one long
        // line, rotated headers went flat), re-sized every column, forced A4
        // and printed gridlines over charts and bordered invoices, and ignored
        // the "Fit to page" option. CSV files are loaded into a workbook here
        // too, so they get the same page setup and no longer print
        // LibreOffice's default header (the internal temp file name) + "Page 1".
        const prepScript = `
import sys, csv, datetime
try:
    from openpyxl import Workbook, load_workbook
    from openpyxl.utils import get_column_letter

    src, dst, orientation, fit, title = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1", sys.argv[5]

    def num(v):
        s = v.strip()
        if not s or len(s) > 15 or (s[0] == "0" and len(s) > 1 and s[1] != "."):
            return v  # keep IDs / phone numbers with leading zeros as text
        try:
            return int(s)
        except ValueError:
            try:
                return float(s)
            except ValueError:
                return v

    if src.lower().endswith(".csv"):
        raw = open(src, "rb").read()
        for enc in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        try:
            dialect = csv.Sniffer().sniff(text[:20000], delimiters=",;\\t|")
        except csv.Error:
            dialect = csv.excel
        wb = Workbook()
        ws = wb.active
        ws.title = (title or "Sheet1")[:31]
        for row in csv.reader(text.splitlines(), dialect):
            ws.append([num(v) for v in row])
        for col in ws.columns:
            longest = max((len(str(c.value)) for c in col if c.value is not None), default=0)
            ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(longest + 2, 8), 60)
    else:
        wb = load_workbook(src)

    for ws in wb.worksheets:
        ws.page_setup.orientation = orientation
        # No paper size in the file → LibreOffice picked A4 for portrait but
        # Letter for landscape. Keep a size the user set; otherwise A4.
        if not ws.page_setup.paperSize:
            ws.page_setup.paperSize = 9
        if fit:
            ws.page_setup.fitToWidth = 1   # every column on one page width
            ws.page_setup.fitToHeight = 0  # as many pages tall as needed
            ws.sheet_properties.pageSetUpPr.fitToPage = True

        # Widen (never shrink) columns whose NUMBERS would not fit and print as ###.
        need = {}
        has_border = False
        for row in ws.iter_rows():
            for c in row:
                b = c.border
                if b and any(getattr(s, "style", None) for s in (b.left, b.right, b.top, b.bottom)):
                    has_border = True
                v = c.value
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    need[c.column] = max(need.get(c.column, 0), len(f"{v:,.2f}") + 2)
                elif isinstance(v, (datetime.date, datetime.datetime)):
                    need[c.column] = max(need.get(c.column, 0), 12)
        for col, w in need.items():
            dim = ws.column_dimensions[get_column_letter(col)]
            if (dim.width or 8.43) < w:
                dim.width = min(w, 40)

        # Gridlines only for plain tables — never over bordered layouts or charts.
        if not has_border and not getattr(ws, "_charts", None) and not getattr(ws, "_images", None):
            ws.print_options.gridLines = True

    wb.save(dst)
    print("PREP_OK")
except ImportError:
    print("PREP_SKIP")  # openpyxl not installed — skip prep, use original
except Exception as e:
    print(f"PREP_SKIP:{e}")
`
        const tempScriptPath = file.path + ".prep.py"
        fs.writeFileSync(tempScriptPath, prepScript)

        let sourceForLibreOffice = file.path
        try {
          // execFile (no shell): the sheet title comes from the user's file name.
          const { execFile } = require("child_process")
          // (multer keeps the original extension, so the script can tell CSV apart)
          const { stdout: prepOut } = await util.promisify(execFile)(pythonBin,
            [tempScriptPath, file.path, preparedPath, orientation, fitToPage ? "1" : "0", baseName.slice(0, 31)],
            { timeout: 60000, maxBuffer: 10 * 1024 * 1024 })
          if (prepOut.includes("PREP_OK") && fs.existsSync(preparedPath)) {
            sourceForLibreOffice = preparedPath
            console.log(`[prep] Excel pre-processed successfully`)
          } else {
            console.warn(`[prep] Skipped: ${prepOut.trim()}`)
          }
        } catch (prepErr) {
          console.warn(`[prep] Pre-processing failed, using original: ${prepErr.message}`)
        } finally {
          if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath)
        }

        // ── Step 2: LibreOffice converts the prepared (or original) file ──────
        const pageOrientation = orientation === "landscape" ? 1 : 0
        const pdfFilter = [
          `PageOrientation=${pageOrientation}`,
          "IsSkipEmptyPages=true",
          "ExportFormFields=false",
        ].join(";")

        const command = `"${libreOfficePath}" --headless --convert-to "pdf:calc_pdf_Export:{${pdfFilter}}" --outdir "${convertedDir}" "${sourceForLibreOffice}"`
        console.log(`Executing LibreOffice: ${command}`)

        await runLibreOffice(command, { timeout: 180000, maxBuffer: 100 * 1024 * 1024 })

        // Clean up prepared file
        await safeUnlink(preparedPath)

        // ── LibreOffice names output after INPUT basename — find it ───────────
        const tempBaseName = path.basename(sourceForLibreOffice).replace(/\.[^.]+$/, "")
        const loOutputPath = path.join(convertedDir, `${tempBaseName}.pdf`)

        let foundPath = null
        if (fs.existsSync(loOutputPath)) {
          foundPath = loOutputPath
        } else {
          // Safety net: newest .pdf created in last 30s
          const allPdfs = fs.readdirSync(convertedDir).filter(f => f.endsWith(".pdf"))
          const newest = allPdfs
            .map(f => ({ f, mt: fs.statSync(path.join(convertedDir, f)).mtimeMs }))
            .sort((a, b) => b.mt - a.mt)[0]
          if (newest && newest.mt > Date.now() - 30000) {
            foundPath = path.join(convertedDir, newest.f)
          }
        }

        if (!foundPath) {
          throw new Error("LibreOffice did not produce a PDF. Ensure LibreOffice is installed correctly.")
        }

        if (foundPath !== expectedOutputPath) {
          fs.renameSync(foundPath, expectedOutputPath)
        }

        const stats = fs.statSync(expectedOutputPath)
        convertedFiles.push({
          filename: outputFilename,
          originalName: file.originalname,
          fileSize: stats.size,
          originalSize: file.size,
        })
        console.log(`✓ Converted: ${file.originalname} → ${outputFilename} (${stats.size} bytes)`)

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path)

      } catch (convError) {
        console.error(`✗ Error converting ${file.originalname}:`, convError.message)
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
        const preparedPath = file.path + ".prepared.xlsx"
        if (fs.existsSync(preparedPath)) fs.unlinkSync(preparedPath)
      }
    }

    if (convertedFiles.length === 0) {
      if (fs.existsSync(convertedDir)) {
        fs.rmSync(convertedDir, { recursive: true, force: true })
      }

      logActivity({
        type: "conversion",
        action: "excel_to_pdf_failed",
        tool: "excel-to-pdf",
        error: "No files converted",
        ip: req.clientIP,
        status: "error",
      })
      
      return res.status(422).json({
        error: "CONVERSION_FAILED",
        message: "We couldn't convert this spreadsheet. It may be damaged or password-protected — open it in Excel, save a new copy and try again.",
      })
    }

    logActivity({
      type: "conversion",
      action: "excel_to_pdf_complete",
      tool: "excel-to-pdf",
      conversionType: "excel-to-pdf",
      fileCount: convertedFiles.length,
      jobId: jobId,
      ip: req.clientIP,
      status: "success",
    })

    // Copy first converted file to /uploads/ so it can be statically served
    const singleFile = convertedFiles[0]
    const destFilename = `excel-${jobId}-${singleFile.filename}`
    const destPath = path.join(__dirname, "uploads", destFilename)
    fs.copyFileSync(path.join(convertedDir, singleFile.filename), destPath)

    if (req.user) {
      // Logged-in users get the PDF in "My Files" for their plan's retention
      // window — the sweep protects recorded files, so no 1 h timer for them.
      await recordUserFile({
        userId: req.user.id,
        plan: req.user.plan,
        tool: "excel-to-pdf",
        originalName: singleFile.filename,
        jobId,
        storedPath: path.join(convertedDir, singleFile.filename),
        downloadUrl: `/api/download-excel-pdf/${jobId}`,
        fileSize: singleFile.fileSize,
      }).catch(() => {})
    } else {
      // Auto-cleanup after 1 hour
      setTimeout(() => {
        try {
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
          if (fs.existsSync(convertedDir)) fs.rmSync(convertedDir, { recursive: true, force: true })
        } catch (e) {}
      }, 60 * 60 * 1000)
    }

    res.json({
      success: true,
      message: `${convertedFiles.length} Excel file(s) converted to PDF successfully`,
      jobId: jobId,
      fileCount: convertedFiles.length,
      files: convertedFiles,
      downloadUrl: `/uploads/${destFilename}`,
      convertedName: singleFile.filename,        // clean "MyFile.pdf" not the prefixed upload name
      originalName: singleFile.originalName,
      fileSize: singleFile.fileSize,
    })
  } catch (error) {
    console.error("Excel to PDF Error:", error)

    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    logActivity({
      type: "conversion",
      action: "excel_to_pdf_failed",
      tool: "excel-to-pdf",
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    res.status(500).json({
      error: "Failed to convert Excel to PDF",
      details: error.message,
    })
  }
})

// Download endpoint for Excel to PDF
app.get("/api/download-excel-pdf/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: jobId,
        error: "Files not found or expired",
        ip: req.clientIP,
        status: "warning",
      })
      
      return res.status(404).json({ error: "Files not found or expired" })
    }

    const files = fs.readdirSync(convertedDir).filter(f => f.endsWith('.pdf'))

    if (files.length === 0) {
      return res.status(404).json({ error: "No converted PDF files available" })
    }

    // Single file - direct download
    if (files.length === 1) {
      const filePath = path.join(convertedDir, files[0])
      
      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: files[0],
        ip: req.clientIP,
        status: "success",
      })

      return res.download(filePath, files[0], (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        setTimeout(() => {
          try {
            if (fs.existsSync(convertedDir)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (cleanupErr) {
            console.log("Cleanup error:", cleanupErr)
          }
        }, 5000)
      })
    }

    // Multiple files - create ZIP
    const zipFilename = `converted-excel-pdfs-${jobId}.zip`
    const zipPath = path.join(__dirname, "downloads", zipFilename)

    if (!fs.existsSync(path.join(__dirname, "downloads"))) {
      fs.mkdirSync(path.join(__dirname, "downloads"), { recursive: true })
    }

    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", { zlib: { level: 9 } })

    await new Promise((resolve, reject) => {
      output.on("close", resolve)
      output.on("error", reject)
      archive.on("error", reject)

      archive.pipe(output)

      files.forEach((file) => {
        const filePath = path.join(convertedDir, file)
        archive.file(filePath, { name: file })
      })

      archive.finalize()
    })

    logActivity({
      type: "download",
      action: "zip_downloaded",
      jobId: jobId,
      fileCount: files.length,
      ip: req.clientIP,
      status: "success",
    })

    res.download(zipPath, zipFilename, (err) => {
      if (err) {
        console.error("Download error:", err)
      }

      setTimeout(() => {
        try {
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath)
          }
          if (fs.existsSync(convertedDir)) {
            // kept so the user can download again — sweepOldFiles() deletes it after 1h
          }
        } catch (cleanupErr) {
          console.log("Cleanup error:", cleanupErr)
        }
      }, 5000)
    })
  } catch (error) {
    console.error("Download Excel PDF Error:", error)
    
    logActivity({
      type: "download",
      action: "download_failed",
      jobId: req.params.jobId,
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download files", details: error.message })
    }
  }
})
  // PNG to WEBP conversion endpoint
  app.post("/api/png-to-webp", upload.array("files", 500), fileSizeLimiter("png-to-webp"), batchLimiter("png-to-webp"), dailyConversionLimiter(), fileValidation, async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      logActivity({
        type: "upload",
        action: "png_uploaded",
        tool: "png-to-webp",
        fileCount: req.files.length,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log(`PNG to WEBP - ${req.files.length} file(s) received`)

      const jobId = genJobId()
      const outputDir = "./uploads"
      const convertedFiles = []
      const failedFiles = []
      const batchStart = Date.now()
      let totalOriginalSize = 0
      let totalCompressedSize = 0

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i]
        totalOriginalSize += file.size

        // Always a real .webp (the old code re-saved PNGs as palette-quantised PNG
        // — and files without a MIME type as JPEG — then named them ".webp").
        const outputFilename = `${jobId}-compressed-${i + 1}.webp`
        const outputPath = path.join(outputDir, outputFilename)

        try {
          // PNG graphics/screenshots/logos (≤ 4 MP) → lossless WebP, pixel-identical.
          // Larger photos → quality 95 (visually identical): lossless on a 12 MP photo
          // took 16–29 s (a 20-file batch would hit nginx's 60 s proxy timeout) vs
          // ~2.6 s, and came out 4–5× bigger. Same once the batch has used 45 s.
          // An already-lossy JPEG source → quality 90. EXIF orientation applied.
          const meta = await sharp(file.path).metadata()
          const px = (meta.width || 0) * (meta.height || 0)
          const lossless = meta.format !== "jpeg" && px <= 4e6 && Date.now() - batchStart < 45000
          await sharp(file.path)
            .rotate()
            .webp(lossless
              ? { lossless: true, effort: 4 }
              : { quality: meta.format === "jpeg" ? 90 : 95, alphaQuality: 100, smartSubsample: true, effort: 4 })
            .toFile(outputPath)

          const stats = fs.statSync(outputPath)
          totalCompressedSize += stats.size

          convertedFiles.push({
            filename: outputFilename,
            originalName: file.originalname,
            originalSize: file.size,
            compressedSize: stats.size,
            savedPercentage: Math.round(((file.size - stats.size) / file.size) * 100),
          })

          console.log(`Converted: ${file.originalname} -> ${outputFilename}`)

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        } catch (compError) {
          console.error(`Error converting ${file.originalname} to WebP:`, compError.message)
          failedFiles.push(file.originalname)
          try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch (_) {}

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        }
      }

      if (convertedFiles.length === 0) {
        logActivity({
          type: "conversion",
          action: "png_to_webp_failed",
          tool: "png-to-webp",
          error: "No files compressed",
          ip: req.clientIP,
          status: "error",
        })
        
        // Unreadable input, not a server fault → 422 with the file names.
        return res.status(422).json({ error: "UNREADABLE_IMAGES", files: failedFiles, message: "No files were converted successfully" })
      }

      const savedPercentage = Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100)

      logActivity({
        type: "conversion",
        action: "png_to_webp_complete",
        tool: "png-to-webp",
        conversionType: "png-to-webp",
        fileCount: convertedFiles.length,
        savedPercentage: savedPercentage,
        ip: req.clientIP,
        status: "success",
      })

      // Save download name meta (original name with .webp extension)
      try {
        fs.writeFileSync(
          path.join(outputDir, `${jobId}-names.json`),
          JSON.stringify(convertedFiles.map(f => ({
            stored: f.filename,
            download: path.basename(f.originalName, path.extname(f.originalName)) + ".webp"
          })))
        )
      } catch (_) {}

      res.json({
        success: true,
        message: `${convertedFiles.length} image(s) converted to WebP successfully`,
        skipped: failedFiles.length ? failedFiles : undefined,
        jobId: jobId,
        fileCount: convertedFiles.length,
        totalSize: totalOriginalSize,
        compressedSize: totalCompressedSize,
        savedPercentage: savedPercentage,
        files: convertedFiles,
      })
    } catch (error) {
      console.error("Compress Image Error:", error)

      if (req.files) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        }
      }

      logActivity({
        type: "conversion",
        action: "png_to_webp_failed",
        tool: "png-to-webp",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })

      res.status(500).json({
        error: "Failed to compress images",
        details: error.message,
      })
    }
  })

  // Download endpoint for PNG to WEBP converted files
  app.get("/api/download-webp-converted/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params
      const uploadDir = "./uploads"

      const files = fs.readdirSync(uploadDir)
      const compressedFiles = files
        .filter((f) => f.startsWith(`${jobId}-compressed-`))
        .sort((a, b) => {
          const numA = Number.parseInt(a.match(/-compressed-(\d+)/)?.[1] || "0")
          const numB = Number.parseInt(b.match(/-compressed-(\d+)/)?.[1] || "0")
          return numA - numB
        })

      if (compressedFiles.length === 0) {
        logActivity({
          type: "download",
          action: "download_failed",
          jobId: jobId,
          error: "No files found",
          ip: req.clientIP,
          status: "error",
        })
        
        return res.status(404).json({ error: "No files found for this job" })
      }

      if (compressedFiles.length === 1) {
        const filePath = path.join(uploadDir, compressedFiles[0])

        // Read meta for original download name
        const metaPath = path.join(uploadDir, `${jobId}-names.json`)
        let downloadName = `converted-image${path.extname(compressedFiles[0])}`
        try {
          if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
            downloadName = meta[0]?.download || downloadName
          }
        } catch (_) {}

        logActivity({
          type: "download",
          action: "file_downloaded",
          jobId: jobId,
          filename: compressedFiles[0],
          ip: req.clientIP,
          status: "success",
        })

        return res.download(filePath, downloadName, (err) => {
          // kept so the user can download again — sweepOldFiles() deletes it after 1h
          // kept so the user can download again — sweepOldFiles() deletes it after 1h
        })
      }

      const zipFilename = `compressed-images-${jobId}.zip`
      const zipPath = path.join(uploadDir, zipFilename)

      const output = fs.createWriteStream(zipPath)
      const archive = archiver("zip", { zlib: { level: 9 } })

      archive.on("error", (err) => {
        throw err
      })

      archive.pipe(output)

      const usedEntries = new Set()
      for (let i = 0; i < compressedFiles.length; i++) {
        const compressedFilePath = path.join(uploadDir, compressedFiles[i])
        if (fs.existsSync(compressedFilePath)) {
          const ext = path.extname(compressedFiles[i])
          // Original names (photo.webp …) instead of "compressed-image-N"
          let entry = `compressed-image-${i + 1}${ext}`
          try {
            const meta = JSON.parse(fs.readFileSync(path.join(uploadDir, `${jobId}-names.json`), "utf8"))
            entry = (meta.find((m) => m.stored === compressedFiles[i]) || {}).download || entry
          } catch (_) {}
          if (usedEntries.has(entry)) entry = entry.replace(/(\.[^.]+)$/, `-${i + 1}$1`)
          usedEntries.add(entry)
          archive.file(compressedFilePath, { name: entry })
        }
      }

      await archive.finalize()

      await new Promise((resolve, reject) => {
        output.on("close", resolve)
        output.on("error", reject)
      })

      logActivity({
        type: "download",
        action: "zip_downloaded",
        jobId: jobId,
        fileCount: compressedFiles.length,
        ip: req.clientIP,
        status: "success",
      })

      res.download(zipPath, `png-to-webp-${compressedFiles.length}-images.zip`, (err) => {
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath)
        }
        for (const compressedFile of compressedFiles) {
          const compressedFilePath = path.join(uploadDir, compressedFile)
          if (fs.existsSync(compressedFilePath)) {
            // kept so the user can download again — sweepOldFiles() deletes it after 1h
          }
        }
      })
    } catch (error) {
      console.error("Download compressed error:", error)
      
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: req.params.jobId,
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // Compress Image endpoint
  app.post("/api/compress-image", upload.array("files", 500), fileSizeLimiter("compress-image"), batchLimiter("compress-image"), dailyConversionLimiter(), fileValidation, async (req, res) => {
    try {
      console.log("Compress Image - " + req.files.length + " file(s) received")

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      logActivity({
        type: "upload",
        action: "images_uploaded",
        tool: "compress-image",
        fileCount: req.files.length,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      const jobId = genJobId()
      const compressedDir = path.join(__dirname, "compressed", jobId)

      if (!fs.existsSync(compressedDir)) {
        fs.mkdirSync(compressedDir, { recursive: true })
      }

      const compressionLevel = req.body.quality || "balanced"
      // Target-size mode: user picked an exact KB target instead of a quality
      // preset (e.g. "under 100KB for a web form upload"). 0/absent disables it
      // and falls back to the preset-based path below.
      const targetSizeKB = parseInt(req.body.targetSizeKB, 10)
      const useTargetSize = Number.isFinite(targetSizeKB) && targetSizeKB > 0

      // ENHANCED COMPRESSION SETTINGS - Up to 90% reduction
      // KEY STRATEGY: PNG is lossless — compressing PNG as PNG gives minimal reduction.
      // Instead, convert PNG/WebP to WebP (lossy) which gives 50-90% smaller files.
      // For JPEG inputs, pick whichever output (WebP or JPEG) is smallest.
      const qualitySettings = {
        maximum: {
          jpeg: { quality: 82, progressive: true, mozjpeg: true, chromaSubsampling: "4:2:0" },
          webp: { quality: 80, effort: 5, smartSubsample: true },
          maxDimension: 4096,
          description: "Maximum Quality",
          expectedReduction: "20-50%",
        },
        balanced: {
          jpeg: { quality: 62, progressive: true, mozjpeg: true, chromaSubsampling: "4:2:0" },
          webp: { quality: 58, effort: 5, smartSubsample: true },
          maxDimension: 3000,
          description: "Balanced",
          expectedReduction: "50-80%",
        },
        light: {
          jpeg: { quality: 78, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" },
          webp: { quality: 76, effort: 3 },
          maxDimension: 4096,
          description: "Light",
          expectedReduction: "20-40%",
        },
      }

      const compressionSettings = qualitySettings[compressionLevel] || qualitySettings.balanced

      // Binary-search compression to land just under a target file size. Tries
      // both WebP and JPEG (for JPEG-without-alpha inputs) at each candidate
      // quality, same trade-off logic as the preset path, so the output format
      // choice stays consistent. Falls back to progressively smaller dimensions
      // if even quality=1 still exceeds the target (tiny target vs. large photo).
      // Output keeps the INPUT format (JPEG→JPEG, PNG→PNG, WebP→WebP). We used
      // to switch to WebP whenever it was smaller — but the "compress to 50 KB /
      // 20 KB" pages exist for govt/job form uploads that only accept JPG/PNG.
      function encodeSameFormat(pipeline, fmt, q) {
        if (fmt === "png") {
          // Palette quantisation (like TinyPNG): 60-80% smaller, stays a PNG.
          const colours = Math.max(8, Math.min(256, Math.round(256 * q / 90)))
          return pipeline.png({ palette: true, quality: Math.max(10, q), colours, effort: 8, compressionLevel: 9 }).toBuffer()
        }
        if (fmt === "webp") return pipeline.webp({ quality: q, effort: 5, smartSubsample: true }).toBuffer()
        return pipeline.jpeg({ quality: q, progressive: true, mozjpeg: true, chromaSubsampling: q >= 75 ? "4:4:4" : "4:2:0" }).toBuffer()
      }

      async function compressToTargetSize(image, metadata, targetBytes, { fmt, ext }) {
        const tryQuality = async (q, dim) => {
          let pipeline = image.clone()
          if (dim && (metadata.width > dim || metadata.height > dim)) {
            pipeline = pipeline.resize(dim, dim, { fit: "inside", withoutEnlargement: true })
          }
          return { buf: await encodeSameFormat(pipeline, fmt, q), ext }
        }

        // Highest quality in [lo, hi] that fits at this size (binary search).
        const searchQuality = async (dim, lo, hi) => {
          let best = null
          for (let i = 0; i < 6 && lo <= hi; i++) {
            const mid = Math.round((lo + hi) / 2)
            const candidate = await tryQuality(mid, dim)
            if (candidate.buf.length <= targetBytes) {
              if (!best || candidate.buf.length > best.buf.length) best = candidate
              lo = mid + 1
            } else {
              hi = mid - 1
            }
          }
          return best
        }

        // Keep the picture CLEAN and make it smaller in pixels instead. The old
        // search pushed JPEG quality down to ~1-5 at full resolution, so a phone
        // photo "compressed to 50 KB" came out as a blocky 2250×3000 mess —
        // forms want a sharp, smaller photo, not a huge blurry one.
        const Q_ANCHOR = 72, QMAX = 92, DIM_MIN = 160
        const fullDim = Math.min(Math.max(metadata.width, metadata.height), compressionSettings.maxDimension || 4096)

        // 1. Fits at full size with good quality? Then just raise quality.
        const atFull = await tryQuality(Q_ANCHOR, fullDim)
        if (atFull.buf.length <= targetBytes) {
          return (await searchQuality(fullDim, Q_ANCHOR + 1, QMAX)) || atFull
        }

        // 2. Largest pixel size that fits at good quality (binary search on size),
        //    then the best quality at that size — uses the target fully instead
        //    of undershooting it.
        let lo = DIM_MIN, hi = fullDim - 1, fitDim = 0, fit = null
        for (let i = 0; i < 9 && lo <= hi; i++) {
          const mid = Math.round((lo + hi) / 2)
          const c = await tryQuality(Q_ANCHOR, mid)
          if (c.buf.length <= targetBytes) { fitDim = mid; fit = c; lo = mid + 1 } else { hi = mid - 1 }
        }
        if (fit) return (await searchQuality(fitDim, Q_ANCHOR + 1, QMAX)) || fit

        // 3. Tiny targets (e.g. 10 KB): accept lower quality at a small size.
        let dim = DIM_MIN
        let best = await searchQuality(dim, 10, Q_ANCHOR - 1)
        while (!best && dim > 48) {
          dim = Math.round(dim * 0.75)
          best = await searchQuality(dim, 10, Q_ANCHOR - 1)
        }
        return best || tryQuality(10, dim)
      }

      const compressedFiles = []
      const tooBigFiles = []
      let totalOriginalSize = 0
      let totalCompressedSize = 0

      for (const file of req.files) {
        totalOriginalSize += file.size

        const baseName = path.basename(file.originalname, path.extname(file.originalname))

        try {
          // .rotate() with no angle = apply the EXIF orientation. sharp strips
          // EXIF on output, so without it every phone photo shot in portrait
          // came back sideways.
          let image = sharp(file.path, { failOn: "none", limitInputPixels: BIG_IMAGE_PIXEL_CAP }).rotate()
          let metadata = await image.metadata()
          // Huge canvases (e.g. a 20000×20000 logo PNG — only a few MB on disk) blew sharp's
          // default 268 MP input limit and the user just got a 500. Shrink them first with a
          // streaming (sequential) read, which keeps memory low, then compress as usual.
          if ((metadata.width || 0) * (metadata.height || 0) > BIG_IMAGE_MAX_PIXELS) {
            const scale = Math.sqrt(BIG_IMAGE_MAX_PIXELS / (metadata.width * metadata.height))
            const shrunk = file.path + "-shrunk"
            await sharp(file.path, { failOn: "none", limitInputPixels: BIG_IMAGE_PIXEL_CAP, sequentialRead: true })
              .rotate()
              .resize(Math.max(1, Math.floor(metadata.width * scale)), Math.max(1, Math.floor(metadata.height * scale)), { fit: "inside" })
              .toFormat(metadata.format === "jpeg" ? "jpeg" : "png", metadata.format === "jpeg" ? { quality: 95 } : { compressionLevel: 1 })
              .toFile(shrunk)
            fs.renameSync(shrunk, file.path)
            image = sharp(file.path, { failOn: "none" })
            metadata = await image.metadata()
          }
          const fmt = ["jpeg", "png", "webp"].includes(metadata.format) ? metadata.format : (metadata.hasAlpha ? "png" : "jpeg")
          const sameExt = { jpeg: ".jpg", png: ".png", webp: ".webp" }[fmt]
          const origExt = path.extname(file.originalname).toLowerCase() || sameExt
          const keepExt = fmt === "jpeg" && /^\.jpe?g$/.test(origExt) ? origExt : sameExt

          let outputBuf, outputExt

          if (useTargetSize) {
            const targetBytes = targetSizeKB * 1024
            if (file.size <= targetBytes) {
              // Already under the target — don't degrade it.
              outputBuf = fs.readFileSync(file.path); outputExt = origExt
            } else {
              const result = await compressToTargetSize(image, metadata, targetBytes, { fmt, ext: keepExt })
              outputBuf = result.buf
              outputExt = result.ext
            }
          } else {
            // Resize very large images — this alone cuts 60-80% for high-res photos
            let pipeline = image
            const maxDimension = compressionSettings.maxDimension || 4096
            if (metadata.width > maxDimension || metadata.height > maxDimension) {
              pipeline = pipeline.resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
            }
            const q = fmt === "webp" ? compressionSettings.webp.quality : compressionSettings.jpeg.quality
            outputBuf = await encodeSameFormat(pipeline.clone(), fmt, q)
            outputExt = keepExt
            if (fmt === "png") {
              // Flat UI screenshots often shrink MORE with lossless max-compression
              // than with a palette — and lose nothing. Keep whichever is smaller.
              const lossless = await pipeline.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
              if (lossless.length < outputBuf.length) outputBuf = lossless
            }

            // Never hand back a bigger file (already-optimised inputs).
            if (outputBuf.length >= file.size) {
              outputBuf = fs.readFileSync(file.path); outputExt = origExt
            }
          }

          const outputFilename = `${Date.now()}-compressed-${baseName}${outputExt}`
          const outputPath = path.join(compressedDir, outputFilename)
          fs.writeFileSync(outputPath, outputBuf)

          const stats = fs.statSync(outputPath)
          totalCompressedSize += stats.size

          const savedBytes = file.size - stats.size
          const savedPct = Math.round((savedBytes / file.size) * 100)

          compressedFiles.push({
            filename: outputFilename,
            originalName: file.originalname,
            originalSize: file.size,
            compressedSize: stats.size,
            savedPercentage: savedPct,
          })

          console.log(`Compressed: ${file.originalname} -> ${outputFilename} (saved ${savedPct}%)`)

          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path)
            }
          } catch (unlinkErr) {
            console.log(`Warning: Could not delete ${file.path}, will retry later`)
            setTimeout(() => {
              try {
                if (fs.existsSync(file.path)) {
                  fs.unlinkSync(file.path)
                }
              } catch (e) {
                console.log(`Still locked: ${file.path}`)
              }
            }, 5000)
          }
        } catch (compError) {
          console.error(`Error compressing ${file.originalname}:`, compError)
          if (/pixel limit/i.test(compError.message || "")) tooBigFiles.push(file.originalname)
          // Record WHY (the 500s only ever said "No files compressed").
          logActivity({ type: "conversion", action: "compress_image_file_failed", tool: "compress-image",
            filename: file.originalname, fileSize: file.size, error: compError.message, ip: req.clientIP, status: "error" })

          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path)
            }
          } catch (cleanupErr) {
            console.log(`Warning: Could not delete ${file.path} after error`)
          }
        }
      }

      if (compressedFiles.length === 0) {
        logActivity({
          type: "conversion",
          action: "compress_image_failed",
          tool: "compress-image",
          error: "No files compressed",
          ip: req.clientIP,
          status: "error",
        })
        
        if (tooBigFiles.length === req.files.length) {
          return res.status(422).json({ error: "This image is too large to process (over 1,000 megapixels). Please resize it to a smaller width/height and try again.", code: "IMAGE_TOO_LARGE" })
        }
        return res.status(500).json({ error: "No files were compressed successfully" })
      }

      const savedPercentage = Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100)

      logActivity({
        type: "conversion",
        action: "compress_image_complete",
        tool: "compress-image",
        conversionType: "compress-image",
        fileCount: compressedFiles.length,
        savedPercentage: savedPercentage,
        ip: req.clientIP,
        status: "success",
      })

      res.json({
        success: true,
        message: `${compressedFiles.length} image(s) compressed successfully`,
        jobId: jobId,
        fileCount: compressedFiles.length,
        totalOriginalSize: totalOriginalSize,
        totalCompressedSize: totalCompressedSize,
        compressedSize: totalCompressedSize,
        savedPercentage: savedPercentage,
        targetSizeKB: useTargetSize ? targetSizeKB : null,
        files: compressedFiles,
      })
    } catch (error) {
      console.error("Compress Image Error:", error)

      if (req.files) {
        for (const file of req.files) {
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path)
            }
          } catch (cleanupErr) {
            console.log(`Warning: Could not delete ${file.path}`)
          }
        }
      }

      logActivity({
        type: "conversion",
        action: "compress_image_failed",
        tool: "compress-image",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })

      res.status(500).json({
        error: "Failed to compress images",
        details: error.message,
      })
    }
  })

  app.get("/api/download-compressed/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params
      const compressedDir = path.join(__dirname, "compressed", jobId)

      if (!fs.existsSync(compressedDir)) {
        logActivity({
          type: "download",
          action: "download_failed",
          jobId: jobId,
          error: "Files not found or expired",
          ip: req.clientIP,
          status: "warning",
        })
        
        return res.status(404).json({ error: "Files not found or expired" })
      }

      // ".meta.json" (compress-pdf's size summary) is not a download.
      const files = fs.readdirSync(compressedDir).filter((f) => !f.startsWith("."))

      if (files.length === 0) {
        return res.status(404).json({ error: "No compressed files available" })
      }

      if (files.length === 1) {
        const filePath = path.join(compressedDir, files[0])
        const originalName = files[0].replace(/^\d+-compressed-/, "")

        logActivity({
          type: "download",
          action: "file_downloaded",
          jobId: jobId,
          filename: originalName,
          ip: req.clientIP,
          status: "success",
        })

        res.download(filePath, originalName, (err) => {
          if (err) {
            console.error("Download error:", err)
            if (!res.headersSent) {
              res.status(500).json({ error: "Download failed" })
            }
          }

          setTimeout(() => {
            try {
              if (fs.existsSync(compressedDir)) {
                // kept so the user can download again — sweepOldFiles() deletes it after 1h
              }
            } catch (cleanupErr) {
              console.log("Cleanup error:", cleanupErr)
            }
          }, 5000)
        })
        return
      }

      const zipFilename = `compressed-images-${jobId}.zip`
      const zipPath = path.join(__dirname, "downloads", zipFilename)

      if (!fs.existsSync(path.join(__dirname, "downloads"))) {
        fs.mkdirSync(path.join(__dirname, "downloads"), { recursive: true })
      }

      const output = fs.createWriteStream(zipPath)
      const archive = archiver("zip", { zlib: { level: 9 } })

      await new Promise((resolve, reject) => {
        output.on("close", resolve)
        output.on("error", reject)
        archive.on("error", reject)

        archive.pipe(output)

        files.forEach((file) => {
          const filePath = path.join(compressedDir, file)
          const originalName = file.replace(/^\d+-compressed-/, "")
          archive.file(filePath, { name: originalName })
        })

        archive.finalize()
      })

      logActivity({
        type: "download",
        action: "zip_downloaded",
        jobId: jobId,
        fileCount: files.length,
        ip: req.clientIP,
        status: "success",
      })

      res.download(zipPath, zipFilename, (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        setTimeout(() => {
          try {
            if (fs.existsSync(zipPath)) {
              fs.unlinkSync(zipPath)
            }
            if (fs.existsSync(compressedDir)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (cleanupErr) {
            console.log("Cleanup error:", cleanupErr)
          }
        }, 5000)
      })
    } catch (error) {
      console.error("Download Compressed Error:", error)
      
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: req.params.jobId,
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download files", details: error.message })
      }
    }
  })

  app.get("/api/download-word-pdf/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params
      const convertedDir = path.join(__dirname, "converted", jobId)

      if (!fs.existsSync(convertedDir)) {
        logActivity({
          type: "download",
          action: "download_failed",
          jobId: jobId,
          error: "Files not found or expired",
          ip: req.clientIP,
          status: "warning",
        })
        
        return res.status(404).json({ error: "Files not found or expired" })
      }

      const files = fs.readdirSync(convertedDir)

      if (files.length === 0) {
        return res.status(404).json({ error: "No converted files available" })
      }

      if (files.length === 1) {
        const filePath = path.join(convertedDir, files[0])

        logActivity({
          type: "download",
          action: "file_downloaded",
          jobId: jobId,
          filename: files[0],
          ip: req.clientIP,
          status: "success",
        })

        // Strip multer's prefix ("1699999-<12 hex>-report.pdf" → "report.pdf";
        // older uploads had no hex part)
        const cleanName = files[0].replace(/^\d+-(?:[0-9a-f]{12}-)?/, "")
        res.download(filePath, cleanName, (err) => {
          if (err) {
            console.error("Download error:", err)
            if (!res.headersSent) {
              res.status(500).json({ error: "Download failed" })
            }
          }

          setTimeout(() => {
            try {
              if (fs.existsSync(convertedDir)) {
                // kept so the user can download again — sweepOldFiles() deletes it after 1h
              }
            } catch (cleanupErr) {
              console.log("Cleanup error:", cleanupErr)
            }
          }, 5000)
        })
        return
      }

      const zipFilename = `converted-pdfs-${jobId}.zip`
      const zipPath = path.join(__dirname, "downloads", zipFilename)

      if (!fs.existsSync(path.join(__dirname, "downloads"))) {
        fs.mkdirSync(path.join(__dirname, "downloads"), { recursive: true })
      }

      const output = fs.createWriteStream(zipPath)
      const archive = archiver("zip", { zlib: { level: 9 } })

      await new Promise((resolve, reject) => {
        output.on("close", resolve)
        output.on("error", reject)
        archive.on("error", reject)

        archive.pipe(output)

        files.forEach((file) => {
          const filePath = path.join(convertedDir, file)
          archive.file(filePath, { name: file })
        })

        archive.finalize()
      })

      logActivity({
        type: "download",
        action: "zip_downloaded",
        jobId: jobId,
        fileCount: files.length,
        ip: req.clientIP,
        status: "success",
      })

      res.download(zipPath, zipFilename, (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        setTimeout(() => {
          try {
            if (fs.existsSync(zipPath)) {
              fs.unlinkSync(zipPath)
            }
            if (fs.existsSync(convertedDir)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (cleanupErr) {
            console.log("Cleanup error:", cleanupErr)
          }
        }, 5000)
      })
    } catch (error) {
      console.error("Download Word PDF Error:", error)
      
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: req.params.jobId,
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download files", details: error.message })
      }
    }
  })

  app.post("/api/merge-pdf", upload.array("files", 500), fileSizeLimiter("merge-pdf"), batchLimiter("merge-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
    try {
      if (!req.files || req.files.length < 2) {
        return res.status(400).json({ error: "At least 2 PDF files required for merging" })
      }

      logActivity({
        type: "upload",
        action: "pdfs_uploaded",
        tool: "merge-pdf",
        fileCount: req.files.length,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log(`Merge PDF - ${req.files.length} files received`)

      const mergedPdf = await PDFLibDocument.create()

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i]
        console.log(`Processing file ${i + 1}/${req.files.length}: ${file.originalname}`)

        // pdf-lib is lenient on load, so a damaged file can "load" and then blow
        // up in copyPages — touching the page tree here surfaces that early.
        const loadPdf = async (p) => { const d = await PDFLibDocument.load(fs.readFileSync(p)); d.getPages(); return d }
        let pdf
        try {
          pdf = await loadPdf(file.path)
        } catch (loadErr) {
          // Encrypted (e-tickets, bank/utility bills often carry a permissions-
          // only lock) or damaged. pdf-lib can't decrypt, and `ignoreEncryption`
          // just copies still-encrypted streams — so let qpdf rewrite the file:
          // --decrypt removes permissions-only encryption (no password needed)
          // and qpdf's rewrite also repairs broken xref tables.
          const fixed = file.path + ".fixed.pdf"
          try {
            await util.promisify(require("child_process").execFile)("qpdf", ["--decrypt", file.path, fixed], { timeout: 90000 })
          } catch (_) { /* exit 3 = warnings, output still written */ }
          if (fs.existsSync(fixed) && fs.statSync(fixed).size > 0) {
            try { pdf = await loadPdf(fixed) } catch (_) {}
          }
          await safeUnlink(fixed)
          if (!pdf) {
            const needsPassword = /encrypt/i.test(loadErr.message)
            const err = new Error(needsPassword
              ? `"${file.originalname}" is protected with an open password. Remove it with our Unlock PDF tool first, then merge again.`
              : `Could not read "${file.originalname}". The file may be damaged — try re-saving or re-downloading it.`)
            err.code = needsPassword ? "PASSWORD_PROTECTED" : "CORRUPT_PDF"
            err.fileName = file.originalname
            throw err
          }
          console.log(`Decrypted/repaired with qpdf: ${file.originalname}`)
        }
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        pages.forEach((page) => {
          mergedPdf.addPage(page)
        })
        console.log(`Added ${pages.length} pages from ${file.originalname}`)
      }

      const mergedPdfBytes = await mergedPdf.save()
      // Unguessable: uploads/ is public — "merged-<ms>.pdf" could be enumerated by timestamp.
      const outputFilename = `merged-${genJobId()}.pdf`
      const outputPath = path.join("./uploads", outputFilename)

      fs.writeFileSync(outputPath, mergedPdfBytes)

      console.log(`Merged PDF created: ${outputFilename}`)

      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }

      const totalPages = mergedPdf.getPageCount()

      logActivity({
        type: "conversion",
        action: "merge_pdf_complete",
        tool: "merge-pdf",
        conversionType: "merge-pdf",
        fileCount: req.files.length,
        pageCount: totalPages,
        ip: req.clientIP,
        status: "success",
      })

      // Attach to the user's "My Files" history when logged in (optionalAuth).
      if (req.user) {
        await recordUserFile({
          userId: req.user.id,
          plan: req.user.plan,
          tool: "merge-pdf",
          originalName: outputFilename,
          storedPath: path.resolve(outputPath),
          downloadUrl: `/uploads/${outputFilename}`,
          fileSize: mergedPdfBytes.length,
        })
      }

      res.json({
        success: true,
        message: `${req.files.length} PDF files merged successfully`,
        downloadUrl: `/uploads/${outputFilename}`,
        convertedName: outputFilename,
        pageCount: totalPages,
        fileCount: req.files.length,
      })
    } catch (error) {
      console.error("Merge PDF Error:", error)

      if (req.files) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        }
      }

      logActivity({
        type: "conversion",
        action: "merge_pdf_failed",
        tool: "merge-pdf",
        error: error.message,
        ip: req.clientIP,
        status: error.code ? "warning" : "error",
      })

      // Input problems (password / damaged file) are 422 with a readable message.
      res.status(error.code ? 422 : 500).json({ error: error.code || "MERGE_FAILED", message: error.message, fileName: error.fileName })
    }
  })


  // ── Rotate PDF ──────────────────────────────────────────────────────────────
  // Rotates pages by a multiple of 90°. Rotation is ADDITIVE to any rotation the
  // page already has. Optional `pages` (JSON array of 1-based page numbers) limits
  // which pages are rotated; omitted/empty = all pages.
  app.post("/api/rotate-pdf", upload.single("file"), fileSizeLimiter("rotate-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" })
      }

      const { degrees, PDFName } = require("pdf-lib")

      // Normalise requested angle to one of 0/90/180/270.
      let angle = parseInt(req.body.angle, 10)
      if (isNaN(angle)) angle = 90
      const delta = ((angle % 360) + 360) % 360
      if (delta % 90 !== 0) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(400).json({ error: "INVALID_ANGLE", message: "Rotation must be a multiple of 90 degrees." })
      }

      // Optional subset of pages (1-based).
      let targetPages = null
      if (req.body.pages) {
        try {
          const parsed = JSON.parse(req.body.pages)
          if (Array.isArray(parsed) && parsed.length) targetPages = parsed.map(Number)
        } catch (_) { /* ignore — rotate all */ }
      }

      logActivity({
        type: "upload",
        action: "pdf_uploaded_for_rotate",
        tool: "rotate-pdf",
        filename: req.file.originalname,
        fileSize: req.file.size,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      const pdf = await loadPdfForEditing(req.file.path, req.file.originalname)

      const pages = pdf.getPages()
      pages.forEach((page, idx) => {
        if (targetPages && !targetPages.includes(idx + 1)) return
        // /Rotate may be inherited from the page tree; reading only the page's own
        // value dropped an inherited 90° (rotating such a page gave 90°, not 180°).
        const inh = page.node.getInheritableAttribute(PDFName.of("Rotate"))
        const current = inh && typeof inh.asNumber === "function" ? inh.asNumber() : (page.getRotation().angle || 0)
        page.setRotation(degrees((((current + delta) % 360) + 360) % 360))
      })

      const outBytes = await pdf.save()
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
      const outputFilename = `rotated-${baseName}.pdf`
      // Unique stored name: the bare "rotated-<name>.pdf" was shared by every user
      // rotating a same-named file (e.g. scan.pdf), so one could download the
      // other's document. The page names the download from convertedName.
      const storedFilename = `${genJobId()}-${outputFilename}`
      const outputPath = path.join("./uploads", storedFilename)
      fs.writeFileSync(outputPath, outBytes)

      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)

      // Attach to the user's "My Files" history when logged in (optionalAuth).
      if (req.user) {
        await recordUserFile({
          userId: req.user.id,
          plan: req.user.plan,
          tool: "rotate-pdf",
          originalName: outputFilename,
          storedPath: path.resolve(outputPath),
          downloadUrl: `/uploads/${storedFilename}`,
          fileSize: outBytes.length,
        })
      }

      logActivity({
        type: "conversion",
        action: "rotate_pdf_complete",
        tool: "rotate-pdf",
        conversionType: "rotate-pdf",
        pageCount: pages.length,
        ip: req.clientIP,
        status: "success",
      })

      res.json({
        success: true,
        message: "PDF rotated successfully",
        downloadUrl: `/uploads/${storedFilename}`,
        convertedName: outputFilename,
        pageCount: pages.length,
        angle: delta,
      })
    } catch (error) {
      console.error("Rotate PDF Error:", error)
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path) } catch (_) {}
      }
      logActivity({
        type: "conversion",
        action: "rotate_pdf_failed",
        tool: "rotate-pdf",
        error: error.message,
        ip: req.clientIP,
        status: error.code ? "warning" : "error",
      })
      if (error.code) return res.status(422).json({ error: error.code, message: error.message, fileName: error.fileName })
      res.status(500).json({ error: error.message })
    }
  })


  // ── Redact PDF ───────────────────────────────────────────────────────────
  // TRUE redaction: pages with redaction boxes are rasterized to an image and
  // the boxes are burned onto the pixels — the underlying text is gone, not
  // just covered, so it cannot be recovered by copy-paste or a PDF editor.
  // Pages with no boxes are copied through as vector (unchanged, still
  // searchable/selectable). `boxes` coordinates arrive in the CSS-pixel space
  // of the canvas the frontend rendered that page at (canvasWidth/canvasHeight
  // per box) — we rescale to the actual rasterized PNG's pixel size below.
  app.post("/api/redact-pdf", upload.single("file"), fileSizeLimiter("redact-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" })
      }

      let boxes = []
      try {
        boxes = JSON.parse(req.body.boxes || "[]")
        if (!Array.isArray(boxes)) boxes = []
      } catch (_) {
        boxes = []
      }

      logActivity({
        type: "upload",
        action: "pdf_uploaded_for_redact",
        tool: "redact-pdf",
        filename: req.file.originalname,
        fileSize: req.file.size,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      if (boxes.length === 0) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(400).json({ error: "No redaction areas were selected." })
      }

      const inputPath = req.file.path
      const pdfBytes = fs.readFileSync(inputPath)

      let srcDoc
      try {
        srcDoc = await PDFLibDocument.load(pdfBytes, { ignoreEncryption: true })
      } catch (e) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        return res.status(400).json({ error: "Could not read the PDF. It may be corrupted or password-protected." })
      }

      const pageCount = srcDoc.getPageCount()

      // Group boxes by page (1-based page numbers from the frontend).
      const boxesByPage = {}
      for (const b of boxes) {
        const p = parseInt(b.page, 10)
        if (!p || p < 1 || p > pageCount) continue
        if (!boxesByPage[p]) boxesByPage[p] = []
        boxesByPage[p].push(b)
      }

      const gsPath = getGhostscriptPath()
      const jobId = genJobId()
      const outputDir = path.dirname(inputPath)
      const REDACT_DPI = 200

      const outDoc = await PDFLibDocument.create()

      // Text layer for redacted (rasterised) pages — see the OCR step below.
      const REDACT_OCR_MAX_PAGES = 30
      const REDACT_OCR_BUDGET_MS = 90 * 1000
      const ocrStart = Date.now()
      let ocrWorker = null
      let ocrFont = null
      let ocrPages = 0

      try {
      for (let i = 0; i < pageCount; i++) {
        const pageNum = i + 1
        const pageBoxes = boxesByPage[pageNum]

        if (!pageBoxes || pageBoxes.length === 0) {
          // No redactions on this page — copy through unchanged (stays vector/searchable).
          const [copied] = await outDoc.copyPages(srcDoc, [i])
          outDoc.addPage(copied)
          continue
        }

        // Rasterize ONLY this page at high DPI (lower for poster-sized pages).
        const disp = displaySize(srcDoc.getPage(i))
        const dpi = safeRenderDpi(disp.width, disp.height, REDACT_DPI)
        const rasterPath = path.join(outputDir, `${jobId}-redact-${pageNum}.png`)
        const gsCommand = `"${gsPath}" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r${dpi} -dFirstPage=${pageNum} -dLastPage=${pageNum} -sOutputFile="${rasterPath}" "${inputPath}"`
        await execPromise(gsCommand, { timeout: 60000, maxBuffer: 50 * 1024 * 1024 })

        if (!fs.existsSync(rasterPath)) {
          throw new Error(`Failed to rasterize page ${pageNum} for redaction.`)
        }

        const rasterMeta = await sharp(rasterPath).metadata()
        const pngW = rasterMeta.width
        const pngH = rasterMeta.height

        // Burn each box onto the raster as an opaque black rectangle via an SVG overlay.
        const rects = pageBoxes.map((b) => {
          const cw = Number(b.canvasWidth)  || pngW
          const ch = Number(b.canvasHeight) || pngH
          const scaleX = pngW / cw
          const scaleY = pngH / ch
          const rx = Math.max(0, Number(b.x) * scaleX)
          const ry = Math.max(0, Number(b.y) * scaleY)
          const rw = Math.min(pngW - rx, Math.max(1, Number(b.width) * scaleX))
          const rh = Math.min(pngH - ry, Math.max(1, Number(b.height) * scaleY))
          return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="black"/>`
        }).join("")
        const svgOverlay = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${pngW}" height="${pngH}">${rects}</svg>`
        )

        const burnedBuffer = await sharp(rasterPath)
          .composite([{ input: svgOverlay, top: 0, left: 0 }])
          .png()
          .toBuffer()

        try { fs.unlinkSync(rasterPath) } catch (_) {}

        // Embed the burned raster as a full page matching the original page's
        // DISPLAYED size. Ghostscript renders /Rotate'd pages already turned, so
        // a 90°/270° page must swap width/height or the image comes out squashed.
        const { width: pw, height: ph } = disp
        const embeddedPng = await outDoc.embedPng(burnedBuffer)
        const newPage = outDoc.addPage([pw, ph])
        newPage.drawImage(embeddedPng, { x: 0, y: 0, width: pw, height: ph })

        // The rasterised page lost its text layer — OCR the BURNED image and
        // add the remaining text back invisibly so it stays searchable and
        // copyable. The redacted areas are already black pixels, so nothing
        // under a box can come back. Capped so huge jobs don't time out.
        if (ocrPages < REDACT_OCR_MAX_PAGES && Date.now() - ocrStart < REDACT_OCR_BUDGET_MS) {
          try {
            if (!ocrWorker) {
              ocrWorker = await createWorker("eng")
              await ocrWorker.setParameters({ tessedit_pageseg_mode: "3" })
              ocrFont = await outDoc.embedFont(StandardFonts.Helvetica)
            }
            const { data } = await ocrWorker.recognize(burnedBuffer, {}, { blocks: true, text: true })
            const words = ocrWordsFromData(data, pw / pngW)
            if (words.length) drawInvisibleWords(newPage, ocrFont, words)
            ocrPages++
          } catch (ocrErr) {
            console.warn(`[redact] OCR skipped on page ${pageNum}: ${ocrErr.message}`)
          }
        }
      }
      } finally {
        if (ocrWorker) await ocrWorker.terminate().catch(() => {})
      }

      const outBytes = await outDoc.save()
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
      const outputFilename = `redacted-${baseName}.pdf`
      const outputPath = path.join("./uploads", outputFilename)
      fs.writeFileSync(outputPath, outBytes)

      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)

      if (req.user) {
        await recordUserFile({
          userId: req.user.id,
          plan: req.user.plan,
          tool: "redact-pdf",
          originalName: outputFilename,
          storedPath: path.resolve(outputPath),
          downloadUrl: `/uploads/${outputFilename}`,
          fileSize: outBytes.length,
        })
      }

      logActivity({
        type: "conversion",
        action: "redact_pdf_complete",
        tool: "redact-pdf",
        conversionType: "redact-pdf",
        pageCount,
        ip: req.clientIP,
        status: "success",
      })

      res.json({
        success: true,
        message: "PDF redacted successfully",
        downloadUrl: `/uploads/${outputFilename}`,
        convertedName: outputFilename,
        pageCount,
        redactedPages: Object.keys(boxesByPage).length,
      })
    } catch (error) {
      console.error("Redact PDF Error:", error)
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path) } catch (_) {}
      }
      logActivity({
        type: "conversion",
        action: "redact_pdf_failed",
        tool: "redact-pdf",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      res.status(500).json({ error: error.message })
    }
  })


  // ── Edit PDF ────────────────────────────────────────────────────────────────
  // Real inline text editing. The client (pages/edit-pdf/preview.js) detects every
  // text line with PDF.js and sends up only the lines the user actually changed,
  // each carrying its original bounding box + baseline in render-pixel space.
  //
  // For every changed line we:
  //   1. delete the glyph-showing operators for that line from the page's content
  //      stream, so the old text is genuinely gone — not merely covered. (Covering
  //      it with a white box leaves it copy/searchable, which for an invoice or a
  //      contract is worse than useless.)
  //   2. redraw the new string as real vector text on the same baseline.
  // Pages the user never touched are left byte-for-byte alone.
  //
  // If the stream surgery can't reach a line (text living inside a Form XObject,
  // an unusual encoding, a scanned page) we fall back to painting an opaque white
  // rectangle over it, which is at least visually correct.
  //
  // The 14 standard PDF fonts only encode WinAnsi. If an edit needs characters
  // they can't represent (CJK, Devanagari, emoji, …) that page falls back to the
  // rasterise + SVG-burn path, which can render anything.
  app.post("/api/edit-pdf", upload.single("file"), fileSizeLimiter("edit-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" })
      const zlib = require("zlib")
      const {
        StandardFonts, rgb, PDFName, PDFArray, PDFRawStream, PDFDict, PDFNumber, PDFRef,
        decodePDFRawStream,
      } = require("pdf-lib")

      let edits = []
      try { edits = JSON.parse(req.body.edits || "[]"); if (!Array.isArray(edits)) edits = [] } catch (_) { edits = [] }

      logActivity({ type: "upload", action: "pdf_uploaded_for_edit", tool: "edit-pdf", filename: req.file.originalname, fileSize: req.file.size, ip: req.clientIP, userAgent: req.headers["user-agent"], status: "processing" })

      const inputPath = req.file.path
      if (edits.length === 0) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        return res.status(400).json({ error: "No edits were made." })
      }

      // Encrypted files: qpdf-decrypt first (ignoreEncryption:true produced a
      // corrupt "edited" file); open-password / damaged → coded 422.
      const srcDoc = await loadPdfForEditing(inputPath, req.file.originalname)

      const pageCount = srcDoc.getPageCount()
      const editsByPage = {}
      for (const e of edits) {
        const p = parseInt(e.page, 10)
        if (!p || p < 1 || p > pageCount) continue
        if (!editsByPage[p]) editsByPage[p] = []
        editsByPage[p].push(e)
      }
      if (Object.keys(editsByPage).length === 0) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        return res.status(400).json({ error: "No valid edits were provided." })
      }

      // Rotated pages (/Rotate 90/180/270, e.g. landscape scans): the editor sends
      // coordinates in the DISPLAYED orientation, but everything below works in the
      // page's unrotated space — added text landed in the wrong place/orientation.
      // Re-create such a page upright (original drawn as an embedded page, turned
      // to match what the user saw) so the displayed and page spaces are the same.
      // Its original text can then only be covered, not removed (it now lives in a
      // form XObject), and link annotations on that page are not carried over.
      {
        const { degrees: pdfDegrees, PDFName: PN } = require("pdf-lib")
        for (const pStr of Object.keys(editsByPage)) {
          const idx = parseInt(pStr, 10) - 1
          const page = srcDoc.getPage(idx)
          const inh = page.node.getInheritableAttribute(PN.of("Rotate"))
          const r = ((((inh && typeof inh.asNumber === "function" ? inh.asNumber() : 0) % 360) + 360) % 360)
          if (!r || r % 90) continue
          const { width: w0, height: h0 } = page.getSize()
          const emb = await srcDoc.embedPage(page)
          const upright = srcDoc.insertPage(idx, r % 180 ? [h0, w0] : [w0, h0])
          const place = r === 90 ? { x: 0, y: w0, rotate: pdfDegrees(-90) }
            : r === 180 ? { x: w0, y: h0, rotate: pdfDegrees(180) }
            : { x: h0, y: 0, rotate: pdfDegrees(90) }
          upright.drawPage(emb, { ...place, width: w0, height: h0 })
          srcDoc.removePage(idx + 1)
        }
      }

      const hexToRgb = (hex) => {
        const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || "").trim())
        if (!m) return rgb(0, 0, 0)
        const n = parseInt(m[1], 16)
        return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
      }

      const embedFonts = async (doc) => ({
        sans: await doc.embedFont(StandardFonts.Helvetica),
        sansB: await doc.embedFont(StandardFonts.HelveticaBold),
        sansI: await doc.embedFont(StandardFonts.HelveticaOblique),
        sansBI: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
        serif: await doc.embedFont(StandardFonts.TimesRoman),
        serifB: await doc.embedFont(StandardFonts.TimesRomanBold),
        serifI: await doc.embedFont(StandardFonts.TimesRomanItalic),
        serifBI: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
        mono: await doc.embedFont(StandardFonts.Courier),
        monoB: await doc.embedFont(StandardFonts.CourierBold),
        monoI: await doc.embedFont(StandardFonts.CourierOblique),
        monoBI: await doc.embedFont(StandardFonts.CourierBoldOblique),
      })

      // Mirrors cssFontStack() in pages/edit-pdf/preview.js so the WYSIWYG
      // preview and the rendered output agree.
      const familyOf = (e) => {
        const f = String(e.fontFamily || "").toLowerCase()
        if (/mono|courier|consol/.test(f)) return "mono"
        if (/sans/.test(f)) return "sans"
        if (/times|georgia|garamond|serif|roman|minion|book|cambria/.test(f)) return "serif"
        return "sans"
      }
      const pickFont = (fonts, e) => {
        const suffix = e.bold && e.italic ? "BI" : e.bold ? "B" : e.italic ? "I" : ""
        return fonts[familyOf(e) + suffix] || fonts.sans
      }
      const encodable = (font, text) => {
        try { font.widthOfTextAtSize(String(text || ""), 12); return true } catch (_) { return false }
      }

      // ── Content-stream tokenizer + text remover ───────────────────────────
      const CS_WS = new Set([" ", "\n", "\r", "\t", "\f", "\0"])
      const csIsWS = (c) => CS_WS.has(c)
      const csIsDelim = (c) => "()<>[]{}/%".includes(c)

      function* csTokens(s) {
        let i = 0
        const n = s.length
        while (i < n) {
          const start = i
          const c = s[i]
          if (csIsWS(c)) { while (i < n && csIsWS(s[i])) i++; yield { t: "ws", raw: s.slice(start, i) }; continue }
          if (c === "%") { while (i < n && s[i] !== "\n" && s[i] !== "\r") i++; yield { t: "ws", raw: s.slice(start, i) }; continue }
          if (c === "(") {
            i++
            let depth = 1
            while (i < n && depth > 0) {
              if (s[i] === "\\") { i += 2; continue }
              if (s[i] === "(") depth++
              else if (s[i] === ")") depth--
              i++
            }
            yield { t: "str", raw: s.slice(start, i) }; continue
          }
          if (c === "<" && s[i + 1] === "<") { i += 2; yield { t: "other", raw: "<<" }; continue }
          if (c === ">" && s[i + 1] === ">") { i += 2; yield { t: "other", raw: ">>" }; continue }
          if (c === "<") { while (i < n && s[i] !== ">") i++; i++; yield { t: "str", raw: s.slice(start, i) }; continue }
          if (c === "[") { i++; yield { t: "other", raw: "[" }; continue }
          if (c === "]") { i++; yield { t: "other", raw: "]" }; continue }
          if (c === "/") { i++; while (i < n && !csIsWS(s[i]) && !csIsDelim(s[i])) i++; yield { t: "other", raw: s.slice(start, i) }; continue }
          if (/[-+.\d]/.test(c)) {
            i++
            while (i < n && /[-+.\deE]/.test(s[i])) i++
            const raw = s.slice(start, i)
            const v = parseFloat(raw)
            yield { t: "num", raw, v: Number.isFinite(v) ? v : 0 }; continue
          }
          i++
          while (i < n && !csIsWS(s[i]) && !csIsDelim(s[i])) i++
          yield { t: "op", raw: s.slice(start, i) }
        }
      }

      const matMul = (a, b) => [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
      ]
      const SHOW_OPS = new Set(["Tj", "TJ", "'", '"'])

      // Drops the glyph-showing operators whose text origin lands inside one of
      // `boxes`. Dropping Tj only affects the text matrix, never the line matrix,
      // so following lines (positioned with T*/Td/Tm) stay exactly where they were.
      const stripTextInBoxes = (src, boxes) => {
        let out = ""
        let pending = ""
        let nums = []
        let ctm = [1, 0, 0, 1, 0, 0]
        const stack = []
        let tm = [1, 0, 0, 1, 0, 0]
        let tlm = [1, 0, 0, 1, 0, 0]
        let leading = 0
        const dropped = new Map()

        for (const tk of csTokens(src)) {
          if (tk.t !== "op") {
            pending += tk.raw
            if (tk.t === "num") nums.push(tk.v)
            continue
          }
          const op = tk.raw
          let drop = false

          switch (op) {
            case "q": stack.push(ctm.slice()); break
            case "Q": if (stack.length) ctm = stack.pop(); break
            case "cm": if (nums.length >= 6) ctm = matMul(nums.slice(-6), ctm); break
            case "BT": tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); break
            case "Tm": if (nums.length >= 6) { tlm = nums.slice(-6); tm = tlm.slice() } break
            case "Td": if (nums.length >= 2) { tlm = matMul([1, 0, 0, 1, nums[nums.length - 2], nums[nums.length - 1]], tlm); tm = tlm.slice() } break
            case "TD": if (nums.length >= 2) { leading = -nums[nums.length - 1]; tlm = matMul([1, 0, 0, 1, nums[nums.length - 2], nums[nums.length - 1]], tlm); tm = tlm.slice() } break
            case "T*": tlm = matMul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm.slice(); break
            case "TL": if (nums.length) leading = nums[nums.length - 1]; break
            default: break
          }

          if (SHOW_OPS.has(op)) {
            if (op === "'" || op === '"') { tlm = matMul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm.slice() }
            const m = matMul(tm, ctm)
            const x = m[4], y = m[5]
            for (const b of boxes) {
              if (x >= b.x0 - 2 && x <= b.x1 + 2 && Math.abs(y - b.yBase) <= b.yTol) {
                drop = true
                dropped.set(b.i, (dropped.get(b.i) || 0) + 1)
                break
              }
            }
          }

          if (drop) out += " "
          else out += pending + op
          pending = ""
          nums = []
        }
        out += pending
        return { out, dropped }
      }

      // Rewrites a page's content streams with the in-box text removed.
      // Returns Map<editIndex, droppedCount>; throws if the page can't be handled.
      const removeOriginalText = (doc, page, list) => {
        const { width: pw, height: ph } = page.getSize()
        const boxes = []
        list.forEach((e, i) => {
          if (e.isNew || !(Number(e.width) > 0)) return
          const cw = Number(e.canvasWidth) || pw
          const ch = Number(e.canvasHeight) || ph
          const sx = pw / cw, sy = ph / ch
          // PDF.js reports a line's x after any leading indent, while the text
          // operator itself starts at the indent — so we search left as far as
          // the client says is safe (`leftBound`: the end of whatever else sits
          // on this baseline, or the page edge). Matching is on the operator's
          // origin, which for this line always lands at or before its visible end.
          const lb = Number.isFinite(Number(e.leftBound)) ? Number(e.leftBound) : Number(e.x)
          boxes.push({
            i,
            x0: Math.min(lb, Number(e.x)) * sx,
            x1: (Number(e.x) + Number(e.width)) * sx,
            yBase: ph - Number(e.baselineY) * sy,
            yTol: Math.max(2, Number(e.height) * sy * 0.6),
          })
        })
        if (boxes.length === 0) return new Map()

        const ctx = doc.context
        const rawContents = page.node.get(PDFName.of("Contents"))
        let refs = []
        if (rawContents instanceof PDFArray) refs = rawContents.asArray()
        else if (rawContents) refs = [rawContents]
        refs = refs.filter((r) => r instanceof PDFRef)
        if (refs.length === 0) throw new Error("page has no indirect content stream")

        let combined = ""
        for (const r of refs) {
          const st = ctx.lookup(r)
          if (!(st instanceof PDFRawStream)) throw new Error("unsupported content stream type")
          combined += Buffer.from(decodePDFRawStream(st).decode()).toString("latin1")
        }

        const { out, dropped } = stripTextInBoxes(combined, boxes)

        const deflated = zlib.deflateSync(Buffer.from(out, "latin1"))
        const mkDict = (len, compressed) => {
          const d = PDFDict.withContext(ctx)
          d.set(PDFName.of("Length"), PDFNumber.of(len))
          if (compressed) d.set(PDFName.of("Filter"), PDFName.of("FlateDecode"))
          return d
        }
        ctx.assign(refs[0], PDFRawStream.of(mkDict(deflated.length, true), new Uint8Array(deflated)))
        for (const r of refs.slice(1)) {
          ctx.assign(r, PDFRawStream.of(mkDict(0, false), new Uint8Array(0)))
        }
        return dropped
      }

      // Draws the replacement text, plus a white cover only where the original
      // text could not actually be removed.
      const applyVectorEdits = (page, list, fonts, dropped) => {
        const { width: pw, height: ph } = page.getSize()
        list.forEach((e, i) => {
          const cw = Number(e.canvasWidth) || pw
          const ch = Number(e.canvasHeight) || ph
          const sx = pw / cw
          const sy = ph / ch
          const size = Math.max(1, (Number(e.fontSize) || 12) * sy)
          const text = String(e.text ?? "")
          const wasRemoved = (dropped.get(i) || 0) > 0

          if (!e.isNew && Number(e.width) > 0 && !wasRemoved) {
            const pad = Math.max(0.5, size * 0.12)
            const topPt = ph - Number(e.y) * sy
            const hPt = Number(e.height) * sy
            page.drawRectangle({
              x: Math.max(0, Number(e.x) * sx - pad),
              y: Math.max(0, topPt - hPt - pad * 0.5),
              width: Math.max(1, Number(e.width) * sx + pad * 2),
              height: Math.max(1, hPt + pad),
              color: rgb(1, 1, 1),
            })
          }

          if (!text) return
          page.drawText(text, {
            x: Number(e.x) * sx,
            y: ph - Number(e.baselineY) * sy,
            size,
            font: pickFont(fonts, e),
            color: hexToRgb(e.color),
          })
        })
      }

      const probeFonts = await embedFonts(srcDoc)
      const rasterPages = new Set()
      for (const [pStr, list] of Object.entries(editsByPage)) {
        for (const e of list) {
          if (!encodable(pickFont(probeFonts, e), e.text)) { rasterPages.add(parseInt(pStr, 10)); break }
        }
      }

      let coveredOnly = 0
      let outBytes

      if (rasterPages.size === 0) {
        // ── Fast path: everything stays vector, edit the document in place. ──
        for (const [pStr, list] of Object.entries(editsByPage)) {
          const page = srcDoc.getPage(parseInt(pStr, 10) - 1)
          let dropped = new Map()
          try {
            dropped = removeOriginalText(srcDoc, page, list)
          } catch (err) {
            console.warn(`[edit-pdf] text removal skipped on page ${pStr}: ${err.message}`)
            dropped = new Map()
          }
          list.forEach((e, i) => { if (!e.isNew && Number(e.width) > 0 && !(dropped.get(i) > 0)) coveredOnly++ })
          applyVectorEdits(page, list, probeFonts, dropped)
        }
        outBytes = await srcDoc.save()
      } else {
        // ── Mixed path: rasterise only the pages we can't set as vector text. ─
        const gsPath = getGhostscriptPath()
        const jobId = genJobId()
        const outputDir = path.dirname(inputPath)
        const EDIT_DPI = 200
        const outDoc = await PDFLibDocument.create()
        const outFonts = await embedFonts(outDoc)

        const escapeXml = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]))
        const svgFamily = (e) => {
          const fam = familyOf(e)
          return fam === "mono" ? "Courier New, monospace" : fam === "serif" ? "Times New Roman, serif" : "Arial, Helvetica, sans-serif"
        }

        for (let i = 0; i < pageCount; i++) {
          const pageNum = i + 1
          const list = editsByPage[pageNum]

          if (!list || list.length === 0) {
            const [copied] = await outDoc.copyPages(srcDoc, [i])
            outDoc.addPage(copied)
            continue
          }

          if (!rasterPages.has(pageNum)) {
            // Surgery has to happen on the source page before it's copied over.
            let dropped = new Map()
            try {
              dropped = removeOriginalText(srcDoc, srcDoc.getPage(i), list)
            } catch (err) {
              console.warn(`[edit-pdf] text removal skipped on page ${pageNum}: ${err.message}`)
              dropped = new Map()
            }
            list.forEach((e, idx) => { if (!e.isNew && Number(e.width) > 0 && !(dropped.get(idx) > 0)) coveredOnly++ })
            const [copied] = await outDoc.copyPages(srcDoc, [i])
            applyVectorEdits(outDoc.addPage(copied), list, outFonts, dropped)
            continue
          }

          // Rasterise this page, then burn the cover + new text via an SVG overlay.
          const disp = displaySize(srcDoc.getPage(i))
          const dpi = safeRenderDpi(disp.width, disp.height, EDIT_DPI)
          const rasterPath = path.join(outputDir, `${jobId}-edit-${pageNum}.png`)
          const gsCommand = `"${gsPath}" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r${dpi} -dFirstPage=${pageNum} -dLastPage=${pageNum} -sOutputFile="${rasterPath}" "${inputPath}"`
          await execPromise(gsCommand, { timeout: 60000, maxBuffer: 50 * 1024 * 1024 })
          if (!fs.existsSync(rasterPath)) throw new Error(`Failed to render page ${pageNum} for editing.`)

          const rasterMeta = await sharp(rasterPath).metadata()
          const pngW = rasterMeta.width
          const pngH = rasterMeta.height

          const svgParts = list.map((e) => {
            const cw = Number(e.canvasWidth) || pngW
            const ch = Number(e.canvasHeight) || pngH
            const sx = pngW / cw
            const sy = pngH / ch
            const size = Math.max(1, (Number(e.fontSize) || 12) * sy)
            const text = String(e.text ?? "")

            let rect = ""
            if (!e.isNew && Number(e.width) > 0) {
              const pad = Math.max(1, size * 0.12)
              rect = `<rect x="${Number(e.x) * sx - pad}" y="${Number(e.y) * sy - pad * 0.5}" width="${Number(e.width) * sx + pad * 2}" height="${Number(e.height) * sy + pad}" fill="white"/>`
            }
            if (!text) return rect

            const weight = e.bold ? ' font-weight="bold"' : ""
            const style = e.italic ? ' font-style="italic"' : ""
            const label = `<text x="${Number(e.x) * sx}" y="${Number(e.baselineY) * sy}" font-family="${svgFamily(e)}" font-size="${size}"${weight}${style} fill="${/^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : "#000000"}">${escapeXml(text)}</text>`
            return rect + label
          }).join("")

          const svgOverlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pngW}" height="${pngH}">${svgParts}</svg>`)
          const burned = await sharp(rasterPath).composite([{ input: svgOverlay, top: 0, left: 0 }]).png().toBuffer()
          try { fs.unlinkSync(rasterPath) } catch (_) {}

          const { width: pw, height: ph } = disp
          const embeddedPng = await outDoc.embedPng(burned)
          const newPage = outDoc.addPage([pw, ph])
          newPage.drawImage(embeddedPng, { x: 0, y: 0, width: pw, height: ph })
        }

        outBytes = await outDoc.save()
      }

      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
      const outputFilename = `edited-${baseName}.pdf`
      // Unique stored name (bare "edited-<name>.pdf" was shared between users);
      // the page names the download from convertedName.
      const storedFilename = `${genJobId()}-${outputFilename}`
      const outputPath = path.join("./uploads", storedFilename)
      fs.writeFileSync(outputPath, outBytes)
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)

      if (req.user) {
        await recordUserFile({ userId: req.user.id, plan: req.user.plan, tool: "edit-pdf", originalName: outputFilename, storedPath: path.resolve(outputPath), downloadUrl: `/uploads/${storedFilename}`, fileSize: outBytes.length })
      }

      logActivity({ type: "conversion", action: "edit_pdf_complete", tool: "edit-pdf", conversionType: "edit-pdf", pageCount, ip: req.clientIP, status: "success" })

      res.json({
        success: true,
        message: "PDF edited successfully",
        downloadUrl: `/uploads/${storedFilename}`,
        convertedName: outputFilename,
        pageCount,
        editedPages: Object.keys(editsByPage).length,
        rasterizedPages: rasterPages.size,
        rasterizedPageNumbers: [...rasterPages].sort((a, b) => a - b),
        coveredOnly,
      })
    } catch (error) {
      console.error("Edit PDF Error:", error)
      if (req.file && fs.existsSync(req.file.path)) { try { fs.unlinkSync(req.file.path) } catch (_) {} }
      logActivity({ type: "conversion", action: "edit_pdf_failed", tool: "edit-pdf", error: error.message, ip: req.clientIP, status: error.code ? "warning" : "error" })
      if (error.code) return res.status(422).json({ error: error.code, message: error.message, fileName: error.fileName })
      res.status(500).json({ error: error.message })
    }
  })


  // ── Protect PDF ───────────────────────────────────────────────────────────
  // Encrypts a PDF with a user password using qpdf (AES-256). We use execFile
  // with an args array (NOT a shell string) so the password can never be
  // interpreted by the shell — eliminates command injection.
  app.post("/api/protect-pdf", upload.single("file"), fileSizeLimiter("protect-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
    const { execFile } = require("child_process")
    const execFileP = util.promisify(execFile)
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" })
      }

      const password = (req.body.password || "").toString()
      if (!password || password.length < 1) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(400).json({ error: "A password is required to protect the PDF." })
      }
      if (password.length > 256) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(400).json({ error: "Password is too long (max 256 characters)." })
      }

      logActivity({
        type: "upload",
        action: "pdf_uploaded_for_protect",
        tool: "protect-pdf",
        filename: req.file.originalname,
        fileSize: req.file.size,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      const jobId = genJobId()
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
      const outputFilename = `protected-${baseName}.pdf`
      // Unique stored name (was shared per filename → users could receive each
      // other's protected file); the page names the download from convertedName.
      const storedFilename = `${jobId}-${outputFilename}`
      const outputPath = path.join("./uploads", storedFilename)

      // qpdf --encrypt <user> <owner> 256 -- input output
      // owner password = user password (single password to open).
      try {
        await execFileP("qpdf", ["--encrypt", password, password, "256", "--", req.file.path, outputPath])
      } catch (qErr) {
        // qpdf exits 3 on warnings but still produces a valid file — only fail if
        // no usable output was created.
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          // Never log qErr.message: it echoes the command line, i.e. the password.
          console.error("Protect PDF qpdf error:", String(qErr.stderr || "").split(password).join("***").slice(0, 300))
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
          const alreadyLocked = /invalid password|encrypted/i.test(String(qErr.stderr || ""))
          return res.status(422).json({
            error: alreadyLocked ? "PASSWORD_PROTECTED" : "CORRUPT_PDF",
            message: alreadyLocked ? "This PDF already has an open password. Remove it with Unlock PDF first, then protect it again." : "Could not read this PDF. The file may be damaged.",
            fileName: req.file.originalname,
          })
        }
      }

      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)

      const outBytes = fs.statSync(outputPath).size

      if (req.user) {
        await recordUserFile({
          userId: req.user.id,
          plan: req.user.plan,
          tool: "protect-pdf",
          originalName: outputFilename,
          jobId,
          storedPath: path.resolve(outputPath),
          downloadUrl: `/uploads/${storedFilename}`,
          fileSize: outBytes,
        })
      }

      logActivity({
        type: "conversion",
        action: "protect_pdf_complete",
        tool: "protect-pdf",
        conversionType: "protect-pdf",
        ip: req.clientIP,
        status: "success",
      })

      res.json({
        success: true,
        message: "PDF protected successfully",
        downloadUrl: `/uploads/${storedFilename}`,
        convertedName: outputFilename,
      })
    } catch (error) {
      console.error("Protect PDF Error:", error)
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path) } catch (_) {}
      }
      logActivity({
        type: "conversion",
        action: "protect_pdf_failed",
        tool: "protect-pdf",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      res.status(500).json({ error: error.message })
    }
  })


app.post("/api/compress-pdf-batch", upload.array("files", 500), fileSizeLimiter("compress-pdf"), batchLimiter("compress-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "pdfs_uploaded",
      tool: "compress-pdf",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`\n📥 Compress PDF Batch — ${req.files.length} file(s) received`)

    const jobId = genJobId()
    const compressedDir = path.join(__dirname, "compressed", jobId)
    if (!fs.existsSync(compressedDir)) {
      fs.mkdirSync(compressedDir, { recursive: true })
    }

    // Whitelisted: this value is placed UNQUOTED into the python command line,
    // so any other string (e.g. "balanced; <cmd>") would run as shell code.
    const compressionLevel = ["maximum", "balanced", "extreme"].includes(req.body.level) ? req.body.level : "balanced"
    console.log(`  Level: ${compressionLevel}`)

    // ── Python script path (place compress_pdf.py in same folder as server.js) ──
    const pythonScript = path.join(__dirname, "compress_pdf.py")
    const pythonCmd    = process.platform === "win32" ? "python" : "python3"

    // ── GS settings (for image-heavy PDFs, Pass 2) ───────────
    const gsSettings = {
      maximum: {
        pdfSettings: "/printer", colorDPI: 150, grayDPI: 150, monoDPI: 300,
        jpegQuality: 80, downsampleType: "/Bicubic",
        description: "Maximum Quality", expectedReduction: "20-50%",
        extraFlags: ["-dDetectDuplicateImages=true", "-dCompressFonts=true",
          "-dSubsetFonts=true", "-dEmbedAllFonts=false", "-dOptimize=true"],
      },
      balanced: {
        pdfSettings: "/ebook", colorDPI: 96, grayDPI: 96, monoDPI: 200,
        jpegQuality: 55, downsampleType: "/Bicubic",
        description: "Balanced", expectedReduction: "50-75%",
        // No -dPreserveAnnots=false here or in "extreme": it deleted every
        // hyperlink in the PDF for a negligible size gain.
        extraFlags: ["-dDetectDuplicateImages=true", "-dCompressFonts=true",
          "-dSubsetFonts=true", "-dEmbedAllFonts=false", "-dOptimize=true",
          "-dPreserveHalftoneInfo=false"],
      },
      extreme: {
        pdfSettings: "/screen", colorDPI: 72, grayDPI: 72, monoDPI: 150,
        jpegQuality: 30, downsampleType: "/Subsample",
        description: "Extreme Compression", expectedReduction: "70-90%",
        extraFlags: ["-dDetectDuplicateImages=true", "-dCompressFonts=true",
          "-dSubsetFonts=true", "-dEmbedAllFonts=false", "-dOptimize=true",
          "-dPreserveHalftoneInfo=false",
          "-dPreserveOPIComments=false", "-dPreserveOverprintSettings=false",
          "-dUCRandBGInfo=/Remove", "-dMaxSubsetPct=100",
          "-dConvertCMYKImagesToRGB=true", "-dAutoFilterColorImages=false",
          "-dAutoFilterGrayImages=false", "-dAutoFilterMonoImages=false",
          "-dColorImageFilter=/DCTEncode", "-dGrayImageFilter=/DCTEncode",
          "-dMonoImageFilter=/CCITTFaxEncode", "-dDoThumbnails=false"],
      },
    }

    const settings = gsSettings[compressionLevel] || gsSettings.balanced
    const gsPath = getGhostscriptPath()

    function buildGsCommand(inputPath, outputPath, s) {
      return [
        `"${gsPath}"`, `-sDEVICE=pdfwrite`, `-dCompatibilityLevel=1.4`,
        `-dPDFSETTINGS=${s.pdfSettings}`, `-dNOPAUSE`, `-dQUIET`, `-dBATCH`,
        `-dDownsampleColorImages=true`, `-dColorImageDownsampleType=${s.downsampleType}`,
        `-dColorImageResolution=${s.colorDPI}`, `-dColorImageDownsampleThreshold=1.0`,
        `-dDownsampleGrayImages=true`, `-dGrayImageDownsampleType=${s.downsampleType}`,
        `-dGrayImageResolution=${s.grayDPI}`, `-dGrayImageDownsampleThreshold=1.0`,
        `-dDownsampleMonoImages=true`, `-dMonoImageDownsampleType=/Subsample`,
        `-dMonoImageResolution=${s.monoDPI}`,
        `-dJPEGQuality=${s.jpegQuality}`, `-dAutoRotatePages=/None`,
        `-dCompressPages=true`, `-dUseFlateCompression=true`,
        ...s.extraFlags,
        `-sOutputFile="${outputPath}"`, `"${inputPath}"`,
      ].join(" ")
    }

    // Pick smallest valid file from candidates
    function pickSmallest(candidates) {
      let best = null
      for (const c of candidates) {
        if (!c || !c.path || !fs.existsSync(c.path)) continue
        const size = fs.statSync(c.path).size
        if (size === 0) continue
        if (!best || size < best.size) best = { path: c.path, size }
      }
      return best
    }

    const compressedFiles = []
    const corruptFiles = []
    let totalOriginalSize  = 0
    let totalCompressedSize = 0

    // One time budget for the WHOLE request. nginx gives up at 300s
    // (proxy_read_timeout); the three passes used to be allowed 120+300+120s
    // per file, so a heavy PDF ended in a 504 even though the earlier, cheaper
    // passes had already produced a smaller file. Now each pass gets what is
    // left of ~270s, and a pass with no time left is skipped — the visitor
    // gets the best result so far instead of a gateway error.
    const compressDeadline = Date.now() + 270000
    const passBudget = (capMs) => Math.min(capMs, compressDeadline - Date.now() - 10000)

    for (const file of req.files) {
      totalOriginalSize += file.size

      const ts             = Date.now()
      const outputFilename  = `${ts}-compressed-${file.originalname}`
      const finalOutputPath = path.join(compressedDir, outputFilename)
      const pass1Path       = path.join(compressedDir, `${ts}-p1-${file.originalname}`)
      const pass2Path       = path.join(compressedDir, `${ts}-p2-${file.originalname}`)
      const pass3Path       = path.join(compressedDir, `${ts}-p3-${file.originalname}`)

      console.log(`\n  ⏳ ${file.originalname} (${formatFileSize(file.size)})`)

      try {
        // ── Pass 1: pikepdf — stream recompression + metadata strip ──
        let pass1Size = Infinity
        let pass1OK   = false
        try {
          const pyCmd = `"${pythonCmd}" "${pythonScript}" "${file.path}" "${pass1Path}" ${compressionLevel}`
          const t1 = passBudget(120000)
          if (t1 < 5000) throw new Error("skipped — request time budget used up")
          const { stdout } = await execPromise(pyCmd, { timeout: t1, maxBuffer: 200 * 1024 * 1024 })
          if (fs.existsSync(pass1Path) && fs.statSync(pass1Path).size > 0) {
            pass1OK   = true
            pass1Size = fs.statSync(pass1Path).size
            console.log(`     Pass1 pikepdf: ${formatFileSize(file.size)} → ${formatFileSize(pass1Size)} (${Math.round((1 - pass1Size / file.size) * 100)}% saved)`)
          }
        } catch (pyErr) {
          console.log(`     Pass1 pikepdf: FAILED — ${pyErr.message.slice(0, 100)}`)
          console.log(`     💡 Fix: pip install pikepdf  (or: pip3 install pikepdf)`)
        }

        // ── Pass 2: Ghostscript — image downsampling + font subsetting ──
        // Feed GS the smaller of (original, pass1) as input
        const gsInput   = (pass1OK && pass1Size < file.size) ? pass1Path : file.path
        let pass2OK     = false
        let pass2Size   = Infinity
        // Ghostscript's pdfwrite flattens fillable form fields into plain page
        // content, so a compressed form could no longer be filled in. Forms go
        // through the lossless passes only.
        let hasForm = false
        let unreadable = false
        try {
          const probe = await PDFLibDocument.load(fs.readFileSync(file.path), { ignoreEncryption: true, updateMetadata: false })
          hasForm = probe.getForm().getFields().length > 0
        } catch (_) {
          unreadable = true
        }
        if (hasForm) console.log(`     Pass2 GS: skipped — PDF has fillable form fields`)
        if (!hasForm) try {
          const gsCmd = buildGsCommand(gsInput, pass2Path, settings)
          const t2 = passBudget(180000)
          if (t2 < 5000) throw new Error("skipped — request time budget used up")
          await execPromise(gsCmd, { timeout: t2, maxBuffer: 200 * 1024 * 1024 })
          if (fs.existsSync(pass2Path) && fs.statSync(pass2Path).size > 0) {
            pass2OK   = true
            pass2Size = fs.statSync(pass2Path).size
            console.log(`     Pass2 GS:      ${formatFileSize(fs.statSync(gsInput).size)} → ${formatFileSize(pass2Size)}`)
          }
        } catch (gsErr) {
          console.log(`     Pass2 GS: FAILED — ${gsErr.message.slice(0, 80)}`)
        }

        // ── Pass 3: qpdf — stream recompression for text-heavy PDFs ──
        // Best input: smallest of pass1/pass2/original
        const qpdfInput = pickSmallest([
          pass2OK ? { path: pass2Path, size: pass2Size } : null,
          pass1OK ? { path: pass1Path, size: pass1Size } : null,
          { path: file.path, size: file.size },
        ])
        let pass3OK   = false
        let pass3Size = Infinity
        try {
          const qpdfCmd = `qpdf --compress-streams=y --object-streams=generate --recompress-flate --compression-level=9 --linearize "${qpdfInput.path}" "${pass3Path}"`
          const t3 = passBudget(60000)
          if (t3 < 5000) throw new Error("skipped — request time budget used up")
          await execPromise(qpdfCmd, { timeout: t3, maxBuffer: 200 * 1024 * 1024 })
          if (fs.existsSync(pass3Path) && fs.statSync(pass3Path).size > 0) {
            pass3OK   = true
            pass3Size = fs.statSync(pass3Path).size
            console.log(`     Pass3 qpdf:    ${formatFileSize(qpdfInput.size)} → ${formatFileSize(pass3Size)} (${Math.round((1 - pass3Size / file.size) * 100)}% saved)`)
          }
        } catch (qpdfErr) {
          console.log(`     Pass3 qpdf: FAILED — ${qpdfErr.message.slice(0, 80)}`)
          console.log(`     💡 Fix: apt-get install -y qpdf`)
        }

        // Neither qpdf (strict) nor pdf-lib (lenient) could read it → not a
        // usable PDF. Pass 1 just copies unreadable input and Ghostscript turns
        // it into a blank page, so their "success" proves nothing. Returning
        // the original as "already optimized" (the old behaviour) was misleading.
        if (!pass3OK && unreadable) {
          const err = new Error("No compression pass could read this PDF")
          err.corrupt = true
          throw err
        }

        // ── Pick smallest of all passes — never inflate the file ──
        const winner = pickSmallest([
          pass3OK ? { path: pass3Path, size: pass3Size } : null,
          pass2OK ? { path: pass2Path, size: pass2Size } : null,
          pass1OK ? { path: pass1Path, size: pass1Size } : null,
          { path: file.path, size: file.size },
        ])

        fs.copyFileSync(winner.path, finalOutputPath)

        const finalSize       = winner.size
        const savedBytes      = Math.max(0, file.size - finalSize)
        const savedPercentage = Math.round((savedBytes / file.size) * 100)

        console.log(`     ✅ Winner: ${formatFileSize(finalSize)} — saved ${savedPercentage}%`)

        totalCompressedSize += finalSize
        compressedFiles.push({
          filename: outputFilename,
          originalName: file.originalname,
          originalSize: file.size,
          compressedSize: finalSize,
          savedBytes,
          savedPercentage,
        })

      } catch (fileErr) {
        console.error(`  ❌ ${file.originalname}: ${fileErr.message}`)
        logActivity({ type: "conversion", action: "compress_pdf_file_failed", tool: "compress-pdf",
          filename: file.originalname, fileSize: file.size, error: fileErr.message, ip: req.clientIP, status: "error" })
        if (fileErr.corrupt) {
          corruptFiles.push(file.originalname)
          totalOriginalSize -= file.size
        } else try {
          fs.copyFileSync(file.path, finalOutputPath)
          totalCompressedSize += file.size
          compressedFiles.push({
            filename: outputFilename, originalName: file.originalname,
            originalSize: file.size, compressedSize: file.size,
            savedBytes: 0, savedPercentage: 0,
            warning: "Compression unavailable — original returned",
          })
        } catch (_) {}

      } finally {
        for (const tmp of [pass1Path, pass2Path, pass3Path]) {
          try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch (_) {}
        }
        try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path) } catch (_) {}
      }
    }

    if (compressedFiles.length === 0) {
      logActivity({ type: "conversion", action: "compress_pdf_failed", tool: "compress-pdf",
        error: corruptFiles.length ? "Damaged PDF" : "No files compressed", ip: req.clientIP, status: "error" })
      try { fs.rmSync(compressedDir, { recursive: true, force: true }) } catch (_) {}
      if (corruptFiles.length) {
        return res.status(422).json({
          error: "CORRUPT_PDF",
          message: "This PDF appears to be damaged or is not a valid PDF, so it could not be compressed. Try re-saving or re-downloading it and upload again.",
          files: corruptFiles,
        })
      }
      return res.status(500).json({ error: "No files were compressed. Ensure pikepdf is installed: pip install pikepdf" })
    }

    const savedPercentage = totalOriginalSize > 0
      ? Math.max(0, Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100))
      : 0

    logActivity({ type: "conversion", action: "compress_pdf_complete", tool: "compress-pdf",
      conversionType: "compress-pdf", fileCount: compressedFiles.length,
      savedPercentage, originalSize: totalOriginalSize, compressedSize: totalCompressedSize,
      compressionLevel, ip: req.clientIP, status: "success" })

    console.log(`\n📊 SUMMARY: ${compressedFiles.length} files | ${formatFileSize(totalOriginalSize)} → ${formatFileSize(totalCompressedSize)} (${savedPercentage}% saved)\n`)

    // Sizes for the download page when it is reloaded or opened from a shared
    // link (sessionStorage gone) — compress-meta used to report 0% saved.
    try {
      fs.writeFileSync(path.join(compressedDir, ".meta.json"), JSON.stringify({
        createdAt: Date.now(), compressionLevel, totalOriginalSize, compressedSize: totalCompressedSize,
        savedPercentage, files: compressedFiles,
      }))
    } catch (_) {}

    // Attach compressed outputs to the user's "My Files" history when logged in.
    if (req.user) {
      for (const cf of compressedFiles) {
        await recordUserFile({
          userId: req.user.id,
          plan: req.user.plan,
          tool: "compress-pdf",
          originalName: cf.originalName,
          jobId,
          storedPath: path.join(compressedDir, cf.filename),
          downloadUrl: `/api/download-compressed/${jobId}`,
          fileSize: cf.compressedSize,
        })
      }
    }

    res.json({
      success: true,
      message: `${compressedFiles.length} PDF(s) compressed successfully`,
      jobId, fileCount: compressedFiles.length,
      totalOriginalSize, compressedSize: totalCompressedSize,
      savedPercentage, compressionLevel,
      expectedReduction: settings.expectedReduction,
      files: compressedFiles,
      damagedFiles: corruptFiles,
    })

  } catch (error) {
    console.error("❌ Compress PDF Batch Error:", error)
    if (req.files) {
      for (const file of req.files) {
        try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path) } catch (_) {}
      }
    }
    logActivity({ type: "conversion", action: "compress_pdf_failed", tool: "compress-pdf",
      error: error.message, ip: req.clientIP, status: "error" })
    res.status(500).json({ error: "Failed to compress PDFs", details: error.message })
  }
})

// GET /api/compress-meta/:jobId — used by download.js on page refresh / shared link
app.get("/api/compress-meta/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const compressedDir = path.join(__dirname, "compressed", jobId)
    if (!fs.existsSync(compressedDir)) return res.status(404).json({ error: "Job not found or expired" })
    const files = fs.readdirSync(compressedDir).filter((f) => f.endsWith(".pdf"))
    if (files.length === 0) return res.status(404).json({ error: "No compressed PDFs found" })
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(compressedDir, ".meta.json"), "utf8"))
      return res.json({ success: true, jobId, fileCount: meta.files.length, ...meta,
        fileName: meta.files.length === 1 ? meta.files[0].originalName : undefined })
    } catch (_) {} // older jobs without .meta.json → sizes of the stored files only
    let totalSize = 0
    const fileList = files.map((f) => {
      const size = fs.statSync(path.join(compressedDir, f)).size
      totalSize += size
      return { filename: f, compressedSize: size }
    })
    res.json({ success: true, jobId, fileCount: files.length, compressedSize: totalSize,
      totalOriginalSize: totalSize, savedPercentage: 0, files: fileList })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// HEIC to JPG endpoint
// Decodes iPhone/iPad HEIC/HEIF photos to JPG.
// Uses heic-convert (pure JS, bundles libheif with HEVC decode) because the
// prebuilt sharp binary only ships AVIF support, not the HEVC codec real HEIC uses.
// ============================================
app.post("/api/heic-to-jpg", upload.array("files", 50), fileSizeLimiter("heic-to-jpg"), batchLimiter("heic-to-jpg"), dailyConversionLimiter(), fileValidation, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "heic_uploaded",
      tool: "heic-to-jpg",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`HEIC to JPG - ${req.files.length} file(s) received`)

    const jobId = genJobId()
    const outputDir = "./uploads"
    const convertedFiles = []
    const failedFiles = []
    let totalOriginalSize = 0
    let totalConvertedSize = 0
    // [{ rotation, filterId }, …] in the same order as the uploaded files
    let transforms = []
    try { transforms = JSON.parse(req.body.transforms || "[]"); if (!Array.isArray(transforms)) transforms = [] } catch (_) { transforms = [] }

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]
      totalOriginalSize += file.size

      const outputFilename = `${jobId}-heicjpg-${i + 1}.jpg`
      const outputPath = path.join(outputDir, outputFilename)
      const baseName = path.basename(file.originalname, path.extname(file.originalname))

      try {
        const inputBuffer = fs.readFileSync(file.path)
        const outputBuffer = await convertHeicImage(inputBuffer, "jpeg", transforms[i] || {})
        if (!outputBuffer) throw new Error("Unreadable image")

        fs.writeFileSync(outputPath, outputBuffer)

        const stats = fs.statSync(outputPath)
        totalConvertedSize += stats.size

        convertedFiles.push({
          filename: outputFilename,
          originalName: file.originalname,
          downloadName: `${baseName}.jpg`,
          originalSize: file.size,
          convertedSize: stats.size,
        })

        console.log(`Converted: ${file.originalname} -> ${outputFilename}`)
      } catch (convError) {
        console.error(`Error converting ${file.originalname}:`, convError.message)
        failedFiles.push(file.originalname)
      } finally {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    if (convertedFiles.length === 0) {
      logActivity({
        type: "conversion",
        action: "heic_to_jpg_failed",
        tool: "heic-to-jpg",
        error: "No files converted",
        ip: req.clientIP,
        status: "error",
      })

      // Unreadable input, not a server fault → 422 with the file names.
      return res.status(422).json({ error: "UNREADABLE_IMAGES", files: failedFiles, message: "Could not convert the HEIC file(s). The file may be corrupted or not a valid HEIC image." })
    }

    logActivity({
      type: "conversion",
      action: "heic_to_jpg_complete",
      tool: "heic-to-jpg",
      conversionType: "heic-to-jpg",
      fileCount: convertedFiles.length,
      ip: req.clientIP,
      status: "success",
    })

    // Save download name meta so the download endpoint can send the right filename
    try {
      fs.writeFileSync(
        path.join(outputDir, `${jobId}-names.json`),
        JSON.stringify(convertedFiles.map(f => ({ stored: f.filename, download: f.downloadName })))
      )
    } catch (_) {}

    res.json({
      success: true,
      message: `${convertedFiles.length} image(s) converted successfully`,
      jobId: jobId,
      fileCount: convertedFiles.length,
      totalSize: totalOriginalSize,
      convertedSize: totalConvertedSize,
      files: convertedFiles,
      skipped: failedFiles.length ? failedFiles : undefined,
    })
  } catch (error) {
    console.error("HEIC to JPG Error:", error)

    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    logActivity({
      type: "conversion",
      action: "heic_to_jpg_failed",
      tool: "heic-to-jpg",
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    res.status(500).json({
      error: "Failed to convert HEIC images",
      details: error.message,
    })
  }
})

// Download endpoint for HEIC to JPG converted files
app.get("/api/download-heic-jpg/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params

    // Guard against path traversal — jobId is server-generated (alphanumeric)
    if (!/^[A-Za-z0-9_-]+$/.test(jobId)) {
      return res.status(400).json({ error: "Invalid job id" })
    }

    const uploadDir = "./uploads"
    const files = fs.readdirSync(uploadDir)
    const jpgFiles = files
      .filter((f) => f.startsWith(`${jobId}-heicjpg-`))
      .sort((a, b) => {
        const numA = Number.parseInt(a.match(/-heicjpg-(\d+)/)?.[1] || "0")
        const numB = Number.parseInt(b.match(/-heicjpg-(\d+)/)?.[1] || "0")
        return numA - numB
      })

    if (jpgFiles.length === 0) {
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: jobId,
        error: "No files found",
        ip: req.clientIP,
        status: "error",
      })

      return res.status(404).json({ error: "No files found for this job. They may have expired." })
    }

    // Single file → direct JPG download
    if (jpgFiles.length === 1) {
      const filePath = path.join(uploadDir, jpgFiles[0])

      // Read meta for original download name
      const metaPath = path.join(uploadDir, `${jobId}-names.json`)
      let downloadName = "converted-image.jpg"
      try {
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
          downloadName = meta[0]?.download || downloadName
        }
      } catch (_) {}

      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: jpgFiles[0],
        ip: req.clientIP,
        status: "success",
      })

      return res.download(filePath, downloadName, (err) => {
        // kept so the user can download again — sweepOldFiles() deletes it after 1h
        // kept so the user can download again — sweepOldFiles() deletes it after 1h
      })
    }

    // Multiple files → ZIP archive
    const zipFilename = `heic-to-jpg-${jobId}-${Date.now()}.zip`
    // Original photo names (IMG_4346.jpg …) instead of "converted-image-N.jpg"
    let zipMeta = []
    try { zipMeta = JSON.parse(fs.readFileSync(path.join(uploadDir, `${jobId}-names.json`), "utf8")) } catch (_) {}
    const zipUsed = new Set()
    const zipDownloadName = `heic-to-jpg-${jpgFiles.length}-images.zip`
    const zipPath = path.join(uploadDir, zipFilename)

    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", { zlib: { level: 9 } })

    archive.on("error", (err) => {
      throw err
    })

    archive.pipe(output)

    for (let i = 0; i < jpgFiles.length; i++) {
      const jpgPath = path.join(uploadDir, jpgFiles[i])
      if (fs.existsSync(jpgPath)) {
        let entry = (zipMeta.find((m) => m.stored === jpgFiles[i]) || {}).download || `converted-image-${i + 1}.jpg`
        if (zipUsed.has(entry)) entry = entry.replace(/\.jpg$/i, `-${i + 1}.jpg`)
        zipUsed.add(entry)
        archive.file(jpgPath, { name: entry })
      }
    }

    await archive.finalize()

    await new Promise((resolve, reject) => {
      output.on("close", resolve)
      output.on("error", reject)
    })

    logActivity({
      type: "download",
      action: "zip_downloaded",
      jobId: jobId,
      fileCount: jpgFiles.length,
      ip: req.clientIP,
      status: "success",
    })

    res.download(zipPath, zipDownloadName, (err) => {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath)
      }
      for (const jpgFile of jpgFiles) {
        const jpgPath = path.join(uploadDir, jpgFile)
        if (fs.existsSync(jpgPath)) {
          // kept so the user can download again — sweepOldFiles() deletes it after 1h
        }
      }
    })
  } catch (error) {
    console.error("Download HEIC JPG error:", error)

    logActivity({
      type: "download",
      action: "download_failed",
      jobId: req.params.jobId,
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    res.status(500).json({ error: error.message })
  }
})

// ============================================
// HEIC to PNG endpoint
// Same heic-convert library, format: "PNG" (lossless)
// ============================================
app.post("/api/heic-to-png", upload.array("files", 50), fileSizeLimiter("heic-to-png"), batchLimiter("heic-to-png"), dailyConversionLimiter(), fileValidation, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "heic_uploaded",
      tool: "heic-to-png",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`HEIC to PNG - ${req.files.length} file(s) received`)

    const jobId = genJobId()
    const outputDir = "./uploads"
    const convertedFiles = []
    const failedFiles = []
    let totalOriginalSize = 0
    let totalConvertedSize = 0
    // [{ rotation, filterId }, …] in the same order as the uploaded files
    let transforms = []
    try { transforms = JSON.parse(req.body.transforms || "[]"); if (!Array.isArray(transforms)) transforms = [] } catch (_) { transforms = [] }

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]
      totalOriginalSize += file.size

      const outputFilename = `${jobId}-heicpng-${i + 1}.png`
      const outputPath = path.join(outputDir, outputFilename)
      const baseName = path.basename(file.originalname, path.extname(file.originalname))

      try {
        const inputBuffer = fs.readFileSync(file.path)
        const outputBuffer = await convertHeicImage(inputBuffer, "png", transforms[i] || {})
        if (!outputBuffer) throw new Error("Unreadable image")

        fs.writeFileSync(outputPath, outputBuffer)

        const stats = fs.statSync(outputPath)
        totalConvertedSize += stats.size

        convertedFiles.push({
          filename: outputFilename,
          originalName: file.originalname,
          downloadName: `${baseName}.png`,
          originalSize: file.size,
          convertedSize: stats.size,
        })

        console.log(`Converted: ${file.originalname} -> ${outputFilename}`)
      } catch (convError) {
        console.error(`Error converting ${file.originalname}:`, convError.message)
        failedFiles.push(file.originalname)
      } finally {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    if (convertedFiles.length === 0) {
      logActivity({
        type: "conversion",
        action: "heic_to_png_failed",
        tool: "heic-to-png",
        error: "No files converted",
        ip: req.clientIP,
        status: "error",
      })
      // Unreadable input, not a server fault → 422 with the file names.
      return res.status(422).json({ error: "UNREADABLE_IMAGES", files: failedFiles, message: "Could not convert the HEIC file(s). The file may be corrupted or not a valid HEIC image." })
    }

    logActivity({
      type: "conversion",
      action: "heic_to_png_complete",
      tool: "heic-to-png",
      conversionType: "heic-to-png",
      fileCount: convertedFiles.length,
      ip: req.clientIP,
      status: "success",
    })

    // Save download name meta so the download endpoint can send the right filename
    try {
      fs.writeFileSync(
        path.join(outputDir, `${jobId}-names.json`),
        JSON.stringify(convertedFiles.map(f => ({ stored: f.filename, download: f.downloadName })))
      )
    } catch (_) {}

    res.json({
      success: true,
      message: `${convertedFiles.length} image(s) converted successfully`,
      jobId: jobId,
      fileCount: convertedFiles.length,
      totalSize: totalOriginalSize,
      convertedSize: totalConvertedSize,
      files: convertedFiles,
      skipped: failedFiles.length ? failedFiles : undefined,
    })
  } catch (error) {
    console.error("HEIC to PNG Error:", error)
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      }
    }
    logActivity({ type: "conversion", action: "heic_to_png_failed", tool: "heic-to-png", error: error.message, ip: req.clientIP, status: "error" })
    res.status(500).json({ error: "Failed to convert HEIC images", details: error.message })
  }
})

// Download endpoint for HEIC to PNG converted files
app.get("/api/download-heic-png/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    if (!/^[A-Za-z0-9_-]+$/.test(jobId)) {
      return res.status(400).json({ error: "Invalid job id" })
    }

    const uploadDir = "./uploads"
    const files = fs.readdirSync(uploadDir)
    const pngFiles = files
      .filter((f) => f.startsWith(`${jobId}-heicpng-`))
      .sort((a, b) => {
        const numA = Number.parseInt(a.match(/-heicpng-(\d+)/)?.[1] || "0")
        const numB = Number.parseInt(b.match(/-heicpng-(\d+)/)?.[1] || "0")
        return numA - numB
      })

    if (pngFiles.length === 0) {
      return res.status(404).json({ error: "No files found for this job. They may have expired." })
    }

    if (pngFiles.length === 1) {
      const filePath = path.join(uploadDir, pngFiles[0])

      // Read meta for original download name
      const metaPath = path.join(uploadDir, `${jobId}-names.json`)
      let downloadName = "converted-image.png"
      try {
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
          downloadName = meta[0]?.download || downloadName
        }
      } catch (_) {}

      logActivity({ type: "download", action: "file_downloaded", jobId, ip: req.clientIP, status: "success" })
      return res.download(filePath, downloadName, (err) => {
        // kept so the user can download again — sweepOldFiles() deletes it after 1h
        // kept so the user can download again — sweepOldFiles() deletes it after 1h
      })
    }

    const zipFilename = `heic-to-png-${jobId}-${Date.now()}.zip`
    // Original photo names (IMG_4346.jpg …) instead of "converted-image-N.png"
    let zipMeta = []
    try { zipMeta = JSON.parse(fs.readFileSync(path.join(uploadDir, `${jobId}-names.json`), "utf8")) } catch (_) {}
    const zipUsed = new Set()
    const zipDownloadName = `heic-to-png-${pngFiles.length}-images.zip`
    const zipPath = path.join(uploadDir, zipFilename)
    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", { zlib: { level: 9 } })
    archive.on("error", (err) => { throw err })
    archive.pipe(output)

    for (let i = 0; i < pngFiles.length; i++) {
      const pngPath = path.join(uploadDir, pngFiles[i])
      if (fs.existsSync(pngPath)) {
        let entry = (zipMeta.find((m) => m.stored === pngFiles[i]) || {}).download || `converted-image-${i + 1}.png`
        if (zipUsed.has(entry)) entry = entry.replace(/\.png$/i, `-${i + 1}.png`)
        zipUsed.add(entry)
        archive.file(pngPath, { name: entry })
      }
    }

    await archive.finalize()
    await new Promise((resolve, reject) => { output.on("close", resolve); output.on("error", reject) })

    logActivity({ type: "download", action: "zip_downloaded", jobId, fileCount: pngFiles.length, ip: req.clientIP, status: "success" })

    res.download(zipPath, zipDownloadName, (err) => {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
      for (const pngFile of pngFiles) {
        const pngPath = path.join(uploadDir, pngFile)
        // kept so the user can download again — sweepOldFiles() deletes it after 1h
      }
    })
  } catch (error) {
    console.error("Download HEIC PNG error:", error)
    res.status(500).json({ error: error.message })
  }
})

//api/pdf-to-jpg endpoint

app.post("/api/pdf-to-jpg", upload.single("file"), fileSizeLimiter("pdf-to-jpg"), dailyConversionLimiter(), fileValidation, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    if (await pdfRequiresPassword(req.file.path)) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      return res.status(422).json({ error: "PASSWORD_PROTECTED", message: req.file.originalname, fileName: req.file.originalname })
    }

    logActivity({
      type: "upload",
      action: "pdf_uploaded",
      tool: "pdf-to-jpg",
      filename: req.file.originalname,
      fileSize: req.file.size,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log("PDF to JPG - File received:", req.file.originalname)

    const inputPath = req.file.path
    const outputDir = path.dirname(inputPath)
    const baseName = path.basename(req.file.filename, path.extname(req.file.filename))

    // multer's stored name is "<timestamp>-<name>"; users must never see that prefix
    // in the names they download (zip name / entries inside the zip).
    const cleanBase = path.basename(req.file.originalname, path.extname(req.file.originalname))

    const quality = req.body.quality || "standard"
    let dpi = 150
    if (quality === "high") dpi = 300
    if (quality === "maximum") dpi = 600
    dpi = await pdfRasterDpi(inputPath, dpi)

    console.log(`Converting PDF to JPG with DPI: ${dpi}...`)

    const gsPath = getGhostscriptPath()
    const outputPattern = path.join(outputDir, `${baseName}-page-%d.jpg`)

    const command = `"${gsPath}" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=jpeg -dJPEGQ=95 -r${dpi} -sOutputFile="${outputPattern}" "${inputPath}"`

    try {
      await execPromise(command, {
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
      })

      const files = fs.readdirSync(outputDir)
      const jpgFiles = files
        .filter((f) => f.startsWith(baseName + "-page-") && f.endsWith(".jpg"))
        .sort((a, b) => {
          const numA = Number.parseInt(a.match(/-page-(\d+)/)?.[1] || "0")
          const numB = Number.parseInt(b.match(/-page-(\d+)/)?.[1] || "0")
          return numA - numB
        })

      if (jpgFiles.length === 0) {
        throw new Error("No JPG files were created.")
      }

      // Clean up the input PDF
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath)
      }

      logActivity({
        type: "conversion",
        action: "pdf_to_jpg_complete",
        tool: "pdf-to-jpg",
        conversionType: "pdf-to-jpg",
        filename: req.file.originalname,
        pageCount: jpgFiles.length,
        ip: req.clientIP,
        status: "success",
      })

      // SINGLE PAGE - Return direct JPG download (NO ZIP)
      if (jpgFiles.length === 1) {
        const singleFile = jpgFiles[0]
        const singleFilePath = path.join(outputDir, singleFile)
        const stats = fs.statSync(singleFilePath)
        
        console.log(`Single page PDF - returning direct JPG: ${singleFile}`)
        
        res.json({
          success: true,
          message: "PDF converted to JPG successfully",
          pageCount: 1,
          downloadUrl: `/uploads/${singleFile}`,
          originalName: req.file.originalname,
          convertedName: `${cleanBase}.jpg`,
          isZip: false,  // Important: indicate this is NOT a zip
          fileSize: stats.size,
          files: [`/uploads/${singleFile}`],
        })
      } 
      // MULTIPLE PAGES - Create ZIP
      else {
        const zipFilename = `${baseName}-images.zip` // unique on disk; display name below
        const zipPath = path.join(outputDir, zipFilename)

        const output = fs.createWriteStream(zipPath)
        const archive = archiver("zip", { zlib: { level: 9 } })

        archive.on("error", (err) => {
          throw err
        })

        archive.pipe(output)

        for (const jpgFile of jpgFiles) {
          const jpgFilePath = path.join(outputDir, jpgFile)
          if (fs.existsSync(jpgFilePath)) {
            // Zero-pad the page number so file managers sort page-2 before page-10.
            const pageNo = jpgFile.match(/-page-(\d+)\.jpg$/)?.[1] || ""
            const padded = pageNo.padStart(String(jpgFiles.length).length, "0")
            archive.file(jpgFilePath, { name: `${cleanBase}-page-${padded}.jpg` })
          }
        }

        await archive.finalize()

        await new Promise((resolve, reject) => {
          output.on("close", resolve)
          output.on("error", reject)
        })

        // Clean up individual JPG files after zipping
        for (const jpgFile of jpgFiles) {
          const jpgFilePath = path.join(outputDir, jpgFile)
          if (fs.existsSync(jpgFilePath)) {
            fs.unlinkSync(jpgFilePath)
          }
        }

        const stats = fs.statSync(zipPath)

        console.log(`Multi-page PDF - created ZIP with ${jpgFiles.length} images: ${zipFilename}`)

        res.json({
          success: true,
          message: `PDF converted to ${jpgFiles.length} JPG images successfully`,
          pageCount: jpgFiles.length,
          downloadUrl: `/uploads/${zipFilename}`,
          originalName: req.file.originalname,
          convertedName: `${cleanBase}-images.zip`,
          isZip: true,  // Important: indicate this IS a zip
          fileSize: stats.size,
        })
      }
    } catch (conversionError) {
      console.error("PDF to JPG conversion error:", conversionError)

      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath)
      }
      // A timeout / crash part-way leaves the pages already rendered on disk.
      try {
        for (const f of fs.readdirSync(outputDir)) {
          if (f.startsWith(baseName + "-page-") && f.endsWith(".jpg")) fs.unlinkSync(path.join(outputDir, f))
        }
      } catch (_) {}

      logActivity({
        type: "conversion",
        action: "pdf_to_jpg_failed",
        tool: "pdf-to-jpg",
        filename: req.file.originalname,
        error: conversionError.message,
        ip: req.clientIP,
        status: "error",
      })

      // Nothing rendered → the PDF itself is unreadable (not a server fault). GS
      // failing outright ("Command failed", e.g. a macOS "._" file) counts too.
      if (/No JPG files were created|Command failed/.test(conversionError.message)) {
        return res.status(422).json({ error: "CORRUPT_PDF", message: req.file.originalname, fileName: req.file.originalname })
      }
      res.status(500).json({
        error: "PDF to JPG conversion failed.",
        details: conversionError.message,
      })
    }
  } catch (error) {
    console.error("Error:", error)
    
    logActivity({
      type: "conversion",
      action: "pdf_to_jpg_failed",
      tool: "pdf-to-jpg",
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })
    
    res.status(500).json({ error: error.message })
  }
})

  // PDF to PNG Conversion
  app.post("/api/pdf-to-png", upload.single("pdf"), fileSizeLimiter("pdf-to-png"), dailyConversionLimiter(), fileValidation, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" })
      }

      if (await pdfRequiresPassword(req.file.path)) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(422).json({ error: "PASSWORD_PROTECTED", message: req.file.originalname, fileName: req.file.originalname })
      }

      logActivity({
        type: "upload",
        action: "pdf_uploaded",
        tool: "pdf-to-png",
        filename: req.file.originalname,
        fileSize: req.file.size,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log("PDF to PNG - File received:", req.file.originalname)

      const inputPath = req.file.path
      const outputDir = path.dirname(inputPath)
      const baseName = path.basename(req.file.filename, path.extname(req.file.filename))
      const jobId = genJobId()

      // Quality → DPI, matching pdf-to-jpg (standard 150 / high 300 / maximum 600).
      const quality = req.body.quality || "standard"
      let dpi = 150
      if (quality === "high") dpi = 300
      if (quality === "maximum") dpi = 600
      dpi = await pdfRasterDpi(inputPath, dpi)

      console.log(`Converting PDF to PNG with DPI: ${dpi} (quality=${quality})...`)

      const gsPath = getGhostscriptPath()
      const outputPattern = path.join(outputDir, `${jobId}-page-%d.png`)

      const command = `"${gsPath}" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r${dpi} -sOutputFile="${outputPattern}" "${inputPath}"`

      try {
        await execPromise(command, {
          timeout: 120000,
          maxBuffer: 50 * 1024 * 1024,
        })

        const files = fs.readdirSync(outputDir)
        const pngFiles = files
          .filter((f) => f.startsWith(jobId + "-page-") && f.endsWith(".png"))
          .sort((a, b) => {
            const numA = Number.parseInt(a.match(/-page-(\d+)/)?.[1] || "0")
            const numB = Number.parseInt(b.match(/-page-(\d+)/)?.[1] || "0")
            return numA - numB
          })

        if (pngFiles.length === 0) {
          throw new Error("No PNG files were created.")
        }

        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath)
        }

        console.log(`PDF to PNG - ${pngFiles.length} pages converted`)

        // Readable names for /api/download (single file / zip entries / zip name).
        // Page numbers are zero-padded so page-2 sorts before page-10.
        try {
          const cleanBase = path.basename(req.file.originalname, path.extname(req.file.originalname))
          const width = String(pngFiles.length).length
          const meta = pngFiles.map((pf) => {
            const n = pf.match(/-page-(\d+)\.png$/)?.[1] || "1"
            return { stored: pf, download: `${cleanBase}-page-${n.padStart(width, "0")}.png` }
          })
          fs.writeFileSync(path.join(outputDir, `${jobId}-names.json`), JSON.stringify(meta))
          fs.writeFileSync(path.join(outputDir, `${jobId}-zipname.txt`), `${cleanBase}-images.zip`)
        } catch (_) {}

        logActivity({
          type: "conversion",
          action: "pdf_to_png_complete",
          tool: "pdf-to-png",
          conversionType: "pdf-to-png",
          filename: req.file.originalname,
          pageCount: pngFiles.length,
          jobId: jobId,
          ip: req.clientIP,
          status: "success",
        })

        res.json({
          success: true,
          message: `PDF converted to ${pngFiles.length} PNG image(s) successfully`,
          jobId: jobId,
          pageCount: pngFiles.length,
          originalName: req.file.originalname,
          files: pngFiles.map((f) => `/uploads/${f}`),
        })
      } catch (conversionError) {
        console.error("PDF to PNG conversion error:", conversionError)

        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath)
        }

        logActivity({
          type: "conversion",
          action: "pdf_to_png_failed",
          tool: "pdf-to-png",
          filename: req.file.originalname,
          error: conversionError.message,
          ip: req.clientIP,
          status: "error",
        })

        // Nothing rendered: either GS found no pages or exited with an error before
        // the first page (not a PDF, e.g. a macOS "._" file) → unreadable input.
        const renderedAny = (() => { try { return fs.readdirSync(outputDir).some((f) => f.startsWith(jobId + "-page-")) } catch (_) { return false } })()
        try { for (const f of fs.readdirSync(outputDir)) if (f.startsWith(jobId + "-page-")) fs.unlinkSync(path.join(outputDir, f)) } catch (_) {}
        if (!renderedAny || /No PNG files were created/.test(conversionError.message)) {
          return res.status(422).json({ error: "CORRUPT_PDF", message: req.file.originalname, fileName: req.file.originalname })
        }
        res.status(500).json({
          error: "PDF to PNG conversion failed.",
          details: conversionError.message,
        })
      }
    } catch (error) {
      console.error("Error:", error)
      
      logActivity({
        type: "conversion",
        action: "pdf_to_png_failed",
        tool: "pdf-to-png",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // WEBP to PNG Conversion
  app.post("/api/webp-to-png", upload.array("files", 500), fileSizeLimiter("webp-to-png"), batchLimiter("webp-to-png"), dailyConversionLimiter(), fileValidation, async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      logActivity({
        type: "upload",
        action: "webp_uploaded",
        tool: "webp-to-png",
        fileCount: req.files.length,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log(`WEBP to PNG - ${req.files.length} file(s) received`)

      const jobId = genJobId()
      const outputDir = "./uploads"
      const convertedFiles = []
      const webpFailed = []

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i]
        const outputFilename = `${jobId}-page-${i + 1}.png`
        const outputPath = path.join(outputDir, outputFilename)

        try {
          // NB: any `quality` option makes sharp write a 256-colour palette PNG —
          // lossy. Truecolor + alpha only when the image actually has transparency.
          const outBuf = await sharp(file.path).rotate().png({ compressionLevel: 6 }).toBuffer()
          let finalBuf = outBuf
          try { if ((await sharp(outBuf).stats()).isOpaque) finalBuf = await sharp(outBuf).removeAlpha().png({ compressionLevel: 6 }).toBuffer() } catch (_) {}
          fs.writeFileSync(outputPath, finalBuf)

          convertedFiles.push({ stored: outputFilename, originalName: file.originalname })
          console.log(`Converted: ${file.originalname} -> ${outputFilename}`)

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        } catch (convError) {
          console.error(`Error converting ${file.originalname}:`, convError.message)
          webpFailed.push(file.originalname)
          try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path) } catch (_) {}
        }
      }

      if (convertedFiles.length === 0) {
        logActivity({
          type: "conversion",
          action: "webp_to_png_failed",
          tool: "webp-to-png",
          error: "No files converted",
          ip: req.clientIP,
          status: "error",
        })
        
        return res.status(422).json({ error: "UNREADABLE_IMAGES", files: webpFailed, message: "No files were converted successfully" })
      }

      logActivity({
        type: "conversion",
        action: "webp_to_png_complete",
        tool: "webp-to-png",
        conversionType: "webp-to-png",
        fileCount: convertedFiles.length,
        jobId: jobId,
        ip: req.clientIP,
        status: "success",
      })

      // Save meta for proper download filenames
      try {
        fs.writeFileSync(
          path.join(outputDir, `${jobId}-names.json`),
          JSON.stringify(convertedFiles.map(f => ({
            stored: f.stored,
            download: path.basename(f.originalName, path.extname(f.originalName)) + ".png"
          })))
        )
      } catch (_) {}

      res.json({
        success: true,
        message: `${convertedFiles.length} WEBP image(s) converted to PNG successfully`,
        jobId: jobId,
        pageCount: convertedFiles.length,
        fileCount: convertedFiles.length, // the page used its own count → a skipped file made it save a lone PNG as ".zip"
        skipped: webpFailed.length ? webpFailed : undefined,
        files: convertedFiles.map(f => ({ url: `/uploads/${f.stored}`, originalName: f.originalName })),
      })
    } catch (error) {
      console.error("WEBP to PNG Error:", error)

      if (req.files) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        }
      }

      logActivity({
        type: "conversion",
        action: "webp_to_png_failed",
        tool: "webp-to-png",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })

      res.status(500).json({ error: error.message })
    }
  })

  app.get("/api/download/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params
      const uploadDir = "./uploads"

      console.log(`Download request for jobId: ${jobId}`)

      if (!fs.existsSync(uploadDir)) {
        console.error("Uploads directory not found")
        
        logActivity({
          type: "download",
          action: "download_failed",
          jobId: jobId,
          error: "Upload directory not found",
          ip: req.clientIP,
          status: "error",
        })
        
        return res.status(404).json({ error: "Upload directory not found" })
      }

      const files = fs.readdirSync(uploadDir)
      
      let convertedFiles = files
        .filter((f) => f.startsWith(`${jobId}-page-`) && f.endsWith(".png"))
        .sort((a, b) => {
          const numA = parseInt(a.match(/-page-(\d+)/)?.[1] || "0")
          const numB = parseInt(b.match(/-page-(\d+)/)?.[1] || "0")
          return numA - numB
        })

      // Readable names written by the converters (webp-to-png, pdf-to-png).
      let meta = []
      try {
        const mp = path.join(uploadDir, `${jobId}-names.json`)
        if (fs.existsSync(mp)) meta = JSON.parse(fs.readFileSync(mp, "utf8"))
      } catch (_) {}
      const nameFor = (stored, fallback) => (meta.find((m) => m.stored === stored) || {}).download || fallback

      // ?pages=1,3 — the pdf-to-png preview lets the user pick pages, but the
      // selection used to be ignored and every page was downloaded.
      if (req.query.pages) {
        const wanted = new Set(String(req.query.pages).split(",").map((p) => parseInt(p, 10)).filter((p) => p > 0))
        const picked = convertedFiles.filter((f) => wanted.has(parseInt(f.match(/-page-(\d+)/)?.[1] || "0")))
        if (picked.length) convertedFiles = picked
      }

      console.log(`Found ${convertedFiles.length} converted files for job ${jobId}`)

      if (convertedFiles.length === 0) {
        console.error(`No files found with pattern: ${jobId}-page-*.png`)
        
        logActivity({
          type: "download",
          action: "download_failed",
          jobId: jobId,
          error: "No files found for this job",
          ip: req.clientIP,
          status: "error",
        })
        
        return res.status(404).json({ 
          error: "No files found for this job",
          jobId: jobId,
          pattern: `${jobId}-page-*.png`
        })
      }

      if (convertedFiles.length === 1) {
        const filePath = path.join(uploadDir, convertedFiles[0])
        console.log(`Downloading single file: ${filePath}`)

        const downloadName = nameFor(convertedFiles[0], (meta[0] && meta[0].download) || "converted-image.png")

        logActivity({
          type: "download",
          action: "file_downloaded",
          jobId: jobId,
          filename: convertedFiles[0],
          fileCount: 1,
          ip: req.clientIP,
          userAgent: req.headers["user-agent"],
          status: "success",
        })

        return res.download(filePath, downloadName, (err) => {
          if (err) {
            console.error("Download error:", err)
          }
          setTimeout(() => {
            if (fs.existsSync(filePath)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
            // kept so the user can download again — sweepOldFiles() deletes it after 1h
          }, 1000)
        })
      }

      console.log(`Creating ZIP archive for ${convertedFiles.length} files`)
      
      // Per-request zip path: two quick clicks used to write the same file at once.
      const zipFilename = `converted-images-${jobId}-${Date.now()}.zip`
      const zipPath = path.join(uploadDir, zipFilename)
      let zipDownloadName = "converted-images.zip"
      try {
        const zp = path.join(uploadDir, `${jobId}-zipname.txt`)
        if (fs.existsSync(zp)) zipDownloadName = fs.readFileSync(zp, "utf8").trim() || zipDownloadName
      } catch (_) {}

      const output = fs.createWriteStream(zipPath)
      const archive = archiver("zip", { zlib: { level: 9 } })

      archive.on("error", (err) => {
        console.error("Archiver error:", err)
        throw err
      })

      archive.pipe(output)

      const used = new Set()
      for (let i = 0; i < convertedFiles.length; i++) {
        const filePath = path.join(uploadDir, convertedFiles[i])
        if (fs.existsSync(filePath)) {
          // Readable, unique entry names (was "converted-image-N.png" for everything).
          let filename = nameFor(convertedFiles[i], `converted-image-${i + 1}.png`)
          if (used.has(filename)) filename = filename.replace(/\.png$/i, `-${i + 1}.png`)
          used.add(filename)
          archive.file(filePath, { name: filename })
          console.log(`Added to ZIP: ${filename}`)
        }
      }

      await archive.finalize()

      await new Promise((resolve, reject) => {
        output.on("close", () => {
          console.log(`ZIP created: ${archive.pointer()} bytes`)
          resolve()
        })
        output.on("error", reject)
      })

      logActivity({
        type: "download",
        action: "zip_downloaded",
        jobId: jobId,
        filename: zipFilename,
        fileCount: convertedFiles.length,
        size: archive.pointer(),
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "success",
      })

      res.download(zipPath, zipDownloadName, (err) => {
        if (err) {
          console.error("ZIP download error:", err)
        }
        
        setTimeout(() => {
          try {
            if (fs.existsSync(zipPath)) {
              fs.unlinkSync(zipPath)
              console.log(`Cleaned up ZIP: ${zipPath}`)
            }
            
            for (const file of convertedFiles) {
              const filePath = path.join(uploadDir, file)
              if (fs.existsSync(filePath)) {
                // kept so the user can download again — sweepOldFiles() deletes it after 1h
                // kept so the user can download again — sweepOldFiles() deletes it after 1h
              }
            }
          } catch (cleanupError) {
            console.error("Cleanup error:", cleanupError)
          }
        }, 1000)
      })
    } catch (error) {
      console.error("Download endpoint error:", error)
      console.error("Stack:", error.stack)
      
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: req.params.jobId,
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to download files",
          details: error.message 
        })
      }
    }
  })

  // REMAINING ENDPOINTS - Add these to the main server.js file

  // ============================================
  // SPLIT PDF ENDPOINTS
  // ============================================

  // Analyze PDF and generate thumbnails
  app.post("/api/analyze-pdf", upload.single("file"), fileSizeLimiter("split-pdf"), fileValidation, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" })
      }

      logActivity({
        type: "upload",
        action: "pdf_uploaded",
        tool: "split-pdf",
        filename: req.file.originalname,
        fileSize: req.file.size,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log("Analyze PDF - File received:", req.file.originalname)

      const inputPath = req.file.path
      const jobId = genJobId()
      const thumbnailDir = path.join(__dirname, "uploads", "thumbnails", jobId)
      
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true })
      }

      try {
        // Throws PASSWORD_PROTECTED / CORRUPT_PDF (was: garbage "success" for locked files).
        const pdfDoc = await loadPdfForEditing(inputPath, req.file.originalname)
        const pageCount = pdfDoc.getPageCount()

        console.log(`PDF has ${pageCount} pages`)

        const gsPath = getGhostscriptPath()
        const thumbnails = []
        
        try {
          const outputPattern = path.join(thumbnailDir, `page-%d.png`)
          const command = `"${gsPath}" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r36 -dFirstPage=1 -dLastPage=${Math.min(pageCount, 50)} -sOutputFile="${outputPattern}" "${inputPath}"`
          
          await execPromise(command, {
            timeout: 60000,
            maxBuffer: 50 * 1024 * 1024,
          })
          
          for (let i = 1; i <= Math.min(pageCount, 50); i++) {
            const thumbPath = path.join(thumbnailDir, `page-${i}.png`)
            if (fs.existsSync(thumbPath)) {
              thumbnails.push({
                pageNumber: i,
                url: `/uploads/thumbnails/${jobId}/page-${i}.png`,
              })
            }
          }
          
          console.log(`Generated ${thumbnails.length} thumbnails`)
        } catch (gsError) {
          console.error("Ghostscript thumbnail generation failed:", gsError)
        }

        // (No "-original.pdf" copy any more: nothing ever read it, it only kept
        // the user's document on disk.)
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath)
        }

        logActivity({
          type: "conversion",
          action: "pdf_analyzed",
          tool: "split-pdf",
          filename: req.file.originalname,
          pageCount: pageCount,
          jobId: jobId,
          ip: req.clientIP,
          status: "success",
        })

        res.json({
          success: true,
          jobId: jobId,
          pageCount: pageCount,
          thumbnails: thumbnails,
        })
      } catch (pdfError) {
        console.error("PDF analysis error:", pdfError)

        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath)
        }

        logActivity({
          type: "conversion",
          action: "pdf_analyze_failed",
          tool: "split-pdf",
          filename: req.file.originalname,
          error: pdfError.message,
          ip: req.clientIP,
          status: "error",
        })

        if (pdfError.code) {
          return res.status(422).json({ error: pdfError.code, message: pdfError.message, fileName: pdfError.fileName })
        }
        res.status(500).json({
          error: "Failed to analyze PDF",
          details: pdfError.message,
        })
      }
    } catch (error) {
      console.error("Error:", error)
      
      logActivity({
        type: "conversion",
        action: "pdf_analyze_failed",
        tool: "split-pdf",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // Split PDF - Extract specific pages
  app.post("/api/split-pdf", upload.single("file"), fileSizeLimiter("split-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" })
      }

      logActivity({
        type: "upload",
        action: "pdf_uploaded",
        tool: "split-pdf",
        filename: req.file.originalname,
        fileSize: req.file.size,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log("Split PDF - File received:", req.file.originalname)

      let selectedPages = []
      try {
        selectedPages = JSON.parse(req.body.pages || "[]")
      } catch (e) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(400).json({ error: "Invalid pages parameter" })
      }
      // Whole numbers only, no repeats: a crafted list like [1,1,1,…×100000] used
      // to be copied page by page (CPU/memory abuse) and 1.5 / "x" crashed with a 500.
      if (!Array.isArray(selectedPages)) selectedPages = []
      selectedPages = [...new Set(selectedPages.map(Number).filter((p) => Number.isInteger(p) && p >= 1))]

      if (selectedPages.length === 0) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(400).json({ error: "No pages selected for extraction" })
      }

      console.log(`Extracting pages: ${selectedPages.join(", ")}`)

      const inputPath = req.file.path
      const jobId = genJobId()
      const outputDir = path.join(__dirname, "uploads")
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
      const outputFilename = `${jobId}-split-${baseName}.pdf`
      const outputPath = path.join(outputDir, outputFilename)

      try {
        const pdfDoc = await loadPdfForEditing(inputPath, req.file.originalname)
        
        const newPdfDoc = await PDFLibDocument.create()
        
        const totalPages = pdfDoc.getPageCount()
        
        const validPages = selectedPages.filter(p => p >= 1 && p <= totalPages)
        
        if (validPages.length === 0) {
          const e = new Error("None of the selected pages exist in this PDF.")
          e.code = "NO_VALID_PAGES"
          throw e
        }
        
        const pageIndices = validPages.map(p => p - 1)
        const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices)
        
        copiedPages.forEach(page => {
          newPdfDoc.addPage(page)
        })
        
        const newPdfBytes = await newPdfDoc.save()
        fs.writeFileSync(outputPath, newPdfBytes)
        
        console.log(`Split PDF created: ${outputFilename} with ${validPages.length} pages`)

        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath)
        }

        const stats = fs.statSync(outputPath)

        // Attach to the user's "My Files" history when logged in (optionalAuth).
        if (req.user) {
          await recordUserFile({
            userId: req.user.id,
            plan: req.user.plan,
            tool: "split-pdf",
            originalName: `split-${baseName}.pdf`,
            jobId,
            storedPath: path.resolve(outputPath),
            downloadUrl: `/uploads/${outputFilename}`,
            fileSize: stats.size,
          })
        }

        logActivity({
          type: "conversion",
          action: "split_pdf_complete",
          tool: "split-pdf",
          conversionType: "split-pdf",
          filename: req.file.originalname,
          pageCount: validPages.length,
          jobId: jobId,
          ip: req.clientIP,
          status: "success",
        })

        res.json({
          success: true,
          message: `Successfully extracted ${validPages.length} page(s) from PDF`,
          jobId: jobId,
          downloadUrl: `/uploads/${outputFilename}`,
          convertedName: outputFilename,
          pageCount: validPages.length,
          extractedPages: validPages,
          originalPages: totalPages,
          fileSize: stats.size,
        })
      } catch (splitError) {
        console.error("PDF split error:", splitError)

        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath)
        }

        logActivity({
          type: "conversion",
          action: "split_pdf_failed",
          tool: "split-pdf",
          filename: req.file.originalname,
          error: splitError.message,
          ip: req.clientIP,
          status: "error",
        })

        if (splitError.code) {
          return res.status(splitError.code === "NO_VALID_PAGES" ? 400 : 422).json({ error: splitError.code, message: splitError.message, fileName: splitError.fileName })
        }
        res.status(500).json({
          error: "Failed to split PDF",
          details: splitError.message,
        })
      }
    } catch (error) {
      console.error("Error:", error)
      
      logActivity({
        type: "conversion",
        action: "split_pdf_failed",
        tool: "split-pdf",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // Download endpoint for split PDF
  app.get("/api/download-split/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params
      const uploadDir = "./uploads"

      const files = fs.readdirSync(uploadDir)
      const splitFile = files.find(f => f.startsWith(`${jobId}-split-`) && f.endsWith(".pdf"))

      if (!splitFile) {
        logActivity({
          type: "download",
          action: "download_failed",
          jobId: jobId,
          error: "Split PDF not found or expired",
          ip: req.clientIP,
          status: "warning",
        })
        
        return res.status(404).json({ error: "Split PDF not found or expired" })
      }

      const filePath = path.join(uploadDir, splitFile)
      const downloadName = splitFile.replace(`${jobId}-split-`, "split-")

      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: splitFile,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "success",
      })

      res.download(filePath, downloadName, (err) => {
        if (err) {
          console.error("Download error:", err)
          if (!res.headersSent) {
            res.status(500).json({ error: "Download failed" })
          }
        }
        
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (cleanupErr) {
            console.log("Cleanup error:", cleanupErr)
          }
        }, 5000)
      })
    } catch (error) {
      console.error("Download split error:", error)
      
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: req.params.jobId,
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })


// ── PDF TO WORD CONVERSION ENDPOINT ──────────────────────────────────────────
app.post("/api/pdf-to-word", upload.array("files", 500), fileSizeLimiter("pdf-to-word"), batchLimiter("pdf-to-word"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "pdfs_uploaded",
      tool: "pdf-to-word",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`PDF to Word — ${req.files.length} file(s) received`)

    const jobId = genJobId()
    const convertedDir = path.join(__dirname, "converted", jobId)
    if (!fs.existsSync(convertedDir)) {
      fs.mkdirSync(convertedDir, { recursive: true })
    }

    // Path to Python converter script (same folder as server.js)
    const PYTHON_SCRIPT = path.join(__dirname, "pdf_to_word_converter.py")
    // Allow override via .env: PYTHON_BIN=python3 or PYTHON_BIN=python
    // Auto-detect: Windows uses "python", Linux/Mac use "python3"
    const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3")

    const libreOfficePath = getLibreOfficePath()
    const convertedFiles = []
    const errors = []

    for (const file of req.files) {
      if (file.mimetype !== "application/pdf") {
        console.log(`Skipping non-PDF: ${file.originalname}`)
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
        continue
      }

      // originalname is already made shell-safe by safeUploadName(), so keep
      // non-Latin names (the old [^\w] filter turned "請求書" into "___").
      // Suffix duplicates so two files with the same name in one batch don't
      // overwrite each other.
      const rawBase = path.basename(file.originalname, path.extname(file.originalname))
      let baseName = rawBase.replace(/["`$\\]/g, "_").trim() || "converted"
      for (let n = 2; convertedFiles.some((c) => c.filename === `${baseName}.docx`); n++) {
        baseName = `${rawBase} (${n})`
      }
      const outputFilename = `${baseName}.docx`
      const outputPath = path.join(convertedDir, outputFilename)

      let converted = false
      let engine = ""

      // ── Strategy 1: Python pdf2docx (best layout preservation) ──────────
      if (fs.existsSync(PYTHON_SCRIPT)) {
        try {
          console.log(`[pdf2docx] Converting: ${file.originalname}`)

          // FIX #3: Use forward slashes for cross-platform shell safety
          const safePdfPath = file.path.replace(/\\/g, "/")
          const safeDocxPath = outputPath.replace(/\\/g, "/")
          const pyCmd = `"${PYTHON_BIN}" "${PYTHON_SCRIPT}" "${safePdfPath}" "${safeDocxPath}"`

          const { stdout, stderr } = await execPromise(pyCmd, {
            // 3 min, NOT 5: nginx cuts the request at 300s (proxy_read_timeout),
            // so a 5-minute wait here meant the LibreOffice fallback below
            // could never answer before the visitor got a gateway error.
            timeout: 180000,
            maxBuffer: 100 * 1024 * 1024,
          })

          // Log warnings from Python (e.g. scanned PDF notice)
          if (stderr && stderr.includes("WARNING:scanned_pdf")) {
            console.warn(`[pdf2docx] ⚠ Scanned PDF detected: ${file.originalname} — text extraction may be limited`)
          }
          if (stderr && !stderr.includes("WARNING:scanned_pdf")) {
            console.warn(`[pdf2docx] stderr: ${stderr}`)
          }

          if (stdout.includes("SUCCESS") && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
            converted = true
            engine = stdout.includes("pdf2docx") ? "pdf2docx" : "pdfplumber"
            console.log(`✓ [${engine}] Converted: ${file.originalname}`)
          } else {
            console.warn(`[pdf2docx] Script ran but output invalid. stdout: ${stdout}`)
          }
        } catch (pyErr) {
          console.warn(`[pdf2docx] Python conversion failed: ${pyErr.message}`)
        }
      } else {
        console.warn(`Python script not found at: ${PYTHON_SCRIPT}`)
      }

      // ── Strategy 2: LibreOffice fallback ────────────────────────────────
      if (!converted) {
        try {
          console.log(`[LibreOffice] Fallback conversion: ${file.originalname}`)

          // --infilter=writer_pdf_import is REQUIRED: without it LibreOffice opens a
          // PDF in Draw, which has no .docx export, and every fallback died with
          // "Error: no export filter" (so "all engines exhausted" for any PDF the
          // Python engine could not finish). No spaces/quotes inside the filter name.
          const loCmd = `"${libreOfficePath}" --headless --infilter=writer_pdf_import --convert-to docx --outdir "${convertedDir}" "${file.path}"`

          await runLibreOffice(loCmd, {
            timeout: 100000,
            maxBuffer: 100 * 1024 * 1024,
          })

          // FIX #2: LibreOffice names output after the INPUT file's basename (the temp upload name),
          // not the original filename. We must search for what LibreOffice actually created.
          // Use path.win32.basename to correctly handle both Windows and Unix paths.
          const tempBaseName = path.basename(file.path).replace(/\.[^.]+$/, "")
          const loOutputPath = path.join(convertedDir, `${tempBaseName}.docx`)

          if (fs.existsSync(loOutputPath)) {
            // Rename to our desired output filename (original name without timestamp prefix)
            if (loOutputPath !== outputPath) {
              fs.renameSync(loOutputPath, outputPath)
            }
            converted = true
            engine = "libreoffice"
            console.log(`✓ [LibreOffice] Converted: ${file.originalname}`)
          } else {
            // Also scan the directory for any newly created .docx (safety net)
            const allDocx = fs.readdirSync(convertedDir).filter(f => f.endsWith(".docx"))
            const newest = allDocx
              .map(f => ({ f, mt: fs.statSync(path.join(convertedDir, f)).mtimeMs }))
              .sort((a, b) => b.mt - a.mt)[0]

            if (newest && newest.mt > Date.now() - 30000) {
              const foundPath = path.join(convertedDir, newest.f)
              if (foundPath !== outputPath) fs.renameSync(foundPath, outputPath)
              converted = true
              engine = "libreoffice"
              console.log(`✓ [LibreOffice] Converted (found by scan): ${file.originalname}`)
            } else {
              console.error(`[LibreOffice] Output file not found. Expected: ${loOutputPath}`)
            }
          }
        } catch (loErr) {
          console.error(`[LibreOffice] Failed: ${loErr.message}`)
        }
      }

      // ── Final check ──────────────────────────────────────────────────────
      if (converted && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath)

        let pageCount = 1
        try {
          const pdfBytes = fs.readFileSync(file.path)
          const pdfDoc = await PDFLibDocument.load(pdfBytes, { ignoreEncryption: true })
          pageCount = pdfDoc.getPageCount()
        } catch (_) {}

        convertedFiles.push({
          filename: outputFilename,
          originalName: file.originalname,
          fileSize: stats.size,
          pageCount,
          engine,
        })

        console.log(`   Pages: ${pageCount}, Size: ${(stats.size / 1024).toFixed(1)} KB, Engine: ${engine}`)
      } else {
        console.error(`✗ All strategies failed for: ${file.originalname}`)
        errors.push({ file: file.originalname, error: "Conversion failed — all engines exhausted" })
      }

      // Cleanup uploaded PDF
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      } catch (_) {}
    }

    // All files failed
    if (convertedFiles.length === 0) {
      try {
        if (fs.existsSync(convertedDir)) fs.rmSync(convertedDir, { recursive: true, force: true })
      } catch (_) {}

      // No engine errors means nothing was extractable — almost always a
      // scanned/image PDF. Treat that as a "warning" (not a server error) and
      // point the user at OCR. A real engine failure stays an error.
      const isScannedInput = errors.length === 0

      logActivity({
        type: "conversion",
        action: isScannedInput ? "pdf_to_word_no_content" : "pdf_to_word_failed",
        tool: "pdf-to-word",
        error: isScannedInput
          ? "No extractable text (likely scanned PDF)"
          : errors.map(e => e.error).join("; "),
        ip: req.clientIP,
        status: isScannedInput ? "warning" : "error",
      })

      if (isScannedInput) {
        return res.status(422).json({
          error: "We couldn't find any selectable text in this PDF.",
          code: "NO_EXTRACTABLE_CONTENT",
          details: "This looks like a scanned or image-based PDF. Run it through our OCR PDF tool first to make the text selectable, then convert again.",
        })
      }

      return res.status(500).json({
        error: "No files were converted successfully.",
        details: errors.map(e => e.error).join("; "),
      })
    }

    logActivity({
      type: "conversion",
      action: "pdf_to_word_complete",
      tool: "pdf-to-word",
      conversionType: "pdf-to-word",
      fileCount: convertedFiles.length,
      jobId,
      ip: req.clientIP,
      status: "success",
    })

    if (req.user) {
      for (const cf of convertedFiles) {
        await recordUserFile({
          userId: req.user.id, plan: req.user.plan, tool: "pdf-to-word",
          originalName: cf.filename, jobId,
          storedPath: path.join(convertedDir, cf.filename),
          downloadUrl: `/api/download-word/${jobId}`,
          fileSize: cf.fileSize,
        }).catch(() => {})
      }
    }

    res.json({
      success: true,
      message: `${convertedFiles.length} PDF(s) converted to Word`,
      jobId,
      fileCount: convertedFiles.length,
      files: convertedFiles,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("PDF to Word Error:", error)

    if (req.files) {
      for (const file of req.files) {
        try {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
        } catch (_) {}
      }
    }

    logActivity({
      type: "conversion",
      action: "pdf_to_word_failed",
      tool: "pdf-to-word",
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    res.status(500).json({
      error: "Failed to convert PDF to Word",
      details: error.message,
    })
  }
})

// ── DOWNLOAD ENDPOINT FOR PDF TO WORD ────────────────────────────────────────
app.get("/api/download-word/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: jobId,
        error: "Files not found or expired",
        ip: req.clientIP,
        status: "warning",
      })
      return res.status(404).json({ error: "Files not found or expired. Please convert again." })
    }

    const files = fs.readdirSync(convertedDir).filter(f => f.endsWith(".docx"))

    if (files.length === 0) {
      return res.status(404).json({ error: "No converted Word files available" })
    }

    // ── Single file: direct download ──
    if (files.length === 1) {
      const filePath = path.join(convertedDir, files[0])
      const originalName = files[0]

      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: originalName,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "success",
      })

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(originalName)}"`)

      return res.download(filePath, originalName, (err) => {
        if (err) {
          console.error("Download error:", err)
          if (!res.headersSent) {
            res.status(500).json({ error: "Download failed" })
          }
        }
        setTimeout(() => {
          try {
            if (fs.existsSync(convertedDir)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (cleanupErr) {
            console.log("Cleanup error:", cleanupErr)
          }
        }, 5000)
      })
    }

    // ── Multiple files: ZIP ──
    const zipFilename = `converted-word-documents-${jobId}.zip`
    const downloadsDir = path.join(__dirname, "downloads")
    const zipPath = path.join(downloadsDir, zipFilename)

    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true })
    }

    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", { zlib: { level: 9 } })

    await new Promise((resolve, reject) => {
      output.on("close", resolve)
      output.on("error", reject)
      archive.on("error", reject)
      archive.pipe(output)
      files.forEach((file) => {
        archive.file(path.join(convertedDir, file), { name: file })
      })
      archive.finalize()
    })

    logActivity({
      type: "download",
      action: "zip_downloaded",
      jobId: jobId,
      fileCount: files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "success",
    })

    res.download(zipPath, zipFilename, (err) => {
      if (err) console.error("Download error:", err)
      setTimeout(() => {
        try {
          if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
          // kept so the user can download again — sweepOldFiles() deletes it after 1h
        } catch (cleanupErr) {
          console.log("Cleanup error:", cleanupErr)
        }
      }, 5000)
    })
  } catch (error) {
    console.error("Download Word Error:", error)

    logActivity({
      type: "download",
      action: "download_failed",
      jobId: req.params.jobId,
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download files", details: error.message })
    }
  }
})

  // ============================================
  // JPG TO PDF ENDPOINT
  // ============================================

  app.post("/api/jpg-to-pdf", upload.array("files", 500), fileSizeLimiter("jpg-to-pdf"), batchLimiter("jpg-to-pdf"), dailyConversionLimiter(), fileValidation, async (req, res) => {
    try {
      console.log("Files received:", req.files?.length) // ADD THIS LOG
      console.log("Request body:", req.body) // ADD THIS LOG
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      logActivity({
        type: "upload",
        action: "jpg_uploaded",
        tool: "jpg-to-pdf",
        fileCount: req.files.length,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log(`JPG to PDF - ${req.files.length} file(s) received`)

      const jobId = genJobId()
      const pageSize = req.body.pageSize || "a4"
      const orientation = req.body.orientation || "auto"

      // Use jobId for internal storage (download endpoint needs to find it),
      // but set a meaningful convertedName for the browser download
      const firstBaseName = path.basename(req.files[0].originalname, path.extname(req.files[0].originalname))
      const convertedName = req.files.length === 1
        ? `${firstBaseName}.pdf`
        : `${firstBaseName}-and-more.pdf`
      const outputFilename = `converted-images-${jobId}.pdf`
      const outputPath = path.join("./uploads", outputFilename)

      const pageSizes = {
        a4: { width: 595.28, height: 841.89 },
        letter: { width: 612, height: 792 },
        legal: { width: 612, height: 1008 },
      }

      const doc = new PDFDocument({
        autoFirstPage: false,
        margin: 0,
      })

      const writeStream = fs.createWriteStream(outputPath)
      doc.pipe(writeStream)

      let successCount = 0
      const failedFiles = []

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i]

        const ext = path.extname(file.originalname).toLowerCase()
        if (!file.mimetype.match(/^image\/(jpeg|jpg)$/i) && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.jfif' && ext !== '.jpe') {
          console.log(`Skipping non-JPG file: ${file.originalname}`)
          continue
        }

        try {
          // Decode + validate BEFORE adding a page (a bad image used to leave a
          // blank page behind, or fail the whole job with a 500).
          const prepared = await prepareImageForPdf(file.path)
          if (!prepared) {
            console.error(`Unreadable image: ${file.originalname}`)
            failedFiles.push(file.originalname)
            continue
          }
          let imgWidth = prepared.width
          let imgHeight = prepared.height
          let imgSource = prepared.source

          let pageWidth, pageHeight

          if (pageSize === "fit") {
            pageWidth = imgWidth * 0.75
            pageHeight = imgHeight * 0.75
          } else {
            const size = pageSizes[pageSize] || pageSizes.a4

            if (orientation === "auto") {
              const isLandscape = imgWidth > imgHeight
              pageWidth = isLandscape ? size.height : size.width
              pageHeight = isLandscape ? size.width : size.height
            } else if (orientation === "landscape") {
              pageWidth = size.height
              pageHeight = size.width
            } else {
              pageWidth = size.width
              pageHeight = size.height
            }
          }

          doc.addPage({ size: [pageWidth, pageHeight], margin: 0 })

          const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight)
          const scaledWidth = imgWidth * scale
          const scaledHeight = imgHeight * scale

          const x = (pageWidth - scaledWidth) / 2
          const y = (pageHeight - scaledHeight) / 2

          doc.image(imgSource, x, y, { width: scaledWidth, height: scaledHeight })

          successCount++
          console.log(`Added JPG ${successCount}/${req.files.length}: ${file.originalname}`)
        } catch (imgError) {
          console.error(`Error processing JPG ${file.originalname}:`, imgError)
          failedFiles.push(file.originalname)
        }
      }

      if (successCount === 0) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        }
        
        logActivity({
          type: "conversion",
          action: "jpg_to_pdf_failed",
          tool: "jpg-to-pdf",
          error: "No valid JPG images processed",
          ip: req.clientIP,
          status: "error",
        })
        
        // The images themselves are unreadable (not a server fault) → 422 + names.
        return res.status(422).json({ error: "UNREADABLE_IMAGES", files: failedFiles, message: "No valid JPG images were processed" })
      }

      doc.end()

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve)
        writeStream.on("error", reject)
      })

      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }

      console.log(`JPG to PDF - Created PDF with ${successCount} pages`)

      logActivity({
        type: "conversion",
        action: "jpg_to_pdf_complete",
        tool: "jpg-to-pdf",
        conversionType: "jpg-to-pdf",
        pageCount: successCount,
        jobId: jobId,
        ip: req.clientIP,
        status: "success",
      })

      // Save meta so download endpoint can return proper filename
      try {
        fs.writeFileSync(
          path.join("./uploads", `${jobId}-names.json`),
          JSON.stringify([{ stored: outputFilename, download: convertedName }])
        )
      } catch (_) {}

      res.json({
        success: true,
        message: `${successCount} JPG image(s) converted to PDF successfully`,
        jobId: jobId,
        downloadUrl: `/uploads/${outputFilename}`,
        convertedName: convertedName,
        skipped: failedFiles.length ? failedFiles : undefined,
        pageCount: successCount,
        fileCount: successCount,
      })
    } catch (error) {
      console.error("JPG to PDF Error:", error)
      console.error("Error stack:", error.stack)

      if (req.files) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        }
      }

      logActivity({
        type: "conversion",
        action: "jpg_to_pdf_failed",
        tool: "jpg-to-pdf",
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })

      res.status(500).json({
        error: "Failed to convert JPG to PDF",
        details: error.message,
      })
    }
  })

  // Download endpoint for JPG to PDF converted files
  app.get("/api/download-jpg-pdf/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params
      const uploadDir = "./uploads"

      const pdfFilename = `converted-images-${jobId}.pdf`
      const pdfPath = path.join(uploadDir, pdfFilename)

      if (!fs.existsSync(pdfPath)) {
        logActivity({
          type: "download",
          action: "download_failed",
          jobId: jobId,
          error: "PDF file not found",
          ip: req.clientIP,
          status: "warning",
        })
        
        return res.status(404).json({ error: "PDF file not found" })
      }

      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: pdfFilename,
        ip: req.clientIP,
        userAgent: req.headers["user-agent"],
        status: "success",
      })

      // Read meta for original download name
      const metaPath2 = path.join(uploadDir, `${jobId}-names.json`)
      let downloadName2 = "converted-images.pdf"
      try {
        if (fs.existsSync(metaPath2)) {
          const meta = JSON.parse(fs.readFileSync(metaPath2, "utf8"))
          downloadName2 = meta[0]?.download || downloadName2
        }
      } catch (_) {}

      res.download(pdfPath, downloadName2, (err) => {
        if (err) {
          console.error("Download error:", err)
        }
        if (fs.existsSync(pdfPath)) {
          // kept so the user can download again — sweepOldFiles() deletes it after 1h
        }
        // kept so the user can download again — sweepOldFiles() deletes it after 1h
      })
    } catch (error) {
      console.error("Download JPG PDF error:", error)
      
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: req.params.jobId,
        error: error.message,
        ip: req.clientIP,
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })
// PDF to Excel Conversion using pdfplumber
app.post("/api/pdf-to-excel", upload.array("files", 500), fileSizeLimiter("pdf-to-excel"), batchLimiter("pdf-to-excel"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "pdf_uploaded",
      tool: "pdf-to-excel",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`PDF to Excel - ${req.files.length} file(s) received`)

    const noContentFiles = []
    const failedFiles = []

    const jobId = genJobId()
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      fs.mkdirSync(convertedDir, { recursive: true })
    }

    const convertedFiles = []

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]
      const ext = path.extname(file.originalname).toLowerCase()

      if (ext !== ".pdf") {
        console.log(`Skipping non-PDF file: ${file.originalname}`)
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
        continue
      }

      // Suffix duplicates so same-named PDFs in one batch don't overwrite each other.
      const rawBase = path.basename(file.originalname, ext)
      let baseName = rawBase
      for (let n = 2; fs.existsSync(path.join(convertedDir, `${baseName}.xlsx`)); n++) baseName = `${rawBase} (${n})`
      const outputFilename = `${baseName}.xlsx`
      const expectedOutputPath = path.join(convertedDir, outputFilename)

      try {
        console.log(`Converting: ${file.originalname} to Excel...`)

        const inputPath = file.path.replace(/\\/g, '/')
        const outputPath = expectedOutputPath.replace(/\\/g, '/')

        // Ensure temp directory exists
        const tempDir = path.join(__dirname, 'temp')
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }

        const scriptPath = path.join(tempDir, `convert_${jobId}_${i}.py`)

        const pythonScript = `
import sys
import os
import re

def color_to_hex(color):
    """Convert pdfplumber color (grayscale/RGB/CMYK) to 6-char hex string."""
    if color is None:
        return None
    try:
        if isinstance(color, (int, float)):
            v = max(0, min(255, int(color * 255)))
            return f"{v:02X}{v:02X}{v:02X}"
        if isinstance(color, (list, tuple)):
            if len(color) == 3:
                r, g, b = [max(0, min(255, int(c * 255))) for c in color]
                return f"{r:02X}{g:02X}{b:02X}"
            if len(color) == 4:
                c, m, y, k = color
                r = max(0, min(255, int(255 * (1 - c) * (1 - k))))
                g = max(0, min(255, int(255 * (1 - m) * (1 - k))))
                b = max(0, min(255, int(255 * (1 - y) * (1 - k))))
                return f"{r:02X}{g:02X}{b:02X}"
    except Exception:
        pass
    return None

def is_bold(fontname):
    f = (fontname or '').lower()
    return any(kw in f for kw in ('bold', ',b', '-b', 'black', 'heavy', 'demi', 'semibold'))

def is_italic(fontname):
    f = (fontname or '').lower()
    return any(kw in f for kw in ('italic', 'oblique', ',i', '-i'))

def chars_in_bbox(chars, x0, top, x1, bottom, tol=2):
    return [c for c in chars
            if c['x0'] >= x0 - tol and c['x1'] <= x1 + tol
            and c['top'] >= top - tol and c['bottom'] <= bottom + tol]

def rects_in_bbox(rects, x0, top, x1, bottom, tol=3):
    return [r for r in rects
            if r['x0'] >= x0 - tol and r['x1'] <= x1 + tol
            and r['top'] >= top - tol and r['bottom'] <= bottom + tol]

def fill_behind(rects, x0, top, x1, bottom):
    """Background of a cell = the smallest filled rect covering its centre.
    Header rows are often ONE rect spanning every cell, which the old
    'rect inside the cell' test never matched."""
    cx, cy = (x0 + x1) / 2, (top + bottom) / 2
    hits = [r for r in rects if r['x0'] <= cx <= r['x1'] and r['top'] <= cy <= r['bottom']]
    if not hits:
        return None
    return min(hits, key=lambda r: (r['x1'] - r['x0']) * (r['bottom'] - r['top']))

def is_light(hex6):
    try:
        r, g, b = int(hex6[0:2], 16), int(hex6[2:4], 16), int(hex6[4:6], 16)
        return (0.299 * r + 0.587 * g + 0.114 * b) > 200
    except Exception:
        return False

def excel_font_name(fontname):
    """PDF font name (e.g. 'ABCDEF+Carlito-Bold', 'Helvetica') → a font Excel has."""
    f = (fontname or '').split('+', 1)[-1].lower()
    for keys, name in (
        (('calibri', 'carlito'), 'Calibri'), (('cambria', 'caladea'), 'Cambria'),
        (('arial', 'helvetica', 'liberationsans', 'liberation sans'), 'Arial'),
        (('times', 'liberationserif', 'liberation serif'), 'Times New Roman'),
        (('courier', 'liberationmono', 'liberation mono'), 'Courier New'),
        (('verdana',), 'Verdana'), (('tahoma',), 'Tahoma'), (('georgia',), 'Georgia'),
        (('segoe',), 'Segoe UI'), (('garamond',), 'Garamond'),
    ):
        if any(k in f for k in keys):
            return name
    return 'Calibri'

def write_text_line(ws, row, words):
    """A line of text outside any table (title, address, notes): one cell per
    phrase, phrases split where the gap is wider than a normal word space."""
    from openpyxl.styles import Font, Alignment
    words = sorted(words, key=lambda w: w['x0'])
    phrases = []
    for w in words:
        if phrases and w['x0'] - phrases[-1]['x1'] < max(6, (w.get('size') or 10) * 0.9):
            phrases[-1]['text'] += ' ' + w['text']
            phrases[-1]['x1'] = w['x1']
        else:
            phrases.append({'text': w['text'], 'x1': w['x1'], 'w': w})
    for col, ph in enumerate(phrases, 1):
        safe_cell_write(ws, row, col, ph['text'])
        w = ph['w']
        fn, fs = w.get('fontname', ''), w.get('size') or 11
        color = color_to_hex(w.get('non_stroking_color')) or '000000'
        if is_light(color):
            color = '000000'  # no background here — light text would be invisible
        ws.cell(row=row, column=col).font = Font(
            name=excel_font_name(fn), bold=is_bold(fn), italic=is_italic(fn),
            size=max(min(round(fs), 36), 8), color=color)
        ws.cell(row=row, column=col).alignment = Alignment(vertical='top')

def dominant(lst):
    if not lst:
        return None
    return max(set(lst), key=lst.count)

def cell_text_from_chars(chars, x0, top, x1, bottom):
    """Reconstruct multi-line cell text preserving line breaks."""
    cell_chars = chars_in_bbox(chars, x0, top, x1, bottom)
    if not cell_chars:
        return ''
    # Group by line (cluster by top coordinate)
    lines = {}
    for c in cell_chars:
        line_key = round(c['top'])
        lines.setdefault(line_key, []).append(c)
    result_lines = []
    for k in sorted(lines.keys()):
        line_chars = sorted(lines[k], key=lambda c: c['x0'])
        text = ''
        prev_x1 = None
        for c in line_chars:
            if prev_x1 is not None and c['x0'] - prev_x1 > 3:
                text += ' '
            text += c['text']
            prev_x1 = c['x1']
        result_lines.append(text)
    return '\\n'.join(result_lines).strip()

def detect_h_align(chars, cell_x0, cell_x1):
    if not chars or cell_x1 <= cell_x0:
        return 'left'
    mid = (cell_x0 + cell_x1) / 2
    # center of mass of all char midpoints
    avg = sum((c['x0'] + c['x1']) / 2 for c in chars) / len(chars)
    rel = (avg - cell_x0) / (cell_x1 - cell_x0)
    if rel < 0.35:
        return 'left'
    if rel > 0.65:
        return 'right'
    return 'center'

def sanitize_excel(val):
    """Remove characters illegal in Excel cells (openpyxl raises ValueError on them).
    openpyxl rejects Unicode control chars in ranges 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F.
    Also strips any remaining XML-illegal surrogate code points (Python 3.13 strict XML).
    """
    import re
    if not isinstance(val, str):
        return val
    # Strip XML-illegal control characters
    cleaned = re.sub(r'[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]', '', val)
    # Strip UTF-16 surrogates that openpyxl's XML writer rejects
    cleaned = re.sub(r'[\\ud800-\\udfff]', '', cleaned)
    return cleaned or None


NUM_RE = re.compile(r'^\\(?-?[$€£₹¥]?\\s?-?\\d{1,3}(?:[,\\s]\\d{3})*(?:\\.\\d+)?\\)?%?$|^\\(?-?[$€£₹¥]?\\s?-?\\d+(?:\\.\\d+)?\\)?%?$')

def to_number(text):
    """'1,234.56' / '(1,234.56)' / '₹1,200' / '-12' / '12.5%' → number, so Excel
    can SUM the column. IDs with leading zeros, dates, phone numbers and
    anything multi-line stay text."""
    s = text.strip()
    if not s or '\\n' in s or len(s) > 20 or not NUM_RE.match(s):
        return None
    neg = s.startswith('(') and s.endswith(')')
    core = s.strip('()').replace('$', '').replace('€', '').replace('£', '').replace('₹', '').replace('¥', '')
    pct = core.endswith('%')
    core = core.rstrip('%').replace(',', '').replace(' ', '')
    digits = core.lstrip('-')
    if len(digits) > 1 and digits[0] == '0' and not digits.startswith('0.'):
        return None
    try:
        v = float(core)
    except ValueError:
        return None
    if neg:
        v = -v
    if pct:
        v = v / 100
    return int(v) if v == int(v) and '.' not in core and not pct else v

def safe_cell_write(ws, row, col, value):
    """Write a value to an Excel cell, silently skipping illegal values."""
    try:
        if isinstance(value, str):
            n = to_number(value)
            if n is not None:
                c = ws.cell(row=row, column=col, value=n)
                if value.strip().endswith('%'):
                    c.number_format = '0.##%'
                elif ',' in value:
                    c.number_format = '#,##0.00' if '.' in value else '#,##0'
                return
        ws.cell(row=row, column=col, value=sanitize_excel(value) if isinstance(value, str) else value)
    except Exception:
        try:
            ws.cell(row=row, column=col, value=None)  # blank is better than a crash
        except Exception:
            pass

def write_word_layout(ws, words):
    """Lay words out on a grid by clustering their positions: x-starts within
    15 pt share a column, tops within 5 pt share a row. Used for text pages
    without ruled tables and for OCR'd (scanned) pages."""
    from openpyxl.styles import Font, Alignment
    x_starts = sorted(set(round(w['x0']) for w in words))
    col_buckets = []
    for x in x_starts:
        if not col_buckets or x - col_buckets[-1] > 15:
            col_buckets.append(x)
    y_tops = sorted(set(round(w['top']) for w in words))
    row_buckets = []
    for y in y_tops:
        if not row_buckets or y - row_buckets[-1] > 5:
            row_buckets.append(y)
    col_map = {x: min(range(len(col_buckets)), key=lambda i: abs(col_buckets[i] - x)) + 1 for x in x_starts}
    row_map = {y: min(range(len(row_buckets)), key=lambda i: abs(row_buckets[i] - y)) + 1 for y in y_tops}

    # Join words per cell first, THEN write — so "1,234" + ".56" style splits
    # become one value before the number conversion runs.
    cells = {}
    style = {}
    for w in sorted(words, key=lambda w: (round(w['top']), w['x0'])):
        key = (row_map.get(round(w['top']), 1), col_map.get(round(w['x0']), 1))
        cells[key] = (cells.get(key, '') + ' ' + w['text']).strip()
        style.setdefault(key, (w.get('fontname', ''), w.get('size', 11)))
    for (r, c), text in cells.items():
        safe_cell_write(ws, r, c, text)
        cell = ws.cell(row=r, column=c)
        fn, fs = style[(r, c)]
        cell.font = Font(name=excel_font_name(fn), bold=is_bold(fn), italic=is_italic(fn), size=max(min(round(fs or 11), 36), 10))
        cell.alignment = Alignment(vertical='top', wrap_text=True)

    for col_cells in ws.columns:
        max_len = max((len(str(c.value or '')) for c in col_cells), default=0)
        ws.column_dimensions[col_cells[0].column_letter].width = max(min(max_len + 2, 60), 8)

def convert_ocr_words(words_json, output_xlsx):
    """Scanned PDF: words come from Tesseract (via the Node route) as
    [[{text, x0, top}, ...] per page] in PDF points."""
    import json
    from openpyxl import Workbook
    pages = json.load(open(words_json, encoding='utf-8'))
    wb = Workbook()
    wb.remove(wb.active)
    has_content = False
    for i, words in enumerate(pages, 1):
        ws = wb.create_sheet(title=f"Page {i}")
        if words:
            has_content = True
            write_word_layout(ws, words)
    if not has_content:
        print("NO_TABLES_FOUND")
        return False
    wb.save(output_xlsx)
    print("SUCCESS")
    return True

def convert_pdf_to_excel(input_pdf, output_xlsx):
    try:
        import pdfplumber
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        from openpyxl.utils import get_column_letter

        print(f"Reading PDF: {input_pdf}")
        COL_WIDTH_FACTOR = 5.4   # pts -> Excel column width units (~1 char of 11 pt Calibri)
        ROW_HEIGHT_FACTOR = 0.75 # pts -> Excel row height pts

        wb = Workbook()
        wb.remove(wb.active)
        has_content = False

        with pdfplumber.open(input_pdf) as pdf:
            print(f"PDF has {len(pdf.pages)} pages")

            for page_num, page in enumerate(pdf.pages, 1):
                ws = wb.create_sheet(title=f"Page {page_num}")

                # Collect all characters and filled rectangles on this page
                all_chars = page.chars or []
                all_rects = [r for r in (page.rects or []) if r.get('fill') and r.get('non_stroking_color') is not None]

                # ── Try table extraction: prefer line-based, fall back to text-based ──
                found_tables = []
                text_based = False
                for strategy_idx, strategy in enumerate([
                    {"vertical_strategy": "lines",  "horizontal_strategy": "lines",  "snap_tolerance": 3, "join_tolerance": 3, "edge_min_length": 3},
                    {"vertical_strategy": "lines",  "horizontal_strategy": "lines",  "snap_tolerance": 5, "join_tolerance": 5, "edge_min_length": 3},
                    {"vertical_strategy": "text",   "horizontal_strategy": "lines",  "snap_tolerance": 3},
                    {"vertical_strategy": "text",   "horizontal_strategy": "text",   "snap_tolerance": 3},
                ]):
                    try:
                        found_tables = page.find_tables(strategy)
                        if found_tables:
                            # Tables guessed from text alignment (no ruling lines)
                            # get spurious empty rows between every data row.
                            text_based = strategy_idx >= 2
                            break
                    except Exception:
                        pass

                if found_tables:
                    current_xl_row = 1

                    # Text OUTSIDE the tables (invoice title, "Billed to", notes,
                    # totals written as plain text) used to be dropped. Put it
                    # in reading order with the tables.
                    boxes = [t.bbox for t in found_tables]
                    def in_tables(w):
                        cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
                        return any(b[0] - 2 <= cx <= b[2] + 2 and b[1] - 2 <= cy <= b[3] + 2 for b in boxes)
                    try:
                        loose = [w for w in (page.extract_words(x_tolerance=3, y_tolerance=3,
                                 extra_attrs=['fontname', 'size', 'non_stroking_color']) or []) if not in_tables(w)]
                    except Exception:
                        loose = []
                    text_lines = []
                    for w in sorted(loose, key=lambda w: (round(w['top']), w['x0'])):
                        if text_lines and abs(text_lines[-1][0] - w['top']) <= 3:
                            text_lines[-1][1].append(w)
                        else:
                            text_lines.append([w['top'], [w]])
                    blocks = [(t.bbox[1], 'table', t) for t in found_tables] + [(top, 'line', ws_) for top, ws_ in text_lines]
                    blocks.sort(key=lambda b: b[0])
                    prev_kind = None

                    for _, kind, tbl in blocks:
                        if kind == 'line':
                            has_content = True
                            write_text_line(ws, current_xl_row, tbl)
                            current_xl_row += 1
                            prev_kind = 'line'
                            continue
                        if prev_kind == 'line':
                            current_xl_row += 1  # blank row between text and a table
                        prev_kind = 'table'
                        # Collect all unique x and y boundaries from cells
                        xs = sorted(set(x for cell in tbl.cells for x in (cell[0], cell[2])))
                        ys = sorted(set(y for cell in tbl.cells for y in (cell[1], cell[3])))

                        if len(xs) < 2 or len(ys) < 2:
                            continue

                        has_content = True

                        # Set column widths proportional to PDF widths
                        for ci, (cx0, cx1) in enumerate(zip(xs[:-1], xs[1:]), 1):
                            col_letter = get_column_letter(ci)
                            w = max((cx1 - cx0) / COL_WIDTH_FACTOR, 6)
                            ws.column_dimensions[col_letter].width = w

                        # PDF row band → Excel row. For text-based tables, bands with
                        # no characters are dropped (they came out as a blank row
                        # after every data row); ruled tables keep real empty rows.
                        row_of = {}
                        next_row = current_xl_row
                        for ri, (ry0, ry1) in enumerate(zip(ys[:-1], ys[1:])):
                            if text_based and not any(
                                ry0 <= (c['top'] + c['bottom']) / 2 <= ry1 and xs[0] <= c['x0'] <= xs[-1]
                                for c in all_chars if c['text'].strip()
                            ):
                                row_of[ri] = None
                                continue
                            row_of[ri] = next_row
                            ws.row_dimensions[next_row].height = max((ry1 - ry0) * ROW_HEIGHT_FACTOR, 12)
                            next_row += 1

                        merged_done = set()

                        for cell_bbox in tbl.cells:
                            cx0, cy0, cx1, cy1 = cell_bbox

                            if cx0 not in xs or cx1 not in xs or cy0 not in ys or cy1 not in ys:
                                continue

                            xl_col = xs.index(cx0) + 1
                            first_ri = ys.index(cy0)
                            xl_row = row_of.get(first_ri)
                            if xl_row is None:
                                continue
                            col_span = xs.index(cx1) - xs.index(cx0)
                            covered = [row_of[r] for r in range(first_ri, ys.index(cy1)) if row_of.get(r) is not None]
                            row_span = (max(covered) - xl_row + 1) if covered else 1

                            if (xl_row, xl_col) in merged_done:
                                continue
                            merged_done.add((xl_row, xl_col))

                            # ── Cell text ──
                            cell_chars = chars_in_bbox(all_chars, cx0, cy0, cx1, cy1)
                            text = cell_text_from_chars(all_chars, cx0, cy0, cx1, cy1)

                            safe_cell_write(ws, xl_row, xl_col, text if text else None)
                            xl_cell = ws.cell(row=xl_row, column=xl_col)

                            # ── Font styling ──
                            fontnames = [c.get('fontname', '') for c in cell_chars if c.get('fontname')]
                            sizes     = [c.get('size', 11) for c in cell_chars if c.get('size') and c.get('size') > 0]
                            colors    = [c.get('non_stroking_color') for c in cell_chars if c.get('non_stroking_color') is not None]

                            fontname  = dominant(fontnames) or ''
                            raw_size  = dominant(sizes) or 11
                            # PDF sizes are in pts; enforce readable minimum of 10pt
                            # and cap at 36pt to avoid oversized headers blowing up layout
                            font_size = max(min(round(raw_size), 36), 10)
                            text_hex  = color_to_hex(dominant(colors)) or '000000'

                            # ── Background fill ──
                            bg_hex = None
                            bg_rect = fill_behind(all_rects, cx0, cy0, cx1, cy1)
                            if bg_rect:
                                bg_hex = color_to_hex(bg_rect.get('non_stroking_color'))
                                if bg_hex and bg_hex.upper() not in ('FFFFFF', 'FEFEFE', 'FDFDFD'):
                                    xl_cell.fill = PatternFill(start_color=bg_hex, end_color=bg_hex, fill_type='solid')
                                else:
                                    bg_hex = None
                            # White header text whose dark fill wasn't found would
                            # be invisible — fall back to black.
                            if not bg_hex and is_light(text_hex):
                                text_hex = '000000'

                            xl_cell.font = Font(
                                name=excel_font_name(fontname),
                                bold=is_bold(fontname),
                                italic=is_italic(fontname),
                                size=font_size,
                                color=text_hex,
                            )

                            # ── Alignment ──
                            h_align = detect_h_align(cell_chars, cx0, cx1)
                            xl_cell.alignment = Alignment(horizontal=h_align, vertical='center', wrap_text=True)

                            # ── Borders ──
                            xl_cell.border = Border(
                                left=Side(style='thin', color='AAAAAA'),
                                right=Side(style='thin', color='AAAAAA'),
                                top=Side(style='thin', color='AAAAAA'),
                                bottom=Side(style='thin', color='AAAAAA'),
                            )

                            # ── Merge cells ──
                            if col_span > 1 or row_span > 1:
                                end_col = xl_col + col_span - 1
                                end_row = xl_row + row_span - 1
                                try:
                                    ws.merge_cells(start_row=xl_row, start_column=xl_col,
                                                   end_row=end_row, end_column=end_col)
                                except Exception:
                                    pass
                                for mr in range(xl_row, end_row + 1):
                                    for mc in range(xl_col, end_col + 1):
                                        merged_done.add((mr, mc))

                        current_xl_row = next_row + 1   # table rows + 1 blank separator

                else:
                    # ── No table lines found: word-position layout ──
                    words = page.extract_words(
                        x_tolerance=4, y_tolerance=4,
                        keep_blank_chars=False, use_text_flow=False,
                    ) or []

                    if not words:
                        continue

                    has_content = True
                    write_word_layout(ws, words)

        if not has_content:
            print("NO_TABLES_FOUND")
            return False

        # Numbers are real numbers now, and Excel shows "###" when a number
        # doesn't fit its column — widen (never shrink) those columns.
        for sheet in wb.worksheets:
            need = {}
            for row in sheet.iter_rows():
                for c in row:
                    if isinstance(c.value, (int, float)) and not isinstance(c.value, bool):
                        size = (c.font.sz or 11) if c.font else 11
                        need[c.column_letter] = max(need.get(c.column_letter, 0), (len(f"{c.value:,.2f}") + 2) * size / 11)
            for col, w in need.items():
                dim = sheet.column_dimensions[col]
                if (dim.width or 8.43) < w:
                    dim.width = min(w, 40)

        wb.save(output_xlsx)
        print("SUCCESS")
        return True

    except ImportError as e:
        print(f"IMPORT_ERROR: {e}")
        print("Please install required packages: pip install pdfplumber openpyxl")
        return False
    except Exception as e:
        # Include the exception class: some (e.g. pdfminer's PDFPasswordIncorrect)
        # have an empty message, which left a bare "ERROR:" in the log.
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

# Run conversion
if __name__ == "__main__":
    # Paths come from argv (NOT interpolated into the source) so a filename with
    # odd bytes/quotes can never corrupt this script — that previously produced
    # "SyntaxError: source code cannot contain null bytes" and was an injection risk.
    if len(sys.argv) > 3:
        result = convert_ocr_words(sys.argv[3], sys.argv[2])
    else:
        result = convert_pdf_to_excel(sys.argv[1], sys.argv[2])
    sys.exit(0 if result else 1)
`

        fs.writeFileSync(scriptPath, pythonScript)

        // The script exits 1 for "no content" as well as for errors, and
        // execPromise rejects on any non-zero exit — so the NO_TABLES_FOUND
        // branch never ran and every failure (even crashes) was reported as
        // "scanned PDF". Read stdout whatever the exit code.
        const { execFile } = require("child_process")
        const PY_BIN = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3")
        const runPy = async (args) => {
          // UTF-8 stdout: printing a non-Latin file name crashed the script
          // with "'charmap' codec can't encode characters" on non-UTF-8 locales.
          const r = await util.promisify(execFile)(PY_BIN, [scriptPath, ...args], {
            timeout: 180000, maxBuffer: 100 * 1024 * 1024,
            env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
          }).catch((e) => e)
          if (r && r.killed) return "TIMEOUT"
          return String((r && r.stdout) || "")
        }

        let stdout = ""
        let usedOcr = false
        try {
          stdout = await runPy([inputPath, outputPath])

          // Scanned PDF (no text layer): OCR the pages and lay the recognised
          // words out on a grid — used to be a flat "not supported" for ~27%
          // of all PDF→Excel requests.
          if (stdout.includes("NO_TABLES_FOUND")) {
            const pages = await ocrPdfWords(file.path, PDF_EXCEL_OCR_MAX_PAGES)
            if (pages.some((p) => p.length)) {
              const wordsPath = path.join(tempDir, `words_${jobId}_${i}.json`)
              fs.writeFileSync(wordsPath, JSON.stringify(pages))
              try {
                stdout = await runPy([inputPath, outputPath, wordsPath])
              } finally {
                await safeUnlink(wordsPath)
              }
              usedOcr = stdout.includes("SUCCESS")
            }
          }
        } finally {
          await safeUnlink(scriptPath)
        }

        if (stdout.includes("SUCCESS") && fs.existsSync(expectedOutputPath)) {
          const stats = fs.statSync(expectedOutputPath)
          convertedFiles.push({
            filename: outputFilename,
            originalName: file.originalname,
            fileSize: stats.size,
            originalSize: file.size,
            ocr: usedOcr,
          })
          console.log(`✓ Converted${usedOcr ? " (OCR)" : ""}: ${file.originalname} -> ${outputFilename}`)
        } else if (stdout.includes("NO_TABLES_FOUND")) {
          noContentFiles.push(file.originalname)
          console.log(`⚠ No text found (even with OCR): ${file.originalname}`)
        } else {
          failedFiles.push(file.originalname)
          console.error(`✗ PDF→Excel failed for ${file.originalname}: ${stdout.slice(-400)}`)
        }

        // Cleanup original file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }

      } catch (convError) {
        console.error(`✗ Error converting ${file.originalname}:`, convError.message)
        failedFiles.push(file.originalname)

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    if (convertedFiles.length === 0) {
      if (fs.existsSync(convertedDir)) {
        fs.rmSync(convertedDir, { recursive: true, force: true })
      }

      // Only "nothing readable, even after OCR" is the user's input problem
      // (422, logged as a warning); anything else is our failure (500).
      const noContent = noContentFiles.length > 0 && failedFiles.length === 0
      logActivity({
        type: "conversion",
        action: noContent ? "pdf_to_excel_no_content" : "pdf_to_excel_failed",
        tool: "pdf-to-excel",
        error: noContent ? "No text found, even with OCR" : `Conversion failed: ${failedFiles.join(", ")}`,
        ip: req.clientIP,
        status: noContent ? "warning" : "error",
      })

      if (noContent) {
        return res.status(422).json({
          error: "NO_EXTRACTABLE_CONTENT",
          code: "NO_EXTRACTABLE_CONTENT",
          message: "We couldn't find any text in this PDF, even with OCR. It may be blank, a photo, or handwritten.",
        })
      }
      return res.status(500).json({
        error: "CONVERSION_FAILED",
        message: "We couldn't convert this PDF. It may be damaged or password-protected — please try another file.",
      })
    }

    logActivity({
      type: "conversion",
      action: "pdf_to_excel_complete",
      tool: "pdf-to-excel",
      conversionType: "pdf-to-excel",
      fileCount: convertedFiles.length,
      jobId: jobId,
      ip: req.clientIP,
      status: "success",
    })

    if (req.user) {
      for (const cf of convertedFiles) {
        await recordUserFile({
          userId: req.user.id, plan: req.user.plan, tool: "pdf-to-excel",
          originalName: cf.filename, jobId,
          storedPath: path.join(convertedDir, cf.filename),
          downloadUrl: `/api/download-excel/${jobId}`,
          fileSize: cf.fileSize,
        }).catch(() => {})
      }
    }

    res.json({
      success: true,
      message: `${convertedFiles.length} PDF file(s) converted to Excel successfully`,
      jobId: jobId,
      fileCount: convertedFiles.length,
      files: convertedFiles,
      ocrUsed: convertedFiles.some((f) => f.ocr),
    })

  } catch (error) {
    console.error("PDF to Excel Error:", error)

    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    logActivity({
      type: "conversion",
      action: "pdf_to_excel_failed",
      tool: "pdf-to-excel",
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    res.status(500).json({
      error: "Failed to convert PDF to Excel",
      details: error.message,
    })
  }
})

// Download endpoint for PDF to Excel
app.get("/api/download-excel/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      return res.status(404).json({ error: "Files not found or expired" })
    }

    const files = fs.readdirSync(convertedDir).filter(f => f.endsWith('.xlsx'))

    if (files.length === 0) {
      return res.status(404).json({ error: "No converted Excel files available" })
    }

    if (files.length === 1) {
      const filePath = path.join(convertedDir, files[0])
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      return res.download(filePath, files[0], (err) => {
        if (err) console.error("Download error:", err)

        setTimeout(() => {
          try {
            if (fs.existsSync(convertedDir)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (e) {}
        }, 5000)
      })
    }

    // Multiple files - ZIP
    const zipFilename = `excel-files-${jobId}.zip`
    const zipPath = path.join(__dirname, "downloads", zipFilename)

    if (!fs.existsSync(path.join(__dirname, "downloads"))) {
      fs.mkdirSync(path.join(__dirname, "downloads"), { recursive: true })
    }

    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", { zlib: { level: 9 } })

    await new Promise((resolve, reject) => {
      output.on("close", resolve)
      output.on("error", reject)
      archive.on("error", reject)
      archive.pipe(output)
      files.forEach(file => archive.file(path.join(convertedDir, file), { name: file }))
      archive.finalize()
    })

    res.download(zipPath, zipFilename, (err) => {
      setTimeout(() => {
        try {
          if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
          // kept so the user can download again — sweepOldFiles() deletes it after 1h
        } catch (e) {}
      }, 5000)
    })

  } catch (error) {
    console.error("Download error:", error)
    if (!res.headersSent) {
      res.status(500).json({ error: "Download failed", details: error.message })
    }
  }
})

// PPT to PDF Conversion using LibreOffice
app.post("/api/ppt-to-pdf", upload.array("files", 500), fileSizeLimiter("ppt-to-pdf"), batchLimiter("ppt-to-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PowerPoint files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "ppt_uploaded",
      tool: "ppt-to-pdf",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`PPT to PDF - ${req.files.length} file(s) received`)
    const protectedFiles = []

    const jobId = genJobId()
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      fs.mkdirSync(convertedDir, { recursive: true })
    }

    const libreOfficePath = getLibreOfficePath()
    const convertedFiles = []

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]

      // Get file extension
      const ext = path.extname(file.originalname).toLowerCase()
      const validExtensions = [".pptx", ".ppt", ".odp"]

      if (!validExtensions.includes(ext)) {
        console.log(`Skipping non-PowerPoint file: ${file.originalname}`)
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
        continue
      }

      // Suffix duplicates so same-named files in one batch don't overwrite each other.
      const rawBase = path.basename(file.originalname, ext)
      let baseName = rawBase
      for (let n = 2; fs.existsSync(path.join(convertedDir, `${baseName}.pdf`)); n++) baseName = `${rawBase} (${n})`
      const outputFilename = `${baseName}.pdf`
      const expectedOutputPath = path.join(convertedDir, outputFilename)

      // A password-protected .pptx is an encrypted OLE container (D0 CF 11 E0),
      // which LibreOffice can't open headless — it used to end in a generic 500.
      if (ext === ".pptx") {
        let head = ""
        try {
          const fd = fs.openSync(file.path, "r"); const b = Buffer.alloc(4)
          fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd); head = b.toString("hex")
        } catch (_) {}
        if (head === "d0cf11e0") {
          protectedFiles.push(file.originalname)
          await safeUnlink(file.path)
          continue
        }
      }

      try {
        console.log(`Converting: ${file.originalname} to PDF...`)

        // LibreOffice command for PPT to PDF conversion
        // Simple --convert-to pdf works best for presentations
        const command = `"${libreOfficePath}" --headless --convert-to pdf --outdir "${convertedDir}" "${file.path}"`

        console.log(`Executing: ${command}`)

        await runLibreOffice(command, {
          timeout: 300000, // 5 minutes for large presentations
          maxBuffer: 100 * 1024 * 1024,
        })

        // Check multiple possible output locations
        const possiblePaths = [
          expectedOutputPath,
          path.join(convertedDir, path.basename(file.path).replace(/\.(pptx|ppt|odp)$/i, ".pdf")),
          file.path.replace(/\.(pptx|ppt|odp)$/i, ".pdf"),
          path.join(path.dirname(file.path), path.basename(file.path).replace(/\.(pptx|ppt|odp)$/i, ".pdf"))
        ]

        let foundPath = null
        for (const checkPath of possiblePaths) {
          if (fs.existsSync(checkPath)) {
            foundPath = checkPath
            console.log(`Found converted file at: ${checkPath}`)
            break
          }
        }

        if (foundPath && foundPath !== expectedOutputPath) {
          fs.renameSync(foundPath, expectedOutputPath)
          console.log(`Moved file to: ${expectedOutputPath}`)
        }

        if (fs.existsSync(expectedOutputPath)) {
          const stats = fs.statSync(expectedOutputPath)

          convertedFiles.push({
            filename: outputFilename,
            originalName: file.originalname,
            fileSize: stats.size,
            originalSize: file.size,
          })

          console.log(`✓ Successfully converted: ${file.originalname} -> ${outputFilename}`)
          console.log(`  Original: ${(file.size / 1024).toFixed(1)} KB -> PDF: ${(stats.size / 1024).toFixed(1)} KB`)
        } else {
          console.error(`PDF file not found at expected path: ${expectedOutputPath}`)
          throw new Error("PDF file not created")
        }

        // Cleanup original file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      } catch (convError) {
        console.error(`✗ Error converting ${file.originalname}:`, convError.message)

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    if (convertedFiles.length === 0) {
      if (fs.existsSync(convertedDir)) {
        fs.rmSync(convertedDir, { recursive: true, force: true })
      }

      const allProtected = protectedFiles.length > 0 && protectedFiles.length === req.files.length
      logActivity({
        type: "conversion",
        action: allProtected ? "ppt_to_pdf_protected" : "ppt_to_pdf_failed",
        tool: "ppt-to-pdf",
        error: allProtected ? "Password-protected presentation" : "No files converted",
        ip: req.clientIP,
        status: allProtected ? "warning" : "error",
      })

      if (allProtected) {
        return res.status(422).json({
          error: "PASSWORD_PROTECTED",
          message: "This presentation is password-protected. Open it in PowerPoint, remove the password (File → Info → Protect Presentation), save, and upload it again.",
        })
      }
      return res.status(500).json({
        error: "CONVERSION_FAILED",
        message: "We couldn't convert this presentation. It may be damaged — open it in PowerPoint, save a new copy as .pptx and try again.",
      })
    }

    if (req.user) {
      for (const cf of convertedFiles) {
        await recordUserFile({
          userId: req.user.id, plan: req.user.plan, tool: "ppt-to-pdf",
          originalName: cf.filename, jobId,
          storedPath: path.join(convertedDir, cf.filename),
          downloadUrl: `/api/download-ppt-pdf/${jobId}`,
          fileSize: cf.fileSize,
        }).catch(() => {})
      }
    }

    logActivity({
      type: "conversion",
      action: "ppt_to_pdf_complete",
      tool: "ppt-to-pdf",
      conversionType: "ppt-to-pdf",
      fileCount: convertedFiles.length,
      jobId: jobId,
      ip: req.clientIP,
      status: "success",
    })

    res.json({
      success: true,
      message: `${convertedFiles.length} PowerPoint file(s) converted to PDF successfully`,
      jobId: jobId,
      fileCount: convertedFiles.length,
      files: convertedFiles,
    })
  } catch (error) {
    console.error("PPT to PDF Error:", error)

    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    logActivity({
      type: "conversion",
      action: "ppt_to_pdf_failed",
      tool: "ppt-to-pdf",
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    res.status(500).json({
      error: "Failed to convert PowerPoint to PDF",
      details: error.message,
    })
  }
})

// Download endpoint for PPT to PDF
app.get("/api/download-ppt-pdf/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: jobId,
        error: "Files not found or expired",
        ip: req.clientIP,
        status: "warning",
      })
      
      return res.status(404).json({ error: "Files not found or expired" })
    }

    const files = fs.readdirSync(convertedDir).filter(f => f.endsWith('.pdf'))

    if (files.length === 0) {
      return res.status(404).json({ error: "No converted PDF files available" })
    }

    // Single file - direct download
    if (files.length === 1) {
      const filePath = path.join(convertedDir, files[0])
      
      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: files[0],
        ip: req.clientIP,
        status: "success",
      })

      res.setHeader('Content-Type', 'application/pdf')

      return res.download(filePath, files[0], (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        // Cleanup after download
        setTimeout(() => {
          try {
            if (fs.existsSync(convertedDir)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (cleanupErr) {
            console.log("Cleanup error:", cleanupErr)
          }
        }, 5000)
      })
    }

    // Multiple files - create ZIP
    const zipFilename = `converted-pdfs-${jobId}.zip`
    const zipPath = path.join(__dirname, "downloads", zipFilename)

    if (!fs.existsSync(path.join(__dirname, "downloads"))) {
      fs.mkdirSync(path.join(__dirname, "downloads"), { recursive: true })
    }

    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", { zlib: { level: 9 } })

    await new Promise((resolve, reject) => {
      output.on("close", resolve)
      output.on("error", reject)
      archive.on("error", reject)

      archive.pipe(output)

      files.forEach((file) => {
        const filePath = path.join(convertedDir, file)
        archive.file(filePath, { name: file })
      })

      archive.finalize()
    })

    logActivity({
      type: "download",
      action: "zip_downloaded",
      jobId: jobId,
      fileCount: files.length,
      ip: req.clientIP,
      status: "success",
    })

    res.download(zipPath, zipFilename, (err) => {
      if (err) {
        console.error("Download error:", err)
      }

      setTimeout(() => {
        try {
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath)
          }
          if (fs.existsSync(convertedDir)) {
            // kept so the user can download again — sweepOldFiles() deletes it after 1h
          }
        } catch (cleanupErr) {
          console.log("Cleanup error:", cleanupErr)
        }
      }, 5000)
    })
  } catch (error) {
    console.error("Download PPT PDF Error:", error)
    
    logActivity({
      type: "download",
      action: "download_failed",
      jobId: req.params.jobId,
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download files", details: error.message })
    }
  }
})
// PDF to PowerPoint Conversion using LibreOffice
app.post("/api/pdf-to-ppt", upload.array("files", 500), fileSizeLimiter("pdf-to-ppt"), batchLimiter("pdf-to-ppt"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "pdf_uploaded_for_ppt",
      tool: "pdf-to-ppt",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`PDF to PPT - ${req.files.length} file(s) received`)
    const protectedFiles = []

    const jobId = genJobId()
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      fs.mkdirSync(convertedDir, { recursive: true })
    }

    const libreOfficePath = getLibreOfficePath()
    const convertedFiles = []

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]

      // Get file extension
      const ext = path.extname(file.originalname).toLowerCase()

      if (ext !== ".pdf") {
        console.log(`Skipping non-PDF file: ${file.originalname}`)
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
        continue
      }

      // Suffix duplicates so same-named PDFs in one batch don't overwrite each other.
      const rawBase = path.basename(file.originalname, ext)
      let baseName = rawBase
      for (let n = 2; fs.existsSync(path.join(convertedDir, `${baseName}.pptx`)); n++) baseName = `${rawBase} (${n})`
      const outputFilename = `${baseName}.pptx`
      const expectedOutputPath = path.join(convertedDir, outputFilename)

      // Encrypted PDF? Only counts as "password-protected" if the conversion
      // then fails — permissions-only encryption opens fine and converts.
      let isEncrypted = false
      try {
        await PDFLibDocument.load(fs.readFileSync(file.path))
      } catch (e) {
        isEncrypted = /encrypt/i.test(e.message)
      }

      try {
        console.log(`Converting: ${file.originalname} to PPTX...`)

        let conversionSuccess = false

        // Method 1: Direct PDF to PPTX with impress_pdf_import filter
        try {
          const command = `"${libreOfficePath}" --headless --infilter="impress_pdf_import" --convert-to pptx --outdir "${convertedDir}" "${file.path}"`
          console.log(`Executing Method 1: ${command}`)

          await runLibreOffice(command, {
            timeout: 300000,
            maxBuffer: 100 * 1024 * 1024,
          })
          
          // Check if output was created
          const possiblePaths = [
            expectedOutputPath,
            path.join(convertedDir, path.basename(file.path).replace(/\.pdf$/i, ".pptx")),
          ]
          
          for (const checkPath of possiblePaths) {
            if (fs.existsSync(checkPath)) {
              if (checkPath !== expectedOutputPath) {
                fs.renameSync(checkPath, expectedOutputPath)
              }
              conversionSuccess = true
              break
            }
          }
        } catch (method1Error) {
          console.log(`Method 1 failed: ${method1Error.message}`)
        }

        // Method 2: Try via draw_pdf_import filter
        if (!conversionSuccess) {
          try {
            console.log(`Trying Method 2: draw_pdf_import filter...`)
            const command2 = `"${libreOfficePath}" --headless --infilter="draw_pdf_import" --convert-to pptx --outdir "${convertedDir}" "${file.path}"`
            
            await runLibreOffice(command2, {
              timeout: 300000,
              maxBuffer: 100 * 1024 * 1024,
            })

            const possiblePaths = [
              expectedOutputPath,
              path.join(convertedDir, path.basename(file.path).replace(/\.pdf$/i, ".pptx")),
            ]
            
            for (const checkPath of possiblePaths) {
              if (fs.existsSync(checkPath)) {
                if (checkPath !== expectedOutputPath) {
                  fs.renameSync(checkPath, expectedOutputPath)
                }
                conversionSuccess = true
                break
              }
            }
          } catch (method2Error) {
            console.log(`Method 2 failed: ${method2Error.message}`)
          }
        }

        // Method 3: Convert via ODP intermediate format
        if (!conversionSuccess) {
          try {
            console.log(`Trying Method 3: Via ODP intermediate...`)
            
            const odpOutputName = path.basename(file.path).replace(/\.pdf$/i, ".odp")
            const odpPath = path.join(convertedDir, odpOutputName)
            
            const command3 = `"${libreOfficePath}" --headless --infilter="impress_pdf_import" --convert-to odp --outdir "${convertedDir}" "${file.path}"`
            
            await runLibreOffice(command3, {
              timeout: 300000,
              maxBuffer: 100 * 1024 * 1024,
            })

            // Check for ODP file
            let foundOdpPath = null
            const odpPossiblePaths = [
              odpPath,
              path.join(convertedDir, path.basename(file.path).replace(/\.pdf$/i, ".odp")),
            ]
            
            for (const checkPath of odpPossiblePaths) {
              if (fs.existsSync(checkPath)) {
                foundOdpPath = checkPath
                break
              }
            }

            if (foundOdpPath) {
              // Convert ODP to PPTX
              const command4 = `"${libreOfficePath}" --headless --convert-to pptx --outdir "${convertedDir}" "${foundOdpPath}"`
              
              await runLibreOffice(command4, {
                timeout: 300000,
                maxBuffer: 100 * 1024 * 1024,
              })

              // Clean up ODP
              if (fs.existsSync(foundOdpPath)) {
                fs.unlinkSync(foundOdpPath)
              }

              // Check for PPTX output
              const pptxFromOdp = foundOdpPath.replace(/\.odp$/i, ".pptx")
              if (fs.existsSync(pptxFromOdp)) {
                if (pptxFromOdp !== expectedOutputPath) {
                  fs.renameSync(pptxFromOdp, expectedOutputPath)
                }
                conversionSuccess = true
              }
            }
          } catch (method3Error) {
            console.log(`Method 3 failed: ${method3Error.message}`)
          }
        }

        if (fs.existsSync(expectedOutputPath)) {
          const stats = fs.statSync(expectedOutputPath)

          convertedFiles.push({
            filename: outputFilename,
            originalName: file.originalname,
            fileSize: stats.size,
            originalSize: file.size,
          })

          console.log(`✓ Successfully converted: ${file.originalname} -> ${outputFilename}`)
          console.log(`  Original: ${(file.size / 1024).toFixed(1)} KB -> PPTX: ${(stats.size / 1024).toFixed(1)} KB`)
        } else {
          console.error(`PPTX file not found at expected path: ${expectedOutputPath}`)
          throw new Error("PPTX file not created")
        }

        // Cleanup original file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      } catch (convError) {
        console.error(`✗ Error converting ${file.originalname}:`, convError.message)
        if (isEncrypted) protectedFiles.push(file.originalname)

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    if (convertedFiles.length === 0) {
      if (fs.existsSync(convertedDir)) {
        fs.rmSync(convertedDir, { recursive: true, force: true })
      }

      const allProtected = protectedFiles.length > 0 && protectedFiles.length === req.files.length
      logActivity({
        type: "conversion",
        action: allProtected ? "pdf_to_ppt_protected" : "pdf_to_ppt_failed",
        tool: "pdf-to-ppt",
        error: allProtected ? "Password-protected PDF" : "No files converted",
        ip: req.clientIP,
        status: allProtected ? "warning" : "error",
      })

      if (allProtected) {
        return res.status(422).json({
          error: "PASSWORD_PROTECTED",
          message: "This PDF is password-protected. Remove the password with our Unlock PDF tool first, then convert it again.",
        })
      }
      return res.status(500).json({
        error: "CONVERSION_FAILED",
        message: "We couldn't convert this PDF. It may be damaged — please try another file.",
      })
    }

    if (req.user) {
      for (const cf of convertedFiles) {
        await recordUserFile({
          userId: req.user.id, plan: req.user.plan, tool: "pdf-to-ppt",
          originalName: cf.filename, jobId,
          storedPath: path.join(convertedDir, cf.filename),
          downloadUrl: `/api/download-ppt/${jobId}`,
          fileSize: cf.fileSize,
        }).catch(() => {})
      }
    }

    logActivity({
      type: "conversion",
      action: "pdf_to_ppt_complete",
      tool: "pdf-to-ppt",
      conversionType: "pdf-to-ppt",
      fileCount: convertedFiles.length,
      jobId: jobId,
      ip: req.clientIP,
      status: "success",
    })

    res.json({
      success: true,
      message: `${convertedFiles.length} PDF file(s) converted to PowerPoint successfully`,
      jobId: jobId,
      fileCount: convertedFiles.length,
      files: convertedFiles,
    })
  } catch (error) {
    console.error("PDF to PPT Error:", error)

    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    logActivity({
      type: "conversion",
      action: "pdf_to_ppt_failed",
      tool: "pdf-to-ppt",
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    res.status(500).json({
      error: "Failed to convert PDF to PowerPoint",
      details: error.message,
    })
  }
})

// Download endpoint for PDF to PPT
app.get("/api/download-ppt/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const convertedDir = path.join(__dirname, "converted", jobId)

    if (!fs.existsSync(convertedDir)) {
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: jobId,
        error: "Files not found or expired",
        ip: req.clientIP,
        status: "warning",
      })
      
      return res.status(404).json({ error: "Files not found or expired" })
    }

    const files = fs.readdirSync(convertedDir).filter(f => f.endsWith('.pptx'))

    if (files.length === 0) {
      return res.status(404).json({ error: "No converted PowerPoint files available" })
    }

    // Single file - direct download
    if (files.length === 1) {
      const filePath = path.join(convertedDir, files[0])
      
      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: files[0],
        ip: req.clientIP,
        status: "success",
      })

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')

      return res.download(filePath, files[0], (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        // Cleanup after download
        setTimeout(() => {
          try {
            if (fs.existsSync(convertedDir)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (cleanupErr) {
            console.log("Cleanup error:", cleanupErr)
          }
        }, 5000)
      })
    }

    // Multiple files - create ZIP
    const zipFilename = `converted-presentations-${jobId}.zip`
    const zipPath = path.join(__dirname, "downloads", zipFilename)

    if (!fs.existsSync(path.join(__dirname, "downloads"))) {
      fs.mkdirSync(path.join(__dirname, "downloads"), { recursive: true })
    }

    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", { zlib: { level: 9 } })

    await new Promise((resolve, reject) => {
      output.on("close", resolve)
      output.on("error", reject)
      archive.on("error", reject)

      archive.pipe(output)

      files.forEach((file) => {
        const filePath = path.join(convertedDir, file)
        archive.file(filePath, { name: file })
      })

      archive.finalize()
    })

    logActivity({
      type: "download",
      action: "zip_downloaded",
      jobId: jobId,
      fileCount: files.length,
      ip: req.clientIP,
      status: "success",
    })

    res.download(zipPath, zipFilename, (err) => {
      if (err) {
        console.error("Download error:", err)
      }

      setTimeout(() => {
        try {
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath)
          }
          if (fs.existsSync(convertedDir)) {
            // kept so the user can download again — sweepOldFiles() deletes it after 1h
          }
        } catch (cleanupErr) {
          console.log("Cleanup error:", cleanupErr)
        }
      }, 5000)
    })
  } catch (error) {
    console.error("Download PPT Error:", error)
    
    logActivity({
      type: "download",
      action: "download_failed",
      jobId: req.params.jobId,
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download files", details: error.message })
    }
  }
})

//UNLOCK PDF ENDPOINT 

const { exec: execSync } = require("child_process")

// Helper function to check if qpdf is installed
async function checkQpdfInstalled() {
  try {
    await execPromise('qpdf --version')
    return true
  } catch (error) {
    return false
  }
}

// Unlock PDF - Remove password and restrictions while preserving ALL content
app.post("/api/unlock-pdf", upload.array("files", 20), fileSizeLimiter("unlock-pdf"), batchLimiter("unlock-pdf"), dailyConversionLimiter(), fileValidation, virusScan, optionalAuth, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "pdf_uploaded_for_unlock",
      tool: "unlock-pdf",
      fileCount: req.files.length,
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`Unlock PDF - ${req.files.length} file(s) received`)

    // Parse passwords JSON
    let passwords = {}
    try {
      if (req.body.passwords) {
        passwords = JSON.parse(req.body.passwords)
      }
    } catch (e) {
      console.log("No passwords provided")
    }
    // The browser keys passwords by the file's real name, but multer's upload
    // step rewrote file.originalname through safeUploadName() — key the map
    // the same way so the lookup below still matches.
    if (passwords && typeof passwords === "object") {
      for (const [k, v] of Object.entries(passwords)) {
        const safeKey = safeUploadName(k)
        if (!(safeKey in passwords)) passwords[safeKey] = v
      }
    }

    const jobId = genJobId()
    const unlockedDir = path.join(__dirname, "unlocked", jobId)

    if (!fs.existsSync(unlockedDir)) {
      fs.mkdirSync(unlockedDir, { recursive: true })
    }

    // Check if qpdf is available
    const hasQpdf = await checkQpdfInstalled()

    if (!hasQpdf) {
      console.log("⚠️  WARNING: qpdf not installed. Install it for best results:")
      console.log("   Ubuntu/Debian: sudo apt-get install qpdf")
      console.log("   macOS: brew install qpdf")
      console.log("   Falling back to pdf-lib (may not fully remove all restrictions)")
    }

    const unlockedFiles = []
    const errors = []

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]
      const ext = path.extname(file.originalname).toLowerCase()

      if (ext !== ".pdf") {
        console.log(`Skipping non-PDF file: ${file.originalname}`)
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
        continue
      }

      const baseName = path.basename(file.originalname, ext)
      const outputFilename = `unlocked-${baseName}.pdf`
      const expectedOutputPath = path.join(unlockedDir, outputFilename)

      try {
        console.log(`\n🔓 Unlocking: ${file.originalname}...`)

        // Get password for this file if provided
        const filePassword = passwords[file.originalname] || ""

        let unlockSuccess = false
        // Set when qpdf says the open password is missing/wrong — then the
        // pdf-lib fallback is pointless (it can't decrypt; with ignoreEncryption
        // it just copies still-encrypted streams → blank/garbage pages).
        let passwordProblem = false

        // =========================================
        // METHOD 1: QPDF (BEST - Preserves everything perfectly)
        // =========================================
        if (hasQpdf && !unlockSuccess) {
          try {
            console.log(`   Trying qpdf...`)
            
            // No shell: the password is user input, passed as a plain argv
            // entry (the old shell quoting also broke on Windows). Without a
            // password, --decrypt still removes owner-only restrictions.
            const qpdfArgs = filePassword
              ? [`--password=${filePassword}`, "--decrypt", file.path, expectedOutputPath]
              : ["--decrypt", file.path, expectedOutputPath]
            try {
              await util.promisify(require("child_process").execFile)("qpdf", qpdfArgs, {
                timeout: 90000,
                maxBuffer: 200 * 1024 * 1024,
              })
            } catch (e) {
              // Exit code 3 = succeeded with warnings (common on slightly broken files).
              if (e.code !== 3) throw e
            }

            // Verify output exists and has content
            if (fs.existsSync(expectedOutputPath)) {
              const stats = fs.statSync(expectedOutputPath)
              
              if (stats.size > 0) {
                unlockSuccess = true
                console.log(`   ✅ qpdf succeeded - ${(stats.size / 1024).toFixed(1)} KB`)
              } else {
                console.log(`   ❌ qpdf created empty file`)
                fs.unlinkSync(expectedOutputPath)
              }
            }
          } catch (qpdfError) {
            // The error message echoes the full command line — never log the
            // user's PDF password (these are often bank-statement passwords).
            const safeMsg = filePassword ? String(qpdfError.message).split(filePassword).join('***') : qpdfError.message
            console.log(`   ❌ qpdf failed: ${safeMsg}`)

            // Check for specific error messages
            if (qpdfError.message.includes('invalid password')) passwordProblem = true
            
            // Clean up failed output
            if (fs.existsSync(expectedOutputPath)) {
              fs.unlinkSync(expectedOutputPath)
            }
          }
        }

        // =========================================
        // METHOD 2: pdf-lib CAREFUL COPY (Good - Preserves content)
        // =========================================
        if (!unlockSuccess && !passwordProblem) {
          try {
            console.log(`   Trying pdf-lib...`)
            
            const pdfBytes = fs.readFileSync(file.path)
            
            // Load the encrypted PDF
            let srcDoc
            if (filePassword) {
              try {
                srcDoc = await PDFLibDocument.load(pdfBytes, { 
                  password: filePassword,
                  ignoreEncryption: false // Try with password first
                })
              } catch (pwError) {
                // If password fails, try ignoring encryption
                srcDoc = await PDFLibDocument.load(pdfBytes, { 
                  ignoreEncryption: true 
                })
              }
            } else {
              srcDoc = await PDFLibDocument.load(pdfBytes, { 
                ignoreEncryption: true 
              })
            }

            const pageCount = srcDoc.getPageCount()
            console.log(`   PDF has ${pageCount} pages`)

            // Create a completely new PDF document
            const destDoc = await PDFLibDocument.create()

            // Copy METADATA first
            try {
              const title = srcDoc.getTitle()
              const author = srcDoc.getAuthor()
              const subject = srcDoc.getSubject()
              const keywords = srcDoc.getKeywords()
              
              if (title) destDoc.setTitle(title)
              if (author) destDoc.setAuthor(author)
              if (subject) destDoc.setSubject(subject)
              if (keywords) destDoc.setKeywords(keywords)
            } catch (metaError) {
              console.log(`   ⚠️  Could not copy metadata: ${metaError.message}`)
            }

            // Copy ALL pages with ALL content
            const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
            const copiedPages = await destDoc.copyPages(srcDoc, pageIndices)

            // Add each page to the new document
            for (const page of copiedPages) {
              destDoc.addPage(page)
            }

            // Save the new PDF WITHOUT any encryption
            const unlockedBytes = await destDoc.save({
              useObjectStreams: false,
              addDefaultPage: false,
              objectsPerTick: 50,
            })

            fs.writeFileSync(expectedOutputPath, unlockedBytes)

            // Verify output
            if (fs.existsSync(expectedOutputPath)) {
              const stats = fs.statSync(expectedOutputPath)
              
              if (stats.size > 1000) { // At least 1KB
                // Verify the PDF can be read
                try {
                  const testBytes = fs.readFileSync(expectedOutputPath)
                  const testDoc = await PDFLibDocument.load(testBytes)
                  const testPageCount = testDoc.getPageCount()
                  
                  if (testPageCount === pageCount) {
                    unlockSuccess = true
                    console.log(`   ✅ pdf-lib succeeded - ${pageCount} pages, ${(stats.size / 1024).toFixed(1)} KB`)
                  } else {
                    console.log(`   ❌ Page count mismatch: ${testPageCount} vs ${pageCount}`)
                    fs.unlinkSync(expectedOutputPath)
                  }
                } catch (verifyError) {
                  console.log(`   ❌ Output verification failed: ${verifyError.message}`)
                  fs.unlinkSync(expectedOutputPath)
                }
              } else {
                console.log(`   ❌ Output too small: ${stats.size} bytes`)
                fs.unlinkSync(expectedOutputPath)
              }
            }
          } catch (pdfLibError) {
            console.log(`   ❌ pdf-lib failed: ${pdfLibError.message}`)
            
            if (/password|encrypt/i.test(pdfLibError.message)) passwordProblem = true

            if (fs.existsSync(expectedOutputPath)) {
              fs.unlinkSync(expectedOutputPath)
            }
          }
        }


        if (unlockSuccess && fs.existsSync(expectedOutputPath)) {
          const stats = fs.statSync(expectedOutputPath)

          unlockedFiles.push({
            filename: outputFilename,
            originalName: file.originalname,
            unlockedName: outputFilename,
            fileSize: stats.size,
            originalSize: file.size,
          })

          console.log(`✅ Successfully unlocked: ${file.originalname}`)
        } else {
          // One error per file, with a code the page can localize.
          const code = passwordProblem ? (filePassword ? "WRONG_PASSWORD" : "NEEDS_PASSWORD") : "UNREADABLE"
          errors.push({
            filename: file.originalname,
            code,
            error: code === "WRONG_PASSWORD" ? "Wrong password. Please check it and try again."
              : code === "NEEDS_PASSWORD" ? "This PDF needs its open password. Enter it and try again."
              : "Could not read this PDF. The file may be damaged."
          })
          
          console.error(`❌ Failed to unlock: ${file.originalname}`)
        }

        // Cleanup original file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      } catch (unlockError) {
        console.error(`❌ Error unlocking ${file.originalname}:`, unlockError.message)

        errors.push({
          filename: file.originalname,
          error: unlockError.message
        })

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    // Check if any files were unlocked
    if (unlockedFiles.length === 0) {
      if (fs.existsSync(unlockedDir)) {
        fs.rmSync(unlockedDir, { recursive: true, force: true })
      }

      logActivity({
        type: "conversion",
        action: "unlock_pdf_failed",
        tool: "unlock-pdf",
        error: "No files unlocked",
        ip: req.clientIP,
        status: errors.length && errors.every(e => e.code !== "UNREADABLE") ? "warning" : "error",
      })
      
      const errorDetails = errors.length > 0 
        ? errors.map(e => `${e.filename}: ${e.error}`).join('; ')
        : 'Could not unlock any files. Check passwords and try again.'
      
      // User-input problem (password / damaged file), not a server fault.
      return res.status(422).json({ 
        error: "No files were unlocked.",
        details: errorDetails,
        errors: errors
      })
    }

    logActivity({
      type: "conversion",
      action: "unlock_pdf_complete",
      tool: "unlock-pdf",
      conversionType: "unlock-pdf",
      fileCount: unlockedFiles.length,
      jobId: jobId,
      ip: req.clientIP,
      status: "success",
    })

    console.log(`\n✅ UNLOCK COMPLETE: ${unlockedFiles.length}/${req.files.length} files`)

    // If single file, return direct download URL
    if (unlockedFiles.length === 1) {
      const singleFile = unlockedFiles[0]
      // jobId prefix: the bare "unlocked-<name>.pdf" was shared by everyone who
      // unlocked a same-named file (e.g. statement.pdf), so one user's download
      // could serve another user's document. The page names the download from
      // unlockedName, so the stored name can be unique.
      const storedName = `${jobId}-${singleFile.filename}`
      const uploadPath = path.join(__dirname, "uploads", storedName)
      fs.copyFileSync(path.join(unlockedDir, singleFile.filename), uploadPath)

      if (req.user) {
        await recordUserFile({
          userId: req.user.id,
          plan: req.user.plan,
          tool: "unlock-pdf",
          originalName: singleFile.filename,
          storedPath: path.resolve(uploadPath),
          downloadUrl: `/uploads/${storedName}`,
          fileSize: singleFile.fileSize,
        })
      }
      
      res.json({
        success: true,
        message: "PDF unlocked - all restrictions removed",
        jobId: jobId,
        fileCount: 1,
        downloadUrl: `/uploads/${storedName}`,
        files: unlockedFiles,
        errors: errors.length > 0 ? errors : undefined
      })
    } else {
      res.json({
        success: true,
        message: `${unlockedFiles.length} PDFs unlocked - all restrictions removed`,
        jobId: jobId,
        fileCount: unlockedFiles.length,
        files: unlockedFiles,
        errors: errors.length > 0 ? errors : undefined
      })
    }
  } catch (error) {
    console.error("❌ Unlock PDF Error:", error)

    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    logActivity({
      type: "conversion",
      action: "unlock_pdf_failed",
      tool: "unlock-pdf",
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })

    res.status(500).json({
      error: "Failed to unlock PDF",
      details: error.message,
    })
  }
})

// Download endpoint (unchanged)
app.get("/api/download-unlocked/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const unlockedDir = path.join(__dirname, "unlocked", jobId)

    if (!fs.existsSync(unlockedDir)) {
      logActivity({
        type: "download",
        action: "download_failed",
        jobId: jobId,
        error: "Files not found or expired",
        ip: req.clientIP,
        status: "warning",
      })
      
      return res.status(404).json({ error: "Files not found or expired" })
    }

    const files = fs.readdirSync(unlockedDir).filter(f => f.endsWith('.pdf'))

    if (files.length === 0) {
      return res.status(404).json({ error: "No unlocked PDF files available" })
    }

    // Single file - direct download
    if (files.length === 1) {
      const filePath = path.join(unlockedDir, files[0])
      
      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: files[0],
        ip: req.clientIP,
        status: "success",
      })

      res.setHeader('Content-Type', 'application/pdf')

      return res.download(filePath, files[0], (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        setTimeout(() => {
          try {
            if (fs.existsSync(unlockedDir)) {
              // kept so the user can download again — sweepOldFiles() deletes it after 1h
            }
          } catch (cleanupErr) {
            console.log("Cleanup error:", cleanupErr)
          }
        }, 5000)
      })
    }

    // Multiple files - create ZIP
    const zipFilename = `unlocked-pdfs-${jobId}.zip`
    const zipPath = path.join(__dirname, "downloads", zipFilename)

    if (!fs.existsSync(path.join(__dirname, "downloads"))) {
      fs.mkdirSync(path.join(__dirname, "downloads"), { recursive: true })
    }

    const output = fs.createWriteStream(zipPath)
    const archive = archiver("zip", { zlib: { level: 9 } })

    await new Promise((resolve, reject) => {
      output.on("close", resolve)
      output.on("error", reject)
      archive.on("error", reject)

      archive.pipe(output)

      files.forEach((file) => {
        const filePath = path.join(unlockedDir, file)
        archive.file(filePath, { name: file })
      })

      archive.finalize()
    })

    logActivity({
      type: "download",
      action: "zip_downloaded",
      jobId: jobId,
      fileCount: files.length,
      ip: req.clientIP,
      status: "success",
    })

    res.download(zipPath, zipFilename, (err) => {
      if (err) {
        console.error("Download error:", err)
      }

      setTimeout(() => {
        try {
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath)
          }
          if (fs.existsSync(unlockedDir)) {
            // kept so the user can download again — sweepOldFiles() deletes it after 1h
          }
        } catch (cleanupErr) {
          console.log("Cleanup error:", cleanupErr)
        }
      }, 5000)
    })
  } catch (error) {
    console.error("Download error:", error)
    
    logActivity({
      type: "download",
      action: "download_failed",
      jobId: req.params.jobId,
      error: error.message,
      ip: req.clientIP,
      status: "error",
    })
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download", details: error.message })
    }
  }
})

const nodemailer = require("nodemailer")

// Every submission sends an email — cap it so the form can't be used to burn
// the SMTP quota or flood the inbox.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: rateLimitKey, store: new SQLiteRateStore("contact"),
  message: { error: "Too many messages. Please try again in an hour." },
})
app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" })
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" })
    }

    // Log the contact form submission
    await logActivity({
      type: "contact",
      action: "contact_form_submitted",
      metadata: { name, email, subject },
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "success",
    })

   
    const transporter = nodemailer.createTransport({
       host: process.env.SMTP_HOST || "smtp.gmail.com",
     port: process.env.SMTP_PORT || 587,
       secure: false,
      auth: {
        user: process.env.SMTP_USER,   
        pass: process.env.SMTP_PASS,   
      },
     })
    
     await transporter.sendMail({
       from: `"SmallPDF Contact" <${process.env.SMTP_USER}>`,
       to: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
       replyTo: email,
      subject: `[Contact] ${subject} — from ${name}`,
       text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
       html: `
         <h2>New Contact Message</h2>
         <p><strong>Name:</strong> ${name}</p>
         <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
         <p><strong>Subject:</strong> ${subject}</p>
         <hr/>
         <p>${message.replace(/\n/g, "<br/>")}</p>
       `,
     })

    console.log(`📧 Contact form: ${name} <${email}> — "${subject}"`)

    return res.status(200).json({
      success: true,
      message: "Message received. We'll get back to you within 24 hours.",
    })
  } catch (error) {
    console.error("Contact form error:", error)

    await logActivity({
      type: "contact",
      action: "contact_form_failed",
      metadata: { error: error.message },
      ip: req.clientIP,
      userAgent: req.headers["user-agent"],
      status: "error",
    })

    return res.status(500).json({ error: "Failed to send message. Please try again." })
  }
})

// ─── OCR PDF ────────────────────────────────────────────────────────────────

const { createWorker } = require('tesseract.js')
const { PDFParse }     = require('pdf-parse')
const {
  PDFDocument: PDFLibOut,
  StandardFonts,
  PDFOperator,
  PDFOperatorNames,
  PDFNumber,
  TextRenderingMode,
  pushGraphicsState,
  popGraphicsState,
  setTextRenderingMode,
  degrees,
} = require('pdf-lib')

// Tesseract result (recognize(img, {}, { blocks: true })) → words in DISPLAY
// points (origin top-left). Every word sits on its LINE's baseline at a size
// taken from the line height, so words with descenders (y, p, g) don't drop.
// Shared by OCR PDF and Redact PDF (which re-adds text to rasterised pages).
function ocrWordsFromData(data, pxToPt) {
  const words = []
  const lines = (data.blocks || []).flatMap((b) => b.paragraphs || []).flatMap((p) => p.lines || [])
  for (const line of lines) {
    const bl = line.baseline
    const hasBl = bl && bl.x1 > bl.x0
    for (const w of line.words || []) {
      if (!w.text || !w.text.trim() || w.confidence <= 30) continue
      const cx = (w.bbox.x0 + w.bbox.x1) / 2
      const baseY = hasBl ? bl.y0 + ((bl.y1 - bl.y0) * (cx - bl.x0)) / (bl.x1 - bl.x0) : w.bbox.y1
      const top = Math.min(line.bbox.y0, w.bbox.y0)
      words.push({
        text: w.text.trim(),
        x0: w.bbox.x0 * pxToPt, x1: w.bbox.x1 * pxToPt,
        base: baseY * pxToPt,
        size: (Math.max(1, baseY - top) / 0.75) * pxToPt,
      })
    }
  }
  return words
}

// PDF→Excel fallback for scanned PDFs: OCR up to `maxPages` pages and return,
// per page, the words as { text, x0, top } in points (top-left origin) — the
// shape pdfplumber's extract_words() gives the Excel layout code.
const PDF_EXCEL_OCR_MAX_PAGES = 20
async function ocrPdfWords(pdfPath, maxPages) {
  let doc
  try {
    doc = await PDFLibOut.load(fs.readFileSync(pdfPath), { ignoreEncryption: true })
  } catch (_) {
    return []
  }
  const n = Math.min(doc.getPageCount(), maxPages)
  const gsPath = getGhostscriptPath()
  const pages = []
  const worker = await createWorker('eng')
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '3' })
    for (let i = 0; i < n; i++) {
      const disp = displaySize(doc.getPage(i))
      const dpi = safeRenderDpi(disp.width, disp.height, 300, 35e6)
      const png = path.join(path.dirname(pdfPath), `${genJobId()}-xocr-${i + 1}.png`)
      try {
        await execPromise(
          `"${gsPath}" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pnggray -r${dpi} -dFirstPage=${i + 1} -dLastPage=${i + 1} -sOutputFile="${png}" "${pdfPath}"`,
          { timeout: 90000, maxBuffer: 50 * 1024 * 1024 }
        )
        const { data } = await worker.recognize(png, {}, { blocks: true })
        // Join words that sit on the same line with a normal word gap into one
        // phrase — otherwise "Customer: Ravi Sharma" lands in three columns.
        // A wide gap (a real column break) still starts a new cell.
        const phrases = []
        for (const w of ocrWordsFromData(data, 72 / dpi)) {
          const last = phrases[phrases.length - 1]
          const sameLine = last && Math.abs(last.base - w.base) < w.size * 0.35
          if (sameLine && w.x0 - last.x1 < w.size * 0.9) {
            last.text += ' ' + w.text
            last.x1 = w.x1
          } else {
            phrases.push({ ...w })
          }
        }
        pages.push(phrases.map((w) => ({ text: w.text, x0: w.x0, top: w.base - w.size * 0.8 })))
      } catch (e) {
        console.warn(`[pdf-to-excel OCR] page ${i + 1}: ${e.message}`)
        pages.push([])
      } finally {
        try { fs.unlinkSync(png) } catch (_) {}
      }
    }
  } finally {
    await worker.terminate().catch(() => {})
  }
  return pages
}

// Draw OCR words as an invisible text layer (render mode 3, like Acrobat /
// ocrmypdf) so the page becomes searchable and selectable. Each word is
// stretched to its scanned width so selection highlights line up; display
// coordinates are mapped back into the page's unrotated space.
function drawInvisibleWords(page, font, words) {
  const { width: pw, height: ph } = page.getSize()
  const { x: mx, y: my } = page.getMediaBox()
  const { rot } = displaySize(page)
  page.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible))
  for (const w of words) {
    const bw = w.x1 - w.x0
    if (bw <= 0) continue
    const size = Math.max(2, Math.min(w.size, 144))
    let natural
    try { natural = font.widthOfTextAtSize(w.text, size) } catch (_) { continue } // glyph outside WinAnsi
    if (!(natural > 0)) continue
    const scale = Math.max(10, Math.min(1000, (bw / natural) * 100))
    const dx = w.x0, dy = w.base
    let x, y, angle
    if (rot === 90)       { x = dy;      y = dx;      angle = 90 }
    else if (rot === 180) { x = pw - dx; y = dy;      angle = 180 }
    else if (rot === 270) { x = pw - dy; y = ph - dx; angle = 270 }
    else                  { x = dx;      y = ph - dy; angle = 0 }
    try {
      page.pushOperators(PDFOperator.of(PDFOperatorNames.SetTextHorizontalScaling, [PDFNumber.of(scale)]))
      page.drawText(w.text, { x: mx + x, y: my + y, size, font, rotate: degrees(angle) })
    } catch (_) {}
  }
  page.pushOperators(popGraphicsState())
}


// ── Daily OCR quota for free/guest users is now persisted in SQLite ──────────
// (ocrCheckDaily / ocrIncrementDaily imported from middleware/sqliteRateStore.js).
// Survives restarts and is shared across instances.

// ── Route ─────────────────────────────────────────────────────────────────────
app.post('/api/ocr-pdf',
  upload.single('file'),
  fileSizeLimiter('ocr-pdf'),
  batchLimiter('ocr-pdf'),
  dailyConversionLimiter(),
  fileValidation,
  virusScan,
  optionalAuth,
  async (req, res) => {
    const startTime = Date.now()
    const file = req.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    // ── Auth ────────────────────────────────────────────────────────────────
    // optionalAuth reads the plan from the DB (so a lapsed plan counts as free)
    const user = req.user || null
    // Desktop app: treat as Pro (no limits)
    const isDesktop = process.env.ELECTRON_APP === '1' || process.env.DESKTOP_FREE === '1'
    // Every paid plan gets the paid OCR limits — /pricing promises Starter
    // "100 MB · 10 files" for OCR, and fileSizeLimiter already allows it.
    const isPro = isDesktop || ['starter', 'pro', 'agency', 'enterprise'].includes(user?.plan)

    const filePath  = file.path
    const tmpFiles  = [] // temp page PNGs — deleted after OCR

    const cleanup = () => {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch (_) {}
      tmpFiles.forEach(f => { try { if (f && fs.existsSync(f)) fs.unlinkSync(f) } catch (_) {} })
    }

    try {
      // ── File size check ──────────────────────────────────────────────────
      const MAX_SIZE = isPro ? 100 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > MAX_SIZE) {
        cleanup()
        return res.status(413).json({
          error: 'FILE_TOO_LARGE',
          message: isPro
            ? 'File exceeds the 100 MB limit.'
            : 'Free plan allows up to 10 MB. Upgrade to Pro for 100 MB+ files.',
        })
      }

      // ── Daily limit (free users) ─────────────────────────────────────────
      if (!isPro && !(await ocrCheckDaily(req.clientIP))) {
        cleanup()
        return res.status(429).json({
          error: 'DAILY_LIMIT_REACHED',
          message: 'Free plan allows 1 OCR per day. Upgrade to Pro for unlimited OCR.',
        })
      }

      // ── Load once: page count, sizes, rotation ───────────────────────────
      let pdfBuffer = fs.readFileSync(filePath)
      let srcDoc
      let totalPages
      // getPageCount() is part of the check: a PDF with a broken page tree loads
      // fine and only throws here ("Expected instance of PDFDict…"), which used
      // to escape as a 500 "OCR processing failed".
      const loadSrc = async () => {
        srcDoc = await PDFLibOut.load(pdfBuffer, { ignoreEncryption: true })
        totalPages = srcDoc.getPageCount()
      }
      try {
        await loadSrc()
      } catch (_) {
        // Damaged structure: let qpdf rebuild the file once, then retry.
        const fixed = filePath + '.fixed.pdf'
        tmpFiles.push(fixed)
        try {
          await util.promisify(require('child_process').execFile)('qpdf', [filePath, fixed], { timeout: 90000 })
            .catch(() => { /* exit 3 = warnings, output is still written */ })
          if (!fs.existsSync(fixed) || fs.statSync(fixed).size === 0) throw new Error('qpdf produced nothing')
          fs.copyFileSync(fixed, filePath)
          pdfBuffer = fs.readFileSync(filePath)
          await loadSrc()
          console.log('[OCR] damaged PDF repaired with qpdf')
        } catch (_e) {
          cleanup()
          return res.status(400).json({ error: 'INVALID_PDF', message: 'Could not read the PDF. It may be corrupted or password-protected.' })
        }
      }

      // Free plan: max 2 pages
      if (totalPages > 2 && !isPro) {
        cleanup()
        return res.status(429).json({
          error: 'PAGE_LIMIT_EXCEEDED',
          message: `Free plan supports up to 2 pages. Your PDF has ${totalPages} pages. Upgrade to Pro for unlimited pages.`,
        })
      }

      const processedPages = totalPages

      // ── STEP 1: per-page existing text (digital pages need no OCR) ───────
      // pdf-parse v2 exports a PDFParse class; the old `pdfParse(buffer)` call
      // threw "not a function" and was silently swallowed, so every PDF went
      // through Tesseract.
      let pageTexts = new Array(processedPages).fill('')
      try {
        const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) })
        const parsed = await parser.getText()
        await parser.destroy().catch(() => {})
        for (const p of parsed.pages || []) {
          if (p.num >= 1 && p.num <= processedPages) pageTexts[p.num - 1] = (p.text || '').trim()
        }
      } catch (e) {
        console.warn('[OCR] text extraction skipped:', e.message)
      }
      // A page with only a stamp / page number is still a scan.
      const needsOcr = pageTexts.map((txt) => txt.replace(/\s+/g, '').length < 20)
      const ocrCount = needsOcr.filter(Boolean).length

      // ── STEP 2: OCR the pages that have no text layer ─────────────────────
      const ocrWords = new Array(processedPages).fill(null) // [{text,x0,x1,base,size}] in display points
      if (ocrCount > 0) {
        console.log(`[OCR] ${ocrCount}/${processedPages} page(s) need OCR`)
        const gsPath = getGhostscriptPath()
        const worker = await createWorker('eng')
        try {
          // Fully automatic segmentation without OSD — mode 1 needs osd.traineddata,
          // which isn't installed ("osd language failed to load" on every page).
          await worker.setParameters({ tessedit_pageseg_mode: '3' })
          for (let i = 0; i < processedPages; i++) {
            if (!needsOcr[i]) continue
            const disp = displaySize(srcDoc.getPage(i))
            const dpi = safeRenderDpi(disp.width, disp.height, 300, 35e6)
            const pngPath = path.join(path.dirname(filePath), `${genJobId()}-ocr-${i + 1}.png`)
            tmpFiles.push(pngPath)
            try {
              // Rendered at the page's own aspect ratio (pdf2pic forced every
              // page to 2480x3508, stretching landscape pages).
              await execPromise(
                `"${gsPath}" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pnggray -r${dpi} -dFirstPage=${i + 1} -dLastPage=${i + 1} -sOutputFile="${pngPath}" "${filePath}"`,
                { timeout: 90000, maxBuffer: 50 * 1024 * 1024 }
              )
              // tesseract.js v5+ only returns word boxes when blocks are requested;
              // without this every page came back with 0 words and the output
              // PDF had no text layer at all.
              const { data } = await worker.recognize(pngPath, {}, { blocks: true, text: true })
              const words = ocrWordsFromData(data, 72 / dpi)
              ocrWords[i] = words
              pageTexts[i] = (data.text || '').trim()
              console.log(`[OCR] Page ${i + 1} — ${words.length} words @${dpi}dpi`)
            } catch (pageErr) {
              console.error(`[OCR] Page ${i + 1} failed:`, pageErr.message)
            } finally {
              try { fs.unlinkSync(pngPath) } catch (_) {}
            }
          }
        } finally {
          await worker.terminate().catch(() => {})
        }
      }

      const extractedText = pageTexts.join('\f')

      if (!isPro) await ocrIncrementDaily(req.clientIP)

      const wordCount = extractedText.replace(/\f/g, ' ').split(/\s+/).filter(Boolean).length
      const timestamp = Date.now()
      const outDir    = './uploads'
      console.log(`[OCR] ${wordCount} words total across ${processedPages} page(s)`)

      // ── STEP 3: Build the output PDF ──────────────────────────────────────
      // The original pages are kept byte-for-byte (fonts, images, layout); an
      // invisible text layer (render mode 3, like Acrobat/ocrmypdf) is added on
      // OCR'd pages so they become searchable and selectable. Pages that
      // already had text are left untouched — overlaying them duplicated every
      // line in search results and copy/paste.
      // Unguessable (uploads/ is public; OCR inputs are often ID documents).
      const pdfOutPath = path.join(outDir, `ocr-${genJobId()}.pdf`)
      const font = await srcDoc.embedFont(StandardFonts.Helvetica)

      for (let i = 0; i < processedPages; i++) {
        const words = ocrWords[i]
        if (!words || !words.length) continue
        drawInvisibleWords(srcDoc.getPage(i), font, words)
      }

      const pdfBytes = await srcDoc.save()
      fs.writeFileSync(pdfOutPath, pdfBytes)

      const result = {
        pdfUrl:       `/uploads/${path.basename(pdfOutPath)}`,
        pageCount:    processedPages,
        wordCount,
        originalName: file.originalname,
        isImagePdf:   false,
        ocrPages:     ocrWords.filter((w) => w && w.length).length,
        alreadySearchable: ocrCount === 0,
      }

      // ── DOCX (Pro only) ──────────────────────────────────────────────────
      if (isPro) {
        const docxOutPath  = path.join(outDir, `ocr-${timestamp}.docx`)
        const cleanText    = extractedText.replace(/\f/g, '\n\n--- Page Break ---\n\n')
        const paragraphs   = cleanText
          .split(/\n+/)
          .map(line => new Paragraph({ children: [new TextRun({ text: line })] }))
        const docxDoc      = new Document({ sections: [{ children: paragraphs }] })
        fs.writeFileSync(docxOutPath, await Packer.toBuffer(docxDoc))
        result.docxUrl = `/uploads/${path.basename(docxOutPath)}`
      }

      // ── TXT (Pro only) ───────────────────────────────────────────────────
      if (isPro) {
        const txtOutPath = path.join(outDir, `ocr-${timestamp}.txt`)
        fs.writeFileSync(txtOutPath, extractedText.replace(/\f/g, '\n\n'), 'utf8')
        result.txtUrl = `/uploads/${path.basename(txtOutPath)}`
      }

      // Delete input + temp page images
      cleanup()

      await logActivity({
        type:      'ocr-pdf',
        action:    'ocr_success',
        metadata:  { pages: processedPages, words: wordCount, isPro },
        ip:        req.clientIP,
        userAgent: req.headers['user-agent'],
        status:    'success',
        duration:  Date.now() - startTime,
      })

      // Logged-in users get the PDF in "My Files" (kept for their plan's
      // retention window, cleaned up by the sweep instead of the 1 h timer).
      if (user?.id) {
        await recordUserFile({
          userId: user.id,
          plan: user.plan,
          tool: 'ocr-pdf',
          originalName: `${path.basename(file.originalname, path.extname(file.originalname))}-ocr.pdf`,
          storedPath: path.resolve(pdfOutPath),
          downloadUrl: result.pdfUrl,
          fileSize: pdfBytes.length,
        }).catch(() => {})
      }

      // Auto-delete output files after 1 hour
      const filesToDelete = [
        !user?.id && pdfOutPath,
        result.docxUrl && path.join('.', result.docxUrl),
        result.txtUrl  && path.join('.', result.txtUrl),
      ].filter(Boolean)
      setTimeout(() => {
        filesToDelete.forEach(f => {
          try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch (_) {}
        })
      }, 60 * 60 * 1000)

      return res.json(result)

    } catch (err) {
      cleanup()
      console.error('[OCR] Fatal error:', err)
      await logActivity({
        type:      'ocr-pdf',
        action:    'ocr_failed',
        metadata:  { error: err.message },
        ip:        req.clientIP,
        userAgent: req.headers['user-agent'],
        status:    'error',
      })
      return res.status(500).json({ error: 'OCR processing failed. Please try again.' })
    }
  }
)
  // ── Scheduled plan-expiry cleanup ────────────────────────────────────────
  // Runs every hour to downgrade users whose plan_expires_at has passed AND
  // whose Razorpay/Paddle renewal webhook failed to arrive (network issue,
  // server was down, misconfigured secret, etc.).
  // This is a safety net — normal renewals happen via webhooks.
  async function cleanupExpiredPlans() {
    try {
      const result = await dbRun(`
        UPDATE users
        SET plan = 'free', plan_expires_at = NULL
        WHERE plan != 'free'
          AND plan_expires_at IS NOT NULL
          AND plan_expires_at < datetime('now')
      `)
      if (result?.changes > 0) {
        console.log(`🧹 Expired plan cleanup: ${result.changes} user(s) downgraded to free`)
      }
    } catch (err) {
      console.error('Plan cleanup error:', err.message)
    }
  }

  // Run once at startup (catches any plans that expired while server was down)
  cleanupExpiredPlans()
  // Then every hour
  setInterval(cleanupExpiredPlans, 60 * 60 * 1000)

  // ── Orphaned temp-file sweep ─────────────────────────────────────────────────
  // Per-request setTimeout cleanup is lost if the server restarts/crashes mid-job,
  // leaving files behind that slowly fill the disk. This sweeps the work dirs on a
  // schedule, deleting anything older than maxAge. uploads/blog is preserved.
  async function sweepOldFiles() {
    // The privacy policy promises deletion "within 1 hour": remove anything older than 55 min and
    // run every 5 min (below), so nothing outlives the hour. (The 2-hour cron is only a backstop.)
    const MAX_AGE = 55 * 60 * 1000
    const cutoff = Date.now() - MAX_AGE
    const dirs = ["uploads", "converted", "compressed", "downloads", "temp", "unlocked"]
    let removed = 0
    // "My Files" keeps paid users' outputs for 24h by pointing at the files in
    // these dirs — don't sweep anything an unexpired user_files row still uses
    // (myFiles.js deletes those itself when their own window ends).
    let keep = []
    try {
      const rows = await dbAll("SELECT stored_path FROM user_files WHERE expires_at > ?", [Date.now()])
      keep = rows.map((r) => path.resolve(r.stored_path))
    } catch (_) { /* table missing → nothing to protect */ }
    const isKept = (p) => { const abs = path.resolve(p); return keep.some((k) => k === abs || k.startsWith(abs + path.sep)) }
    for (const d of dirs) {
      const dirPath = path.join(__dirname, d)
      if (!fs.existsSync(dirPath)) continue
      let entries
      try { entries = fs.readdirSync(dirPath) } catch { continue }
      for (const entry of entries) {
        if (d === "uploads" && entry === "blog") continue // keep persistent blog images
        const entryPath = path.join(dirPath, entry)
        try {
          const stat = fs.statSync(entryPath)
          if (stat.mtimeMs < cutoff && !isKept(entryPath)) {
            fs.rmSync(entryPath, { recursive: true, force: true })
            removed++
          }
        } catch { /* file may already be gone — ignore */ }
      }
    }
    if (removed > 0) console.log(`🧹 Temp sweep: removed ${removed} expired item(s)`)
  }

  // Run once at startup (clears orphans from any previous crash), then every 5 min
  sweepOldFiles()
  setInterval(sweepOldFiles, 5 * 60 * 1000)

  // Inputs of failed conversions: kept 24 h, then removed (startup + hourly)
  sweepFailedInputs()
  setInterval(sweepFailedInputs, 60 * 60 * 1000)

  // Prune expired rows from the persistent rate-limit table (startup + hourly)
  cleanupExpiredRateLimits()
  setInterval(cleanupExpiredRateLimits, 60 * 60 * 1000)

  // Prune activity_logs/ip_analytics rows older than 90 days (startup + daily)
  // so both tables — and the admin dashboard queries that scan them — don't
  // grow unbounded forever.
  cleanupOldAnalyticsData()
  setInterval(cleanupOldAnalyticsData, 24 * 60 * 60 * 1000)

  // Nudge users who started Razorpay checkout but never finished UPI auth
  // (startup + hourly — each user is only ever emailed once per subscription)
  sendAbandonedCheckoutReminders()
  setInterval(sendAbandonedCheckoutReminders, 60 * 60 * 1000)

  // Nurture still-free users 3-7 days after signup with what paid unlocks
  // (startup + every 6h — each user is only ever emailed once, ever)
  sendFreeUserNurtureReminders()
  setInterval(sendFreeUserNurtureReminders, 6 * 60 * 60 * 1000)

  // Upload errors from multer (e.g. a single file over the 100 MB hard cap that
  // even Pro has) reached Express's default handler → HTML "Internal Server
  // Error". Answer with JSON the tool pages understand.
  app.use((err, req, res, next) => {
    if (err && err.name === "MulterError") {
      const tooBig = err.code === "LIMIT_FILE_SIZE"
      return res.status(tooBig ? 413 : 400).json({
        error: tooBig ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        limitMB: tooBig ? 100 : undefined,
        message: tooBig ? "Each file can be at most 100 MB." : err.message,
      })
    }
    return next(err)
  })

  // Start server
  // Loopback only: nginx proxies /api/ to localhost. Listening on all interfaces
  // let anyone reach the API directly on http://<server-ip>:<PORT>, bypassing
  // Cloudflare and nginx (rate limits, bot rules, TLS). BIND_HOST overrides.
  const BIND_HOST = process.env.BIND_HOST || "127.0.0.1"
  app.listen(PORT, BIND_HOST, () => {
    console.log(`✓ Server running on ${BIND_HOST}:${PORT}`)
    console.log(`✓ Health check: http://localhost:${PORT}/api/health`)
    console.log(`✓ Admin panel: Login at /api/admin/login`)
    console.log(`✓ Blog system: http://localhost:${PORT}/api/blog/posts`)
    console.log(`✓ Auth routes: /api/auth/signup | /api/auth/login`)
    // (The admin username/password used to be printed here — into pm2 log files.)
  })
