// Admin dashboard data endpoints (overview, charts, tools, revenue, health, user detail, exports).
// All routes are mounted under /api/admin/dash and sit behind adminAuth.
//
// TIME: activity_logs / users / payment_events store UTC ("YYYY-MM-DD HH:MM:SS", no
// zone marker). Every "day" / "hour" here is an IST (UTC+5:30) day / hour, so the
// numbers roll over at midnight India time, matching the clock shown in the panel.
const os = require('os')
const fs = require('fs')
const path = require('path')
const { dbAll, dbGet } = require('../database')
const { ensureTable: ensurePaymentTable } = require('./paymentLog')

const IST_MIN = 330
const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const INR_PER_USD = 88 // display-only estimate for the combined revenue figure

// ── Prices (must match pages/pricing.js) ─────────────────────────────────────
const USD_PRICES = { starter: { monthly: 9, yearly: 90 }, pro: { monthly: 19, yearly: 190 }, agency: { monthly: 49, yearly: 490 } }
const INR_PRICES = { starter: { monthly: 399, yearly: 3990 }, pro: { monthly: 799, yearly: 7990 }, agency: { monthly: 1999, yearly: 19990 } }

// ── time helpers ─────────────────────────────────────────────────────────────
const sqlTs = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
// start of the IST day that is `offsetDays` from today, as a UTC epoch
function istDayStart(offsetDays = 0, now = Date.now()) {
  const shifted = now + IST_MIN * MIN
  const dayStart = Math.floor(shifted / DAY) * DAY
  return dayStart + offsetDays * DAY - IST_MIN * MIN
}
const num = (v) => Number(v) || 0

// Counts in a window (UTC bounds). Returns plain numbers.
async function windowStats(fromMs, toMs) {
  const r = await dbGet(
    `SELECT
       SUM(CASE WHEN type = 'conversion' AND status = 'success' THEN 1 ELSE 0 END) AS conversions,
       SUM(CASE WHEN status IN ('error','failed') THEN 1 ELSE 0 END) AS failures,
       SUM(CASE WHEN type = 'download' THEN 1 ELSE 0 END) AS downloads,
       SUM(CASE WHEN type = 'upload' THEN 1 ELSE 0 END) AS uploads,
       COUNT(DISTINCT ip_address) AS visitors
     FROM activity_logs WHERE created_at >= ? AND created_at < ?`,
    [sqlTs(fromMs), sqlTs(toMs)]
  )
  const u = await dbGet('SELECT COUNT(*) AS n FROM users WHERE created_at >= ? AND created_at < ?', [sqlTs(fromMs), sqlTs(toMs)])
  return {
    conversions: num(r?.conversions), failures: num(r?.failures), downloads: num(r?.downloads),
    uploads: num(r?.uploads), visitors: num(r?.visitors), signups: num(u?.n),
  }
}

async function revenueInWindow(fromMs, toMs) {
  try {
    await ensurePaymentTable()
    const rows = await dbAll(
      `SELECT currency, SUM(amount) AS total, COUNT(*) AS n FROM payment_events
       WHERE event IN ('activated','renewed') AND created_at >= ? AND created_at < ? GROUP BY currency`,
      [sqlTs(fromMs), sqlTs(toMs)]
    )
    const out = { USD: 0, INR: 0, payments: 0 }
    for (const x of rows) { if (x.currency in out) out[x.currency] = num(x.total) / 100; out.payments += num(x.n) }
    return out
  } catch (_) { return { USD: 0, INR: 0, payments: 0 } }
}

// ── alerts & system health (shared by /overview and /health) ─────────────────
function readMemAvailablePct() {
  try {
    const txt = fs.readFileSync('/proc/meminfo', 'utf8')
    const total = Number(/MemTotal:\s+(\d+)/.exec(txt)[1]) * 1024
    const avail = Number(/MemAvailable:\s+(\d+)/.exec(txt)[1]) * 1024
    return { total, used: total - avail, usedPct: ((total - avail) / total) * 100 }
  } catch (_) {
    const total = os.totalmem(), free = os.freemem()
    return { total, used: total - free, usedPct: ((total - free) / total) * 100 }
  }
}

