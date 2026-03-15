import { useRouter } from 'next/router'
import { Globe } from 'lucide-react'
import { localePath } from '../lib/route-translations'

export default function LanguageSwitcher() {
  const router = useRouter()
  const { locale, pathname } = router

  const languages = [
    { code: 'en', name: 'English',    flag: '🇺🇸' },
    { code: 'ja', name: '日本語',     flag: '🇯🇵' },
    { code: 'de', name: 'Deutsch',    flag: '🇩🇪' },
    { code: 'fr', name: 'Français',   flag: '🇫🇷' },
    { code: 'es', name: 'Español',    flag: '🇪🇸' },
    { code: 'it', name: 'Italiano',   flag: '🇮🇹' },
    { code: 'id', name: 'Indonesia',  flag: '🇮🇩' },
    { code: 'pt', name: 'Português',  flag: '🇧🇷' },
  ]

  const currentLanguage = languages.find(l => l.code === locale) || languages[0]

  const switchLanguage = (newLocale) => {
    if (newLocale === locale) return
    // router.pathname is always the EN file path e.g. '/pdf-to-png'
    const newUrl = localePath(pathname, newLocale)
    router.push(newUrl, newUrl, { locale: false })
  }

  return (
    <div className="relative group">
      <button
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Switch language"
      >
        <Globe className="w-5 h-5 text-gray-700" />
        <span className="text-sm font-semibold text-gray-700">{currentLanguage.name}</span>
      </button>

      <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 py-2 z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => switchLanguage(lang.code)}
            className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2.5 ${
              locale === lang.code ? 'text-red-600 font-semibold bg-red-50' : 'text-gray-700'
            }`}
          >
            <span className="text-lg">{lang.flag}</span>
            <span>{lang.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}