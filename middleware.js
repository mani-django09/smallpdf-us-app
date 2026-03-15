import { NextResponse } from 'next/server'

// ── Slug translation tables ────────────────────────────────────

// EN slug → localized slug (for redirect: /pt/merge-pdf → /pt/unir-pdf)
const EN_TO_LOCALE = {
  it: {
    'compress-pdf':   'comprimi-pdf',
    'merge-pdf':      'unisci-pdf',
    'split-pdf':      'dividi-pdf',
    'unlock-pdf':     'sblocca-pdf',
    'pdf-to-word':    'pdf-in-word',
    'word-to-pdf':    'word-in-pdf',
    'pdf-to-jpg':     'pdf-in-jpg',
    'jpg-to-pdf':     'jpg-in-pdf',
    'pdf-to-png':     'pdf-in-png',
    'png-to-pdf':     'png-in-pdf',
    'pdf-to-ppt':     'pdf-in-ppt',
    'ppt-to-pdf':     'ppt-in-pdf',
    'pdf-to-excel':   'pdf-in-excel',
    'excel-to-pdf':   'excel-in-pdf',
    'webp-to-png':    'webp-in-png',
    'png-to-webp':    'png-in-webp',
    'compress-image': 'comprimi-immagine',
    'about':          'chi-siamo',
    'contact':        'contatti',
    'terms':          'termini',
    // 'privacy' same in IT — omitted intentionally (no redirect needed)
    'preview':        'anteprima',
    'download':       'scarica',
    'ocr-pdf':        'ocr-pdf',
  },
  fr: {
    'compress-pdf':   'compresser-pdf',
    'merge-pdf':      'fusionner-pdf',
    'split-pdf':      'diviser-pdf',
    'unlock-pdf':     'deverrouiller-pdf',
    'pdf-to-word':    'pdf-en-word',
    'word-to-pdf':    'word-en-pdf',
    'pdf-to-jpg':     'pdf-en-jpg',
    'jpg-to-pdf':     'jpg-en-pdf',
    'pdf-to-png':     'pdf-en-png',
    'png-to-pdf':     'png-en-pdf',
    'pdf-to-ppt':     'pdf-en-ppt',
    'ppt-to-pdf':     'ppt-en-pdf',
    'pdf-to-excel':   'pdf-en-excel',
    'excel-to-pdf':   'excel-en-pdf',
    'webp-to-png':    'webp-en-png',
    'png-to-webp':    'png-en-webp',
    'compress-image': 'compresser-image',
    'about':          'a-propos',
    'contact':        'contact',
    'privacy':        'confidentialite',
    'terms':          'conditions',
    'preview':        'apercu',
    'download':       'telecharger',
    'ocr-pdf':        'ocr-pdf',
  },
  es: {
    'compress-pdf':   'comprimir-pdf',
    'merge-pdf':      'combinar-pdf',
    'split-pdf':      'dividir-pdf',
    'unlock-pdf':     'desbloquear-pdf',
    'pdf-to-word':    'pdf-a-word',
    'word-to-pdf':    'word-a-pdf',
    'pdf-to-jpg':     'pdf-a-jpg',
    'jpg-to-pdf':     'jpg-a-pdf',
    'pdf-to-png':     'pdf-a-png',
    'png-to-pdf':     'png-a-pdf',
    'pdf-to-ppt':     'pdf-a-ppt',
    'ppt-to-pdf':     'ppt-a-pdf',
    'pdf-to-excel':   'pdf-a-excel',
    'excel-to-pdf':   'excel-a-pdf',
    'webp-to-png':    'webp-a-png',
    'png-to-webp':    'png-a-webp',
    'compress-image': 'comprimir-imagen',
    'about':          'sobre-nosotros',
    'contact':        'contacto',
    'privacy':        'privacidad',
    'terms':          'terminos',
    'preview':        'vista-previa',
    'download':       'descargar',
    'ocr-pdf':        'ocr-pdf',
  },
  de: {
    'compress-pdf':   'pdf-komprimieren',
    'merge-pdf':      'pdf-zusammenfuegen',
    'split-pdf':      'pdf-teilen',
    'unlock-pdf':     'pdf-entsperren',
    'pdf-to-word':    'pdf-in-word',
    'word-to-pdf':    'word-in-pdf',
    'pdf-to-jpg':     'pdf-in-jpg',
    'jpg-to-pdf':     'jpg-in-pdf',
    'pdf-to-png':     'pdf-in-png',
    'png-to-pdf':     'png-in-pdf',
    'pdf-to-ppt':     'pdf-in-ppt',
    'ppt-to-pdf':     'ppt-in-pdf',
    'pdf-to-excel':   'pdf-in-excel',
    'excel-to-pdf':   'excel-in-pdf',
    'webp-to-png':    'webp-in-png',
    'png-to-webp':    'png-in-webp',
    'compress-image': 'bild-komprimieren',
    'about':          'ueber-uns',
    'contact':        'kontakt',
    'privacy':        'datenschutz',
    'terms':          'nutzungsbedingungen',
    'preview':        'vorschau',
    // 'download' same in DE — omitted intentionally
    'ocr-pdf':        'ocr-pdf',
  },
  id: {
    'compress-pdf':   'kompres-pdf',
    'merge-pdf':      'gabung-pdf',
    'split-pdf':      'pisah-pdf',
    'unlock-pdf':     'buka-kunci-pdf',
    'pdf-to-word':    'pdf-ke-word',
    'word-to-pdf':    'word-ke-pdf',
    'pdf-to-jpg':     'pdf-ke-jpg',
    'jpg-to-pdf':     'jpg-ke-pdf',
    'pdf-to-png':     'pdf-ke-png',
    'png-to-pdf':     'png-ke-pdf',
    'pdf-to-ppt':     'pdf-ke-ppt',
    'ppt-to-pdf':     'ppt-ke-pdf',
    'pdf-to-excel':   'pdf-ke-excel',
    'excel-to-pdf':   'excel-ke-pdf',
    'webp-to-png':    'webp-ke-png',
    'png-to-webp':    'png-ke-webp',
    'compress-image': 'kompres-gambar',
    'about':          'tentang-kami',
    'contact':        'kontak',
    'privacy':        'privasi',
    'terms':          'syarat',
    'preview':        'pratinjau',
    'download':       'unduh',
    'ocr-pdf':        'ocr-pdf',
  },
  // ── Brazilian Portuguese ──────────────────────────────────────
  pt: {
    'compress-pdf':   'comprimir-pdf',
    'merge-pdf':      'unir-pdf',
    'split-pdf':      'dividir-pdf',
    'unlock-pdf':     'desbloquear-pdf',
    'pdf-to-word':    'pdf-para-word',
    'word-to-pdf':    'word-para-pdf',
    'pdf-to-jpg':     'pdf-para-jpg',
    'jpg-to-pdf':     'jpg-para-pdf',
    'pdf-to-png':     'pdf-para-png',
    'png-to-pdf':     'png-para-pdf',
    'pdf-to-ppt':     'pdf-para-ppt',
    'ppt-to-pdf':     'ppt-para-pdf',
    'pdf-to-excel':   'pdf-para-excel',
    'excel-to-pdf':   'excel-para-pdf',
    'webp-to-png':    'webp-para-png',
    'png-to-webp':    'png-para-webp',
    'compress-image': 'comprimir-imagem',
    'about':          'sobre-nos',
    'contact':        'contato',
    'privacy':        'privacidade',
    'terms':          'termos',
    'preview':        'visualizar',
    'download':       'baixar',
    'ocr-pdf':        'ocr-pdf',
  },
}

