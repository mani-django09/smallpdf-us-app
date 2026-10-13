// payments/paymentRoutes.js — Razorpay integration for smallpdf.us
// Plans: Starter ($9/mo) · Pro ($19/mo) · Agency ($49/mo)
//
// Required .env variables:
//   RAZORPAY_KEY_ID=<from Razorpay Dashboard → API Keys>
//   RAZORPAY_KEY_SECRET=<secret — keep ONLY in .env, never in code>
//   RAZORPAY_WEBHOOK_SECRET=<set in Razorpay Dashboard → Webhooks>
//   RAZORPAY_STARTER_PLAN_ID=plan_xxx   (create in Razorpay Dashboard)
//   RAZORPAY_PRO_PLAN_ID=plan_xxx
//   RAZORPAY_AGENCY_PLAN_ID=plan_xxx
//   FRONTEND_URL=https://smallpdf.us

const express = require('express')
const crypto  = require('crypto')
const router  = express.Router()
const { dbRun, dbGet, dbAll } = require('../database')
const { recordPayment } = require('../admin/paymentLog')
const { requireAuth }  = require('../middleware/authMiddleware')
const {
  sendPlanActivatedEmail,
  sendPlanRenewedEmail,
  sendCancellationScheduledEmail,
  sendPlanExpiredEmail,
  sendPaymentFailedEmail,
  sendAbandonedCheckoutEmail,
  sendFreeUserNurtureEmail,
} = require('./emailService')

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://smallpdf.us'

// Razorpay SDK errors carry the real message under error.error.description,
// not error.message (which is usually undefined) — without this, failed
// requests returned an empty {} body to the client with no explanation.
function razorpayErrorMessage(error) {
  return error?.error?.description || error?.message || 'Something went wrong. Please try again or contact support.'
}

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

