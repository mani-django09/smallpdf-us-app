// Single source of truth for the tool list, shared by the popup and the
// context menu. Slugs must match the routes on smallpdf.us — see
// frontend/components/RelatedTools.js.

const SITE = 'https://smallpdf.us'

const TOOLS = [
  // ── PDF basics ──
  { slug: 'merge-pdf',      name: 'Merge PDF',        group: 'pdf',     accepts: ['pdf'] },
  { slug: 'split-pdf',      name: 'Split PDF',        group: 'pdf',     accepts: ['pdf'] },
  { slug: 'compress-pdf',   name: 'Compress PDF',     group: 'pdf',     accepts: ['pdf'] },
  { slug: 'rotate-pdf',     name: 'Rotate PDF',       group: 'pdf',     accepts: ['pdf'] },
  { slug: 'edit-pdf',       name: 'Edit PDF',         group: 'pdf',     accepts: ['pdf'] },
  { slug: 'ocr-pdf',        name: 'OCR PDF',          group: 'pdf',     accepts: ['pdf'] },

  // ── Security ──
  { slug: 'unlock-pdf',     name: 'Unlock PDF',       group: 'secure',  accepts: ['pdf'] },
  { slug: 'protect-pdf',    name: 'Protect PDF',      group: 'secure',  accepts: ['pdf'] },
  { slug: 'redact-pdf',     name: 'Redact PDF',       group: 'secure',  accepts: ['pdf'] },

  // ── Convert from PDF ──
  { slug: 'pdf-to-word',    name: 'PDF to Word',      group: 'from',    accepts: ['pdf'] },
  { slug: 'pdf-to-excel',   name: 'PDF to Excel',     group: 'from',    accepts: ['pdf'] },
  { slug: 'pdf-to-ppt',     name: 'PDF to PowerPoint',group: 'from',    accepts: ['pdf'] },
  { slug: 'pdf-to-jpg',     name: 'PDF to JPG',       group: 'from',    accepts: ['pdf'] },
  { slug: 'pdf-to-png',     name: 'PDF to PNG',       group: 'from',    accepts: ['pdf'] },

  // ── Convert to PDF ──
  { slug: 'word-to-pdf',    name: 'Word to PDF',      group: 'to',      accepts: ['doc', 'docx'] },
  { slug: 'excel-to-pdf',   name: 'Excel to PDF',     group: 'to',      accepts: ['xls', 'xlsx'] },
  { slug: 'ppt-to-pdf',     name: 'PowerPoint to PDF',group: 'to',      accepts: ['ppt', 'pptx'] },
  { slug: 'jpg-to-pdf',     name: 'JPG to PDF',       group: 'to',      accepts: ['jpg', 'jpeg'] },
  { slug: 'png-to-pdf',     name: 'PNG to PDF',       group: 'to',      accepts: ['png'] },

  // ── Images ──
  { slug: 'compress-image',          name: 'Compress Image',   group: 'image', accepts: ['jpg', 'jpeg', 'png', 'webp'] },
  { slug: 'compress-image-to-20kb',  name: 'Compress to 20KB', group: 'image', accepts: ['jpg', 'jpeg', 'png', 'webp'] },
  { slug: 'compress-image-to-50kb',  name: 'Compress to 50KB', group: 'image', accepts: ['jpg', 'jpeg', 'png', 'webp'] },
  { slug: 'compress-image-to-100kb', name: 'Compress to 100KB',group: 'image', accepts: ['jpg', 'jpeg', 'png', 'webp'] },
  { slug: 'webp-to-png',    name: 'WEBP to PNG',      group: 'image',   accepts: ['webp'] },
  { slug: 'png-to-webp',    name: 'PNG to WEBP',      group: 'image',   accepts: ['png'] },
  { slug: 'heic-to-jpg',    name: 'HEIC to JPG',      group: 'image',   accepts: ['heic'] },
  { slug: 'heic-to-png',    name: 'HEIC to PNG',      group: 'image',   accepts: ['heic'] },
]

const GROUP_LABELS = {
  pdf:    'PDF Tools',
  secure: 'Security',
  from:   'Convert from PDF',
  to:     'Convert to PDF',
  image:  'Image Tools',
}

// Languages the site is translated into. Tools open in the browser's language
// when it is one of these; the site itself redirects the English slug to the
// localized one (e.g. /de/compress-pdf -> /de/pdf-komprimieren), keeping the
// query string.
const SITE_LOCALES = ['ja', 'de', 'fr', 'es', 'it', 'id', 'pt', 'vi', 'hi']

function siteLocale() {
  try {
    const ui = (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || ''
    const base = ui.toLowerCase().split(/[-_]/)[0]
    return SITE_LOCALES.includes(base) ? base : ''
  } catch {
    return ''
  }
}

// Every link the extension opens is tagged, so extension traffic is separable
// from organic search in Analytics. `handoff` marks a tab that should receive
// the file the user was looking at (see handoff.js).
function toolUrl(slug, { medium = 'popup', handoff = false } = {}) {
  const loc = siteLocale()
  const url = new URL(`${SITE}/${loc ? loc + '/' : ''}${slug}/`)
  url.searchParams.set('utm_source', 'chrome_extension')
  url.searchParams.set('utm_medium', medium)
  if (handoff) url.searchParams.set('ext_handoff', '1')
  return url.toString()
}

function homeUrl(medium) {
  const loc = siteLocale()
  return `${SITE}/${loc ? loc + '/' : ''}?utm_source=chrome_extension&utm_medium=${medium}`
}

function extensionOf(url) {
  try {
    const path = new URL(url).pathname
    const match = path.match(/\.([a-z0-9]+)$/i)
    return match ? match[1].toLowerCase() : null
  } catch {
    return null
  }
}

// What someone most likely wants when they're *looking at* one file. Merge is
// deliberately not near the top for a single open PDF — it needs a second file,
// so offering it first sends the user to a page they can't act on yet.
const INTENT_ORDER = {
  pdf:  ['compress-pdf', 'pdf-to-word', 'split-pdf', 'pdf-to-jpg', 'rotate-pdf'],
  jpg:  ['compress-image', 'jpg-to-pdf'],
  jpeg: ['compress-image', 'jpg-to-pdf'],
  png:  ['compress-image', 'png-to-pdf', 'png-to-webp'],
  webp: ['webp-to-png', 'compress-image'],
  heic: ['heic-to-jpg', 'heic-to-png'],
}

// Tools that make sense for a given file, best match first.
function toolsFor(ext) {
  if (!ext) return []
  const matches = TOOLS.filter(t => t.accepts.includes(ext))
  const preferred = INTENT_ORDER[ext] || []
  return matches.sort((a, b) => {
    const ia = preferred.indexOf(a.slug)
    const ib = preferred.indexOf(b.slug)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

if (typeof module !== 'undefined') module.exports = { TOOLS, GROUP_LABELS, SITE, SITE_LOCALES, toolUrl, homeUrl, extensionOf, toolsFor }
