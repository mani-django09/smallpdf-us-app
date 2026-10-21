// Traffic-source tracking: where do visitors come from (direct, Google, Bing, social, AI chat, other sites)?
//
//   POST /api/track/visit              (public beacon, once per browser session — sent by pages/_app.js)
//   GET  /api/admin/dash/sources       (admin: breakdowns for the "Traffic sources" tab)
//
// activity_logs only records people who actually used a tool, and never stored a referrer, so this adds
// its own `visits` table. Rows come from the beacon (origin='beacon') and, for history, from a one-off
// backfill over the nginx access logs (origin='nginx'; scripts/backfill-visits.js).
const { dbRun, dbGet, dbAll } = require('../database')
const { classify, BOT_UA } = require('./trafficSource')
const { countryOf } = require('../geo')

const MIN = 60 * 1000, DAY = 24 * 60 * MIN, IST_MIN = 330
const sqlTs = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
const num = (v) => Number(v) || 0

let ready = null
function ensureTable() {
  if (!ready) {
    ready = (async () => {
      await dbRun(`CREATE TABLE IF NOT EXISTS visits (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip           TEXT,
        session      TEXT,
        source       TEXT NOT NULL,     -- direct | google | bing | facebook | chatgpt | <referring host> | <utm_source>
        medium       TEXT NOT NULL,     -- direct | organic | social | ai | referral | paid | campaign | <utm_medium>
        ref_host     TEXT,              -- external referring host, if any
        campaign     TEXT,              -- utm_campaign
        landing      TEXT,              -- path of the first page (no query string)
        locale       TEXT,
        device       TEXT,              -- mobile | tablet | desktop
        country      TEXT,              -- Cloudflare CF-IPCountry (2 letters)
        origin       TEXT DEFAULT 'beacon'
      )`)
      await dbRun('CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at)')
      await dbRun('CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip)')
    })().catch((e) => { ready = null; throw e })
  }
  return ready
}

function deviceOf(ua) {
  const s = String(ua || '')
  if (/iPad|Tablet|Nexus 7|Nexus 9|SM-T\d/i.test(s)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod/i.test(s)) return 'mobile'
  return 'desktop'
}
const LOCALES = new Set(['en', 'de', 'es', 'fr', 'id', 'it', 'ja', 'pt'])

