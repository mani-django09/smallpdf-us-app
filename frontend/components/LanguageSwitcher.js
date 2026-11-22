import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Globe, Loader2, ChevronDown, Check } from 'lucide-react'
import { localePath } from '../lib/route-translations'

// Native names are shown in their own script so people can always find their language.
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pl', name: 'Polski' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'ja', name: '日本語' },
]

// inline = always rendered in normal flow (mobile drawer). Default = floating menu (desktop bar).
export default function LanguageSwitcher({ inline = false }) {
  const router = useRouter()
  const { locale, pathname, asPath } = router
  const [switching, setSwitching] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const closeTimer = useRef(null)
  const byHover = useRef(false)

  const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0]

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); rootRef.current?.querySelector('button')?.focus() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  // Hard navigation: the client router can't fetch /_next/data for localized slugs
  // (e.g. /fr/compresser-pdf.json doesn't exist), so a normal page load is used and the
  // server rewrite picks the right page. Dynamic routes (blog posts) fall back to the real path.
  const hrefFor = (code) => {
    const base = pathname.includes('[') ? (asPath || '/').split(/[?#]/)[0] : pathname
    return localePath(base, code)
  }
  const onPick = (e, code) => {
    if (code === locale) { e.preventDefault(); setOpen(false); return }
    if (switching) { e.preventDefault(); return }
    setSwitching(true)
  }

  const hoverOpen = () => { if (inline) return; clearTimeout(closeTimer.current); if (!open) byHover.current = true; setOpen(true) }
  const hoverClose = () => { if (inline) return; byHover.current = false; clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 160) }

  const panel = (
    <ul
      role="listbox"
      aria-label="Language"
      className={
        inline
          ? 'mt-2 grid grid-cols-2 gap-1'
          : 'grid max-h-[min(70vh,420px)] grid-cols-2 gap-1 overflow-y-auto overscroll-contain'
      }
    >
      {LANGUAGES.map((lang) => {
        const active = lang.code === locale
        return (
          <li key={lang.code} role="presentation">
            <a
              href={hrefFor(lang.code)}
              hrefLang={lang.code}
              lang={lang.code}
              role="option"
              aria-selected={active}
              onClick={(e) => onPick(e, lang.code)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#14130F] ${
                active ? 'bg-red-50 font-semibold text-red-600' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{lang.name}</span>
              {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            </a>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div
      ref={rootRef}
      className={inline ? 'relative' : 'relative'}
      onMouseEnter={hoverOpen}
      onMouseLeave={hoverClose}
    >
      <button
        type="button"
        className={
          inline
            ? 'flex w-full items-center gap-2 rounded-2xl border-2 border-[#14130F]/15 bg-white px-4 py-3 text-sm font-bold text-[#14130F] outline-none focus-visible:ring-2 focus-visible:ring-[#14130F]'
            : 'flex items-center gap-1.5 rounded-lg px-2 py-2 text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#14130F] xl:px-2.5'
        }
        aria-label="Switch language"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          // a click right after the hover-open should keep the menu open, not flip it shut
          if (byHover.current) { byHover.current = false; setOpen(true); return }
          setOpen((v) => !v)
        }}
        disabled={switching}
      >
        {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" aria-hidden="true" />}
        {inline ? (
          <span className="flex-1 text-left">{current.name}</span>
        ) : (
          <>
            {/* compact code on mid-size bars, full name when there is room */}
            <span className="text-[14px] font-semibold uppercase xl:hidden">{current.code}</span>
            <span className="hidden text-[15px] font-medium xl:inline">{current.name}</span>
          </>
        )}
        <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {inline ? (
        open && panel
      ) : (
        open && (
          <div className="absolute right-0 top-full z-50 pt-2">
            <div className="w-[300px] rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl shadow-slate-900/10">
              {panel}
            </div>
          </div>
        )
      )}
    </div>
  )
}
