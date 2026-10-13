// pages/payment/success.js — shown after Razorpay checkout completes

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { CheckCircle, Zap, ArrowRight, Loader2, Receipt, Building2, FileText } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTranslations } from '../../lib/i18n'
import { getPageMessages } from '../../lib/i18nLoader'

const PLAN_ICONS = {
  starter: FileText,
  pro:     Zap,
  agency:  Building2,
}

const PLAN_STYLES = {
  starter: { color: 'bg-blue-500',   shadow: 'shadow-blue-200'  },
  pro:     { color: 'bg-red-500',    shadow: 'shadow-red-200'   },
  agency:  { color: 'bg-purple-500', shadow: 'shadow-purple-200'},
}

export default function PaymentSuccess() {
  const router = useRouter()
  const { user, refreshUser, authFetch } = useAuth()
  const { t } = useTranslations()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!router.isReady) return

    const activate = async () => {
      try {
        const { subscription_id, gateway, plan, interval } = router.query

        // PayPal redirect — verify subscription with backend before refreshing user
        if (gateway === 'paypal' && subscription_id) {
          const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
            : `${window.location.protocol}//${window.location.hostname}`

          await authFetch(`${API_BASE}/api/paypal/verify-subscription`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ subscriptionId: subscription_id, plan, interval }),
          })
        }

        if (typeof refreshUser === 'function') {
          let fresh = await refreshUser()
          // Lemon Squeezy activates the plan only via its webhook, which can
          // land after this redirect. A token minted before that still says
          // plan "free", and the upload limiters read the plan off the token,
          // so keep refreshing (up to ~20s) until the paid plan shows up.
          for (let i = 0; i < 10 && gateway === 'lemonsqueezy' && fresh && fresh.plan === 'free'; i++) {
            await new Promise((r) => setTimeout(r, 2000))
            fresh = await refreshUser()
          }
        }
      } catch { /* ignore — plan may already be active via webhook */ }
      finally { setReady(true) }
    }

    const timer = setTimeout(activate, 800)
    return () => clearTimeout(timer)
  }, [router.isReady, router.query]) // eslint-disable-line

  const planKey   = router.query.plan || user?.plan || 'starter'
  const validKey  = ['starter', 'pro', 'agency'].includes(planKey) ? planKey : 'starter'
  const Icon      = PLAN_ICONS[validKey]
  const style     = PLAN_STYLES[validKey]
  const firstName = user?.name?.split(' ')[0]

  // Features come from translation JSON
  const features = (() => {
    const items = t(`auth.paymentSuccess.features.${validKey}`)
    if (Array.isArray(items)) return items
    // fallback: dot-notation index loop
    return [0, 1, 2, 3].map(i => t(`auth.paymentSuccess.features.${validKey}.${i}`)).filter(Boolean)
  })()

  const planLabel = validKey.charAt(0).toUpperCase() + validKey.slice(1)

  return (
    <>
      <Head>
        <title>{t('auth.paymentSuccess.pageTitlePrefix')} {planLabel} {t('auth.paymentSuccess.pageTitleSuffix')}</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-10 text-center">
          {!ready ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
              <p className="text-gray-400 text-sm">{t('auth.paymentSuccess.activating')}</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className={`w-20 h-20 rounded-full ${style.color} ${style.shadow} shadow-lg flex items-center justify-center`}>
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
              </div>

              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4 ${style.color} text-white`}>
                <Icon className="w-3.5 h-3.5" />
                {planLabel} {t('auth.paymentSuccess.planActive')}
              </div>

              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
                {t('auth.paymentSuccess.greeting')}{firstName ? `, ${firstName}` : ''}! {t('auth.paymentSuccess.greetingEmoji')}
              </h1>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                {t('auth.paymentSuccess.subtitle').replace('{plan}', planLabel)}
              </p>

              <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left space-y-3">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="/"
                  className={`inline-flex items-center justify-center gap-2 ${style.color} hover:opacity-90 text-white font-bold px-6 py-3.5 rounded-xl transition-opacity text-sm shadow-lg ${style.shadow}`}
                >
                  {t('auth.paymentSuccess.startBtn')} <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/account/subscription"
                  className="inline-flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  {t('auth.paymentSuccess.manageBtn')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["auth"]) },
    revalidate: 86400,
  }
}