function diskInfo() {
  try {
    const s = fs.statfsSync(process.platform === 'win32' ? path.parse(process.cwd()).root : '/')
    const total = s.blocks * s.bsize, free = s.bavail * s.bsize
    return { total, free, used: total - free, usedPct: total ? ((total - free) / total) * 100 : 0 }
  } catch (_) { return null }
}

function uploadsInfo() {
  const dir = path.join(__dirname, '..', 'uploads')
  const out = { files: 0, bytes: 0, oldFiles: 0, oldestMinutes: 0, sampled: false }
  try {
    const names = fs.readdirSync(dir)
    out.files = names.length
    const now = Date.now()
    let oldest = now
    const limit = 4000
    out.sampled = names.length > limit
    for (const n of names.slice(0, limit)) {
      try {
        const st = fs.statSync(path.join(dir, n))
        if (!st.isFile()) continue
        out.bytes += st.size
        if (now - st.mtimeMs > 2 * 60 * MIN) out.oldFiles++
        if (st.mtimeMs < oldest) oldest = st.mtimeMs
      } catch (_) {}
    }
    out.oldestMinutes = Math.round((now - oldest) / MIN)
  } catch (_) {}
  return out
}

async function computeAlerts() {
  const alerts = []
  const now = Date.now()
  const push = (level, title, detail, extra = {}) => alerts.push({ level, title, detail, ...extra })

  // infrastructure
  const disk = diskInfo()
  if (disk) {
    if (disk.usedPct > 90) push('critical', 'Disk almost full', `${disk.usedPct.toFixed(0)}% used — conversions will start failing`, { area: 'system' })
    else if (disk.usedPct > 80) push('warning', 'Disk filling up', `${disk.usedPct.toFixed(0)}% used`, { area: 'system' })
  }
  const mem = readMemAvailablePct()
  if (mem.usedPct > 92) push('critical', 'Memory very high', `${mem.usedPct.toFixed(0)}% of RAM in use`, { area: 'system' })
  else if (mem.usedPct > 85) push('warning', 'Memory high', `${mem.usedPct.toFixed(0)}% of RAM in use`, { area: 'system' })
  const cores = os.cpus().length || 1
  const load = os.loadavg()[0] / cores
  if (os.platform() !== 'win32') {
    if (load > 3) push('critical', 'CPU overloaded', `Load ${os.loadavg()[0].toFixed(1)} on ${cores} cores`, { area: 'system' })
    else if (load > 1.5) push('warning', 'CPU busy', `Load ${os.loadavg()[0].toFixed(1)} on ${cores} cores`, { area: 'system' })
  }
  const up = uploadsInfo()
  if (up.oldFiles > 150) push('warning', 'Temp files not being cleaned', `${up.oldFiles} files older than 2 h in uploads/ (oldest ${Math.round(up.oldestMinutes / 60)} h)`, { area: 'system' })

  // tools failing today (IST day)
  const t0 = istDayStart(0)
  const rows = await dbAll(
    `SELECT tool,
       SUM(CASE WHEN type='conversion' THEN 1 ELSE 0 END) AS attempts,
       SUM(CASE WHEN type='conversion' AND status IN ('error','failed') THEN 1 ELSE 0 END) AS errors
     FROM activity_logs WHERE created_at >= ? AND tool IS NOT NULL AND tool != '' AND COALESCE(ip_address,'') NOT IN ('127.0.0.1','::1','::ffff:127.0.0.1') GROUP BY tool`,
    [sqlTs(t0)]
  )
  for (const r of rows) {
    const attempts = num(r.attempts), errors = num(r.errors)
    if (attempts >= 8 && errors / attempts >= 0.5) push('critical', `${r.tool} is failing`, `${errors} of ${attempts} conversions failed today (${Math.round((errors / attempts) * 100)}%)`, { area: 'tool', tool: r.tool })
    else if (attempts >= 8 && errors / attempts >= 0.25) push('warning', `${r.tool} error rate high`, `${errors} of ${attempts} conversions failed today (${Math.round((errors / attempts) * 100)}%)`, { area: 'tool', tool: r.tool })
  }

  // traffic drop: no successful conversions for 3 h though the same window yesterday had some
  const recent = await dbGet(`SELECT COUNT(*) AS n FROM activity_logs WHERE type='conversion' AND status='success' AND created_at >= ?`, [sqlTs(now - 3 * 60 * MIN)])
  const yest = await dbGet(`SELECT COUNT(*) AS n FROM activity_logs WHERE type='conversion' AND status='success' AND created_at >= ? AND created_at < ?`, [sqlTs(now - DAY - 3 * 60 * MIN), sqlTs(now - DAY)])
  if (num(recent?.n) === 0 && num(yest?.n) >= 8) push('critical', 'No conversions in 3 hours', `Yesterday's same window had ${yest.n}. The site or backend may be down.`, { area: 'traffic' })

  // security
  const sec = await dbGet(`SELECT COUNT(*) AS n FROM activity_logs WHERE type='security_incident' AND created_at >= ?`, [sqlTs(now - DAY)])
  if (num(sec?.n) > 100) push('warning', 'Many blocked requests', `${sec.n} security incidents in 24 h`, { area: 'security' })

  // money
  try {
    await ensurePaymentTable()
    const failed = await dbGet(`SELECT COUNT(*) AS n FROM payment_events WHERE event='failed' AND created_at >= ?`, [sqlTs(now - 7 * DAY)])
    if (num(failed?.n) > 0) push('warning', 'Failed payments', `${failed.n} failed payment(s) in the last 7 days`, { area: 'revenue' })
  } catch (_) {}
  const soon = await dbGet(`SELECT COUNT(*) AS n FROM users WHERE plan != 'free' AND plan_expires_at IS NOT NULL AND plan_expires_at >= datetime('now') AND plan_expires_at < datetime('now','+3 days')`)
  if (num(soon?.n) > 0) push('info', 'Paid plans ending soon', `${soon.n} paid plan(s) expire within 3 days`, { area: 'revenue' })

  const order = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => order[a.level] - order[b.level])
  return alerts
}

