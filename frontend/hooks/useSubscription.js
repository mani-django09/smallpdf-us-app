// hooks/useSubscription.js
//
// Payment gateways:
//   India (INR)          → Razorpay         [startCheckout]               UPI/Card/Net Banking
//   International (USD)  → Lemon Squeezy    [startLemonSqueezyCheckout]   Card/Apple/Google Pay — PRIMARY
//   International backup → PayPal Business  [startPayPalCheckout]         PayPal balance/card

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'

const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
      : `${window.location.protocol}//${window.location.hostname}`)
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')

// Detects Indonesian visitors via browser timezone (WIB/WITA/WIT) so the
// backend can route checkout to a discounted Lemon Squeezy variant, if one
// has been configured (see payments/lemonSqueezyRoutes.js — falls back to
// the standard variant automatically otherwise). Same detection pricing.js
// uses to show the "≈ Rp" price hint.
function detectIndonesiaRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return ['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura'].includes(tz) ? 'id' : undefined
  } catch {
    return undefined
  }
}

// Guests can't check out, so a paid-plan click sends them to signup first.
// The redirect carries the plan back to /pricing with autostart=1, which
// reopens checkout automatically — otherwise the user returns to a plain
// pricing page and has to hunt down the plan and click it all over again.
function authThenResumeUrl(page, plan, interval) {
  const resume = `/pricing?plan=${plan}&interval=${interval}&autostart=1`
  return `/auth/${page}?plan=${plan}&interval=${interval}&redirect=${encodeURIComponent(resume)}`
}

