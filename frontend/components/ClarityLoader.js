// Microsoft Clarity (session recordings + click heatmaps) for the buying funnel.
//
// Why it exists: server logs show ~300 pricing-page views a week and zero plan
// clicks, but can't say WHY. Clarity shows where people look, click and give up.
//
// Deliberately narrow:
//   • Only the pricing / signup / login pages — not the tool pages, where people
//     handle their own documents.
//   • Never for logged-in users (their account pages show personal data).
//   • Skipped for Europe timezones, Do-Not-Track and Global Privacy Control.
//     There is no live cookie-consent banner on the site (CookieConsent.js isn't
//     mounted anywhere), and session recording of EU/UK visitors needs consent,
//     so we simply don't record them. Timezone is a heuristic, not geo-IP.
//   • Renders nothing until CLARITY_PROJECT_ID is set.
//
// To turn on: create a project at clarity.microsoft.com, paste its ID below,
// and update the privacy policy (thirdPartyList) in the same deploy.

import { useEffect } from 'react'
import { useRouter } from 'next/router'

const CLARITY_PROJECT_ID = 'ylxrpzssf1'

// router.pathname is the English file path, whatever the locale prefix.
const FUNNEL_PAGES = new Set(['/pricing', '/auth/signup', '/auth/login'])

const EUROPE_TZ = /^(Europe|Atlantic\/(Reykjavik|Faroe|Madeira|Canary|Azores))(\/|$)/

function allowedToRecord() {
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return false
    if (navigator.globalPrivacyControl) return false
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (EUROPE_TZ.test(tz)) return false
    if (localStorage.getItem('auth_token')) return false
  } catch {
    return false // can't verify → don't record
  }
  return true
}

export default function ClarityLoader() {
  const { pathname } = useRouter()

  useEffect(() => {
    if (!CLARITY_PROJECT_ID) return
    if (!FUNNEL_PAGES.has(pathname)) return
    if (document.getElementById('clarity-script')) return
    if (!allowedToRecord()) return

    // Standard Clarity bootstrap, kept as-is so it stays recognisable.
    ;(function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }
      t = l.createElement(r)
      t.async = 1
      t.id = 'clarity-script'
      t.src = 'https://www.clarity.ms/tag/' + i
      y = l.getElementsByTagName(r)[0]
      y.parentNode.insertBefore(t, y)
    })(window, document, 'clarity', 'script', CLARITY_PROJECT_ID)
  }, [pathname])

  return null
}
