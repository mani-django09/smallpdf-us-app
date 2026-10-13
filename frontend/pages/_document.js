import Document, { Html, Head, Main, NextScript } from 'next/document'

export default function MyDocument({ locale }) {
  return (
    <Html lang={locale || 'en'}>
      <Head>
        {/* ========================================
            CRITICAL PERFORMANCE OPTIMIZATIONS
        ======================================== */}
        
        {/* Preconnect to critical domains - Load these FIRST */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        {/* Preconnect Ad Manager (AdX / GPT) domains — network currently paused, see _app.js */}
        <link rel="preconnect" href="https://securepubads.g.doubleclick.net" />
        <link rel="preconnect" href="https://googleads.g.doubleclick.net" />
        <link rel="preconnect" href="https://www.googletagservices.com" />
        {/* Preconnect Google AdSense */}
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" />

        {/* ========================================
            GOOGLE ADSENSE — loaded on every page
        ======================================== */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6913093595582462"
          crossOrigin="anonymous"
        ></script>

        {/* DNS Prefetch for faster lookups */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />

        {/* ========================================
            FAVICON - COMPLETE SET
        ======================================== */}
        
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* ========================================
            THEME & BRANDING
        ======================================== */}
        
        {/* theme-color is set per-page in SEOHead.js — msapplication tile only here */}
        <meta name="msapplication-TileColor" content="#DC2626" />
        
        {/* ========================================
            GOOGLE FONTS — non-blocking async load
            font-display=swap prevents invisible text during load
        ======================================== */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          media="print"
          onLoad="this.media='all'"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          />
        </noscript>

        {/* ========================================
            SEO IMPROVEMENTS
        ======================================== */}
        {/* Preconnect to PayPal for faster checkout loading */}
        <link rel="preconnect" href="https://www.paypal.com" />
        <link rel="preconnect" href="https://api-m.paypal.com" />

      </Head>
      <body>
        
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

// Pass locale to the Document so <Html lang="xx"> is correct for every locale
MyDocument.getInitialProps = async (ctx) => {
  const initialProps = await Document.getInitialProps(ctx)
  return { ...initialProps, locale: ctx.locale }
}