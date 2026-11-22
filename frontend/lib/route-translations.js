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
  'heic-zu-jpg':         'heic-to-jpg',
  'heic-zu-png':         'heic-to-png',
  'pdf-drehen':          'rotate-pdf',
  'pdf-schuetzen':       'protect-pdf',
  'bild-komprimieren':   'compress-image',
  'bild-auf-50kb-komprimieren': 'compress-image-to-50kb',
  'bild-auf-100kb-komprimieren': 'compress-image-to-100kb',
  'bild-auf-20kb-komprimieren': 'compress-image-to-20kb',
  'ueber-uns':           'about',
  'kontakt':             'contact',
  'datenschutz':         'privacy',
  'nutzungsbedingungen': 'terms',
  'vorschau':            'preview',
  'download':            'download',
  'ocr-pdf':             'ocr-pdf',
  'pdf-bearbeiten':      'edit-pdf',
  'pdf-schwaerzen':      'redact-pdf',
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
  'heic-en-jpg':       'heic-to-jpg',
  'heic-en-png':       'heic-to-png',
  'pivoter-pdf':       'rotate-pdf',
  'proteger-pdf':      'protect-pdf',
  'compresser-image':  'compress-image',
  'compresser-image-a-50ko': 'compress-image-to-50kb',
  'compresser-image-a-100ko': 'compress-image-to-100kb',
  'compresser-image-a-20ko': 'compress-image-to-20kb',
  'a-propos':          'about',
  'contact':           'contact',
  'confidentialite':   'privacy',
  'conditions':        'terms',
  'apercu':            'preview',
  'telecharger':       'download',
  'ocr-pdf':           'ocr-pdf',
  'modifier-pdf':      'edit-pdf',
  'caviarder-pdf':     'redact-pdf',
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
  'heic-a-jpg':        'heic-to-jpg',
  'heic-a-png':        'heic-to-png',
  'rotar-pdf':         'rotate-pdf',
  'proteger-pdf':      'protect-pdf',
  'comprimir-imagen':  'compress-image',
  'comprimir-imagen-a-50kb': 'compress-image-to-50kb',
  'comprimir-imagen-a-100kb': 'compress-image-to-100kb',
  'comprimir-imagen-a-20kb': 'compress-image-to-20kb',
  'sobre-nosotros':    'about',
  'contacto':          'contact',
  'privacidad':        'privacy',
  'terminos':          'terms',
  'vista-previa':      'preview',
  'descargar':         'download',
  'ocr-pdf':           'ocr-pdf',
  'editar-pdf':        'edit-pdf',
  'censurar-pdf':      'redact-pdf',
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
  'heic-in-jpg':       'heic-to-jpg',
  'heic-in-png':       'heic-to-png',
  'ruota-pdf':         'rotate-pdf',
  'proteggi-pdf':      'protect-pdf',
  'comprimi-immagine': 'compress-image',
  'comprimi-immagine-a-50kb': 'compress-image-to-50kb',
  'comprimi-immagine-a-100kb': 'compress-image-to-100kb',
  'comprimi-immagine-a-20kb': 'compress-image-to-20kb',
  'chi-siamo':         'about',
  'contatti':          'contact',
  'privacy':           'privacy',
  'termini':           'terms',
  'anteprima':         'preview',
  'scarica':           'download',
  'ocr-pdf':           'ocr-pdf',
  'modifica-pdf':      'edit-pdf',
  'oscura-pdf':        'redact-pdf',
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
  'heic-ke-jpg':         'heic-to-jpg',
  'heic-ke-png':         'heic-to-png',
  'putar-pdf':           'rotate-pdf',
  'lindungi-pdf':        'protect-pdf',
  'kompres-gambar':      'compress-image',
  'kompres-gambar-ke-50kb': 'compress-image-to-50kb',
  'kompres-gambar-ke-100kb': 'compress-image-to-100kb',
  'kompres-gambar-ke-20kb': 'compress-image-to-20kb',
  'tentang-kami':        'about',
  'kontak':              'contact',
  'privasi':             'privacy',
  'syarat':              'terms',
  'pratinjau':           'preview',
  'unduh':               'download',
  'ocr-pdf':             'ocr-pdf',
  'edit-pdf':            'edit-pdf',
  'sensor-pdf':          'redact-pdf',
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
  'heic-para-jpg':       'heic-to-jpg',
  'heic-para-png':       'heic-to-png',
  'girar-pdf':           'rotate-pdf',
  'proteger-pdf':        'protect-pdf',
  'comprimir-imagem':    'compress-image',
  'comprimir-imagem-para-50kb': 'compress-image-to-50kb',
  'comprimir-imagem-para-100kb': 'compress-image-to-100kb',
  'comprimir-imagem-para-20kb': 'compress-image-to-20kb',
  'sobre-nos':           'about',
  'contato':             'contact',
  'privacidade':         'privacy',
  'termos':              'terms',
  'visualizar':          'preview',
  'baixar':              'download',
  'ocr-pdf':             'ocr-pdf',
  'editar-pdf':          'edit-pdf',
  'tarjar-pdf':          'redact-pdf',
}

