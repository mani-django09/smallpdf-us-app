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
  'heic-zu-jpg':         'heic-to-jpg',
  'heic-zu-png':         'heic-to-png',
  'pdf-drehen':          'rotate-pdf',
  'pdf-schuetzen':       'protect-pdf',
  'bild-komprimieren':   'compress-image',
  'bild-auf-50kb-komprimieren': 'compress-image-to-50kb',
  'bild-auf-100kb-komprimieren': 'compress-image-to-100kb',
  'bild-auf-20kb-komprimieren': 'compress-image-to-20kb',
  'pdf-bearbeiten':      'edit-pdf',
  'pdf-schwaerzen':      'redact-pdf',
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
  'heic-en-jpg':         'heic-to-jpg',
  'heic-en-png':         'heic-to-png',
  'pivoter-pdf':         'rotate-pdf',
  'proteger-pdf':        'protect-pdf',
  'compresser-image':    'compress-image',
  'compresser-image-a-50ko': 'compress-image-to-50kb',
  'compresser-image-a-100ko': 'compress-image-to-100kb',
  'compresser-image-a-20ko': 'compress-image-to-20kb',
  'modifier-pdf':        'edit-pdf',
  'caviarder-pdf':       'redact-pdf',
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
  'heic-a-jpg':          'heic-to-jpg',
  'heic-a-png':          'heic-to-png',
  'rotar-pdf':           'rotate-pdf',
  'proteger-pdf':        'protect-pdf',
  'comprimir-imagen':    'compress-image',
  'comprimir-imagen-a-50kb': 'compress-image-to-50kb',
  'comprimir-imagen-a-100kb': 'compress-image-to-100kb',
  'comprimir-imagen-a-20kb': 'compress-image-to-20kb',
  'editar-pdf':          'edit-pdf',
  'censurar-pdf':        'redact-pdf',
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
  'heic-in-jpg':         'heic-to-jpg',
  'heic-in-png':         'heic-to-png',
  'ruota-pdf':           'rotate-pdf',
  'proteggi-pdf':        'protect-pdf',
  'comprimi-immagine':   'compress-image',
  'comprimi-immagine-a-50kb': 'compress-image-to-50kb',
  'comprimi-immagine-a-100kb': 'compress-image-to-100kb',
  'comprimi-immagine-a-20kb': 'compress-image-to-20kb',
  'modifica-pdf':        'edit-pdf',
  'oscura-pdf':          'redact-pdf',
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
  'ppt-ke-pdf':   'ppt-to-pdf',
  'pdf-ke-excel':        'pdf-to-excel',
  'excel-ke-pdf':        'excel-to-pdf',
  'webp-ke-png':         'webp-to-png',
  'png-ke-webp':         'png-to-webp',
  'heic-ke-jpg':         'heic-to-jpg',
  'heic-ke-png':         'heic-to-png',
  'putar-pdf':           'rotate-pdf',
  'lindungi-pdf':        'protect-pdf',
  'sensor-pdf':          'redact-pdf',
  'kompres-gambar':      'compress-image',
  'kompres-gambar-ke-50kb': 'compress-image-to-50kb',
  'kompres-gambar-ke-100kb': 'compress-image-to-100kb',
  'kompres-gambar-ke-20kb': 'compress-image-to-20kb',
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
  'heic-para-jpg':       'heic-to-jpg',
  'heic-para-png':       'heic-to-png',
  'girar-pdf':           'rotate-pdf',
  'proteger-pdf':        'protect-pdf',
  'comprimir-imagem':    'compress-image',
  'comprimir-imagem-para-50kb': 'compress-image-to-50kb',
  'comprimir-imagem-para-100kb': 'compress-image-to-100kb',
  'comprimir-imagem-para-20kb': 'compress-image-to-20kb',
  'editar-pdf':          'edit-pdf',
  'tarjar-pdf':          'redact-pdf',
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
    // Skip the EN→local redirect when the localized slug is spelled the same
    // as the English one (e.g. fr 'contact', it 'privacy') — source and
    // destination would be identical, which Next.js still "redirects" on
    // every request, producing an infinite 308 loop between the slash and
    // no-slash variants.
    if (local !== en) {
      redirects.push({ source: `/${locale}/${en}`,  destination: `/${locale}/${local}`,  permanent: true, locale: false })
      redirects.push({ source: `/${locale}/${en}/`, destination: `/${locale}/${local}/`, permanent: true, locale: false })
    }

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

