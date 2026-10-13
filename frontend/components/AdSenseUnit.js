// AdSenseUnit — leaderboard = direct AdSense "Header Ad" unit; everything
// else (rectangle/rectangle2, the sidebar units) = Google Ad Manager (AdX)
// display unit via GPT.
// Network: /23028515350
// GPT script + out-of-page slots (Interstitial, Anchor, Side Rails) load in _app.js.
// The AdSense loader script (adsbygoogle.js) loads once site-wide in _document.js.
//
// Props (kept identical to the old AdSense version so every page works unchanged):
//   size="leaderboard"  → real AdSense unit, client ca-pub-6913093595582462,
//                         slot 8004544994 ("smallpdf_header"), responsive
//   default             → /23028515350/300x250 (300×250 rectangle, AdX)
//   adSlot, label       → accepted for backward-compat, not required by AdX
//
// IMPORTANT: the slot's DOM id comes from React useId() so the server-rendered
// id matches the client-rendered id (no hydration mismatch / "Application error").

import { useEffect, useRef, useState, useId } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'
import { useTranslations } from '../lib/i18n'

const PAID_PLANS = ['starter', 'pro', 'agency', 'enterprise']

const ADSENSE_CLIENT = 'ca-pub-6913093595582462'
const ADSENSE_HEADER_SLOT = '8004544994'

// Some pages render more than one size="leaderboard" AdSenseUnit (a "Header Ad"
// at the top plus a mid-content one on the download pages and blog posts).
// They all point at the same real ADSENSE_HEADER_SLOT, which AdSense allows —
// the same ad unit code may appear several times on a page. This used to be
// capped at ONE per page, which left the mid-content box on 20 download pages
// as an empty "Advertisement" frame. The module-level tracker now only guards
// against runaway duplicates (MAX_LEADERBOARDS_PER_PAGE). Resets automatically
// on navigation (path change).
const MAX_LEADERBOARDS_PER_PAGE = 2
let leaderboardClaim = { path: null, claimed: 0 }

// GAM (AdX) ad unit paths — sidebar rectangle units only (leaderboard now
// renders real AdSense instead, see ADSENSE_HEADER_SLOT above).
const UNIT_PATHS = {
  rectangle:   '/23028515350/300x250',
  // Second, genuinely distinct rectangle unit — for a page's SECOND 300x250 slot.
  // Requesting the same 'rectangle' path twice on one page competes for the same
  // demand and rarely double-fills; this unit (originally sized for interstitial
  // creatives, but also serves 300x250) gives real separate inventory instead.
  rectangle2:  '/23028515350/Interstitial',
}

// AdX is mostly paused in favor of direct AdSense — see _app.js. Only the
// sidebar rectangle units (size="rectangle" default, or "rectangle2") go
// through AdX/GPT; the leaderboard/header banner now renders real AdSense
// unconditionally (see the isLeaderboard branch below). Keep in sync with
// GPT_SIDEBAR_ADS_ENABLED in _app.js.
const GPT_SIDEBAR_ADS_ENABLED = true

