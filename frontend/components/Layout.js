import { useState, useRef, useEffect } from "react"
import {
  Menu, X, ChevronDown, Zap, Shield, Globe, User, LogOut, Settings,
  Merge, Scissors, Gauge, Unlock, Lock, RotateCw, EyeOff, ScanText, PenLine,
  FileText, FileImage, Image as ImageIcon, Table, Presentation, Sparkles, ArrowRight,
} from "lucide-react"
import Script from "next/script"
import Link from "next/link"
import { useRouter } from "next/router"
import { useTranslations } from "../lib/i18n"
import LanguageSwitcher from "./LanguageSwitcher"
import InstallExtensionBanner, { InstallExtensionFooterBadge } from "./InstallExtensionBanner"
import { localePath } from "../lib/route-translations"
import { useAuth } from "../context/AuthContext"

// Locales that use localized URL slugs (all non-English locales)
const LOCALIZED_LOCALES = ['ja', 'de', 'fr', 'es', 'it', 'id', 'pt']

// ── Mega-menu tool groups ────────────────────────────────────────────────────
// labelKey/descKey are i18n keys resolved at render time.
const PDF_ORGANIZE = [
  { href: "/merge-pdf",    Icon: Merge,    labelKey: 'nav.mergePdf',    descKey: 'navDesc.mergePdf' },
  { href: "/split-pdf",    Icon: Scissors, labelKey: 'nav.splitPdf',    descKey: 'navDesc.splitPdf' },
  { href: "/rotate-pdf",   Icon: RotateCw, labelKey: 'nav.rotatePdf',   descKey: 'navDesc.rotatePdf' },
  { href: "/compress-pdf", Icon: Gauge,    labelKey: 'nav.compressPdf', descKey: 'navDesc.compressPdf' },
  { href: "/edit-pdf",     Icon: PenLine,  labelKey: 'nav.editPdf',     descKey: 'navDesc.editPdf', isNew: true },
]
const PDF_SECURE = [
  { href: "/protect-pdf",  Icon: Lock,     labelKey: 'nav.protectPdf',  descKey: 'navDesc.protectPdf' },
  { href: "/unlock-pdf",   Icon: Unlock,   labelKey: 'nav.unlockPdf',   descKey: 'navDesc.unlockPdf' },
  { href: "/redact-pdf",   Icon: EyeOff,   labelKey: 'nav.redactPdf',   descKey: 'navDesc.redactPdf', isNew: true },
  { href: "/ocr-pdf",      Icon: ScanText, labelKey: 'nav.ocrPdf',      descKey: 'navDesc.ocrPdf',    isNew: true },
]
const CONVERT_TO_PDF = [
  { href: "/word-to-pdf",  Icon: FileText,     labelKey: 'nav.wordToPdf',  descKey: 'navDesc.wordToPdf' },
  { href: "/excel-to-pdf", Icon: Table,        labelKey: 'nav.excelToPdf', descKey: 'navDesc.excelToPdf' },
  { href: "/ppt-to-pdf",   Icon: Presentation, labelKey: 'nav.pptToPdf',   descKey: 'navDesc.pptToPdf' },
  { href: "/jpg-to-pdf",   Icon: FileImage,    labelKey: 'nav.jpgToPdf',   descKey: 'navDesc.jpgToPdf' },
  { href: "/png-to-pdf",   Icon: FileImage,    labelKey: 'nav.pngToPdf',   descKey: 'navDesc.pngToPdf' },
]
const CONVERT_FROM_PDF = [
  { href: "/pdf-to-word",  Icon: FileText,     labelKey: 'nav.pdfToWord',  descKey: 'navDesc.pdfToWord' },
  { href: "/pdf-to-excel", Icon: Table,        labelKey: 'nav.pdfToExcel', descKey: 'navDesc.pdfToExcel' },
  { href: "/pdf-to-ppt",   Icon: Presentation, labelKey: 'nav.pdfToPpt',   descKey: 'navDesc.pdfToPpt' },
  { href: "/pdf-to-jpg",   Icon: FileImage,    labelKey: 'nav.pdfToJpg',   descKey: 'navDesc.pdfToJpg' },
  { href: "/pdf-to-png",   Icon: FileImage,    labelKey: 'nav.pdfToPng',   descKey: 'navDesc.pdfToPng' },
]
const CONVERT_IMAGES = [
  { href: "/compress-image", Icon: Gauge,     labelKey: 'nav.compressImage', descKey: 'navDesc.compressImage' },
  { href: "/compress-image-to-50kb", Icon: Gauge, labelKey: 'nav.compressImage50kb', descKey: 'navDesc.compressImage50kb' },
  { href: "/compress-image-to-100kb", Icon: Gauge, labelKey: 'nav.compressImage100kb', descKey: 'navDesc.compressImage100kb' },
  { href: "/compress-image-to-20kb", Icon: Gauge, labelKey: 'nav.compressImage20kb', descKey: 'navDesc.compressImage20kb' },
  { href: "/heic-to-jpg",    Icon: ImageIcon, labelKey: 'nav.heicToJpg',     descKey: 'navDesc.heicToJpg' },
  { href: "/heic-to-png",    Icon: ImageIcon, labelKey: 'nav.heicToPng',     descKey: 'navDesc.heicToPng' },
  { href: "/webp-to-png",    Icon: ImageIcon, labelKey: 'nav.webpToPng',     descKey: 'navDesc.webpToPng' },
  { href: "/png-to-webp",    Icon: ImageIcon, labelKey: 'nav.pngToWebp',     descKey: 'navDesc.pngToWebp' },
]

