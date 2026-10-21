// ENHANCED DATABASE SETUP - SQLite with Detailed Tracking
// database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✓ Connected to SQLite database');
    // WAL mode lets reads and writes happen concurrently instead of the
    // default rollback-journal mode, which locks the whole file per write —
    // every conversion/download logs a row, so this matters under concurrent load.
    db.run('PRAGMA journal_mode = WAL', (walErr) => {
      if (walErr) console.error('Error enabling WAL mode:', walErr.message);
      else console.log('✓ WAL mode enabled');
    });
    // NORMAL is the standard pairing with WAL — still safe (no corruption risk
    // from app/OS crashes, only from an actual power loss), and faster than
    // the default FULL because it skips an fsync on every transaction commit.
    db.run('PRAGMA synchronous = NORMAL', (syncErr) => {
      if (syncErr) console.error('Error setting synchronous mode:', syncErr.message);
      else console.log('✓ synchronous = NORMAL');
    });
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Blog posts table
    db.run(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        featured_image TEXT,
        author TEXT DEFAULT 'Admin',
        category TEXT DEFAULT 'General',
        status TEXT DEFAULT 'published',
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating blog_posts table:', err.message);
      } else {
        console.log('✓ Blog posts table ready');
      }
    });

    // Blog tags table
    db.run(`
      CREATE TABLE IF NOT EXISTS blog_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('Error creating blog_tags table:', err.message);
      } else {
        console.log('✓ Blog tags table ready');
      }
    });

    // Post-tags junction table
    db.run(`
      CREATE TABLE IF NOT EXISTS post_tags (
        post_id INTEGER,
        tag_id INTEGER,
        FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, tag_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating post_tags table:', err.message);
      } else {
        console.log('✓ Post tags junction table ready');
      }
    });

    // ENHANCED Activity logs table with detailed tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        tool TEXT,
        filename TEXT,
        file_size INTEGER,
        conversion_type TEXT,
        page_count INTEGER,
        job_id TEXT,
        
        -- User tracking
        ip_address TEXT,
        user_agent TEXT,
        browser TEXT,
        os TEXT,
        device TEXT,
        country TEXT,
        city TEXT,
        
        -- Performance metrics
        processing_time INTEGER,
        queue_time INTEGER,
        
        -- Additional metadata
        metadata TEXT,
        error_message TEXT,
        error_stack TEXT,
        status TEXT DEFAULT 'success',
        
        -- Timestamps
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `, (err) => {
      if (err) {
        console.error('Error creating activity_logs table:', err.message);
      } else {
        console.log('✓ Activity logs table ready');
      }
    });

    // IP tracking table for analytics
    db.run(`
      CREATE TABLE IF NOT EXISTS ip_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT UNIQUE NOT NULL,
        country TEXT,
        city TEXT,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_requests INTEGER DEFAULT 1,
        total_conversions INTEGER DEFAULT 0,
        total_downloads INTEGER DEFAULT 0,
        blocked BOOLEAN DEFAULT 0
      )
    `, (err) => {
      if (err) {
        console.error('Error creating ip_analytics table:', err.message);
      } else {
        console.log('✓ IP analytics table ready');
      }
    });

    // Subscriptions table — records every gateway subscription (Lemon Squeezy,
    // Razorpay, PayPal) so subscription history is not lost and cancel/status
    // lookups work. Required by lemonSqueezyRoutes.js upsertSub().
    db.run(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                INTEGER NOT NULL,
        gateway                TEXT NOT NULL,
        gateway_subscription_id TEXT NOT NULL,
        plan                   TEXT NOT NULL,
        status                 TEXT NOT NULL DEFAULT 'active',
        current_period_end     DATETIME,
        cancel_at_period_end   INTEGER DEFAULT 0,
        created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating subscriptions table:', err.message);
      } else {
        console.log('✓ Subscriptions table ready');
      }
    });
    db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway_sub ON subscriptions(gateway_subscription_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)');

    // Persistent rate-limit / quota store — survives restarts and is shared across
    // instances (replaces in-memory Maps). One row per (bucket, identifier).
    //   bucket      : limiter name, e.g. 'api', 'admin-login', 'ocr-daily'
    //   ident       : client identifier (usually IP)
    //   count       : hits in the current window
    //   expires_at  : epoch ms when the window resets
    db.run(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        bucket TEXT NOT NULL,
        ident TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (bucket, ident)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating rate_limits table:', err.message);
      } else {
        console.log('✓ Rate limits table ready');
      }
    });
    db.run('CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at)');

    // Email subscribers — simple opt-in capture (download pages: "notify me about
    // new tools"). No email service wired up yet; stored here for later export/use.
    db.run(`
      CREATE TABLE IF NOT EXISTS email_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        source_page TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating email_subscribers table:', err.message);
      } else {
        console.log('✓ Email subscribers table ready');
      }
    });
    db.run('CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email)');

    // Create indexes for better performance
    db.run('CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)');
    db.run('CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category)');
    db.run('CREATE INDEX IF NOT EXISTS idx_blog_posts_created ON blog_posts(created_at)');
    
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)');
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_tool ON activity_logs(tool)');
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_ip ON activity_logs(ip_address)');
    
    db.run('CREATE INDEX IF NOT EXISTS idx_ip_analytics_ip ON ip_analytics(ip_address)');
    db.run('CREATE INDEX IF NOT EXISTS idx_ip_analytics_last_seen ON ip_analytics(last_seen)');
    
    console.log('✓ Database indexes created');
  });
}

