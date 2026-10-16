// AdSenseUnit — every ad on the site is a Google Ad Manager (AdX) display unit
// served through GPT. (The file name is historical: there is NO AdSense code
// left — no adsbygoogle loader, no <ins class="adsbygoogle"> — as of 2026-10-16.)
// Network: /23028515350
// gpt.js is loaded once in _app.js (GPT_SIDEBAR_ADS_ENABLED there); out-of-page
// formats (Interstitial / Anchor) stay off, see GPT_OUT_OF_PAGE_ENABLED in _app.js.
//
// Props (unchanged, so every page works as before):
//   size="leaderboard"  → /23028515350/Anchor, 728x90 / 750x200 / 468x60 on desktop, 320x50 / 320x100 on phones
//   default             → /23028515350/300x250 (300x250 rectangle)
//   size="rectangle2"   → /23028515350/Interstitial unit used as a second 300x250
//   adSlot, label       → accepted for backward-compat, not used by AdX
//
// IMPORTANT: the slot's DOM id comes from React useId() so the server-rendered
// id matches the client-rendered id (no hydration mismatch / "Application error").

import { useEffect, useRef, useState, useId } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'
import { useTranslations } from '../lib/i18n'

const PAID_PLANS = ['starter', 'pro', 'agency', 'enterprise']

// Only ONE leaderboard per page: AdX has a single in-page leaderboard unit, and
// requesting the same unit twice on a page competes for the same demand and
// rarely double-fills. Later size="leaderboard" instances on the same page
// (e.g. the mid-content one on download pages) render nothing instead of an
// empty frame. The claim resets automatically on navigation (path change).
const MAX_LEADERBOARDS_PER_PAGE = 1
let leaderboardClaim = { path: null, claimed: 0 }

// GAM (AdX) ad unit paths.
const UNIT_PATHS = {
  leaderboard: '/23028515350/Anchor',
  rectangle:   '/23028515350/300x250',
  // Second, genuinely distinct rectangle unit — for a page's SECOND 300x250 slot.
  // Requesting the same 'rectangle' path twice on one page competes for the same
  // demand and rarely double-fills; this unit (originally sized for interstitial
  // creatives, but also serves 300x250) gives real separate inventory instead.
  rectangle2:  '/23028515350/Interstitial',
}

// Multi-size requests: GPT serves the highest bid among the sizes, so every extra
// size is one more pool of demand — this matters for India/Indonesia traffic, where
// AdX often has no bid for the 750x200/728x90 pair alone (2026-10-16: header ad was
// empty for visitors there). Nothing wider than the 896px header container (a 970
// size would be clipped). Phones: 320x50 plus the taller 320x100.
const LEADERBOARD_SIZES_DESKTOP = [[728, 90], [750, 200], [468, 60]]
const LEADERBOARD_SIZES_MOBILE  = [[320, 50], [320, 100]]

// Switch for all GPT ads on the site. Keep in sync with GPT_SIDEBAR_ADS_ENABLED
// in _app.js (that flag also controls whether gpt.js loads at all).
const GPT_ADS_ENABLED = true

