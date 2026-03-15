// pages/account/subscription.js — Razorpay subscription management

import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import {
  Zap, Crown, Shield, Receipt,
  Loader2, AlertTriangle, CheckCircle, Clock,
  CreditCard, RefreshCw, XCircle,
} from 'lucide-react'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../hooks/useSubscription'
import { useTranslations } from '../../lib/i18n'
import { useRouter } from 'next/router'

function fmt(isoDate) {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtAmount(amount, currency = 'inr') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

function StatusBadge({ status, t }) {
  const map = {
    active:        { bg: 'bg-green-100', text: 'text-green-700',  labelKey: 'statusActive'    },
    authenticated: { bg: 'bg-blue-100',  text: 'text-blue-700',   labelKey: 'statusActive'    },
    created:       { bg: 'bg-amber-100', text: 'text-amber-700',  labelKey: 'statusPending'   },
    pending:       { bg: 'bg-amber-100', text: 'text-amber-700',  labelKey: 'statusPending'   },
    halted:        { bg: 'bg-red-100',   text: 'text-red-700',    labelKey: 'statusHalted'    },
    cancelled:     { bg: 'bg-gray-100',  text: 'text-gray-600',   labelKey: 'statusCancelled' },
    completed:     { bg: 'bg-gray-100',  text: 'text-gray-600',   labelKey: 'statusCompleted' },
  }
  const s = map[status] || map.cancelled
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      {t(`auth.subscription.${s.labelKey}`)}
    </span>
  )
}

export default function SubscriptionPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { status, loading, error, cancelSubscription, fetchStatus } = useSubscription()
  const { t } = useTranslations()
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelMsg,     setCancelMsg]     = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !user) {
      router.push('/auth/login?redirect=/account/subscription')
    }
  }, [user, router])

  if (!user) return null

  const sub      = status?.subscription
  const invoices = status?.invoices || []
  const isPaid   = ['starter', 'pro', 'agency'].includes(user.plan)

  const handleCancel = async () => {
    setCancelLoading(true)
    const result = await cancelSubscription()
    setCancelLoading(false)
    setCancelConfirm(false)
    if (result?.success) {
      setCancelMsg(result.message || t('auth.subscription.cancelAtPeriodEndSuffix'))
    }
  }

  return (
    <Layout title={t('auth.subscription.pageTitle')}>
      <Head>
        <title>{t('auth.subscription.pageTitle')}</title>
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{t('auth.subscription.heading')}</h1>
            <p className="text-gray-500 text-sm mt-1">{t('auth.subscription.subheading')}</p>
          </div>
          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            title={t('auth.subscription.refresh')}
          >
            <RefreshCw className="w-4 h-4" />
            {t('auth.subscription.refresh')}
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {cancelMsg && (
          <div className="mb-6 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {cancelMsg}
          </div>
        )}

        {/* Current plan card */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${isPaid ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPaid ? 'bg-red-500' : 'bg-gray-200'}`}>
                {isPaid ? <Zap className="w-6 h-6 text-white" /> : <Shield className="w-6 h-6 text-gray-500" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900 text-lg capitalize">{user.plan} {t('auth.subscription.planLabel')}</h2>
                  {sub && <StatusBadge status={sub.status} t={t} />}
                </div>
                {sub?.status === 'active' && sub.currentPeriodEnd && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {sub.cancelAtPeriodEnd
                      ? `${t('auth.subscription.cancelsOn')} ${fmt(sub.currentPeriodEnd)}`
                      : `${t('auth.subscription.renewsOn')} ${fmt(sub.currentPeriodEnd)}`}
                  </p>
                )}
                {!isPaid && (
                  <p className="text-sm text-gray-500 mt-0.5">{t('auth.subscription.freeTier')}</p>
                )}
              </div>
            </div>

            {!isPaid && (
              <Link
                href="/pricing"
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-md shadow-red-200"
              >
                <Crown className="w-4 h-4" />
                {t('auth.subscription.upgradeToPro')}
              </Link>
            )}
          </div>

          {sub?.cancelAtPeriodEnd && (
            <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {t('auth.subscription.cancelAtPeriodEndWarning')} {fmt(sub.currentPeriodEnd)}. {t('auth.subscription.cancelAtPeriodEndSuffix')}
            </div>
          )}
        </div>

        {/* Billing details */}
        {sub && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-500" />
              {t('auth.subscription.billingDetails')}
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t('auth.subscription.billingCycle')}</dt>
                <dd className="font-medium text-gray-800">
                  {sub.interval === 'yearly' ? t('auth.subscription.billingCycleYearly') : t('auth.subscription.billingCycleMonthly')}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t('auth.subscription.nextBillingDate')}</dt>
                <dd className="font-medium text-gray-800">
                  {sub.cancelAtPeriodEnd
                    ? <span className="text-red-500">{t('auth.subscription.cancelsOn')} {fmt(sub.currentPeriodEnd)}</span>
                    : fmt(sub.currentPeriodEnd)}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t('auth.subscription.paymentProcessor')}</dt>
                <dd className="font-medium text-gray-800">Razorpay</dd>
              </div>
            </dl>

            {isPaid && !sub.cancelAtPeriodEnd && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                {!cancelConfirm ? (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="text-sm text-red-500 hover:text-red-600 font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {t('auth.subscription.cancelSubscription')}
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-900 mb-1">{t('auth.subscription.cancelConfirmTitle')}</p>
                    <p className="text-xs text-red-700 mb-3">
                      {t('auth.subscription.cancelConfirmDesc')} {fmt(sub.currentPeriodEnd)}, {t('auth.subscription.cancelConfirmSuffix')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        disabled={cancelLoading}
                        className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                      >
                        {cancelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        {t('auth.subscription.cancelYes')}
                      </button>
                      <button
                        onClick={() => setCancelConfirm(false)}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-4 py-2 border border-gray-200 rounded-lg"
                      >
                        {t('auth.subscription.cancelKeep')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment history */}
        {invoices.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-gray-500" />
              {t('auth.subscription.paymentHistory')}
            </h3>
            <div className="space-y-3">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{fmtAmount(inv.amount, inv.currency)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(inv.date)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Free plan upsell */}
        {!isPaid && (
          <div className="mt-6 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl p-6 text-center">
            <Crown className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-1">{t('auth.subscription.upsellTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('auth.subscription.upsellDesc')}</p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              {t('auth.subscription.viewPlans')}
            </Link>
          </div>
        )}
      </div>
    </Layout>
  )
}