// Helper function to run queries with promises
function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// Helper function to get single row
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper function to get all rows
function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Parse user agent to extract browser, OS, device
function parseUserAgent(userAgent) {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  
  const ua = userAgent.toLowerCase();
  
  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
  // Detect device
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }
  
  return { browser, os, device };
}

// Enhanced activity logging with detailed tracking
async function logActivityToDB(data) {
  try {
    const { browser, os, device } = parseUserAgent(data.userAgent);
    // callers never pass a country (and Cloudflare no longer fronts the site) → resolve it from the IP
    if (!data.country && data.ip) data.country = require('./geo').countryOf(data.ip);
    
    const query = `
      INSERT INTO activity_logs (
        type, action, tool, filename, file_size, conversion_type, page_count, job_id,
        ip_address, user_agent, browser, os, device, country, city,
        processing_time, queue_time, metadata, error_message, error_stack, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const metadata = JSON.stringify({
      ...data,
      type: undefined,
      action: undefined,
      tool: undefined,
      filename: undefined,
      fileSize: undefined,
      conversionType: undefined,
      pageCount: undefined,
      jobId: undefined,
      ip: undefined,
      userAgent: undefined,
      status: undefined,
      error: undefined,
    });
    
    await dbRun(query, [
      data.type,
      data.action,
      data.tool || null,
      data.filename || null,
      data.fileSize || null,
      data.conversionType || null,
      data.pageCount || null,
      data.jobId || null,
      data.ip || null,
      data.userAgent || null,
      browser,
      os,
      device,
      data.country || null,
      data.city || null,
      data.processingTime || null,
      data.queueTime || null,
      metadata,
      data.error || null,
      data.errorStack || null,
      data.status || 'success'
    ]);

    // Update IP analytics
    if (data.ip) {
      await updateIPAnalytics(data.ip, data.type, data.country, data.city);
    }
  } catch (error) {
    console.error('Error logging activity to database:', error.message);
  }
}

// Update IP analytics
async function updateIPAnalytics(ipAddress, activityType, country, city) {
  try {
    // Atomic upsert — the previous SELECT-then-INSERT/UPDATE had a race where two
    // concurrent requests for the same new IP both saw no row and both INSERTed,
    // tripping "UNIQUE constraint failed: ip_analytics.ip_address".
    const now = new Date().toISOString();
    const isConversion = activityType === 'conversion' ? 1 : 0;
    const isDownload = activityType === 'download' ? 1 : 0;

    await dbRun(
      `INSERT INTO ip_analytics
         (ip_address, country, city, last_seen, total_requests, total_conversions, total_downloads)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(ip_address) DO UPDATE SET
         last_seen         = excluded.last_seen,
         total_requests    = total_requests + 1,
         total_conversions = total_conversions + excluded.total_conversions,
         total_downloads   = total_downloads + excluded.total_downloads,
         country           = COALESCE(ip_analytics.country, excluded.country),
         city              = COALESCE(ip_analytics.city, excluded.city)`,
      [ipAddress, country || null, city || null, now, isConversion, isDownload]
    );
  } catch (error) {
    console.error('Error updating IP analytics:', error.message);
  }
}

// Get activity logs with enhanced details
async function getActivityLogsFromDB(options = {}) {
  const {
    page = 1,
    limit = 50,
    type,
    action,
    status,
    tool,
    ipAddress,
    startDate,
    endDate,
  } = options;

  let query = 'SELECT * FROM activity_logs WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (tool) {
    query += ' AND tool = ?';
    params.push(tool);
  }
  if (ipAddress) {
    query += ' AND ip_address = ?';
    params.push(ipAddress);
  }
  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, (page - 1) * limit);

  const logs = await dbAll(query, params);
  
  // Parse metadata JSON
  const parsedLogs = logs.map(log => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : {},
    timestamp: log.created_at,
  }));

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM activity_logs WHERE 1=1';
  const countParams = [];
  
  if (type) {
    countQuery += ' AND type = ?';
    countParams.push(type);
  }
  if (action) {
    countQuery += ' AND action = ?';
    countParams.push(action);
  }
  if (status) {
    countQuery += ' AND status = ?';
    countParams.push(status);
  }
  if (tool) {
    countQuery += ' AND tool = ?';
    countParams.push(tool);
  }
  if (ipAddress) {
    countQuery += ' AND ip_address = ?';
    countParams.push(ipAddress);
  }
  if (startDate) {
    countQuery += ' AND created_at >= ?';
    countParams.push(startDate);
  }
  if (endDate) {
    countQuery += ' AND created_at <= ?';
    countParams.push(endDate);
  }

  const { total } = await dbGet(countQuery, countParams);

  return {
    logs: parsedLogs,
    total: total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / limit),
  };
}

// Get enhanced statistics
async function getStatsFromDB() {
  const now = new Date();
  const last24Hours = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Total stats
  const totalConversions = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'conversion'");
  const totalDownloads = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'download'");
  const totalUploads = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'upload'");
  const totalErrors = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE status IN ('error', 'failed')");
  const totalSecurity = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'security_incident'");

  // Last 24 hours
  const conversions24h = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'conversion' AND created_at > ?", [last24Hours]);
  const downloads24h = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'download' AND created_at > ?", [last24Hours]);
  const uploads24h = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'upload' AND created_at > ?", [last24Hours]);
  const errors24h = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE status IN ('error', 'failed') AND created_at > ?", [last24Hours]);

  // Last 7 days
  const conversions7d = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'conversion' AND created_at > ?", [last7Days]);
  const downloads7d = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'download' AND created_at > ?", [last7Days]);
  const uploads7d = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE type = 'upload' AND created_at > ?", [last7Days]);
  const errors7d = await dbGet("SELECT COUNT(*) as count FROM activity_logs WHERE status IN ('error', 'failed') AND created_at > ?", [last7Days]);

  // Popular tools
  const popularTools = await dbAll(`
    SELECT 
      tool,
      COUNT(*) as count
    FROM activity_logs
    WHERE tool IS NOT NULL
    GROUP BY tool
    ORDER BY count DESC
    LIMIT 10
  `);

  // Errors by type
  const errorsByType = await dbAll(`
    SELECT 
      action,
      COUNT(*) as count
    FROM activity_logs
    WHERE status IN ('error', 'failed')
    GROUP BY action
    ORDER BY count DESC
    LIMIT 10
  `);

  // Browser stats
  const browserStats = await dbAll(`
    SELECT 
      browser,
      COUNT(*) as count
    FROM activity_logs
    WHERE browser IS NOT NULL
    GROUP BY browser
    ORDER BY count DESC
    LIMIT 5
  `);

  // OS stats
  const osStats = await dbAll(`
    SELECT 
      os,
      COUNT(*) as count
    FROM activity_logs
    WHERE os IS NOT NULL
    GROUP BY os
    ORDER BY count DESC
    LIMIT 5
  `);

  // Device stats
  const deviceStats = await dbAll(`
    SELECT 
      device,
      COUNT(*) as count
    FROM activity_logs
    WHERE device IS NOT NULL
    GROUP BY device
    ORDER BY count DESC
  `);

  // Top IPs
  const topIPs = await dbAll(`
    SELECT *
    FROM ip_analytics
    ORDER BY total_requests DESC
    LIMIT 10
  `);

  // Unique visitors
  const uniqueVisitors24h = await dbGet(`
    SELECT COUNT(DISTINCT ip_address) as count 
    FROM activity_logs 
    WHERE created_at > ?
  `, [last24Hours]);

  const uniqueVisitors7d = await dbGet(`
    SELECT COUNT(DISTINCT ip_address) as count 
    FROM activity_logs 
    WHERE created_at > ?
  `, [last7Days]);

  const uniqueVisitors30d = await dbGet(`
    SELECT COUNT(DISTINCT ip_address) as count 
    FROM activity_logs 
    WHERE created_at > ?
  `, [last30Days]);

  // Average processing time
  const avgProcessingTime = await dbGet(`
    SELECT AVG(processing_time) as avg
    FROM activity_logs
    WHERE processing_time IS NOT NULL
  `);

  // Daily activity (last 7 days)
  const dailyActivity = await dbAll(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN type = 'conversion' THEN 1 ELSE 0 END) as conversions,
      SUM(CASE WHEN type = 'download' THEN 1 ELSE 0 END) as downloads
    FROM activity_logs
    WHERE created_at > ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `, [last7Days]);

  const stats = {
    total: {
      conversions: totalConversions.count,
      downloads: totalDownloads.count,
      uploads: totalUploads.count,
      errors: totalErrors.count,
      securityIncidents: totalSecurity.count,
    },
    last24Hours: {
      conversions: conversions24h.count,
      downloads: downloads24h.count,
      uploads: uploads24h.count,
      errors: errors24h.count,
      uniqueVisitors: uniqueVisitors24h.count,
    },
    last7Days: {
      conversions: conversions7d.count,
      downloads: downloads7d.count,
      uploads: uploads7d.count,
      errors: errors7d.count,
      uniqueVisitors: uniqueVisitors7d.count,
    },
    last30Days: {
      uniqueVisitors: uniqueVisitors30d.count,
    },
    popularTools: popularTools.reduce((acc, row) => {
      if (row.tool) acc[row.tool] = row.count;
      return acc;
    }, {}),
    errorsByType: errorsByType.reduce((acc, row) => {
      if (row.action) acc[row.action] = row.count;
      return acc;
    }, {}),
    browserStats: browserStats.reduce((acc, row) => {
      if (row.browser) acc[row.browser] = row.count;
      return acc;
    }, {}),
    osStats: osStats.reduce((acc, row) => {
      if (row.os) acc[row.os] = row.count;
      return acc;
    }, {}),
    deviceStats: deviceStats.reduce((acc, row) => {
      if (row.device) acc[row.device] = row.count;
      return acc;
    }, {}),
    topIPs: topIPs,
    avgProcessingTime: avgProcessingTime.avg || 0,
    dailyActivity: dailyActivity,
  };

  return stats;
}

