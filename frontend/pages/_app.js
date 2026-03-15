import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Script from 'next/script'
import { pageview } from '../lib/analytics'
import ThemeProvider from '../components/ThemeProvider'
import { AuthProvider } from '../context/AuthContext'
import '../styles/globals.css'

function MyApp({ Component, pageProps }) {
  const router = useRouter()

  // ✅ Load AdSense via native DOM injection (not Next.js <Script>).
  // This avoids the "data-nscript attribute not supported" AdSense warning
  // that Next.js <Script> causes, while also avoiding hydration errors.
  useEffect(() => {
    if (document.getElementById('google-adsense')) return // already loaded

    const script = document.createElement('script')
    script.id = 'google-adsense'
    script.async = true
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6913093595582462'
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      // Push once after script loads on initial page visit
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch (e) {}
    }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    // Track initial page load
    pageview(router.pathname)

    const handleRouteChangeStart = () => {
      // Show loading indicator if needed
    }

    // Combined handler: scroll to top + re-trigger AdSense Auto Ads + track pageview
    const handleRouteChangeComplete = (url) => {
      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // ✅ Re-trigger AdSense Auto Ads on every client-side navigation.
      // Without this, ads won't appear on /preview and /download pages because
      // Next.js navigates without a full page reload, so AdSense never re-scans the DOM.
      try {
        if (window.adsbygoogle) {
          window.adsbygoogle.push({})
        }
      } catch (e) {
        // adsbygoogle not ready yet, safe to ignore
      }

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

  // Report Web Vitals to analytics
  useEffect(() => {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        // Largest Contentful Paint (LCP)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          const lcpValue = lastEntry.renderTime || lastEntry.loadTime
          if (window.gtag) {
            window.gtag('event', 'web_vitals', {
              event_category: 'Web Vitals',
              event_label: 'LCP',
              value: Math.round(lcpValue),
              non_interaction: true,
            })
          }
        })
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            const fidValue = entry.processingStart - entry.startTime
            if (window.gtag) {
              window.gtag('event', 'web_vitals', {
                event_category: 'Web Vitals',
                event_label: 'FID',
                value: Math.round(fidValue),
                non_interaction: true,
              })
            }
          })
        })
        fidObserver.observe({ type: 'first-input', buffered: true })

        // Cumulative Layout Shift (CLS)
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          }
          if (window.gtag && clsValue > 0) {
            window.gtag('event', 'web_vitals', {
              event_category: 'Web Vitals',
              event_label: 'CLS',
              value: Math.round(clsValue * 1000),
              non_interaction: true,
            })
          }
        })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
      } catch (e) {
        console.error('Performance monitoring error:', e)
      }
    }
  }, [])

  // Prefetch common pages for faster navigation
  useEffect(() => {
    const prefetchPages = [
      '/merge-pdf',
      '/split-pdf',
      '/compress-pdf',
      '/pdf-to-word',
      '/word-to-pdf',
      '/jpg-to-pdf',
      '/pdf-to-jpg',
    ]
    const timeout = setTimeout(() => {
      prefetchPages.forEach((page) => router.prefetch(page))
    }, 3000)
    return () => clearTimeout(timeout)
  }, [router])

  return (
    <>
      {/* Google Analytics */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=G-603K8BH9MK`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
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