export const enToPt = Object.fromEntries(
  Object.entries(ptSlugToEn).map(([pt, en]) => [en, pt])
)

// ── Vietnamese slug → EN slug ──────────────────────────────────────────
export const viSlugToEn = {
  'nen-pdf': 'compress-pdf',
  'gop-pdf': 'merge-pdf',
  'tach-pdf': 'split-pdf',
  'mo-khoa-pdf': 'unlock-pdf',
  'pdf-sang-word': 'pdf-to-word',
  'word-sang-pdf': 'word-to-pdf',
  'pdf-sang-jpg': 'pdf-to-jpg',
  'jpg-sang-pdf': 'jpg-to-pdf',
  'pdf-sang-png': 'pdf-to-png',
  'png-sang-pdf': 'png-to-pdf',
  'pdf-sang-ppt': 'pdf-to-ppt',
  'ppt-sang-pdf': 'ppt-to-pdf',
  'pdf-sang-excel': 'pdf-to-excel',
  'excel-sang-pdf': 'excel-to-pdf',
  'webp-sang-png': 'webp-to-png',
  'png-sang-webp': 'png-to-webp',
  'heic-sang-jpg': 'heic-to-jpg',
  'heic-sang-png': 'heic-to-png',
  'xoay-pdf': 'rotate-pdf',
  'bao-ve-pdf': 'protect-pdf',
  'che-noi-dung-pdf': 'redact-pdf',
  'chinh-sua-pdf': 'edit-pdf',
  'nen-anh': 'compress-image',
  'nen-anh-xuong-50kb': 'compress-image-to-50kb',
  'nen-anh-xuong-100kb': 'compress-image-to-100kb',
  'nen-anh-xuong-20kb': 'compress-image-to-20kb',
  'gioi-thieu': 'about',
  'lien-he': 'contact',
  'quyen-rieng-tu': 'privacy',
  'dieu-khoan': 'terms',
  'ocr-pdf': 'ocr-pdf',
  'xem-truoc': 'preview',
  'tai-xuong': 'download',
}

export const enToVi = Object.fromEntries(
  Object.entries(viSlugToEn).map(([vi, en]) => [en, vi])
)

// ── Hindi (Latin) slug → EN slug ────────────────────────────────────────
export const hiSlugToEn = {
  'pdf-compress-karein': 'compress-pdf',
  'pdf-jodein': 'merge-pdf',
  'pdf-alag-karein': 'split-pdf',
  'pdf-unlock-karein': 'unlock-pdf',
  'pdf-se-word': 'pdf-to-word',
  'word-se-pdf': 'word-to-pdf',
  'pdf-se-jpg': 'pdf-to-jpg',
  'jpg-se-pdf': 'jpg-to-pdf',
  'pdf-se-png': 'pdf-to-png',
  'png-se-pdf': 'png-to-pdf',
  'pdf-se-ppt': 'pdf-to-ppt',
  'ppt-se-pdf': 'ppt-to-pdf',
  'pdf-se-excel': 'pdf-to-excel',
  'excel-se-pdf': 'excel-to-pdf',
  'webp-se-png': 'webp-to-png',
  'png-se-webp': 'png-to-webp',
  'heic-se-jpg': 'heic-to-jpg',
  'heic-se-png': 'heic-to-png',
  'pdf-ghumayein': 'rotate-pdf',
  'pdf-lock-karein': 'protect-pdf',
  'pdf-chhupayein': 'redact-pdf',
  'pdf-edit-karein': 'edit-pdf',
  'image-compress-karein': 'compress-image',
  'image-50kb-compress': 'compress-image-to-50kb',
  'image-100kb-compress': 'compress-image-to-100kb',
  'image-20kb-compress': 'compress-image-to-20kb',
  'hamare-bare-mein': 'about',
  'sampark': 'contact',
  'gopniyata': 'privacy',
  'sharten': 'terms',
  'hamare-bare-mein': 'about',
  'sampark': 'contact',
  'gopniyata': 'privacy',
  'sharten': 'terms',
  'ocr-pdf': 'ocr-pdf',
  'purvavlokan': 'preview',
  'download-karein': 'download',
}

