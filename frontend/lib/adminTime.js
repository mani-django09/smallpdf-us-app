// Admin panel time helpers — everything is shown in Indian Standard Time (IST).
//
// The database stores UTC as "YYYY-MM-DD HH:MM:SS" with NO timezone marker.
// `new Date("2026-09-29 16:51:26")` parses that as the BROWSER's local time, so
// the panel showed times 5 h 30 min behind IST (16:51 instead of 22:21). Bare
// timestamps are UTC → mark them as such before parsing. Values that already
// carry a zone ("…Z", "+05:30") are left alone.
const IST = 'Asia/Kolkata'

export function parseDbDate(value) {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') return new Date(value)
  let s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s = s.replace(' ', 'T') + 'Z'
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00Z'
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// "29 Sep 2026, 10:21:26 pm"
export function formatIST(value, { seconds = true } = {}) {
  const d = parseDbDate(value)
  if (!d) return value ? 'Invalid date' : 'N/A'
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}),
    hour12: true, timeZone: IST,
  })
}

// "29 Sep 2026"
export function formatISTDate(value) {
  const d = parseDbDate(value)
  if (!d) return value ? 'Invalid date' : 'N/A'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST })
}

// "just now", "5 min ago", "3 h ago", "2 d ago", else the IST date
export function timeAgo(value, now = Date.now()) {
  const d = parseDbDate(value)
  if (!d) return value ? 'Invalid date' : 'N/A'
  const sec = Math.round((now - d.getTime()) / 1000)
  if (sec < -60) return formatISTDate(d) // in the future (e.g. plan expiry)
  if (sec < 45) return 'just now'
  if (sec < 90) return '1 min ago'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days} d ago`
  return formatISTDate(d)
}

// Live clock text for the header: "Tue, 29 Sep · 10:21:26 pm IST"
export function nowIST(now = Date.now()) {
  const d = new Date(now)
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST })
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: IST })
  return `${date} · ${time} IST`
}