export default function AdSenseUnit({ adSlot, size, className = '', label, style = {}, targeting }) {
  const { user } = useAuth()
  const isPaid   = user && PAID_PLANS.includes(user.plan)
  const router   = useRouter()
  const { t }    = useTranslations()
  const adLabel  = t('ads.label') === 'ads.label' ? 'Advertisement' : t('ads.label')

  const [inView, setInView] = useState(false)
  // Viewport is only known after mount; the leaderboard's size list depends on it,
  // so the slot must not be defined before then.
  const [isMobileView, setIsMobileView] = useState(false)
  const [viewportKnown, setViewportKnown] = useState(false)
  // Set when GPT reports the slot rendered empty, so the reserved box collapses.
  const [collapsed, setCollapsed] = useState(false)
  const wrapRef  = useRef(null)
  const slotRef  = useRef(null)
  const defined  = useRef(false)

  const isLeaderboard = size === 'leaderboard'
  const isRectangle2  = size === 'rectangle2'
  const path = isLeaderboard ? UNIT_PATHS.leaderboard : isRectangle2 ? UNIT_PATHS.rectangle2 : UNIT_PATHS.rectangle

  // Claim the one leaderboard slot per page. Done in an effect (not a render-time
  // side effect) so it is unaffected by React 18 Strict Mode's double render in
  // dev. Effects fire in mount order, so the first leaderboard on the page wins.
  const [isPrimaryLeaderboard, setIsPrimaryLeaderboard] = useState(false)
  useEffect(() => {
    if (!isLeaderboard) return
    if (leaderboardClaim.path !== router.asPath) {
      leaderboardClaim = { path: router.asPath, claimed: 0 }
    }
    if (leaderboardClaim.claimed >= MAX_LEADERBOARDS_PER_PAGE) return
    leaderboardClaim.claimed += 1
    setIsPrimaryLeaderboard(true)
    // Release the claim on unmount so a leaderboard that remounts on the same
    // path (a page swapping between a loading state and its real layout) shows again.
    return () => {
      if (leaderboardClaim.path === router.asPath && leaderboardClaim.claimed > 0) leaderboardClaim.claimed -= 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hydration-safe unique div id (same on server + client). Strip ":" so the
  // id is valid for document.getElementById / googletag.display.
  const rawId = useId()
  const divId = `gpt-${isLeaderboard ? 'leaderboard' : '300x250'}-${rawId.replace(/:/g, '')}`

  useEffect(() => {
    setIsMobileView(window.innerWidth < 768)
    setViewportKnown(true)
  }, [])

  // ── Lazy load: only request the ad once it is near the viewport ─────────────
  // isPrimaryLeaderboard is a dependency because the wrapper (and wrapRef) of a
  // leaderboard only mounts after it wins the claim; without it the observer is
  // never created and the ad never loads.
  useEffect(() => {
    if (isPaid || inView) return
    const el = wrapRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some(e => e.isIntersecting)) { setInView(true); io.disconnect() } },
      { rootMargin: '400px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isPaid, inView, isPrimaryLeaderboard])

  // ── Define + display the GPT slot once in view ───────────────────────────────
  useEffect(() => {
    if (isPaid || !GPT_ADS_ENABLED || !inView || defined.current) return
    if (isLeaderboard && (!isPrimaryLeaderboard || !viewportKnown)) return
    if (typeof window === 'undefined') return
    defined.current = true

    const adSizes = isLeaderboard
      ? (isMobileView ? LEADERBOARD_SIZES_MOBILE : LEADERBOARD_SIZES_DESKTOP)
      : [300, 250]
    let onRendered = null

    window.googletag = window.googletag || { cmd: [] }
    window.googletag.cmd.push(() => {
      try {
        const slot = window.googletag.defineSlot(path, adSizes, divId)
        if (!slot) return
        slot.addService(window.googletag.pubads())
        slot.setTargeting('pos', isLeaderboard ? 'leaderboard' : 'rectangle')
        if (targeting && typeof targeting === 'object') {
          Object.entries(targeting).forEach(([k, v]) => slot.setTargeting(k, String(v)))
        }
        slotRef.current = slot
        if (isLeaderboard) {
          // Collapse the reserved box when nothing fills, so no blank band is left.
          onRendered = (e) => { if (e.slot === slot && e.isEmpty) setCollapsed(true) }
          window.googletag.pubads().addEventListener('slotRenderEnded', onRendered)
        }
        window.googletag.display(divId)
      } catch (e) {
        // GPT not ready / blocked — fail silently, never break the page
      }
    })

    return () => {
      const s = slotRef.current
      if (s && window.googletag?.cmd) {
        window.googletag.cmd.push(() => {
          try {
            if (onRendered) window.googletag.pubads().removeEventListener('slotRenderEnded', onRendered)
            window.googletag.destroySlots([s])
          } catch {}
        })
        slotRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaid, isLeaderboard, isPrimaryLeaderboard, inView, viewportKnown])

  if (isPaid || !GPT_ADS_ENABLED) return null
  if (isLeaderboard && !isPrimaryLeaderboard) return null

  if (isLeaderboard) {
    // Reserve the banner height (above the fold → layout shift is real), centre
    // whatever size AdX returns, and collapse if the slot comes back empty.
    return (
      <div
        ref={wrapRef}
        aria-label={adLabel}
        className={className}
        style={{
          display:        'flex',
          justifyContent: 'center',
          alignItems:     'center',
          overflow:       'hidden',
          maxWidth:       '100%',
          minHeight:      collapsed ? 0 : (isMobileView ? 50 : 90),
          ...style,
        }}
      >
        <div id={divId} />
      </div>
    )
  }

  // Reserve the 300x250 rectangle creative so a filled ad never shifts layout.
  const w = 300
  const h = 250

  return (
    <div
      ref={wrapRef}
      aria-label={adLabel}
      className={className}
      style={{
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'center',
        overflow:       'hidden',
        maxWidth:       '100%',
        minHeight:      h,
        ...style,
      }}
    >
      <div id={divId} style={{ width: w, height: h, maxWidth: '100%' }} />
    </div>
  )
}