// ── Payment-verification helpers ───────────────────────────────────────────────
// SECURITY: plan / interval must NEVER come from the request body — the Razorpay
// signature only covers the payment/subscription/order IDs, so a user could pay
// for Starter and post plan:"agency". Everything below derives them from the
// provider's own record of what was bought.
function safeHexEqual(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8'), y = Buffer.from(String(b || ''), 'utf8')
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
function planFromRazorpayPlanId(planId) {
  for (const [plan, cfg] of Object.entries(PLANS)) {
    for (const interval of ['monthly', 'yearly']) {
      if (cfg[interval]?.planId && cfg[interval].planId === planId) return { plan, interval }
    }
  }
  return null
}
// One-time orders may only activate a plan once (replaying an old paid order's
// signature used to extend the plan again, or unlock it on other accounts).
async function claimOrderOnce(orderId, userId) {
  await dbRun(`CREATE TABLE IF NOT EXISTS used_payment_orders (
    order_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, used_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
  try {
    await dbRun('INSERT INTO used_payment_orders (order_id, user_id) VALUES (?, ?)', [orderId, userId])
    return true
  } catch (_) { return false }
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
    res.status(500).json({ error: razorpayErrorMessage(error) })
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
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' })
    }

    // Razorpay signature for subscriptions:
    // HMAC_SHA256( payment_id + "|" + subscription_id , key_secret )
    const body     = `${razorpay_payment_id}|${razorpay_subscription_id}`
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (!safeHexEqual(expected, razorpay_signature)) {
      console.warn(`❌ Signature mismatch for user ${req.user.id}`)
      return res.status(400).json({ error: 'Payment signature verification failed. Please contact support.' })
    }

    // The subscription must be the one THIS user started (create-subscription
    // stores it) and Razorpay must say what plan it is for.
    const me = await dbGet('SELECT razorpay_subscription_id FROM users WHERE id = ?', [req.user.id])
    if (!me || me.razorpay_subscription_id !== razorpay_subscription_id) {
      console.warn(`❌ verify-payment: subscription ${razorpay_subscription_id} does not belong to user ${req.user.id}`)
      return res.status(403).json({ error: 'This subscription does not belong to your account.' })
    }
    const sub = await getRazorpay().subscriptions.fetch(razorpay_subscription_id)
    const bought = planFromRazorpayPlanId(sub.plan_id)
    if (!bought || (sub.notes?.userId && String(sub.notes.userId) !== String(req.user.id))) {
      console.warn(`❌ verify-payment: unknown plan_id ${sub.plan_id} / owner mismatch for user ${req.user.id}`)
      return res.status(400).json({ error: 'Could not match this subscription to a plan. Please contact support.' })
    }
    if (!['active', 'authenticated'].includes(sub.status)) {
      return res.status(400).json({ error: `Subscription is not active (status: ${sub.status}).` })
    }
    const { plan, interval } = bought

    // Expiry from Razorpay's current billing period when available
    const expiresAt = sub.current_end
      ? new Date((sub.current_end + 2 * 24 * 60 * 60) * 1000).toISOString()
      : new Date(Date.now() + (interval === 'yearly' ? 366 : 32) * 24 * 60 * 60 * 1000).toISOString()
    await setUserPlan(req.user.id, plan, expiresAt, razorpay_subscription_id)
    // Admin revenue history (prices = pricing page INR list)
    const INR = { starter: { monthly: 399, yearly: 3990 }, pro: { monthly: 799, yearly: 7990 } }
    recordPayment({ userId: req.user.id, gateway: 'razorpay', event: 'activated', plan, interval,
      amount: (INR[plan]?.[interval] ?? 0) * 100 || null, currency: 'INR', ref: razorpay_payment_id })

    const activatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    sendPlanActivatedEmail({ name: activatedUser?.name, email: activatedUser?.email, plan, interval, expiresAt, gateway: 'razorpay' })

    console.log(`✅ Plan activated: userId=${req.user.id} plan=${plan} sub=${razorpay_subscription_id} payment=${razorpay_payment_id}`)
    res.json({ success: true, plan })
  } catch (error) {
    console.error('verify-payment error:', error)
    res.status(500).json({ error: razorpayErrorMessage(error) })
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
    res.status(500).json({ error: razorpayErrorMessage(error) })
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
    res.status(500).json({ error: razorpayErrorMessage(error) })
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

  // Verify webhook signature — REQUIRED, fail closed if the secret is missing
  // (a missing secret used to silently skip verification entirely).
  if (!webhookSecret) {
    console.error('❌ RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook for safety')
    return res.status(500).send('Webhook verification not configured')
  }
  if (!signature) {
    console.warn('❌ Razorpay webhook missing signature header — rejecting')
    return res.status(400).send('Missing webhook signature')
  }
  {
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
        {
          const pay = event.payload.payment?.entity
          recordPayment({ userId: user.id, gateway: 'razorpay', event: 'renewed', plan: planName,
            interval: sub.notes?.interval || null, amount: pay?.amount ?? null, currency: pay?.currency || 'INR', ref: pay?.id || sub.id })
        }
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
    res.status(500).json({ error: razorpayErrorMessage(error) })
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
    } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' })
    }

    // Razorpay order signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const body     = `${razorpay_order_id}|${razorpay_payment_id}`
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (!safeHexEqual(expected, razorpay_signature)) {
      console.warn(`❌ Intl signature mismatch for user ${req.user.id}`)
      return res.status(400).json({ error: 'Payment signature verification failed. Please contact support.' })
    }

    // Plan/interval come from the order we created (notes), which must belong to
    // this user and be paid — and each order can be redeemed only once.
    const order = await getRazorpay().orders.fetch(razorpay_order_id)
    const notes = order.notes || {}
    if (String(notes.userId) !== String(req.user.id)) {
      console.warn(`❌ verify-intl-payment: order ${razorpay_order_id} does not belong to user ${req.user.id}`)
      return res.status(403).json({ error: 'This payment does not belong to your account.' })
    }
    const plan = notes.plan
    const interval = notes.interval === 'yearly' ? 'yearly' : 'monthly'
    const expectedAmount = INTL_PLANS[plan]?.[interval]?.amount
    if (!expectedAmount || order.status !== 'paid' || Number(order.amount_paid) < expectedAmount) {
      return res.status(400).json({ error: 'Payment not completed for this plan.' })
    }
    if (!(await claimOrderOnce(razorpay_order_id, req.user.id))) {
      return res.status(409).json({ error: 'This payment has already been used.' })
    }

    // Activate plan for 30 days (monthly) or 366 days (yearly)
    const days      = interval === 'yearly' ? 366 : 32
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    // No subscription ID for one-time orders — set null to distinguish from INR subscriptions
    await setUserPlan(req.user.id, plan, expiresAt, null)
    recordPayment({ userId: req.user.id, gateway: 'razorpay_intl', event: 'activated', plan, interval,
      amount: Number(order.amount_paid) || expectedAmount, currency: 'USD', ref: razorpay_payment_id })

    const intlUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    sendPlanActivatedEmail({ name: intlUser?.name, email: intlUser?.email, plan, interval, expiresAt, gateway: 'razorpay' })

    console.log(`✅ Intl plan activated: userId=${req.user.id} plan=${plan} interval=${interval} order=${razorpay_order_id} expires=${expiresAt}`)
    res.json({ success: true, plan, interval, expiresAt })
  } catch (error) {
    console.error('verify-intl-payment error:', error)
    res.status(500).json({ error: razorpayErrorMessage(error) })
  }
})

// ── Abandoned-checkout recovery ───────────────────────────────────────────────
// A user who opens the Razorpay modal (POST /create-subscription stores the
// pending razorpay_subscription_id on their row) but never completes UPI
// mandate authorisation stays on plan='free' forever with no follow-up. This
// nudges them once, 2h–7d after they started, then never again for that
// subscription attempt. Called from server.js on a setInterval alongside the
// other background sweeps.
async function sendAbandonedCheckoutReminders() {
  try {
    await dbRun(`CREATE TABLE IF NOT EXISTS checkout_reminders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      subscription_id TEXT NOT NULL,
      sent_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, subscription_id)
    )`)

    const candidates = await dbAll(
      `SELECT id, name, email, razorpay_subscription_id FROM users
       WHERE razorpay_subscription_id IS NOT NULL AND razorpay_subscription_id != '' AND plan = 'free'`
    )
    if (!candidates.length) return

    const rzp = getRazorpay()
    let sent = 0

    for (const user of candidates) {
      const already = await dbGet(
        'SELECT id FROM checkout_reminders WHERE user_id = ? AND subscription_id = ?',
        [user.id, user.razorpay_subscription_id]
      )
      if (already) continue

      let sub
      try {
        sub = await rzp.subscriptions.fetch(user.razorpay_subscription_id)
      } catch {
        continue // subscription no longer exists on Razorpay's side — skip
      }
      if (!['created', 'authenticated'].includes(sub.status)) continue

      const ageHours = (Date.now() / 1000 - sub.created_at) / 3600
      if (ageHours < 2 || ageHours > 168) continue // 2h–7d window

      await sendAbandonedCheckoutEmail({
        name:  user.name,
        email: user.email,
        plan:  sub.notes?.plan || 'starter',
      })
      await dbRun(
        'INSERT OR IGNORE INTO checkout_reminders (user_id, subscription_id) VALUES (?, ?)',
        [user.id, user.razorpay_subscription_id]
      )
      sent++
    }

    if (sent > 0) console.log(`📧 Abandoned-checkout reminders sent: ${sent}`)
  } catch (err) {
    console.error('[abandoned-checkout-reminder] error:', err.message)
  }
}

// ── Free-user nurture — one-time email, 3-7 days after signup ────────────────
// Most signups never see a reason to upgrade because nothing in-product tells
// them what paid unlocks unless they happen to hit a limit. This sends one
// email per user (never repeated) showing the Starter plan's concrete
// benefits, to still-free, email-verified users a few days after they joined.
// isIndia can't be reliably determined server-side (no persisted geo on the
// user row), so it always uses USD pricing — a minor cosmetic gap, not a
// functional one.
async function sendFreeUserNurtureReminders() {
  try {
    await dbRun(`CREATE TABLE IF NOT EXISTS nurture_emails_sent (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)

    const candidates = await dbAll(
      `SELECT u.id, u.name, u.email FROM users u
       WHERE u.plan = 'free'
         AND u.email_verified = 1
         AND u.created_at <= datetime('now', '-3 days')
         AND u.created_at >= datetime('now', '-7 days')
         AND NOT EXISTS (SELECT 1 FROM nurture_emails_sent n WHERE n.user_id = u.id)`
    )
    if (!candidates.length) return

    let sent = 0
    for (const user of candidates) {
      await sendFreeUserNurtureEmail({ name: user.name, email: user.email, isIndia: false })
      await dbRun('INSERT OR IGNORE INTO nurture_emails_sent (user_id) VALUES (?)', [user.id])
      sent++
    }

    if (sent > 0) console.log(`📧 Free-user nurture emails sent: ${sent}`)
  } catch (err) {
    console.error('[free-user-nurture] error:', err.message)
  }
}

module.exports = { router, webhookHandler, sendAbandonedCheckoutReminders, sendFreeUserNurtureReminders }

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
