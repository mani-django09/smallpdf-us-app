// components/UpgradeBanner.jsx
// Sticky bottom banner shown to free users on tool pages.
// Encourages upgrade to Pro without blocking the tool.
//
// Usage:
//   import UpgradeBanner from '../components/UpgradeBanner'
//   <UpgradeBanner toolName="compress-pdf" trigger="fileSize" />
//
// Props:
//   toolName  — key from TOOL_LABELS (e.g. 'compress-pdf')
//   trigger   — 'fileSize' | 'batch' | 'usage' | 'idle'  (controls message copy)
//   show      — optional boolean override (defaults to auto show for free users)

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap, X, Crown, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

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

const TRIGGER_COPY = {
  fileSize: {
    headline: 'Need larger file support?',
    sub:      'Pro users get files up to 100 MB and batch processing.',
  },
  batch: {
    headline: 'Process more files at once',
    sub:      'Upgrade to batch-convert up to 20 files simultaneously.',
  },
  usage: {
    headline: 'You\'re using SmallPDF.us a lot!',
    sub:      'Go Pro for priority processing, bigger files & no ads.',
  },
  idle: {
    headline: 'Unlock the full power of SmallPDF.us',
    sub:      'Remove limits, remove ads, unlock batch processing.',
  },
}

// How many seconds after page load to show the banner (idle trigger)
const IDLE_DELAY_MS = 18000

export default function UpgradeBanner({ toolName, trigger = 'idle', show: showProp }) {
  const { user } = useAuth()
  const [visible,   setVisible]   = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isPaid = ['starter', 'pro', 'agency'].includes(user?.plan)

  // Auto-show logic
  useEffect(() => {
    // Never show to paid users
    if (isPaid) return
    // Never show if explicitly hidden
    if (showProp === false) return
    // If caller forces show
    if (showProp === true) { setVisible(true); return }

    // Check session dismissal (per tool)
    const key = `upgrade_banner_dismissed_${toolName}`
    if (sessionStorage.getItem(key)) return

    if (trigger === 'idle') {
      // Show after IDLE_DELAY_MS seconds on page
      const t = setTimeout(() => setVisible(true), IDLE_DELAY_MS)
      return () => clearTimeout(t)
    } else {
      // Show immediately for fileSize / batch / usage triggers
      setVisible(true)
    }
  }, [isPaid, trigger, toolName, showProp])

  const handleDismiss = () => {
    setDismissed(true)
    setVisible(false)
    // Remember dismissal for this session (per tool)
    const key = `upgrade_banner_dismissed_${toolName}`
    sessionStorage.setItem(key, '1')
  }

  if (!visible || dismissed || isPaid) return null

  const toolLabel = TOOL_LABELS[toolName] || 'this tool'
  const copy      = TRIGGER_COPY[trigger] || TRIGGER_COPY.idle

  return (
    <div
      role="complementary"
      aria-label="Upgrade to Pro"
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pointer-events-none"
    >
      <div
        className="
          pointer-events-auto
          max-w-2xl mx-auto
          bg-white border border-gray-200
          rounded-2xl shadow-2xl
          flex items-center gap-4
          px-5 py-4
          animate-in slide-in-from-bottom-4 fade-in
          duration-300
        "
      >
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-md">
          <Crown className="w-5 h-5 text-white" />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {copy.headline}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug truncate">
            {copy.sub}
          </p>
        </div>

        {/* Pro pill badges */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {['Bigger files', 'No ads', 'Batch'].map((feat) => (
            <span
              key={feat}
              className="text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full"
            >
              {feat}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/pricing"
          className="
            flex-shrink-0
            flex items-center gap-1.5
            bg-gradient-to-r from-red-500 to-orange-500
            hover:from-red-600 hover:to-orange-600
            text-white text-xs font-semibold
            px-4 py-2.5 rounded-xl
            transition-all shadow-md hover:shadow-lg
            whitespace-nowrap
          "
        >
          <Zap className="w-3.5 h-3.5" />
          Go Pro
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss upgrade banner"
          className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>
    </div>
  )
}