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
        {/* Preconnect AdSense domains for faster ad loading */}
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
        <link rel="preconnect" href="https://googleads.g.doubleclick.net" />
        
        {/* DNS Prefetch for faster lookups */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="dns-prefetch" href="https://googleads.g.doubleclick.net" />

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
        
        <meta name="theme-color" content="#DC2626" />
        <meta name="msapplication-TileColor" content="#DC2626" />
        
        {/* ========================================
            GOOGLE FONTS — preloaded for performance
        ======================================== */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap"
          media="print"
          onLoad="this.media='all'"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap"
          />
        </noscript>

        {/* ========================================
            SEO IMPROVEMENTS
        ======================================== */}
        {/* Preconnect to Paddle for faster checkout loading */}
        <link rel="preconnect" href="https://cdn.paddle.com" />
        <link rel="preconnect" href="https://checkout-service.paddle.com" />

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