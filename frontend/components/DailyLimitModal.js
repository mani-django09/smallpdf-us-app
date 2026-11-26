// components/DailyLimitModal.js
// Shown when a free/guest user hits the daily conversion limit.
// Guests and free accounts get the same 5 uses/day, so both see the same
// "Upgrade to Pro for unlimited" message (signing up no longer adds uses).

import { useEffect, useState } from "react"
import Link from "next/link"
import { Zap, Clock, ArrowRight, X, Flame } from "lucide-react"
import { useTranslations } from "../lib/i18n"
import { useAuth } from "../context/AuthContext"

// Starter = the cheapest plan with no daily cap, so it is what we offer here.
// Prices MUST match pages/pricing.js (INR_PRICES / USD_PRICES_ID / IDR_PRICES /
// PLANS) — the region is detected the same way (browser timezone), so the price
// shown here is the price the pricing page's checkout will charge.
const STARTER_PRICE = {
  india:     { main: "₹399",  perDay: "₹13" },
  indonesia: { main: "$5",    local: "≈ Rp 79.000", perDay: "Rp 2.600" },
  default:   { main: "$9",    perDay: "$0.30" },
}

function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (["Asia/Kolkata", "Asia/Calcutta"].includes(tz)) return "india"
    if (["Asia/Jakarta", "Asia/Pontianak", "Asia/Makassar", "Asia/Jayapura"].includes(tz)) return "indonesia"
  } catch { /* fall through */ }
  return "default"
}

export default function DailyLimitModal({ isOpen, onClose, isGuest = false, limit = 5, resetHr = "00:00 UTC", toolName = "" }) {
  const { t } = useTranslations()
  const { user } = useAuth()
  const [region, setRegion] = useState("default")
  useEffect(() => { setRegion(detectRegion()) }, [])
  if (!isOpen) return null

  // The API falls back to the English words "midnight UTC"
  const resetTime = resetHr === "midnight UTC" ? "00:00 UTC" : resetHr

  const price = STARTER_PRICE[region]
  // Logged-in users go straight to checkout (pricing page autostart picks the
  // right gateway for their region); guests sign up first and are sent back to
  // the same autostart URL. src=limit lets us count these in the nginx log.
  const resume = "/pricing?plan=starter&interval=monthly&autostart=1&src=limit"
  const checkoutHref = user
    ? resume
    : `/auth/signup?plan=starter&interval=monthly&redirect=${encodeURIComponent(resume)}`

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
          aria-label={t("limits.close")}
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
                {t("limits.daily.title")}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t("limits.daily.resets", { time: resetTime })}
              </p>
            </div>
          </div>

          {/* Body */}
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            {t("limits.daily.body", { limit })}
          </p>

          {/* Starter offer: price in the visitor's region + what it removes */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 mb-5 border border-orange-100">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <p className="text-sm font-extrabold text-gray-900">Starter</p>
              <p className="text-right">
                <span className="text-2xl font-extrabold text-gray-900">{price.main}</span>
                <span className="text-xs text-gray-500">{t("limits.daily.perMonth")}</span>
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-3 text-right">
              {price.local ? `${price.local} · ` : ""}{t("limits.daily.perDay", { price: price.perDay })}
            </p>
            <ul className="space-y-1.5">
              {[t("limits.daily.features.0"), t("limits.daily.features.3"), t("limits.daily.cancelAnytime")].map((f, i) => (
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
              href={checkoutHref}
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-orange-200 text-sm"
            >
              <Zap className="w-4 h-4" />
              {t("limits.daily.cta", { price: price.main })}
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/pricing?src=limit"
              onClick={onClose}
              className="block w-full text-center text-xs font-semibold text-orange-600 hover:text-orange-700 py-1"
            >
              {t("limits.daily.allPlans")}
            </Link>

            <button
              onClick={onClose}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              {t("limits.daily.comeBack")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