// Build reverse maps: localized slug → EN slug (for rewrite: serve EN page file)
const LOCALE_TO_EN = {}
for (const [locale, map] of Object.entries(EN_TO_LOCALE)) {
  LOCALE_TO_EN[locale] = Object.fromEntries(Object.entries(map).map(([en, loc]) => [loc, en]))
}

const SUPPORTED_LOCALES = new Set(['it', 'fr', 'es', 'de', 'id', 'pt'])

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Skip Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Parse: /pt/unir-pdf/visualizar → ['pt', 'unir-pdf', 'visualizar']
  const segments = pathname.replace(/^\/|\/$/g, '').split('/')
  const locale = segments[0]

  if (!SUPPORTED_LOCALES.has(locale)) {
    // ── Homepage auto-redirect by Accept-Language ──────────────
    if (pathname === '/' || pathname === '') {
      const lang = (request.headers.get('accept-language') || '').split(',')[0]?.split('-')[0]
      if (SUPPORTED_LOCALES.has(lang)) {
        return NextResponse.redirect(new URL(`/${lang}/`, request.url), 302)
      }
    }
    return NextResponse.next()
  }

  const slug = segments[1]  // main page slug
  const sub  = segments[2]  // sub-page: preview / download / localized equivalent

  if (!slug) return NextResponse.next()

  const enToLoc = EN_TO_LOCALE[locale]
  const locToEn = LOCALE_TO_EN[locale]

  // ── Case 1: slug is an EN slug under a non-EN locale ──────────
  // e.g. /pt/merge-pdf  →  redirect to /pt/unir-pdf
  // IMPORTANT: skip when localSlug === slug (no-op translations like 'ocr-pdf')
  // to avoid infinite redirect loops.
  const localSlug = enToLoc[slug]
  if (localSlug && localSlug !== slug) {
    // Also translate sub-page segment if present
    const localSub = sub ? (enToLoc[sub] ?? sub) : null
    const newPath = localSub
      ? `/${locale}/${localSlug}/${localSub}/`
      : `/${locale}/${localSlug}/`
    return NextResponse.redirect(new URL(newPath, request.url), 301)
  }

  // ── Case 2: slug is a localized slug ─────────────────────────
  // e.g. /pt/unir-pdf  →  rewrite internally to /pt/merge-pdf (the actual page file)
  // Also handles no-op slugs like 'ocr-pdf' where localSlug === slug (Case 1 skipped).
  const enSlug = locToEn[slug] ?? (localSlug === slug ? slug : null)
  if (enSlug) {
    // ── FIX: If sub is an untranslated EN sub-page that has a localized version,
    // redirect the browser to the fully-localized URL first.
    // e.g. /it/comprimi-pdf/download → 301 → /it/comprimi-pdf/scarica
    //      /pt/unir-pdf/preview      → 301 → /pt/unir-pdf/visualizar
    //      /it/ocr-pdf/download      → 301 → /it/ocr-pdf/scarica
    //      /it/ocr-pdf/preview       → 301 → /it/ocr-pdf/anteprima
    // Condition: sub exists, is NOT already localized (not in reverse map),
    // AND has a known localized equivalent in enToLoc.
    if (sub && !locToEn[sub] && enToLoc[sub] && enToLoc[sub] !== sub) {
      const localSub = enToLoc[sub]
      const newPath = `/${locale}/${slug}/${localSub}/`
      return NextResponse.redirect(new URL(newPath, request.url), 301)
    }

    // sub is either already localized, has no translation (pass-through), or absent.
    // Safe to rewrite internally to the EN file path.
    // e.g. /it/comprimi-pdf/scarica   → rewrite → /it/compress-pdf/download
    //      /pt/unir-pdf/visualizar    → rewrite → /pt/merge-pdf/preview
    //      /it/ocr-pdf/anteprima      → rewrite → /it/ocr-pdf/preview
    //      /fr/ocr-pdf/telecharger    → rewrite → /fr/ocr-pdf/download
    const enSub = sub ? (locToEn[sub] ?? sub) : null
    const rewritePath = enSub
      ? `/${locale}/${enSlug}/${enSub}`
      : `/${locale}/${enSlug}`
    const rewriteUrl = new URL(rewritePath, request.url)
    return NextResponse.rewrite(rewriteUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}