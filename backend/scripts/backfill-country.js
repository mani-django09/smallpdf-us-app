// One-off: fill in the country for rows that have none (visits, ip_analytics, activity_logs),
// using the same offline lookup as new rows (../geo.js). Safe to re-run: only touches empty countries.
//   cd backend && node scripts/backfill-country.js
const { dbAll, dbRun } = require('../database')
const { countryOf } = require('../geo')

const TABLES = [
  ['visits', 'ip'],
  ['ip_analytics', 'ip_address'],
  ['activity_logs', 'ip_address'],
]

;(async () => {
  for (const [table, col] of TABLES) {
    const rows = await dbAll(`SELECT DISTINCT ${col} AS ip FROM ${table} WHERE (country IS NULL OR country = '') AND ${col} IS NOT NULL AND ${col} != ''`)
    let updated = 0, unknown = 0
    for (const { ip } of rows) {
      const c = countryOf(ip)
      if (!c) { unknown++; continue }
      await dbRun(`UPDATE ${table} SET country = ? WHERE ${col} = ? AND (country IS NULL OR country = '')`, [c, ip])
      updated++
    }
    console.log(`${table}: ${rows.length} distinct IPs without country → ${updated} filled, ${unknown} not in the database`)
  }
  process.exit(0)
})().catch((e) => { console.error('backfill failed:', e); process.exit(1) })
