/** @type {import('next').NextConfig} */

// ── German slugs → EN ──────────────────────────────────────────
const deToEn = {
  'pdf-komprimieren':    'compress-pdf',
  'pdf-zusammenfuegen':  'merge-pdf',
  'pdf-teilen':          'split-pdf',
  'pdf-entsperren':      'unlock-pdf',
  'pdf-in-word':         'pdf-to-word',
  'word-in-pdf':         'word-to-pdf',
  'pdf-in-jpg':          'pdf-to-jpg',
  'jpg-in-pdf':          'jpg-to-pdf',
  'pdf-in-png':          'pdf-to-png',
  'png-in-pdf':          'png-to-pdf',
  'pdf-in-ppt':   'pdf-to-ppt',
  'ppt-in-pdf':   'ppt-to-pdf',
  'pdf-in-excel':        'pdf-to-excel',
  'excel-in-pdf':        'excel-to-pdf',
  'webp-in-png':         'webp-to-png',
  'png-in-webp':         'png-to-webp',
  'bild-komprimieren':   'compress-image',
  'ueber-uns':           'about',
  'kontakt':             'contact',
  'datenschutz':         'privacy',
  'nutzungsbedingungen': 'terms',
}

const deSubPages = {
  'vorschau':  'preview',
  'download':  'download',
}

// ── French slugs → EN ──────────────────────────────────────────
const frToEn = {
  'compresser-pdf':      'compress-pdf',
  'fusionner-pdf':       'merge-pdf',
  'diviser-pdf':         'split-pdf',
  'deverrouiller-pdf':   'unlock-pdf',
  'pdf-en-word':         'pdf-to-word',
  'word-en-pdf':         'word-to-pdf',
  'pdf-en-jpg':          'pdf-to-jpg',
  'jpg-en-pdf':          'jpg-to-pdf',
  'pdf-en-png':          'pdf-to-png',
  'png-en-pdf':          'png-to-pdf',
  'pdf-en-ppt':   'pdf-to-ppt',
  'ppt-en-pdf':   'ppt-to-pdf',
  'pdf-en-excel':        'pdf-to-excel',
  'excel-en-pdf':        'excel-to-pdf',
  'webp-en-png':         'webp-to-png',
  'png-en-webp':         'png-to-webp',
  'compresser-image':    'compress-image',
  'a-propos':            'about',
  'contact':             'contact',
  'confidentialite':     'privacy',
  'conditions':          'terms',
}

const frSubPages = {
  'apercu':      'preview',
  'telecharger': 'download',
}

// ── Spanish slugs → EN ─────────────────────────────────────────
const esToEn = {
  'comprimir-pdf':       'compress-pdf',
  'combinar-pdf':        'merge-pdf',
  'dividir-pdf':         'split-pdf',
  'desbloquear-pdf':     'unlock-pdf',
  'pdf-a-word':          'pdf-to-word',
  'word-a-pdf':          'word-to-pdf',
  'pdf-a-jpg':           'pdf-to-jpg',
  'jpg-a-pdf':           'jpg-to-pdf',
  'pdf-a-png':           'pdf-to-png',
  'png-a-pdf':           'png-to-pdf',
  'pdf-a-ppt':    'pdf-to-ppt',
  'ppt-a-pdf':    'ppt-to-pdf',
  'pdf-a-excel':         'pdf-to-excel',
  'excel-a-pdf':         'excel-to-pdf',
  'webp-a-png':          'webp-to-png',
  'png-a-webp':          'png-to-webp',
  'comprimir-imagen':    'compress-image',
  'sobre-nosotros':      'about',
  'contacto':            'contact',
  'privacidad':          'privacy',
  'terminos':            'terms',
}

const esSubPages = {
  'vista-previa': 'preview',
  'descargar':    'download',
}

