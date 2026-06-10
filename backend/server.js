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
  const sizeOf = require("image-size")
  const sharp = require("sharp")
  const pdfParse = require('pdf-parse')
  const { Document, Packer, Paragraph, TextRun } = require("docx")
  const crypto = require("crypto")
  const { 
    db, 
    dbRun, 
    dbGet, 
    dbAll, 
    logActivityToDB,
    getActivityLogsFromDB,
    getStatsFromDB 
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
  const { router: paymentRouter, webhookHandler } = require('./payments/paymentRoutes')
  const { router: paypalRouter, paypalWebhookHandler } = require('./payments/paypalRoutes')
  const { router: lsRouter, webhookHandler: lsWebhookHandler } = require('./payments/lemonSqueezyRoutes')
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
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "mypdftools"
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ilovemypdftools@007"


  // Middleware
  app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3006', 'http://localhost:3002', 'https://smallpdf.us', 'https://www.smallpdf.us'],
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
  app.use('/api/auth', authRouter)
  app.use('/api/payments', paymentRouter)
  app.use('/api/paypal', paypalRouter)
  app.use('/api/lemonsqueezy', lsRouter)
  app.use('/api/my-files', myFilesRouter)

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
  let ip =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-client-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'

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
      cb(null, Date.now() + "-" + file.originalname)
    },
  })

  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
  })

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
      ".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp",
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
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.oasis.opendocument.spreadsheet",
      "text/csv",
      "application/csv",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.oasis.opendocument.presentation"

    ]

    if (!allowedMimeTypes.includes(file.mimetype)) {
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
        const isJpegFile = ext === ".jpg" || ext === ".jpeg"
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
  function adminAuth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json({ error: "No token provided" })
    }

    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8")
      const [username, passwordHash] = decoded.split(":")

      if (username === ADMIN_USERNAME && passwordHash === hashPassword(ADMIN_PASSWORD)) {
        next()
      } else {
        res.status(401).json({ error: "Invalid credentials" })
      }
    } catch (error) {
      res.status(401).json({ error: "Invalid token" })
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

  // Find Ghostscript executable
  function getGhostscriptPath() {
    const possiblePaths = [
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

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = Buffer.from(`${username}:${hashPassword(password)}`).toString("base64")

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
        ${groupBy === 'hour' ? "strftime('%Y-%m-%d %H:00', created_at)" : "DATE(created_at)"} as period,
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
        DATE(created_at) as date,
        COUNT(*) as count
      FROM activity_logs
      WHERE tool = ?
      AND created_at > datetime('now', '-30 days')
      GROUP BY DATE(created_at)
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
          SUM(CASE WHEN date(created_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as new_today,
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
      const { page = 1, limit = 10, category, tag, status = "published" } = req.query

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
      
      const post = await dbGet('SELECT * FROM blog_posts WHERE slug = ?', [slug])

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
  app.post("/api/word-to-pdf", upload.single("file"), fileSizeLimiter("word-to-pdf"), dailyConversionLimiter(), fileValidation, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" })
      }

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
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024,
        })

        const libreOutputPath = inputPath.replace(/\.(doc|docx)$/i, ".pdf")

        if (fs.existsSync(libreOutputPath)) {
          if (libreOutputPath !== outputPath) {
            fs.renameSync(libreOutputPath, outputPath)
          }

          console.log("Conversion successful:", outputFilename)
          await safeUnlink(inputPath)

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
          error: "Conversion failed. Please ensure LibreOffice is installed and the document is not corrupted.",
          details: conversionError.message,
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

      const outputFilename = `images-combined-${Date.now()}.pdf`
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

          let imgWidth, imgHeight
          
          try {
            const metadata = await sharp(file.path).metadata()
            imgWidth = metadata.width
            imgHeight = metadata.height
            console.log(`Sharp metadata for ${file.originalname}: ${imgWidth}x${imgHeight}`)
          } catch (sharpError) {
            console.log(`Sharp failed for ${file.originalname}, trying image-size...`)
            const dimensions = sizeOf(file.path)
            imgWidth = dimensions.width
            imgHeight = dimensions.height
            console.log(`image-size for ${file.originalname}: ${imgWidth}x${imgHeight}`)
          }

          if (!imgWidth || !imgHeight || imgWidth === 0 || imgHeight === 0) {
            throw new Error(`Invalid dimensions: ${imgWidth}x${imgHeight}`)
          }

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

          const absolutePath = path.resolve(file.path)
          console.log(`Adding image to PDF: ${absolutePath}`)
          
          doc.image(absolutePath, x, y, { 
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
        
        return res.status(500).json({ 
          error: "No valid images were processed", 
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
        convertedName: outputFilename,
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
app.post("/api/excel-to-pdf", upload.single("file"), fileSizeLimiter("excel-to-pdf"), dailyConversionLimiter(), fileValidation, async (req, res) => {
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

        const prepScript = `
import sys
try:
    from openpyxl import load_workbook
    from openpyxl.styles import Alignment
    from openpyxl.utils import get_column_letter
    import re

    wb = load_workbook(sys.argv[1])

    for ws in wb.worksheets:
        # ── 1. Auto-fit every column to its longest content ──────────────────
        col_widths = {}
        for row in ws.iter_rows():
            for cell in row:
                if cell.value is None:
                    continue
                val = str(cell.value)
                # Format numbers properly — avoid scientific notation
                if isinstance(cell.value, float):
                    # If it looks like a large integer stored as float, show as int
                    if cell.value == int(cell.value) and abs(cell.value) < 1e12:
                        cell.value = int(cell.value)
                        val = str(cell.value)
                    else:
                        val = f"{cell.value:,.2f}"
                col = cell.column
                col_widths[col] = max(col_widths.get(col, 0), min(len(val) + 4, 80))

        for col, width in col_widths.items():
            ws.column_dimensions[get_column_letter(col)].width = max(width, 8)

        # ── 2. Wrap text off, vertical align top ─────────────────────────────
        for row in ws.iter_rows():
            for cell in row:
                existing = cell.alignment
                cell.alignment = Alignment(
                    wrap_text=False,
                    vertical="top",
                    horizontal=existing.horizontal or "left",
                )

        # ── 3. Print settings: fit all columns to page width, scale sensibly ─
        from openpyxl.worksheet.page import PageMargins, PrintPageSetup
        ws.page_setup.orientation = "${orientation}" == "landscape" and "landscape" or "portrait"
        ws.page_setup.fitToPage = True
        ws.page_setup.fitToWidth = 1      # fit all columns on one page width
        ws.page_setup.fitToHeight = 0     # allow as many rows as needed
        ws.page_setup.paperSize = 9       # A4
        ws.sheet_properties.pageSetUpPr.fitToPage = True

        # ── 4. Narrow page margins to give content more space ─────────────────
        ws.page_margins = PageMargins(
            left=0.5, right=0.5, top=0.75, bottom=0.75,
            header=0.3, footer=0.3
        )

        # ── 5. Gridlines in print ─────────────────────────────────────────────
        ws.print_options.gridLines = True

    wb.save(sys.argv[2])
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
          const { stdout: prepOut } = await execPromise(`"${pythonBin}" "${tempScriptPath}" "${file.path}" "${preparedPath}"`, {
            timeout: 60000, maxBuffer: 10 * 1024 * 1024
          })
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
      
      return res.status(500).json({ 
        error: "No files were converted successfully.",
        details: "Please ensure LibreOffice is installed and Excel files are not corrupted."
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

    // Auto-cleanup after 1 hour
    setTimeout(() => {
      try {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
        if (fs.existsSync(convertedDir)) fs.rmSync(convertedDir, { recursive: true, force: true })
      } catch (e) {}
    }, 60 * 60 * 1000)

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
              fs.rmSync(convertedDir, { recursive: true, force: true })
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
            fs.rmSync(convertedDir, { recursive: true, force: true })
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
      let totalOriginalSize = 0
      let totalCompressedSize = 0

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i]
        totalOriginalSize += file.size

        const fileExtension = path.extname(file.originalname).toLowerCase()
        const outputFilename = `${jobId}-compressed-${i + 1}${fileExtension}`
        const outputPath = path.join(outputDir, outputFilename)

        try {
          if (file.mimetype === "image/png") {
            await sharp(file.path)
              .png({
                quality: 80,
                compressionLevel: 9,
                palette: true,
              })
              .toFile(outputPath)
          } else if (file.mimetype === "image/webp") {
            await sharp(file.path).webp({ quality: 85, effort: 6 }).toFile(outputPath)
          } else {
            await sharp(file.path).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(outputPath)
          }

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
          console.error(`Error compressing ${file.originalname}:`, compError)

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
        
        return res.status(500).json({ error: "No files were compressed successfully" })
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

      res.json({
        success: true,
        message: `${convertedFiles.length} image(s) compressed successfully`,
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
        
        logActivity({
          type: "download",
          action: "file_downloaded",
          jobId: jobId,
          filename: compressedFiles[0],
          ip: req.clientIP,
          status: "success",
        })
        
        return res.download(filePath, `compressed-image${path.extname(compressedFiles[0])}`, (err) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
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

      for (let i = 0; i < compressedFiles.length; i++) {
        const compressedFilePath = path.join(uploadDir, compressedFiles[i])
        if (fs.existsSync(compressedFilePath)) {
          const ext = path.extname(compressedFiles[i])
          archive.file(compressedFilePath, { name: `compressed-image-${i + 1}${ext}` })
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

      res.download(zipPath, zipFilename, (err) => {
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath)
        }
        for (const compressedFile of compressedFiles) {
          const compressedFilePath = path.join(uploadDir, compressedFile)
          if (fs.existsSync(compressedFilePath)) {
            fs.unlinkSync(compressedFilePath)
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

      const compressedFiles = []
      let totalOriginalSize = 0
      let totalCompressedSize = 0

      for (const file of req.files) {
        totalOriginalSize += file.size

        const baseName = path.basename(file.originalname, path.extname(file.originalname))
        const isMimeJpeg = file.mimetype === "image/jpeg" || file.mimetype === "image/jpg"
        const isMimePng  = file.mimetype === "image/png"

        try {
          const image = sharp(file.path)
          const metadata = await image.metadata()
          const hasAlpha = metadata.hasAlpha || false

          // Resize very large images — this alone cuts 60-80% for high-res photos
          let pipeline = image
          const maxDimension = compressionSettings.maxDimension || 4096
          if (metadata.width > maxDimension || metadata.height > maxDimension) {
            pipeline = pipeline.resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
          }

          // Step 1: Always generate WebP (best compression ratio, supports alpha)
          const webpTmpPath = path.join(compressedDir, `${Date.now()}-tmp-${baseName}.webp`)
          await pipeline.clone().webp(compressionSettings.webp).toFile(webpTmpPath)
          const webpSize = fs.statSync(webpTmpPath).size

          let bestPath = webpTmpPath
          let bestSize = webpSize
          let outputExt = ".webp"

          // Step 2: For JPEG inputs without alpha, also try optimized JPEG
          // and pick whichever is smaller
          if (isMimeJpeg && !hasAlpha) {
            const jpegTmpPath = path.join(compressedDir, `${Date.now()}-tmp-${baseName}.jpg`)
            await pipeline.clone().jpeg(compressionSettings.jpeg).toFile(jpegTmpPath)
            const jpegSize = fs.statSync(jpegTmpPath).size
            if (jpegSize < webpSize) {
              fs.unlinkSync(webpTmpPath)
              bestPath = jpegTmpPath
              bestSize = jpegSize
              outputExt = ".jpg"
            } else {
              fs.unlinkSync(jpegTmpPath)
            }
          }
          // For PNG: WebP wins almost always (25-90% smaller than PNG)
          // For PNG with alpha: WebP handles transparency perfectly

          // Move best output to final filename
          const outputFilename = `${Date.now()}-compressed-${baseName}${outputExt}`
          const outputPath = path.join(compressedDir, outputFilename)
          fs.renameSync(bestPath, outputPath)

          await new Promise((resolve) => setTimeout(resolve, 50))

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

      const files = fs.readdirSync(compressedDir)

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
                fs.rmSync(compressedDir, { recursive: true, force: true })
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
              fs.rmSync(compressedDir, { recursive: true, force: true })
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

        res.download(filePath, files[0], (err) => {
          if (err) {
            console.error("Download error:", err)
            if (!res.headersSent) {
              res.status(500).json({ error: "Download failed" })
            }
          }

          setTimeout(() => {
            try {
              if (fs.existsSync(convertedDir)) {
                fs.rmSync(convertedDir, { recursive: true, force: true })
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
              fs.rmSync(convertedDir, { recursive: true, force: true })
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

        try {
          const pdfBytes = fs.readFileSync(file.path)
          const pdf = await PDFLibDocument.load(pdfBytes, { ignoreEncryption: true })
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
          pages.forEach((page) => {
            mergedPdf.addPage(page)
          })

          console.log(`Added ${pages.length} pages from ${file.originalname}`)
        } catch (pdfError) {
          console.error(`Error processing ${file.originalname}:`, pdfError)
          throw new Error(`Could not read "${file.originalname}". The file may be corrupted or password-protected. Please check the file and try again.`)
        }
      }

      const mergedPdfBytes = await mergedPdf.save()
      const outputFilename = `merged-${Date.now()}.pdf`
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
        status: "error",
      })

      res.status(500).json({ error: error.message })
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

      const { degrees } = require("pdf-lib")

      // Normalise requested angle to one of 0/90/180/270.
      let angle = parseInt(req.body.angle, 10)
      if (isNaN(angle)) angle = 90
      const delta = ((angle % 360) + 360) % 360

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

      const pdfBytes = fs.readFileSync(req.file.path)
      let pdf
      try {
        pdf = await PDFLibDocument.load(pdfBytes, { ignoreEncryption: true })
      } catch (e) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(400).json({ error: "Could not read the PDF. It may be corrupted or password-protected." })
      }

      const pages = pdf.getPages()
      pages.forEach((page, idx) => {
        if (targetPages && !targetPages.includes(idx + 1)) return
        const current = page.getRotation().angle || 0
        page.setRotation(degrees((current + delta) % 360))
      })

      const outBytes = await pdf.save()
      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
      const outputFilename = `rotated-${Date.now()}-${baseName}.pdf`
      const outputPath = path.join("./uploads", outputFilename)
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
          downloadUrl: `/uploads/${outputFilename}`,
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
        downloadUrl: `/uploads/${outputFilename}`,
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
        status: "error",
      })
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
      const outputFilename = `protected-${jobId}-${baseName}.pdf`
      const outputPath = path.join("./uploads", outputFilename)

      // qpdf --encrypt <user> <owner> 256 -- input output
      // owner password = user password (single password to open).
      try {
        await execFileP("qpdf", ["--encrypt", password, password, "256", "--", req.file.path, outputPath])
      } catch (qErr) {
        // qpdf exits 3 on warnings but still produces a valid file — only fail if
        // no usable output was created.
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          console.error("Protect PDF qpdf error:", qErr.message)
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
          return res.status(500).json({ error: "Could not protect this PDF. It may be corrupted or already encrypted." })
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
          downloadUrl: `/uploads/${outputFilename}`,
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
        downloadUrl: `/uploads/${outputFilename}`,
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

    const compressionLevel = req.body.level || "balanced"
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
        extraFlags: ["-dDetectDuplicateImages=true", "-dCompressFonts=true",
          "-dSubsetFonts=true", "-dEmbedAllFonts=false", "-dOptimize=true",
          "-dPreserveAnnots=false", "-dPreserveHalftoneInfo=false"],
      },
      extreme: {
        pdfSettings: "/screen", colorDPI: 72, grayDPI: 72, monoDPI: 150,
        jpegQuality: 30, downsampleType: "/Subsample",
        description: "Extreme Compression", expectedReduction: "70-90%",
        extraFlags: ["-dDetectDuplicateImages=true", "-dCompressFonts=true",
          "-dSubsetFonts=true", "-dEmbedAllFonts=false", "-dOptimize=true",
          "-dPreserveAnnots=false", "-dPreserveHalftoneInfo=false",
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
    let totalOriginalSize  = 0
    let totalCompressedSize = 0

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
          const { stdout } = await execPromise(pyCmd, { timeout: 120000, maxBuffer: 200 * 1024 * 1024 })
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
        try {
          const gsCmd = buildGsCommand(gsInput, pass2Path, settings)
          await execPromise(gsCmd, { timeout: 300000, maxBuffer: 200 * 1024 * 1024 })
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
          await execPromise(qpdfCmd, { timeout: 120000, maxBuffer: 200 * 1024 * 1024 })
          if (fs.existsSync(pass3Path) && fs.statSync(pass3Path).size > 0) {
            pass3OK   = true
            pass3Size = fs.statSync(pass3Path).size
            console.log(`     Pass3 qpdf:    ${formatFileSize(qpdfInput.size)} → ${formatFileSize(pass3Size)} (${Math.round((1 - pass3Size / file.size) * 100)}% saved)`)
          }
        } catch (qpdfErr) {
          console.log(`     Pass3 qpdf: FAILED — ${qpdfErr.message.slice(0, 80)}`)
          console.log(`     💡 Fix: apt-get install -y qpdf`)
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
        try {
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
        error: "No files compressed", ip: req.clientIP, status: "error" })
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

//api/pdf-to-jpg endpoint

app.post("/api/pdf-to-jpg", upload.single("file"), fileSizeLimiter("pdf-to-jpg"), dailyConversionLimiter(), fileValidation, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
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

    const quality = req.body.quality || "standard"
    let dpi = 150
    if (quality === "high") dpi = 300
    if (quality === "maximum") dpi = 600

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
          convertedName: singleFile,
          isZip: false,  // Important: indicate this is NOT a zip
          fileSize: stats.size,
          files: [`/uploads/${singleFile}`],
        })
      } 
      // MULTIPLE PAGES - Create ZIP
      else {
        const zipFilename = `${baseName}-images.zip`
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
            archive.file(jpgFilePath, { name: jpgFile })
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
          convertedName: zipFilename,
          isZip: true,  // Important: indicate this IS a zip
          fileSize: stats.size,
        })
      }
    } catch (conversionError) {
      console.error("PDF to JPG conversion error:", conversionError)

      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath)
      }

      logActivity({
        type: "conversion",
        action: "pdf_to_jpg_failed",
        tool: "pdf-to-jpg",
        filename: req.file.originalname,
        error: conversionError.message,
        ip: req.clientIP,
        status: "error",
      })

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

        res.status(500).json({
          error: "PDF to PNG conversion failed. Please ensure Ghostscript is installed.",
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

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i]
        const outputFilename = `${jobId}-page-${i + 1}.png`
        const outputPath = path.join(outputDir, outputFilename)

        try {
          await sharp(file.path).png({ quality: 100, compressionLevel: 6 }).toFile(outputPath)

          convertedFiles.push(outputFilename)
          console.log(`Converted: ${file.originalname} -> ${outputFilename}`)

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        } catch (convError) {
          console.error(`Error converting ${file.originalname}:`, convError)
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
        
        return res.status(500).json({ error: "No files were converted successfully" })
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

      res.json({
        success: true,
        message: `${convertedFiles.length} WEBP image(s) converted to PNG successfully`,
        jobId: jobId,
        pageCount: convertedFiles.length,
        files: convertedFiles.map((f) => `/uploads/${f}`),
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
      
      const convertedFiles = files
        .filter((f) => f.startsWith(`${jobId}-page-`) && f.endsWith(".png"))
        .sort((a, b) => {
          const numA = parseInt(a.match(/-page-(\d+)/)?.[1] || "0")
          const numB = parseInt(b.match(/-page-(\d+)/)?.[1] || "0")
          return numA - numB
        })

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
        
        return res.download(filePath, "converted-image.png", (err) => {
          if (err) {
            console.error("Download error:", err)
          }
          setTimeout(() => {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
              console.log(`Cleaned up: ${filePath}`)
            }
          }, 1000)
        })
      }

      console.log(`Creating ZIP archive for ${convertedFiles.length} files`)
      
      const zipFilename = `converted-images-${jobId}.zip`
      const zipPath = path.join(uploadDir, zipFilename)

      const output = fs.createWriteStream(zipPath)
      const archive = archiver("zip", { zlib: { level: 9 } })

      archive.on("error", (err) => {
        console.error("Archiver error:", err)
        throw err
      })

      archive.pipe(output)

      for (let i = 0; i < convertedFiles.length; i++) {
        const filePath = path.join(uploadDir, convertedFiles[i])
        if (fs.existsSync(filePath)) {
          const filename = `converted-image-${i + 1}.png`
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

      res.download(zipPath, zipFilename, (err) => {
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
                fs.unlinkSync(filePath)
                console.log(`Cleaned up: ${filePath}`)
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
  app.post("/api/analyze-pdf", upload.single("file"), fileValidation, async (req, res) => {
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
        const pdfBytes = fs.readFileSync(inputPath)
        const pdfDoc = await PDFLibDocument.load(pdfBytes, { ignoreEncryption: true })
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

        const storedPath = path.join(__dirname, "uploads", `${jobId}-original.pdf`)
        fs.copyFileSync(inputPath, storedPath)
        
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
          originalFile: `${jobId}-original.pdf`,
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
  app.post("/api/split-pdf", upload.single("file"), fileSizeLimiter("split-pdf"), dailyConversionLimiter(), fileValidation, async (req, res) => {
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
        return res.status(400).json({ error: "Invalid pages parameter" })
      }

      if (selectedPages.length === 0) {
        return res.status(400).json({ error: "No pages selected for extraction" })
      }

      console.log(`Extracting pages: ${selectedPages.join(", ")}`)

      const inputPath = req.file.path
      const jobId = genJobId()
      const outputDir = path.join(__dirname, "uploads")
      const baseName = path.basename(req.file.originalname, ".pdf")
      const outputFilename = `${jobId}-split-${baseName}.pdf`
      const outputPath = path.join(outputDir, outputFilename)

      try {
        const pdfBytes = fs.readFileSync(inputPath)
        const pdfDoc = await PDFLibDocument.load(pdfBytes, { ignoreEncryption: true })
        
        const newPdfDoc = await PDFLibDocument.create()
        
        const totalPages = pdfDoc.getPageCount()
        
        const validPages = selectedPages.filter(p => p >= 1 && p <= totalPages)
        
        if (validPages.length === 0) {
          throw new Error("No valid pages to extract")
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
              fs.unlinkSync(filePath)
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
app.post("/api/pdf-to-word", upload.array("files", 500), fileSizeLimiter("pdf-to-word"), batchLimiter("pdf-to-word"), dailyConversionLimiter(), fileValidation, async (req, res) => {
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

      // FIX #3: Sanitize filename — remove special chars that break shell commands
      const rawBase = path.basename(file.originalname, ".pdf")
      const baseName = rawBase.replace(/[^\w\s\-\.]/g, "_").trim() || "converted"
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
            timeout: 300000, // 5 min
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

          // FIX #1: Remove broken --infilter flag and space-quoted filter name.
          // Simple --convert-to docx works on all LibreOffice versions on Linux/Mac/Windows.
          const loCmd = `"${libreOfficePath}" --headless --convert-to docx --outdir "${convertedDir}" "${file.path}"`

          await runLibreOffice(loCmd, {
            timeout: 180000,
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
              fs.rmSync(convertedDir, { recursive: true, force: true })
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
          if (fs.existsSync(convertedDir)) fs.rmSync(convertedDir, { recursive: true, force: true })
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

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i]

        const ext = path.extname(file.originalname).toLowerCase()
        if (!file.mimetype.match(/^image\/(jpeg|jpg)$/i) && ext !== '.jpg' && ext !== '.jpeg') {
          console.log(`Skipping non-JPG file: ${file.originalname}`)
          continue
        }

        try {
          let dimensions
          try {
            dimensions = sizeOf(file.path)
          } catch (sizeError) {
            console.error(`Error getting image dimensions for ${file.originalname}:`, sizeError)
            const metadata = await sharp(file.path).metadata()
            dimensions = { width: metadata.width, height: metadata.height }
          }

          const imgWidth = dimensions.width
          const imgHeight = dimensions.height

          if (!imgWidth || !imgHeight) {
            console.error(`Invalid dimensions for ${file.originalname}`)
            continue
          }

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

          doc.image(file.path, x, y, { width: scaledWidth, height: scaledHeight })

          successCount++
          console.log(`Added JPG ${successCount}/${req.files.length}: ${file.originalname}`)
        } catch (imgError) {
          console.error(`Error processing JPG ${file.originalname}:`, imgError)
          console.error(`Error details:`, imgError.stack)
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
        
        return res.status(500).json({ error: "No valid JPG images were processed" })
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

      res.json({
        success: true,
        message: `${successCount} JPG image(s) converted to PDF successfully`,
        jobId: jobId,
        downloadUrl: `/uploads/${outputFilename}`,
        convertedName: outputFilename,
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

      res.download(pdfPath, "converted-images.pdf", (err) => {
        if (err) {
          console.error("Download error:", err)
        }
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath)
        }
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
app.post("/api/pdf-to-excel", upload.array("files", 500), fileSizeLimiter("pdf-to-excel"), batchLimiter("pdf-to-excel"), dailyConversionLimiter(), fileValidation, async (req, res) => {
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

      const baseName = path.basename(file.originalname, ext)
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
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', val)
    # Strip UTF-16 surrogates that openpyxl's XML writer rejects
    cleaned = re.sub(r'[\ud800-\udfff]', '', cleaned)
    return cleaned or None


def safe_cell_write(ws, row, col, value):
    """Write a value to an Excel cell, silently skipping illegal values."""
    try:
        ws.cell(row=row, column=col, value=sanitize_excel(value) if isinstance(value, str) else value)
    except Exception:
        try:
            ws.cell(row=row, column=col, value=None)  # blank is better than a crash
        except Exception:
            pass

def convert_pdf_to_excel(input_pdf, output_xlsx):
    try:
        import pdfplumber
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        from openpyxl.utils import get_column_letter

        print(f"Reading PDF: {input_pdf}")
        COL_WIDTH_FACTOR = 6.5   # pts -> Excel column width units
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
                for strategy in [
                    {"vertical_strategy": "lines",  "horizontal_strategy": "lines",  "snap_tolerance": 3, "join_tolerance": 3, "edge_min_length": 3},
                    {"vertical_strategy": "lines",  "horizontal_strategy": "lines",  "snap_tolerance": 5, "join_tolerance": 5, "edge_min_length": 3},
                    {"vertical_strategy": "text",   "horizontal_strategy": "lines",  "snap_tolerance": 3},
                    {"vertical_strategy": "text",   "horizontal_strategy": "text",   "snap_tolerance": 3},
                ]:
                    try:
                        found_tables = page.find_tables(strategy)
                        if found_tables:
                            break
                    except Exception:
                        pass

                if found_tables:
                    current_xl_row = 1

                    for tbl in found_tables:
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

                        # Set row heights proportional to PDF heights
                        for ri, (ry0, ry1) in enumerate(zip(ys[:-1], ys[1:]), 1):
                            xl_r = current_xl_row + ri - 1
                            h = max((ry1 - ry0) * ROW_HEIGHT_FACTOR, 12)
                            ws.row_dimensions[xl_r].height = h

                        merged_done = set()

                        for cell_bbox in tbl.cells:
                            cx0, cy0, cx1, cy1 = cell_bbox

                            if cx0 not in xs or cx1 not in xs or cy0 not in ys or cy1 not in ys:
                                continue

                            xl_col = xs.index(cx0) + 1
                            xl_row = ys.index(cy0) + current_xl_row
                            col_span = xs.index(cx1) - xs.index(cx0)
                            row_span = ys.index(cy1) - ys.index(cy0)

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

                            xl_cell.font = Font(
                                bold=is_bold(fontname),
                                italic=is_italic(fontname),
                                size=font_size,
                                color=text_hex,
                            )

                            # ── Background fill ──
                            cell_rects = rects_in_bbox(all_rects, cx0, cy0, cx1, cy1)
                            if cell_rects:
                                bg_hex = color_to_hex(cell_rects[0].get('non_stroking_color'))
                                if bg_hex and bg_hex.upper() not in ('FFFFFF', 'FEFEFE', 'FDFDFD'):
                                    xl_cell.fill = PatternFill(start_color=bg_hex, end_color=bg_hex, fill_type='solid')

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

                        current_xl_row += (len(ys) - 1) + 1   # table rows + 1 blank separator

                else:
                    # ── No table lines found: word-position layout ──
                    words = page.extract_words(
                        x_tolerance=4, y_tolerance=4,
                        keep_blank_chars=False, use_text_flow=False,
                    ) or []

                    if not words:
                        continue

                    has_content = True

                    # Cluster x-positions into column buckets (tolerance 15 pts)
                    x_starts = sorted(set(round(w['x0']) for w in words))
                    col_buckets = []
                    for x in x_starts:
                        if not col_buckets or x - col_buckets[-1] > 15:
                            col_buckets.append(x)

                    # Cluster y-positions into row buckets (tolerance 5 pts)
                    y_tops = sorted(set(round(w['top']) for w in words))
                    row_buckets = []
                    for y in y_tops:
                        if not row_buckets or y - row_buckets[-1] > 5:
                            row_buckets.append(y)

                    col_map = {x: min(range(len(col_buckets)), key=lambda i: abs(col_buckets[i] - x)) + 1 for x in x_starts}
                    row_map = {y: min(range(len(row_buckets)), key=lambda i: abs(row_buckets[i] - y)) + 1 for y in y_tops}

                    for w in words:
                        xl_col = col_map.get(round(w['x0']), 1)
                        xl_row = row_map.get(round(w['top']), 1)
                        cell = ws.cell(row=xl_row, column=xl_col)
                        existing = cell.value or ''
                        safe_cell_write(ws, xl_row, xl_col, (existing + ' ' + w['text']).strip())

                        # Rough font styling from pdfplumber word dict (if available)
                        fn = w.get('fontname', '')
                        fs = w.get('size', 11)
                        if fn or fs:
                            cell.font = Font(bold=is_bold(fn), italic=is_italic(fn),
                                             size=max(min(round(fs or 11), 36), 10))
                        cell.alignment = Alignment(vertical='top', wrap_text=True)

                    # Auto column widths for word-layout pages
                    for col_cells in ws.columns:
                        max_len = max((len(str(c.value or '')) for c in col_cells), default=0)
                        col_letter = col_cells[0].column_letter
                        ws.column_dimensions[col_letter].width = max(min(max_len + 2, 60), 8)

        if not has_content:
            print("NO_TABLES_FOUND")
            return False

        wb.save(output_xlsx)
        print("SUCCESS")
        return True

    except ImportError as e:
        print(f"IMPORT_ERROR: {e}")
        print("Please install required packages: pip install pdfplumber openpyxl")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

# Run conversion
if __name__ == "__main__":
    # Paths come from argv (NOT interpolated into the source) so a filename with
    # odd bytes/quotes can never corrupt this script — that previously produced
    # "SyntaxError: source code cannot contain null bytes" and was an injection risk.
    result = convert_pdf_to_excel(sys.argv[1], sys.argv[2])
    sys.exit(0 if result else 1)
`

        fs.writeFileSync(scriptPath, pythonScript)
        console.log(`Python script created: ${scriptPath}`)

        try {
          const { stdout, stderr } = await execPromise(`python "${scriptPath}" "${inputPath}" "${outputPath}"`, {
            timeout: 180000,
            maxBuffer: 100 * 1024 * 1024,
          })

          console.log(`Python stdout: ${stdout}`)
          if (stderr) console.log(`Python stderr: ${stderr}`)

          // Cleanup script
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath)
          }

          if (stdout.includes('SUCCESS') && fs.existsSync(expectedOutputPath)) {
            const stats = fs.statSync(expectedOutputPath)

            convertedFiles.push({
              filename: outputFilename,
              originalName: file.originalname,
              fileSize: stats.size,
              originalSize: file.size,
            })

            console.log(`✓ Successfully converted: ${file.originalname} -> ${outputFilename}`)
          } else if (stdout.includes('NO_TABLES_FOUND')) {
            console.log(`⚠ No tables found in: ${file.originalname}`)
            throw new Error("No extractable tables found in PDF. The PDF may not contain tabular data.")
          } else if (stdout.includes('IMPORT_ERROR')) {
            throw new Error("Missing Python packages. Please run: pip install pdfplumber pandas openpyxl")
          } else {
            throw new Error("Conversion failed - check Python output")
          }

        } catch (execError) {
          console.error(`Python execution error: ${execError.message}`)
          
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath)
          }
          
          throw execError
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

      // Not a server failure — the input PDF simply had no extractable tabular
      // text (usually a scanned/image PDF). Log as "warning" so it does not
      // inflate the error count, and return 422 (unprocessable input).
      logActivity({
        type: "conversion",
        action: "pdf_to_excel_no_content",
        tool: "pdf-to-excel",
        error: "No extractable tables (likely scanned PDF)",
        ip: req.clientIP,
        status: "warning",
      })

      return res.status(422).json({
        error: "We couldn't find any extractable tables in this PDF.",
        code: "NO_EXTRACTABLE_CONTENT",
        details: "This looks like a scanned or image-based PDF. Run it through our OCR PDF tool first to make the text selectable, then convert again."
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

    res.json({
      success: true,
      message: `${convertedFiles.length} PDF file(s) converted to Excel successfully`,
      jobId: jobId,
      fileCount: convertedFiles.length,
      files: convertedFiles,
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
      res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`)

      return res.download(filePath, files[0], (err) => {
        if (err) console.error("Download error:", err)

        setTimeout(() => {
          try {
            if (fs.existsSync(convertedDir)) {
              fs.rmSync(convertedDir, { recursive: true, force: true })
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
          if (fs.existsSync(convertedDir)) fs.rmSync(convertedDir, { recursive: true, force: true })
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
app.post("/api/ppt-to-pdf", upload.array("files", 500), fileSizeLimiter("ppt-to-pdf"), batchLimiter("ppt-to-pdf"), dailyConversionLimiter(), fileValidation, async (req, res) => {
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

      const baseName = path.basename(file.originalname, ext)
      const outputFilename = `${baseName}.pdf`
      const expectedOutputPath = path.join(convertedDir, outputFilename)

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

      logActivity({
        type: "conversion",
        action: "ppt_to_pdf_failed",
        tool: "ppt-to-pdf",
        error: "No files converted",
        ip: req.clientIP,
        status: "error",
      })
      
      return res.status(500).json({ 
        error: "No files were converted successfully.",
        details: "Please ensure LibreOffice is installed and PowerPoint files are not corrupted or password-protected."
      })
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
      res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`)

      return res.download(filePath, files[0], (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        // Cleanup after download
        setTimeout(() => {
          try {
            if (fs.existsSync(convertedDir)) {
              fs.rmSync(convertedDir, { recursive: true, force: true })
              console.log(`Cleaned up: ${convertedDir}`)
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
            fs.rmSync(convertedDir, { recursive: true, force: true })
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
app.post("/api/pdf-to-ppt", upload.array("files", 500), fileSizeLimiter("pdf-to-ppt"), batchLimiter("pdf-to-ppt"), dailyConversionLimiter(), fileValidation, async (req, res) => {
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

      const baseName = path.basename(file.originalname, ext)
      const outputFilename = `${baseName}.pptx`
      const expectedOutputPath = path.join(convertedDir, outputFilename)

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

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      }
    }

    if (convertedFiles.length === 0) {
      if (fs.existsSync(convertedDir)) {
        fs.rmSync(convertedDir, { recursive: true, force: true })
      }

      logActivity({
        type: "conversion",
        action: "pdf_to_ppt_failed",
        tool: "pdf-to-ppt",
        error: "No files converted",
        ip: req.clientIP,
        status: "error",
      })
      
      return res.status(500).json({ 
        error: "No files were converted successfully.",
        details: "Please ensure LibreOffice is installed and PDF files are not corrupted or password-protected."
      })
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
      res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`)

      return res.download(filePath, files[0], (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        // Cleanup after download
        setTimeout(() => {
          try {
            if (fs.existsSync(convertedDir)) {
              fs.rmSync(convertedDir, { recursive: true, force: true })
              console.log(`Cleaned up: ${convertedDir}`)
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
            fs.rmSync(convertedDir, { recursive: true, force: true })
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
app.post("/api/unlock-pdf", upload.array("files", 5), fileSizeLimiter("unlock-pdf"), dailyConversionLimiter(), fileValidation, async (req, res) => {
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

        // =========================================
        // METHOD 1: QPDF (BEST - Preserves everything perfectly)
        // =========================================
        if (hasQpdf && !unlockSuccess) {
          try {
            console.log(`   Trying qpdf...`)
            
            let qpdfCommand
            if (filePassword) {
              // With password - decrypt with password
              qpdfCommand = `qpdf --password="${filePassword}" --decrypt "${file.path}" "${expectedOutputPath}"`
            } else {
              // No password - try to decrypt anyway (works for owner-password-only PDFs)
              qpdfCommand = `qpdf --decrypt "${file.path}" "${expectedOutputPath}"`
            }

            const result = await execPromise(qpdfCommand, {
              timeout: 90000,
              maxBuffer: 200 * 1024 * 1024,
            })

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
            console.log(`   ❌ qpdf failed: ${qpdfError.message}`)
            
            // Check for specific error messages
            if (qpdfError.message.includes('invalid password')) {
              errors.push({
                filename: file.originalname,
                error: "Wrong password. Please enter the correct password."
              })
            }
            
            // Clean up failed output
            if (fs.existsSync(expectedOutputPath)) {
              fs.unlinkSync(expectedOutputPath)
            }
          }
        }

        // =========================================
        // METHOD 2: pdf-lib CAREFUL COPY (Good - Preserves content)
        // =========================================
        if (!unlockSuccess) {
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
            
            if (pdfLibError.message.includes('password')) {
              errors.push({
                filename: file.originalname,
                error: "This PDF requires a password. Please enter it."
              })
            }
            
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
          const errorMsg = filePassword 
            ? "Failed to unlock. Check your password and try again."
            : "Failed to unlock. This PDF might need a password."
          
          errors.push({
            filename: file.originalname,
            error: errorMsg
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
        status: "error",
      })
      
      const errorDetails = errors.length > 0 
        ? errors.map(e => `${e.filename}: ${e.error}`).join('; ')
        : 'Could not unlock any files. Check passwords and try again.'
      
      return res.status(500).json({ 
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
      const uploadPath = path.join(__dirname, "uploads", singleFile.filename)
      fs.copyFileSync(path.join(unlockedDir, singleFile.filename), uploadPath)
      
      res.json({
        success: true,
        message: "PDF unlocked - all restrictions removed",
        jobId: jobId,
        fileCount: 1,
        downloadUrl: `/uploads/${singleFile.filename}`,
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
      res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`)

      return res.download(filePath, files[0], (err) => {
        if (err) {
          console.error("Download error:", err)
        }

        setTimeout(() => {
          try {
            if (fs.existsSync(unlockedDir)) {
              fs.rmSync(unlockedDir, { recursive: true, force: true })
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
            fs.rmSync(unlockedDir, { recursive: true, force: true })
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

app.post("/api/contact", async (req, res) => {
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
const { fromPath }     = require('pdf2pic')
const {
  PDFDocument: PDFLibOut,
  StandardFonts,
  rgb,
} = require('pdf-lib')

// Windows: point pdf2pic at the real gm.exe (PowerShell aliases 'gm' to Get-Member)
if (process.platform === 'win32') {
  process.env.GM_PATH = 'C:\\Program Files\\GraphicsMagick-1.3.46-Q16\\gm.exe'
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
  async (req, res) => {
    const startTime = Date.now()
    const file = req.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    // ── Auth ────────────────────────────────────────────────────────────────
    const jwt = require('jsonwebtoken')
    const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production'
    let user = null
    try {
      const hdr = req.headers.authorization
      if (hdr?.startsWith('Bearer '))
        user = jwt.verify(hdr.replace('Bearer ', '').trim(), JWT_SECRET)
    } catch (_) {}
    // Desktop app: treat as Pro (no limits)
    const isDesktop = process.env.ELECTRON_APP === '1' || process.env.DESKTOP_FREE === '1'
    const isPro = isDesktop || user?.plan === 'pro' || user?.plan === 'enterprise'

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

      // ── Get page count via pdf-lib ────────────────────────────────────────
      const pdfBuffer = fs.readFileSync(filePath)
      let totalPages  = 1
      try {
        const srcDoc = await PDFLibOut.load(pdfBuffer, { ignoreEncryption: true })
        totalPages   = srcDoc.getPageCount()
      } catch (_) {}

      // Free plan: max 2 pages
      if (totalPages > 2 && !isPro) {
        cleanup()
        return res.status(429).json({
          error: 'PAGE_LIMIT_EXCEEDED',
          message: `Free plan supports up to 2 pages. Your PDF has ${totalPages} pages. Upgrade to Pro for unlimited pages.`,
        })
      }

      const processedPages = isPro ? totalPages : Math.min(totalPages, 2)

      // ── STEP 1: Try pdf-parse — instant for digital/text PDFs ────────────
      let extractedText = ''
      let ocrPageData   = [] // [{words:[{text,bbox}]}] from Tesseract (per page)

      try {
        const parsed = await pdfParse(pdfBuffer)
        extractedText = (parsed.text || '').trim()
        if (extractedText) {
          console.log(`[OCR] Digital PDF — pdf-parse extracted ${extractedText.length} chars`)
        }
      } catch (_) {}

      // ── STEP 2: No text → render pages as images → Tesseract OCR ─────────
      if (!extractedText) {
        console.log(`[OCR] Scanned PDF — running Tesseract on ${processedPages} page(s)`)

        const converter = fromPath(filePath, {
          density:      300,   // 300 DPI for best OCR accuracy
          saveFilename: `ocr-page-${Date.now()}`,
          savePath:     path.resolve('./uploads'),
          format:       'png',
          width:        2480,  // A4 @ 300 DPI
          height:       3508,
        })

        // createWorker with word-level bounding boxes so we can
        // position the invisible text precisely over each word
        const worker = await createWorker('eng')
        await worker.setParameters({
          tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
        })

        const pageTexts = []

        for (let p = 1; p <= processedPages; p++) {
          try {
            console.log(`[OCR] Page ${p}/${processedPages}…`)
            const output = await converter(p, { responseType: 'image' })
            tmpFiles.push(output.path)

            // Get full data including word-level bboxes
            const { data } = await worker.recognize(output.path)

            // Store per-page word data for precise text overlay later
            ocrPageData.push({
              imgWidth:  data.width,
              imgHeight: data.height,
              words: (data.words || []).map(w => ({
                text: w.text,
                conf: w.confidence,
                bbox: w.bbox, // {x0,y0,x1,y1} in image pixels
              })).filter(w => w.text.trim() && w.conf > 30), // skip low-confidence garbage
            })

            pageTexts.push(data.text.trim())
            console.log(`[OCR] Page ${p} — ${data.words?.length || 0} words`)
          } catch (pageErr) {
            console.error(`[OCR] Page ${p} failed:`, pageErr.message)
            ocrPageData.push({ imgWidth: 2480, imgHeight: 3508, words: [] })
            pageTexts.push('')
          }
        }

        await worker.terminate()
        extractedText = pageTexts.join('\f')
      }

      if (!isPro) await ocrIncrementDaily(req.clientIP)

      const wordCount = extractedText.replace(/\f/g, ' ').split(/\s+/).filter(Boolean).length
      const timestamp = Date.now()
      const outDir    = './uploads'
      console.log(`[OCR] ${wordCount} words total across ${processedPages} page(s)`)

      // ── STEP 3: Build the output PDF ──────────────────────────────────────
      // We copy the EXACT original PDF pages into a new doc (preserves 100%
      // of the original visual layout — fonts, borders, tables, images, colours).
      // Then we overlay the OCR text invisibly so the PDF becomes searchable.

      const pdfOutPath = path.join(outDir, `ocr-${timestamp}.pdf`)

      // Load source doc for page copying
      const srcDoc  = await PDFLibOut.load(pdfBuffer, { ignoreEncryption: true })
      const outDoc  = await PDFLibOut.create()
      const font    = await outDoc.embedFont(StandardFonts.Helvetica)

      // Copy the exact original pages
      const pageIndices  = Array.from({ length: processedPages }, (_, i) => i)
      const copiedPages  = await outDoc.copyPages(srcDoc, pageIndices)

      for (let i = 0; i < processedPages; i++) {
        const page        = outDoc.addPage(copiedPages[i])
        const { width, height } = page.getSize() // real PDF page dimensions in pts

        // ── Overlay invisible OCR text ──────────────────────────────────────
        // Two strategies depending on whether we have word-level bbox data:

        if (ocrPageData.length > 0 && ocrPageData[i]) {
          // Strategy A: word-by-word precise positioning (scanned PDFs)
          // Map each word's image-pixel bbox → PDF point coordinates
          const { imgWidth, imgHeight, words } = ocrPageData[i]
          const scaleX = width  / imgWidth
          const scaleY = height / imgHeight

          for (const word of words) {
            const { text, bbox } = word
            if (!text.trim()) continue

            // Convert image pixel coords to PDF points
            // PDF origin is bottom-left; image origin is top-left → flip Y
            const x      = bbox.x0 * scaleX
            const yTop   = bbox.y0 * scaleY
            const yBot   = bbox.y1 * scaleY
            const boxH   = yBot - yTop
            const pdfY   = height - yBot  // flip: PDF Y from bottom

            // Font size scaled to match the word's bounding box height
            const fontSize = Math.max(4, Math.min(boxH * 0.85, 72))

            try {
              page.drawText(text, {
                x,
                y:       Math.max(1, pdfY),
                size:    fontSize,
                font,
                color:   rgb(1, 1, 1), // white — invisible over any bg
                opacity: 0.01,         // near-zero: hidden but selectable in PDF viewers
              })
            } catch (_) {}
          }

        } else {
          // Strategy B: line-by-line for digital PDFs (pdf-parse output)
          // No bbox data — distribute lines evenly across the page height
          const pageTexts = extractedText.split('\f')
          const lines     = (pageTexts[i] || '').split('\n').filter(l => l.trim())
          if (!lines.length) continue

          const lineHeight = Math.min(16, (height - 80) / lines.length)
          const fontSize   = Math.max(5, lineHeight * 0.72)
          let y = height - 40

          for (const line of lines) {
            if (y < 10) break
            try {
              page.drawText(line.trim(), {
                x:       40,
                y,
                size:    fontSize,
                font,
                color:   rgb(1, 1, 1),
                opacity: 0.01,
              })
            } catch (_) {}
            y -= lineHeight
          }
        }
      }

      const pdfBytes = await outDoc.save()
      fs.writeFileSync(pdfOutPath, pdfBytes)

      const result = {
        pdfUrl:       `/uploads/${path.basename(pdfOutPath)}`,
        pageCount:    processedPages,
        wordCount,
        originalName: file.originalname,
        isImagePdf:   false,
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

      // Auto-delete output files after 2 hours
      const filesToDelete = [
        pdfOutPath,
        result.docxUrl && path.join('.', result.docxUrl),
        result.txtUrl  && path.join('.', result.txtUrl),
      ].filter(Boolean)
      setTimeout(() => {
        filesToDelete.forEach(f => {
          try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch (_) {}
        })
      }, 2 * 60 * 60 * 1000)

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
  function sweepOldFiles() {
    const ONE_HOUR = 60 * 60 * 1000
    const cutoff = Date.now() - ONE_HOUR
    const dirs = ["uploads", "converted", "compressed", "downloads", "temp", "unlocked"]
    let removed = 0
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
          if (stat.mtimeMs < cutoff) {
            fs.rmSync(entryPath, { recursive: true, force: true })
            removed++
          }
        } catch { /* file may already be gone — ignore */ }
      }
    }
    if (removed > 0) console.log(`🧹 Temp sweep: removed ${removed} expired item(s)`)
  }

  // Run once at startup (clears orphans from any previous crash), then every 30 min
  sweepOldFiles()
  setInterval(sweepOldFiles, 30 * 60 * 1000)

  // Prune expired rows from the persistent rate-limit table (startup + hourly)
  cleanupExpiredRateLimits()
  setInterval(cleanupExpiredRateLimits, 60 * 60 * 1000)

  // Start server
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`)
    console.log(`✓ Health check: http://localhost:${PORT}/api/health`)
    console.log(`✓ Admin panel: Login at /api/admin/login`)
    console.log(`✓ Blog system: http://localhost:${PORT}/api/blog/posts`)
    console.log(`✓ Auth routes: /api/auth/signup | /api/auth/login`)
    console.log(`✓ Default admin credentials: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`)
  })