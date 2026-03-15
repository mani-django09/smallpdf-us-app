// hooks/useSubscription.js — Razorpay checkout integration
//
// Usage:
//   const { startCheckout, cancelSubscription, status, isPaid, loading, error } = useSubscription()
//   <button onClick={() => startCheckout('pro')}>Upgrade to Pro</button>
//   <button onClick={cancelSubscription}>Cancel plan</button>

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'

// Dynamically loads Paddle.js v2 from CDN
function loadPaddleScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (window.Paddle) return resolve(true)
    const script = document.createElement('script')
    script.src     = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// Dynamically loads Razorpay checkout.js from CDN
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (document.getElementById('razorpay-checkout-js')) return resolve(true)

    const script = document.createElement('script')
    script.id  = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
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
  const fetchStatus = useCallback(async () => {
    if (!user) { setStatus(null); return }
    try {
      const res = await authFetch(`${API_BASE}/api/payments/subscription-status`)
      if (res.ok) setStatus(await res.json())
    } catch { /* network error — ignore */ }
  }, [user, authFetch])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // ── Start Razorpay Checkout ───────────────────────────────────────────────
  // plan: 'starter' | 'pro' | 'agency'
  // interval: 'monthly' | 'yearly'  (default: 'monthly')
  const startCheckout = useCallback(async (plan, interval = 'monthly') => {
    setError(null)
    if (!plan) { setError('No plan specified'); return }

    // Not logged in → redirect to signup
    if (!user) {
      router.push(`/auth/signup?plan=${plan}&interval=${interval}&redirect=/pricing`)
      return
    }

    setLoading(true)
    try {
      // 1. Load Razorpay checkout.js
      const loaded = await loadRazorpayScript()
      if (!loaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Could not load payment gateway. Please check your internet connection and try again.')
      }

      // 2. Create subscription on backend
      const res  = await authFetch(`${API_BASE}/api/payments/create-subscription`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create subscription')

      // 3. Open Razorpay checkout modal
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
            // 4. Verify payment signature on backend → activate plan
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

              // 5. Refresh user so plan is updated everywhere
              if (typeof refreshUser === 'function') await refreshUser()

              resolve()
              // 6. Navigate to success page
              router.push(`/payment/success?plan=${plan}`)
            } catch (err) {
              reject(err)
            }
          },

          modal: {
            ondismiss: () => {
              resolve()
              setLoading(false)
            },
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

  // ── Start International Checkout (USD, Razorpay Order + PayPal) ──────────
  // plan: 'starter' | 'pro' | 'agency'
  // interval: 'monthly' | 'yearly'
  // Creates a one-time Razorpay Order in USD → PayPal appears as payment option
  const startIntlCheckout = useCallback(async (plan, interval = 'monthly') => {
    setError(null)
    if (!plan) { setError('No plan specified'); return }

    if (!user) {
      router.push(`/auth/signup?plan=${plan}&interval=${interval}&redirect=/pricing&intl=1`)
      return
    }

    setLoading(true)
    try {
      const loaded = await loadRazorpayScript()
      if (!loaded || typeof window.Razorpay === 'undefined') {
        throw new Error('Could not load payment gateway. Please check your internet connection.')
      }

      // 1. Create international order (USD) on backend
      const res  = await authFetch(`${API_BASE}/api/payments/create-intl-order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create order')

      // 2. Open Razorpay checkout — PayPal will appear as payment option for USD orders
      await new Promise((resolve, reject) => {
        const options = {
          key:       data.key,
          amount:    data.amount,
          currency:  data.currency,   // 'USD'
          order_id:  data.orderId,
          name:      'SmallPDF.us',
          description: data.label,
          image:     `${window.location.origin}/logo.png`,
          prefill:   data.prefill || {},
          theme:     { color: '#ef4444' },

          handler: async function (response) {
            try {
              // 3. Verify payment signature on backend → activate plan
              const verifyRes = await authFetch(`${API_BASE}/api/payments/verify-intl-payment`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                  plan,
                  interval,
                }),
              })
              const verifyData = await verifyRes.json()
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed')

              if (typeof refreshUser === 'function') await refreshUser()
              resolve()
              router.push(`/payment/success?plan=${plan}`)
            } catch (err) {
              reject(err)
            }
          },

          modal: {
            ondismiss: () => {
              resolve()
              setLoading(false)
            },
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

  // ── Start Paddle Checkout (International — USD, auto-recurring) ──────────
  // plan: 'starter' | 'pro' | 'agency'
  // interval: 'monthly' | 'yearly'
  // Opens Paddle overlay → user pays → webhook + verify-transaction activates plan
  const startPaddleCheckout = useCallback(async (plan, interval = 'monthly') => {
    setError(null)
    if (!plan) { setError('No plan specified'); return }

    if (!user) {
      router.push(`/auth/signup?plan=${plan}&interval=${interval}&redirect=/pricing&gateway=paddle`)
      return
    }

    setLoading(true)
    try {
      // 1. Load Paddle.js v2
      const loaded = await loadPaddleScript()
      if (!loaded || typeof window.Paddle === 'undefined') {
        throw new Error('Could not load Paddle checkout. Please check your internet connection.')
      }

      // 2. Fetch price IDs + client token from backend
      const pricesRes = await authFetch(`${API_BASE}/api/paddle/prices`)
      const prices    = await pricesRes.json()
      if (!pricesRes.ok) throw new Error(prices.error || 'Failed to load Paddle prices')

      const priceId = prices[plan]?.[interval]
      if (!priceId) throw new Error(`Paddle price not configured for ${plan} ${interval}. Please contact support.`)

      const clientToken = prices.clientToken
      if (!clientToken) throw new Error('Paddle client token not configured. Please contact support.')

      // 3. Initialize Paddle with client token + event callback
      window.Paddle.Initialize({
        token: clientToken,
        eventCallback: async function(data) {
          if (data.name === 'checkout.completed') {
            try {
              // 4. Immediately verify with backend to activate plan
              const txnId    = data.data?.transaction_id
              const verifyRes = await authFetch(`${API_BASE}/api/paddle/verify-transaction`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ transactionId: txnId, plan, interval }),
              })
              const verifyData = await verifyRes.json()
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Plan activation failed')

              // 5. Refresh user so plan shows everywhere
              if (typeof refreshUser === 'function') await refreshUser()
              setLoading(false)
              router.push(`/payment/success?plan=${plan}&gateway=paddle`)
            } catch (err) {
              setError(err.message)
              setLoading(false)
            }
          }
          if (data.name === 'checkout.closed') {
            setLoading(false)
          }
          if (data.name === 'checkout.error') {
            setError(data.data?.error?.detail || 'Payment failed. Please try again.')
            setLoading(false)
          }
        },
      })

      // 4. Open Paddle overlay checkout
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: user.email },
        customData: {
          userId:   String(user.id),
          plan,
          interval,
        },
        settings: {
          displayMode: 'overlay',
          theme:       'light',
          locale:      'en',
          successUrl:  `${window.location.origin}/payment/success?plan=${plan}&gateway=paddle`,
        },
      })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [user, authFetch, refreshUser, router])

  // ── Cancel Paddle subscription (at period end) ─────────────────────────────
  const cancelPaddleSubscription = useCallback(async () => {
    setError(null)
    if (!user) return
    setLoading(true)
    try {
      const res  = await authFetch(`${API_BASE}/api/paddle/cancel-subscription`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not cancel Paddle subscription')
      await fetchStatus()
      return { success: true, message: data.message }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, authFetch, fetchStatus])

  // ── Cancel subscription (at period end) ───────────────────────────────────
  const cancelSubscription = useCallback(async () => {
    setError(null)
    if (!user) return
    setLoading(true)
    try {
      const res  = await authFetch(`${API_BASE}/api/payments/cancel-subscription`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not cancel subscription')
      await fetchStatus() // refresh subscription status
      return { success: true, message: data.message }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, authFetch, fetchStatus])

  // ── Refresh after checkout ────────────────────────────────────────────────
  const refreshStatus = useCallback(() => fetchStatus(), [fetchStatus])

  const PAID_PLANS = ['starter', 'pro', 'agency']
  const isPaid     = PAID_PLANS.includes(user?.plan)
  const isStarter  = user?.plan === 'starter'
  const isPro      = user?.plan === 'pro'
  const isAgency   = user?.plan === 'agency'
  const renewsAt   = status?.subscription?.currentPeriodEnd
  const cancelling = status?.subscription?.cancelAtPeriodEnd === true

  return {
    startCheckout,
    startIntlCheckout,
    startPaddleCheckout,
    cancelSubscription,
    cancelPaddleSubscription,
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
