import { useRouter } from 'next/router'
import { localePath } from './route-translations'

// ✅ FIX: useLocalizedRouter now correctly translates ALL path segments
// including sub-pages like /preview and /download.
//
// localePath('/merge-pdf/download', 'id')  → '/id/gabung-pdf/unduh'
// localePath('/merge-pdf/download', 'pt')  → '/pt/unir-pdf/baixar'
// localePath('/merge-pdf/download', 'de')  → '/de/pdf-zusammenfuegen/download'
// localePath('/merge-pdf/download', 'fr')  → '/fr/fusionner-pdf/telecharger'
// localePath('/merge-pdf/preview',  'es')  → '/es/combinar-pdf/vista-previa'

export function useLocalizedRouter() {
  const router = useRouter()
  const { locale } = router

  return {
    ...router,
    push: (enPath, as, options) => {
      const localizedUrl = localePath(enPath, locale)
      return router.push(localizedUrl, localizedUrl, { locale: false, ...options })
    },
    replace: (enPath, as, options) => {
      const localizedUrl = localePath(enPath, locale)
      return router.replace(localizedUrl, localizedUrl, { locale: false, ...options })
    },
    // Helper to build a localized URL without navigating (useful for <a href>)
    href: (enPath) => localePath(enPath, locale),
  }
}