function registerVisitBeacon(app) {
  ensureTable().catch((e) => console.warn('[visits] table not ready:', e.message))

  app.post('/api/track/visit', async (req, res) => {
    res.status(204).end()                       // never make the page wait
    try {
      const ua = req.headers['user-agent'] || ''
      if (!ua || BOT_UA.test(ua)) return
      const b = req.body || {}
      const session = String(b.s || '').slice(0, 40)
      let url
      if (!/^https?:\/\//i.test(String(b.u || ''))) return          // must be an absolute page URL
      try { url = new URL(String(b.u)) } catch { return }
      if (!/(^|\.)smallpdf\.us$|^localhost$|^127\.0\.0\.1$/i.test(url.hostname)) return   // only our own pages
      const path = url.pathname.slice(0, 200)
      if (/^\/(admin|api|_next)\b/.test(path)) return
      const ip = req.clientIP || req.ip || ''
      await ensureTable()
      // same browser session reported twice (reload, double beacon) within 6 h → keep the first
      if (session && await dbGet(`SELECT 1 AS x FROM visits WHERE ip = ? AND session = ? AND created_at >= ? LIMIT 1`, [ip, session, sqlTs(Date.now() - 6 * 60 * MIN)])) return
      const { source, medium, refHost } = classify(String(b.r || '').slice(0, 400), {
        source: url.searchParams.get('utm_source'), medium: url.searchParams.get('utm_medium'),
      })
      const first = path.split('/')[1]
      const country = countryOf(ip, req.headers['cf-ipcountry'])   // header if Cloudflare ever fronts us again, else offline IP lookup
      await dbRun(
        `INSERT INTO visits (ip, session, source, medium, ref_host, campaign, landing, locale, device, country, origin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'beacon')`,
        [ip, session || null, source, medium, refHost || null, (url.searchParams.get('utm_campaign') || '').toLowerCase().slice(0, 80) || null,
          path, LOCALES.has(first) ? first : 'en', deviceOf(ua), country]
      )
    } catch (e) { console.warn('[visits] beacon failed:', e.message) }
  })
}

// ── Admin API ────────────────────────────────────────────────────────────────
function registerSourceRoutes(app, adminAuth) {
  const rangeMs = { '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY, '90d': 90 * DAY }
  // a visit "converted" if the same IP completed a conversion within 24 h after landing
  const CONVERTED = `EXISTS (SELECT 1 FROM activity_logs a WHERE a.ip_address = v.ip AND a.type = 'conversion' AND a.status = 'success'
    AND a.created_at >= v.created_at AND a.created_at < datetime(v.created_at, '+1 day'))`

  app.get('/api/admin/dash/sources', adminAuth, async (req, res) => {
    try {
      await ensureTable()
      const range = rangeMs[req.query.range] ? req.query.range : '7d'
      const from = sqlTs(Date.now() - rangeMs[range])
      const W = `FROM visits v WHERE v.created_at >= ?`
      const [tot, sources, mediums, refs, landing, campaigns, countries, devices, recent, meta, trendRows] = await Promise.all([
        dbGet(`SELECT COUNT(*) AS visits, COUNT(DISTINCT ip) AS visitors, SUM(${CONVERTED}) AS converted ${W}`, [from]),
        dbAll(`SELECT source, medium, COUNT(*) AS visits, COUNT(DISTINCT ip) AS visitors, SUM(${CONVERTED}) AS converted ${W} GROUP BY source, medium ORDER BY visitors DESC LIMIT 40`, [from]),
        dbAll(`SELECT medium, COUNT(*) AS visits, COUNT(DISTINCT ip) AS visitors, SUM(${CONVERTED}) AS converted ${W} GROUP BY medium ORDER BY visitors DESC`, [from]),
        dbAll(`SELECT ref_host AS host, COUNT(DISTINCT ip) AS visitors ${W} AND ref_host IS NOT NULL AND ref_host != '' GROUP BY ref_host ORDER BY visitors DESC LIMIT 15`, [from]),
        dbAll(`SELECT landing AS path, COUNT(DISTINCT ip) AS visitors,
                 (SELECT source FROM visits x WHERE x.landing = v.landing AND x.created_at >= ? GROUP BY source ORDER BY COUNT(*) DESC LIMIT 1) AS topSource
               ${W} AND landing IS NOT NULL GROUP BY landing ORDER BY visitors DESC LIMIT 12`, [from, from]),
        dbAll(`SELECT campaign, source, medium, COUNT(DISTINCT ip) AS visitors ${W} AND campaign IS NOT NULL AND campaign != '' GROUP BY campaign, source, medium ORDER BY visitors DESC LIMIT 12`, [from]),
        dbAll(`SELECT country, COUNT(DISTINCT ip) AS visitors ${W} AND country IS NOT NULL GROUP BY country ORDER BY visitors DESC LIMIT 10`, [from]),
        dbAll(`SELECT device, COUNT(DISTINCT ip) AS visitors ${W} AND device IS NOT NULL GROUP BY device ORDER BY visitors DESC`, [from]),
        dbAll(`SELECT created_at, source, medium, ref_host, landing, country, device, origin FROM visits ORDER BY id DESC LIMIT 25`),
        dbGet(`SELECT MIN(created_at) AS since, SUM(CASE WHEN origin = 'beacon' THEN 1 ELSE 0 END) AS beacon, SUM(CASE WHEN origin = 'nginx' THEN 1 ELSE 0 END) AS nginx FROM visits`),
        dbAll(`SELECT date(created_at, '+${IST_MIN} minutes') AS d, medium, COUNT(DISTINCT ip) AS visitors ${W} GROUP BY d, medium ORDER BY d`, [from]),
      ])
      const rate = (c, v) => (v ? num(c) / v : 0)
      // daily trend by medium, filled for every day in range (IST)
      const days = range === '24h' ? 2 : range === '7d' ? 7 : range === '30d' ? 30 : 90
      const trend = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() + IST_MIN * MIN - i * DAY).toISOString().slice(0, 10)
        const row = { t: d }
        for (const r of trendRows) if (r.d === d) row[r.medium] = (row[r.medium] || 0) + num(r.visitors)
        trend.push(row)
      }
      res.json({
        range, since: meta?.since || null, beaconVisits: num(meta?.beacon), backfilledVisits: num(meta?.nginx),
        totals: { visits: num(tot?.visits), visitors: num(tot?.visitors), converted: num(tot?.converted), rate: rate(tot?.converted, num(tot?.visits)) },
        sources: sources.map((r) => ({ ...r, visits: num(r.visits), visitors: num(r.visitors), converted: num(r.converted), rate: rate(r.converted, num(r.visits)) })),
        mediums: mediums.map((r) => ({ ...r, visits: num(r.visits), visitors: num(r.visitors), converted: num(r.converted), rate: rate(r.converted, num(r.visits)) })),
        referrers: refs, landing, campaigns, countries, devices, recent, trend,
      })
    } catch (e) { console.error('sources route:', e); res.status(500).json({ error: 'Failed to load traffic sources' }) }
  })
}

// Adds .source / .source_medium / .source_landing to activity_logs rows: the most recent visit from the same
// IP at or before the event (within 7 days). Used by the admin Recent Activity table.
async function attachSources(logs) {
  if (!Array.isArray(logs) || !logs.length) return logs
  await ensureTable()
  const cache = new Map()
  for (const l of logs) {
    if (!l.ip_address || !l.created_at) continue
    const key = l.ip_address + '|' + String(l.created_at).slice(0, 13)
    if (!cache.has(key)) {
      cache.set(key, await dbGet(
        `SELECT source, medium, landing FROM visits WHERE ip = ? AND created_at <= ? AND created_at >= datetime(?, '-7 days') ORDER BY created_at DESC LIMIT 1`,
        [l.ip_address, l.created_at, l.created_at]).catch(() => null))
    }
    const v = cache.get(key)
    if (v) { l.source = v.source; l.source_medium = v.medium; l.source_landing = v.landing }
  }
  return logs
}

module.exports = { registerVisitBeacon, registerSourceRoutes, ensureTable, attachSources }
