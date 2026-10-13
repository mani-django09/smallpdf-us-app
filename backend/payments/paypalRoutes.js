// payments/paypalRoutes.js — PayPal Business Subscriptions integration
//
// Flow:
//   1. Frontend calls POST /api/paypal/create-subscription → gets approveLink
//   2. User redirected to approveLink (PayPal hosted approval page)
//   3. PayPal redirects back to returnUrl with ?subscription_id=I-xxx
//   4. Frontend calls POST /api/paypal/verify-subscription → plan activated
//   5. Webhooks handle renewals, cancellations, failures automatically
//
// Required .env variables:
//   PAYPAL_CLIENT_ID=...
//   PAYPAL_CLIENT_SECRET=...
//   PAYPAL_WEBHOOK_ID=...          (from PayPal Dashboard → Webhooks)
//   PAYPAL_PLAN_STARTER_MONTHLY=P-...
//   PAYPAL_PLAN_STARTER_YEARLY=P-...
//   PAYPAL_PLAN_PRO_MONTHLY=P-...
//   PAYPAL_PLAN_PRO_YEARLY=P-...
//   PAYPAL_MODE=live               (or "sandbox" for testing)
//
// Routes:
//   GET  /api/paypal/config                → client ID + plan IDs for frontend
//   POST /api/paypal/create-subscription   → create PayPal subscription, return approveLink
//   POST /api/paypal/verify-subscription   → verify after redirect, activate plan
//   GET  /api/paypal/subscription-status   → current subscription info
//   POST /api/paypal/cancel-subscription   → cancel at period end
//   POST /api/paypal/webhook               → PayPal event handler

const express = require('express')
const https   = require('https')
const crypto  = require('crypto')
const router  = express.Router()
const { dbRun, dbGet } = require('../database')
const { recordPayment } = require('../admin/paymentLog')
const { requireAuth }  = require('../middleware/authMiddleware')
const {
  sendPlanActivatedEmail,
  sendPlanRenewedEmail,
  sendCancellationScheduledEmail,
  sendPlanExpiredEmail,
  sendPaymentFailedEmail,
} = require('./emailService')

// ── Config ────────────────────────────────────────────────────────────────────
const PAYPAL_MODE   = (process.env.PAYPAL_MODE || 'live').toLowerCase()
const PAYPAL_HOST   = PAYPAL_MODE === 'sandbox'
  ? 'api-m.sandbox.paypal.com'
  : 'api-m.paypal.com'

const PAYPAL_PLANS = {
  starter: {
    monthly: process.env.PAYPAL_PLAN_STARTER_MONTHLY,
    yearly:  process.env.PAYPAL_PLAN_STARTER_YEARLY,
  },
  pro: {
    monthly: process.env.PAYPAL_PLAN_PRO_MONTHLY,
    yearly:  process.env.PAYPAL_PLAN_PRO_YEARLY,
  },
}

