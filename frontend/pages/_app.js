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