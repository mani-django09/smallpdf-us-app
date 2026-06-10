// hooks/useDailyLimit.js
// Handles DAILY_LIMIT_EXCEEDED (429) responses from any conversion endpoint.
//
// Usage in a tool page:
//   const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
//
//   // In your fetch error handler:
//   if (handleDailyLimitError(responseStatus, responseBody)) return
//
//   // At the end of your JSX:
//   {DailyLimitGate}

import { useState, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import DailyLimitModal from "../components/DailyLimitModal"

export default function useDailyLimit() {
  const { user } = useAuth()
  const [modalState, setModalState] = useState(null)

  /**
   * Call after every conversion fetch response.
   * Returns true if this was a daily-limit error (modal shown, caller should stop).
   *
   * @param {number|Response} statusOrResponse  — HTTP status code OR fetch Response
   * @param {object}          [body]            — already-parsed JSON body
   */
  const handleDailyLimitError = useCallback((statusOrResponse, body) => {
    const status = typeof statusOrResponse === "number"
      ? statusOrResponse
      : statusOrResponse?.status

    if (status !== 429) return false
    if (body?.error !== "DAILY_LIMIT_EXCEEDED") return false

    setModalState({
      isGuest: body.isGuest ?? !user,
      limit:   body.limit ?? 5,
      resetHr: body.resetHr ?? "midnight UTC",
    })
    return true
  }, [user])

  const closeModal = useCallback(() => setModalState(null), [])

  const DailyLimitGate = modalState ? (
    <DailyLimitModal
      isOpen={true}
      onClose={closeModal}
      isGuest={modalState.isGuest}
      limit={modalState.limit}
      resetHr={modalState.resetHr}
    />
  ) : null

  return { handleDailyLimitError, DailyLimitGate }
}
