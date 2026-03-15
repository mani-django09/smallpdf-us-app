// payments/addRazorpayColumns.js
// One-time DB migration — adds razorpay_subscription_id column to users table.
// Run once: node payments/addRazorpayColumns.js

const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '..', 'database.sqlite')
const db      = new sqlite3.Database(DB_PATH)

console.log('🔧 Running Razorpay DB migration...\n')

const columns = [
  `ALTER TABLE users ADD COLUMN razorpay_subscription_id TEXT`,
  // Keep plan_expires_at if not already added by addStripeColumns.js
  `ALTER TABLE users ADD COLUMN plan_expires_at TEXT`,
]

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_users_rzp_sub ON users(razorpay_subscription_id)`,
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
    db.run(sql, (err) => {
      if (err) console.error('Index error:', err.message)
      else console.log('✅ Index created: idx_users_rzp_sub')
    })
  }
})

db.close(() => console.log('\n🎉 Razorpay migration complete!'))
