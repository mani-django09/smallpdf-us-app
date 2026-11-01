// components/PrivacyNotice.js
// Small reusable trust badge telling users their files are auto-deleted.
// Drop it on upload / preview / download pages.
//
// Props:
//   variant  — "inline" (compact pill) or "banner" (full-width box, default).

import { ShieldCheck } from 'lucide-react'
import { useTranslations } from '../lib/i18n'

export default function PrivacyNotice({ variant = 'banner', className = '' }) {
  const { t } = useTranslations()

  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 ${className}`}>
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{t('limits.privacy.inline')}</span>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3 ${className}`}>
      <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-emerald-800">{t('limits.privacy.banner')}</p>
    </div>
  )
}
