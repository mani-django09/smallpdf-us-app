// components/AdSenseUnit.js
// Automatically hidden for paid subscribers (starter / pro / agency).

import { useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"

const PAID_PLANS = ["starter", "pro", "agency"]

export default function AdSenseUnit({ adSlot, style = {}, format = "auto", responsive = true }) {
  const { user } = useAuth()
  const adRef = useRef(null)
  const loadedRef = useRef(false)

  // Never show ads to paid subscribers
  if (user && PAID_PLANS.includes(user.plan)) return null

  useEffect(() => {
    // Only load ads once per component instance
    if (loadedRef.current) return

    try {
      // Check if we're in the browser
      if (typeof window === "undefined") return

      // Wait for the ad container to be rendered
      if (!adRef.current) return

      // Check if adsbygoogle script is loaded
      if (typeof window.adsbygoogle === "undefined") {
        // Script not ready yet — retry after short delay
        setTimeout(() => { if (!loadedRef.current) loadedRef.current = false }, 2000)
        return
      }

      // Only push if this ad hasn't been initialized
      const insElement = adRef.current

      // Check if already has data-adsbygoogle-status
      if (insElement.getAttribute("data-adsbygoogle-status")) {
        return
      }

      // Push to adsbygoogle array
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})

      loadedRef.current = true
    } catch (err) {
      // Fail silently for better UX
    }
  }, [adSlot])

  // Reserve space to prevent CLS (Cumulative Layout Shift)
  // AdSense horizontal banner is typically 90px, responsive auto is ~280px
  const minHeight = style?.minHeight ?? (format === 'auto' ? 100 : 90)

  return (
    <div style={{ minHeight, display: 'block', contain: 'layout' }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-client="ca-pub-6913093595582462"
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  )
}