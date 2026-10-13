// lib/i18n.js
// Client-side translation hook. Previously this file statically imported every
// tool's translations for all 8 locales (256 imports, ~3.5MB raw JSON) into
// every single page's JS bundle — regardless of which page or language was
// being viewed. That's now loaded per-page, per-locale at build time via
// getStaticProps + lib/i18nLoader.js, and handed to this hook through React
// context. The t("namespace.key") call signature is unchanged, so page code
// didn't need to change — only the data source did.

import { createContext, useContext } from 'react'
import { useRouter } from 'next/router'

const TranslationsContext = createContext({})

export function TranslationsProvider({ messages, children }) {
  return (
    <TranslationsContext.Provider value={messages || {}}>
      {children}
    </TranslationsContext.Provider>
  )
}

/**
 * Translate a dot-separated key, with optional interpolation.
 *
 * Usage:
 *   t("unlockPdf.downloadCardTitle")
 *   t("unlockPdf.downloadCardSubtitle", { count: 3, plural: "s" })
 *
 * All {placeholder} tokens in the resolved string are replaced with the
 * matching value from `params`. Uses replaceAll so a key like
 * "PDF{plural} desbloqueado{plural}" works correctly.
 */
export function useTranslations() {
  const router = useRouter()
  const { locale = 'en' } = router
  const messages = useContext(TranslationsContext)

  const t = (key, params) => {
    const keys = key.split('.')
    let value = messages

    for (const k of keys) {
      value = value?.[k]
    }

    if (value === undefined || value === null) return key
    if (typeof value !== 'string') return key

    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replaceAll(`{${k}}`, v ?? ''),
        value
      )
    }

    return value
  }

  return { t, locale }
}

// Compatibility helper for the one page (developers.js) that previously read
// a whole namespace object directly instead of going through t("ns.key").
export function useNamespaceMessages(namespace) {
  const messages = useContext(TranslationsContext)
  return messages?.[namespace] ?? {}
}