// ── Same-slug tools: localized sub-pages only ───────────────────
// 'ocr-pdf' and (for id only) 'edit-pdf' keep the same top-level slug in every
// locale, but their preview/download sub-pages DO have localized equivalents.
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

// edit-pdf keeps its 'edit-pdf' slug only for 'id' (de/fr/es/it/pt got real
// translated slugs above, handled via buildLocaleRewrites/Redirects instead).
const editPdfSubPages = {
  id: { 'pratinjau': 'preview', 'unduh': 'download' },
}

function buildSameSlugRewrites(toolSlug, subPagesMap) {
  const rewrites = []
  for (const [locale, subMap] of Object.entries(subPagesMap)) {
    for (const [localSub, enSub] of Object.entries(subMap)) {
      // Only emit a rewrite when the localized sub ≠ EN sub (avoid no-op)
      if (localSub !== enSub) {
        rewrites.push({ source: `/${locale}/${toolSlug}/${localSub}`,  destination: `/${locale}/${toolSlug}/${enSub}`,  locale: false })
        rewrites.push({ source: `/${locale}/${toolSlug}/${localSub}/`, destination: `/${locale}/${toolSlug}/${enSub}/`, locale: false })
      }
    }
  }
  return rewrites
}

function buildSameSlugRedirects(toolSlug, subPagesMap) {
  const redirects = []
  for (const [locale, subMap] of Object.entries(subPagesMap)) {
    const localPreview  = getLocalSub(subMap, 'preview')
    const localDownload = getLocalSub(subMap, 'download')

    // Redirect EN sub-pages → localized sub-pages (canonical URL enforcement)
    if (localPreview !== 'preview') {
      redirects.push({ source: `/${locale}/${toolSlug}/preview`,  destination: `/${locale}/${toolSlug}/${localPreview}`,  permanent: true, locale: false })
      redirects.push({ source: `/${locale}/${toolSlug}/preview/`, destination: `/${locale}/${toolSlug}/${localPreview}/`, permanent: true, locale: false })
    }
    if (localDownload !== 'download') {
      redirects.push({ source: `/${locale}/${toolSlug}/download`,  destination: `/${locale}/${toolSlug}/${localDownload}`,  permanent: true, locale: false })
      redirects.push({ source: `/${locale}/${toolSlug}/download/`, destination: `/${locale}/${toolSlug}/${localDownload}/`, permanent: true, locale: false })
    }
  }
  return redirects
}

// ── Landing-page aliases ─────────────────────────────────────────
// compress-image-to-50kb reuses the compress-image preview/download PAGES
// directly (same tool, just a pre-selected 50KB target via sessionStorage) —
// no duplicate preview.js/download.js. This keeps the branded URL
// (/compress-image-to-50kb/preview) in the address bar instead of falling
// back to /compress-image/preview, for all locales including the unprefixed
// default (en).
function buildSameToolAliasRewrites(fromSlug, toSlug) {
  const rewrites = [
    { source: `/${fromSlug}/preview`,   destination: `/${toSlug}/preview` },
    { source: `/${fromSlug}/preview/`,  destination: `/${toSlug}/preview/` },
    { source: `/${fromSlug}/download`,  destination: `/${toSlug}/download` },
    { source: `/${fromSlug}/download/`, destination: `/${toSlug}/download/` },
  ]
  for (const locale of ['ja', 'de', 'fr', 'es', 'it', 'id', 'pt']) {
    rewrites.push({ source: `/${locale}/${fromSlug}/preview`,   destination: `/${locale}/${toSlug}/preview`,   locale: false })
    rewrites.push({ source: `/${locale}/${fromSlug}/preview/`,  destination: `/${locale}/${toSlug}/preview/`,  locale: false })
    rewrites.push({ source: `/${locale}/${fromSlug}/download`,  destination: `/${locale}/${toSlug}/download`,  locale: false })
    rewrites.push({ source: `/${locale}/${fromSlug}/download/`, destination: `/${locale}/${toSlug}/download/`, locale: false })
  }
  return rewrites
}

