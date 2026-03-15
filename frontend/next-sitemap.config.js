// next-sitemap.config.js
// Auto-generates public/sitemap.xml on every `npm run build` (postbuild hook).
// Includes all tool pages with correct localized slugs + hreflang alternates.
// Does NOT overwrite robots.txt (we manage it manually).
/** @type {import('next-sitemap').IConfig} */

const SITE_URL = 'https://smallpdf.us'

// ── Tool slug map ─────────────────────────────────────────────────────────────
// ja: uses English slug (no localized slug for Japanese)
// All others have translated slugs matching next.config.js rewrite rules
const TOOLS = [
  { en: 'compress-pdf',   de: 'pdf-komprimieren',     fr: 'compresser-pdf',     es: 'comprimir-pdf',      it: 'comprimi-pdf',       id: 'kompres-pdf',     pt: 'comprimir-pdf'     },
  { en: 'merge-pdf',      de: 'pdf-zusammenfuegen',   fr: 'fusionner-pdf',      es: 'combinar-pdf',       it: 'unisci-pdf',         id: 'gabung-pdf',      pt: 'unir-pdf'          },
  { en: 'split-pdf',      de: 'pdf-teilen',           fr: 'diviser-pdf',        es: 'dividir-pdf',        it: 'dividi-pdf',         id: 'pisah-pdf',       pt: 'dividir-pdf'       },
  { en: 'unlock-pdf',     de: 'pdf-entsperren',       fr: 'deverrouiller-pdf',  es: 'desbloquear-pdf',    it: 'sblocca-pdf',        id: 'buka-kunci-pdf',  pt: 'desbloquear-pdf'   },
  { en: 'pdf-to-word',    de: 'pdf-in-word',          fr: 'pdf-en-word',        es: 'pdf-a-word',         it: 'pdf-in-word',        id: 'pdf-ke-word',     pt: 'pdf-para-word'     },
  { en: 'word-to-pdf',    de: 'word-in-pdf',          fr: 'word-en-pdf',        es: 'word-a-pdf',         it: 'word-in-pdf',        id: 'word-ke-pdf',     pt: 'word-para-pdf'     },
  { en: 'pdf-to-jpg',     de: 'pdf-in-jpg',           fr: 'pdf-en-jpg',         es: 'pdf-a-jpg',          it: 'pdf-in-jpg',         id: 'pdf-ke-jpg',      pt: 'pdf-para-jpg'      },
  { en: 'jpg-to-pdf',     de: 'jpg-in-pdf',           fr: 'jpg-en-pdf',         es: 'jpg-a-pdf',          it: 'jpg-in-pdf',         id: 'jpg-ke-pdf',      pt: 'jpg-para-pdf'      },
  { en: 'pdf-to-png',     de: 'pdf-in-png',           fr: 'pdf-en-png',         es: 'pdf-a-png',          it: 'pdf-in-png',         id: 'pdf-ke-png',      pt: 'pdf-para-png'      },
  { en: 'png-to-pdf',     de: 'png-in-pdf',           fr: 'png-en-pdf',         es: 'png-a-pdf',          it: 'png-in-pdf',         id: 'png-ke-pdf',      pt: 'png-para-pdf'      },
  { en: 'pdf-to-ppt',     de: 'pdf-in-ppt',           fr: 'pdf-en-ppt',         es: 'pdf-a-ppt',          it: 'pdf-in-ppt',         id: 'pdf-ke-ppt',      pt: 'pdf-para-ppt'      },
  { en: 'ppt-to-pdf',     de: 'ppt-in-pdf',           fr: 'ppt-en-pdf',         es: 'ppt-a-pdf',          it: 'ppt-in-pdf',         id: 'ppt-ke-pdf',      pt: 'ppt-para-pdf'      },
  { en: 'pdf-to-excel',   de: 'pdf-in-excel',         fr: 'pdf-en-excel',       es: 'pdf-a-excel',        it: 'pdf-in-excel',       id: 'pdf-ke-excel',    pt: 'pdf-para-excel'    },
  { en: 'excel-to-pdf',   de: 'excel-in-pdf',         fr: 'excel-en-pdf',       es: 'excel-a-pdf',        it: 'excel-in-pdf',       id: 'excel-ke-pdf',    pt: 'excel-para-pdf'    },
  { en: 'webp-to-png',    de: 'webp-in-png',          fr: 'webp-en-png',        es: 'webp-a-png',         it: 'webp-in-png',        id: 'webp-ke-png',     pt: 'webp-para-png'     },
  { en: 'png-to-webp',    de: 'png-in-webp',          fr: 'png-en-webp',        es: 'png-a-webp',         it: 'png-in-webp',        id: 'png-ke-webp',     pt: 'png-para-webp'     },
  { en: 'compress-image', de: 'bild-komprimieren',    fr: 'compresser-image',   es: 'comprimir-imagen',   it: 'comprimi-immagine',  id: 'kompres-gambar',  pt: 'comprimir-imagem'  },
  // OCR PDF — same slug in all locales (no translated slug)
  { en: 'ocr-pdf',        de: 'ocr-pdf',              fr: 'ocr-pdf',            es: 'ocr-pdf',            it: 'ocr-pdf',            id: 'ocr-pdf',         pt: 'ocr-pdf'           },
]

