// payments/paymentRoutes.js — Razorpay integration for smallpdf.us
// Plans: Starter ($9/mo) · Pro ($19/mo) · Agency ($49/mo)
//
// Required .env variables:
//   RAZORPAY_KEY_ID=rzp_live_***REMOVED***
//   RAZORPAY_KEY_SECRET=***REMOVED-RAZORPAY-SECRET***
//   RAZORPAY_WEBHOOK_SECRET=<set in Razorpay Dashboard → Webhooks>
//   RAZORPAY_STARTER_PLAN_ID=plan_xxx   (create in Razorpay Dashboard)
//   RAZORPAY_PRO_PLAN_ID=plan_xxx
//   RAZORPAY_AGENCY_PLAN_ID=plan_xxx
//   FRONTEND_URL=https://smallpdf.us

const express = require('express')
const crypto  = require('crypto')
const router  = express.Router()
const { dbRun, dbGet } = require('../database')
const { requireAuth }  = require('../middleware/authMiddleware')
const {
  sendPlanActivatedEmail,
  sendPlanRenewedEmail,
  sendCancellationScheduledEmail,
  sendPlanExpiredEmail,
  sendPaymentFailedEmail,
} = require('./emailService')

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://smallpdf.us'

// ── Lazy-load Razorpay SDK ────────────────────────────────────────────────────
let _rzp = null
function getRazorpay() {
  if (!_rzp) {
    const Razorpay = require('razorpay')
    _rzp = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  }
  return _rzp
}

// ── International plan config (USD, one-time orders via PayPal) ───────────────
// Amount is in cents (smallest USD unit): $9 = 900
const INTL_PLANS = {
  starter: {
    label:   'Starter',
    monthly: { amount: 900,   description: 'Starter Monthly — $9/mo'    },
    yearly:  { amount: 9000,  description: 'Starter Annual — $90/yr'    },
  },
  pro: {
    label:   'Pro',
    monthly: { amount: 1900,  description: 'Pro Monthly — $19/mo'       },
    yearly:  { amount: 19000, description: 'Pro Annual — $190/yr'       },
  },
  agency: {
    label:   'Agency',
    monthly: { amount: 4900,  description: 'Agency Monthly — $49/mo'   },
    yearly:  { amount: 49000, description: 'Agency Annual — $490/yr'   },
  },
}

