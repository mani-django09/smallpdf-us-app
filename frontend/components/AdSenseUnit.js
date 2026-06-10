// components/AdSenseUnit.js — Google AdSense display unit
//
// Two ad slots:
//   Header  (leaderboard) → 8004544994  smallpdf_header
//   Sidebar (rectangle)   → 1617102171  preview-page-sidebar
//
// Slot resolution:
//   adSlot prop passed  → looked up in SLOT_MAP (handles old AdX IDs too)
//   size="leaderboard"  → HEADER_SLOT
//   everything else     → SIDEBAR_SLOT
//
// Auto-hides when Google marks slot "unfilled" — no blank white space.

import { useEffect, useRef, useState } from "react"
import { useAuth } from "../context/AuthContext"

const PAID_PLANS = ["starter", "pro", "agency"]

const AD_CLIENT    = "ca-pub-6913093595582462"
const HEADER_SLOT  = "8004544994"  // smallpdf_header  — top-of-page leaderboard
const SIDEBAR_SLOT = "1617102171"  // preview-page-sidebar — sidebar rectangle

// Maps every slot ID in the codebase to a valid AdSense slot.
// Old AdX IDs (7489539676 = download sidebar) are redirected to SIDEBAR_SLOT.
const SLOT_MAP = {
  "8004544994": HEADER_SLOT,   // header
  "1617102171": SIDEBAR_SLOT,  // preview sidebar
  "7489539676": SIDEBAR_SLOT,  // download sidebar (old AdX ID) → sidebar slot
}

export default function AdSenseUnit({
  adSlot,      // slot ID from caller — resolved via SLOT_MAP
  size,        // "leaderboard" → header slot; other/undefined → sidebar slot
  style = {},
  className = "",
  label,       // unused, kept for caller compat
  targeting,   // unused, kept for caller compat
}) {
  const { user }  = useAuth()
  const pushedRef = useRef(false)
  const wrapRef   = useRef(null)
  const insRef    = useRef(null)
  const [hidden, setHidden] = useState(false)
  // Only render/activate the ad once it scrolls near the viewport (lazy-load).
  const [inView, setInView] = useState(false)

  const isPaid = user && PAID_PLANS.includes(user.plan)

  // Resolve the actual AdSense slot to render
  const resolvedSlot = adSlot
    ? (SLOT_MAP[adSlot] ?? SIDEBAR_SLOT)
    : (size === "leaderboard" ? HEADER_SLOT : SIDEBAR_SLOT)

  // Watch the wrapper; flip inView when it gets within 300px of the viewport.
  // Defers the ad request (and its layout/work) until the user is about to see it,
  // improving TBT/LCP and avoiding off-screen ad work on first paint.
  useEffect(() => {
    if (isPaid || inView) return
    const el = wrapRef.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") { setInView(true); return }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: "300px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isPaid, inView])

  // Once in view, queue the ad and watch for an unfilled slot to collapse blank space.
  useEffect(() => {
    if (isPaid || !inView) return
    if (pushedRef.current) return
    if (typeof window === "undefined") return

    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushedRef.current = true
    } catch (e) {
      // script not yet ready — queued push fires once loaded
    }

    // Collapse wrapper when Google marks slot unfilled → no blank space
    if (!insRef.current || typeof MutationObserver === "undefined") return
    const obs = new MutationObserver(() => {
      if (insRef.current?.dataset?.adStatus === "unfilled") {
        setHidden(true)
        obs.disconnect()
      }
    })
    obs.observe(insRef.current, { attributes: true, attributeFilter: ["data-ad-status"] })
    return () => obs.disconnect()
  }, [isPaid, inView])

  if (isPaid || hidden) return null

  // Reserve space BEFORE the ad loads to prevent CLS (Cumulative Layout Shift).
  // Without min-height the container grows from 0→250px when the ad renders,
  // pushing all content below it down — a major CLS contributor in field data.
  const isLeaderboard = resolvedSlot === HEADER_SLOT
  const reservedHeight = isLeaderboard ? 90 : 250  // leaderboard ~90px, rect ~250px

  return (
    <div
      ref={wrapRef}
      aria-label="Advertisement"
      className={className}
      style={{
        display: "block",
        overflow: "hidden",
        maxWidth: "100%",
        // Reserve the expected ad height so no layout shift occurs on load
        minHeight: `${reservedHeight}px`,
        ...style,
      }}
    >
      {/* <ins> is in SSR HTML — no DOM insertion at runtime (avoids rendering delta).
          AdSense populates it client-side once inView fires. */}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={resolvedSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