/**
 * A fully accessible dropdown nav item.
 */
function NavDropdown({ label, children, panelClassName = "w-52 py-2" }) {
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
        className={`flex items-center text-[15px] font-medium px-3 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
          open ? "text-slate-900 bg-slate-100" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
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
          onClick={() => setOpen(false)}
          className={`absolute left-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-slate-900/10 z-50 ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * One tool row inside a mega-menu panel: icon + label + short description.
 */
function MegaItem({ href, label, desc, Icon, active, LinkComp, isNew }) {
  return (
    <LinkComp
      href={href}
      role="menuitem"
      className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        active ? "bg-red-50" : "hover:bg-slate-50"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
          active ? "bg-red-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-red-600 group-hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={`block text-sm font-semibold leading-tight ${active ? "text-red-700" : "text-slate-800 group-hover:text-red-700"}`}>
            {label}
          </span>
          {isNew && (
            <span className="flex-shrink-0 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
              New
            </span>
          )}
        </span>
        {desc && <span className="mt-0.5 block text-xs leading-snug text-slate-500">{desc}</span>}
      </span>
    </LinkComp>
  )
}

/** Section heading inside a mega-menu column. */
function MegaHeading({ children }) {
  return (
    <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
  )
}

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
  const router = useRouter()
  const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : (router.asPath || '/')
  const redirectParam = encodeURIComponent(currentPath)

  // router.pathname is always the EN page path (e.g. "/compress-pdf"), even on
  // localized URLs — so it's the reliable key for highlighting the active tool.
  const isActive = (href) => router.pathname === href || router.pathname.startsWith(href + "/")

  // Header lifts off the page once you scroll — flat at top, elevated after.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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
        <InstallExtensionBanner />
        <header
          className={`sticky top-0 z-40 bg-white/80 backdrop-blur-xl transition-all duration-300 ${
            scrolled
              ? "border-b border-slate-200/80 shadow-lg shadow-slate-900/5"
              : "border-b border-slate-100"
          }`}
        >
          <div className="max-w-7xl mx-auto px-3 md:px-5">
            <div className="flex items-center justify-between h-[68px]">

              {/* Logo — text only */}
              <Link
                href="/"
                className="group flex items-center flex-shrink-0 rounded-xl transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                aria-label="SmallPDF.us home"
              >
                <Logo />
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
                <LocalizedLink
                  href="/merge-pdf"
                  className={`text-[15px] font-medium px-3 py-2 rounded-lg transition-colors ${
                    isActive("/merge-pdf") ? "text-red-600 bg-red-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {t('nav.mergePdf')}
                </LocalizedLink>
                <LocalizedLink
                  href="/split-pdf"
                  className={`text-[15px] font-medium px-3 py-2 rounded-lg transition-colors ${
                    isActive("/split-pdf") ? "text-red-600 bg-red-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {t('nav.splitPdf')}
                </LocalizedLink>
                {/* ── PDF Tools mega-menu ── */}
                <NavDropdown label={t('nav.pdfTools')} panelClassName="w-[560px] p-3">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <div>
                      <MegaHeading>{t('nav.groupOrganize')}</MegaHeading>
                      {PDF_ORGANIZE.map((item) => (
                        <MegaItem key={item.href} {...item} label={t(item.labelKey)} desc={t(item.descKey)}
                          active={isActive(item.href)} LinkComp={LocalizedLink} />
                      ))}
                    </div>
                    <div>
                      <MegaHeading>{t('nav.groupSecure')}</MegaHeading>
                      {PDF_SECURE.map((item) => (
                        <MegaItem key={item.href} {...item} label={t(item.labelKey)} desc={t(item.descKey)}
                          active={isActive(item.href)} LinkComp={LocalizedLink} />
                      ))}
                    </div>
                  </div>
                </NavDropdown>

                {/* ── Convert mega-menu ── */}
                <NavDropdown label={t('nav.convert')} panelClassName="w-[760px] p-3">
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                    <div>
                      <MegaHeading>{t('nav.groupToPdf')}</MegaHeading>
                      {CONVERT_TO_PDF.map((item) => (
                        <MegaItem key={item.href} {...item} label={t(item.labelKey)} desc={t(item.descKey)}
                          active={isActive(item.href)} LinkComp={LocalizedLink} />
                      ))}
                    </div>
                    <div>
                      <MegaHeading>{t('nav.groupFromPdf')}</MegaHeading>
                      {CONVERT_FROM_PDF.map((item) => (
                        <MegaItem key={item.href} {...item} label={t(item.labelKey)} desc={t(item.descKey)}
                          active={isActive(item.href)} LinkComp={LocalizedLink} />
                      ))}
                    </div>
                    <div>
                      <MegaHeading>{t('nav.groupImages')}</MegaHeading>
                      {CONVERT_IMAGES.map((item) => (
                        <MegaItem key={item.href} {...item} label={t(item.labelKey)} desc={t(item.descKey)}
                          active={isActive(item.href)} LinkComp={LocalizedLink} />
                      ))}
                    </div>
                  </div>
                </NavDropdown>

                <LocalizedLink
                  href="/pricing"
                  className={`flex items-center gap-1.5 text-[15px] font-medium px-3 py-2 rounded-lg transition-colors ${
                    isActive("/pricing") ? "text-red-600 bg-red-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  {t('nav.pricing')}
                </LocalizedLink>
              </nav>

              {/* Desktop Right: Auth + Language */}
              <div className="hidden md:flex items-center gap-1.5">
                <LanguageSwitcher />
                {/* divider between utility + account actions */}
                <span className="h-5 w-px bg-slate-200 mx-1.5" aria-hidden="true" />
                {!loading && (
                  user ? (
                    <UserMenu user={user} logout={logout} t={t} />
                  ) : (
                    <>
                      <Link
                        href={`/auth/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
                        className="text-[15px] font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors hover:bg-slate-100"
                      >
                        {t('layout.logIn')}
                      </Link>
                      <Link
                        href={`/auth/signup?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
                        className="group/cta relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-br from-red-500 via-red-600 to-rose-600 px-[18px] py-2.5 text-[15px] font-semibold text-white shadow-lg shadow-red-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]"
                      >
                        {/* sheen sweep on hover */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/cta:translate-x-full"
                        />
                        <span className="relative">{t('layout.signUpFree')}</span>
                        <ArrowRight
                          className="relative w-4 h-4 transition-transform duration-200 group-hover/cta:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </>
                  )
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1 max-h-[80vh] overflow-y-auto" aria-label="Mobile navigation">
              <div className="mb-3">
                {[
                  { heading: t('nav.groupOrganize'), items: PDF_ORGANIZE },
                  { heading: t('nav.groupSecure'),   items: PDF_SECURE },
                  { heading: t('nav.groupToPdf'),    items: CONVERT_TO_PDF },
                  { heading: t('nav.groupFromPdf'),  items: CONVERT_FROM_PDF },
                  { heading: t('nav.groupImages'),   items: CONVERT_IMAGES },
                ].map(({ heading, items }) => (
                  <div key={heading} className="mb-3">
                    <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{heading}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {items.map(({ href, labelKey, Icon }) => (
                        <LocalizedLink
                          key={href}
                          href={href}
                          className={`flex items-center gap-2 px-2.5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                            isActive(href) ? "bg-red-50 text-red-700" : "text-gray-700 hover:bg-slate-50"
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate">{t(labelKey)}</span>
                        </LocalizedLink>
                      ))}
                    </div>
                  </div>
                ))}
                <LocalizedLink
                  href="/pricing"
                  className="flex items-center gap-2 px-2.5 py-3 text-sm font-semibold text-red-600 bg-red-50 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" /> {t('nav.pricing')}
                </LocalizedLink>
              </div>

              {/* ── Auth section in mobile menu ── */}
              <div className="pt-3 border-t border-gray-100 mt-2 space-y-2 px-2">
                {!loading && (
                  user ? (
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
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/auth/login?redirect=${redirectParam}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block text-center px-4 py-3 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('layout.logIn')}
                      </Link>
                      <Link
                        href={`/auth/signup?redirect=${redirectParam}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-br from-red-500 via-red-600 to-rose-600 rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-[0.98]"
                      >
                        {t('layout.signUpFree')}
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
        </header>

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