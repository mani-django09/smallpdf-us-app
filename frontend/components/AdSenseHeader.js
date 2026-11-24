// AdSense header ad (slot smallpdf_header). The adsbygoogle.js loader is in pages/_document.js.
// Hidden for paid plans.
import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const PAID_PLANS = ['starter', 'pro', 'agency', 'enterprise']

export default function AdSenseHeader({ className = '' }) {
  const { user } = useAuth()
  const isPaid = user && PAID_PLANS.includes(user.plan)
  const pushed = useRef(false)

  useEffect(() => {
    if (isPaid || pushed.current) return
    pushed.current = true
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch (e) { /* blocked */ }
  }, [isPaid])

  if (isPaid) return null
  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-6913093595582462"
        data-ad-slot="8004544994"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