// Get IP details
async function getIPDetails(ipAddress) {
  try {
    const analytics = await dbGet('SELECT * FROM ip_analytics WHERE ip_address = ?', [ipAddress]);
    
    const recentActivity = await dbAll(`
      SELECT *
      FROM activity_logs
      WHERE ip_address = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [ipAddress]);

    return {
      analytics,
      recentActivity: recentActivity.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : {},
      })),
    };
  } catch (error) {
    console.error('Error getting IP details:', error.message);
    return null;
  }
}

// Block/Unblock IP
async function toggleIPBlock(ipAddress, blocked) {
  try {
    await dbRun(
      'UPDATE ip_analytics SET blocked = ? WHERE ip_address = ?',
      [blocked ? 1 : 0, ipAddress]
    );
    return true;
  } catch (error) {
    console.error('Error toggling IP block:', error.message);
    return false;
  }
}

// Prune old activity_logs and ip_analytics rows so both tables — and the
// admin dashboard queries that scan them — don't grow unbounded forever.
// Blocked IPs are kept regardless of last_seen; everything else past the
// retention window is deleted. Call on a schedule (see server.js).
async function cleanupOldAnalyticsData(retentionDays = 90) {
  try {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const logs = await dbRun('DELETE FROM activity_logs WHERE created_at < ?', [cutoff]);
    const ips = await dbRun(
      'DELETE FROM ip_analytics WHERE last_seen < ? AND blocked = 0',
      [cutoff]
    );
    const removed = (logs.changes || 0) + (ips.changes || 0);
    if (removed > 0) {
      console.log(`🧹 Analytics cleanup: removed ${logs.changes || 0} activity_logs + ${ips.changes || 0} ip_analytics row(s) older than ${retentionDays}d`);
    }
    return { activityLogsRemoved: logs.changes || 0, ipAnalyticsRemoved: ips.changes || 0 };
  } catch (error) {
    console.error('Error cleaning up old analytics data:', error.message);
    return { activityLogsRemoved: 0, ipAnalyticsRemoved: 0 };
  }
}

// Export database and helper functions
module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  logActivityToDB,
  getActivityLogsFromDB,
  getStatsFromDB,
  getIPDetails,
  toggleIPBlock,
  cleanupOldAnalyticsData,
};