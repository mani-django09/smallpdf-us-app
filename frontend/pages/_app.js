import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Script from 'next/script'
import { pageview } from '../lib/analytics'
import ThemeProvider from '../components/ThemeProvider'
import { AuthProvider } from '../context/AuthContext'
import '../styles/globals.css'

function MyApp({ Component, pageProps }) {
  const router = useRouter()

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
      {/* Google Analytics — lazyOnload: fires after page idle so it does NOT
          block the main thread (was afterInteractive = ran during hydration,
          contributing ~200-400ms to TBT). Analytics accuracy is unchanged;
          events are queued via dataLayer and flushed once gtag loads. */}
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

      {/* Google AdSense loader — lazyOnload defers the heavy ad script until the page
          is idle, improving TBT/LCP. Ad units (AdSenseUnit) queue their push and fire
          once this loads, so deferring is safe. */}
      <Script
        id="adsbygoogle-init"
        strategy="lazyOnload"
        crossOrigin="anonymous"
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6913093595582462"
      />

      {/* Theme Provider - Prevents hydration errors */}
      <AuthProvider>
        <ThemeProvider>
          <Component {...pageProps} />
        </ThemeProvider>
      </AuthProvider>
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