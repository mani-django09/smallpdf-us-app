// components/UsageNudge.js
// Tracks how many times a free user has used any tool.
// After N uses (default 3), shows a sticky toast nudging them to upgrade.
// India-aware pricing.
//
// Usage in any tool page:
//   import { useUsageNudge } from '../components/UsageNudge'
//
//   const { recordUse, NudgeToast } = useUsageNudge()
//   // After processing completes:
//   recordUse()
//   // In JSX:
//   {NudgeToast}

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { X, Zap, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIsIndia } from '../hooks/useIsIndia'

const STORAGE_KEY   = 'smpdf_use_count'
const SESSION_KEY   = 'smpdf_nudge_shown'   // once per session
const TRIGGER_AT    = 3                      // show after 3rd use

// ── Toast UI ───────────────────────────────────────────────────────────────
function NudgeToastUI({ visible, onClose, isIndia, useCount }) {
  const [show, setShow] = useState(false)

  // Animate in
  useEffect(() => {
    if (visible) setTimeout(() => setShow(true), 50)
    else setShow(false)
  }, [visible])

  if (!visible) return null

  const price   = isIndia ? '₹399/mo' : '$9/mo'
  const payment = isIndia ? 'UPI · Card · NetBanking' : 'Card · PayPal'

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-md transition-all duration-500 ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar — visual urgency */}
        <div className="h-1 bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-1000"
            style={{ width: `${Math.min((useCount / 10) * 100, 100)}%` }}
          />
        </div>

        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">
              You've used SmallPDF {useCount} times! 🔥
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              Go Pro for unlimited files, bigger sizes & no ads —{' '}
              <span className="text-orange-400 font-semibold">{price}</span>
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <Link
                href="/pricing"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-red-500/30"
              >
                <Zap className="w-3 h-3" /> Upgrade Now
              </Link>
              <span className="text-xs text-gray-500">{payment}</span>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5"
          >
            <X className="w-3 h-3 text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useUsageNudge() {
  const { user }          = useAuth()
  const { isIndia }       = useIsIndia()
  const [visible, setVisible] = useState(false)
  const [useCount, setCount]  = useState(0)

  const isPaid = ['starter', 'pro', 'agency', 'enterprise'].includes(user?.plan)

  // Load count on mount
  useEffect(() => {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
      setCount(n)
    } catch {}
  }, [])

  // Record a tool use — call after successful processing
  const recordUse = useCallback(() => {
    if (isPaid) return   // don't count for paid users

    try {
      const prev = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
      const next = prev + 1
      localStorage.setItem(STORAGE_KEY, String(next))
      setCount(next)

      // Show nudge at trigger count, once per session
      if (next >= TRIGGER_AT && !sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1')
        setTimeout(() => setVisible(true), 1200)  // slight delay after download
      }
    } catch {}
  }, [isPaid])

  const closeNudge = useCallback(() => setVisible(false), [])

  const NudgeToast = (
    <NudgeToastUI
      visible={visible}
      onClose={closeNudge}
      isIndia={isIndia}
      useCount={useCount}
    />
  )

  return { recordUse, NudgeToast, useCount }
}

export default useUsageNudge