// compress-image-to-50kb's translated top-level slug (added to each locale's
// ToEn map above) makes the GENERIC buildLocaleRewrites/buildLocaleRedirects
// handle the top-level URL correctly (one hop: translated slug → the real
// compress-image-to-50kb.js page). But its sub-pages (preview/download) are
// themselves an ALIAS to compress-image's preview/download pages — the
// generic per-locale subPageMap rewrite would only get as far as
// /{locale}/compress-image-to-50kb/preview, which isn't a real page (Next
// rewrites don't chain), so it 404s. This builds a DIRECT rewrite straight to
// the real destination for the fully-translated sub-page URL, and MUST be
// placed before the generic buildLocaleRewrites(...) calls in rewrites() so
// it wins the match first.
const compressImage50kbSlugs = {
  de: 'bild-auf-50kb-komprimieren',
  fr: 'compresser-image-a-50ko',
  es: 'comprimir-imagen-a-50kb',
  it: 'comprimi-immagine-a-50kb',
  id: 'kompres-gambar-ke-50kb',
  pt: 'comprimir-imagem-para-50kb',
}
const compressImage100kbSlugs = {
  de: 'bild-auf-100kb-komprimieren',
  fr: 'compresser-image-a-100ko',
  es: 'comprimir-imagen-a-100kb',
  it: 'comprimi-immagine-a-100kb',
  id: 'kompres-gambar-ke-100kb',
  pt: 'comprimir-imagem-para-100kb',
}
const compressImage20kbSlugs = {
  de: 'bild-auf-20kb-komprimieren',
  fr: 'compresser-image-a-20ko',
  es: 'comprimir-imagen-a-20kb',
  it: 'comprimi-immagine-a-20kb',
  id: 'kompres-gambar-ke-20kb',
  pt: 'comprimir-imagem-para-20kb',
}
const compressImage50kbSubPagesByLocale = {
  de: deSubPages, fr: frSubPages, es: esSubPages, it: itSubPages, id: idSubPages, pt: ptSubPages,
}
function buildCompressImageTargetKbSubRewrites(slugsMap) {
  const rewrites = []
  for (const [locale, slug] of Object.entries(slugsMap)) {
    const subMap = compressImage50kbSubPagesByLocale[locale]
    for (const [localSub, enSub] of Object.entries(subMap)) {
      rewrites.push({ source: `/${locale}/${slug}/${localSub}`,  destination: `/${locale}/compress-image/${enSub}`,  locale: false })
      rewrites.push({ source: `/${locale}/${slug}/${localSub}/`, destination: `/${locale}/compress-image/${enSub}/`, locale: false })
    }
  }
  return rewrites
}

