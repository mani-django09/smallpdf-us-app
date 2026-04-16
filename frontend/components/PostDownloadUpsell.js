// components/PostDownloadUpsell.js
// Clean, professional post-download upsell modal.
// Shows after 2nd download onwards. India-aware pricing.
//
// Usage:
//   const { triggerUpsell, UpsellModal } = usePostDownloadUpsell('tool-name')
//   triggerUpsell()   // call after download
//   {UpsellModal}     // place in JSX

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { X, Check, Zap, ArrowRight, Shield, Clock, FileStack } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIsIndia } from '../hooks/useIsIndia'

const STORAGE_KEY = 'smpdf_use_count'

// ── Modal ──────────────────────────────────────────────────────────────────
function UpsellModalUI({ isOpen, onClose, isIndia }) {
  if (!isOpen) return null

  const starterPrice = isIndia ? '₹399' : '$9'
  const proPrice     = isIndia ? '₹799' : '$19'
  const payment      = isIndia ? 'UPI · Card · Net Banking' : 'Card · PayPal'

  const proFeatures = [
    { icon: FileStack, text: 'Unlimited file size — all tools' },
    { icon: Zap,       text: 'Priority processing queue' },
    { icon: Clock,     text: 'Files retained for 48 hours' },
    { icon: Shield,    text: 'Zero ads, ever' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden z-10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        {/* Top section — success + headline */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-8 pt-8 pb-10 text-white text-center">
          {/* Success badge */}
          <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-4 py-1.5 text-green-400 text-xs font-semibold mb-5">
            <Check className="w-3.5 h-3.5" />
            File downloaded successfully
          </div>

          <h2 className="text-2xl font-extrabold text-white leading-tight mb-2">
            Upgrade & work<br />without limits
          </h2>
          <p className="text-slate-400 text-sm">
            {isIndia
              ? `Pro plan from ${proPrice}/mo — less than a coffee ☕`
              : `Pro plan from ${proPrice}/mo — cancel anytime`}
          </p>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            {proFeatures.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-left">
                <Icon className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                <span className="text-xs text-slate-300 leading-snug">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom section — pricing + CTA */}
        <div className="px-8 py-6 bg-white">
          {/* Price row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Pro Plan</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-extrabold text-slate-900">{proPrice}</span>
                <span className="text-slate-400 text-sm mb-1">/month</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Starter from <span className="font-semibold text-slate-600">{starterPrice}/mo</span>
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl px-3 py-2 text-center">
              <p className="text-xs text-orange-600 font-bold">SAVE 17%</p>
              <p className="text-xs text-orange-500">yearly plan</p>
            </div>
          </div>

          {/* CTA button */}
          <Link
            href="/pricing"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-orange-200 text-sm mb-3"
          >
            <Zap className="w-4 h-4" />
            View Plans & Upgrade
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Trust row */}
          <div className="flex justify-center gap-4 mb-4">
            {['7-day refund', 'Cancel anytime', payment].map(t => (
              <span key={t} className="flex items-center gap-1 text-xs text-slate-400">
                <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                {t}
              </span>
            ))}
          </div>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            Continue with free plan
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function usePostDownloadUpsell(toolName) {
  const { user }     = useAuth()
  const { isIndia }  = useIsIndia()
  const [open, setOpen] = useState(false)

  const isPaid = ['starter', 'pro', 'agency', 'enterprise'].includes(user?.plan)

  const triggerUpsell = useCallback(() => {
    if (isPaid) return
    // Only show from 2nd download onwards
    try {
      const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
      if (count < 1) return
    } catch {}
    setTimeout(() => setOpen(true), 800)
  }, [isPaid])

  const closeUpsell = useCallback(() => setOpen(false), [])

  const UpsellModal = (
    <UpsellModalUI isOpen={open} onClose={closeUpsell} isIndia={isIndia} />
  )

  return { triggerUpsell, UpsellModal }
}

export default usePostDownloadUpsell