// ── Italian slugs → EN ─────────────────────────────────────────
const itToEn = {
  'comprimi-pdf':        'compress-pdf',
  'unisci-pdf':          'merge-pdf',
  'dividi-pdf':          'split-pdf',
  'sblocca-pdf':         'unlock-pdf',
  'pdf-in-word':         'pdf-to-word',
  'word-in-pdf':         'word-to-pdf',
  'pdf-in-jpg':          'pdf-to-jpg',
  'jpg-in-pdf':          'jpg-to-pdf',
  'pdf-in-png':          'pdf-to-png',
  'png-in-pdf':          'png-to-pdf',
  'pdf-in-ppt':   'pdf-to-ppt',
  'ppt-in-pdf':   'ppt-to-pdf',
  'pdf-in-excel':        'pdf-to-excel',
  'excel-in-pdf':        'excel-to-pdf',
  'webp-in-png':         'webp-to-png',
  'png-in-webp':         'png-to-webp',
  'comprimi-immagine':   'compress-image',
  'chi-siamo':           'about',
  'contatti':            'contact',
  'privacy':             'privacy',
  'termini':             'terms',
}

const itSubPages = {
  'anteprima': 'preview',
  'scarica':   'download',
}

// ── Indonesian slugs → EN ──────────────────────────────────────
const idToEn = {
  'kompres-pdf':         'compress-pdf',
  'gabung-pdf':          'merge-pdf',
  'pisah-pdf':           'split-pdf',
  'buka-kunci-pdf':      'unlock-pdf',
  'pdf-ke-word':         'pdf-to-word',
  'word-ke-pdf':         'word-to-pdf',
  'pdf-ke-jpg':          'pdf-to-jpg',
  'jpg-ke-pdf':          'jpg-to-pdf',
  'pdf-ke-png':          'pdf-to-png',
  'png-ke-pdf':          'png-to-pdf',
  'pdf-ke-ppt':   'pdf-to-ppt',
  'ppt-ke-pdf':   'ppt-ke-pdf',
  'pdf-ke-excel':        'pdf-to-excel',
  'excel-ke-pdf':        'excel-to-pdf',
  'webp-ke-png':         'webp-to-png',
  'png-ke-webp':         'png-to-webp',
  'kompres-gambar':      'compress-image',
  'tentang-kami':        'about',
  'kontak':              'contact',
  'privasi':             'privacy',
  'syarat':              'terms',
}

const idSubPages = {
  'pratinjau': 'preview',
  'unduh':     'download',
}

// ── Brazilian Portuguese slugs → EN ───────────────────────────
const ptToEn = {
  'comprimir-pdf':       'compress-pdf',
  'unir-pdf':            'merge-pdf',
  'dividir-pdf':         'split-pdf',
  'desbloquear-pdf':     'unlock-pdf',
  'pdf-para-word':       'pdf-to-word',
  'word-para-pdf':       'word-to-pdf',
  'pdf-para-jpg':        'pdf-to-jpg',
  'jpg-para-pdf':        'jpg-to-pdf',
  'pdf-para-png':        'pdf-to-png',
  'png-para-pdf':        'png-to-pdf',
  'pdf-para-ppt': 'pdf-to-ppt',
  'ppt-para-pdf': 'ppt-to-pdf',
  'pdf-para-excel':      'pdf-to-excel',
  'excel-para-pdf':      'excel-to-pdf',
  'webp-para-png':       'webp-to-png',
  'png-para-webp':       'png-to-webp',
  'comprimir-imagem':    'compress-image',
  'sobre-nos':           'about',
  'contato':             'contact',
  'privacidade':         'privacy',
  'termos':              'terms',
}

const ptSubPages = {
  'visualizar': 'preview',
  'baixar':     'download',
}

// ── Helpers ────────────────────────────────────────────────────

function getLocalSub(subPageMap, enSub) {
  return Object.entries(subPageMap).find(([, v]) => v === enSub)?.[0] ?? enSub
}

