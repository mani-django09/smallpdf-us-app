// payments/lemonSqueezyRoutes.js — Lemon Squeezy Subscriptions (Primary international gateway)
//
// Flow:
//   1. Frontend POST /api/lemonsqueezy/create-checkout  → gets checkoutUrl
//   2. Frontend redirects user to checkoutUrl (LS hosted checkout page)
//   3. LS redirects back to /payment/success?gateway=lemonsqueezy&plan=...
//   4. Webhook POST /api/lemonsqueezy/webhook activates plan automatically
//
// Required .env:
//   LEMONSQUEEZY_API_KEY
//   LEMONSQUEEZY_STORE_ID
//   LEMONSQUEEZY_WEBHOOK_SECRET
//   LEMONSQUEEZY_VARIANT_STARTER_MONTHLY / STARTER_YEARLY / PRO_MONTHLY / PRO_YEARLY
//
// Optional — Indonesia-discounted variants (create these in the LS dashboard as
// separate lower-priced variants of the same Starter/Pro products; frontend
// detects Indonesian timezones and sends region:'id'). Falls back to the
// standard variant above if unset, so this is safe to deploy before the LS
// variants exist:
//   LEMONSQUEEZY_VARIANT_STARTER_MONTHLY_IDN / STARTER_YEARLY_IDN / PRO_MONTHLY_IDN / PRO_YEARLY_IDN

const express  = require('express')
const https    = require('https')
const crypto   = require('crypto')
const router   = express.Router()
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

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://smallpdf.us'
const LS_API_KEY   = process.env.LEMONSQUEEZY_API_KEY
const LS_STORE_ID  = process.env.LEMONSQUEEZY_STORE_ID
const LS_WH_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

const VARIANT_IDS = {
  starter: {
    monthly: process.env.LEMONSQUEEZY_VARIANT_STARTER_MONTHLY,
    yearly:  process.env.LEMONSQUEEZY_VARIANT_STARTER_YEARLY,
  },
  pro: {
    monthly: process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY,
    yearly:  process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY,
  },
}

// Indonesia-discounted variants — each falls back to the standard variant
// above if its env var isn't set, so this whole feature is a no-op until
// someone actually creates the discounted variants in the LS dashboard.
const VARIANT_IDS_IDN = {
  starter: {
    monthly: process.env.LEMONSQUEEZY_VARIANT_STARTER_MONTHLY_IDN || VARIANT_IDS.starter.monthly,
    yearly:  process.env.LEMONSQUEEZY_VARIANT_STARTER_YEARLY_IDN  || VARIANT_IDS.starter.yearly,
  },
  pro: {
    monthly: process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_IDN || VARIANT_IDS.pro.monthly,
    yearly:  process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_IDN  || VARIANT_IDS.pro.yearly,
  },
}

// ── LS REST API helper ─────────────────────────────────────────────────────────
function lsRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const headers = {
      Authorization: 'Bearer ' + LS_API_KEY,
      Accept:        'application/vnd.api+json',
    }
    if (payload) {
      headers['Content-Type']   = 'application/vnd.api+json'
      headers['Content-Length'] = Buffer.byteLength(payload)
    }
    const opts = { hostname: 'api.lemonsqueezy.com', path: '/v1' + path, method, headers }
    const req  = https.request(opts, res => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { resolve({ raw: data }) } })
    })
    req.on('error', reject)
    // Never let a slow LS API hang a webhook or an account page request.
    req.setTimeout(10000, () => req.destroy(new Error('Lemon Squeezy API timeout')))
    if (payload) req.write(payload)
    req.end()
  })
}

// ── Map variant ID back to plan name ─────────────────────────────────────────
// Checks both the standard and Indonesia-discounted variant maps so webhook
// activation works no matter which one the customer actually bought.
function getPlanFromVariant(variantId) {
  const id = String(variantId)
  for (const variantMap of [VARIANT_IDS, VARIANT_IDS_IDN]) {
    for (const [plan, intervals] of Object.entries(variantMap)) {
      for (const [interval, vid] of Object.entries(intervals)) {
        if (String(vid) === id) return { plan, interval }
      }
    }
  }
  return null
}

