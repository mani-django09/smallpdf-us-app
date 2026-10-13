// Append-only record of real payment events (activation, renewal, failure).
//
// Until now nothing recorded money: a payment only flipped users.plan, so the
// admin panel had no revenue history at all. Every call site wraps this in
// try/catch — logging must never break a payment or a webhook.
const { dbRun } = require('../database')

let ready = null
function ensureTable() {
  if (!ready) {
    ready = dbRun(`CREATE TABLE IF NOT EXISTS payment_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      gateway     TEXT NOT NULL,          -- razorpay | razorpay_intl | paypal | lemonsqueezy
      event       TEXT NOT NULL,          -- activated | renewed | failed
      plan        TEXT,
      interval    TEXT,                   -- monthly | yearly
      amount      INTEGER,                -- smallest currency unit (paise / cents)
      currency    TEXT,                   -- INR | USD
      ref         TEXT,                   -- payment/subscription/order id
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).then(() => dbRun('CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events(created_at)'))
      .catch((e) => { ready = null; throw e })
  }
  return ready
}

// Fire-and-forget: returns a promise that never rejects.
function recordPayment(ev) {
  return ensureTable()
    .then(() => dbRun(
      `INSERT INTO payment_events (user_id, gateway, event, plan, interval, amount, currency, ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ev.userId ?? null, ev.gateway, ev.event, ev.plan ?? null, ev.interval ?? null,
        Number.isFinite(ev.amount) ? Math.round(ev.amount) : null, ev.currency ?? null, ev.ref ?? null]
    ))
    .catch((e) => console.warn('[payment_events] not recorded:', e.message))
}

module.exports = { recordPayment, ensureTable }