export default function AdSenseUnit({ adSlot, size, className = '', label, style = {}, targeting }) {
  const { user } = useAuth()
  const isPaid   = user && PAID_PLANS.includes(user.plan)
  const router   = useRouter()
  const { t }    = useTranslations()
  const adLabel  = t('ads.label') === 'ads.label' ? 'Advertisement' : t('ads.label')

  const [inView, setInView] = useState(false)
  // Track viewport after mount so the reserved box matches the actual mobile
  // ad size (320x50) instead of holding desktop height on phones.
  const [isMobileView, setIsMobileView] = useState(false)
  // The leaderboard <ins> shape depends on the viewport, so it must not be
  // pushed to AdSense until we know which shape we're rendering.
  const [viewportKnown, setViewportKnown] = useState(false)
  const wrapRef  = useRef(null)
  const slotRef  = useRef(null)
  const defined  = useRef(false)

  const isLeaderboard = size === 'leaderboard'
  const isRectangle2  = size === 'rectangle2'
  const path = isRectangle2 ? UNIT_PATHS.rectangle2 : UNIT_PATHS.rectangle

  // Claim the one real leaderboard slot per page. Done in an effect (not a
  // render-time/lazy-init side effect) so it's unaffected by React 18 Strict
  // Mode's double-invocation of render in dev, and safe under concurrent
  // rendering in production. Effects fire in mount order, so the first
  // leaderboard instance on the page wins the claim. Resets when the path
  // changes (new page = fresh claim).
  const [isPrimaryLeaderboard, setIsPrimaryLeaderboard] = useState(false)
  useEffect(() => {
    if (!isLeaderboard) return
    if (leaderboardClaim.path !== router.asPath) {
      leaderboardClaim = { path: router.asPath, claimed: 0 }
    }
    if (leaderboardClaim.claimed >= MAX_LEADERBOARDS_PER_PAGE) return
    leaderboardClaim.claimed += 1
    setIsPrimaryLeaderboard(true)
    // Release the claim on unmount, so a leaderboard that remounts on the same
    // path (a page swapping between a loading state and its real layout) can
    // show again instead of staying blank.
    return () => {
      if (leaderboardClaim.path === router.asPath && leaderboardClaim.claimed > 0) leaderboardClaim.claimed -= 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hydration-safe unique div id (same on server + client). Strip ":" so the
  // id is valid for document.getElementById / googletag.display.
  const rawId = useId()
  const divId = `gpt-300x250-${rawId.replace(/:/g, '')}`

  useEffect(() => {
    setIsMobileView(window.innerWidth < 768)
    setViewportKnown(true)
  }, [])

  // ── Lazy load: only activate the ad once it's near the viewport ─────────────
  // isPrimaryLeaderboard is in the deps because the wrapping div (and wrapRef)
  // only mounts once a leaderboard instance wins the claim — on the render
  // before that, wrapRef.current is null and this effect bails out. Without
  // isPrimaryLeaderboard here, the effect never re-runs once the ref becomes
  // available, so the observer is never created and the ad never loads.
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

  // ── Leaderboard: push the real AdSense unit once in view (client only) ──────
  useEffect(() => {
    if (isPaid || !isLeaderboard || !isPrimaryLeaderboard || !inView || !viewportKnown || defined.current) return
    if (typeof window === 'undefined') return
    defined.current = true
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch (e) {
      // AdSense not ready / blocked — fail silently, never break the page
    }
  }, [isPaid, isLeaderboard, isPrimaryLeaderboard, inView, viewportKnown])

  // ── Sidebar rectangles: define + display the GPT slot once in view ──────────
  useEffect(() => {
    if (isPaid || isLeaderboard || !inView || defined.current) return
    if (typeof window === 'undefined') return
    defined.current = true

    const adSize = [300, 250]

    window.googletag = window.googletag || { cmd: [] }
    window.googletag.cmd.push(() => {
      try {
        const slot = window.googletag.defineSlot(path, adSize, divId)
        if (!slot) return
        slot.addService(window.googletag.pubads())
        slot.setTargeting('pos', 'rectangle')
        if (targeting && typeof targeting === 'object') {
          Object.entries(targeting).forEach(([k, v]) => slot.setTargeting(k, String(v)))
        }
        slotRef.current = slot
        window.googletag.display(divId)
      } catch (e) {
        // GPT not ready / blocked — fail silently, never break the page
      }
    })

    return () => {
      const s = slotRef.current
      if (s && window.googletag?.cmd) {
        window.googletag.cmd.push(() => {
          try { window.googletag.destroySlots([s]) } catch {}
        })
        slotRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaid, isLeaderboard, inView])

  if (isPaid) return null
  if (!isLeaderboard && !GPT_SIDEBAR_ADS_ENABLED) return null
  if (isLeaderboard && !isPrimaryLeaderboard) return null

  if (isLeaderboard) {
    // Desktop: responsive AdSense unit; a modest min-height keeps layout shift
    // small while the creative loads in.
    // Mobile: responsive WIDTH, fixed 100px HEIGHT. This is AdSense's documented
    // way to bound a responsive unit — size the <ins> in CSS and leave out
    // data-ad-format / data-full-width-responsive. With those attributes (even
    // "horizontal") AdSense took the full width AND a ~390px height on phones,
    // pushing the page's own content a whole screen down.
    return (
      <div
        ref={wrapRef}
        aria-label={adLabel}
        className={className}
        style={{
          display:   'block',
          overflow:  'hidden',
          // Explicit width: inside a flex parent (the blog's "flex justify-center"
          // ad box) the wrapper otherwise shrinks to 0px and AdSense has no
          // width to size the ad from, so the slot stays empty.
          width:     '100%',
          maxWidth:  '100%',
          minHeight: 100,
          textAlign: isMobileView ? 'center' : undefined,
          ...style,
        }}
      >
        {isMobileView ? (
          <ins
            key="mobile"
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', height: 100 }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={ADSENSE_HEADER_SLOT}
          />
        ) : (
          <ins
            key="desktop"
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={ADSENSE_HEADER_SLOT}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
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