// ── GET /api/lemonsqueezy/config  (public) ────────────────────────────────────
router.get('/config', (_req, res) => {
  res.json({ storeId: LS_STORE_ID, variants: VARIANT_IDS })
})

// ── POST /api/lemonsqueezy/create-checkout  (auth required) ──────────────────
router.post('/create-checkout', requireAuth, async (req, res) => {
  try {
    const { plan, interval = 'monthly', region } = req.body
    if (!plan) return res.status(400).json({ error: 'plan is required' })

    // `region: 'id'` is sent by the frontend when the visitor's browser
    // timezone is Indonesian (WIB/WITA/WIT) — see pricing.js. Falls back to
    // the standard USD variant automatically if no discounted variant is
    // configured yet.
    const variantMap = region === 'id' ? VARIANT_IDS_IDN : VARIANT_IDS
    const variantId  = variantMap[plan]?.[interval]
    if (!variantId) return res.status(400).json({ error: 'Invalid plan or interval' })

    const user       = req.user
    const successUrl = `${FRONTEND_URL}/payment/success?gateway=lemonsqueezy&plan=${plan}&interval=${interval}`
    const cancelUrl  = `${FRONTEND_URL}/pricing?cancelled=1`

    const body = {
      data: {
        type: 'checkouts',
        attributes: {
          // redirect_url must be inside product_options (not top-level attributes)
          product_options: {
            redirect_url: successUrl,
          },
          checkout_options: {
            embed:        false,
            media:        false,
            button_color: '#ef4444',
          },
          checkout_data: {
            email: user.email,
            name:  user.name || user.email,
            custom: {
              user_id:  String(user.id),
              plan,
              interval,
            },
          },
        },
        relationships: {
          store:   { data: { type: 'stores',   id: String(LS_STORE_ID) } },
          variant: { data: { type: 'variants', id: String(variantId)   } },
        },
      },
    }

    const result = await lsRequest('POST', '/checkouts', body)
    if (result.errors) {
      console.error('[LS] checkout error:', result.errors)
      return res.status(500).json({ error: result.errors[0]?.detail || 'Checkout creation failed' })
    }

    const checkoutUrl = result.data?.attributes?.url
    if (!checkoutUrl) return res.status(500).json({ error: 'No checkout URL returned from Lemon Squeezy' })

    res.json({ checkoutUrl, variantId })
  } catch (err) {
    console.error('[LS] create-checkout exception:', err.message)
    res.status(500).json({ error: 'Failed to create checkout' })
  }
})

// ── GET /api/lemonsqueezy/subscription-status  (auth required) ───────────────
// Same response shape as /api/payments/subscription-status (Razorpay) so the
// account page can render any gateway, plus LS's hosted billing-portal links
// (update card, invoices, resume) when the LS API is reachable.
router.get('/subscription-status', requireAuth, async (req, res) => {
  try {
    const user = await dbGet('SELECT plan, plan_expires_at FROM users WHERE id = ?', [req.user.id])
    const row = await dbGet(
      'SELECT * FROM subscriptions WHERE user_id = ? AND gateway = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id, 'lemonsqueezy']
    ).catch(() => null)
    if (!row) return res.json({ plan: user?.plan || 'free', subscription: null, invoices: [] })

    let live = null
    try {
      const r = await lsRequest('GET', '/subscriptions/' + row.gateway_subscription_id)
      live = r?.data?.attributes || null
    } catch (_) { /* fall back to our own row */ }

    const status = live?.status || row.status
    const interval = getPlanFromVariant(live?.variant_id)?.interval || 'monthly'
    res.json({
      plan:          user?.plan || 'free',
      planExpiresAt: user?.plan_expires_at || null,
      gateway:       'lemonsqueezy',
      subscription: {
        id:                row.gateway_subscription_id,
        status,
        interval,
        currentPeriodEnd:  live?.ends_at || live?.renews_at || row.current_period_end || user?.plan_expires_at,
        cancelAtPeriodEnd: status === 'cancelled' || !!live?.cancelled || row.cancel_at_period_end === 1,
      },
      portalUrl:        live?.urls?.customer_portal || null,
      updatePaymentUrl: live?.urls?.update_payment_method || null,
      invoices: [],
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscription status' })
  }
})

// ── POST /api/lemonsqueezy/cancel-subscription  (auth required) ──────────────
router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT * FROM subscriptions WHERE user_id = ? AND gateway = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id, 'lemonsqueezy', 'active']
    ).catch(() => null)

    if (!row?.gateway_subscription_id) {
      return res.status(400).json({ error: 'No active Lemon Squeezy subscription found' })
    }

    // DELETE cancels at period end in Lemon Squeezy
    const result = await lsRequest('DELETE', '/subscriptions/' + row.gateway_subscription_id)
    if (result.errors) {
      return res.status(500).json({ error: result.errors[0]?.detail || 'Cancellation failed' })
    }

    await dbRun(
      'UPDATE subscriptions SET status = ?, cancel_at_period_end = 1 WHERE id = ?',
      ['cancelled', row.id]
    ).catch(() => {})

    res.json({ success: true, message: 'Subscription will cancel at end of billing period' })
  } catch (err) {
    console.error('[LS] cancel error:', err.message)
    res.status(500).json({ error: 'Cancellation failed' })
  }
})

