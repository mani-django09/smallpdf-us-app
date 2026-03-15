// auth/addGoogleId.js
// Run ONCE to add google_id column to existing users table
// Usage: node auth/addGoogleId.js

const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, '..', 'database.sqlite')
const db = new sqlite3.Database(DB_PATH)

console.log('🔧 Adding google_id column to users table...')

db.serialize(() => {
  // Add google_id column — IF NOT EXISTS trick via try/catch
  db.run(`ALTER TABLE users ADD COLUMN google_id TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✅ google_id column already exists, skipping.')
      } else {
        console.error('❌ Error:', err.message)
      }
    } else {
      console.log('✅ google_id column added successfully.')
    }
  })

  db.run(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`, (err) => {
    if (!err) console.log('✅ google_id index ready')
  })
})

db.close(() => {
  console.log('\n🎉 Done! You can now use Google sign-in.')
})