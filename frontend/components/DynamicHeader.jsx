// Site header (light bar).
//  * the bar itself uses plain React + native elements, so it adds almost no JavaScript to every page
//  * mega menus, the account menu and the mobile drawer (React Aria) are separate chunks,
//    loaded the first time you hover / focus / press the matching button
//  * one NAV config (navData.js) drives desktop bar, mega menus and drawer
//  * full-width lime bar at the top -> floating pill after you scroll; always visible
//  * sliding highlight, reading-progress line, fixed 72px slot (no layout shift)
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/router"
import { ArrowRight, ChevronDown, Menu as MenuIcon, User } from "lucide-react"
import { useTranslations } from "../lib/i18n"
import { localePath } from "../lib/route-translations"
import { useAuth } from "../context/AuthContext"
import LanguageSwitcher from "./LanguageSwitcher"
import { buildNav } from "./navData"

// lazy chunks (client only; they render nothing until opened)
const loadMega = () => import("./header/MegaPanel")
const loadAccount = () => import("./header/AccountPanel")
const loadDrawer = () => import("./header/MobileDrawer")
const MegaPanel = dynamic(loadMega, { ssr: false })
const AccountPanel = dynamic(loadAccount, { ssr: false })
const MobileDrawer = dynamic(loadDrawer, { ssr: false })

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect
const LOCALIZED = ["ja", "de", "fr", "es", "it", "id", "pt"]
const hrefFor = (href, locale) => (LOCALIZED.includes(locale) ? localePath(href, locale) : href)

// lime bar colours
const T = {
  icon: "text-[#8A4B00]",
  flat: "bg-[#C6F432]/95",
  float: "bg-[#C6F432]/95 border-[#14130F]",
  flatBorder: "border-[#14130F]/10",
  text: "text-[#14130F]",
  muted: "text-[#14130F]/70 hover:text-[#14130F]",
  hl: "bg-[#14130F]/10",
  divider: "bg-[#14130F]/25",
  ring: "focus-visible:ring-[#14130F]",
  logoSmall: "text-[#14130F]/65",
  logoPdf: "text-[#14130F]",
  logoUs: "text-[#D6293E]",
  progress: "bg-[#14130F]",
  cta: "bg-[#14130F] text-white hover:bg-[#2B5BFF] focus-visible:ring-[#14130F]",
  hoverBg: "hover:bg-[#14130F]/10 hover:text-[#14130F]",
  login: "text-[#14130F]/80",
  acct: "border-[#14130F] bg-white text-[#14130F]",
  acctDot: "bg-[#14130F] text-white",
  lang: "[&>div>button:first-of-type]:text-[#14130F]/75 [&>div>button:first-of-type]:hover:bg-[#14130F]/10 [&>div>button:first-of-type]:hover:text-[#14130F]",
}

/* Logo: text only, scales down a little once the bar floats. */
function Logo({ compact }) {
  return (
    <span className="inline-flex select-none items-baseline leading-none">
      <span className={`font-semibold tracking-tight ${T.logoSmall} transition-all duration-300 ${compact ? "text-[17px]" : "text-[20px]"}`}>Small</span>
      <span className={`font-black tracking-tight ${T.logoPdf} transition-all duration-300 ${compact ? "text-[20px]" : "text-[25px]"}`}>PDF</span>
      <span className={`ml-[2px] font-extrabold ${T.logoUs} transition-all duration-300 ${compact ? "text-[13px]" : "text-[15px]"}`}>.us</span>
    </span>
  )
}