// ── PayPal REST API helper ─────────────────────────────────────────────────────
function paypalRequest(method, path, body = null, accessToken = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept':        'application/json',
      'Prefer':        'return=representation',
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    } else {
      // Basic auth for token requests
      const creds = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString('base64')
      headers['Authorization'] = `Basic ${creds}`
    }

    const opts = { hostname: PAYPAL_HOST, path, method, headers }
    const req  = https.request(opts, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}
          if (res.statusCode >= 400) {
            reject(new Error(parsed.message || `PayPal API error ${res.statusCode}: ${data}`))
          } else {
            resolve(parsed)
          }
        } catch {
          reject(new Error(`PayPal API returned invalid JSON: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

// Get OAuth2 access token (cached for 8 hours)
let _tokenCache = null
async function getAccessToken() {
  if (_tokenCache && _tokenCache.expiresAt > Date.now()) return _tokenCache.token
  const qs   = 'grant_type=client_credentials'
  const res  = await paypalRequest(
    'POST',
    '/v1/oauth2/token',
    qs,
    null  // will use Basic auth via fallback
  )
  // Override Content-Type for form-encoded body
  // Actually we need to send form data — rewrite this call
  _tokenCache = {
    token:     res.access_token,
    expiresAt: Date.now() + (res.expires_in - 60) * 1000,
  }
  return _tokenCache.token
}

// Better token fetch using form-encoded body
async function fetchAccessToken() {
  if (_tokenCache && _tokenCache.expiresAt > Date.now()) return _tokenCache.token

  return new Promise((resolve, reject) => {
    const creds = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64')

    const body = 'grant_type=client_credentials'
    const opts = {
      hostname: PAYPAL_HOST,
      path:     '/v1/oauth2/token',
      method:   'POST',
      headers:  {
        'Authorization': `Basic ${creds}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          _tokenCache = {
            token:     parsed.access_token,
            expiresAt: Date.now() + (parsed.expires_in - 60) * 1000,
          }
          resolve(_tokenCache.token)
        } catch {
          reject(new Error('Failed to parse PayPal token response'))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// Authenticated PayPal API call
async function paypalAPI(method, path, body = null) {
  const token = await fetchAccessToken()
  return paypalRequest(method, path, body, token)
}

// Map PayPal plan ID → plan name
function planFromPayPalPlanId(planId) {
  for (const [plan, intervals] of Object.entries(PAYPAL_PLANS)) {
    if (Object.values(intervals).includes(planId)) return plan
  }
  return null
}

// Map subscription → plan + interval from plan_id
function planInfoFromSubscription(subscription) {
  const planId = subscription.plan_id
  for (const [plan, intervals] of Object.entries(PAYPAL_PLANS)) {
    for (const [interval, id] of Object.entries(intervals)) {
      if (id === planId) return { plan, interval }
    }
  }
  return { plan: null, interval: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/paypal/config
// Returns PayPal client ID + plan IDs — used by frontend to configure SDK
// ─────────────────────────────────────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({
    clientId: process.env.PAYPAL_CLIENT_ID,
    mode:     PAYPAL_MODE,
    plans:    PAYPAL_PLANS,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/paypal/create-subscription
// Creates a PayPal subscription and returns the approval URL.
// Frontend redirects the user to this URL.
// Body: { plan, interval }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-subscription', requireAuth, async (req, res) => {
  try {
    const { plan = 'starter', interval = 'monthly' } = req.body
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    const planId = PAYPAL_PLANS[plan]?.[interval]
    if (!planId) {
      return res.status(400).json({ error: `PayPal plan not configured for ${plan} ${interval}. Contact support.` })
    }

    const origin    = process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us'
    const returnUrl = `${origin}/payment/success?plan=${plan}&interval=${interval}&gateway=paypal`
    const cancelUrl = `${origin}/pricing?cancelled=1`

    const subscription = await paypalAPI('POST', '/v1/billing/subscriptions', {
      plan_id: planId,
      subscriber: {
        name:          { given_name: user.name?.split(' ')[0] || '', surname: user.name?.split(' ').slice(1).join(' ') || '' },
        email_address: user.email,
      },
      application_context: {
        brand_name:          'SmallPDF.us',
        locale:              'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action:         'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected:   'PAYPAL',
          payee_preferred:  'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
      custom_id: JSON.stringify({ userId: user.id, plan, interval }),
    })

    const approveLink = subscription.links?.find(l => l.rel === 'approve')?.href
    if (!approveLink) {
      throw new Error('PayPal did not return an approval URL. Please try again.')
    }

    console.log(`💳 PayPal subscription created: userId=${user.id} plan=${plan} interval=${interval} sub=${subscription.id}`)
    res.json({
      subscriptionId: subscription.id,
      approveLink,
    })
  } catch (err) {
    console.error('paypal create-subscription error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/paypal/verify-subscription
// Called after user returns from PayPal approval page.
// Verifies subscription is ACTIVE and activates plan in DB.
// Body: { subscriptionId, plan, interval }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-subscription', requireAuth, async (req, res) => {
  try {
    // SECURITY: plan/interval are taken from PayPal's subscription (its plan_id),
    // never from the request body — posting plan:"pro" for a Starter subscription
    // used to grant Pro. The subscription must also have been created for THIS
    // user (custom_id) and not already be attached to another account.
    const { subscriptionId } = req.body
    if (!subscriptionId) {
      return res.status(400).json({ error: 'Missing subscriptionId' })
    }

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Fetch subscription from PayPal API
    const sub = await paypalAPI('GET', `/v1/billing/subscriptions/${subscriptionId}`)

    if (!sub.id) {
      return res.status(400).json({ error: 'Subscription not found in PayPal' })
    }
    if (!['ACTIVE', 'APPROVED'].includes(sub.status)) {
      return res.status(400).json({ error: `Subscription not active (status: ${sub.status})` })
    }
    let ownerId = null
    try { ownerId = JSON.parse(sub.custom_id || '{}').userId } catch (_) {}
    if (String(ownerId) !== String(user.id)) {
      console.warn(`❌ PayPal verify: subscription ${sub.id} custom_id owner ${ownerId} ≠ user ${user.id}`)
      return res.status(403).json({ error: 'This subscription does not belong to your account.' })
    }
    const other = await dbGet('SELECT id FROM users WHERE paypal_subscription_id = ? AND id != ?', [sub.id, user.id])
    if (other) return res.status(409).json({ error: 'This subscription is already linked to another account.' })
    const { plan, interval } = planInfoFromSubscription(sub)
    if (!plan) {
      console.warn(`❌ PayPal verify: unknown plan_id ${sub.plan_id}`)
      return res.status(400).json({ error: 'Could not match this subscription to a plan. Please contact support.' })
    }

    // Calculate expiry
    const days     = interval === 'yearly' ? 366 : 32
    const expiresAt = sub.billing_info?.next_billing_time
      || new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    await dbRun(
      `UPDATE users SET plan = ?, plan_expires_at = ?, paypal_subscription_id = ?, paypal_customer_id = ? WHERE id = ?`,
      [plan, expiresAt, sub.id, sub.subscriber?.email_address || user.email, user.id]
    )

    {
      const usd = { starter: { monthly: 9, yearly: 90 }, pro: { monthly: 19, yearly: 190 }, agency: { monthly: 49, yearly: 490 } }
      recordPayment({ userId: user.id, gateway: 'paypal', event: 'activated', plan, interval,
        amount: (usd[plan]?.[interval] ?? 0) * 100 || null, currency: 'USD', ref: sub.id })
    }
    sendPlanActivatedEmail({ name: user.name, email: user.email, plan, interval, expiresAt, gateway: 'paypal' })

    console.log(`✅ PayPal verified: userId=${user.id} plan=${plan} interval=${interval} sub=${sub.id} expires=${expiresAt}`)
    res.json({ success: true, plan, interval, expiresAt })
  } catch (err) {
    console.error('paypal verify-subscription error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/paypal/subscription-status
// Returns current PayPal subscription info for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscription-status', requireAuth, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (!user.paypal_subscription_id || user.plan === 'free') {
      return res.json({ plan: 'free', subscription: null })
    }

    const sub = await paypalAPI('GET', `/v1/billing/subscriptions/${user.paypal_subscription_id}`)

    res.json({
      plan:          user.plan,
      planExpiresAt: user.plan_expires_at,
      subscription: {
        id:                sub.id,
        status:            sub.status,
        currentPeriodEnd:  sub.billing_info?.next_billing_time || user.plan_expires_at,
        cancelAtPeriodEnd: sub.status === 'CANCELLED',
        billingInterval:   sub.billing_info?.cycle_executions?.[0]?.tenure_type === 'REGULAR' ? 'month' : 'year',
      },
    })
  } catch (err) {
    console.error('paypal subscription-status error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/paypal/cancel-subscription
// Suspends subscription — user keeps access until period end
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user?.paypal_subscription_id) {
      return res.status(400).json({ error: 'No active PayPal subscription found.' })
    }

    await paypalAPI(
      'POST',
      `/v1/billing/subscriptions/${user.paypal_subscription_id}/cancel`,
      { reason: 'User requested cancellation via SmallPDF.us account.' }
    )

    sendCancellationScheduledEmail({ name: user.name, email: user.email, plan: user.plan, expiresAt: user.plan_expires_at })

    console.log(`⬇️  PayPal cancel: userId=${user.id} sub=${user.paypal_subscription_id}`)
    res.json({ success: true, message: 'Subscription cancelled. You will retain access until the end of your billing period.' })
  } catch (err) {
    console.error('paypal cancel-subscription error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/paypal/webhook
// Handles PayPal IPN/webhook events
//
// Setup in PayPal Dashboard → My Apps → Webhooks:
//   URL: https://smallpdf.us/api/paypal/webhook
//   Events: BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED,
//           BILLING.SUBSCRIPTION.EXPIRED, BILLING.SUBSCRIPTION.PAYMENT.FAILED,
//           PAYMENT.SALE.COMPLETED
//
// IMPORTANT: Register BEFORE express.json() — needs raw body for signature verification
// ─────────────────────────────────────────────────────────────────────────────
async function paypalWebhookHandler(req, res) {
  try {
    // Verify PayPal webhook signature — REQUIRED, fail closed on any gap.
    // (Previously this skipped verification whenever PAYPAL_WEBHOOK_ID or the
    // transmission headers were missing, and swallowed verification errors as
    // a pass-through — an attacker could forge a BILLING.SUBSCRIPTION.ACTIVATED
    // event with no headers at all and upgrade any account for free.)
    const webhookId = process.env.PAYPAL_WEBHOOK_ID
    if (!webhookId) {
      console.error('❌ PAYPAL_WEBHOOK_ID not configured — rejecting webhook for safety')
      return res.status(500).send('Webhook verification not configured')
    }

    const transmissionId   = req.headers['paypal-transmission-id']
    const transmissionTime = req.headers['paypal-transmission-time']
    const certUrl          = req.headers['paypal-cert-url']
    const authAlgo         = req.headers['paypal-auth-algo']
    const transmissionSig  = req.headers['paypal-transmission-sig']

    if (!transmissionId || !transmissionSig || !transmissionTime || !certUrl || !authAlgo) {
      console.warn('❌ PayPal webhook missing required verification headers — rejecting')
      return res.status(400).send('Missing verification headers')
    }

    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body || '')

    let event
    try {
      event = JSON.parse(rawBody)
    } catch {
      return res.status(400).send('Invalid JSON payload')
    }

    let verifyResult
    try {
      const token = await fetchAccessToken()
      verifyResult = await paypalRequest('POST', '/v1/notifications/verify-webhook-signature', {
        auth_algo:         authAlgo,
        cert_url:          certUrl,
        transmission_id:   transmissionId,
        transmission_sig:  transmissionSig,
        transmission_time: transmissionTime,
        webhook_id:        webhookId,
        webhook_event:     event,
      }, token)
    } catch (verifyErr) {
      console.error('❌ PayPal webhook signature verification errored — rejecting:', verifyErr.message)
      return res.status(400).send('Webhook verification failed')
    }

    if (verifyResult.verification_status !== 'SUCCESS') {
      console.error('❌ PayPal webhook signature verification failed')
      return res.status(400).send('Invalid webhook signature')
    }

    console.log(`📨 PayPal Webhook: ${event.event_type}`)
    const resource = event.resource || {}

    switch (event.event_type) {

      // ── Subscription activated → activate plan ──────────────────────────────
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subId    = resource.id
        const planId   = resource.plan_id
        const email    = resource.subscriber?.email_address
        const customId = resource.custom_id

        let userId = null
        let planName = null
        let interval = 'monthly'

        // Try to get userId + plan from custom_id
        try {
          if (customId) {
            const parsed = JSON.parse(customId)
            userId   = parsed.userId   ? parseInt(parsed.userId)  : null
            planName = parsed.plan     || planFromPayPalPlanId(planId)
            interval = parsed.interval || 'monthly'
          }
        } catch { /* ignore */ }

        // Fallback: look up user by PayPal subscription ID or email
        if (!userId && email) {
          const foundUser = await dbGet('SELECT id FROM users WHERE email = ?', [email])
          userId = foundUser?.id || null
        }
        if (!userId && subId) {
          const foundUser = await dbGet('SELECT id FROM users WHERE paypal_subscription_id = ?', [subId])
          userId = foundUser?.id || null
        }

        if (!userId) {
          console.warn(`⚠️  PayPal SUBSCRIPTION.ACTIVATED: cannot identify user sub=${subId}`)
          break
        }

        planName = planName || planFromPayPalPlanId(planId) || 'starter'
        const days      = interval === 'yearly' ? 366 : 32
        const expiresAt = resource.billing_info?.next_billing_time
          || new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

        await dbRun(
          `UPDATE users SET plan = ?, plan_expires_at = ?, paypal_subscription_id = ?, paypal_customer_id = ? WHERE id = ?`,
          [planName, expiresAt, subId, email || null, userId]
        )
        const activatedUser = await dbGet('SELECT name, email FROM users WHERE id = ?', [userId])
        sendPlanActivatedEmail({ name: activatedUser?.name, email: activatedUser?.email, plan: planName, interval, expiresAt, gateway: 'paypal' })
        console.log(`✅ PayPal activated: userId=${userId} plan=${planName} sub=${subId} expires=${expiresAt}`)
        break
      }

      // ── Subscription cancelled → revert to free ─────────────────────────────
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        const subId = resource.id
        const user  = await dbGet('SELECT * FROM users WHERE paypal_subscription_id = ?', [subId])
        if (!user) break

        const prevPlan = user.plan
        await dbRun(
          `UPDATE users SET plan = 'free', plan_expires_at = NULL, paypal_subscription_id = NULL, paypal_customer_id = NULL WHERE id = ?`,
          [user.id]
        )
        sendPlanExpiredEmail({ name: user.name, email: user.email, plan: prevPlan })
        console.log(`⬇️  PayPal ${event.event_type}: userId=${user.id} → free`)
        break
      }

      // ── Payment completed (renewal) → extend expiry ─────────────────────────
      case 'PAYMENT.SALE.COMPLETED': {
        const billingAgreementId = resource.billing_agreement_id
        if (!billingAgreementId) break

        const user = await dbGet('SELECT * FROM users WHERE paypal_subscription_id = ?', [billingAgreementId])
        if (!user) break

        // Fetch updated subscription to get new billing period
        let expiresAt
        try {
          const sub = await paypalAPI('GET', `/v1/billing/subscriptions/${billingAgreementId}`)
          expiresAt = sub.billing_info?.next_billing_time
        } catch { /* ignore */ }

        if (!expiresAt) {
          expiresAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()
        }

        await dbRun(`UPDATE users SET plan_expires_at = ? WHERE id = ?`, [expiresAt, user.id])
        recordPayment({ userId: user.id, gateway: 'paypal', event: 'renewed', plan: user.plan,
          amount: Math.round(parseFloat(resource.amount?.total || 0) * 100) || null, currency: resource.amount?.currency || 'USD', ref: resource.id })
        sendPlanRenewedEmail({ name: user.name, email: user.email, plan: user.plan, expiresAt, gateway: 'paypal' })
        console.log(`💳 PayPal renewal: userId=${user.id} sub=${billingAgreementId} expires=${expiresAt}`)
        break
      }

      // ── Payment failed ───────────────────────────────────────────────────────
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        const subId    = resource.id
        const failUser = await dbGet('SELECT * FROM users WHERE paypal_subscription_id = ?', [subId])
        if (failUser) {
          recordPayment({ userId: failUser.id, gateway: 'paypal', event: 'failed', plan: failUser.plan, ref: subId })
          sendPaymentFailedEmail({ name: failUser.name, email: failUser.email, plan: failUser.plan, gateway: 'paypal' })
        }
        console.warn(`⚠️  PayPal payment_failed: sub=${subId}`)
        break
      }

      default:
        // Ignore other event types
        break
    }
  } catch (err) {
    console.error('PayPal webhook handler error:', err)
    // Always return 200 so PayPal doesn't retry
  }

  res.json({ received: true })
}

module.exports = { router, paypalWebhookHandler }

// ── Startup env check ──────────────────────────────────────────────────────────
;(function checkEnv() {
  console.log('💳 paypalRoutes loaded — mode:', PAYPAL_MODE)
  console.log('   PAYPAL_CLIENT_ID              :', process.env.PAYPAL_CLIENT_ID         ? `${process.env.PAYPAL_CLIENT_ID.slice(0, 15)}...` : '❌ MISSING')
  console.log('   PAYPAL_CLIENT_SECRET          :', process.env.PAYPAL_CLIENT_SECRET     ? '✅ set' : '❌ MISSING')
  console.log('   PAYPAL_WEBHOOK_ID             :', process.env.PAYPAL_WEBHOOK_ID        ? '✅ set' : '⚠️  not set')
  console.log('   PAYPAL_PLAN_STARTER_MONTHLY   :', process.env.PAYPAL_PLAN_STARTER_MONTHLY || '⚠️  not set')
  console.log('   PAYPAL_PLAN_STARTER_YEARLY    :', process.env.PAYPAL_PLAN_STARTER_YEARLY  || '⚠️  not set')
  console.log('   PAYPAL_PLAN_PRO_MONTHLY       :', process.env.PAYPAL_PLAN_PRO_MONTHLY     || '⚠️  not set')
  console.log('   PAYPAL_PLAN_PRO_YEARLY        :', process.env.PAYPAL_PLAN_PRO_YEARLY      || '⚠️  not set')
})()