// ── Plan config — plan IDs must be created in Razorpay Dashboard first ────────
// Each plan has a monthly AND yearly variant (yearly = 1 billing cycle per year)
const PLANS = {
  starter: {
    label:   'Starter',
    monthly: { planId: process.env.RAZORPAY_STARTER_PLAN_ID         },
    yearly:  { planId: process.env.RAZORPAY_STARTER_YEARLY_PLAN_ID  },
  },
  pro: {
    label:   'Pro',
    monthly: { planId: process.env.RAZORPAY_PRO_PLAN_ID             },
    yearly:  { planId: process.env.RAZORPAY_PRO_YEARLY_PLAN_ID      },
  },
  agency: {
    label:   'Agency',
    monthly: { planId: process.env.RAZORPAY_AGENCY_PLAN_ID          },
    yearly:  { planId: process.env.RAZORPAY_AGENCY_YEARLY_PLAN_ID   },
  },
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function setUserPlan(userId, plan, expiresAt = null, subscriptionId = null) {
  await dbRun(
    `UPDATE users SET plan = ?, plan_expires_at = ?, razorpay_subscription_id = ? WHERE id = ?`,
    [plan, expiresAt, subscriptionId, userId]
  )
}

async function getUserBySubId(subId) {
  return dbGet('SELECT * FROM users WHERE razorpay_subscription_id = ?', [subId])
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-subscription
// Body: { plan: 'starter' | 'pro' | 'agency' }
// Returns: { key, subscriptionId, plan, label, prefill }
// Frontend opens Razorpay checkout modal with subscriptionId
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-subscription', requireAuth, async (req, res) => {
  try {
    const { plan, interval = 'monthly' } = req.body

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: `Invalid plan "${plan}". Valid: starter, pro, agency` })
    }
    if (!['monthly', 'yearly'].includes(interval)) {
      return res.status(400).json({ error: `Invalid interval "${interval}". Valid: monthly, yearly` })
    }

    const planCfg   = PLANS[plan]
    const planEntry = planCfg[interval]

    if (!planEntry?.planId) {
      const envKey = interval === 'yearly'
        ? `RAZORPAY_${plan.toUpperCase()}_YEARLY_PLAN_ID`
        : `RAZORPAY_${plan.toUpperCase()}_PLAN_ID`
      return res.status(500).json({
        error: `${envKey} not set in .env — create the ${interval} plan in Razorpay Dashboard first`,
      })
    }

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    const rzp = getRazorpay()

    // ── Cancel any stale/unpaid previous subscription ─────────────────────
    // Prevents ghost subscriptions in Razorpay when user re-opens checkout
    if (user.razorpay_subscription_id && user.plan === 'free') {
      try {
        const existing = await rzp.subscriptions.fetch(user.razorpay_subscription_id)
        // Only cancel if it's still in created/authenticated state (not yet charged)
        if (['created', 'authenticated'].includes(existing.status)) {
          await rzp.subscriptions.cancel(user.razorpay_subscription_id, { cancel_at_cycle_end: 0 })
          console.log(`🗑️  Cancelled stale subscription ${user.razorpay_subscription_id} for ${user.email}`)
        }
      } catch (e) {
        // Ignore — subscription may already be gone
      }
    }

    // total_count: yearly plans bill once per year; use 12 cycles (12 years)
    const totalCount = interval === 'yearly' ? 12 : 120

    const subscription = await rzp.subscriptions.create({
      plan_id:         planEntry.planId,
      customer_notify: 1,
      quantity:        1,
      total_count:     totalCount,
      notes: {
        userId:   String(user.id),
        plan,
        interval,
        email:    user.email,
        site:     'smallpdf.us',
      },
    })

    // Store pending subscription ID so webhook/verify can find the user
    await dbRun(
      'UPDATE users SET razorpay_subscription_id = ? WHERE id = ?',
      [subscription.id, user.id]
    )

    console.log(`🛒 Subscription created: user=${user.email} plan=${plan} interval=${interval} sub=${subscription.id}`)

    res.json({
      key:            process.env.RAZORPAY_KEY_ID,
      subscriptionId: subscription.id,
      plan,
      interval,
      label:          `${planCfg.label} (${interval === 'yearly' ? 'Annual' : 'Monthly'})`,
      prefill: {
        name:  user.name  || '',
        email: user.email || '',
      },
    })
  } catch (error) {
    console.error('create-subscription error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify-payment
// Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan }
// Called by frontend after Razorpay checkout modal success callback
// Verifies HMAC-SHA256 signature and activates the user's plan immediately
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-payment', requireAuth, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan } = req.body

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !plan) {
      return res.status(400).json({ error: 'Missing payment verification fields' })
    }

    // Razorpay signature for subscriptions:
    // HMAC_SHA256( payment_id + "|" + subscription_id , key_secret )
    const body     = `${razorpay_payment_id}|${razorpay_subscription_id}`
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expected !== razorpay_signature) {
      console.warn(`❌ Signature mismatch for user ${req.user.id}`)
      return res.status(400).json({ error: 'Payment signature verification failed. Please contact support.' })
    }

    // Activate plan — set expiry 32 days from now; webhook will keep it renewed
    const expiresAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()
    await setUserPlan(req.user.id, plan, expiresAt, razorpay_subscription_id)

    const activatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    const interval = req.body.interval || 'monthly'
    sendPlanActivatedEmail({ name: activatedUser?.name, email: activatedUser?.email, plan, interval, expiresAt, gateway: 'razorpay' })

    console.log(`✅ Plan activated: userId=${req.user.id} plan=${plan} sub=${razorpay_subscription_id} payment=${razorpay_payment_id}`)
    res.json({ success: true, plan })
  } catch (error) {
    console.error('verify-payment error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/subscription-status
// Returns current plan and subscription details from Razorpay
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscription-status', requireAuth, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (!user.razorpay_subscription_id || user.plan === 'free') {
      return res.json({ plan: 'free', subscription: null, invoices: [] })
    }

    const rzp = getRazorpay()
    let subscription = null
    let invoices     = []

    try {
      subscription = await rzp.subscriptions.fetch(user.razorpay_subscription_id)
    } catch (_) {
      // Subscription may have been deleted — return DB plan info
    }

    try {
      const payments = await rzp.subscriptions.fetchAllPayments(user.razorpay_subscription_id, { count: 5 })
      invoices = (payments.items || []).map(p => ({
        id:       p.id,
        date:     new Date(p.created_at * 1000).toISOString(),
        amount:   p.amount,
        currency: p.currency,
        status:   p.status === 'captured' ? 'paid' : p.status,
      }))
    } catch (_) { /* ignore */ }

    const isCancelled = subscription?.status === 'cancelled' || subscription?.status === 'completed'

    res.json({
      plan:          user.plan,
      planExpiresAt: user.plan_expires_at,
      subscription: subscription ? {
        id:                subscription.id,
        status:            subscription.status,
        interval:          subscription.notes?.interval || 'monthly',
        currentPeriodEnd:  subscription.current_end
          ? new Date(subscription.current_end * 1000).toISOString()
          : user.plan_expires_at,
        cancelAtPeriodEnd: isCancelled,
        chargeAt: subscription.charge_at
          ? new Date(subscription.charge_at * 1000).toISOString()
          : null,
      } : null,
      invoices,
    })
  } catch (error) {
    console.error('subscription-status error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/cancel-subscription
// Cancels at end of current billing cycle
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user?.razorpay_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found.' })
    }

    const rzp = getRazorpay()
    // cancel_at_cycle_end: 1 = cancel at the end of current billing cycle
    await rzp.subscriptions.cancel(user.razorpay_subscription_id, { cancel_at_cycle_end: 1 })

    sendCancellationScheduledEmail({ name: user.name, email: user.email, plan: user.plan, expiresAt: user.plan_expires_at })

    console.log(`⬇️  Cancellation requested: userId=${user.id} sub=${user.razorpay_subscription_id}`)
    res.json({ success: true, message: 'Subscription will cancel at end of current billing period.' })
  } catch (error) {
    console.error('cancel-subscription error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Webhook Handler
// Razorpay Dashboard → Settings → Webhooks
//   URL: https://smallpdf.us/api/payments/webhook
//   Events to enable:
//     subscription.activated
//     subscription.charged
//     subscription.cancelled
//     subscription.completed
//     payment.failed
// ─────────────────────────────────────────────────────────────────────────────
async function webhookHandler(req, res) {
  const signature    = req.headers['x-razorpay-signature']
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  // Verify webhook signature if secret is configured
  if (webhookSecret) {
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body) // req.body is raw Buffer here (express.raw middleware)
      .digest('hex')

    if (expected !== signature) {
      // Enhanced debug: log first 8 chars of each so we can tell if secret is totally
      // wrong vs. a body-encoding issue. REMOVE these lines once the secret is fixed.
      console.error('❌ Razorpay webhook signature mismatch')
      console.error('   received sig  :', signature?.slice(0, 8), '...')
      console.error('   computed sig   :', expected?.slice(0, 8), '...')
      console.error('   body type      :', Buffer.isBuffer(req.body) ? 'Buffer' : typeof req.body, '| len:', req.body?.length)
      console.error('   secret len     :', webhookSecret?.length)
      return res.status(400).send('Invalid webhook signature')
    }
  }

  let event
  try {
    event = JSON.parse(req.body.toString())
  } catch {
    return res.status(400).send('Invalid JSON payload')
  }

  console.log(`📨 Razorpay Webhook: ${event.event}`)

  try {
    switch (event.event) {

      // First successful payment — activate plan
      case 'subscription.activated': {
        const sub  = event.payload.subscription.entity
        const user = await getUserBySubId(sub.id)
        if (!user) { console.warn(`No user found for sub ${sub.id}`); break }

        const planName  = sub.notes?.plan || 'starter'
        const interval  = sub.notes?.interval || 'monthly'
        const expiresAt = sub.current_end
          ? new Date(sub.current_end * 1000).toISOString()
          : new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()

        await setUserPlan(user.id, planName, expiresAt, sub.id)
        sendPlanActivatedEmail({ name: user.name, email: user.email, plan: planName, interval, expiresAt, gateway: 'razorpay' })
        console.log(`✅ Activated: ${user.email} → ${planName} (expires ${expiresAt})`)
        break
      }

      // Recurring renewal payment — extend expiry
      case 'subscription.charged': {
        const sub  = event.payload.subscription.entity
        const user = await getUserBySubId(sub.id)
        if (!user) break

        const planName  = sub.notes?.plan || user.plan || 'starter'
        const expiresAt = sub.current_end
          ? new Date(sub.current_end * 1000).toISOString()
          : new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()

        await setUserPlan(user.id, planName, expiresAt, sub.id)
        sendPlanRenewedEmail({ name: user.name, email: user.email, plan: planName, expiresAt, gateway: 'razorpay' })
        console.log(`💳 Renewal: ${user.email} → ${planName} (expires ${expiresAt})`)
        break
      }

      // Subscription cancelled or completed — revert to free
      case 'subscription.cancelled':
      case 'subscription.completed': {
        const sub  = event.payload.subscription.entity
        const user = await getUserBySubId(sub.id)
        if (!user) break

        const prevPlan = user.plan
        await setUserPlan(user.id, 'free', null, null)
        sendPlanExpiredEmail({ name: user.name, email: user.email, plan: prevPlan })
        console.log(`⬇️  ${user.email} → free (${event.event})`)
        break
      }

      // Payment failed — keep current plan (Razorpay retries automatically)
      case 'payment.failed': {
        const payment = event.payload.payment?.entity
        const subId   = payment?.subscription_id
        if (subId) {
          const failedUser = await getUserBySubId(subId)
          if (failedUser) {
            sendPaymentFailedEmail({ name: failedUser.name, email: failedUser.email, plan: failedUser.plan, gateway: 'razorpay' })
          }
        }
        console.warn(`⚠️  Payment failed: ${payment?.id} — ${payment?.error_description || 'unknown error'}`)
        break
      }

      default: break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    // Always return 200 — prevents Razorpay from retrying
  }

  res.json({ received: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-intl-order
// For international users: creates a Razorpay Order in USD (PayPal-compatible)
// Body: { plan: 'starter'|'pro'|'agency', interval: 'monthly'|'yearly' }
// Returns: { key, orderId, amount, currency, plan, interval, label, prefill }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-intl-order', requireAuth, async (req, res) => {
  try {
    const { plan, interval = 'monthly' } = req.body

    if (!plan || !INTL_PLANS[plan]) {
      return res.status(400).json({ error: `Invalid plan "${plan}". Valid: starter, pro, agency` })
    }
    if (!['monthly', 'yearly'].includes(interval)) {
      return res.status(400).json({ error: `Invalid interval "${interval}". Valid: monthly, yearly` })
    }

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    const planCfg = INTL_PLANS[plan][interval]
    const rzp = getRazorpay()

    const order = await rzp.orders.create({
      amount:   planCfg.amount,   // cents for USD
      currency: 'USD',
      receipt:  `intl-${plan}-${interval}-${user.id}-${Date.now()}`.slice(0, 40),
      notes: {
        userId:   String(user.id),
        plan,
        interval,
        email:    user.email,
        site:     'smallpdf.us',
        type:     'international',
      },
    })

    console.log(`🌍 Intl order created: user=${user.email} plan=${plan} interval=${interval} order=${order.id}`)

    res.json({
      key:      process.env.RAZORPAY_KEY_ID,
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      plan,
      interval,
      label:    `${INTL_PLANS[plan].label} (${interval === 'yearly' ? 'Annual' : 'Monthly'})`,
      prefill:  { name: user.name || '', email: user.email || '' },
    })
  } catch (error) {
    console.error('create-intl-order error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify-intl-payment
// Verifies Razorpay order payment signature and activates the user's plan
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, interval }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-intl-payment', requireAuth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
      interval = 'monthly',
    } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return res.status(400).json({ error: 'Missing payment verification fields' })
    }

    // Razorpay order signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const body     = `${razorpay_order_id}|${razorpay_payment_id}`
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expected !== razorpay_signature) {
      console.warn(`❌ Intl signature mismatch for user ${req.user.id}`)
      return res.status(400).json({ error: 'Payment signature verification failed. Please contact support.' })
    }

    // Activate plan for 30 days (monthly) or 366 days (yearly)
    const days      = interval === 'yearly' ? 366 : 32
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    // No subscription ID for one-time orders — set null to distinguish from INR subscriptions
    await setUserPlan(req.user.id, plan, expiresAt, null)

    const intlUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    sendPlanActivatedEmail({ name: intlUser?.name, email: intlUser?.email, plan, interval, expiresAt, gateway: 'razorpay' })

    console.log(`✅ Intl plan activated: userId=${req.user.id} plan=${plan} interval=${interval} order=${razorpay_order_id} expires=${expiresAt}`)
    res.json({ success: true, plan, interval, expiresAt })
  } catch (error) {
    console.error('verify-intl-payment error:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = { router, webhookHandler }

// ── Startup env check ─────────────────────────────────────────────────────────
;(function checkEnv() {
  console.log('💳 paymentRoutes loaded (Razorpay)')
  console.log('   RAZORPAY_KEY_ID            :', process.env.RAZORPAY_KEY_ID     ? `${process.env.RAZORPAY_KEY_ID.slice(0, 12)}...` : '❌ MISSING')
  console.log('   RAZORPAY_KEY_SECRET        :', process.env.RAZORPAY_KEY_SECRET ? '✅ set' : '❌ MISSING')
  console.log('   Starter monthly plan ID    :', process.env.RAZORPAY_STARTER_PLAN_ID        || '⚠️  not set')
  console.log('   Starter yearly plan ID     :', process.env.RAZORPAY_STARTER_YEARLY_PLAN_ID || '⚠️  not set')
  console.log('   Pro monthly plan ID        :', process.env.RAZORPAY_PRO_PLAN_ID            || '⚠️  not set')
  console.log('   Pro yearly plan ID         :', process.env.RAZORPAY_PRO_YEARLY_PLAN_ID     || '⚠️  not set')
  console.log('   Agency monthly plan ID     :', process.env.RAZORPAY_AGENCY_PLAN_ID         || '⚠️  not set')
  console.log('   Agency yearly plan ID      :', process.env.RAZORPAY_AGENCY_YEARLY_PLAN_ID  || '⚠️  not set')
})()
