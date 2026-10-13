const fs = require('fs')
const path = require('path')

const SITE_URL = 'https://smallpdf.us'
const today = new Date().toISOString().split('T')[0]

const TOOLS = [
  { en: 'compress-pdf',   de: 'pdf-komprimieren',    fr: 'compresser-pdf',    es: 'comprimir-pdf',     it: 'comprimi-pdf',       id: 'kompres-pdf',     pt: 'comprimir-pdf'    },
  { en: 'merge-pdf',      de: 'pdf-zusammenfuegen',  fr: 'fusionner-pdf',     es: 'combinar-pdf',      it: 'unisci-pdf',         id: 'gabung-pdf',      pt: 'unir-pdf'         },
  { en: 'split-pdf',      de: 'pdf-teilen',          fr: 'diviser-pdf',       es: 'dividir-pdf',       it: 'dividi-pdf',         id: 'pisah-pdf',       pt: 'dividir-pdf'      },
  { en: 'unlock-pdf',     de: 'pdf-entsperren',      fr: 'deverrouiller-pdf', es: 'desbloquear-pdf',   it: 'sblocca-pdf',        id: 'buka-kunci-pdf',  pt: 'desbloquear-pdf'  },
  { en: 'rotate-pdf',     de: 'pdf-drehen',          fr: 'pivoter-pdf',       es: 'rotar-pdf',         it: 'ruota-pdf',          id: 'putar-pdf',       pt: 'girar-pdf'        },
  { en: 'protect-pdf',    de: 'pdf-schuetzen',       fr: 'proteger-pdf',      es: 'proteger-pdf',      it: 'proteggi-pdf',       id: 'lindungi-pdf',    pt: 'proteger-pdf'     },
  { en: 'redact-pdf',     de: 'pdf-schwaerzen',      fr: 'caviarder-pdf',    es: 'censurar-pdf',      it: 'oscura-pdf',         id: 'sensor-pdf',      pt: 'tarjar-pdf'       },
  { en: 'pdf-to-word',    de: 'pdf-in-word',         fr: 'pdf-en-word',       es: 'pdf-a-word',        it: 'pdf-in-word',        id: 'pdf-ke-word',     pt: 'pdf-para-word'    },
  { en: 'word-to-pdf',    de: 'word-in-pdf',         fr: 'word-en-pdf',       es: 'word-a-pdf',        it: 'word-in-pdf',        id: 'word-ke-pdf',     pt: 'word-para-pdf'    },
  { en: 'pdf-to-jpg',     de: 'pdf-in-jpg',          fr: 'pdf-en-jpg',        es: 'pdf-a-jpg',         it: 'pdf-in-jpg',         id: 'pdf-ke-jpg',      pt: 'pdf-para-jpg'     },
  { en: 'jpg-to-pdf',     de: 'jpg-in-pdf',          fr: 'jpg-en-pdf',        es: 'jpg-a-pdf',         it: 'jpg-in-pdf',         id: 'jpg-ke-pdf',      pt: 'jpg-para-pdf'     },
  { en: 'pdf-to-png',     de: 'pdf-in-png',          fr: 'pdf-en-png',        es: 'pdf-a-png',         it: 'pdf-in-png',         id: 'pdf-ke-png',      pt: 'pdf-para-png'     },
  { en: 'png-to-pdf',     de: 'png-in-pdf',          fr: 'png-en-pdf',        es: 'png-a-pdf',         it: 'png-in-pdf',         id: 'png-ke-pdf',      pt: 'png-para-pdf'     },
  { en: 'pdf-to-ppt',     de: 'pdf-in-ppt',          fr: 'pdf-en-ppt',        es: 'pdf-a-ppt',         it: 'pdf-in-ppt',         id: 'pdf-ke-ppt',      pt: 'pdf-para-ppt'     },
  { en: 'ppt-to-pdf',     de: 'ppt-in-pdf',          fr: 'ppt-en-pdf',        es: 'ppt-a-pdf',         it: 'ppt-in-pdf',         id: 'ppt-ke-pdf',      pt: 'ppt-para-pdf'     },
  { en: 'pdf-to-excel',   de: 'pdf-in-excel',        fr: 'pdf-en-excel',      es: 'pdf-a-excel',       it: 'pdf-in-excel',       id: 'pdf-ke-excel',    pt: 'pdf-para-excel'   },
  { en: 'excel-to-pdf',   de: 'excel-in-pdf',        fr: 'excel-en-pdf',      es: 'excel-a-pdf',       it: 'excel-in-pdf',       id: 'excel-ke-pdf',    pt: 'excel-para-pdf'   },
  { en: 'webp-to-png',    de: 'webp-in-png',         fr: 'webp-en-png',       es: 'webp-a-png',        it: 'webp-in-png',        id: 'webp-ke-png',     pt: 'webp-para-png'    },
  { en: 'png-to-webp',    de: 'png-in-webp',         fr: 'png-en-webp',       es: 'png-a-webp',        it: 'png-in-webp',        id: 'png-ke-webp',     pt: 'png-para-webp'    },
  { en: 'heic-to-jpg',    de: 'heic-zu-jpg',         fr: 'heic-en-jpg',       es: 'heic-a-jpg',        it: 'heic-in-jpg',        id: 'heic-ke-jpg',     pt: 'heic-para-jpg'    },
  { en: 'heic-to-png',    de: 'heic-zu-png',         fr: 'heic-en-png',       es: 'heic-a-png',        it: 'heic-in-png',        id: 'heic-ke-png',     pt: 'heic-para-png'    },
  { en: 'compress-image', de: 'bild-komprimieren',   fr: 'compresser-image',  es: 'comprimir-imagen',  it: 'comprimi-immagine',  id: 'kompres-gambar',  pt: 'comprimir-imagem' },
  { en: 'ocr-pdf',        de: 'ocr-pdf',             fr: 'ocr-pdf',           es: 'ocr-pdf',           it: 'ocr-pdf',            id: 'ocr-pdf',         pt: 'ocr-pdf'          },
  { en: 'edit-pdf',       de: 'pdf-bearbeiten',      fr: 'modifier-pdf',     es: 'editar-pdf',        it: 'modifica-pdf',       id: 'edit-pdf',        pt: 'editar-pdf'       },
]