// ── CSV ──────────────────────────────────────────────────────────────────────
function csvCell(v) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // spreadsheet formula injection guard
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function toCsv(headers, rows) {
  return '﻿' + [headers.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n')
}
const istString = (ts) => {
  if (!ts) return ''
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(String(ts)) ? ts : String(ts).replace(' ', 'T') + 'Z')
  return isNaN(d) ? '' : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
}

// Optional users columns (added lazily by different payment modules) — select a
// column only when it exists, so one missing column can't take a whole tab down.
let userColsCache = null
async function userCol(name) {
  if (!userColsCache) userColsCache = new Set((await dbAll('PRAGMA table_info(users)')).map((c) => c.name))
  return userColsCache.has(name) ? name : 'NULL'
}

// ── plan / gateway inference for a paid user ────────────────────────────────
function describePaidUser(u, lastEvent, lsActive) {
  let gateway = 'manual'
  if (lastEvent?.gateway) gateway = lastEvent.gateway
  else if (u.paypal_subscription_id) gateway = 'paypal'
  else if (u.razorpay_subscription_id) gateway = 'razorpay'
  else if (lsActive) gateway = 'lemonsqueezy'
  const daysLeft = u.plan_expires_at ? (Date.parse(String(u.plan_expires_at).replace(' ', 'T') + (/[zZ]|\+/.test(String(u.plan_expires_at)) ? '' : 'Z')) - Date.now()) / DAY : null
  let interval = lastEvent?.interval || (daysLeft !== null && daysLeft > 45 ? 'yearly' : 'monthly')
  const currency = gateway === 'razorpay' ? 'INR' : 'USD'
  const list = currency === 'INR' ? INR_PRICES : USD_PRICES
  const price = list[u.plan]?.[interval] ?? USD_PRICES[u.plan]?.[interval] ?? 0
  const monthly = interval === 'yearly' ? price / 12 : price
  return { gateway, interval, currency, price, monthly, daysLeft }
}

