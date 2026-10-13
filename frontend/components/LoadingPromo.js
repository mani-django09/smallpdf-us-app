import { useEffect, useRef } from "react"
import { ArrowRight, Zap } from "lucide-react"

// Animated "Sponsored" card shown inside the processing/converting spinner state —
// the 2-5s window where the user is actively watching the screen with nothing
// else to look at. House promo, not a real ad (too short a window for GPT to
// reliably load a creative in time).
export default function LoadingPromo({ className = "" }) {
  const checkRef = useRef(null)

  useEffect(() => {
    const el = checkRef.current
    if (!el) return
    const draw = () => {
      el.style.transition = "none"
      el.style.strokeDashoffset = "14"
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 0.5s ease-out"
        el.style.strokeDashoffset = "0"
      })
    }
    draw()
    const id = setInterval(draw, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`w-full max-w-md border-t border-slate-100 pt-3 mt-1 ${className}`}>
      <p className="text-[10px] text-center text-slate-400 mb-2 uppercase tracking-wide">Sponsored</p>
      <a
        href="https://resumes-maker.com?utm_source=smallpdf.us&utm_medium=house-ad&utm_campaign=loading-state"
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center gap-4 bg-slate-50 hover:bg-slate-100 rounded-lg pl-2 pr-4 py-3 transition-colors overflow-hidden"
      >
        <div className="loading-promo-sheen absolute top-0 left-0 h-full w-2/5 pointer-events-none" />

        <svg width="72" height="62" viewBox="0 0 76 66" className="flex-shrink-0 relative overflow-visible">
          <g className="loading-promo-doc" style={{ transformOrigin: "center" }}>
            <rect x="20" y="6" width="30" height="40" rx="3" className="fill-indigo-100" />
            <rect x="26" y="14" width="18" height="3" rx="1.5" className="fill-slate-300" />
            <rect x="26" y="21" width="18" height="3" rx="1.5" className="fill-slate-300" />
            <rect x="26" y="28" width="12" height="3" rx="1.5" className="fill-slate-300" />
          </g>
          <circle cx="50" cy="38" r="12" className="fill-emerald-500" />
          <path
            ref={checkRef}
            d="M45 38l3.5 3.5L55 34.5"
            stroke="white"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="14"
            strokeDashoffset="14"
          />
          <g className="loading-promo-bob1" style={{ transformOrigin: "10px 10px" }}>
            <circle cx="10" cy="10" r="9" className="fill-amber-100" />
            <rect x="5.5" y="8" width="9" height="6.5" rx="1.2" fill="none" className="stroke-amber-600" strokeWidth="1.3" />
            <path d="M7.8 8V6.8c0-.6.5-1.1 1.1-1.1h2.2c.6 0 1.1.5 1.1 1.1V8" fill="none" className="stroke-amber-600" strokeWidth="1.3" />
          </g>
          <g className="loading-promo-bob2" style={{ transformOrigin: "66px 12px" }}>
            <circle cx="66" cy="12" r="9" className="fill-purple-100" />
            <path d="M66 7.2l1.4 2.9 3.2.5-2.3 2.2.5 3.2-2.8-1.5-2.8 1.5.5-3.2-2.3-2.2 3.2-.5z" className="fill-purple-600" />
          </g>
          <g className="loading-promo-bob3" style={{ transformOrigin: "66px 52px" }}>
            <circle cx="66" cy="52" r="9" className="fill-blue-100" />
            <path d="M60.5 50.5L66 48l5.5 2.5-5.5 2.5z" className="fill-blue-600" />
            <path d="M63 51.8v2.4c0 .8 1.3 1.5 3 1.5s3-.7 3-1.5v-2.4" fill="none" className="stroke-blue-600" strokeWidth="1.1" />
          </g>
        </svg>

        <div className="min-w-0 text-left relative flex-1">
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1">
            <Zap className="w-2.5 h-2.5" /> ATS-optimized
          </span>
          <p className="text-sm font-semibold text-slate-800 leading-snug">Make yours one that gets seen.</p>
          <p className="text-xs text-slate-500 mt-0.5">Free templates built to pass the filter.</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 mt-1">
            Resume Maker · resumes-maker.com
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </a>

      <style jsx>{`
        @keyframes lpFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes lpBob1 { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.06); } }
        @keyframes lpBob2 { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(4px) scale(1.08); } }
        @keyframes lpBob3 { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.05); } }
        @keyframes lpSheen { 0% { left: -50%; } 60% { left: 130%; } 100% { left: 130%; } }
        .loading-promo-doc { animation: lpFloat 2.4s ease-in-out infinite; }
        .loading-promo-bob1 { animation: lpBob1 2.2s ease-in-out infinite; }
        .loading-promo-bob2 { animation: lpBob2 2.6s ease-in-out infinite 0.3s; }
        .loading-promo-bob3 { animation: lpBob3 2.8s ease-in-out infinite 0.6s; }
        .loading-promo-sheen {
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.6), transparent);
          transform: skewX(-15deg);
          left: -50%;
          animation: lpSheen 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
