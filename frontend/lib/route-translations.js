// ── German slug → EN slug ──────────────────────────────────────────────
export const deSlugToEn = {
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
  'vorschau':            'preview',
  'download':            'download',
  'ocr-pdf':             'ocr-pdf',
}

export const enToDe = Object.fromEntries(
  Object.entries(deSlugToEn).map(([de, en]) => [en, de])
)

// ── French slug → EN slug ──────────────────────────────────────────────
export const frSlugToEn = {
  'compresser-pdf':    'compress-pdf',
  'fusionner-pdf':     'merge-pdf',
  'diviser-pdf':       'split-pdf',
  'deverrouiller-pdf': 'unlock-pdf',
  'pdf-en-word':       'pdf-to-word',
  'word-en-pdf':       'word-to-pdf',
  'pdf-en-jpg':        'pdf-to-jpg',
  'jpg-en-pdf':        'jpg-to-pdf',
  'pdf-en-png':        'pdf-to-png',
  'png-en-pdf':        'png-to-pdf',
  'pdf-en-ppt': 'pdf-to-ppt',
  'ppt-en-pdf': 'ppt-to-pdf',
  'pdf-en-excel':      'pdf-to-excel',
  'excel-en-pdf':      'excel-to-pdf',
  'webp-en-png':       'webp-to-png',
  'png-en-webp':       'png-to-webp',
  'compresser-image':  'compress-image',
  'a-propos':          'about',
  'contact':           'contact',
  'confidentialite':   'privacy',
  'conditions':        'terms',
  'apercu':            'preview',
  'telecharger':       'download',
  'ocr-pdf':           'ocr-pdf',
}

export const enToFr = Object.fromEntries(
  Object.entries(frSlugToEn).map(([fr, en]) => [en, fr])
)

// ── Spanish slug → EN slug ─────────────────────────────────────────────
export const esSlugToEn = {
  'comprimir-pdf':     'compress-pdf',
  'combinar-pdf':      'merge-pdf',
  'dividir-pdf':       'split-pdf',
  'desbloquear-pdf':   'unlock-pdf',
  'pdf-a-word':        'pdf-to-word',
  'word-a-pdf':        'word-to-pdf',
  'pdf-a-jpg':         'pdf-to-jpg',
  'jpg-a-pdf':         'jpg-to-pdf',
  'pdf-a-png':         'pdf-to-png',
  'png-a-pdf':         'png-to-pdf',
  'pdf-a-ppt':  'pdf-to-ppt',
  'ppt-a-pdf':  'ppt-to-pdf',
  'pdf-a-excel':       'pdf-to-excel',
  'excel-a-pdf':       'excel-to-pdf',
  'webp-a-png':        'webp-to-png',
  'png-a-webp':        'png-to-webp',
  'comprimir-imagen':  'compress-image',
  'sobre-nosotros':    'about',
  'contacto':          'contact',
  'privacidad':        'privacy',
  'terminos':          'terms',
  'vista-previa':      'preview',
  'descargar':         'download',
  'ocr-pdf':           'ocr-pdf',
}

export const enToEs = Object.fromEntries(
  Object.entries(esSlugToEn).map(([es, en]) => [en, es])
)

// ── Italian slug → EN slug ─────────────────────────────────────────────
export const itSlugToEn = {
  'comprimi-pdf':      'compress-pdf',
  'unisci-pdf':        'merge-pdf',
  'dividi-pdf':        'split-pdf',
  'sblocca-pdf':       'unlock-pdf',
  'pdf-in-word':       'pdf-to-word',
  'word-in-pdf':       'word-to-pdf',
  'pdf-in-jpg':        'pdf-to-jpg',
  'jpg-in-pdf':        'jpg-to-pdf',
  'pdf-in-png':        'pdf-to-png',
  'png-in-pdf':        'png-to-pdf',
  'pdf-in-ppt': 'pdf-to-ppt',
  'ppt-in-pdf': 'ppt-to-pdf',
  'pdf-in-excel':      'pdf-to-excel',
  'excel-in-pdf':      'excel-to-pdf',
  'webp-in-png':       'webp-to-png',
  'png-in-webp':       'png-to-webp',
  'comprimi-immagine': 'compress-image',
  'chi-siamo':         'about',
  'contatti':          'contact',
  'privacy':           'privacy',
  'termini':           'terms',
  'anteprima':         'preview',
  'scarica':           'download',
  'ocr-pdf':           'ocr-pdf',
}

export const enToIt = Object.fromEntries(
  Object.entries(itSlugToEn).map(([it, en]) => [en, it])
)

// ── Indonesian slug → EN slug ──────────────────────────────────────────
export const idSlugToEn = {
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
  'kompres-gambar':      'compress-image',
  'tentang-kami':        'about',
  'kontak':              'contact',
  'privasi':             'privacy',
  'syarat':              'terms',
  'pratinjau':           'preview',
  'unduh':               'download',
  'ocr-pdf':             'ocr-pdf',
}

