// components/UpgradeUpsell.js
// Inline "go premium" card shown to FREE users after they download a result —
// used on every tool's download page. Renders nothing for paid users (or
// before mount, to avoid hydration mismatch).
//
// Reads the shared 'smpdf_use_count' counter (incremented by each tool page's
// own download handler) and resets it at the start of each calendar month, so
// once a free user crosses the threshold within the month the message becomes
// usage-specific ("You've used SmallPDF N times this month") instead of the
// generic pitch — a stronger, more truthful nudge toward upgrading.

import { useState, useEffect } from "react"
import Link from "next/link"
import { Zap, ArrowRight } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useIsIndia } from "../hooks/useIsIndia"

const STORAGE_KEY = "smpdf_use_count"
const MONTH_KEY = "smpdf_use_month"
const NUDGE_THRESHOLD = 3

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}`
}

export default function UpgradeUpsell({ className = "" }) {
  const [mounted, setMounted] = useState(false)
  const [useCount, setUseCount] = useState(0)
  const { user } = useAuth()
  const { isIndia } = useIsIndia()

  useEffect(() => {
    setMounted(true)
    try {
      const nowMonth = currentMonth()
      if (localStorage.getItem(MONTH_KEY) !== nowMonth) {
        // New calendar month — the counter restarts so the "this month" claim stays true.
        localStorage.setItem(MONTH_KEY, nowMonth)
        localStorage.setItem(STORAGE_KEY, "0")
        setUseCount(0)
      } else {
        setUseCount(parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10))
      }
    } catch {}
  }, [])

  const isPaidUser = ["starter", "pro", "agency", "enterprise"].includes(user?.plan)
  if (!mounted || isPaidUser) return null

  const headline = useCount >= NUDGE_THRESHOLD
    ? `You've used SmallPDF ${useCount} times this month — go unlimited`
    : "Unlimited files, bigger uploads, zero ads"

  return (
    <div className={`rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4 flex items-center gap-4 ${className}`}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-200">
        <Zap className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 leading-tight">
          {headline}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {isIndia
            ? "Starter plan · ₹399/mo · UPI · Card · Net Banking"
            : "Starter plan · $9/mo · Card · PayPal · Cancel anytime"}
        </p>
      </div>
      <Link
        href="/pricing"
        className="flex-shrink-0 inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-orange-200 whitespace-nowrap"
      >
        <Zap className="w-3.5 h-3.5" />
        Upgrade
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
