import { Zap, Shield, Globe } from "lucide-react"
import Script from "next/script"
import Link from "next/link"
import { useTranslations } from "../lib/i18n"
import DynamicHeader from "./DynamicHeader"
import { InstallExtensionFooterBadge } from "./InstallExtensionBanner"
import { localePath } from "../lib/route-translations"

// Locales that use localized URL slugs (all non-English locales)
const LOCALIZED_LOCALES = ['ja', 'de', 'fr', 'es', 'it', 'id', 'pt']

/**
 * Brand logo — icon mark + wordmark. `dark` inverts the wordmark for the footer.
 */
function Logo({ dark = false, className = "" }) {
  return (
    <span className={`select-none inline-flex items-baseline leading-none ${className}`}>
      <span className={`text-[19px] font-semibold tracking-tight ${dark ? "text-slate-400" : "text-slate-500"}`}>
        Small
      </span>
      <span className={`text-[23px] font-black tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
        PDF
      </span>
      <span className="ml-[3px] text-[14px] font-extrabold text-red-500">.us</span>
    </span>
  )
}

export default function Layout({ children, title, description }) {
  const { t, locale } = useTranslations()

  // Helper for localized links
  const LocalizedLink = ({ href, children, className, ...props }) => {
    const fullHref = LOCALIZED_LOCALES.includes(locale)
      ? localePath(href, locale)
      : href
    return (
      <Link href={fullHref} locale={false} className={className} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Top "Add to Chrome" bar removed 2026-10-16 (owner request). The footer badge below stays. */}
        <DynamicHeader />

        <main>{children}</main>

        {/* Footer */}
        <footer className="bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-gray-300 mt-20">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
              <div className="lg:col-span-2">
                <Logo dark className="mb-4" />
                <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-sm">
                  {t('footer.description')}
                </p>
                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex items-center space-x-2 text-sm">
                    <Shield className="w-4 h-4 text-green-400" aria-hidden="true" />
                    <span className="text-gray-400">{t('common.secure')}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Zap className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                    <span className="text-gray-400">{t('common.fast')}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Globe className="w-4 h-4 text-red-400" aria-hidden="true" />
                    <span className="text-gray-400">{t('common.free')}</span>
                  </div>
                </div>
                {/* Google Play Badge — in footer brand column */}
                <a
                  href="https://play.google.com/store/apps/details?id=com.snappdf.pdftools"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', opacity: 1, transition: 'opacity 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseOut={e => e.currentTarget.style.opacity = '1'}
                >
                  <img
                    src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                    alt="Get it on Google Play"
                    width="202"
                    height="72"
                    loading="lazy"
                    decoding="async"
                    style={{ height: 72, width: 'auto', display: 'block' }}
                  />
                </a>
                <div>
                  <InstallExtensionFooterBadge />
                </div>
              </div>

              {/* PDF Tools */}
              <div>
                <h3 className="font-bold mb-4 text-white text-sm uppercase tracking-wider">
                  {t('footer.pdfTools')}
                </h3>
                <ul className="space-y-1 text-sm">
                  {[
                    { href: "/merge-pdf",    label: t('nav.mergePdf') },
                    { href: "/split-pdf",    label: t('nav.splitPdf') },
                    { href: "/compress-pdf", label: t('nav.compressPdf') },
                    { href: "/pdf-to-word",  label: t('nav.pdfToWord') },
                    { href: "/word-to-pdf",  label: t('nav.wordToPdf') },
                    { href: "/unlock-pdf",   label: t('nav.unlockPdf') },
                    { href: "/protect-pdf",  label: t('nav.protectPdf') },
                    { href: "/redact-pdf",   label: t('nav.redactPdf') },
                    { href: "/rotate-pdf",   label: t('nav.rotatePdf') },
                    { href: "/ocr-pdf",      label: t('nav.ocrPdf') },
                    { href: "/edit-pdf",     label: t('nav.editPdf') },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <LocalizedLink href={href} className="hover:text-white transition-colors hover:translate-x-1 inline-block py-1">
                        {label}
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Convert & Image Tools */}
              <div>
                <h3 className="font-bold mb-4 text-white text-sm uppercase tracking-wider">
                  {t('footer.convert')}
                </h3>
                <ul className="space-y-1 text-sm">
                  {[
                    { href: "/pdf-to-jpg",     label: t('nav.pdfToJpg') },
                    { href: "/jpg-to-pdf",     label: t('nav.jpgToPdf') },
                    { href: "/png-to-pdf",     label: t('nav.pngToPdf') },
                    { href: "/pdf-to-png",     label: t('nav.pdfToPng') },
                    { href: "/pdf-to-excel",   label: t('nav.pdfToExcel') },
                    { href: "/excel-to-pdf",   label: t('nav.excelToPdf') },
                    { href: "/pdf-to-ppt",     label: t('nav.pdfToPpt') },
                    { href: "/ppt-to-pdf",     label: t('nav.pptToPdf') },
                    { href: "/compress-image", label: t('nav.compressImage') },
                    { href: "/compress-image-to-50kb", label: t('nav.compressImage50kb') },
                    { href: "/compress-image-to-100kb", label: t('nav.compressImage100kb') },
                    { href: "/compress-image-to-20kb", label: t('nav.compressImage20kb') },
                    { href: "/webp-to-png",    label: t('nav.webpToPng') },
                    { href: "/png-to-webp",    label: t('nav.pngToWebp') },
                    { href: "/heic-to-jpg",    label: t('nav.heicToJpg') },
                    { href: "/heic-to-png",    label: t('nav.heicToPng') },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <LocalizedLink href={href} className="hover:text-white transition-colors hover:translate-x-1 inline-block py-1">
                        {label}
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="font-bold mb-4 text-white text-sm uppercase tracking-wider">
                  {t('footer.company')}
                </h3>
                <ul className="space-y-1 text-sm">
                  {[
                    { href: "/about",   label: t('footer.aboutUs') },
                    { href: "/pricing", label: t('nav.pricing') },
                    { href: "/developers", label: "API" },
                    { href: "/blog",    label: t('footer.blog') },
                    { href: "/contact", label: t('footer.contact') },
                    { href: "/privacy", label: t('footer.privacy') },
                    { href: "/terms",   label: t('footer.terms') },
                    { href: "/refund",  label: t('footer.refund') },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <LocalizedLink href={href} className="hover:text-white transition-colors hover:translate-x-1 inline-block py-1">
                        {label}
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 border-t border-gray-800">
              <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                <p className="text-sm text-gray-400">© {new Date().getFullYear()} SmallPDF.us — All rights reserved.</p>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
                  <LocalizedLink href="/privacy" className="hover:text-white transition-colors">
                    {t('footer.privacy')}
                  </LocalizedLink>
                  <LocalizedLink href="/terms" className="hover:text-white transition-colors">
                    {t('footer.terms')}
                  </LocalizedLink>
                  <LocalizedLink href="/refund" className="hover:text-white transition-colors">
                    {t('footer.refund')}
                  </LocalizedLink>
                </div>
              </div>
              <p className="text-center md:text-left text-xs text-gray-500 mt-4">
                {t('footer.madeWith')}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}