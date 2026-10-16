import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Script from 'next/script'
import { pageview } from '../lib/analytics'
import { getApiUrl } from '../lib/getApiUrl'
import ThemeProvider from '../components/ThemeProvider'
import ClarityLoader from '../components/ClarityLoader'
import { AuthProvider } from '../context/AuthContext'
import { TranslationsProvider } from '../lib/i18n'
import '../styles/globals.css'

function MyApp({ Component, pageProps }) {
  const router = useRouter()

  // ── Google Ad Manager (AdX) — load GPT + out-of-page slots once ─────────────
  // ALL ads on the site are AdX/GPT now (AdSense was removed 2026-10-16): the
  // leaderboard and the 300x250 rectangles in AdSenseUnit.js, plus the
  // out-of-page Interstitial + sticky bottom Anchor (GPT_OUT_OF_PAGE_ENABLED;
  // set it to false to turn the full-screen formats off again). To pause
  // every ad, set GPT_SIDEBAR_ADS_ENABLED = false here AND GPT_ADS_ENABLED in
  // AdSenseUnit.js (this flag alone also stops gpt.js from loading at all).
  const GPT_SIDEBAR_ADS_ENABLED = true
  const GPT_OUT_OF_PAGE_ENABLED = true // Interstitial + sticky bottom Anchor (AdX) — on since 2026-10-16, replaces the AdSense vignette/anchor
  useEffect(() => {
    if (!GPT_SIDEBAR_ADS_ENABLED) return
    if (router.pathname.startsWith('/admin')) return   // no ads on admin
    if (typeof window === 'undefined') return
    if (document.getElementById('gpt-js')) return       // already loaded

    window.googletag = window.googletag || { cmd: [] }

    const s = document.createElement('script')
    s.id = 'gpt-js'
    s.async = true
    s.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
    document.head.appendChild(s)

    window.googletag.cmd.push(function () {
      const pubads = window.googletag.pubads()

      let interstitial, anchor
      if (GPT_OUT_OF_PAGE_ENABLED) {
        const OOP = window.googletag.enums.OutOfPageFormat
        // Interstitial (full-screen, shows on navigation)
        interstitial = window.googletag.defineOutOfPageSlot('/23028515350/Interstitial', OOP.INTERSTITIAL)
        if (interstitial) interstitial.addService(pubads)

        // Sticky bottom anchor
        anchor = window.googletag.defineOutOfPageSlot('/23028515350/Anchor', OOP.BOTTOM_ANCHOR)
        if (anchor) anchor.addService(pubads)
      }

      pubads.enableSingleRequest()
      pubads.collapseEmptyDivs()
      pubads.setTargeting('site', 'smallpdfus')
      pubads.setTargeting('lang', document.documentElement.lang || 'en')

      window.googletag.enableServices()

      if (interstitial) window.googletag.display(interstitial)
      if (anchor)       window.googletag.display(anchor)
    })
  }, [])

  // ── Traffic source beacon: once per browser tab session, tell the server where this visit came
  // from (document.referrer + utm_* in the landing URL). Powers the admin 'Traffic sources' tab.
  useEffect(() => {
    try {
      if (router.pathname.startsWith('/admin') || sessionStorage.getItem('sp_visit')) return
      const sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('sp_visit', sid)
      fetch(`${getApiUrl()}/api/track/visit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ s: sid, u: window.location.href, r: document.referrer || '' }),
      }).catch(() => {})
    } catch { /* never break the page for analytics */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Track initial page load
    pageview(router.pathname)

    const handleRouteChangeStart = () => {
      // Show loading indicator if needed
    }

    // Combined handler: scroll to top + track pageview
    const handleRouteChangeComplete = (url) => {
      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Track pageview
      pageview(url)
    }

    router.events.on('routeChangeStart', handleRouteChangeStart)
    router.events.on('routeChangeComplete', handleRouteChangeComplete)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
      router.events.off('routeChangeComplete', handleRouteChangeComplete)
    }
  }, [router.events, router.pathname])

  // Web Vitals are reported via the exported reportWebVitals() below — no duplicate observers needed

  // Prefetch common pages — only on fast connections to avoid burning mobile data
  useEffect(() => {
    const prefetchPages = [
      '/merge-pdf', '/split-pdf', '/compress-pdf',
      '/pdf-to-word', '/word-to-pdf', '/jpg-to-pdf', '/pdf-to-jpg',
    ]
    // Skip prefetch on slow connections (2G/3G/save-data)
    const conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection
    if (conn?.saveData || (conn?.effectiveType && ['slow-2g', '2g', '3g'].includes(conn.effectiveType))) return
    const timeout = setTimeout(() => {
      prefetchPages.forEach((page) => router.prefetch(page))
    }, 5000) // after 5s — well after page is interactive
    return () => clearTimeout(timeout)
  }, [router])

  return (
    <>
      {/* Google Analytics — lazyOnload (known-good, confirmed tracking). */}
      <Script
        strategy="lazyOnload"
        src={`https://www.googletagmanager.com/gtag/js?id=G-603K8BH9MK`}
      />
      <Script
        id="google-analytics"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-603K8BH9MK', {
              page_path: window.location.pathname,
              anonymize_ip: true,
              cookie_flags: 'SameSite=None;Secure'
            });
          `,
        }}
      />

      {/* Ads: Google Ad Manager (AdX) via GPT — loaded in the effect above */}

      {/* Theme Provider - Prevents hydration errors */}
      <TranslationsProvider messages={pageProps.messages}>
        <AuthProvider>
          <ThemeProvider>
            <Component {...pageProps} />
            <ClarityLoader />
          </ThemeProvider>
        </AuthProvider>
      </TranslationsProvider>
    </>
  )
}

export function reportWebVitals(metric) {
  if (process.env.NODE_ENV === 'development') {
    console.log(metric)
  }
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_label: metric.id,
      non_interaction: true,
    })
  }
}

export default MyApp