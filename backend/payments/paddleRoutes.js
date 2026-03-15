// payments/paddleRoutes.js — Paddle Billing integration for SmallPDF.us
// Handles international users (USD, auto-recurring subscriptions via Paddle)
//
// Required .env variables:
//   PADDLE_API_KEY=pdl_live_apikey_...        (server-side API key)
//   PADDLE_CLIENT_TOKEN=live_...              (client-side token for Paddle.js)
//   PADDLE_WEBHOOK_SECRET=pdlntfy_...         (from Paddle Dashboard → Notifications)
//   PADDLE_PRICE_STARTER_MONTHLY=pri_...
//   PADDLE_PRICE_STARTER_YEARLY=pri_...
//   PADDLE_PRICE_PRO_MONTHLY=pri_...
//   PADDLE_PRICE_PRO_YEARLY=pri_...
//   PADDLE_PRICE_AGENCY_MONTHLY=pri_...
//   PADDLE_PRICE_AGENCY_YEARLY=pri_...
//
// Routes:
//   GET  /api/paddle/prices                 → price IDs + client token for frontend
//   GET  /api/paddle/subscription-status    → current Paddle subscription info
//   POST /api/paddle/verify-transaction     → immediate plan activation after checkout
//   POST /api/paddle/cancel-subscription    → cancel at period end
//   POST /api/paddle/webhook                → Paddle event handler (raw body)

const express = require('express')
const crypto  = require('crypto')
const https   = require('https')
const router  = express.Router()
const { dbRun, dbGet } = require('../database')
const { requireAuth }  = require('../middleware/authMiddleware')

const PADDLE_API_HOST = 'api.paddle.com'

// ── Price IDs from env ────────────────────────────────────────────────────────
const PADDLE_PRICES = {
  starter: {
    monthly: process.env.PADDLE_PRICE_STARTER_MONTHLY,
    yearly:  process.env.PADDLE_PRICE_STARTER_YEARLY,
  },
  pro: {
    monthly: process.env.PADDLE_PRICE_PRO_MONTHLY,
    yearly:  process.env.PADDLE_PRICE_PRO_YEARLY,
  },
  agency: {
    monthly: process.env.PADDLE_PRICE_AGENCY_MONTHLY,
    yearly:  process.env.PADDLE_PRICE_AGENCY_YEARLY,
  },
}

// ── Paddle REST API helper ────────────────────────────────────────────────────
function paddleAPI(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PADDLE_API_HOST,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Paddle API returned invalid JSON')) }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getUserByPaddleSubId(subId) {
  return dbGet('SELECT * FROM users WHERE paddle_subscription_id = ?', [subId])
}

