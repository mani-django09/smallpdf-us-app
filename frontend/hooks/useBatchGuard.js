// hooks/useBatchGuard.js
// Dual-layer batch-file-count gate:
//   Layer 1 (client): checkBatch(files) — call in file-input onChange / onDrop
//                     Shows modal BEFORE any upload if file count exceeds plan limit.
//   Layer 2 (server): handleBatchError(err) — call in your upload catch block
//                     Shows modal if server returned 429 BATCH_LIMIT_EXCEEDED.
//
// ─── Integration ─────────────────────────────────────────────────────────────
//
//   const { checkBatch, handleBatchError, BatchGateModal } = useBatchGuard('merge-pdf')
//
//   // In file-select / drop handler:
//   const handleFiles = (incoming) => {
//     if (!checkBatch(incoming)) return   // shows modal, stops here
//     setFiles(incoming)
//   }
//
//   // In upload catch block:
//   } catch (err) {
//     if (handleBatchError(err)) return   // shows modal, stops here
//     // ... handle other errors
//   }
//
//   // At END of JSX return:
//   {BatchGateModal}

import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import BatchLimitModal from '../components/BatchLimitModal'

// ── Per-tool limits — keep in sync with middleware/batchLimiter.js ────────────
// Pricing: Free=per-tool, Starter=10, Pro=20, Agency=50 files per batch
export const BATCH_LIMITS = {
  'ocr-pdf':        { free: 1,  starter: 10, pro: 20, ent: 50 },
  'merge-pdf':      { free: 2,  starter: 10, pro: 20, ent: 50 },
  'split-pdf':      { free: 1,  starter: 10, pro: 20, ent: 50 },
  'compress-pdf':   { free: 2,  starter: 10, pro: 20, ent: 50 },
  'word-to-pdf':    { free: 1,  starter: 10, pro: 20, ent: 50 },
  'ppt-to-pdf':     { free: 1,  starter: 10, pro: 20, ent: 50 },
  'excel-to-pdf':   { free: 1,  starter: 10, pro: 20, ent: 50 },
  'pdf-to-word':    { free: 1,  starter: 10, pro: 20, ent: 50 },
  'pdf-to-ppt':     { free: 1,  starter: 10, pro: 20, ent: 50 },
  'pdf-to-excel':   { free: 1,  starter: 10, pro: 20, ent: 50 },
  'pdf-to-jpg':     { free: 2,  starter: 10, pro: 20, ent: 50 },
  'jpg-to-pdf':     { free: 2,  starter: 10, pro: 20, ent: 50 },
  'png-to-pdf':     { free: 5,  starter: 10, pro: 20, ent: 50 },
  'compress-image': { free: 2,  starter: 10, pro: 20, ent: 50 },
  'webp-to-png':    { free: 2,  starter: 10, pro: 20, ent: 50 },
  'png-to-webp':    { free: 2,  starter: 10, pro: 20, ent: 50 },
}

function getAllowedCount(limits, user) {
  if (!limits) return Infinity
  if (user?.plan === 'agency' || user?.plan === 'enterprise') return limits.ent
  if (user?.plan === 'pro')     return limits.pro
  if (user?.plan === 'starter') return limits.starter
  return limits.free
}

export function useBatchGuard(toolName) {
  const { user }     = useAuth()
  const [modal, setModal] = useState(null)

  const limits       = BATCH_LIMITS[toolName]
  const allowedCount = getAllowedCount(limits, user)

  // Layer 1 — call BEFORE upload, returns false + shows modal if over limit
  const checkBatch = useCallback((files) => {
    if (!limits) return true

    const arr   = files instanceof FileList ? Array.from(files)
                : Array.isArray(files)      ? files
                : [files]

    if (arr.length <= allowedCount) return true

    setModal({ isGuest: !user, fileCount: arr.length, allowedCount })
    return false
  }, [user, limits, allowedCount])

  // Layer 2 — call in catch block, returns true if it was a batch-limit error
  const handleBatchError = useCallback((err) => {
    const data = err?.response?.data ?? err?.data ?? err
    if (data?.error === 'BATCH_LIMIT_EXCEEDED') {
      setModal({
        isGuest:      data.isGuest ?? !user,
        fileCount:    data.fileCount    ?? 0,
        allowedCount: data.allowedCount ?? allowedCount,
      })
      return true
    }
    if (err?.status === 429 || err?.statusCode === 429) {
      setModal({ isGuest: !user, fileCount: 0, allowedCount })
      return true
    }
    return false
  }, [user, allowedCount])

  const closeModal = useCallback(() => setModal(null), [])

  const BatchGateModal = modal ? (
    <BatchLimitModal
      isOpen={true}
      onClose={closeModal}
      isGuest={modal.isGuest}
      fileCount={modal.fileCount}
      allowedCount={modal.allowedCount}
      toolName={toolName}
    />
  ) : null

  return { checkBatch, handleBatchError, BatchGateModal, allowedCount }
}

export default useBatchGuard
