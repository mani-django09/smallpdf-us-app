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

// ── Free-tier limits (bytes) — must match server middleware ─────────────────
// Free plan: 100 MB general limit (lower for OCR and office tools)
const FREE_DEFAULT = 100 * 1024 * 1024  // 100 MB

export const FREE_LIMITS = {
  'ocr-pdf':          10 * 1024 * 1024,   //  10 MB (OCR is CPU-intensive)
  'merge-pdf':       100 * 1024 * 1024,   // 100 MB
  'split-pdf':       100 * 1024 * 1024,   // 100 MB
  'compress-pdf':    200 * 1024 * 1024,   // 200 MB
  'unlock-pdf':      100 * 1024 * 1024,   // 100 MB
  'rotate-pdf':      100 * 1024 * 1024,   // 100 MB

  'word-to-pdf':      15 * 1024 * 1024,   //  15 MB
  'ppt-to-pdf':       15 * 1024 * 1024,   //  15 MB
  'excel-to-pdf':     15 * 1024 * 1024,   //  15 MB
  'pdf-to-word':      15 * 1024 * 1024,   //  15 MB
  'pdf-to-ppt':       15 * 1024 * 1024,   //  15 MB
  'pdf-to-excel':     15 * 1024 * 1024,   //  15 MB

  'pdf-to-jpg':       25 * 1024 * 1024,   //  25 MB
  'pdf-to-png':       25 * 1024 * 1024,   //  25 MB
  'jpg-to-pdf':       40 * 1024 * 1024,   //  40 MB
  'png-to-pdf':       40 * 1024 * 1024,   //  40 MB
  'webp-to-png':      40 * 1024 * 1024,   //  40 MB
  'png-to-webp':      40 * 1024 * 1024,   //  40 MB
  'compress-image':  200 * 1024 * 1024,   // 200 MB
}

// ── Starter-tier limits (bytes) — must match server middleware ───────────────
// Starter plan: 200 MB for PDF/image tools, 50 MB for office conversions
const STARTER_DEFAULT = 200 * 1024 * 1024  // 200 MB

export const STARTER_LIMITS = {
  // Office conversions capped at 50 MB for Starter
  'word-to-pdf':   50 * 1024 * 1024,   //  50 MB
  'ppt-to-pdf':    50 * 1024 * 1024,   //  50 MB
  'excel-to-pdf':  50 * 1024 * 1024,   //  50 MB
  'pdf-to-word':   50 * 1024 * 1024,   //  50 MB
  'pdf-to-ppt':    50 * 1024 * 1024,   //  50 MB
  'pdf-to-excel':  50 * 1024 * 1024,   //  50 MB
  // All other tools fall through to STARTER_DEFAULT (200 MB)
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
