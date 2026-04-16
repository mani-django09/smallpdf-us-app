// hooks/useIsIndia.js
// Detects if the user is in India via timezone (IST = Asia/Kolkata).
// Returns { isIndia, loading } — loading is true on first render (SSR safe).

import { useState, useEffect } from 'react'

export function useIsIndia() {
  const [isIndia,  setIsIndia]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setIsIndia(['Asia/Kolkata', 'Asia/Calcutta'].includes(tz))
    } catch { /* keep false */ }
    setLoading(false)
  }, [])

  return { isIndia, loading }
}

export default useIsIndia
