import { useState } from 'react'
import { useRouter } from 'next/router'
import { Globe, Loader2 } from 'lucide-react'
import { localePath } from '../lib/route-translations'

export default function LanguageSwitcher() {
  const router = useRouter()
  const { locale, pathname } = router
  const [switching, setSwitching] = useState(false)

  const languages = [
    { code: 'en', name: 'English',           flag: '🇺🇸' },
    { code: 'ja', name: '日本語',            flag: '🇯🇵' },
    { code: 'de', name: 'Deutsch',           flag: '🇩🇪' },
    { code: 'fr', name: 'Français',          flag: '🇫🇷' },
    { code: 'es', name: 'Español',           flag: '🇪🇸' },
    { code: 'it', name: 'Italiano',          flag: '🇮🇹' },
    { code: 'id', name: 'Bahasa Indonesia',  flag: '🇮🇩' },
    { code: 'pt', name: 'Português',         flag: '🇧🇷' },
  ]

  const currentLanguage = languages.find(l => l.code === locale) || languages[0]

  const switchLanguage = (newLocale) => {
    if (newLocale === locale || switching) return
    setSwitching(true)

    // ── Why window.location instead of router.push ────────────────────────
    // Next.js client-side router fetches page data from:
    //   /_next/data/[buildId]/fr/compresser-pdf.json   ← doesn't exist
    // The actual data lives at:
    //   /_next/data/[buildId]/fr/compress-pdf.json     ← real file path
    // router.push() fails silently and snaps back to English.
    // A hard navigation hits the server → rewrite kicks in → correct locale loads.
    // ─────────────────────────────────────────────────────────────────────
    const newUrl = localePath(pathname, newLocale)
    window.location.href = newUrl
  }

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Switch language"
        disabled={switching}
      >
        {switching
          ? <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          : <Globe className="w-4 h-4 text-gray-700" />
        }
        <span className="text-sm font-semibold text-gray-700">{currentLanguage.flag} {currentLanguage.name}</span>
      </button>

      <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 py-2 z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => switchLanguage(lang.code)}
            disabled={switching}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5 disabled:opacity-50 ${
              locale === lang.code
                ? 'text-red-600 font-semibold bg-red-50'
                : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
            }`}
          >
            <span className="text-base">{lang.flag}</span>
            <span>{lang.name}</span>
            {locale === lang.code && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}