// Dynamically loads Razorpay checkout.js from CDN (India only)
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (document.getElementById('razorpay-checkout-js')) return resolve(true)
    const script    = document.createElement('script')
    script.id       = 'razorpay-checkout-js'
    script.src      = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload   = () => resolve(true)
    script.onerror  = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function useSubscription() {
  const { user, authFetch, refreshUser } = useAuth()
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [status,  setStatus]  = useState(null)

  // ── Fetch subscription status ─────────────────────────────────────────────
  // Razorpay is asked first; for a paid user with no Razorpay subscription the
  // plan came from Lemon Squeezy or PayPal, so ask those. The result carries
  // `gateway` so the account page labels it and cancels through the right API.
  const fetchStatus = useCallback(async () => {
    if (!user) { setStatus(null); return }
    try {
      const res = await authFetch(`${API_BASE}/api/payments/subscription-status`)
      let data = res.ok ? await res.json() : null
      if (data?.subscription) data = { ...data, gateway: 'razorpay' }

      if (!data?.subscription && ['starter', 'pro', 'agency'].includes(user.plan)) {
        for (const gateway of ['lemonsqueezy', 'paypal']) {
          try {
            const r = await authFetch(`${API_BASE}/api/${gateway}/subscription-status`)
            const d = r.ok ? await r.json() : null
            if (d?.subscription) { data = { ...d, gateway }; break }
          } catch { /* try the next gateway */ }
        }
      }

      // PayPal reports ACTIVE/CANCELLED; the page's badges use lowercase.
      if (data?.subscription?.status) {
        data.subscription = { ...data.subscription, status: String(data.subscription.status).toLowerCase() }
      }
      if (data) setStatus(data)
    } catch { /* network error — ignore */ }
  }, [user, authFetch])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // ── India: Razorpay Checkout (INR) ────────────────────────────────────────
  const startCheckout = useCallback(async (plan, interval = 'monthly') => {
    setError(null)
    if (!plan) { setError('No plan specified'); return }

    if (!user) {
      router.push(authThenResumeUrl('signup', plan, interval))
      return
    }

    setLoading(true)
    try {
      const loaded = await loadRazorpayScript()
      if (!loaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Could not load payment gateway. Please check your internet connection and try again.')
      }

      const res  = await authFetch(`${API_BASE}/api/payments/create-subscription`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create subscription')

      await new Promise((resolve, reject) => {
        const billingLabel = interval === 'yearly' ? 'Annual' : 'Monthly'
        const options = {
          key:             data.key,
          subscription_id: data.subscriptionId,
          name:            'SmallPDF.us',
          description:     `${data.label} — ${billingLabel} Billing`,
          image:           `${window.location.origin}/logo.png`,
          prefill:         data.prefill || {},
          theme:           { color: '#ef4444' },

          handler: async function (response) {
            try {
              const verifyRes = await authFetch(`${API_BASE}/api/payments/verify-payment`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                  razorpay_payment_id:      response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature:       response.razorpay_signature,
                  plan,
                }),
              })
              const verifyData = await verifyRes.json()
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed')
              if (typeof refreshUser === 'function') await refreshUser()
              resolve()
              router.push(`/payment/success?plan=${plan}`)
            } catch (err) { reject(err) }
          },

          modal: {
            ondismiss: () => { resolve(); setLoading(false) },
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', (response) => {
          reject(new Error(response.error?.description || 'Payment failed. Please try again.'))
        })
        rzp.open()
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, authFetch, refreshUser, router])

  // ── International PRIMARY: Lemon Squeezy Checkout (USD, 50+ currencies) ────
  // Backend creates a hosted checkout URL → frontend redirects user there.
  // After payment LS webhook fires and activates the plan automatically.
  const startLemonSqueezyCheckout = useCallback(async (plan, interval = 'monthly') => {
    setError(null)
    if (!plan) { setError('No plan specified'); return }

    if (!user) {
      router.push(authThenResumeUrl('signup', plan, interval))
      return
    }

    setLoading(true)
    try {
      const res  = await authFetch(`${API_BASE}/api/lemonsqueezy/create-checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, interval, region: detectIndonesiaRegion() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout')
      if (!data.checkoutUrl) throw new Error('No checkout URL received. Please try again.')
      window.location.href = data.checkoutUrl
      // setLoading stays true — page navigates away
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [user, authFetch, router])

  // ── Cancel Lemon Squeezy subscription ─────────────────────────────────────
  const cancelLemonSqueezySubscription = useCallback(async () => {
    setError(null)
    if (!user) return
    setLoading(true)
    try {
      const res  = await authFetch(`${API_BASE}/api/lemonsqueezy/cancel-subscription`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not cancel subscription')
      await fetchStatus()
      return { success: true, message: data.message }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, authFetch, fetchStatus])

  // ── International BACKUP: PayPal Business Checkout (USD) ─────────────────
  // Creates a PayPal subscription on backend → redirects user to PayPal approval page.
  // After approval, PayPal redirects to /payment/success?plan=...&gateway=paypal&subscription_id=I-xxx
  // The success page calls /api/paypal/verify-subscription to activate the plan.
  const startPayPalCheckout = useCallback(async (plan, interval = 'monthly') => {
    setError(null)
    if (!plan) { setError('No plan specified'); return }

    if (!user) {
      router.push(authThenResumeUrl('signup', plan, interval))
      return
    }

    setLoading(true)
    try {
      // 1. Create PayPal subscription on backend
      const res  = await authFetch(`${API_BASE}/api/paypal/create-subscription`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create PayPal subscription')

      // 2. Redirect user to PayPal approval page
      if (!data.approveLink) {
        throw new Error('No PayPal approval link received. Please try again.')
      }
      window.location.href = data.approveLink
      // Note: setLoading stays true — page will navigate away
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [user, authFetch, router])

  // ── Cancel Razorpay subscription ──────────────────────────────────────────
  const cancelRazorpaySubscription = useCallback(async () => {
    setError(null)
    if (!user) return
    setLoading(true)
    try {
      const res  = await authFetch(`${API_BASE}/api/payments/cancel-subscription`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not cancel subscription')
      await fetchStatus()
      return { success: true, message: data.message }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, authFetch, fetchStatus])

  // ── Cancel PayPal subscription ────────────────────────────────────────────
  const cancelPayPalSubscription = useCallback(async () => {
    setError(null)
    if (!user) return
    setLoading(true)
    try {
      const res  = await authFetch(`${API_BASE}/api/paypal/cancel-subscription`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not cancel PayPal subscription')
      await fetchStatus()
      return { success: true, message: data.message }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, authFetch, fetchStatus])

  // Cancel through whichever gateway the current subscription belongs to.
  const cancelSubscription = useCallback(() => {
    if (status?.gateway === 'lemonsqueezy') return cancelLemonSqueezySubscription()
    if (status?.gateway === 'paypal')       return cancelPayPalSubscription()
    return cancelRazorpaySubscription()
  }, [status, cancelLemonSqueezySubscription, cancelPayPalSubscription, cancelRazorpaySubscription])

  const refreshStatus = useCallback(() => fetchStatus(), [fetchStatus])

  const PAID_PLANS = ['starter', 'pro', 'agency']
  const isPaid     = PAID_PLANS.includes(user?.plan)
  const isStarter  = user?.plan === 'starter'
  const isPro      = user?.plan === 'pro'
  const isAgency   = user?.plan === 'agency'
  const renewsAt   = status?.subscription?.currentPeriodEnd
  const cancelling = status?.subscription?.cancelAtPeriodEnd === true

  return {
    startCheckout,                  // India (INR) via Razorpay
    startLemonSqueezyCheckout,      // International PRIMARY via Lemon Squeezy
    startPayPalCheckout,            // International BACKUP via PayPal
    cancelSubscription,             // Cancel via the subscription's own gateway
    cancelRazorpaySubscription,     // Cancel Razorpay subscription
    cancelLemonSqueezySubscription, // Cancel Lemon Squeezy subscription
    cancelPayPalSubscription,       // Cancel PayPal subscription
    fetchStatus: refreshStatus,
    loading,
    error,
    status,
    isPaid,
    isStarter,
    isPro,
    isAgency,
    renewsAt,
    cancelling,
  }
}

export default useSubscription
