import Head from 'next/head'
import { useRouter } from 'next/router'
import { getLocalizedRoute, getCanonicalRoute, routeTranslations } from '../lib/route-translations'

// All supported locales and their BCP-47 language tags for hreflang
const LOCALE_LANG_MAP = {
  en: 'en',
  ja: 'ja',
  de: 'de',
  fr: 'fr',
  es: 'es',
  it: 'it',
  id: 'id',
  pt: 'pt-BR',
}

// Locales that use translated URL slugs (ja uses English slugs under /ja/)
const LOCALIZED_LOCALES = ['de', 'fr', 'es', 'it', 'id', 'pt']

export default function SEOHead({
  title,
  description,
  keywords,
  canonical,
  ogImage = 'https://smallpdf.us/og-image.jpg',
  structuredData = null,
  // Pass noIndex={true} on post-processing pages (download, preview) that
  // have no meaningful static content for search engines.
  noIndex = false,
}) {
  const router = useRouter()
  const { locale = 'en', pathname } = router
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us'

  const defaultTitle = 'Free PDF Tools — Merge, Split, Compress & Convert | SmallPDF.us'
  const defaultDescription =
    'Free online PDF tools to convert, merge, split, compress PDFs and more. No signup required. Fast, secure, and easy to use. Convert PDF to Word, JPG to PDF, and compress images instantly.'
  const defaultKeywords =
    'PDF converter, merge PDF, split PDF, compress PDF, PDF to Word, JPG to PDF, free PDF tools, online PDF editor, PDF to image converter'

  const finalTitle = title || defaultTitle
  const finalDescription = description || defaultDescription
  const finalKeywords = keywords || defaultKeywords

  // ── Canonical & hreflang logic ───────────────────────────────────────────────
  //
  // Strategy:
  //   - The canonical for each page points to ITSELF (self-referencing canonical).
  //     This is correct per Google's guidelines. The x-default hreflang handles
  //     the "preferred" version for unmatched languages.
  //   - Every page emits hreflang tags for all 8 supported locales so Google
  //     understands the full language cluster.
  //
  // pathname is always the EN file path in Next.js (e.g. '/merge-pdf', '/').
  const cleanPath = pathname.replace(/^\//, '').replace(/\/$/, '')

  /**
   * Build the full URL for a given locale using the correct localized slug.
   */
  function buildLocaleUrl(targetLocale) {
    if (targetLocale === 'en') {
      return `${baseUrl}/${cleanPath ? cleanPath + '/' : ''}`
    }
    const slug = LOCALIZED_LOCALES.includes(targetLocale)
      ? getLocalizedRoute(cleanPath, targetLocale)
      : cleanPath  // ja uses English slugs
    return `${baseUrl}/${targetLocale}/${slug ? slug + '/' : ''}`
  }

  // Current page's own URL (used for og:url and as the self-referencing canonical)
  const currentUrl = buildLocaleUrl(locale)
  const canonicalUrl = canonical || currentUrl

  // Build all alternate URLs for hreflang
  const alternateUrls = Object.keys(LOCALE_LANG_MAP).map((loc) => ({
    hrefLang: LOCALE_LANG_MAP[loc],
    href: buildLocaleUrl(loc),
  }))

  // ── Structured Data ──────────────────────────────────────────────────────────
  const defaultStructuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: 'SmallPDF.us',
        url: baseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/logo.png`,
          width: 512,
          height: 512,
        },
        description:
          locale === 'ja'
            ? '無料のオンラインPDF変換・編集ツール。PDFの変換、結合、分割、圧縮を簡単に。'
            : 'Free online PDF conversion and editing tools. Convert, merge, split, and compress PDFs with ease.',
        sameAs: [
          'https://twitter.com/smallpdfus',
          'https://facebook.com/smallpdfus',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'Customer Support',
          email: 'support@smallpdf.us',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: 'SmallPDF.us - ' + (locale === 'ja' ? '無料PDFツール' : 'Free PDF Tools'),
        description:
          locale === 'ja' ? '誰でも使える無料PDFツール' : 'Free online PDF tools for everyone',
        publisher: { '@id': `${baseUrl}/#organization` },
        inLanguage: LOCALE_LANG_MAP[locale] || 'en',
        // SearchAction omitted: requires a working /?s= search endpoint.
        // Add back once site search is implemented.
      },
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: currentUrl,
        name: finalTitle,
        description: finalDescription,
        inLanguage: LOCALE_LANG_MAP[locale] || 'en',
        isPartOf: { '@id': `${baseUrl}/#website` },
        about: { '@id': `${baseUrl}/#organization` },
        datePublished: '2024-01-01T00:00:00+00:00',
        // Static date — update manually on major content revisions rather than
        // using new Date() which signals modification on every crawl.
        dateModified: '2025-06-01T00:00:00+00:00',
      },
      {
        '@type': 'SoftwareApplication',
        name: 'SmallPDF.us PDF Tools',
        operatingSystem: 'Any (Web Browser)',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Productivity Software',
        inLanguage: LOCALE_LANG_MAP[locale] || 'en',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        // aggregateRating removed: must reflect real verified user reviews.
        // Add back when you have a genuine review/rating collection mechanism.
        featureList:
          locale === 'ja'
            ? [
                'PDFからWordへ変換',
                'PDFファイルの結合',
                'PDFドキュメントの分割',
                'PDFサイズの圧縮',
                'PDFからJPGへ変換',
                'JPGからPDFへ変換',
                'PNGからPDFへ変換',
                'PDFからPNGへ変換',
                'PDFからExcelへ変換',
                'ExcelからPDFへ変換',
                'PDFからPowerPointへ変換',
                'PowerPointからPDFへ変換',
                'PDFファイルのロック解除',
              ]
            : [
                'PDF to Word Converter',
                'Merge PDF Files',
                'Split PDF Documents',
                'Compress PDF Size',
                'PDF to JPG Converter',
                'JPG to PDF Converter',
                'PNG to PDF Converter',
                'PDF to PNG Converter',
                'PDF to Excel Converter',
                'Excel to PDF Converter',
                'PDF to PowerPoint Converter',
                'PowerPoint to PDF Converter',
                'Unlock PDF Files',
              ],
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${currentUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: locale === 'ja' ? 'ホーム' : 'Home',
            item: locale === 'en' ? `${baseUrl}/` : `${baseUrl}/${locale}/`,
          },
          // Add the tool page as position 2 when we're on a sub-page or tool page
          ...(cleanPath
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: finalTitle.split(' - ')[0].trim(),
                  item: currentUrl,
                },
              ]
            : []),
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name:
              locale === 'ja'
                ? 'SmallPDF.usは本当に無料ですか？'
                : 'Is SmallPDF.us really free to use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                locale === 'ja'
                  ? 'はい、SmallPDF.usは完全無料で、隠れた費用や有料プランはありません。'
                  : 'Yes, SmallPDF.us is completely free with no hidden fees or premium tiers. You can convert, compress, merge, and split as many PDFs as you want without paying anything.',
            },
          },
          {
            '@type': 'Question',
            name:
              locale === 'ja'
                ? 'アップロードしたファイルのセキュリティはどうなっていますか？'
                : 'How secure are my files when I upload them?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                locale === 'ja'
                  ? 'アップロードされたファイルは256ビットSSL暗号化で保護され、処理後2時間以内に自動削除されます。'
                  : 'Every file is protected with 256-bit SSL encryption during transfer and automatically deleted from our servers within 2 hours after processing.',
            },
          },
          {
            '@type': 'Question',
            name:
              locale === 'ja'
                ? 'アカウントを作成する必要がありますか？'
                : 'Do I need to create an account to use SmallPDF.us?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                locale === 'ja'
                  ? 'アカウント作成は不要です。サイトにアクセスし、ツールを選択するだけで使えます。'
                  : 'No account creation is required. Simply visit the site, choose your tool, upload your file, and start immediately.',
            },
          },
          {
            '@type': 'Question',
            name:
              locale === 'ja'
                ? 'どのファイル形式をサポートしていますか？'
                : 'What file formats does SmallPDF.us support?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                locale === 'ja'
                  ? 'PDF、Word（DOC/DOCX）、Excel（XLS/XLSX）、PowerPoint（PPT/PPTX）、JPG、PNG、WebPなどをサポートしています。'
                  : 'We support PDF, Word (DOC, DOCX), Excel (XLS, XLSX), PowerPoint (PPT, PPTX), and image formats including JPG, PNG, and WebP.',
            },
          },
        ],
      },
    ],
  }

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{finalTitle}</title>
      <meta name="title" content={finalTitle} />
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />

      {/* Robots — noIndex=true for pages with no static content (download, preview) */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <>
          <meta
            name="robots"
            content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
          />
          <meta
            name="googlebot"
            content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1"
          />
          <meta
            name="bingbot"
            content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1"
          />
        </>
      )}

      {/* ── Canonical URL — self-referencing for every locale ── */}
      <link rel="canonical" href={canonicalUrl} />

      {/* ── hreflang — all 8 supported locales ── */}
      {alternateUrls.map(({ hrefLang, href }) => (
        <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
      ))}
      {/* x-default points to the English version */}
      <link rel="alternate" hrefLang="x-default" href={buildLocaleUrl('en')} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="SmallPDF.us" />
      <meta property="og:locale" content={locale === 'ja' ? 'ja_JP' : locale === 'pt' ? 'pt_BR' : locale === 'de' ? 'de_DE' : locale === 'fr' ? 'fr_FR' : locale === 'es' ? 'es_ES' : locale === 'it' ? 'it_IT' : locale === 'id' ? 'id_ID' : 'en_US'} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:creator" content="@smallpdfus" />

      {/* Mobile */}
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      <meta name="theme-color" content="#DC2626" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="author" content="SmallPDF.us" />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData || defaultStructuredData),
        }}
      />
    </Head>
  )
}