// components/DailyLimitModal.js
// Shown when a free/guest user hits the daily conversion limit.
// Guests and free accounts get the same 5 uses/day, so both see the same
// "Upgrade to Pro for unlimited" message (signing up no longer adds uses).

import Link from "next/link"
import { Zap, Clock, ArrowRight, X, Flame } from "lucide-react"

export default function DailyLimitModal({ isOpen, onClose, isGuest = false, limit = 5, resetHr = "midnight UTC", toolName = "" }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-orange-400 via-red-500 to-pink-500" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        <div className="p-6">
          {/* Icon + heading */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-200 flex-shrink-0">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-gray-900 leading-tight">
                Daily limit reached
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Resets at {resetHr}
              </p>
            </div>
          </div>

          {/* Body */}
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            You've used your <span className="font-bold text-gray-900">{limit} free conversions</span> for today.{" "}
            Upgrade to <span className="font-bold text-orange-600">Pro</span> for{" "}
            <span className="font-bold text-gray-900">unlimited</span> conversions with no daily caps.
          </p>

          {/* Plan benefits */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 mb-5 border border-orange-100">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2.5">Pro plan includes</p>
            <ul className="space-y-1.5">
              {[
                "Unlimited conversions — no daily cap",
                "Files up to 200 MB (vs 5-10 MB free)",
                "Up to 20 files per batch",
                "No advertisements",
                "Priority processing",
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-700">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* CTAs */}
          <div className="space-y-2.5">
            <Link
              href="/pricing"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-orange-200 text-sm"
            >
              <Zap className="w-4 h-4" />
              Upgrade to Pro
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              onClick={onClose}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              Come back tomorrow
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