// ── Static pages (non-tool) ───────────────────────────────────────────────────
const STATIC_PAGES = [
  {
    en: '', priority: 1.0, changefreq: 'daily',
    de: null, fr: null, es: null, it: null, id: null, pt: null,
  },
  {
    en: 'pricing', priority: 0.8, changefreq: 'weekly',
    de: null, fr: null, es: null, it: null, id: null, pt: null,
  },
  {
    en: 'about', priority: 0.5, changefreq: 'monthly',
    de: 'ueber-uns', fr: 'a-propos', es: 'sobre-nosotros', it: 'chi-siamo', id: 'tentang-kami', pt: 'sobre-nos',
  },
  {
    en: 'contact', priority: 0.5, changefreq: 'monthly',
    de: 'kontakt', fr: 'contact', es: 'contacto', it: 'contatti', id: 'kontak', pt: 'contato',
  },
  {
    en: 'privacy', priority: 0.3, changefreq: 'yearly',
    de: 'datenschutz', fr: 'confidentialite', es: 'privacidad', it: 'privacy', id: 'privasi', pt: 'privacidade',
  },
  {
    en: 'terms', priority: 0.3, changefreq: 'yearly',
    de: 'nutzungsbedingungen', fr: 'conditions', es: 'terminos', it: 'termini', id: 'syarat', pt: 'termos',
  },
  {
    en: 'refund', priority: 0.3, changefreq: 'yearly',
    de: null, fr: null, es: null, it: null, id: null, pt: null,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildAlternateRefs(enSlug, locSlugs) {
  const enUrl = enSlug ? `${SITE_URL}/${enSlug}/` : `${SITE_URL}/`
  return [
    { href: enUrl, hreflang: 'x-default' },
    { href: enUrl, hreflang: 'en' },
    { href: enSlug ? `${SITE_URL}/ja/${enSlug}/` : `${SITE_URL}/ja/`, hreflang: 'ja' },
    { href: `${SITE_URL}/de/${locSlugs.de || enSlug}/`,  hreflang: 'de' },
    { href: `${SITE_URL}/fr/${locSlugs.fr || enSlug}/`,  hreflang: 'fr' },
    { href: `${SITE_URL}/es/${locSlugs.es || enSlug}/`,  hreflang: 'es' },
    { href: `${SITE_URL}/it/${locSlugs.it || enSlug}/`,  hreflang: 'it' },
    { href: `${SITE_URL}/id/${locSlugs.id || enSlug}/`,  hreflang: 'id' },
    { href: `${SITE_URL}/pt/${locSlugs.pt || enSlug}/`,  hreflang: 'pt' },
  ]
}

// ── Config ────────────────────────────────────────────────────────────────────
module.exports = {
  siteUrl:           SITE_URL,
  generateRobotsTxt: false,    // robots.txt is managed manually
  trailingSlash:     true,
  outDir:            'public',

  // Exclude everything auto-scanned — we control the sitemap via additionalPaths
  exclude: ['*'],

  additionalPaths: async () => {
    const today   = new Date().toISOString().split('T')[0]
    const paths   = []
    const LOCALES = ['de', 'fr', 'es', 'it', 'id', 'pt']

    // ── Tool pages ────────────────────────────────────────────────────────────
    for (const tool of TOOLS) {
      const altRefs = buildAlternateRefs(tool.en, tool)

      // English (no locale prefix)
      paths.push({ loc: `${SITE_URL}/${tool.en}/`,    changefreq: 'weekly', priority: 0.9, lastmod: today, alternateRefs: altRefs })
      // Japanese (same slug as English)
      paths.push({ loc: `${SITE_URL}/ja/${tool.en}/`, changefreq: 'weekly', priority: 0.9, lastmod: today, alternateRefs: altRefs })
      // All other locales with translated slugs
      for (const loc of LOCALES) {
        const slug = tool[loc] || tool.en
        paths.push({ loc: `${SITE_URL}/${loc}/${slug}/`, changefreq: 'weekly', priority: 0.9, lastmod: today, alternateRefs: altRefs })
      }
    }

    // ── Static pages ──────────────────────────────────────────────────────────
    for (const page of STATIC_PAGES) {
      const isHome   = page.en === ''
      const altRefs  = buildAlternateRefs(page.en, page)

      // English
      const enUrl = isHome ? `${SITE_URL}/` : `${SITE_URL}/${page.en}/`
      paths.push({ loc: enUrl, changefreq: page.changefreq, priority: page.priority, lastmod: today, alternateRefs: altRefs })

      // Japanese (same as English slug)
      const jaUrl = isHome ? `${SITE_URL}/ja/` : `${SITE_URL}/ja/${page.en}/`
      paths.push({ loc: jaUrl, changefreq: page.changefreq, priority: page.priority, lastmod: today, alternateRefs: altRefs })

      // Localized slugs
      for (const loc of LOCALES) {
        const slug   = page[loc] || page.en
        const locUrl = isHome ? `${SITE_URL}/${loc}/` : `${SITE_URL}/${loc}/${slug}/`
        paths.push({ loc: locUrl, changefreq: page.changefreq, priority: page.priority, lastmod: today, alternateRefs: altRefs })
      }
    }

    return paths
  },
}
