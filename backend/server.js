// server.js - Express Backend with Admin Panel, Activity Tracking & File Validation
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
  const { router: paymentRouter, webhookHandler } = require('./payments/paymentRoutes')
  const { router: paddleRouter, paddleWebhookHandler } = require('./payments/paddleRoutes')


  const app = express()
  const PORT = process.env.PORT || 5011

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
  // ⚠️ Paddle webhook MUST be before express.json() — needs raw body for HMAC verification
  app.use('/api/paddle/webhook', express.raw({ type: 'application/json' }), paddleWebhookHandler)

  app.use(express.json())
  app.use("/uploads", express.static("uploads"))
  app.use('/api/auth', authRouter)
  app.use('/api/payments', paymentRouter)
  app.use('/api/paddle', paddleRouter)
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
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1'
  }

  // Remove IPv6 prefix
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7)
  }

  return ip.trim()
}

// Attach client IP to every request
app.use((req, res, next) => {
  req.clientIP = getClientIP(req)
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
      tags: tags.map(t => t.name)
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
      ip: req.ip || req.headers["x-forwarded-for"],
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

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      const stats = await dbGet(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) as free_users,
          SUM(CASE WHEN plan = 'starter' THEN 1 ELSE 0 END) as starter_users,
          SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) as pro_users,
          SUM(CASE WHEN plan = 'agency' THEN 1 ELSE 0 END) as agency_users,
          SUM(CASE WHEN plan != 'free' THEN 1 ELSE 0 END) as paid_users,
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
        `SELECT id, name, email, plan, email_verified, is_banned, ban_reason,
                created_at, last_login_at,
                (google_id IS NOT NULL) as is_google
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
      await dbRun('UPDATE users SET plan = ? WHERE id = ?', [plan, id])
      res.json({ success: true })
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
  app.post("/api/word-to-pdf", upload.single("file"), fileValidation, async (req, res) => {
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        await execPromise(command, {
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024,
        })

        const libreOutputPath = inputPath.replace(/\.(doc|docx)$/i, ".pdf")

        if (fs.existsSync(libreOutputPath)) {
          if (libreOutputPath !== outputPath) {
            fs.renameSync(libreOutputPath, outputPath)
          }

          console.log("Conversion successful:", outputFilename)
          fs.unlinkSync(inputPath)

          logActivity({
            type: "conversion",
            action: "word_to_pdf_complete",
            tool: "word-to-pdf",
            conversionType: "word-to-pdf",
            filename: req.file.originalname,
            ip: req.ip || req.headers["x-forwarded-for"],
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

        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath)
        }

        logActivity({
          type: "conversion",
          action: "word_to_pdf_failed",
          tool: "word-to-pdf",
          filename: req.file.originalname,
          error: conversionError.message,
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // PNG to PDF - FIXED VERSION
  app.post("/api/png-to-pdf", upload.array("files", 500), batchLimiter("png-to-pdf"), fileValidation, async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      logActivity({
        type: "upload",
        action: "png_uploaded",
        tool: "png-to-pdf",
        fileCount: req.files.length,
        ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
app.post("/api/excel-to-pdf", upload.single("file"), fileValidation, async (req, res) => {
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
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`Excel to PDF - ${req.files.length} file(s) received`)

    const jobId = Date.now().toString()
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

    wb = load_workbook("${file.path.replace(/\\/g, "\\\\")}")

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

    wb.save("${preparedPath.replace(/\\/g, "\\\\")}")
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
          const { stdout: prepOut } = await execPromise(`"${pythonBin}" "${tempScriptPath}"`, {
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

        await execPromise(command, { timeout: 180000, maxBuffer: 100 * 1024 * 1024 })

        // Clean up prepared file
        if (fs.existsSync(preparedPath)) fs.unlinkSync(preparedPath)

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
        ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
      status: "error",
    })
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download files", details: error.message })
    }
  }
})
  // PNG to WEBP conversion endpoint
  app.post("/api/png-to-webp", upload.array("files", 500), batchLimiter("png-to-webp"), fileValidation, async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      logActivity({
        type: "upload",
        action: "png_uploaded",
        tool: "png-to-webp",
        fileCount: req.files.length,
        ip: req.ip || req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log(`PNG to WEBP - ${req.files.length} file(s) received`)

      const jobId = Date.now().toString()
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // Compress Image endpoint
  app.post("/api/compress-image", upload.array("files", 500), batchLimiter("compress-image"), fileValidation, async (req, res) => {
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
        ip: req.ip || req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      const jobId = Date.now().toString()
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
          status: "error",
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
          status: "error",
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })
      
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download files", details: error.message })
      }
    }
  })

  app.post("/api/merge-pdf", upload.array("files", 500), batchLimiter("merge-pdf"), fileValidation, async (req, res) => {
    try {
      if (!req.files || req.files.length < 2) {
        return res.status(400).json({ error: "At least 2 PDF files required for merging" })
      }

      logActivity({
        type: "upload",
        action: "pdfs_uploaded",
        tool: "merge-pdf",
        fileCount: req.files.length,
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "success",
      })

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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })

      res.status(500).json({ error: error.message })
    }
  })


app.post("/api/compress-pdf-batch", upload.array("files", 500), batchLimiter("compress-pdf"), fileValidation, async (req, res) => {
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

    const jobId = Date.now().toString()
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

        // ── Pass 3: pick the smallest — never inflate the file ──
        const winner = pickSmallest([
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
        for (const tmp of [pass1Path, pass2Path]) {
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

app.post("/api/pdf-to-jpg", upload.single("file"), fileValidation, async (req, res) => {
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
      status: "error",
    })
    
    res.status(500).json({ error: error.message })
  }
})

  // PDF to PNG Conversion
  app.post("/api/pdf-to-png", upload.single("pdf"), fileValidation, async (req, res) => {
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
        ip: req.ip || req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log("PDF to PNG - File received:", req.file.originalname)

      const inputPath = req.file.path
      const outputDir = path.dirname(inputPath)
      const baseName = path.basename(req.file.filename, path.extname(req.file.filename))
      const jobId = Date.now().toString()

      const dpi = 150

      console.log(`Converting PDF to PNG with DPI: ${dpi}...`)

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
          ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // WEBP to PNG Conversion
  app.post("/api/webp-to-png", upload.array("files", 500), batchLimiter("webp-to-png"), fileValidation, async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" })
      }

      logActivity({
        type: "upload",
        action: "webp_uploaded",
        tool: "webp-to-png",
        fileCount: req.files.length,
        ip: req.ip || req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log(`WEBP to PNG - ${req.files.length} file(s) received`)

      const jobId = Date.now().toString()
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log("Analyze PDF - File received:", req.file.originalname)

      const inputPath = req.file.path
      const jobId = Date.now().toString()
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })

  // Split PDF - Extract specific pages
  app.post("/api/split-pdf", upload.single("file"), fileValidation, async (req, res) => {
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
      const jobId = Date.now().toString()
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
          status: "error",
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })


// ── PDF TO WORD CONVERSION ENDPOINT ──────────────────────────────────────────
app.post("/api/pdf-to-word", upload.array("files", 500), batchLimiter("pdf-to-word"), fileValidation, async (req, res) => {
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

    const jobId = Date.now().toString()
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

          await execPromise(loCmd, {
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

      logActivity({
        type: "conversion",
        action: "pdf_to_word_failed",
        tool: "pdf-to-word",
        error: "No files converted.",
        ip: req.clientIP,
        status: "error",
      })

      return res.status(500).json({
        error: "No files were converted successfully.",
        details: errors.length > 0
          ? errors.map(e => e.error).join("; ")
          : "Ensure pdf2docx is installed: pip install pdf2docx pdfplumber python-docx\nAnd LibreOffice 7.0+ is installed as a fallback.",
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
        status: "error",
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

  app.post("/api/jpg-to-pdf", upload.array("files", 500), batchLimiter("jpg-to-pdf"), fileValidation, async (req, res) => {
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
        ip: req.ip || req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"],
        status: "processing",
      })

      console.log(`JPG to PDF - ${req.files.length} file(s) received`)

      const jobId = Date.now().toString()
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
          ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
          ip: req.ip || req.headers["x-forwarded-for"],
          status: "error",
        })
        
        return res.status(404).json({ error: "PDF file not found" })
      }

      logActivity({
        type: "download",
        action: "file_downloaded",
        jobId: jobId,
        filename: pdfFilename,
        ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })
      
      res.status(500).json({ error: error.message })
    }
  })
// PDF to Excel Conversion using pdfplumber
app.post("/api/pdf-to-excel", upload.array("files", 500), batchLimiter("pdf-to-excel"), fileValidation, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "pdf_uploaded",
      tool: "pdf-to-excel",
      fileCount: req.files.length,
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`PDF to Excel - ${req.files.length} file(s) received`)

    const jobId = Date.now().toString()
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

def convert_pdf_to_excel(input_pdf, output_xlsx):
    try:
        import pdfplumber
        import pandas as pd
        from openpyxl import Workbook
        from openpyxl.utils.dataframe import dataframe_to_rows
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        
        print(f"Reading PDF: {input_pdf}")
        
        all_tables = []
        
        with pdfplumber.open(input_pdf) as pdf:
            print(f"PDF has {len(pdf.pages)} pages")
            
            for page_num, page in enumerate(pdf.pages, 1):
                # Extract tables from page
                tables = page.extract_tables()
                
                if tables:
                    for table_idx, table in enumerate(tables):
                        if table and len(table) > 0:
                            # Convert to DataFrame
                            # Use first row as header if it looks like headers
                            df = pd.DataFrame(table[1:], columns=table[0]) if len(table) > 1 else pd.DataFrame(table)
                            
                            # Clean up empty columns and rows
                            df = df.dropna(how='all', axis=1)
                            df = df.dropna(how='all', axis=0)
                            
                            if not df.empty:
                                all_tables.append({
                                    'page': page_num,
                                    'table': table_idx + 1,
                                    'data': df
                                })
                                print(f"Found table on page {page_num}: {len(df)} rows x {len(df.columns)} columns")
                
                # If no tables found, try to extract all text as a single column
                if not tables:
                    text = page.extract_text()
                    if text and text.strip():
                        lines = [line.strip() for line in text.split('\\n') if line.strip()]
                        if lines:
                            # Try to detect if text is tabular (has consistent delimiters)
                            # Check for tab or multiple spaces as delimiters
                            potential_table = []
                            for line in lines:
                                # Split by multiple spaces or tabs
                                import re
                                cells = re.split(r'\\t|\\s{2,}', line)
                                cells = [c.strip() for c in cells if c.strip()]
                                if cells:
                                    potential_table.append(cells)
                            
                            if potential_table and len(potential_table) > 1:
                                # Find max columns
                                max_cols = max(len(row) for row in potential_table)
                                # Pad rows to have same number of columns
                                padded_table = [row + [''] * (max_cols - len(row)) for row in potential_table]
                                
                                df = pd.DataFrame(padded_table[1:], columns=padded_table[0]) if len(padded_table) > 1 else pd.DataFrame(padded_table)
                                df = df.dropna(how='all', axis=1)
                                df = df.dropna(how='all', axis=0)
                                
                                if not df.empty and len(df.columns) > 1:
                                    all_tables.append({
                                        'page': page_num,
                                        'table': 1,
                                        'data': df
                                    })
                                    print(f"Extracted text table from page {page_num}: {len(df)} rows x {len(df.columns)} columns")
        
        if not all_tables:
            print("NO_TABLES_FOUND")
            return False
        
        print(f"Total tables found: {len(all_tables)}")
        
        # Create Excel workbook
        wb = Workbook()
        wb.remove(wb.active)
        
        # Define styles
        header_font = Font(bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell_alignment = Alignment(horizontal="left", vertical="center")
        thin_border = Border(
            left=Side(style='thin', color='B4B4B4'),
            right=Side(style='thin', color='B4B4B4'),
            top=Side(style='thin', color='B4B4B4'),
            bottom=Side(style='thin', color='B4B4B4')
        )
        
        for idx, table_info in enumerate(all_tables):
            sheet_name = f"Page{table_info['page']}_Table{table_info['table']}"
            if len(sheet_name) > 31:
                sheet_name = f"P{table_info['page']}_T{table_info['table']}"
            
            ws = wb.create_sheet(title=sheet_name[:31])
            df = table_info['data']
            
            # Write data
            for r_idx, row in enumerate(dataframe_to_rows(df, index=False, header=True)):
                for c_idx, value in enumerate(row, 1):
                    cell = ws.cell(row=r_idx + 1, column=c_idx, value=value)
                    cell.border = thin_border
                    
                    if r_idx == 0:
                        cell.font = header_font
                        cell.fill = header_fill
                        cell.alignment = header_alignment
                    else:
                        cell.alignment = cell_alignment
            
            # Auto-adjust column widths
            for column in ws.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if cell.value:
                            max_length = max(max_length, len(str(cell.value)))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                ws.column_dimensions[column_letter].width = max(adjusted_width, 10)
        
        wb.save(output_xlsx)
        print("SUCCESS")
        return True
        
    except ImportError as e:
        print(f"IMPORT_ERROR: {e}")
        print("Please install required packages: pip install pdfplumber pandas openpyxl")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

# Run conversion
if __name__ == "__main__":
    result = convert_pdf_to_excel("${inputPath}", "${outputPath}")
    sys.exit(0 if result else 1)
`

        fs.writeFileSync(scriptPath, pythonScript)
        console.log(`Python script created: ${scriptPath}`)

        try {
          const { stdout, stderr } = await execPromise(`python "${scriptPath}"`, {
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

      logActivity({
        type: "conversion",
        action: "pdf_to_excel_failed",
        tool: "pdf-to-excel",
        error: "No files converted",
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
      })
      
      return res.status(500).json({ 
        error: "No files were converted successfully.",
        details: "The PDF may not contain extractable tables, or it might be a scanned/image-based PDF. Please try a PDF with clear tabular data."
      })
    }

    logActivity({
      type: "conversion",
      action: "pdf_to_excel_complete",
      tool: "pdf-to-excel",
      conversionType: "pdf-to-excel",
      fileCount: convertedFiles.length,
      jobId: jobId,
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
app.post("/api/ppt-to-pdf", upload.array("files", 500), batchLimiter("ppt-to-pdf"), fileValidation, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PowerPoint files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "ppt_uploaded",
      tool: "ppt-to-pdf",
      fileCount: req.files.length,
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`PPT to PDF - ${req.files.length} file(s) received`)

    const jobId = Date.now().toString()
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

        await execPromise(command, {
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
      status: "error",
    })
    
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download files", details: error.message })
    }
  }
})
// PDF to PowerPoint Conversion using LibreOffice
app.post("/api/pdf-to-ppt", upload.array("files", 500), batchLimiter("pdf-to-ppt"), fileValidation, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF files uploaded" })
    }

    logActivity({
      type: "upload",
      action: "pdf_uploaded_for_ppt",
      tool: "pdf-to-ppt",
      fileCount: req.files.length,
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
      status: "processing",
    })

    console.log(`PDF to PPT - ${req.files.length} file(s) received`)

    const jobId = Date.now().toString()
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

          await execPromise(command, {
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
            
            await execPromise(command2, {
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
            
            await execPromise(command3, {
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
              
              await execPromise(command4, {
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
        ip: req.ip || req.headers["x-forwarded-for"],
        status: "error",
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
        ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
      ip: req.ip || req.headers["x-forwarded-for"],
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
app.post("/api/unlock-pdf", upload.array("files", 5), fileValidation, async (req, res) => {
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

    const jobId = Date.now().toString()
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
        status: "error",
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

// ── Daily limit tracker (free/guest users, resets on server restart) ─────────
const ocrDailyMap = new Map() // ip → { date: 'YYYY-MM-DD', count: number }

function ocrCheckDaily(ip) {
  const today = new Date().toISOString().slice(0, 10)
  const rec = ocrDailyMap.get(ip)
  if (!rec || rec.date !== today) return true
  return rec.count < 1
}

function ocrIncrementDaily(ip) {
  const today = new Date().toISOString().slice(0, 10)
  const rec = ocrDailyMap.get(ip)
  if (!rec || rec.date !== today) ocrDailyMap.set(ip, { date: today, count: 1 })
  else rec.count++
}

// ── Route ─────────────────────────────────────────────────────────────────────
app.post('/api/ocr-pdf',
  upload.single('file'),
  batchLimiter('ocr-pdf'),
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
    const isPro = user?.plan === 'pro' || user?.plan === 'enterprise'

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
      if (!isPro && !ocrCheckDaily(req.clientIP)) {
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

      if (!isPro) ocrIncrementDaily(req.clientIP)

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
  // Start server
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`)
    console.log(`✓ Health check: http://localhost:${PORT}/api/health`)
    console.log(`✓ Admin panel: Login at /api/admin/login`)
    console.log(`✓ Blog system: http://localhost:${PORT}/api/blog/posts`)
    console.log(`✓ Auth routes: /api/auth/signup | /api/auth/login`)
    console.log(`✓ Default admin credentials: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`)
  })