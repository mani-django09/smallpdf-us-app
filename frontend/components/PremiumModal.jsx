// components/PremiumModal.jsx
// Shown when a user exceeds the free-tier file size limit.
// Two modes:
//   isGuest=true  → "Sign in or create a free account"
//   isGuest=false → "Upgrade to Pro"

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { X, Zap, Lock, ArrowRight, Crown } from 'lucide-react'

const TOOL_LABELS = {
  'merge-pdf':      'Merge PDF',
  'split-pdf':      'Split PDF',
  'compress-pdf':   'Compress PDF',
  'unlock-pdf':     'Unlock PDF',
  'rotate-pdf':     'Rotate PDF',
  'word-to-pdf':    'Word to PDF',
  'ppt-to-pdf':     'PowerPoint to PDF',
  'excel-to-pdf':   'Excel to PDF',
  'pdf-to-word':    'PDF to Word',
  'pdf-to-ppt':     'PDF to PowerPoint',
  'pdf-to-excel':   'PDF to Excel',
  'pdf-to-jpg':     'PDF to JPG',
  'pdf-to-png':     'PDF to PNG',
  'jpg-to-pdf':     'JPG to PDF',
  'png-to-pdf':     'PNG to PDF',
  'webp-to-png':    'WebP to PNG',
  'png-to-webp':    'PNG to WebP',
  'compress-image': 'Compress Image',
}

export default function PremiumModal({
  isOpen,
  onClose,
  isGuest,
  totalLabel,   // e.g. "23 MB"
  limitLabel,   // e.g. "15 MB"
  toolName,
}) {
  const router = useRouter()
  const closeRef = useRef(null)
  const toolLabel = TOOL_LABELS[toolName] || toolName

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const loginHref  = `/auth/login?redirect=${encodeURIComponent(router.asPath)}`
  const signupHref = `/auth/signup?redirect=${encodeURIComponent(router.asPath)}`

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-modal-title"
    >
      {/* Dim overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Close button */}
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        {/* Gradient header */}
        <div className="bg-gradient-to-br from-red-500 to-orange-500 px-8 pt-8 pb-10 text-white text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 mb-4">
            {isGuest ? <Lock className="w-7 h-7" /> : <Crown className="w-7 h-7" />}
          </div>
          <h2 id="premium-modal-title" className="text-2xl font-bold tracking-tight">
            {isGuest ? 'Sign in to continue' : 'Upgrade to Pro'}
          </h2>
          <p className="mt-2 text-red-100 text-sm leading-relaxed">
            {isGuest
              ? `Your file (${totalLabel}) is larger than the ${limitLabel} guest limit for ${toolLabel}.`
              : `Your file (${totalLabel}) exceeds the ${limitLabel} free-plan limit for ${toolLabel}.`}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">

          {/* Size info bar */}
          <div className="flex items-center justify-between mb-6 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Your file</p>
              <p className="text-lg font-bold text-gray-900">{totalLabel}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Free limit</p>
              <p className="text-lg font-bold text-red-500">{limitLabel}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Pro limit</p>
              <p className="text-lg font-bold text-green-600">Unlimited</p>
            </div>
          </div>

          {/* Pro feature bullets */}
          <ul className="space-y-2.5 mb-6">
            {[
              'No file size limits — convert files of any size',
              'Faster processing & priority queue',
              'Batch conversions — multiple files at once',
              'Ad-free experience',
            ].map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Zap className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                {feat}
              </li>
            ))}
          </ul>

          {/* CTA buttons */}
          {isGuest ? (
            <div className="flex flex-col gap-3">
              <Link
                href={loginHref}
                className="w-full text-center bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                Sign In
              </Link>
              <Link
                href={signupHref}
                className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                Create Free Account
              </Link>
              <p className="text-center text-xs text-gray-400 mt-1">
                Free accounts include higher limits on most tools.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Link
                href="/pricing"
                className="w-full text-center bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg text-sm"
              >
                View Pro Plans →
              </Link>
              <button
                onClick={onClose}
                className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm"
              >
                Maybe Later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}