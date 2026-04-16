// hooks/useFileSizeGuard.js
// Client-side file-size gate that mirrors the server limits.
//
// Usage in any tool page:
//
//   import { useFileSizeGuard } from '../hooks/useFileSizeGuard'
//
//   const { checkFiles, PremiumGateModal } = useFileSizeGuard('compress-pdf')
//
//   // Inside your file-drop / file-input handler:
//   const allowed = checkFiles(selectedFiles)   // returns true if OK, shows modal if not
//   if (!allowed) return
//   // ... proceed with upload
//
//   // At END of JSX return:
//   {PremiumGateModal}

import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import PremiumModal from '../components/PremiumModal'

// ── Free-tier limits (bytes) — must match pricing table ─────────────────────
const FREE_DEFAULT = 10 * 1024 * 1024  // 10 MB fallback

export const FREE_LIMITS = {
  'ocr-pdf':          10 * 1024 * 1024,   //  10 MB
  'merge-pdf':        10 * 1024 * 1024,   //  10 MB
  'split-pdf':        10 * 1024 * 1024,   //  10 MB
  'compress-pdf':     20 * 1024 * 1024,   //  20 MB
  'unlock-pdf':       10 * 1024 * 1024,   //  10 MB
  'rotate-pdf':       10 * 1024 * 1024,   //  10 MB

  'word-to-pdf':       5 * 1024 * 1024,   //   5 MB
  'ppt-to-pdf':        5 * 1024 * 1024,   //   5 MB
  'excel-to-pdf':      5 * 1024 * 1024,   //   5 MB
  'pdf-to-word':       5 * 1024 * 1024,   //   5 MB
  'pdf-to-ppt':        5 * 1024 * 1024,   //   5 MB
  'pdf-to-excel':      5 * 1024 * 1024,   //   5 MB

  'pdf-to-jpg':        5 * 1024 * 1024,   //   5 MB
  'pdf-to-png':        5 * 1024 * 1024,   //   5 MB
  'jpg-to-pdf':        5 * 1024 * 1024,   //   5 MB
  'png-to-pdf':        5 * 1024 * 1024,   //   5 MB
  'webp-to-png':       5 * 1024 * 1024,   //   5 MB
  'png-to-webp':       5 * 1024 * 1024,   //   5 MB
  'compress-image':   15 * 1024 * 1024,   //  15 MB
}

// ── Starter-tier limits (bytes) — must match pricing table ───────────────────
const STARTER_DEFAULT = 100 * 1024 * 1024  // 100 MB for PDF tools

export const STARTER_LIMITS = {
  // PDF tools: 100 MB
  'merge-pdf':     100 * 1024 * 1024,   // 100 MB
  'split-pdf':     100 * 1024 * 1024,   // 100 MB
  'compress-pdf':  100 * 1024 * 1024,   // 100 MB
  'unlock-pdf':    100 * 1024 * 1024,   // 100 MB
  'rotate-pdf':    100 * 1024 * 1024,   // 100 MB
  // Office conversions: 20 MB
  'word-to-pdf':    20 * 1024 * 1024,   //  20 MB
  'ppt-to-pdf':     20 * 1024 * 1024,   //  20 MB
  'excel-to-pdf':   20 * 1024 * 1024,   //  20 MB
  'pdf-to-word':    20 * 1024 * 1024,   //  20 MB
  'pdf-to-ppt':     20 * 1024 * 1024,   //  20 MB
  'pdf-to-excel':   20 * 1024 * 1024,   //  20 MB
  // Image tools: 20 MB
  'pdf-to-jpg':     20 * 1024 * 1024,   //  20 MB
  'pdf-to-png':     20 * 1024 * 1024,   //  20 MB
  'jpg-to-pdf':     20 * 1024 * 1024,   //  20 MB
  'png-to-pdf':     20 * 1024 * 1024,   //  20 MB
  'webp-to-png':    20 * 1024 * 1024,   //  20 MB
  'png-to-webp':    20 * 1024 * 1024,   //  20 MB
  'compress-image': 20 * 1024 * 1024,   //  20 MB
}

function fmtMB(bytes) {
  const mb = bytes / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

/**
 * @param {string} toolName  e.g. 'compress-pdf'
 * @returns {{ checkFiles: Function, PremiumGateModal: JSX.Element|null }}
 */
export function useFileSizeGuard(toolName) {
  const { user } = useAuth()
  const [modalState, setModalState] = useState(null) // null | { isGuest, totalSize, limit }

  // Resolve the applicable limit based on user's plan
  const freeLimit    = FREE_LIMITS[toolName]    ?? FREE_DEFAULT
  const starterLimit = STARTER_LIMITS[toolName] ?? STARTER_DEFAULT
  const limit = (user?.plan === 'starter') ? starterLimit : freeLimit

  /**
   * Call this before uploading.
   * @param {File|File[]|FileList} files
   * @returns {boolean}  true = allowed, false = blocked (modal shown)
   */
  const checkFiles = useCallback((files) => {
    // Pro and Agency/Enterprise users bypass all size limits
    if (user && (user.plan === 'pro' || user.plan === 'agency' || user.plan === 'enterprise')) return true

    const fileArray = files instanceof FileList
      ? Array.from(files)
      : Array.isArray(files) ? files : [files]

    const totalSize = fileArray.reduce((s, f) => s + (f?.size || 0), 0)
    if (totalSize <= limit) return true

    // Over limit — show upgrade modal
    setModalState({
      isGuest:    !user,
      totalSize,
      limit,
      totalLabel: fmtMB(totalSize),
      limitLabel: fmtMB(limit),
    })
    return false
  }, [user, limit])

  const closeModal = useCallback(() => setModalState(null), [])

  // The modal element — drop this anywhere in your JSX (e.g. end of return block)
  const PremiumGateModal = modalState ? (
    <PremiumModal
      isOpen={true}
      onClose={closeModal}
      isGuest={modalState.isGuest}
      totalLabel={modalState.totalLabel}
      limitLabel={modalState.limitLabel}
      toolName={toolName}
    />
  ) : null

  return { checkFiles, PremiumGateModal }
}

export default useFileSizeGuard
