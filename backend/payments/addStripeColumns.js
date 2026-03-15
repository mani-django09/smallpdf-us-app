// payments/addStripeColumns.js
// One-time migration — adds Stripe columns to your users table.
// Run once: node payments/addStripeColumns.js

const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '..', 'database.sqlite')
const db      = new sqlite3.Database(DB_PATH)

console.log('🔧 Running Stripe DB migration...\n')

const columns = [
  `ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`,
  `ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT`,
  `ALTER TABLE users ADD COLUMN plan_expires_at TEXT`,
]

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_stripe_sub ON users(stripe_subscription_id)`,
]

db.serialize(() => {
  for (const sql of columns) {
    const col = sql.match(/ADD COLUMN (\S+)/)[1]
    db.run(sql, (err) => {
      if (err?.message?.includes('duplicate column')) console.log(`ℹ️  ${col} already exists — skipped`)
      else if (err) console.error(`❌ Error adding ${col}:`, err.message)
      else console.log(`✅ Added column: ${col}`)
    })
  }
  for (const sql of indexes) {
    db.run(sql, (err) => { if (!err) console.log(`✅ Index created`) })
  }
})

db.close(() => console.log('\n🎉 Migration complete!'))