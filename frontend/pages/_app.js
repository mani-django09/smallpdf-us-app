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
import '../styles/rtl.css'

function MyApp({ Component, pageProps }) {
  const router = useRouter()

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
    }, 5000) // after 5s - well after page is interactive
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