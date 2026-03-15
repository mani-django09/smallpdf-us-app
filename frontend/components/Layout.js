import { useState, useRef, useEffect } from "react"
import { Menu, X, ChevronDown, FileText, Zap, Shield, Globe, User, LogOut, Settings } from "lucide-react"
import Script from "next/script"
import Link from "next/link"
import { useTranslations } from "../lib/i18n"
import LanguageSwitcher from "./LanguageSwitcher"
import { localePath } from "../lib/route-translations"
import { useAuth } from "../context/AuthContext"

// Locales that use localized URL slugs (all non-English locales)
const LOCALIZED_LOCALES = ['ja', 'de', 'fr', 'es', 'it', 'id', 'pt']

/**
 * A fully accessible dropdown nav item.
 */
function NavDropdown({ label, children }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [open])

  useEffect(() => {
    function handleKey(e) {
      if (!open) return
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const items = menuRef.current?.querySelectorAll("a, button")
        if (!items || items.length === 0) return
        const idx = Array.from(items).indexOf(document.activeElement)
        if (e.key === "ArrowDown") items[(idx + 1) % items.length]?.focus()
        else items[(idx - 1 + items.length) % items.length]?.focus()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  useEffect(() => {
    if (open) {
      const first = menuRef.current?.querySelector("a, button")
      first?.focus()
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center text-sm font-semibold text-gray-700 hover:text-red-600 px-3 py-2 rounded-lg transition-all hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        {label}
        <ChevronDown
          className={`w-4 h-4 ml-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute left-0 mt-1 w-52 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-50"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * User avatar dropdown — shown when logged in.
 */
function UserMenu({ user, logout, t }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [open])

  const planColors = { pro: "bg-red-500", enterprise: "bg-purple-600", free: "bg-gray-400" }
  const planColor = planColors[user?.plan] || planColors.free

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('layout.myAccount')}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        {/* Avatar circle with initial */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
        </div>
        <span className="hidden xl:block text-sm font-semibold text-gray-700 max-w-[100px] truncate">
          {user?.name}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-50">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
            <span className={`inline-block mt-2 text-xs text-white font-semibold px-2 py-0.5 rounded-full ${planColor}`}>
              {user?.plan === 'pro' ? '⭐ Pro' : user?.plan === 'enterprise' ? '🏢 Enterprise' : t('account.planBadgeFree')}
            </span>
          </div>

          {/* Menu items */}
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            {t('layout.myAccount')}
          </Link>

          <button
            onClick={() => { setOpen(false); logout() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            {t('layout.logOut')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout({ children, title, description }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t, locale } = useTranslations()
  const { user, loading, logout } = useAuth()

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
      {/* Google AdSense — skip entirely for paid subscribers */}
      {!["starter", "pro", "agency"].includes(user?.plan) && (
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6913093595582462"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}

      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="flex items-center justify-between h-16">

              {/* Logo */}
              <LocalizedLink
                href="/"
                aria-label="SmallPDF.us — Home"
                className="flex items-center space-x-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
              >
                <div className="flex items-center">
                  <span className="text-xl md:text-2xl font-bold text-gray-900">Small</span>
                  <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">PDF</span>
                  <span className="text-sm text-gray-500 ml-1">.us</span>
                </div>
              </LocalizedLink>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center space-x-1" aria-label="Main navigation">
                <LocalizedLink
                  href="/merge-pdf"
                  className="text-sm font-semibold text-gray-700 hover:text-red-600 px-3 py-2 rounded-lg transition-all hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {t('nav.mergePdf')}
                </LocalizedLink>
                <LocalizedLink
                  href="/split-pdf"
                  className="text-sm font-semibold text-gray-700 hover:text-red-600 px-3 py-2 rounded-lg transition-all hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {t('nav.splitPdf')}
                </LocalizedLink>
                <LocalizedLink
                  href="/compress-pdf"
                  className="text-sm font-semibold text-gray-700 hover:text-red-600 px-3 py-2 rounded-lg transition-all hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {t('nav.compressPdf')}
                </LocalizedLink>

                {/* Convert Dropdown */}
                <NavDropdown label={t('nav.convert')}>
                  <div
                    role="presentation"
                    className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    PDF {t('nav.convert')}
                  </div>
                  {[
                    { href: "/pdf-to-word",  label: t('nav.pdfToWord') },
                    { href: "/word-to-pdf",  label: t('nav.wordToPdf') },
                    { href: "/pdf-to-jpg",   label: t('nav.pdfToJpg') },
                    { href: "/jpg-to-pdf",   label: t('nav.jpgToPdf') },
                    { href: "/png-to-pdf",   label: t('nav.pngToPdf') },
                    { href: "/pdf-to-png",   label: t('nav.pdfToPng') },
                  ].map(({ href, label }) => (
                    <LocalizedLink
                      key={href}
                      href={href}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus-visible:bg-red-50 focus-visible:text-red-600"
                    >
                      {label}
                    </LocalizedLink>
                  ))}
                  <div className="border-t border-gray-100 my-1" role="separator" />
                  <div
                    role="presentation"
                    className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {t('nav.imageTools')}
                  </div>
                  {[
                    { href: "/webp-to-png", label: t('nav.webpToPng') },
                    { href: "/png-to-webp", label: t('nav.pngToWebp') },
                  ].map(({ href, label }) => (
                    <LocalizedLink
                      key={href}
                      href={href}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus-visible:bg-red-50 focus-visible:text-red-600"
                    >
                      {label}
                    </LocalizedLink>
                  ))}
                </NavDropdown>

                {/* All Tools Dropdown */}
                <NavDropdown label={t('nav.allTools')}>
                  {[
                    { href: "/ocr-pdf",        label: t('nav.ocrPdf') },
                    { href: "/compress-image", label: t('nav.compressImage') },
                    { href: "/pdf-to-excel",   label: t('nav.pdfToExcel') },
                    { href: "/excel-to-pdf",   label: t('nav.excelToPdf') },
                    { href: "/pdf-to-ppt",     label: t('nav.pdfToPpt') },
                    { href: "/ppt-to-pdf",     label: t('nav.pptToPdf') },
                    { href: "/unlock-pdf",     label: t('nav.unlockPdf') },
                  ].map(({ href, label }) => (
                    <LocalizedLink
                      key={href}
                      href={href}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus-visible:bg-red-50 focus-visible:text-red-600"
                    >
                      {label}
                    </LocalizedLink>
                  ))}
                </NavDropdown>

                <LanguageSwitcher />
              </nav>

              {/* ── Auth Buttons (desktop) ───────────────────────────────── */}
              <div className="hidden lg:flex items-center gap-2 ml-2">
                {loading ? (
                  // Skeleton placeholder while auth state loads
                  <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                ) : user ? (
                  // Logged-in: show avatar dropdown
                  <UserMenu user={user} logout={logout} t={t} />
                ) : (
                  // Logged-out: show Login + Sign Up
                  <>
                    <Link
                      href="/auth/login"
                      className="text-sm font-semibold text-gray-700 hover:text-red-600 px-3 py-2 rounded-lg transition-all hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      {t('layout.logIn')}
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                    >
                      {t('layout.signUpFree')}
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile menu toggle */}
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-gray-700" aria-hidden="true" />
                ) : (
                  <Menu className="w-6 h-6 text-gray-700" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <nav
                id="mobile-menu"
                aria-label="Mobile navigation"
                className="lg:hidden py-4 border-t border-gray-100 space-y-1"
              >
                {[
                  { href: "/merge-pdf",      label: t('nav.mergePdf') },
                  { href: "/split-pdf",      label: t('nav.splitPdf') },
                  { href: "/compress-pdf",   label: t('nav.compressPdf') },
                  { href: "/pdf-to-word",    label: t('nav.pdfToWord') },
                  { href: "/word-to-pdf",    label: t('nav.wordToPdf') },
                  { href: "/pdf-to-jpg",     label: t('nav.pdfToJpg') },
                  { href: "/jpg-to-pdf",     label: t('nav.jpgToPdf') },
                  { href: "/png-to-pdf",     label: t('nav.pngToPdf') },
                  { href: "/pdf-to-png",     label: t('nav.pdfToPng') },
                  { href: "/compress-image", label: t('nav.compressImage') },
                  { href: "/pdf-to-excel",   label: t('nav.pdfToExcel') },
                  { href: "/excel-to-pdf",   label: t('nav.excelToPdf') },
                  { href: "/pdf-to-ppt",     label: t('nav.pdfToPpt') },
                  { href: "/ppt-to-pdf",     label: t('nav.pptToPdf') },
                  { href: "/webp-to-png",    label: t('nav.webpToPng') },
                  { href: "/png-to-webp",    label: t('nav.pngToWebp') },
                  { href: "/unlock-pdf",     label: t('nav.unlockPdf') },
                  { href: "/ocr-pdf",        label: t('nav.ocrPdf') },
                  { href: "/pricing",        label: t('nav.pricing') },
                ].map(({ href, label }) => (
                  <LocalizedLink
                    key={href}
                    href={href}
                    className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {label}
                  </LocalizedLink>
                ))}

                {/* ── Auth section in mobile menu ── */}
                <div className="pt-3 border-t border-gray-100 mt-2 space-y-2 px-2">
                  {!loading && (
                    user ? (
                      // Logged-in mobile: show name + account link + logout
                      <>
                        <div className="flex items-center gap-3 px-2 py-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {user.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                        <Link
                          href="/account"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Settings className="w-4 h-4" /> {t('layout.myAccount')}
                        </Link>
                        <button
                          onClick={() => { setMobileMenuOpen(false); logout() }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> {t('layout.logOut')}
                        </button>
                      </>
                    ) : (
                      // Logged-out mobile: Login + Sign Up buttons
                      <div className="flex flex-col gap-2">
                        <Link
                          href="/auth/login"
                          onClick={() => setMobileMenuOpen(false)}
                          className="block text-center px-4 py-3 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {t('layout.logIn')}
                        </Link>
                        <Link
                          href="/auth/signup"
                          onClick={() => setMobileMenuOpen(false)}
                          className="block text-center px-4 py-3 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                          {t('layout.signUpFree')}
                        </Link>
                      </div>
                    )
                  )}
                  <div className="pt-2">
                    <LanguageSwitcher />
                  </div>
                </div>
              </nav>
            )}
          </div>
        </header>

        <main>{children}</main>

        {/* Footer */}
        <footer className="bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-gray-300 mt-20">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
              <div className="lg:col-span-2">
                <div className="flex items-center space-x-2.5 mb-4">
                  <div className="flex items-center">
                    <span className="text-xl font-bold text-white">Small</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">PDF</span>
                    <span className="text-sm text-gray-400 ml-1">.us</span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-sm">
                  {t('footer.description')}
                </p>
                <div className="flex items-center space-x-4">
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
              </div>

              {/* PDF Tools */}
              <div>
                <h3 className="font-bold mb-4 text-white text-sm uppercase tracking-wider">
                  {t('footer.pdfTools')}
                </h3>
                <ul className="space-y-3 text-sm">
                  {[
                    { href: "/merge-pdf",    label: t('nav.mergePdf') },
                    { href: "/split-pdf",    label: t('nav.splitPdf') },
                    { href: "/compress-pdf", label: t('nav.compressPdf') },
                    { href: "/pdf-to-word",  label: t('nav.pdfToWord') },
                    { href: "/word-to-pdf",  label: t('nav.wordToPdf') },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <LocalizedLink href={href} className="hover:text-white transition-colors hover:translate-x-1 inline-block">
                        {label}
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Convert Tools */}
              <div>
                <h3 className="font-bold mb-4 text-white text-sm uppercase tracking-wider">
                  {t('footer.convert')}
                </h3>
                <ul className="space-y-3 text-sm">
                  {[
                    { href: "/pdf-to-jpg",     label: t('nav.pdfToJpg') },
                    { href: "/jpg-to-pdf",     label: t('nav.jpgToPdf') },
                    { href: "/png-to-pdf",     label: t('nav.pngToPdf') },
                    { href: "/compress-image", label: t('nav.compressImage') },
                    { href: "/webp-to-png",    label: t('nav.webpToPng') },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <LocalizedLink href={href} className="hover:text-white transition-colors hover:translate-x-1 inline-block">
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
                <ul className="space-y-3 text-sm">
                  {[
                    { href: "/about",   label: t('footer.aboutUs') },
                    { href: "/pricing", label: t('nav.pricing') },
                    { href: "/blog",    label: t('footer.blog') },
                    { href: "/contact", label: t('footer.contact') },
                    { href: "/privacy", label: t('footer.privacy') },
                    { href: "/terms",   label: t('footer.terms') },
                    { href: "/refund",  label: t('footer.refund') },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <LocalizedLink href={href} className="hover:text-white transition-colors hover:translate-x-1 inline-block">
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
                <div className="flex items-center space-x-6 text-sm text-gray-400">
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