export const enToId = Object.fromEntries(
  Object.entries(idSlugToEn).map(([id, en]) => [en, id])
)

// ── Brazilian Portuguese slug → EN slug ───────────────────────────────
export const ptSlugToEn = {
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
  'visualizar':          'preview',
  'baixar':              'download',
  'ocr-pdf':             'ocr-pdf',
}

export const enToPt = Object.fromEntries(
  Object.entries(ptSlugToEn).map(([pt, en]) => [en, pt])
)

// ── Master route translations table ───────────────────────────────────
export const routeTranslations = {
  '':               { en: '',               ja: '',               de: '',                    fr: '',                  es: '',                 it: '',                  id: '',                  pt: ''                    },
  'compress-pdf':   { en: 'compress-pdf',   ja: 'compress-pdf',   de: 'pdf-komprimieren',    fr: 'compresser-pdf',    es: 'comprimir-pdf',    it: 'comprimi-pdf',      id: 'kompres-pdf',       pt: 'comprimir-pdf'       },
  'merge-pdf':      { en: 'merge-pdf',      ja: 'merge-pdf',      de: 'pdf-zusammenfuegen',  fr: 'fusionner-pdf',     es: 'combinar-pdf',     it: 'unisci-pdf',        id: 'gabung-pdf',        pt: 'unir-pdf'            },
  'split-pdf':      { en: 'split-pdf',      ja: 'split-pdf',      de: 'pdf-teilen',          fr: 'diviser-pdf',       es: 'dividir-pdf',      it: 'dividi-pdf',        id: 'pisah-pdf',         pt: 'dividir-pdf'         },
  'unlock-pdf':     { en: 'unlock-pdf',     ja: 'unlock-pdf',     de: 'pdf-entsperren',      fr: 'deverrouiller-pdf', es: 'desbloquear-pdf',  it: 'sblocca-pdf',       id: 'buka-kunci-pdf',    pt: 'desbloquear-pdf'     },
  'pdf-to-word':    { en: 'pdf-to-word',    ja: 'pdf-to-word',    de: 'pdf-in-word',         fr: 'pdf-en-word',       es: 'pdf-a-word',       it: 'pdf-in-word',       id: 'pdf-ke-word',       pt: 'pdf-para-word'       },
  'word-to-pdf':    { en: 'word-to-pdf',    ja: 'word-to-pdf',    de: 'word-in-pdf',         fr: 'word-en-pdf',       es: 'word-a-pdf',       it: 'word-in-pdf',       id: 'word-ke-pdf',       pt: 'word-para-pdf'       },
  'pdf-to-jpg':     { en: 'pdf-to-jpg',     ja: 'pdf-to-jpg',     de: 'pdf-in-jpg',          fr: 'pdf-en-jpg',        es: 'pdf-a-jpg',        it: 'pdf-in-jpg',        id: 'pdf-ke-jpg',        pt: 'pdf-para-jpg'        },
  'jpg-to-pdf':     { en: 'jpg-to-pdf',     ja: 'jpg-to-pdf',     de: 'jpg-in-pdf',          fr: 'jpg-en-pdf',        es: 'jpg-a-pdf',        it: 'jpg-in-pdf',        id: 'jpg-ke-pdf',        pt: 'jpg-para-pdf'        },
  'pdf-to-png':     { en: 'pdf-to-png',     ja: 'pdf-to-png',     de: 'pdf-in-png',          fr: 'pdf-en-png',        es: 'pdf-a-png',        it: 'pdf-in-png',        id: 'pdf-ke-png',        pt: 'pdf-para-png'        },
  'png-to-pdf':     { en: 'png-to-pdf',     ja: 'png-to-pdf',     de: 'png-in-pdf',          fr: 'png-en-pdf',        es: 'png-a-pdf',        it: 'png-in-pdf',        id: 'png-ke-pdf',        pt: 'png-para-pdf'        },
  'pdf-to-ppt':     { en: 'pdf-to-ppt',     ja: 'pdf-to-ppt',     de: 'pdf-in-ppt',   fr: 'pdf-en-ppt', es: 'pdf-a-ppt', it: 'pdf-in-ppt', id: 'pdf-ke-ppt', pt: 'pdf-para-ppt' },
  'ppt-to-pdf':     { en: 'ppt-to-pdf',     ja: 'ppt-to-pdf',     de: 'ppt-in-pdf',   fr: 'ppt-en-pdf', es: 'ppt-a-pdf', it: 'ppt-in-pdf', id: 'ppt-ke-pdf', pt: 'ppt-para-pdf' },
  'pdf-to-excel':   { en: 'pdf-to-excel',   ja: 'pdf-to-excel',   de: 'pdf-in-excel',        fr: 'pdf-en-excel',      es: 'pdf-a-excel',      it: 'pdf-in-excel',      id: 'pdf-ke-excel',      pt: 'pdf-para-excel'      },
  'excel-to-pdf':   { en: 'excel-to-pdf',   ja: 'excel-to-pdf',   de: 'excel-in-pdf',        fr: 'excel-en-pdf',      es: 'excel-a-pdf',      it: 'excel-in-pdf',      id: 'excel-ke-pdf',      pt: 'excel-para-pdf'      },
  'webp-to-png':    { en: 'webp-to-png',    ja: 'webp-to-png',    de: 'webp-in-png',         fr: 'webp-en-png',       es: 'webp-a-png',       it: 'webp-in-png',       id: 'webp-ke-png',       pt: 'webp-para-png'       },
  'png-to-webp':    { en: 'png-to-webp',    ja: 'png-to-webp',    de: 'png-in-webp',         fr: 'png-en-webp',       es: 'png-a-webp',       it: 'png-in-webp',       id: 'png-ke-webp',       pt: 'png-para-webp'       },
  'compress-image': { en: 'compress-image', ja: 'compress-image', de: 'bild-komprimieren',   fr: 'compresser-image',  es: 'comprimir-imagen', it: 'comprimi-immagine', id: 'kompres-gambar',    pt: 'comprimir-imagem'    },
  'about':          { en: 'about',          ja: 'about',          de: 'ueber-uns',           fr: 'a-propos',          es: 'sobre-nosotros',   it: 'chi-siamo',         id: 'tentang-kami',      pt: 'sobre-nos'           },
  'contact':        { en: 'contact',        ja: 'contact',        de: 'kontakt',             fr: 'contact',           es: 'contacto',         it: 'contatti',          id: 'kontak',            pt: 'contato'             },
  'privacy':        { en: 'privacy',        ja: 'privacy',        de: 'datenschutz',         fr: 'confidentialite',   es: 'privacidad',       it: 'privacy',           id: 'privasi',           pt: 'privacidade'         },
  'terms':          { en: 'terms',          ja: 'terms',          de: 'nutzungsbedingungen', fr: 'conditions',        es: 'terminos',         it: 'termini',           id: 'syarat',            pt: 'termos'              },
  'blog':           { en: 'blog',           ja: 'blog',           de: 'blog',                fr: 'blog',              es: 'blog',             it: 'blog',              id: 'blog',              pt: 'blog'                },
  'ocr-pdf':        { en: 'ocr-pdf',        ja: 'ocr-pdf',        de: 'ocr-pdf',             fr: 'ocr-pdf',           es: 'ocr-pdf',          it: 'ocr-pdf',           id: 'ocr-pdf',           pt: 'ocr-pdf'             },
  // ── Sub-page segments ──────────────────────────────────────────────────────
  'preview':        { en: 'preview',        ja: 'preview',        de: 'vorschau',            fr: 'apercu',            es: 'vista-previa',     it: 'anteprima',         id: 'pratinjau',         pt: 'visualizar'          },
  'download':       { en: 'download',       ja: 'download',       de: 'download',            fr: 'telecharger',       es: 'descargar',        it: 'scarica',           id: 'unduh',             pt: 'baixar'              },
}