function buildLocaleRewrites(locale, slugMap, subPageMap = {}) {
  const rewrites = []
  for (const [local, en] of Object.entries(slugMap)) {
    rewrites.push({ source: `/${locale}/${local}`,  destination: `/${locale}/${en}`,  locale: false })
    rewrites.push({ source: `/${locale}/${local}/`, destination: `/${locale}/${en}/`, locale: false })

    for (const [localSub, enSub] of Object.entries(subPageMap)) {
      rewrites.push({ source: `/${locale}/${local}/${localSub}`,  destination: `/${locale}/${en}/${enSub}`,  locale: false })
      rewrites.push({ source: `/${locale}/${local}/${localSub}/`, destination: `/${locale}/${en}/${enSub}/`, locale: false })
    }
    // NOTE: No fallback /preview or /download rewrites here.
    // The redirect rules in buildLocaleRedirects handle untranslated sub-page segments.
    // Adding rewrites here would silently serve the page without redirecting the browser URL.
  }
  return rewrites
}

function buildLocaleRedirects(locale, slugMap, subPageMap = {}) {
  const redirects = []
  const localPreview  = getLocalSub(subPageMap, 'preview')
  const localDownload = getLocalSub(subPageMap, 'download')

  for (const [local, en] of Object.entries(slugMap)) {
    redirects.push({ source: `/${locale}/${en}`,  destination: `/${locale}/${local}`,  permanent: true, locale: false })
    redirects.push({ source: `/${locale}/${en}/`, destination: `/${locale}/${local}/`, permanent: true, locale: false })

    redirects.push({ source: `/${locale}/${en}/preview`,   destination: `/${locale}/${local}/${localPreview}`,   permanent: true, locale: false })
    redirects.push({ source: `/${locale}/${en}/preview/`,  destination: `/${locale}/${local}/${localPreview}/`,  permanent: true, locale: false })
    redirects.push({ source: `/${locale}/${en}/download`,  destination: `/${locale}/${local}/${localDownload}`,  permanent: true, locale: false })
    redirects.push({ source: `/${locale}/${en}/download/`, destination: `/${locale}/${local}/${localDownload}/`, permanent: true, locale: false })

    if (localPreview !== 'preview') {
      redirects.push({ source: `/${locale}/${local}/preview`,  destination: `/${locale}/${local}/${localPreview}`,  permanent: true, locale: false })
      redirects.push({ source: `/${locale}/${local}/preview/`, destination: `/${locale}/${local}/${localPreview}/`, permanent: true, locale: false })
    }
    if (localDownload !== 'download') {
      redirects.push({ source: `/${locale}/${local}/download`,  destination: `/${locale}/${local}/${localDownload}`,  permanent: true, locale: false })
      redirects.push({ source: `/${locale}/${local}/download/`, destination: `/${locale}/${local}/${localDownload}/`, permanent: true, locale: false })
    }
  }
  return redirects
}

// ── OCR-PDF sub-page rules ─────────────────────────────────────
// 'ocr-pdf' slug is the same in all locales (no slug translation needed),
// but the sub-pages preview/download DO have localized equivalents.
// These rewrites+redirects ensure e.g.:
//   /it/ocr-pdf/anteprima  →  rewrite  →  /it/ocr-pdf/preview  (serves the page)
//   /it/ocr-pdf/preview    →  redirect →  /it/ocr-pdf/anteprima (canonical URL)
//   /it/ocr-pdf/scarica    →  rewrite  →  /it/ocr-pdf/download
//   /it/ocr-pdf/download   →  redirect →  /it/ocr-pdf/scarica

// Per-locale sub-page maps for ocr-pdf
const ocrSubPages = {
  it: { 'anteprima': 'preview', 'scarica': 'download' },
  fr: { 'apercu':    'preview', 'telecharger': 'download' },
  es: { 'vista-previa': 'preview', 'descargar': 'download' },
  de: { 'vorschau':  'preview', 'download': 'download' },
  id: { 'pratinjau': 'preview', 'unduh': 'download' },
  pt: { 'visualizar': 'preview', 'baixar': 'download' },
}