// ── Static (non-tool) pages ─────────────────────────────────────────────────
const STATIC_PAGES = [
  { en: 'pricing',    priority: '0.8', changefreq: 'weekly',  de: 'pricing',            fr: 'pricing',        es: 'pricing',          it: 'pricing',         id: 'pricing',        pt: 'pricing'        },
  { en: 'about',       priority: '0.5', changefreq: 'monthly', de: 'ueber-uns',          fr: 'a-propos',       es: 'sobre-nosotros',   it: 'chi-siamo',       id: 'tentang-kami',   pt: 'sobre-nos'      },
  { en: 'contact',     priority: '0.5', changefreq: 'monthly', de: 'kontakt',            fr: 'contact',        es: 'contacto',         it: 'contatti',        id: 'kontak',         pt: 'contato'        },
  { en: 'privacy',     priority: '0.3', changefreq: 'yearly',  de: 'datenschutz',        fr: 'confidentialite',es: 'privacidad',       it: 'privacy',         id: 'privasi',        pt: 'privacidade'    },
  { en: 'terms',       priority: '0.3', changefreq: 'yearly',  de: 'nutzungsbedingungen',fr: 'conditions',     es: 'terminos',         it: 'termini',         id: 'syarat',         pt: 'termos'         },
  { en: 'refund',      priority: '0.3', changefreq: 'yearly',  de: 'refund',             fr: 'refund',         es: 'refund',           it: 'refund',          id: 'refund',         pt: 'refund'         },
  { en: 'compress-image-to-50kb', priority: '0.6', changefreq: 'monthly', de: 'bild-auf-50kb-komprimieren', fr: 'compresser-image-a-50ko', es: 'comprimir-imagen-a-50kb', it: 'comprimi-immagine-a-50kb', id: 'kompres-gambar-ke-50kb', pt: 'comprimir-imagem-para-50kb' },
  { en: 'compress-image-to-100kb', priority: '0.6', changefreq: 'monthly', de: 'bild-auf-100kb-komprimieren', fr: 'compresser-image-a-100ko', es: 'comprimir-imagen-a-100kb', it: 'comprimi-immagine-a-100kb', id: 'kompres-gambar-ke-100kb', pt: 'comprimir-imagem-para-100kb' },
  { en: 'compress-image-to-20kb', priority: '0.6', changefreq: 'monthly', de: 'bild-auf-20kb-komprimieren', fr: 'compresser-image-a-20ko', es: 'comprimir-imagen-a-20kb', it: 'comprimi-immagine-a-20kb', id: 'kompres-gambar-ke-20kb', pt: 'comprimir-imagem-para-20kb' },
]

// ── Drift guard ─────────────────────────────────────────────────────────────
// The slug tables above duplicate lib/route-translations.js, which is what the
// app actually routes on. When the two drift apart the sitemap advertises URLs
// that 308-redirect — Google reports them as "Page with redirect" and wastes
// crawl budget. (That happened: rotate-pdf/protect-pdf shipped 12 stale URLs.)
// Rather than silently emitting bad URLs, fail the build loudly.
function assertSlugsMatchRouteTranslations() {
  const src = fs.readFileSync(__dirname + '/lib/route-translations.js', 'utf8')
  const table = /export const routeTranslations = \{([\s\S]*?)\n\}/.exec(src)
  if (!table) {
    throw new Error('gen-sitemap: could not parse routeTranslations — refusing to emit a possibly-wrong sitemap')
  }
  const routes = {}
  for (const row of table[1].split('\n')) {
    const m = /'([^']+)':\s*\{([^}]*)\}/.exec(row)
    if (!m) continue
    const entry = {}
    for (const p of m[2].matchAll(/(\w+):\s*'([^']+)'/g)) entry[p[1]] = p[2]
    routes[m[1]] = entry
  }
  const locales = ['de', 'fr', 'es', 'it', 'id', 'pt']
  const problems = []
  for (const row of [...TOOLS, ...STATIC_PAGES]) {
    const actual = routes[row.en]
    if (!actual) continue // not every static page is in the routing table
    for (const loc of locales) {
      if (row[loc] && actual[loc] && row[loc] !== actual[loc]) {
        problems.push(`  ${row.en} [${loc}]: sitemap='${row[loc]}' but app routes to '${actual[loc]}'`)
      }
    }
  }
  if (problems.length) {
    throw new Error(
      `gen-sitemap: ${problems.length} slug(s) disagree with lib/route-translations.js.\n` +
      problems.join('\n') +
      `\nFix the table in gen-sitemap.js so the sitemap only lists canonical, non-redirecting URLs.`
    )
  }
}