export default function DynamicHeader() {
  const { t, locale } = useTranslations()
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const nav = buildNav(t)
  const isActive = (href) => router.pathname === href || router.pathname.startsWith(href + "/")

  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const [openMenu, setOpenMenu] = useState(null) // mega menu id
  const [accountOpen, setAccountOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        setScrolled(y > 24)
        const max = document.documentElement.scrollHeight - window.innerHeight
        setProgress(max > 0 ? Math.min(1, y / max) : 0)
        ticking = false
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* sliding highlight */
  const itemRefs = useRef({})
  const btnRefs = useRef({})
  const [hover, setHover] = useState(null)
  const [pill, setPill] = useState(null)
  const activeId = (nav.find((n) => (n.type === "link" ? isActive(n.href) : n.groups.some((g) => g.items.some((i) => isActive(i.href))))) || {}).id
  const target = hover || openMenu || activeId
  useIsoLayoutEffect(() => {
    const el = itemRefs.current[target]
    setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
  }, [target, locale, scrolled])
  const reg = (id) => (el) => { if (el) itemRefs.current[id] = el }
  const hp = (id) => ({ onMouseEnter: () => setHover(id), onMouseLeave: () => setHover(null), onFocus: () => setHover(id), onBlur: () => setHover(null) })

  /* mega-menu hover intent */
  const timer = useRef(null)
  const openLater = (id) => { loadMega(); clearTimeout(timer.current); timer.current = setTimeout(() => setOpenMenu(id), 90) }
  const closeLater = (id) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpenMenu((cur) => (cur === id ? null : cur)), 160) }
  const holdOpen = () => clearTimeout(timer.current)
  useEffect(() => () => clearTimeout(timer.current), [])
  const closeMega = useCallback((v) => {
    if (v) return
    setOpenMenu(null)
  }, [])

  const redirect = encodeURIComponent(router.asPath || "/")
  const megaRefFor = (id) => ({ current: btnRefs.current[id] })
  const accountRef = useRef(null)

  return (
    // Fixed 72px slot: the bar changing shape never moves the page content (no layout shift).
    <header
      className={`pointer-events-none sticky top-0 z-40 box-border h-[72px] transition-[padding] duration-300 ${scrolled ? "px-2 pt-2 sm:px-4" : "px-0"}`}
      style={{ fontFamily: "'Sora','Instrument Sans',system-ui,sans-serif" }}
    >
      <div
        className={`pointer-events-auto relative mx-auto backdrop-blur-xl transition-all duration-300 ease-out ${
          scrolled
            ? `max-w-6xl overflow-hidden rounded-full border-2 ${T.float} shadow-[0_18px_40px_-20px_rgba(20,19,15,0.55)]`
            : `max-w-full rounded-none border-b ${T.flatBorder} ${T.flat}`
        }`}
      >
        <div className={`mx-auto flex items-center justify-between px-3 transition-all duration-300 md:px-5 ${scrolled ? "h-[54px] max-w-none" : "h-[72px] max-w-7xl"}`}>
          <Link href="/" className={`rounded-xl outline-none focus-visible:ring-2 ${T.ring}`} aria-label="SmallPDF.us home">
            <Logo compact={scrolled} />
          </Link>

          {/* desktop nav */}
          <nav aria-label="Main navigation" className="relative hidden items-center lg:flex">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-1/2 h-9 -translate-y-1/2 rounded-full ${T.hl} transition-all duration-300 ease-out`}
              style={pill ? { left: pill.left, width: pill.width, opacity: 1 } : { left: 0, width: 0, opacity: 0 }}
            />
            {nav.map((n) =>
              n.type === "link" ? (
                <Link
                  key={n.id}
                  ref={reg(n.id)}
                  href={hrefFor(n.href, locale)}
                  locale={false}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  {...hp(n.id)}
                  className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[14px] font-semibold outline-none transition-colors focus-visible:ring-2 ${T.ring} xl:px-3.5 xl:text-[15px] ${isActive(n.href) ? T.text : T.muted}`}
                >
                  {n.Icon && <n.Icon className={`h-4 w-4 ${T.icon}`} aria-hidden="true" />}
                  {n.label}
                </Link>
              ) : (
                <span key={n.id} ref={reg(n.id)} className="relative">
                  <button
                    type="button"
                    ref={(el) => { if (el) btnRefs.current[n.id] = el }}
                    aria-haspopup="dialog"
                    aria-expanded={openMenu === n.id}
                    onClick={() => { loadMega(); setOpenMenu((cur) => (cur === n.id ? null : n.id)) }}
                    onMouseEnter={() => { setHover(n.id); openLater(n.id) }}
                    onMouseLeave={() => { setHover(null); closeLater(n.id) }}
                    onFocus={() => { setHover(n.id); loadMega() }}
                    onBlur={() => setHover(null)}
                    className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-[14px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-current xl:px-3.5 xl:text-[15px] ${activeId === n.id || openMenu === n.id ? T.text : T.muted}`}
                  >
                    {n.label}
                    <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform duration-200 ${openMenu === n.id ? "rotate-180" : ""}`} />
                  </button>
                </span>
              )
            )}
          </nav>

          {/* right side */}
          <div className="hidden items-center gap-1 lg:flex xl:gap-1.5">
            <div className={T.lang}><LanguageSwitcher /></div>
            <span className={`mx-1.5 h-5 w-px ${T.divider}`} aria-hidden="true" />
            {!loading && (user ? (
              <button
                type="button"
                ref={accountRef}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label={t("layout.myAccount")}
                onMouseEnter={loadAccount}
                onFocus={loadAccount}
                onClick={() => { loadAccount(); setAccountOpen((v) => !v) }}
                className={`flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-2.5 text-sm font-semibold outline-none focus-visible:ring-2 ${T.ring} ${T.acct}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${T.acctDot}`}>
                  {user?.name?.[0]?.toUpperCase() || <User className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="hidden max-w-[100px] truncate xl:block">{user?.name}</span>
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-60" />
              </button>
            ) : (
              <>
                <Link href={`/auth/login?redirect=${redirect}`} className={`whitespace-nowrap rounded-full px-3 py-2 text-[14px] font-semibold outline-none transition focus-visible:ring-2 ${T.ring} ${T.login} ${T.hoverBg} xl:px-3.5 xl:text-[15px]`}>
                  {t("layout.logIn")}
                </Link>
                <Link href={`/auth/signup?redirect=${redirect}`} className={`group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-[14px] font-semibold outline-none transition focus-visible:ring-2 xl:px-5 xl:text-[15px] ${T.cta}`}>
                  {t("layout.signUpFree")}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </>
            ))}
          </div>

          {/* mobile button */}
          <button
            type="button"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={drawer}
            onPointerDown={loadDrawer}
            onFocus={loadDrawer}
            onClick={() => { loadDrawer(); setDrawer(true) }}
            className={`flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-current ${T.text} ${T.hoverBg} lg:hidden`}
          >
            <MenuIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* reading progress */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px]">
          <div className={`h-full origin-left ${T.progress} transition-[transform,opacity] duration-150`} style={{ transform: `scaleX(${progress})`, opacity: scrolled ? 1 : 0 }} />
        </div>
      </div>

      {/* lazy panels: only mounted (and downloaded) once opened */}
      {nav.filter((n) => n.type === "mega" && openMenu === n.id).map((n) => (
        <MegaPanel
          key={n.id}
          item={n}
          triggerRef={megaRefFor(n.id)}
          onOpenChange={closeMega}
          onEnter={holdOpen}
          onLeave={() => closeLater(n.id)}
          t={t}
          locale={locale}
          isActive={isActive}
          onNavigate={() => setOpenMenu(null)}
        />
      ))}
      {accountOpen && user && (
        <AccountPanel user={user} logout={logout} t={t} triggerRef={accountRef} onOpenChange={(v) => { if (!v) setAccountOpen(false) }} />
      )}
      {drawer && (
        <MobileDrawer
          nav={nav}
          t={t}
          locale={locale}
          isActive={isActive}
          user={user}
          loading={loading}
          logout={logout}
          redirect={redirect}
          onClose={() => setDrawer(false)}
          logo={<Logo />}
        />
      )}
    </header>
  )
}
