// components/PremiumModal.jsx
// Shown when a user exceeds the free-tier file size limit.
// Guests and free accounts have the same limits, so both are offered Pro.
// Guests also get a Sign in link, for people with a paid plan who are logged out.

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { X, Zap, ArrowRight, Crown } from 'lucide-react'
import { useTranslations } from '../lib/i18n'
import { toolLabel as getToolLabel } from '../lib/toolLabel'

export default function PremiumModal({
  isOpen,
  onClose,
  isGuest,
  totalLabel,   // e.g. "23 MB"
  limitLabel,   // e.g. "15 MB"
  toolName,
}) {
  const router = useRouter()
  const closeRef = useRef(null)
  const { t } = useTranslations()
  const toolLabel = getToolLabel(t, toolName)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const loginHref  = `/auth/login?redirect=${encodeURIComponent(router.asPath)}`

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-modal-title"
    >
      {/* Dim overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Close button */}
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label={t('limits.close')}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        {/* Gradient header */}
        <div className="bg-gradient-to-br from-red-500 to-orange-500 px-8 pt-8 pb-10 text-white text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 mb-4">
            <Crown className="w-7 h-7" />
          </div>
          <h2 id="premium-modal-title" className="text-2xl font-bold tracking-tight">
            {t('limits.upgradeTitle')}
          </h2>
          <p className="mt-2 text-red-100 text-sm leading-relaxed">
            {t('limits.size.body', { size: totalLabel, limit: limitLabel, tool: toolLabel })}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">

          {/* Size info bar */}
          <div className="flex items-center justify-between mb-6 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">{t('limits.size.yourFile')}</p>
              <p className="text-lg font-bold text-gray-900">{totalLabel}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">{t('limits.yourLimit')}</p>
              <p className="text-lg font-bold text-red-500">{limitLabel}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">{t('limits.proLimit')}</p>
              <p className="text-lg font-bold text-green-600">100 MB</p>
            </div>
          </div>

          {/* Pro feature bullets */}
          <ul className="space-y-2.5 mb-6">
            {[0, 1, 2, 3].map((n) => t(`limits.size.features.${n}`)).map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Zap className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                {feat}
              </li>
            ))}
          </ul>

          {/* CTA buttons */}
          <div className="flex flex-col gap-3">
            <Link
              href="/pricing"
              className="w-full text-center bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg text-sm"
            >
              {t('limits.viewPlans')}
            </Link>
            {isGuest ? (
              <>
                <Link
                  href={loginHref}
                  className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {t('limits.signIn')}
                </Link>
                <p className="text-center text-xs text-gray-400 mt-1">{t('limits.guestNote')}</p>
              </>
            ) : (
              <button
                onClick={onClose}
                className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm"
              >
                {t('limits.maybeLater')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}