export const enToHi = Object.fromEntries(
  Object.entries(hiSlugToEn).map(([hi, en]) => [en, hi])
)

// ── Master route translations table ───────────────────────────────────
export const routeTranslations = {
  '':               { en: '',               ja: '',               de: '',                    fr: '',                  es: '',                 it: '',                  id: '',                  pt: '', vi: '', hi: '', ar: '', tr: '', ru: '', pl: '' },
  'compress-pdf':   { en: 'compress-pdf',   ja: 'compress-pdf',   de: 'pdf-komprimieren',    fr: 'compresser-pdf',    es: 'comprimir-pdf',    it: 'comprimi-pdf',      id: 'kompres-pdf',       pt: 'comprimir-pdf', vi: 'nen-pdf', hi: 'compress-pdf', ar: 'compress-pdf', tr: 'compress-pdf', ru: 'compress-pdf', pl: 'kompresuj-pdf' },
  'merge-pdf':      { en: 'merge-pdf',      ja: 'merge-pdf',      de: 'pdf-zusammenfuegen',  fr: 'fusionner-pdf',     es: 'combinar-pdf',     it: 'unisci-pdf',        id: 'gabung-pdf',        pt: 'unir-pdf', vi: 'gop-pdf', hi: 'merge-pdf', ar: 'merge-pdf', tr: 'merge-pdf', ru: 'merge-pdf', pl: 'polacz-pdf' },
  'split-pdf':      { en: 'split-pdf',      ja: 'split-pdf',      de: 'pdf-teilen',          fr: 'diviser-pdf',       es: 'dividir-pdf',      it: 'dividi-pdf',        id: 'pisah-pdf',         pt: 'dividir-pdf', vi: 'tach-pdf', hi: 'split-pdf', ar: 'split-pdf', tr: 'split-pdf', ru: 'split-pdf', pl: 'podziel-pdf' },
  'unlock-pdf':     { en: 'unlock-pdf',     ja: 'unlock-pdf',     de: 'pdf-entsperren',      fr: 'deverrouiller-pdf', es: 'desbloquear-pdf',  it: 'sblocca-pdf',       id: 'buka-kunci-pdf',    pt: 'desbloquear-pdf', vi: 'mo-khoa-pdf', hi: 'unlock-pdf', ar: 'unlock-pdf', tr: 'unlock-pdf', ru: 'unlock-pdf', pl: 'odblokuj-pdf' },
  'pdf-to-word':    { en: 'pdf-to-word',    ja: 'pdf-to-word',    de: 'pdf-in-word',         fr: 'pdf-en-word',       es: 'pdf-a-word',       it: 'pdf-in-word',       id: 'pdf-ke-word',       pt: 'pdf-para-word', vi: 'pdf-sang-word', hi: 'pdf-to-word', ar: 'pdf-to-word', tr: 'pdf-to-word', ru: 'pdf-to-word', pl: 'pdf-na-word' },
  'word-to-pdf':    { en: 'word-to-pdf',    ja: 'word-to-pdf',    de: 'word-in-pdf',         fr: 'word-en-pdf',       es: 'word-a-pdf',       it: 'word-in-pdf',       id: 'word-ke-pdf',       pt: 'word-para-pdf', vi: 'word-sang-pdf', hi: 'word-to-pdf', ar: 'word-to-pdf', tr: 'word-to-pdf', ru: 'word-to-pdf', pl: 'word-na-pdf' },
  'pdf-to-jpg':     { en: 'pdf-to-jpg',     ja: 'pdf-to-jpg',     de: 'pdf-in-jpg',          fr: 'pdf-en-jpg',        es: 'pdf-a-jpg',        it: 'pdf-in-jpg',        id: 'pdf-ke-jpg',        pt: 'pdf-para-jpg', vi: 'pdf-sang-jpg', hi: 'pdf-to-jpg', ar: 'pdf-to-jpg', tr: 'pdf-to-jpg', ru: 'pdf-to-jpg', pl: 'pdf-na-jpg' },
  'jpg-to-pdf':     { en: 'jpg-to-pdf',     ja: 'jpg-to-pdf',     de: 'jpg-in-pdf',          fr: 'jpg-en-pdf',        es: 'jpg-a-pdf',        it: 'jpg-in-pdf',        id: 'jpg-ke-pdf',        pt: 'jpg-para-pdf', vi: 'jpg-sang-pdf', hi: 'jpg-to-pdf', ar: 'jpg-to-pdf', tr: 'jpg-to-pdf', ru: 'jpg-to-pdf', pl: 'jpg-na-pdf' },
  'pdf-to-png':     { en: 'pdf-to-png',     ja: 'pdf-to-png',     de: 'pdf-in-png',          fr: 'pdf-en-png',        es: 'pdf-a-png',        it: 'pdf-in-png',        id: 'pdf-ke-png',        pt: 'pdf-para-png', vi: 'pdf-sang-png', hi: 'pdf-to-png', ar: 'pdf-to-png', tr: 'pdf-to-png', ru: 'pdf-to-png', pl: 'pdf-na-png' },
  'png-to-pdf':     { en: 'png-to-pdf',     ja: 'png-to-pdf',     de: 'png-in-pdf',          fr: 'png-en-pdf',        es: 'png-a-pdf',        it: 'png-in-pdf',        id: 'png-ke-pdf',        pt: 'png-para-pdf', vi: 'png-sang-pdf', hi: 'png-to-pdf', ar: 'png-to-pdf', tr: 'png-to-pdf', ru: 'png-to-pdf', pl: 'png-na-pdf' },
  'pdf-to-ppt':     { en: 'pdf-to-ppt',     ja: 'pdf-to-ppt',     de: 'pdf-in-ppt',   fr: 'pdf-en-ppt', es: 'pdf-a-ppt', it: 'pdf-in-ppt', id: 'pdf-ke-ppt', pt: 'pdf-para-ppt', vi: 'pdf-sang-ppt', hi: 'pdf-to-ppt', ar: 'pdf-to-ppt', tr: 'pdf-to-ppt', ru: 'pdf-to-ppt', pl: 'pdf-na-ppt' },
  'ppt-to-pdf':     { en: 'ppt-to-pdf',     ja: 'ppt-to-pdf',     de: 'ppt-in-pdf',   fr: 'ppt-en-pdf', es: 'ppt-a-pdf', it: 'ppt-in-pdf', id: 'ppt-ke-pdf', pt: 'ppt-para-pdf', vi: 'ppt-sang-pdf', hi: 'ppt-to-pdf', ar: 'ppt-to-pdf', tr: 'ppt-to-pdf', ru: 'ppt-to-pdf', pl: 'ppt-na-pdf' },
  'pdf-to-excel':   { en: 'pdf-to-excel',   ja: 'pdf-to-excel',   de: 'pdf-in-excel',        fr: 'pdf-en-excel',      es: 'pdf-a-excel',      it: 'pdf-in-excel',      id: 'pdf-ke-excel',      pt: 'pdf-para-excel', vi: 'pdf-sang-excel', hi: 'pdf-to-excel', ar: 'pdf-to-excel', tr: 'pdf-to-excel', ru: 'pdf-to-excel', pl: 'pdf-na-excel' },
  'excel-to-pdf':   { en: 'excel-to-pdf',   ja: 'excel-to-pdf',   de: 'excel-in-pdf',        fr: 'excel-en-pdf',      es: 'excel-a-pdf',      it: 'excel-in-pdf',      id: 'excel-ke-pdf',      pt: 'excel-para-pdf', vi: 'excel-sang-pdf', hi: 'excel-to-pdf', ar: 'excel-to-pdf', tr: 'excel-to-pdf', ru: 'excel-to-pdf', pl: 'excel-na-pdf' },
  'webp-to-png':    { en: 'webp-to-png',    ja: 'webp-to-png',    de: 'webp-in-png',         fr: 'webp-en-png',       es: 'webp-a-png',       it: 'webp-in-png',       id: 'webp-ke-png',       pt: 'webp-para-png', vi: 'webp-sang-png', hi: 'webp-to-png', ar: 'webp-to-png', tr: 'webp-to-png', ru: 'webp-to-png', pl: 'webp-na-png' },
  'png-to-webp':    { en: 'png-to-webp',    ja: 'png-to-webp',    de: 'png-in-webp',         fr: 'png-en-webp',       es: 'png-a-webp',       it: 'png-in-webp',       id: 'png-ke-webp',       pt: 'png-para-webp', vi: 'png-sang-webp', hi: 'png-to-webp', ar: 'png-to-webp', tr: 'png-to-webp', ru: 'png-to-webp', pl: 'png-na-webp' },
  'heic-to-jpg':    { en: 'heic-to-jpg',   ja: 'heic-to-jpg',    de: 'heic-zu-jpg',         fr: 'heic-en-jpg',       es: 'heic-a-jpg',       it: 'heic-in-jpg',       id: 'heic-ke-jpg',       pt: 'heic-para-jpg', vi: 'heic-sang-jpg', hi: 'heic-to-jpg', ar: 'heic-to-jpg', tr: 'heic-to-jpg', ru: 'heic-to-jpg', pl: 'heic-na-jpg' },
  'heic-to-png':    { en: 'heic-to-png',   ja: 'heic-to-png',    de: 'heic-zu-png',         fr: 'heic-en-png',       es: 'heic-a-png',       it: 'heic-in-png',       id: 'heic-ke-png',       pt: 'heic-para-png', vi: 'heic-sang-png', hi: 'heic-to-png', ar: 'heic-to-png', tr: 'heic-to-png', ru: 'heic-to-png', pl: 'heic-na-png' },
  'rotate-pdf':     { en: 'rotate-pdf',   ja: 'rotate-pdf',     de: 'pdf-drehen',           fr: 'pivoter-pdf',       es: 'rotar-pdf',        it: 'ruota-pdf',         id: 'putar-pdf',         pt: 'girar-pdf', vi: 'xoay-pdf', hi: 'rotate-pdf', ar: 'rotate-pdf', tr: 'rotate-pdf', ru: 'rotate-pdf', pl: 'obroc-pdf' },
  'protect-pdf':    { en: 'protect-pdf',  ja: 'protect-pdf',    de: 'pdf-schuetzen',        fr: 'proteger-pdf',      es: 'proteger-pdf',     it: 'proteggi-pdf',      id: 'lindungi-pdf',      pt: 'proteger-pdf', vi: 'bao-ve-pdf', hi: 'protect-pdf', ar: 'protect-pdf', tr: 'protect-pdf', ru: 'protect-pdf', pl: 'zabezpiecz-pdf' },
  'redact-pdf':     { en: 'redact-pdf',   ja: 'redact-pdf',     de: 'pdf-schwaerzen',       fr: 'caviarder-pdf',     es: 'censurar-pdf',     it: 'oscura-pdf',        id: 'sensor-pdf',        pt: 'tarjar-pdf', vi: 'che-noi-dung-pdf', hi: 'redact-pdf', ar: 'redact-pdf', tr: 'redact-pdf', ru: 'redact-pdf', pl: 'zaczernij-pdf' },
  'edit-pdf':       { en: 'edit-pdf',     ja: 'edit-pdf',       de: 'pdf-bearbeiten',       fr: 'modifier-pdf',      es: 'editar-pdf',       it: 'modifica-pdf',      id: 'edit-pdf',          pt: 'editar-pdf', vi: 'chinh-sua-pdf', hi: 'edit-pdf', ar: 'edit-pdf', tr: 'edit-pdf', ru: 'edit-pdf', pl: 'edytuj-pdf' },
  'compress-image': { en: 'compress-image', ja: 'compress-image', de: 'bild-komprimieren',   fr: 'compresser-image',  es: 'comprimir-imagen', it: 'comprimi-immagine', id: 'kompres-gambar',    pt: 'comprimir-imagem', vi: 'nen-anh', hi: 'compress-image', ar: 'compress-image', tr: 'compress-image', ru: 'compress-image', pl: 'kompresuj-obraz' },
  'compress-image-to-50kb': { en: 'compress-image-to-50kb', ja: 'compress-image-to-50kb', de: 'bild-auf-50kb-komprimieren', fr: 'compresser-image-a-50ko', es: 'comprimir-imagen-a-50kb', it: 'comprimi-immagine-a-50kb', id: 'kompres-gambar-ke-50kb', pt: 'comprimir-imagem-para-50kb', vi: 'nen-anh-xuong-50kb', hi: 'compress-image-to-50kb', ar: 'compress-image-to-50kb', tr: 'compress-image-to-50kb', ru: 'compress-image-to-50kb', pl: 'kompresuj-obraz-do-50kb' },
  'compress-image-to-100kb': { en: 'compress-image-to-100kb', ja: 'compress-image-to-100kb', de: 'bild-auf-100kb-komprimieren', fr: 'compresser-image-a-100ko', es: 'comprimir-imagen-a-100kb', it: 'comprimi-immagine-a-100kb', id: 'kompres-gambar-ke-100kb', pt: 'comprimir-imagem-para-100kb', vi: 'nen-anh-xuong-100kb', hi: 'compress-image-to-100kb', ar: 'compress-image-to-100kb', tr: 'compress-image-to-100kb', ru: 'compress-image-to-100kb', pl: 'kompresuj-obraz-do-100kb' },
  'compress-image-to-20kb': { en: 'compress-image-to-20kb', ja: 'compress-image-to-20kb', de: 'bild-auf-20kb-komprimieren', fr: 'compresser-image-a-20ko', es: 'comprimir-imagen-a-20kb', it: 'comprimi-immagine-a-20kb', id: 'kompres-gambar-ke-20kb', pt: 'comprimir-imagem-para-20kb', vi: 'nen-anh-xuong-20kb', hi: 'compress-image-to-20kb', ar: 'compress-image-to-20kb', tr: 'compress-image-to-20kb', ru: 'compress-image-to-20kb', pl: 'kompresuj-obraz-do-20kb' },
  'about':          { en: 'about',          ja: 'about',          de: 'ueber-uns',           fr: 'a-propos',          es: 'sobre-nosotros',   it: 'chi-siamo',         id: 'tentang-kami',      pt: 'sobre-nos', vi: 'gioi-thieu', hi: 'about', ar: 'about', tr: 'about', ru: 'about', pl: 'o-nas' },
  'contact':        { en: 'contact',        ja: 'contact',        de: 'kontakt',             fr: 'contact',           es: 'contacto',         it: 'contatti',          id: 'kontak',            pt: 'contato', vi: 'lien-he', hi: 'contact', ar: 'contact', tr: 'contact', ru: 'contact', pl: 'kontakt' },
  'privacy':        { en: 'privacy',        ja: 'privacy',        de: 'datenschutz',         fr: 'confidentialite',   es: 'privacidad',       it: 'privacy',           id: 'privasi',           pt: 'privacidade', vi: 'quyen-rieng-tu', hi: 'privacy', ar: 'privacy', tr: 'privacy', ru: 'privacy', pl: 'polityka-prywatnosci' },
  'terms':          { en: 'terms',          ja: 'terms',          de: 'nutzungsbedingungen', fr: 'conditions',        es: 'terminos',         it: 'termini',           id: 'syarat',            pt: 'termos', vi: 'dieu-khoan', hi: 'terms', ar: 'terms', tr: 'terms', ru: 'terms', pl: 'regulamin' },
  'blog':           { en: 'blog',           ja: 'blog',           de: 'blog',                fr: 'blog',              es: 'blog',             it: 'blog',              id: 'blog',              pt: 'blog', vi: 'blog', hi: 'blog', ar: 'blog', tr: 'blog', ru: 'blog', pl: 'blog' },
  'ocr-pdf':        { en: 'ocr-pdf',        ja: 'ocr-pdf',        de: 'ocr-pdf',             fr: 'ocr-pdf',           es: 'ocr-pdf',          it: 'ocr-pdf',           id: 'ocr-pdf',           pt: 'ocr-pdf', vi: 'ocr-pdf', hi: 'ocr-pdf', ar: 'ocr-pdf', tr: 'ocr-pdf', ru: 'ocr-pdf', pl: 'ocr-pdf' },
  // ── Sub-page segments ──────────────────────────────────────────────────────
  'preview':        { en: 'preview',        ja: 'preview',        de: 'vorschau',            fr: 'apercu',            es: 'vista-previa',     it: 'anteprima',         id: 'pratinjau',         pt: 'visualizar', vi: 'xem-truoc', hi: 'preview', ar: 'preview', tr: 'preview', ru: 'preview', pl: 'podglad' },
  'download':       { en: 'download',       ja: 'download',       de: 'download',            fr: 'telecharger',       es: 'descargar',        it: 'scarica',           id: 'unduh',             pt: 'baixar', vi: 'tai-xuong', hi: 'download', ar: 'download', tr: 'download', ru: 'download', pl: 'pobieranie' },
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