/**
 * Convert an EN path to the correct localized path for client-side navigation.
 * Translates EVERY segment including sub-pages like preview and download.
 *
 * Examples:
 *   localePath('/pdf-to-jpg/preview', 'de')  → '/de/pdf-in-jpg/vorschau'
 *   localePath('/pdf-to-jpg/preview', 'pt')  → '/pt/pdf-para-jpg/visualizar'
 *   localePath('/pdf-to-png', 'pt')          → '/pt/pdf-para-png'
 *   localePath('/pdf-to-png', 'en')          → '/pdf-to-png'
 */
export function localePath(enPath, locale) {
  if (locale === 'en') return enPath

  // ── FIX: Strip query string before translating segments, then reattach.
  // Without this, 'download?file=...' won't match any routeTranslations key
  // and falls back untranslated — causing /it/.../download instead of /it/.../scarica
  const qIndex = enPath.indexOf('?')
  const pathPart = qIndex !== -1 ? enPath.slice(0, qIndex) : enPath
  const queryString = qIndex !== -1 ? enPath.slice(qIndex) : ''

  const segments = pathPart.replace(/^\//, '').split('/').filter(Boolean)
  const localizedSegments = segments.map(seg => routeTranslations[seg]?.[locale] ?? seg)

  return `/${locale}/${localizedSegments.join('/')}${queryString}`
}

/**
 * Use in LanguageSwitcher: converts current EN pathname to target locale URL.
 */
export function getAlternateUrl(enPathname, targetLocale) {
  return localePath(enPathname, targetLocale)
}

/**
 * Return the localized slug for a given EN route key and locale.
 */
export function getLocalizedRoute(route, locale) {
  const key = route.replace(/^\//, '').replace(/\/$/, '')
  return routeTranslations[key]?.[locale] ?? route
}

/**
 * Given a localized slug (any language), return the canonical EN slug.
 */
export function getCanonicalRoute(localizedRoute) {
  const clean = localizedRoute.replace(/^\//, '').replace(/\/$/, '')
  for (const [enRoute, translations] of Object.entries(routeTranslations)) {
    const values = Object.values(translations)
    if (values.includes(clean)) return enRoute
  }
  return clean
}