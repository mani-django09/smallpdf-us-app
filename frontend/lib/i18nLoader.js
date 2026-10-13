// lib/i18nLoader.js
// Build-time (server-only) translation loader — used from getStaticProps.
// Loads ONLY the current page's own namespace(s) for ONLY the current locale,
// instead of lib/i18n.js's old approach of bundling every tool's translations
// for all 8 locales into every page's client JS.
//
// common.json's top-level keys (nav, footer, layout, account, seo, download,
// common) are spread into every page's messages automatically, since Layout.js
// (rendered on every page) depends on them.

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(process.cwd(), 'messages')

function loadJSON(locale, file) {
  const p = path.join(MESSAGES_DIR, locale, file)
  if (!fs.existsSync(p)) return {}
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

// Maps a namespace key (as referenced in t("xxx.yyy")) to the JSON file that
// contains it, and — for the handful of namespaces that are really a
// sub-object of a bigger file — which sub-key to pull out.
const NAMESPACE_SOURCES = {
  pdfToJpg: 'pdf-to-jpg.json',
  jpgToPdf: 'jpg-to-pdf.json',
  pdfToWord: 'pdf-to-word.json',
  pdfToWordPreview: { file: 'pdf-to-word.json', sub: 'preview' },
  pdfToWordDownload: { file: 'pdf-to-word.json', sub: 'download' },
  wordToPdf: 'word-to-pdf.json',
  compressPdf: 'compress-pdf.json',
  mergePdf: 'merge-pdf.json',
  splitPdf: 'split-pdf.json',
  pdfToExcel: 'pdf-to-excel.json',
  excelToPdf: 'excel-to-pdf.json',
  pngToPdf: 'png-to-pdf.json',
  pdfToPng: 'pdf-to-png.json',
  pdfToPpt: 'pdf-to-ppt.json',
  pptToPdf: 'ppt-to-pdf.json',
  pptToPdfPreview: { file: 'ppt-to-pdf.json', sub: 'preview' },
  pptToPdfDownload: { file: 'ppt-to-pdf.json', sub: 'download' },
  pngToWebp: 'png-to-webp.json',
  pngToWebpPreview: { file: 'png-to-webp.json', sub: 'preview' },
  pngToWebpDownload: { file: 'png-to-webp.json', sub: 'download' },
  heicToJpg: 'heic-to-jpg.json',
  heicToPng: 'heic-to-png.json',
  compressImage: 'compress-image.json',
  compressImage50kb: 'compress-image-to-50kb.json',
  compressImage100kb: 'compress-image-to-100kb.json',
  compressImage20kb: 'compress-image-to-20kb.json',
  webpToPng: 'webp-to-png.json',
  unlockPdf: 'unlock-pdf.json',
  rotatePdf: 'rotate-pdf.json',
  redactPdf: 'redact-pdf.json',
  editPdf: 'edit-pdf.json',
  protectPdf: 'protect-pdf.json',
  ocrPdf: 'ocr-pdf.json',
  about: { file: 'static-pages.json', sub: 'about' },
  contact: { file: 'static-pages.json', sub: 'contact' },
  privacy: { file: 'static-pages.json', sub: 'privacy' },
  terms: { file: 'static-pages.json', sub: 'terms' },
  refund: { file: 'static-pages.json', sub: 'refund' },
  pricing: 'pricing.json',
  auth: 'auth.json',
  developers: 'developers.json',
  // NOTE: account, nav, seo, footer, layout, download, common, navDesc are
  // NOT listed here on purpose — they're common.json's own top-level keys,
  // already spread into every page's messages below. Listing them here would
  // incorrectly overwrite that spread key with the wrong shape.
}

/**
 * Build the exact `messages[locale]` shape lib/i18n.js used to build
 * statically, but scoped to only the namespaces this page actually needs.
 *
 * @param {string} locale
 * @param {string[]} namespaces - extra namespace keys beyond common.json's own
 */
function getPageMessages(locale, namespaces = []) {
  const loc = locale || 'en'
  const common = loadJSON(loc, 'common.json')
  const result = { ...common }

  for (const ns of namespaces) {
    const src = NAMESPACE_SOURCES[ns]
    if (!src) continue
    if (typeof src === 'string') {
      result[ns] = loadJSON(loc, src)
    } else {
      const data = loadJSON(loc, src.file)
      result[ns] = data[src.sub] || {}
    }
  }

  return result
}

module.exports = { getPageMessages }
