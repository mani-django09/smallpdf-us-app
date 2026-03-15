// auth/addUsersTables.js
// Run ONCE to add users table to your existing database.sqlite
// Usage: node auth/addUsersTables.js

const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '..', 'database.sqlite')
const db = new sqlite3.Database(DB_PATH)

console.log('🔧 Running users table migration...')

db.serialize(() => {
  // ── Users table ──────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      name                  TEXT NOT NULL,
      email                 TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash         TEXT NOT NULL,
      avatar                TEXT,

      -- Plan (free / pro / enterprise)
      plan                  TEXT NOT NULL DEFAULT 'free',
      plan_expires_at       DATETIME,

      -- Email verification
      email_verified        INTEGER NOT NULL DEFAULT 0,
      email_verify_token    TEXT,
      email_verify_expires  DATETIME,

      -- Password reset
      reset_token           TEXT,
      reset_token_expires   DATETIME,

      -- Admin controls
      is_banned             INTEGER NOT NULL DEFAULT 0,
      ban_reason            TEXT,

      -- Timestamps
      created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at         DATETIME,

      -- Google OAuth
      google_id             TEXT
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating users table:', err.message)
    } else {
      console.log('✅ users table ready')
    }
  })

  // ── Indexes ───────────────────────────────────────────────────────────────
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`, (err) => {
    if (!err) console.log('✅ email index ready')
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)`, (err) => {
    if (!err) console.log('✅ reset_token index ready')
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(email_verify_token)`, (err) => {
    if (!err) console.log('✅ verify_token index ready')
  })
})

db.close((err) => {
  if (err) console.error('Error closing DB:', err.message)
  else console.log('\n🎉 Migration complete! Users table is ready.')
})