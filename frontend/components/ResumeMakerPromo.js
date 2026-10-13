import { FileEdit } from "lucide-react"

// House-ad-style card sized to slot into an empty ~300x250 ad rectangle
// (sidebar "Ad 2" slots that rarely fill with real AdX demand — see
// AdSenseUnit.js, every rectangle request hits the same GAM unit path).
export default function ResumeMakerPromo({ className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`} style={{ width: 300, maxWidth: "100%" }}>
      <p className="text-[10px] text-center text-slate-400 pt-2 pb-1 uppercase tracking-wide">Sponsored</p>
      <a
        href="https://resumes-maker.com?utm_source=smallpdf.us&utm_medium=house-ad&utm_campaign=download-sidebar"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-col items-center text-center px-5 pb-5"
      >
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
          <FileEdit className="w-7 h-7 text-white" />
        </div>
        <p className="text-base font-bold text-slate-900 leading-snug">
          Build a Professional Resume in Minutes
        </p>
        <p className="text-xs text-slate-500 mt-1.5 mb-4">
          Free templates. ATS-friendly. No sign-up required.
        </p>
        <span className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold group-hover:bg-indigo-700 transition-colors">
          Learn more
        </span>
      </a>
    </div>
  )
}
