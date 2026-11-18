// Compare a locale's message files against English: same keys, same arrays
// lengths, same {placeholders}, no leftover English-only HTML/tags removed.
// Usage: node scripts/check-locale.js vi [file.json ...]
const fs = require('fs')
const path = require('path')

const locale = process.argv[2]
if (!locale) { console.error('usage: node scripts/check-locale.js <locale> [files...]'); process.exit(2) }
const dir = path.join(__dirname, '..', 'messages')
const only = process.argv.slice(3)
const files = (only.length ? only : fs.readdirSync(path.join(dir, 'en')).filter((f) => f.endsWith('.json')))

// {plural} is an English/Romance "s" suffix; languages without plural marking
// (id, ja, vi) correctly drop it, so it is ignored in the comparison.
const ph = (s) => (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).filter((x) => x !== '{plural}').sort().join(',')
const tags = (s) => (s.match(/<\/?[a-zA-Z][^>]*>/g) || []).map((t) => t.replace(/\s.*>/, '>')).sort().join(',')

let problems = 0, missingFiles = 0, ok = 0
function walk(en, loc, p, out) {
  if (typeof en === 'string') {
    if (typeof loc !== 'string') return out.push(`${p}: expected string`)
    if (ph(en) !== ph(loc)) out.push(`${p}: placeholders differ  en=[${ph(en)}] ${locale}=[${ph(loc)}]`)
    if (tags(en) !== tags(loc)) out.push(`${p}: html tags differ  en=[${tags(en)}] ${locale}=[${tags(loc)}]`)
    if (loc.trim() === '' && en.trim() !== '') out.push(`${p}: empty`)
  } else if (Array.isArray(en)) {
    if (!Array.isArray(loc)) return out.push(`${p}: expected array`)
    if (en.length !== loc.length) out.push(`${p}: array length en=${en.length} ${locale}=${loc.length}`)
    en.forEach((v, i) => loc[i] !== undefined && walk(v, loc[i], `${p}[${i}]`, out))
  } else if (en && typeof en === 'object') {
    if (!loc || typeof loc !== 'object') return out.push(`${p}: expected object`)
    for (const k of Object.keys(en)) {
      if (!(k in loc)) out.push(`${p}.${k}: missing`)
      else walk(en[k], loc[k], `${p}.${k}`, out)
    }
    for (const k of Object.keys(loc)) if (!(k in en)) out.push(`${p}.${k}: extra key (not in en)`)
  }
}

for (const f of files) {
  const lp = path.join(dir, locale, f)
  if (!fs.existsSync(lp)) { missingFiles++; console.log(`MISSING  ${f}`); continue }
  let loc, en
  try { loc = JSON.parse(fs.readFileSync(lp, 'utf8')) } catch (e) { problems++; console.log(`BAD JSON ${f}: ${e.message}`); continue }
  en = JSON.parse(fs.readFileSync(path.join(dir, 'en', f), 'utf8'))
  const out = []
  walk(en, loc, '', out)
  if (out.length) { problems += out.length; console.log(`PROBLEMS ${f} (${out.length})`); out.slice(0, 12).forEach((l) => console.log('   ' + l)) }
  else { ok++; console.log(`ok       ${f}`) }
}
console.log(`\n${ok} ok, ${missingFiles} missing, ${problems} problem(s)`)
process.exit(problems ? 1 : 0)
