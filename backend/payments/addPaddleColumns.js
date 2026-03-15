// payments/addPaddleColumns.js
// One-time DB migration — adds Paddle columns to users table.
// Run once: node payments/addPaddleColumns.js

const path    = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '..', 'database.sqlite')
const db      = new sqlite3.Database(DB_PATH)

console.log('🔧 Running Paddle DB migration...\n')

const columns = [
  `ALTER TABLE users ADD COLUMN paddle_subscription_id TEXT`,
  `ALTER TABLE users ADD COLUMN paddle_customer_id TEXT`,
]

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_users_paddle_sub ON users(paddle_subscription_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_paddle_cus ON users(paddle_customer_id)`,
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
      else console.log(`✅ Index created`)
    })
  }
})

db.close(() => console.log('\n🎉 Paddle migration complete!'))