// ── DE builders ────────────────────────────────────────────────
// DE now uses the generic buildLocaleRewrites/buildLocaleRedirects (see rewrites/redirects below)

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,

  i18n: {
    locales: ['en', 'ja', 'de', 'fr', 'es', 'it', 'id', 'pt'],
    defaultLocale: 'en',
    localeDetection: false, // ← Prevent Accept-Language header causing redirects for Googlebot
  },

  swcMinify: true,

  images: {
    domains: ['smallpdf.us', 'www.smallpdf.us'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,          // cache optimized images for 24h
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,            // remove X-Powered-By header (security + tiny perf gain)

  env: {
    NEXT_PUBLIC_API_URL:  process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:5011',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us',
  },

  async rewrites() {
    return [
      // Must come first — see comment above buildCompressImageTargetKbSubRewrites.
      ...buildCompressImageTargetKbSubRewrites(compressImage50kbSlugs),
      ...buildCompressImageTargetKbSubRewrites(compressImage100kbSlugs),
      ...buildCompressImageTargetKbSubRewrites(compressImage20kbSlugs),
      ...buildLocaleRewrites('de', deToEn, deSubPages),
      ...buildLocaleRewrites('fr', frToEn, frSubPages),
      ...buildLocaleRewrites('es', esToEn, esSubPages),
      ...buildLocaleRewrites('it', itToEn, itSubPages),
      ...buildLocaleRewrites('id', idToEn, idSubPages),
      ...buildLocaleRewrites('pt', ptToEn, ptSubPages),
      // ocr-pdf (all locales) and edit-pdf (id only) keep the same top-level
      // slug but still have localized sub-pages
      ...buildSameSlugRewrites('ocr-pdf', ocrSubPages),
      ...buildSameSlugRewrites('edit-pdf', editPdfSubPages),
      // compress-image-to-*kb landing pages → compress-image preview/download pages
      ...buildSameToolAliasRewrites('compress-image-to-50kb', 'compress-image'),
      ...buildSameToolAliasRewrites('compress-image-to-100kb', 'compress-image'),
      ...buildSameToolAliasRewrites('compress-image-to-20kb', 'compress-image'),
    ]
  },

  async redirects() {
    // ── www → apex canonicalization ────────────────────────────────────────
    // www.smallpdf.us currently serves the exact same content as smallpdf.us
    // with no redirect, which is duplicate content for search engines. Force
    // everything on the www host to the canonical apex domain, preserving the
    // original path and query string.
    const wwwCanonical = [
      {
        source: '/',
        has: [{ type: 'host', value: 'www.smallpdf.us' }],
        destination: 'https://smallpdf.us/',
        permanent: true,
      },
      {
        source: '/:path+',
        has: [{ type: 'host', value: 'www.smallpdf.us' }],
        destination: 'https://smallpdf.us/:path+/',
        permanent: true,
      },
      {
        source: '/:path+/',
        has: [{ type: 'host', value: 'www.smallpdf.us' }],
        destination: 'https://smallpdf.us/:path+/',
        permanent: true,
      },
    ]

    // ── Common EN misspellings / old URL patterns → canonical EN slugs ────────
    // Both non-slash and slash variants needed because trailingSlash:true can
    // rewrite /foo → /foo/ before custom redirects fire in some Next.js versions.
    function misspelling(source, destination) {
      return [
        { source,          destination: `${destination}/`, permanent: true },
        { source: `${source}/`, destination: `${destination}/`, permanent: true },
      ]
    }
    const enMisspellings = [
      // compress-pdf variants
      ...misspelling('/compress',            '/compress-pdf'),
      ...misspelling('/pdf-compress',        '/compress-pdf'),
      ...misspelling('/pdf-compressor',      '/compress-pdf'),
      ...misspelling('/reduce-pdf',          '/compress-pdf'),
      ...misspelling('/reduce-pdf-size',     '/compress-pdf'),
      // merge-pdf variants
      ...misspelling('/merge',               '/merge-pdf'),
      ...misspelling('/combine-pdf',         '/merge-pdf'),
      ...misspelling('/join-pdf',            '/merge-pdf'),
      // split-pdf variants
      ...misspelling('/split',               '/split-pdf'),
      ...misspelling('/pdf-split',           '/split-pdf'),
      ...misspelling('/extract-pdf',         '/split-pdf'),
      // unlock-pdf variants
      ...misspelling('/unlock',              '/unlock-pdf'),
      ...misspelling('/pdf-unlock',          '/unlock-pdf'),
      ...misspelling('/remove-pdf-password', '/unlock-pdf'),
      ...misspelling('/decrypt-pdf',         '/unlock-pdf'),
      // pdf-to-word variants
      ...misspelling('/pdf-word',            '/pdf-to-word'),
      ...misspelling('/pdf2word',            '/pdf-to-word'),
      ...misspelling('/pdf-to-doc',          '/pdf-to-word'),
      ...misspelling('/pdf-to-docx',         '/pdf-to-word'),
      // word-to-pdf variants
      ...misspelling('/word-pdf',            '/word-to-pdf'),
      ...misspelling('/doc-to-pdf',          '/word-to-pdf'),
      ...misspelling('/docx-to-pdf',         '/word-to-pdf'),
      // pdf-to-excel variants
      ...misspelling('/pdf-excel',           '/pdf-to-excel'),
      ...misspelling('/pdf2excel',           '/pdf-to-excel'),
      // pdf-to-jpg variants
      ...misspelling('/pdf-jpg',             '/pdf-to-jpg'),
      ...misspelling('/pdf-image',           '/pdf-to-jpg'),
      ...misspelling('/pdf-to-image',        '/pdf-to-jpg'),
      // jpg-to-pdf variants
      ...misspelling('/jpg-pdf',             '/jpg-to-pdf'),
      ...misspelling('/image-to-pdf',        '/jpg-to-pdf'),
      ...misspelling('/images-to-pdf',       '/jpg-to-pdf'),
      // ocr variants
      ...misspelling('/ocr',                 '/ocr-pdf'),
      ...misspelling('/pdf-ocr',             '/ocr-pdf'),
      // compress-image variants
      ...misspelling('/compress-img',        '/compress-image'),
      ...misspelling('/image-compressor',    '/compress-image'),
      ...misspelling('/resize-image',        '/compress-image'),
      // ppt variants
      ...misspelling('/pdf-ppt',             '/pdf-to-ppt'),
      ...misspelling('/ppt-pdf',             '/ppt-to-pdf'),
      // no-hyphen old-style patterns
      ...misspelling('/pdftojpg',            '/pdf-to-jpg'),
      ...misspelling('/jpgtopdf',            '/jpg-to-pdf'),
      ...misspelling('/pdftoword',           '/pdf-to-word'),
      ...misspelling('/wordtopdf',           '/word-to-pdf'),
      ...misspelling('/mergepdf',            '/merge-pdf'),
      ...misspelling('/splitpdf',            '/split-pdf'),
    ]

    return [
      ...wwwCanonical,
      ...enMisspellings,
      ...buildLocaleRedirects('de', deToEn, deSubPages),
      ...buildLocaleRedirects('fr', frToEn, frSubPages),
      ...buildLocaleRedirects('es', esToEn, esSubPages),
      ...buildLocaleRedirects('it', itToEn, itSubPages),
      ...buildLocaleRedirects('id', idToEn, idSubPages),
      ...buildLocaleRedirects('pt', ptToEn, ptSubPages),
      // ocr-pdf / edit-pdf canonical sub-page redirects
      ...buildSameSlugRedirects('ocr-pdf', ocrSubPages),
      ...buildSameSlugRedirects('edit-pdf', editPdfSubPages),
      // heic-to-jpg: legacy "EN tool slug + localized sub-page" combos → canonical
      { source: '/pt/heic-to-jpg/visualizar',  destination: '/pt/heic-para-jpg/visualizar',  permanent: true, locale: false },
      { source: '/pt/heic-to-jpg/visualizar/', destination: '/pt/heic-para-jpg/visualizar/',  permanent: true, locale: false },
      { source: '/pt/heic-to-jpg/baixar',      destination: '/pt/heic-para-jpg/baixar',       permanent: true, locale: false },
      { source: '/pt/heic-to-jpg/baixar/',     destination: '/pt/heic-para-jpg/baixar/',      permanent: true, locale: false },
      { source: '/de/heic-to-jpg/vorschau',    destination: '/de/heic-zu-jpg/vorschau',       permanent: true, locale: false },
      { source: '/de/heic-to-jpg/vorschau/',   destination: '/de/heic-zu-jpg/vorschau/',      permanent: true, locale: false },
      { source: '/fr/heic-to-jpg/apercu',      destination: '/fr/heic-en-jpg/apercu',         permanent: true, locale: false },
      { source: '/fr/heic-to-jpg/apercu/',     destination: '/fr/heic-en-jpg/apercu/',        permanent: true, locale: false },
      { source: '/es/heic-to-jpg/vista-previa',  destination: '/es/heic-a-jpg/vista-previa',  permanent: true, locale: false },
      { source: '/es/heic-to-jpg/vista-previa/', destination: '/es/heic-a-jpg/vista-previa/', permanent: true, locale: false },
      { source: '/it/heic-to-jpg/anteprima',   destination: '/it/heic-in-jpg/anteprima',      permanent: true, locale: false },
      { source: '/it/heic-to-jpg/anteprima/',  destination: '/it/heic-in-jpg/anteprima/',     permanent: true, locale: false },
      { source: '/id/heic-to-jpg/pratinjau',   destination: '/id/heic-ke-jpg/pratinjau',      permanent: true, locale: false },
      { source: '/id/heic-to-jpg/pratinjau/',  destination: '/id/heic-ke-jpg/pratinjau/',     permanent: true, locale: false },
    ]
  },

  async headers() {
    return [
      // ── Security + performance headers for all pages ──────────────────────
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control',  value: 'on' },
          { key: 'X-Frame-Options',          value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Language',         value: 'en, ja, de, fr, es, it, id, pt' },
        ],
      },
      // ── Immutable cache for Next.js JS/CSS chunks (fingerprinted filenames) ──
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // ── Long cache for static public assets ──────────────────────────────
      {
        source: '/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // ── Images: cache 7 days ──────────────────────────────────────────────
      {
        source: '/:file(.*\\.(?:jpg|jpeg|png|webp|avif|gif|ico|svg))',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      // ── Fonts: cache 1 year ───────────────────────────────────────────────
      {
        source: '/:file(.*\\.(?:woff|woff2|ttf|otf|eot))',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // ── Sitemap/robots: 24h cache ─────────────────────────────────────────
      {
        source: '/sitemap.xml',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=3600' }],
      },
      {
        source: '/robots.txt',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ]
  },

  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false }
    }
    // Production-only: split large vendor chunks for better caching
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Separate lucide-react into its own chunk (large icon library)
          lucide: {
            name: 'lucide',
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            chunks: 'all',
            priority: 30,
          },
        },
      }
    }
    return config
  },

  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
}

module.exports = nextConfig