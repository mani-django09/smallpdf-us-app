// One-off: rebuild past traffic-source history from the nginx access logs (the live beacon only
// knows visits from the moment it was deployed).
//   cd /var/www/smallpdf.us/backend && node scripts/backfill-visits.js [--until "YYYY-MM-DD HH:MM:SS"] [--dry]
// A "visit" = first page load by an IP after ≥30 min of silence; its referrer/UTM decide the source.
// Idempotent: replaces all origin='nginx' rows. Approximate by design — pages served from Cloudflare's
// edge cache never reach nginx, so counts can be lower than the real total; the mix is still representative.
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
process.chdir(path.join(__dirname, '..'))
const { dbRun } = require('../database')
const { ensureTable } = require('../admin/visitTracking')
const { classify, BOT_UA } = require('../admin/trafficSource')

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const untilArg = argv[argv.indexOf('--until') + 1]
const UNTIL = untilArg && !untilArg.startsWith('--') ? untilArg : new Date().toISOString().slice(0, 19).replace('T', ' ')
const GAP = 30 * 60 * 1000
const LOG_DIR = '/var/log/nginx'
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
const LINE = /^(\S+) \S+ \S+ \[(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+) ([+-]\d{4})\] "(\w+) (\S+) [^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)"/
const LOCALES = new Set(['en', 'de', 'es', 'fr', 'id', 'it', 'ja', 'pt'])
const deviceOf = (ua) => (/iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop')

function* lines() {
  const files = fs.readdirSync(LOG_DIR).filter((f) => /^smallpdf\.us-access\.log(\.\d+(\.gz)?)?$/.test(f))
  for (const f of files) {
    const buf = fs.readFileSync(path.join(LOG_DIR, f))
    const text = (f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8')
    for (const l of text.split('\n')) if (l) yield l
  }
}

;(async () => {
  const hits = []     // { ip, t, path, search, ref, ua }
  for (const l of lines()) {
    const m = LINE.exec(l); if (!m) continue
    const [, ip, d, mon, y, hh, mm, ss, , method, url, status, ref, ua] = m
    if (method !== 'GET' || (status !== '200' && status !== '304')) continue
    const q = url.indexOf('?'); const p = q === -1 ? url : url.slice(0, q)
    if (/^\/(_next|api|uploads|converted|download|admin|favicon|images|static|assets)/.test(p) || /\.[a-zA-Z0-9]{1,5}$/.test(p)) continue
    if (!ua || ua === '-' || BOT_UA.test(ua)) continue
    const t = Date.UTC(+y, MONTHS[mon], +d, +hh, +mm, +ss)
    hits.push({ ip, t, path: p.slice(0, 200), search: q === -1 ? '' : url.slice(q), ref: ref === '-' ? '' : ref, ua })
  }
  hits.sort((a, b) => a.t - b.t)
  const last = new Map(), visits = []
  for (const h of hits) {
    const prev = last.get(h.ip); last.set(h.ip, h.t)
    if (prev !== undefined && h.t - prev < GAP) continue
    const sp = new URLSearchParams(h.search)
    const c = classify(h.ref, { source: sp.get('utm_source'), medium: sp.get('utm_medium') })
    const first = h.path.split('/')[1]
    visits.push({
      at: new Date(h.t).toISOString().slice(0, 19).replace('T', ' '), ip: h.ip, ...c,
      campaign: (sp.get('utm_campaign') || '').toLowerCase().slice(0, 80) || null, landing: h.path,
      locale: LOCALES.has(first) ? first : 'en', device: deviceOf(h.ua),
    })
  }
  const use = visits.filter((v) => v.at < UNTIL)
  const tally = {}
  for (const v of use) tally[`${v.source}/${v.medium}`] = (tally[`${v.source}/${v.medium}`] || 0) + 1
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12)
  console.log(`parsed ${hits.length} page loads → ${visits.length} visits, ${use.length} before ${UNTIL}`)
  console.log('range:', use[0]?.at, '→', use[use.length - 1]?.at)
  console.log('top sources:', top.map(([k, n]) => `${k}=${n}`).join('  '))
  if (DRY) return process.exit(0)

  await ensureTable()
  await dbRun(`DELETE FROM visits WHERE origin = 'nginx'`)
  await dbRun('BEGIN')
  for (const v of use) {
    await dbRun(
      `INSERT INTO visits (created_at, ip, session, source, medium, ref_host, campaign, landing, locale, device, country, origin)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, 'nginx')`,
      [v.at, v.ip, v.source, v.medium, v.refHost || null, v.campaign, v.landing, v.locale, v.device]
    )
  }
  await dbRun('COMMIT')
  console.log('inserted', use.length, 'visits')
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