module.exports = function registerDashboardRoutes(app, adminAuth) {
  const base = '/api/admin/dash'
  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res) } catch (e) {
      console.error('[admin dash]', req.path, e.message)
      res.status(500).json({ error: 'Dashboard query failed' })
    }
  }

  // ── 1. OVERVIEW ───────────────────────────────────────────────────────────
  app.get(`${base}/overview`, adminAuth, wrap(async (req, res) => {
    const now = Date.now()
    const t0 = istDayStart(0), y0 = istDayStart(-1)
    const elapsed = now - t0
    const [today, yesterdaySoFar, yesterdayFull] = await Promise.all([
      windowStats(t0, now + 1000), windowStats(y0, y0 + elapsed), windowStats(y0, t0),
    ])
    const [revToday, revYesterday] = await Promise.all([revenueInWindow(t0, now + 1000), revenueInWindow(y0, y0 + elapsed)])

    // 7-day sparkline series (IST days, oldest → newest, today included)
    const from7 = istDayStart(-6)
    const daily = await dbAll(
      `SELECT strftime('%Y-%m-%d', created_at, '+${IST_MIN} minutes') AS d,
         SUM(CASE WHEN type='conversion' AND status='success' THEN 1 ELSE 0 END) AS conversions,
         SUM(CASE WHEN status IN ('error','failed') THEN 1 ELSE 0 END) AS failures,
         SUM(CASE WHEN type='download' THEN 1 ELSE 0 END) AS downloads,
         COUNT(DISTINCT ip_address) AS visitors
       FROM activity_logs WHERE created_at >= ? GROUP BY d`, [sqlTs(from7)]
    )
    const signupsDaily = await dbAll(
      `SELECT strftime('%Y-%m-%d', created_at, '+${IST_MIN} minutes') AS d, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY d`, [sqlTs(from7)]
    )
    const byDay = Object.fromEntries(daily.map((r) => [r.d, r]))
    const sByDay = Object.fromEntries(signupsDaily.map((r) => [r.d, r.n]))
    const spark = { conversions: [], failures: [], downloads: [], visitors: [], signups: [] }
    for (let i = 0; i < 7; i++) {
      const key = new Date(from7 + i * DAY + IST_MIN * MIN).toISOString().slice(0, 10)
      const r = byDay[key] || {}
      spark.conversions.push(num(r.conversions)); spark.failures.push(num(r.failures))
      spark.downloads.push(num(r.downloads)); spark.visitors.push(num(r.visitors)); spark.signups.push(num(sByDay[key]))
    }

    const live = await dbGet(`SELECT COUNT(DISTINCT ip_address) AS visitors, COUNT(*) AS events, MAX(created_at) AS last_event FROM activity_logs WHERE created_at >= ?`, [sqlTs(now - 5 * MIN)])
    const lastConv = await dbGet(`SELECT created_at, tool FROM activity_logs WHERE type='conversion' AND status='success' ORDER BY id DESC LIMIT 1`)
    const topTools = await dbAll(
      `SELECT tool,
         SUM(CASE WHEN type='conversion' AND status='success' THEN 1 ELSE 0 END) AS conversions,
         SUM(CASE WHEN type='conversion' AND status IN ('error','failed') THEN 1 ELSE 0 END) AS errors
       FROM activity_logs WHERE created_at >= ? AND tool IS NOT NULL AND tool != '' GROUP BY tool
       HAVING conversions > 0 OR errors > 0 ORDER BY conversions DESC LIMIT 6`, [sqlTs(t0)]
    )
    const totals = await dbGet(`SELECT (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM users WHERE plan != 'free' AND (plan_expires_at IS NULL OR plan_expires_at >= datetime('now'))) AS paid`)
    const alerts = await computeAlerts()

    res.json({
      generatedAt: new Date(now).toISOString(),
      today, yesterdaySoFar, yesterdayFull,
      revenue: { today: revToday, yesterdaySoFar: revYesterday, inrPerUsd: INR_PER_USD },
      spark, live: { visitors: num(live?.visitors), events: num(live?.events), lastEvent: live?.last_event || null },
      lastConversion: lastConv || null, topTools,
      totals: { users: num(totals?.users), paid: num(totals?.paid) },
      alerts: { critical: alerts.filter((a) => a.level === 'critical').length, warning: alerts.filter((a) => a.level === 'warning').length, items: alerts.slice(0, 4) },
    })
  }))

  // ── 2. TIME SERIES ────────────────────────────────────────────────────────
  app.get(`${base}/timeseries`, adminAuth, wrap(async (req, res) => {
    const range = ['24h', '7d', '30d', '90d'].includes(req.query.range) ? req.query.range : '7d'
    const hourly = range === '24h'
    const count = hourly ? 24 : range === '7d' ? 7 : range === '30d' ? 30 : 90
    const step = hourly ? 60 * MIN : DAY
    const shiftedNow = Date.now() + IST_MIN * MIN
    const lastBucket = Math.floor(shiftedNow / step) * step // in "IST clock as UTC" space
    const firstBucket = lastBucket - (count - 1) * step
    const fmt = hourly ? '%Y-%m-%d %H:00' : '%Y-%m-%d'
    const fromUtc = firstBucket - IST_MIN * MIN

    const rows = await dbAll(
      `SELECT strftime('${fmt}', created_at, '+${IST_MIN} minutes') AS b,
         SUM(CASE WHEN type='conversion' AND status='success' THEN 1 ELSE 0 END) AS conversions,
         SUM(CASE WHEN status IN ('error','failed') THEN 1 ELSE 0 END) AS failures,
         SUM(CASE WHEN type='download' THEN 1 ELSE 0 END) AS downloads,
         SUM(CASE WHEN type='upload' THEN 1 ELSE 0 END) AS uploads,
         COUNT(DISTINCT ip_address) AS visitors
       FROM activity_logs WHERE created_at >= ? GROUP BY b`, [sqlTs(fromUtc)]
    )
    const signups = await dbAll(`SELECT strftime('${fmt}', created_at, '+${IST_MIN} minutes') AS b, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY b`, [sqlTs(fromUtc)])
    const map = Object.fromEntries(rows.map((r) => [r.b, r]))
    const sMap = Object.fromEntries(signups.map((r) => [r.b, r.n]))
    const points = []
    for (let i = 0; i < count; i++) {
      const key = new Date(firstBucket + i * step).toISOString().slice(0, hourly ? 13 : 10).replace('T', ' ') + (hourly ? ':00' : '')
      const r = map[key] || {}
      points.push({ t: key, conversions: num(r.conversions), failures: num(r.failures), downloads: num(r.downloads), uploads: num(r.uploads), visitors: num(r.visitors), signups: num(sMap[key]) })
    }
    res.json({ range, bucket: hourly ? 'hour' : 'day', points })
  }))

  // ── 3. TOOLS + BREAKDOWNS ─────────────────────────────────────────────────
  const rangeMs = { '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY, '90d': 90 * DAY }
  app.get(`${base}/tools`, adminAuth, wrap(async (req, res) => {
    const range = rangeMs[req.query.range] ? req.query.range : '7d'
    const span = rangeMs[range], now = Date.now()
    const q = (from, to) => dbAll(
      `SELECT tool,
         SUM(CASE WHEN type='conversion' AND status='success' THEN 1 ELSE 0 END) AS success,
         SUM(CASE WHEN type='conversion' AND status IN ('error','failed') THEN 1 ELSE 0 END) AS errors,
         SUM(CASE WHEN type='download' THEN 1 ELSE 0 END) AS downloads,
         COUNT(DISTINCT ip_address) AS visitors, MAX(created_at) AS last_used
       FROM activity_logs WHERE created_at >= ? AND created_at < ? AND tool IS NOT NULL AND tool != '' GROUP BY tool`, [sqlTs(from), sqlTs(to)]
    )
    const [cur, prev] = await Promise.all([q(now - span, now + 1000), q(now - 2 * span, now - span)])
    const prevMap = Object.fromEntries(prev.map((r) => [r.tool, num(r.success) + num(r.errors)]))
    const tools = cur.map((r) => {
      const attempts = num(r.success) + num(r.errors)
      return {
        tool: r.tool, success: num(r.success), errors: num(r.errors), attempts, downloads: num(r.downloads),
        visitors: num(r.visitors), lastUsed: r.last_used,
        errorRate: attempts ? num(r.errors) / attempts : 0,
        prevAttempts: prevMap[r.tool] || 0,
      }
    }).filter((t) => t.attempts > 0 || t.downloads > 0).sort((a, b) => b.attempts - a.attempts)

    const dim = async (col) => dbAll(
      `SELECT ${col} AS name, COUNT(DISTINCT ip_address) AS n FROM activity_logs
       WHERE created_at >= ? AND ${col} IS NOT NULL AND ${col} != '' AND ${col} != 'Unknown' GROUP BY ${col} ORDER BY n DESC LIMIT 8`, [sqlTs(now - span)]
    )
    const [devices, browsers, systems, countries] = await Promise.all([dim('device'), dim('browser'), dim('os'), dim('country')])
    const plans = await dbAll(`SELECT CASE WHEN plan != 'free' AND plan_expires_at IS NOT NULL AND plan_expires_at < datetime('now') THEN 'free' ELSE plan END AS plan, COUNT(*) AS n FROM users GROUP BY 1`)
    res.json({ range, tools, breakdowns: { devices, browsers, systems, countries }, plans })
  }))

  // ── 4. REVENUE ────────────────────────────────────────────────────────────
  app.get(`${base}/revenue`, adminAuth, wrap(async (req, res) => {
    await ensurePaymentTable()
    const paid = await dbAll(
      `SELECT id, name, email, plan, plan_expires_at, created_at, ${await userCol('razorpay_subscription_id')} AS razorpay_subscription_id, ${await userCol('paypal_subscription_id')} AS paypal_subscription_id
       FROM users WHERE plan != 'free' AND (plan_expires_at IS NULL OR plan_expires_at >= datetime('now')) ORDER BY created_at DESC`
    )
    const lastEvents = await dbAll(`SELECT user_id, gateway, interval, plan, MAX(id) AS id FROM payment_events WHERE event IN ('activated','renewed') GROUP BY user_id`)
    const evByUser = Object.fromEntries(lastEvents.map((e) => [e.user_id, e]))
    const lsRows = await dbAll(`SELECT DISTINCT user_id FROM subscriptions WHERE gateway='lemonsqueezy' AND status='active'`)
    const lsSet = new Set(lsRows.map((r) => r.user_id))

    const subscribers = paid.map((u) => {
      const d = describePaidUser(u, evByUser[u.id], lsSet.has(u.id))
      return { id: u.id, name: u.name, email: u.email, plan: u.plan, expiresAt: u.plan_expires_at, joinedAt: u.created_at, ...d }
    })
    const mrr = { USD: 0, INR: 0 }
    const byPlan = {}
    const byGateway = {}
    for (const s of subscribers) {
      mrr[s.currency] += s.monthly
      byPlan[s.plan] = (byPlan[s.plan] || 0) + 1
      byGateway[s.gateway] = (byGateway[s.gateway] || 0) + 1
    }
    const mrrUsdEstimate = mrr.USD + mrr.INR / INR_PER_USD

    // real payment history (since payment_events was introduced)
    const first = await dbGet(`SELECT MIN(created_at) AS since, COUNT(*) AS n FROM payment_events`)
    const monthly = await dbAll(
      `SELECT strftime('%Y-%m', created_at, '+${IST_MIN} minutes') AS m, currency, SUM(amount) AS total, COUNT(*) AS n
       FROM payment_events WHERE event IN ('activated','renewed') GROUP BY m, currency ORDER BY m DESC LIMIT 24`
    )
    const recent = await dbAll(
      `SELECT p.id, p.created_at, p.gateway, p.event, p.plan, p.interval, p.amount, p.currency, u.email
       FROM payment_events p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 25`
    )
    const failed30 = await dbGet(`SELECT COUNT(*) AS n FROM payment_events WHERE event='failed' AND created_at >= datetime('now','-30 days')`)

    // funnel
    const f = await dbGet(`SELECT COUNT(*) AS total, SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) AS verified,
       SUM(CASE WHEN created_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS new30 FROM users`)
    const everPaid = await dbGet(`SELECT COUNT(DISTINCT u) AS n FROM (SELECT user_id AS u FROM payment_events WHERE event IN ('activated','renewed') UNION SELECT user_id AS u FROM subscriptions UNION SELECT id AS u FROM users WHERE plan != 'free')`)
    const ttp = await dbGet(`SELECT AVG(julianday(p.created_at) - julianday(u.created_at)) AS days
       FROM (SELECT user_id, MIN(created_at) AS created_at FROM payment_events WHERE event='activated' GROUP BY user_id) p JOIN users u ON u.id = p.user_id`)

    // risk
    const renewing = subscribers.filter((s) => s.daysLeft !== null && s.daysLeft >= 0 && s.daysLeft <= 7).sort((a, b) => a.daysLeft - b.daysLeft)
    const lapsed = await dbAll(
      `SELECT u.id, u.email, u.plan, u.plan_expires_at FROM users u
       WHERE u.plan != 'free' AND u.plan_expires_at IS NOT NULL AND u.plan_expires_at < datetime('now') AND u.plan_expires_at >= datetime('now','-30 days') LIMIT 20`
    )
    const cancelled = await dbAll(`SELECT s.user_id, u.email, s.plan, s.gateway, s.status, s.updated_at FROM subscriptions s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.status IN ('expired','cancelled') ORDER BY s.updated_at DESC LIMIT 10`)

    res.json({
      inrPerUsd: INR_PER_USD, prices: { USD: USD_PRICES, INR: INR_PRICES },
      mrr: { ...mrr, usdEstimate: mrrUsdEstimate }, arr: { USD: mrr.USD * 12, INR: mrr.INR * 12, usdEstimate: mrrUsdEstimate * 12 },
      activeSubscribers: subscribers.length, byPlan, byGateway, subscribers,
      history: { since: first?.since || null, events: num(first?.n), monthly, recent, failedLast30d: num(failed30?.n) },
      funnel: { totalUsers: num(f?.total), verified: num(f?.verified), newLast30d: num(f?.new30), everPaid: num(everPaid?.n), paidNow: subscribers.length,
        conversionRate: num(f?.total) ? subscribers.length / num(f.total) : 0, avgDaysToPay: ttp?.days == null ? null : Number(ttp.days) },
      risk: { renewingSoon: renewing, lapsed, cancelled },
    })
  }))

  app.get(`${base}/export/revenue`, adminAuth, wrap(async (req, res) => {
    await ensurePaymentTable()
    const rows = await dbAll(`SELECT p.created_at, u.email, p.gateway, p.event, p.plan, p.interval, p.amount, p.currency, p.ref
       FROM payment_events p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC`)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"')
    res.send(toCsv(['Time (IST)', 'Email', 'Gateway', 'Event', 'Plan', 'Interval', 'Amount', 'Currency', 'Reference'],
      rows.map((r) => [istString(r.created_at), r.email, r.gateway, r.event, r.plan, r.interval, r.amount == null ? '' : (r.amount / 100).toFixed(2), r.currency, r.ref])))
  }))

  // ── 5. HEALTH ─────────────────────────────────────────────────────────────
  app.get(`${base}/health`, adminAuth, wrap(async (req, res) => {
    const t = Date.now()
    await dbGet('SELECT 1')
    const dbLatency = Date.now() - t
    let dbBytes = 0
    try { dbBytes = fs.statSync(path.join(__dirname, '..', 'database.sqlite')).size } catch (_) {}
    const mem = readMemAvailablePct()
    const load = os.loadavg()
    const up = uploadsInfo()
    const recentErrors = await dbAll(
      `SELECT tool, substr(error_message, 1, 160) AS message, COUNT(*) AS n, MAX(created_at) AS last
       FROM activity_logs WHERE status IN ('error','failed') AND created_at >= datetime('now','-24 hours') AND error_message IS NOT NULL AND error_message != '' AND COALESCE(ip_address,'') NOT IN ('127.0.0.1','::1','::ffff:127.0.0.1')
       GROUP BY tool, message ORDER BY n DESC LIMIT 10`
    )
    const errors1h = await dbGet(`SELECT COUNT(*) AS n FROM activity_logs WHERE status IN ('error','failed') AND created_at >= datetime('now','-1 hour')`)
    const alerts = await computeAlerts()
    const pm = process.memoryUsage()
    res.json({
      generatedAt: new Date().toISOString(),
      system: {
        platform: `${os.type()} ${os.release()}`, cpus: os.cpus().length, load: load.map((x) => Number(x.toFixed(2))),
        loadPct: Math.min(100, Math.round((load[0] / (os.cpus().length || 1)) * 100)),
        memory: { total: mem.total, used: mem.used, usedPct: Number(mem.usedPct.toFixed(1)) }, disk: diskInfo(),
        uptimeSeconds: Math.round(os.uptime()),
      },
      app: {
        node: process.version, pid: process.pid, uptimeSeconds: Math.round(process.uptime()),
        rss: pm.rss, heapUsed: pm.heapUsed, heapTotal: pm.heapTotal, dbBytes, dbLatencyMs: dbLatency,
        uploads: up, errorsLastHour: num(errors1h?.n),
      },
      alerts, recentErrors,
    })
  }))

  // ── 6. USERS: export + detail ─────────────────────────────────────────────
  app.get(`${base}/users/export`, adminAuth, wrap(async (req, res) => {
    const where = [], params = []
    if (req.query.plan) { where.push('plan = ?'); params.push(String(req.query.plan)) }
    if (req.query.search) { where.push('(name LIKE ? OR email LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`) }
    const rows = await dbAll(
      `SELECT id, name, email, plan, plan_expires_at, email_verified, is_banned, created_at, last_login_at,
         CASE WHEN ${await userCol('google_id')} IS NOT NULL AND ${await userCol('google_id')} != '' THEN 'google' ELSE 'email' END AS auth
       FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`, params
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"')
    res.send(toCsv(['ID', 'Name', 'Email', 'Plan', 'Plan expires (IST)', 'Verified', 'Banned', 'Sign-up', 'Joined (IST)', 'Last login (IST)'],
      rows.map((r) => [r.id, r.name, r.email, r.plan, istString(r.plan_expires_at), r.email_verified ? 'yes' : 'no', r.is_banned ? 'yes' : 'no', r.auth, istString(r.created_at), istString(r.last_login_at)])))
  }))

  app.get(`${base}/users/:id`, adminAuth, wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user id' })
    const gid = await userCol('google_id'), rz = await userCol('razorpay_subscription_id'), pp = await userCol('paypal_subscription_id')
    const u = await dbGet(
      `SELECT id, name, email, avatar, plan, plan_expires_at, email_verified, is_banned, ban_reason, created_at, last_login_at,
         ${gid} IS NOT NULL AND ${gid} != '' AS google,
         ${rz} IS NOT NULL AND ${rz} != '' AS has_razorpay,
         ${pp} IS NOT NULL AND ${pp} != '' AS has_paypal
       FROM users WHERE id = ?`, [id]
    )
    if (!u) return res.status(404).json({ error: 'User not found' })
    await ensurePaymentTable()
    const [subs, payments, files, tools, keys, usage] = await Promise.all([
      dbAll('SELECT gateway, plan, status, current_period_end, cancel_at_period_end, created_at FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 10', [id]),
      dbAll('SELECT created_at, gateway, event, plan, interval, amount, currency FROM payment_events WHERE user_id = ? ORDER BY id DESC LIMIT 20', [id]),
      dbAll('SELECT tool, original_name, file_size, created_at FROM user_files WHERE user_id = ? ORDER BY id DESC LIMIT 15', [id]).catch(() => []),
      dbAll('SELECT tool, COUNT(*) AS n FROM user_files WHERE user_id = ? GROUP BY tool ORDER BY n DESC', [id]).catch(() => []),
      dbAll('SELECT name, key_prefix, revoked, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY id DESC LIMIT 10', [id]).catch(() => []),
      dbAll('SELECT period, count FROM api_usage WHERE user_id = ? ORDER BY period DESC LIMIT 3', [id]).catch(() => []),
    ])
    res.json({ user: { ...u, google: !!u.google, has_razorpay: !!u.has_razorpay, has_paypal: !!u.has_paypal }, subscriptions: subs, payments, files, tools, apiKeys: keys, apiUsage: usage })
  }))
}

module.exports.helpers = { istDayStart, sqlTs, toCsv, describePaidUser }
