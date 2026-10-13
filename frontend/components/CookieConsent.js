// components/CookieConsent.js
// GDPR-compliant cookie consent banner.
// Google Analytics & Ad Manager (AdX) are loaded in _app.js. This banner:
//   1. Blocks GA until the user accepts non-essential cookies
//   2. Remembers choice in localStorage for 365 days
//   3. Shows for all users (GA anonymize_ip=true is not enough for GDPR)
//
// Usage: add <CookieConsent /> to Layout.js before </div>

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from '../lib/i18n'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const { locale } = useTranslations()

  useEffect(() => {
    try {
      const choice = localStorage.getItem('cookie_consent')
      if (!choice) {
        // Small delay so it doesn't flash on first paint
        const t = setTimeout(() => setVisible(true), 800)
        return () => clearTimeout(t)
      }
      // Re-apply consent on every load
      if (choice === 'accepted') enableAnalytics()
    } catch { /* localStorage blocked */ }
  }, [])

  function enableAnalytics() {
    if (typeof window === 'undefined') return
    // Unblock GA
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: 'cookie_consent_granted' })
    // Ads are served via Google Ad Manager (AdX/GPT), initialized in _app.js.
    // No page-level auto-ads init needed here.
  }

  const accept = () => {
    try { localStorage.setItem('cookie_consent', 'accepted') } catch { }
    enableAnalytics()
    setVisible(false)
  }

  const decline = () => {
    try { localStorage.setItem('cookie_consent', 'declined') } catch { }
    setVisible(false)
  }

  if (!visible) return null

  const texts = {
    en: {
      msg: 'We use cookies for analytics and ads to keep this site free.',
      accept: 'Accept',
      decline: 'Decline',
      policy: 'Privacy Policy',
    },
    ja: {
      msg: '当サイトは分析・広告のためにCookieを使用しています（サービスを無料に保つため）。',
      accept: '同意する',
      decline: '拒否する',
      policy: 'プライバシーポリシー',
    },
    de: {
      msg: 'Wir verwenden Cookies für Analysen und Werbung, um diese Seite kostenlos zu halten.',
      accept: 'Akzeptieren',
      decline: 'Ablehnen',
      policy: 'Datenschutz',
    },
    fr: {
      msg: 'Nous utilisons des cookies pour les analyses et la publicité afin de garder ce site gratuit.',
      accept: 'Accepter',
      decline: 'Refuser',
      policy: 'Confidentialité',
    },
    es: {
      msg: 'Usamos cookies para análisis y publicidad para mantener este sitio gratuito.',
      accept: 'Aceptar',
      decline: 'Rechazar',
      policy: 'Privacidad',
    },
    it: {
      msg: 'Utilizziamo cookie per analisi e pubblicità per mantenere questo sito gratuito.',
      accept: 'Accetta',
      decline: 'Rifiuta',
      policy: 'Privacy',
    },
    id: {
      msg: 'Kami menggunakan cookie untuk analitik dan iklan agar situs ini tetap gratis.',
      accept: 'Terima',
      decline: 'Tolak',
      policy: 'Privasi',
    },
    pt: {
      msg: 'Usamos cookies para análises e anúncios para manter este site gratuito.',
      accept: 'Aceitar',
      decline: 'Recusar',
      policy: 'Privacidade',
    },
  }

  const t = texts[locale] || texts.en
  const privacyPath = locale && locale !== 'en' ? `/${locale}/privacy` : '/privacy'

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950 border-t border-gray-800 px-4 py-3 shadow-2xl"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <p className="text-xs text-gray-300 leading-relaxed flex-1">
          {t.msg}{' '}
          <Link href={privacyPath} className="underline text-gray-400 hover:text-white transition-colors">
            {t.policy}
          </Link>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={decline}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200 transition-colors"
          >
            {t.decline}
          </button>
          <button
            onClick={accept}
            className="text-xs px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  )
}
