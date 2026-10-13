// Slim, dismissible "Add to Chrome" bar.
//
// Renders nothing until CHROME_WEBSTORE_URL is filled in, so this can ship
// before the extension is actually published — the day the listing goes live,
// paste the URL here and the bar turns itself on.

import { useEffect, useState } from 'react'
import { useTranslations } from '../lib/i18n'

// t() has no English fallback — pages without common.json messages would show
// raw keys, so fall back to English here.
const EN = { oneClick: 'Use these tools in one click —', addToChrome: 'Add SmallPDF.us to Chrome', dismiss: 'Dismiss', freeExtension: 'Free extension', addChromeShort: 'Add to Chrome' }
function useExtText() {
  const { t } = useTranslations()
  return (k) => { const v = t('extension.' + k); return v === 'extension.' + k ? EN[k] : v }
}

// Chrome Web Store listing (published 2026-09-19). Setting this to '' hides
// the banner site-wide again.
const CHROME_WEBSTORE_URL = 'https://chromewebstore.google.com/detail/kchomiinjaggainhmkakdagceknihkpk'

const DISMISS_KEY = 'ext_banner_dismissed'

// Chrome/Edge on desktop only — the Web Store link is useless anywhere else.
// Client-only (needs navigator), so callers must run it inside an effect.
function canInstallExtension() {
  if (!CHROME_WEBSTORE_URL) return false
  const ua = navigator.userAgent
  const isChromium = /Chrome|Chromium|Edg/.test(ua) && !/OPR|Firefox/.test(ua)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)
  return isChromium && !isMobile
}

// Permanent footer link. Unlike the top bar it has no dismiss state — it's the
// place someone can still find the extension after closing the banner.
export function InstallExtensionFooterBadge() {
  const tx = useExtText()
  const [show, setShow] = useState(false)
  useEffect(() => { setShow(canInstallExtension()) }, [])
  if (!show) return null

  return (
    <a
      href={CHROME_WEBSTORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-left transition-colors hover:border-red-400 hover:bg-gray-800"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
           className="text-red-400 flex-shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.2" />
        <path d="M21 9H12" /><path d="M8.6 14.5L4.2 6.9" /><path d="M15.4 14.5l-4.4 7.6" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-wider text-gray-400">{tx('freeExtension')}</span>
        <span className="block text-sm font-semibold text-white">{tx('addChromeShort')}</span>
      </span>
    </a>
  )
}

export default function InstallExtensionBanner() {
  // Decided client-side only: the bar depends on the browser and on
  // localStorage, neither of which exist during SSR. Rendering it on the server
  // would mean a hydration mismatch and a flash of a bar we then hide.
  const tx = useExtText()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!canInstallExtension()) return

    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {
      // Private mode / storage blocked — showing the bar once is fine.
    }

    setShow(true)
  }, [])

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
  }

  if (!show) return null

  return (
    <div className="relative bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3 text-sm">
        <span className="hidden sm:inline text-slate-300">
          {tx('oneClick')}
        </span>
        <a
          href={CHROME_WEBSTORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-red-300 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3.2" />
            <path d="M21 9H12" /><path d="M8.6 14.5L4.2 6.9" /><path d="M15.4 14.5l-4.4 7.6" />
          </svg>
          {tx('addToChrome')}
        </a>
        <button
          onClick={dismiss}
          aria-label={tx('dismiss')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
