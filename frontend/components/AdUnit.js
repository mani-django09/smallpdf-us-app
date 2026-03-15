import { useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"


const PAID_PLANS = ["starter", "pro", "agency"]

export default function AdUnit({
  slot,
  label = "",
  className = "",
  format = "auto",
}) {
  const { user } = useAuth()
  const adRef = useRef(null)
  const pushed = useRef(false)

  // Never show ads to paid subscribers
  if (user && PAID_PLANS.includes(user.plan)) return null

  useEffect(() => {
    // Only push once per mount to avoid "already pushed" errors
    if (pushed.current) return
    pushed.current = true

    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch (e) {
      // Safe to ignore - ad blocker or adsbygoogle not ready
    }

    // Reset on unmount so re-mounts (route changes) push fresh
    return () => {
      pushed.current = false
    }
  }, [])

  return (
    <div className={`ad-unit-wrapper overflow-hidden ${className}`}>
      {label && process.env.NODE_ENV === "development" && (
        <div className="text-xs text-center text-gray-400 py-1 bg-gray-50 border border-dashed border-gray-200 rounded mb-1">
          Ad: {label}
        </div>
      )}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-6913093595582462"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}