function buildOcrPdfRewrites() {
  const rewrites = []
  for (const [locale, subMap] of Object.entries(ocrSubPages)) {
    for (const [localSub, enSub] of Object.entries(subMap)) {
      // Only emit a rewrite when the localized sub ≠ EN sub (avoid no-op)
      if (localSub !== enSub) {
        rewrites.push({ source: `/${locale}/ocr-pdf/${localSub}`,  destination: `/${locale}/ocr-pdf/${enSub}`,  locale: false })
        rewrites.push({ source: `/${locale}/ocr-pdf/${localSub}/`, destination: `/${locale}/ocr-pdf/${enSub}/`, locale: false })
      }
    }
  }
  return rewrites
}

function buildOcrPdfRedirects() {
  const redirects = []
  for (const [locale, subMap] of Object.entries(ocrSubPages)) {
    const localPreview  = getLocalSub(subMap, 'preview')
    const localDownload = getLocalSub(subMap, 'download')

    // Redirect EN sub-pages → localized sub-pages (canonical URL enforcement)
    if (localPreview !== 'preview') {
      redirects.push({ source: `/${locale}/ocr-pdf/preview`,  destination: `/${locale}/ocr-pdf/${localPreview}`,  permanent: true, locale: false })
      redirects.push({ source: `/${locale}/ocr-pdf/preview/`, destination: `/${locale}/ocr-pdf/${localPreview}/`, permanent: true, locale: false })
    }
    if (localDownload !== 'download') {
      redirects.push({ source: `/${locale}/ocr-pdf/download`,  destination: `/${locale}/ocr-pdf/${localDownload}`,  permanent: true, locale: false })
      redirects.push({ source: `/${locale}/ocr-pdf/download/`, destination: `/${locale}/ocr-pdf/${localDownload}/`, permanent: true, locale: false })
    }
  }
  return redirects
}

// ── DE builders ────────────────────────────────────────────────
// DE now uses the generic buildLocaleRewrites/buildLocaleRedirects (see rewrites/redirects below)

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,

  i18n: {
    locales: ['en', 'ja', 'de', 'fr', 'es', 'it', 'id', 'pt'],
    defaultLocale: 'en',
  },

  swcMinify: true,

  images: {
    domains: ['smallpdf.us', 'www.smallpdf.us'],
    formats: ['image/avif', 'image/webp'],
  },

  compress: true,
  productionBrowserSourceMaps: false,

  env: {
    NEXT_PUBLIC_API_URL:  process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:5000',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us',
  },

  async rewrites() {
    return [
      ...buildLocaleRewrites('de', deToEn, deSubPages),
      ...buildLocaleRewrites('fr', frToEn, frSubPages),
      ...buildLocaleRewrites('es', esToEn, esSubPages),
      ...buildLocaleRewrites('it', itToEn, itSubPages),
      ...buildLocaleRewrites('id', idToEn, idSubPages),
      ...buildLocaleRewrites('pt', ptToEn, ptSubPages),
      // ocr-pdf has the same slug in all locales but localized sub-pages
      ...buildOcrPdfRewrites(),
    ]
  },

  async redirects() {
    return [
      ...buildLocaleRedirects('de', deToEn, deSubPages),
      ...buildLocaleRedirects('fr', frToEn, frSubPages),
      ...buildLocaleRedirects('es', esToEn, esSubPages),
      ...buildLocaleRedirects('it', itToEn, itSubPages),
      ...buildLocaleRedirects('id', idToEn, idSubPages),
      ...buildLocaleRedirects('pt', ptToEn, ptSubPages),
      // ocr-pdf canonical sub-page redirects
      ...buildOcrPdfRedirects(),
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control',  value: 'on'                              },
          { key: 'X-Frame-Options',          value: 'SAMEORIGIN'                      },
          { key: 'X-Content-Type-Options',   value: 'nosniff'                         },
          { key: 'X-XSS-Protection',         value: '1; mode=block'                  },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Language',         value: 'en, ja, de, fr, es, it, id, pt' },
        ],
      },
      {
        source: '/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false }
    }
    return config
  },

  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
}

module.exports = nextConfig