assertSlugsMatchRouteTranslations()

function hreflangBlock(tool) {
  const en = `${SITE_URL}/${tool.en}/`
  const ja = `${SITE_URL}/ja/${tool.en}/`
  return [
    `<xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`,
    `<xhtml:link rel="alternate" hreflang="en" href="${en}"/>`,
    `<xhtml:link rel="alternate" hreflang="ja" href="${ja}"/>`,
    `<xhtml:link rel="alternate" hreflang="de" href="${SITE_URL}/de/${tool.de}/"/>`,
    `<xhtml:link rel="alternate" hreflang="fr" href="${SITE_URL}/fr/${tool.fr}/"/>`,
    `<xhtml:link rel="alternate" hreflang="es" href="${SITE_URL}/es/${tool.es}/"/>`,
    `<xhtml:link rel="alternate" hreflang="it" href="${SITE_URL}/it/${tool.it}/"/>`,
    `<xhtml:link rel="alternate" hreflang="id" href="${SITE_URL}/id/${tool.id}/"/>`,
    `<xhtml:link rel="alternate" hreflang="pt" href="${SITE_URL}/pt/${tool.pt}/"/>`,
  ].join('')
}

function urlEntry(loc, priority, changefreq, hreflang) {
  return `<url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority>${hreflang}</url>\n`
}

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
`

for (const tool of TOOLS) {
  const hreflang = hreflangBlock(tool)
  xml += urlEntry(`${SITE_URL}/${tool.en}/`,    '0.9', 'weekly', hreflang)
  xml += urlEntry(`${SITE_URL}/ja/${tool.en}/`, '0.9', 'weekly', hreflang)
  for (const loc of ['de','fr','es','it','id','pt']) {
    xml += urlEntry(`${SITE_URL}/${loc}/${tool[loc]}/`, '0.9', 'weekly', hreflang)
  }
}

for (const page of STATIC_PAGES) {
  const hreflang = hreflangBlock(page)
  xml += urlEntry(`${SITE_URL}/${page.en}/`,    page.priority, page.changefreq, hreflang)
  xml += urlEntry(`${SITE_URL}/ja/${page.en}/`, page.priority, page.changefreq, hreflang)
  for (const loc of ['de','fr','es','it','id','pt']) {
    xml += urlEntry(`${SITE_URL}/${loc}/${page[loc]}/`, page.priority, page.changefreq, hreflang)
  }
}

// Homepages — English + all 7 locale homepages, as one hreflang cluster.
// (Previously only "/" was listed, with no alternates, although every page's
// hreflang points at /ja/, /de/, … — those roots were missing from the sitemap.)
const HOME_LOCALES = ['ja', 'de', 'fr', 'es', 'it', 'id', 'pt']
const homeHreflang = [
  `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/"/>`,
  `<xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/"/>`,
  ...HOME_LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}/"/>`),
].join('')
xml += urlEntry(`${SITE_URL}/`, '1.0', 'daily', homeHreflang)
for (const l of HOME_LOCALES) xml += urlEntry(`${SITE_URL}/${l}/`, '1.0', 'daily', homeHreflang)

// Blog — English-only, so no hreflang. Posts come from the backend on this
// same server; if it's unreachable the sitemap is still written without them.
async function blogEntries() {
  let out = urlEntry(`${SITE_URL}/blog/`, '0.6', 'weekly', '')
  try {
    const res = await fetch('http://127.0.0.1:5011/api/blog/posts?limit=100', { signal: AbortSignal.timeout(8000) })
    const { posts = [] } = await res.json()
    for (const p of posts) {
      if (!p.slug) continue
      const mod = String(p.updatedAt || p.updated_at || p.createdAt || p.created_at || today).slice(0, 10)
      out += `<url><loc>${SITE_URL}/blog/${encodeURIComponent(p.slug)}/</loc><lastmod>${mod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
`
    }
    console.log(`gen-sitemap: ${posts.length} blog post(s)`)
  } catch (e) {
    console.warn('gen-sitemap: blog posts skipped —', e.message)
  }
  return out
}

;(async () => {
  xml += await blogEntries()
  xml += `</urlset>`
  // Write next to this script: with the blue/green deploy the build runs in a
  // release directory, so a hard-coded path updated the wrong copy.
  const out = path.join(__dirname, 'public', 'sitemap-0.xml')
  fs.writeFileSync(out, xml)
  console.log(`Sitemap written to ${out} (${(xml.match(/<loc>/g) || []).length} URLs)`)
})()