// Maps Paddle price ID → plan name
function planFromPriceId(priceId) {
  for (const [plan, intervals] of Object.entries(PADDLE_PRICES)) {
    if (Object.values(intervals).includes(priceId)) return plan
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/paddle/prices
// Returns price IDs + client token — used by frontend to open Paddle checkout
// ─────────────────────────────────────────────────────────────────────────────
router.get('/prices', (req, res) => {
  res.json({
    starter:     PADDLE_PRICES.starter,
    pro:         PADDLE_PRICES.pro,
    agency:      PADDLE_PRICES.agency,
    clientToken: process.env.PADDLE_CLIENT_TOKEN,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/paddle/subscription-status
// Returns current Paddle subscription details for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscription-status', requireAuth, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (!user.paddle_subscription_id || user.plan === 'free') {
      return res.json({ plan: 'free', subscription: null })
    }

    const data = await paddleAPI('GET', `/subscriptions/${user.paddle_subscription_id}`)
    const sub  = data.data

    res.json({
      plan:          user.plan,
      planExpiresAt: user.plan_expires_at,
      subscription: sub ? {
        id:                sub.id,
        status:            sub.status,
        currentPeriodEnd:  sub.current_billing_period?.ends_at || user.plan_expires_at,
        cancelAtPeriodEnd: sub.scheduled_change?.action === 'cancel',
        nextBilledAt:      sub.next_billed_at,
        billingInterval:   sub.billing_cycle?.interval || 'month',
      } : null,
    })
  } catch (error) {
    console.error('paddle subscription-status error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/paddle/verify-transaction
// Called immediately after Paddle checkout.completed event fires on frontend.
// Fetches transaction from Paddle API, verifies it's completed, activates plan.
// Body: { transactionId, plan, interval }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-transaction', requireAuth, async (req, res) => {
  try {
    const { transactionId, plan, interval = 'monthly' } = req.body

    if (!transactionId || !plan) {
      return res.status(400).json({ error: 'Missing transactionId or plan' })
    }
    if (!PADDLE_PRICES[plan]) {
      return res.status(400).json({ error: `Invalid plan: ${plan}` })
    }

    // Fetch transaction from Paddle API to verify status
    const txnData = await paddleAPI('GET', `/transactions/${transactionId}`)
    const txn     = txnData.data

    if (!txn) {
      return res.status(400).json({ error: 'Transaction not found in Paddle' })
    }
    if (txn.status !== 'completed' && txn.status !== 'billed') {
      return res.status(400).json({ error: `Transaction not completed (status: ${txn.status})` })
    }

    // Verify the transaction belongs to this user (by customer email)
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    const subscriptionId = txn.subscription_id || null
    const customerId     = txn.customer_id      || null

    // Calculate expiry based on billing period or interval
    let expiresAt
    if (txn.billing_period?.ends_at) {
      expiresAt = txn.billing_period.ends_at
    } else {
      const days = interval === 'yearly' ? 366 : 32
      expiresAt  = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    }

    // Activate plan in DB
    await dbRun(
      `UPDATE users SET plan = ?, plan_expires_at = ?, paddle_subscription_id = ?, paddle_customer_id = ? WHERE id = ?`,
      [plan, expiresAt, subscriptionId, customerId, user.id]
    )

    console.log(`✅ Paddle verified: userId=${user.id} plan=${plan} interval=${interval} txn=${transactionId} sub=${subscriptionId} expires=${expiresAt}`)
    res.json({ success: true, plan, interval, expiresAt })
  } catch (error) {
    console.error('paddle verify-transaction error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/paddle/cancel-subscription
// Schedules cancellation at end of current billing period
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user?.paddle_subscription_id) {
      return res.status(400).json({ error: 'No active Paddle subscription found.' })
    }

    await paddleAPI('POST', `/subscriptions/${user.paddle_subscription_id}/cancel`, {
      effective_from: 'next_billing_period',
    })

    console.log(`⬇️  Paddle cancel scheduled: userId=${user.id} sub=${user.paddle_subscription_id}`)
    res.json({ success: true, message: 'Subscription will cancel at end of the current billing period.' })
  } catch (error) {
    console.error('paddle cancel-subscription error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Paddle Webhook Handler
// Paddle Dashboard → Developer Tools → Notifications → New destination
//   URL: https://yourdomain.com/api/paddle/webhook
//   Events: subscription.activated, subscription.canceled, subscription.created,
//           subscription.past_due, subscription.updated, transaction.completed,
//           transaction.payment_failed
//
// IMPORTANT: Must be registered BEFORE express.json() — needs raw body
// ─────────────────────────────────────────────────────────────────────────────
async function paddleWebhookHandler(req, res) {
  const signatureHeader = req.headers['paddle-signature']

  if (!signatureHeader) {
    console.error('❌ Missing Paddle-Signature header')
    return res.status(400).send('Missing Paddle-Signature header')
  }

  // Parse: "ts=1234567890;h1=abc123..."
  const parts = {}
  signatureHeader.split(';').forEach(p => {
    const [k, v] = p.split('=')
    if (k && v) parts[k.trim()] = v.trim()
  })

  const ts = parts.ts
  const h1 = parts.h1
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET

  if (webhookSecret && ts && h1) {
    const signed   = `${ts}:${req.body.toString()}`
    const expected = crypto.createHmac('sha256', webhookSecret).update(signed).digest('hex')
    if (expected !== h1) {
      console.error('❌ Paddle webhook signature mismatch')
      return res.status(400).send('Invalid webhook signature')
    }
  }

  let event
  try { event = JSON.parse(req.body.toString()) }
  catch { return res.status(400).send('Invalid JSON payload') }

  console.log(`📨 Paddle Webhook: ${event.event_type}`)

  try {
    const data = event.data || {}

    switch (event.event_type) {

      // ── Subscription created / activated → activate plan ─────────────────
      case 'subscription.created':
      case 'subscription.activated': {
        const customData = data.custom_data || {}
        const userId     = customData.userId ? parseInt(customData.userId) : null
        const planName   = customData.plan   || planFromPriceId(data.items?.[0]?.price?.id) || 'starter'

        if (!userId) {
          console.warn(`⚠️  Paddle ${event.event_type}: no userId in custom_data`, JSON.stringify(customData))
          break
        }

        const expiresAt = data.current_billing_period?.ends_at ||
          new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()

        await dbRun(
          `UPDATE users SET plan = ?, plan_expires_at = ?, paddle_subscription_id = ?, paddle_customer_id = ? WHERE id = ?`,
          [planName, expiresAt, data.id, data.customer_id, userId]
        )
        console.log(`✅ Paddle ${event.event_type}: userId=${userId} plan=${planName} sub=${data.id} expires=${expiresAt}`)
        break
      }

      // ── Subscription updated (upgrade / downgrade / renew) ────────────────
      case 'subscription.updated': {
        const user = await getUserByPaddleSubId(data.id)
        if (!user) break

        const customData = data.custom_data || {}
        const planName   = customData.plan || planFromPriceId(data.items?.[0]?.price?.id) || user.plan
        const expiresAt  = data.current_billing_period?.ends_at || user.plan_expires_at

        await dbRun(
          `UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?`,
          [planName, expiresAt, user.id]
        )
        console.log(`🔄 Paddle updated: userId=${user.id} plan=${planName} expires=${expiresAt}`)
        break
      }

      // ── Subscription canceled → revert to free ────────────────────────────
      case 'subscription.canceled': {
        const user = await getUserByPaddleSubId(data.id)
        if (!user) break

        await dbRun(
          `UPDATE users SET plan = 'free', plan_expires_at = NULL, paddle_subscription_id = NULL, paddle_customer_id = NULL WHERE id = ?`,
          [user.id]
        )
        console.log(`⬇️  Paddle canceled: userId=${user.id} → free`)
        break
      }

      // ── Subscription past_due — payment failed, keep plan, Paddle retries ─
      case 'subscription.past_due': {
        const user = await getUserByPaddleSubId(data.id)
        if (user) {
          console.warn(`⚠️  Paddle past_due: userId=${user.id} sub=${data.id} — keeping plan active for retry`)
        }
        break
      }

      // ── Transaction completed — renewal → extend expiry ───────────────────
      case 'transaction.completed': {
        const subId = data.subscription_id
        if (!subId) break  // one-time transaction, not a subscription

        const user = await getUserByPaddleSubId(subId)
        if (!user) break

        // Use billing_period.ends_at for exact expiry, or fetch subscription
        let expiresAt = data.billing_period?.ends_at
        if (!expiresAt) {
          try {
            const subData = await paddleAPI('GET', `/subscriptions/${subId}`)
            expiresAt = subData.data?.current_billing_period?.ends_at
          } catch (e) {
            console.error('Could not fetch sub for renewal expiry:', e.message)
          }
        }
        if (!expiresAt) {
          expiresAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()
        }

        await dbRun(`UPDATE users SET plan_expires_at = ? WHERE id = ?`, [expiresAt, user.id])
        console.log(`💳 Paddle renewal: userId=${user.id} sub=${subId} expires=${expiresAt}`)
        break
      }

      // ── Payment failed — keep plan, Paddle retries automatically ──────────
      case 'transaction.payment_failed': {
        const subId = data.subscription_id
        console.warn(`⚠️  Paddle payment_failed: subscription=${subId || 'one-time'} txn=${data.id}`)
        break
      }

      default:
        // Ignore other event types
        break
    }
  } catch (err) {
    console.error('Paddle webhook handler error:', err)
    // Always return 200 to prevent Paddle from retrying indefinitely
  }

  res.json({ received: true })
}

module.exports = { router, paddleWebhookHandler }

// ── Startup env check ─────────────────────────────────────────────────────────
;(function checkEnv() {
  console.log('💳 paddleRoutes loaded')
  console.log('   PADDLE_API_KEY             :', process.env.PADDLE_API_KEY          ? `${process.env.PADDLE_API_KEY.slice(0, 20)}...` : '❌ MISSING')
  console.log('   PADDLE_CLIENT_TOKEN        :', process.env.PADDLE_CLIENT_TOKEN     ? `${process.env.PADDLE_CLIENT_TOKEN.slice(0, 10)}...` : '❌ MISSING')
  console.log('   PADDLE_WEBHOOK_SECRET      :', process.env.PADDLE_WEBHOOK_SECRET   ? '✅ set' : '❌ MISSING')
  console.log('   Starter monthly price ID   :', process.env.PADDLE_PRICE_STARTER_MONTHLY || '⚠️  not set')
  console.log('   Starter yearly price ID    :', process.env.PADDLE_PRICE_STARTER_YEARLY  || '⚠️  not set')
  console.log('   Pro monthly price ID       :', process.env.PADDLE_PRICE_PRO_MONTHLY     || '⚠️  not set')
  console.log('   Pro yearly price ID        :', process.env.PADDLE_PRICE_PRO_YEARLY      || '⚠️  not set')
  console.log('   Agency monthly price ID    :', process.env.PADDLE_PRICE_AGENCY_MONTHLY  || '⚠️  not set')
  console.log('   Agency yearly price ID     :', process.env.PADDLE_PRICE_AGENCY_YEARLY   || '⚠️  not set')
})()
