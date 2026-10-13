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
import { useTranslations } from '../lib/i18n'

// Hard per-file cap on the server (multer) for EVERY plan, Pro included.
const MAX_FILE_BYTES = 100 * 1024 * 1024

// ── Free-tier limits (bytes) — must match pricing table ─────────────────────
const FREE_DEFAULT = 10 * 1024 * 1024  // 10 MB fallback

export const FREE_LIMITS = {
  'ocr-pdf':          10 * 1024 * 1024,   //  10 MB
  'merge-pdf':        25 * 1024 * 1024,   //  25 MB
  'split-pdf':        10 * 1024 * 1024,   //  10 MB
  'compress-pdf':     20 * 1024 * 1024,   //  20 MB
  'unlock-pdf':       10 * 1024 * 1024,   //  10 MB
  'rotate-pdf':       10 * 1024 * 1024,   //  10 MB
  'protect-pdf':      10 * 1024 * 1024,   //  10 MB
  'redact-pdf':       10 * 1024 * 1024,   //  10 MB
  'edit-pdf':         10 * 1024 * 1024,   //  10 MB

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
  'heic-to-jpg':      10 * 1024 * 1024,   //  10 MB
  'heic-to-png':      10 * 1024 * 1024,   //  10 MB
  'compress-image':   15 * 1024 * 1024,   //  15 MB
}

// ── Starter-tier limits (bytes) — must match pricing table ───────────────────
const STARTER_DEFAULT = 100 * 1024 * 1024  // 100 MB for PDF tools

export const STARTER_LIMITS = {
  // PDF tools: 100 MB
  'merge-pdf':     200 * 1024 * 1024,   // 200 MB
  'split-pdf':     100 * 1024 * 1024,   // 100 MB
  'compress-pdf':  100 * 1024 * 1024,   // 100 MB
  'unlock-pdf':    100 * 1024 * 1024,   // 100 MB
  'rotate-pdf':    100 * 1024 * 1024,   // 100 MB
  'protect-pdf':   100 * 1024 * 1024,   // 100 MB
  'redact-pdf':    100 * 1024 * 1024,   // 100 MB
  'edit-pdf':      100 * 1024 * 1024,   // 100 MB
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
  'heic-to-jpg':    40 * 1024 * 1024,   //  40 MB
  'heic-to-png':    40 * 1024 * 1024,   //  40 MB
  'compress-image': 20 * 1024 * 1024,   //  20 MB
}

function fmtMB(bytes) {
  const mb = bytes / (1024 * 1024)
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

/**
 * @param {string} toolName  e.g. 'compress-pdf'
 * @returns {{ checkFiles, handleApiError, PremiumGateModal }}
 *
 * handleApiError(response, files?) — call after every fetch().
 *   If the server returned 413 FILE_SIZE_LIMIT_EXCEEDED it opens the premium
 *   modal automatically, so the user sees an upgrade prompt instead of a
 *   generic "conversion failed" message.
 */
export function useFileSizeGuard(toolName) {
  const { user } = useAuth()
  const { t } = useTranslations()
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
    const fileArray = files instanceof FileList
      ? Array.from(files)
      : Array.isArray(files) ? files : [files]

    // No plan can upload a single file over 100 MB (server rejects it). Pro used
    // to pass here, upload e.g. 150 MB, and then get a generic error.
    const huge = fileArray.find((f) => (f?.size || 0) > MAX_FILE_BYTES)
    if (huge) {
      const msg = t('toolErrors.fileTooLarge', { name: huge.name })
      window.alert(msg === 'toolErrors.fileTooLarge' ? `"${huge.name}" is larger than 100 MB, the maximum per file.` : msg)
      return false
    }

    // Pro and Agency/Enterprise users bypass all plan size limits
    if (user && (user.plan === 'pro' || user.plan === 'agency' || user.plan === 'enterprise')) return true

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
  }, [user, limit, t])

  const closeModal = useCallback(() => setModalState(null), [])

  /**
   * Call this after every API fetch response.
   * If the server rejected with 413 FILE_SIZE_LIMIT_EXCEEDED, open the
   * premium modal so the user sees an upgrade prompt right away.
   *
   * Usage:
   *   const result = await res.json()
   *   if (handleApiError(res, result)) return   // modal shown, stop processing
   *
   * @param {Response} response   — fetch Response object
   * @param {object}   [body]     — already-parsed JSON body (optional)
   * @returns {boolean}  true if the error was a size limit (modal shown)
   */
  const handleApiError = useCallback((response, body) => {
    if (response?.status !== 413) return false
    const error = body?.error || ''
    if (error !== 'FILE_SIZE_LIMIT_EXCEEDED' && error !== 'BATCH_LIMIT_EXCEEDED') return false

    const limitMB   = body?.limitMB   ? body.limitMB * 1024 * 1024   : limit
    const uploadMB  = body?.uploadedMB ? body.uploadedMB * 1024 * 1024 : limitMB + 1
    setModalState({
      isGuest:    !user,
      totalSize:  uploadMB,
      limit:      limitMB,
      totalLabel: fmtMB(uploadMB),
      limitLabel: fmtMB(limitMB),
    })
    return true
  }, [user, limit])

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

  return { checkFiles, handleApiError, PremiumGateModal }
}

export default useFileSizeGuard
