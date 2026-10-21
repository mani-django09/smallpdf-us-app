// IP → 2-letter country code, fully offline (the npm package "geoip-country" bundles the data,
// so no visitor IP is ever sent to a third-party service).
//
// Why this exists: country used to come only from Cloudflare's CF-IPCountry header. smallpdf.us is
// no longer proxied by Cloudflare (requests reach nginx directly), so that header never arrives and
// visits / ip_analytics / activity_logs had NO country at all. We still honour the header if it is
// ever present again, and otherwise look the IP up.
let lookup = null
try {
  lookup = require('geoip-country').lookup
} catch (e) {
  console.warn('[geo] geoip-country not installed — country will stay empty:', e.message)
}

function countryOf(ip, headerValue) {
  const h = String(headerValue || '').toUpperCase()
  if (/^[A-Z]{2}$/.test(h) && h !== 'XX' && h !== 'T1') return h
  if (!lookup || !ip) return null
  const clean = String(ip).replace(/^::ffff:/i, '').split('%')[0].trim()
  try {
    const r = lookup(clean)
    return r && /^[A-Z]{2}$/.test(r.country) ? r.country : null
  } catch {
    return null
  }
}

module.exports = { countryOf }