// ── POST /api/lemonsqueezy/webhook  (raw body — wired in server.js) ───────────
async function webhookHandler(req, res) {
  try {
    const sig     = req.headers['x-signature']
    const rawBody = req.body  // Buffer

    // Verify HMAC-SHA256
    const hmac   = crypto.createHmac('sha256', LS_WH_SECRET)
    const digest = hmac.update(rawBody).digest('hex')
    // Length check first: timingSafeEqual throws on unequal lengths, which
    // turned junk signatures into a 500 instead of a 401.
    if (!sig || sig.length !== digest.length || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig))) {
      console.warn('[LS webhook] invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    const event     = JSON.parse(rawBody.toString())
    const eventName = event.meta?.event_name
    const data      = event.data || {}
    const attrs     = data.attributes || {}
    const custom    = event.meta?.custom_data || {}

    console.log('[LS webhook]', eventName, '| sub_id:', data.id)

    const userId    = custom.user_id ? parseInt(custom.user_id) : null
    // subscription_payment_success delivers a Subscription *Invoice* object —
    // data.id is the INVOICE id there; the real subscription id lives in
    // attrs.subscription_id. Using data.id blindly created duplicate
    // subscription rows keyed by invoice id.
    const subId     = String(attrs.subscription_id || data.id || '')
    const variantId = String(attrs.variant_id || '')
    const planInfo  = getPlanFromVariant(variantId)
    const planName  = planInfo?.plan || custom.plan || 'starter'
    const subStatus = attrs.status || 'active'
    let   periodEnd = attrs.renews_at || attrs.ends_at || null

    // Upsert subscription row
    async function upsertSub(newStatus) {
      if (!userId) return
      const existing = await dbGet(
        'SELECT id FROM subscriptions WHERE gateway_subscription_id = ? AND gateway = ?',
        [subId, 'lemonsqueezy']
      ).catch(() => null)
      if (existing) {
        // COALESCE: invoice events carry no renews_at — keep the existing period end
        await dbRun(
          'UPDATE subscriptions SET status=?,plan=?,current_period_end=COALESCE(?,current_period_end),updated_at=CURRENT_TIMESTAMP WHERE id=?',
          [newStatus, planName, periodEnd, existing.id]
        )
      } else {
        await dbRun(
          'INSERT INTO subscriptions (user_id,gateway,gateway_subscription_id,plan,status,current_period_end,created_at,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
          [userId, 'lemonsqueezy', subId, planName, newStatus, periodEnd]
        )
      }
    }

    async function activateUser(plan) {
      if (!userId) return
      // Set plan_expires_at from the subscription's current period end so:
      //   1. cleanupExpiredPlans() can auto-downgrade if the webhook is delayed/missed
      //   2. authRoutes.js plan-expiry check works consistently with Razorpay/PayPal
      // NOTE: users table has NO updated_at column — referencing it made this
      // UPDATE throw ("no such column") on EVERY activation, so paying customers
      // never got their plan (found 2026-07-14, user 1182). Do not re-add it.
      // COALESCE: invoice events (payment_success) carry no renews_at — keep the
      // existing expiry instead of nulling it.
      await dbRun(
        'UPDATE users SET plan=?, plan_expires_at=COALESCE(?, plan_expires_at) WHERE id=?',
        [plan, periodEnd, userId]
      )
      console.log(`[LS webhook] ✅ activated user=${userId} plan=${plan} expires=${periodEnd || '(kept existing)'}`)
    }
    async function deactivateUser() {
      if (!userId) return
      // Guard: never downgrade a user who still has ANOTHER active subscription
      const other = await dbGet(
        "SELECT id FROM subscriptions WHERE user_id=? AND status='active' AND gateway_subscription_id != ?",
        [userId, subId]
      ).catch(() => null)
      if (other) {
        console.log(`[LS webhook] skip deactivate user=${userId} — another active subscription exists (row ${other.id})`)
        return
      }
      await dbRun(
        "UPDATE users SET plan='free', plan_expires_at=NULL WHERE id=?",
        [userId]
      )
      console.log(`[LS webhook] ⬇ deactivated user=${userId} → free`)
    }
    // The emailService senders take ONE object ({ name, email, plan, ... }).
    // These used to be called positionally — sendX(email, plan) — which
    // destructured a string, so every LS email went to `undefined` and failed
    // silently inside .catch(). Always build the object via mailArgs().
    async function mailArgs(extra = {}) {
      const u = userId
        ? await dbGet('SELECT email, name, plan_expires_at FROM users WHERE id=?', [userId]).catch(() => null)
        : null
      const email = u?.email || attrs.user_email || null
      if (!email) return null
      return {
        name: u?.name || attrs.user_name || '',
        email,
        plan: planName,
        interval: planInfo?.interval || custom.interval,
        expiresAt: periodEnd || u?.plan_expires_at || null,
        gateway: 'Lemon Squeezy',
        ...extra,
      }
    }
    const mail = async (sender, extra) => {
      const args = await mailArgs(extra)
      if (args) sender(args).catch((e) => console.error('[LS webhook] email failed:', e.message))
    }

    switch (eventName) {
      case 'subscription_created': {
        await upsertSub('active')
        await activateUser(planName)
        await mail(sendPlanActivatedEmail)
        break
      }
      case 'subscription_payment_success': {
        // Invoice payloads carry no renews_at. Read it off the subscription so
        // a renewal extends plan_expires_at right away — otherwise the user's
        // access hinges on a separate subscription_updated event arriving, and
        // the renewal email would show the old date.
        if (!periodEnd && subId) {
          try {
            const s = await lsRequest('GET', '/subscriptions/' + subId)
            periodEnd = s?.data?.attributes?.renews_at || null
          } catch (_) { /* keep null — COALESCE keeps the existing expiry */ }
        }
        await upsertSub('active')
        await activateUser(planName)
        recordPayment({ userId, gateway: 'lemonsqueezy',
          event: attrs.billing_reason === 'initial' ? 'activated' : 'renewed', plan: planName,
          amount: Number(attrs.total) || null, currency: attrs.currency || 'USD', ref: String(data.id || subId || '') })
        // The first charge also fires payment_success right after
        // subscription_created — only a later charge is a renewal.
        if (attrs.billing_reason !== 'initial') await mail(sendPlanRenewedEmail)
        break
      }
      case 'subscription_updated': {
        const newPlan = getPlanFromVariant(String(attrs.variant_id))?.plan || planName
        await upsertSub(subStatus === 'active' ? 'active' : subStatus)
        if (subStatus === 'active') await activateUser(newPlan)
        break
      }
      case 'subscription_cancelled': {
        await upsertSub('cancelled')
        await mail(sendCancellationScheduledEmail)
        break
      }
      case 'subscription_expired': {
        await upsertSub('expired')
        await deactivateUser()
        await mail(sendPlanExpiredEmail)
        break
      }
      case 'subscription_payment_failed': {
        recordPayment({ userId, gateway: 'lemonsqueezy', event: 'failed', plan: planName, ref: String(subId || '') })
        await mail(sendPaymentFailedEmail)
        break
      }
      case 'subscription_resumed':
      case 'subscription_unpaused': {
        await upsertSub('active')
        await activateUser(planName)
        break
      }
      case 'subscription_paused': {
        await upsertSub('paused')
        break
      }
      default:
        console.log('[LS webhook] unhandled event:', eventName)
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[LS webhook] exception:', err.message)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}

module.exports = { router, webhookHandler }
