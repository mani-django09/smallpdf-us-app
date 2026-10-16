#!/usr/bin/env node
// IndexNow submitter for smallpdf.us — tells Bing (and Yandex, Naver, Seznam, Yep)
// which pages are new or changed, so Bing-based search (ChatGPT search, Copilot,
// DuckDuckGo, Yahoo) learns about edits within minutes instead of days.
//
//   node scripts/indexnow.js            submit only pages whose content changed since last run
//   node scripts/indexnow.js --all      submit every URL in the sitemap
//   node scripts/indexnow.js --dry      show what would be sent, send nothing
//   node scripts/indexnow.js <url> ...  submit exactly these URLs
//
// How it knows what changed: it fetches every sitemap URL from the LOCAL nginx
// (no external traffic), normalises away the build id / hashed asset names, and
// compares an MD5 of the HTML with the one saved in data/indexnow-state.json.
// Google does not support IndexNow; its sitemap crawl is unaffected.
//
// The key file must be reachable at https://smallpdf.us/<KEY>.txt (it lives in
// frontend/public and nginx serves it; content = the key itself).

const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const HOST = 'smallpdf.us'
const KEY = '3bb8a857c8462df2ecaa154e2e5e6dce'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`
const STATE_FILE = path.join(__dirname, '..', 'data', 'indexnow-state.json')
const ENDPOINT = 'api.indexnow.org'
const BATCH = 500
const UA = 'Mozilla/5.0 (compatible; smallpdf-indexnow/1.0)'

const args = process.argv.slice(2)
const ALL = args.includes('--all')
const DRY = args.includes('--dry')
const explicit = args.filter((a) => /^https?:\/\//.test(a))

// GET a path from the local nginx (TLS with the real SNI, certificate not verified
// because we connect to 127.0.0.1).
function localGet(p) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: '127.0.0.1', port: 443, path: p, method: 'GET', servername: HOST, rejectUnauthorized: false,
        headers: { Host: HOST, 'User-Agent': UA, 'Accept-Encoding': 'identity' }, timeout: 30000 },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (d) => (body += d))
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

async function sitemapUrls(p = '/sitemap.xml', depth = 0) {
  const { status, body } = await localGet(p)
  if (status !== 200) throw new Error(`${p} -> HTTP ${status}`)
  const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])
  if (/<sitemapindex/i.test(body) && depth < 2) {
    const out = []
    for (const loc of locs) out.push(...(await sitemapUrls(new URL(loc).pathname, depth + 1)))
    return out
  }
  return locs
}

// Strip what changes on every deploy but is not page content.
function fingerprint(html) {
  const cleaned = html
    .replace(/"buildId":"[^"]*"/g, '')
    .replace(/\/_next\/static\/[^"'\s)<>]*/g, '')
    .replace(/<script[^>]*id="__NEXT_DATA__"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/\s+/g, ' ')
  return crypto.createHash('md5').update(cleaned).digest('hex')
}

// Blog pages show a live "views" counter that SSR increments on every fetch, so their
// HTML never looks "unchanged" and fetching them would inflate the counter. Their
// fingerprint comes from the database instead: slug + updated_at + title (published only).
function blogFingerprints() {
  return new Promise((resolve) => {
    const out = {}
    const md5 = (x) => crypto.createHash('md5').update(x).digest('hex')
    try {
      const sqlite3 = require('sqlite3')
      const db = new sqlite3.Database(path.join(__dirname, '..', 'database.sqlite'), sqlite3.OPEN_READONLY, (openErr) => {
        if (openErr) { console.warn(`  blog fingerprints unavailable (${openErr.message}); blog pages skipped this run`); return resolve(out) }
        db.all("SELECT slug, title, updated_at FROM blog_posts WHERE status = 'published' ORDER BY slug", (err, rows) => {
          db.close()
          if (err) { console.warn(`  blog fingerprints unavailable (${err.message}); blog pages skipped this run`); return resolve(out) }
          for (const r of rows) out[`https://${HOST}/blog/${r.slug}/`] = md5(`${r.slug}|${r.title}|${r.updated_at}`)
          out[`https://${HOST}/blog/`] = md5(rows.map((r) => `${r.slug}|${r.updated_at}`).join(';'))
          resolve(out)
        })
      })
    } catch (e) {
      console.warn(`  blog fingerprints unavailable (${e.message}); blog pages skipped this run`)
      resolve(out)
    }
  })
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch (_) { return {} }
}
function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state))
}

function submit(urlList) {
  const payload = JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList })
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: ENDPOINT, path: '/indexnow', method: 'POST', timeout: 30000,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let body = ''
        res.on('data', (d) => (body += d))
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k) }
  }))
  return out
}

;(async () => {
  const state = loadState()
  let urls, hashes = {}

  if (explicit.length) {
    urls = explicit
  } else {
    const all = [...new Set(await sitemapUrls())].filter((u) => u.startsWith(`https://${HOST}/`))
    console.log(`sitemap: ${all.length} URLs`)
    if (ALL) {
      urls = all
    } else {
      // Gentle on nginx (limit_req on this host): 2 at a time, ~15 requests/second at most,
      // and a retry when nginx answers 429/503. A URL that still fails is simply
      // skipped and picked up on the next run.
      let skipped = 0
      const blog = await blogFingerprints()
      const isBlog = (u) => new URL(u).pathname.startsWith('/blog')
      for (const u of all) if (isBlog(u) && blog[u]) hashes[u] = blog[u]
      await mapLimit(all.filter((u) => !isBlog(u)), 2, async (u) => {
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const r = await localGet(new URL(u).pathname)
            if (r.status === 200) { hashes[u] = fingerprint(r.body); break }
            if (r.status !== 429 && r.status !== 503) { skipped++; break }
          } catch (e) { if (attempt === 4) { skipped++; console.warn(`  fetch failed ${u}: ${e.message}`) } }
          await new Promise((res) => setTimeout(res, 400 * attempt))
        }
        await new Promise((res) => setTimeout(res, 120))
      })
      if (skipped || Object.keys(hashes).length < all.length) console.log(`  fingerprinted ${Object.keys(hashes).length}/${all.length} pages`)
      urls = all.filter((u) => hashes[u] && hashes[u] !== state[u])
    }
  }

  console.log(`to submit: ${urls.length}${ALL ? ' (--all)' : ''}`)
  if (!urls.length || DRY) { if (DRY) urls.slice(0, 15).forEach((u) => console.log('  ' + u)); return }

  let ok = 0
  for (let i = 0; i < urls.length; i += BATCH) {
    const chunk = urls.slice(i, i + BATCH)
    const r = await submit(chunk)
    // 200 = accepted, 202 = accepted (key validation pending). Anything else = problem.
    if (r.status === 200 || r.status === 202) {
      ok += chunk.length
      chunk.forEach((u) => { if (hashes[u]) state[u] = hashes[u] })
      console.log(`  batch ${i / BATCH + 1}: HTTP ${r.status} (${chunk.length} URLs)`)
    } else {
      console.error(`  batch ${i / BATCH + 1}: HTTP ${r.status} ${String(r.body).slice(0, 200)}`)
      break
    }
  }
  if (ALL) {
    for (const u of urls) {
      try { const r = await localGet(new URL(u).pathname); if (r.status === 200) state[u] = fingerprint(r.body) } catch (_) {}
      await new Promise((res) => setTimeout(res, 120))
    }
  }
  saveState(state)
  console.log(`done: ${ok}/${urls.length} submitted`)
  if (ok !== urls.length) process.exitCode = 1
})().catch((e) => { console.error('indexnow failed:', e.message); process.exit(1) })
