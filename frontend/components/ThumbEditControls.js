import { useState, useRef, useEffect } from "react"
import { RotateCw, RotateCcw, SlidersHorizontal, Check } from "lucide-react"
import { IMAGE_FILTERS } from "../lib/imageEdit"
import { useTranslations } from "../lib/i18n"

// Small editing toolbar shown on an image thumbnail in the preview pages.
// Controlled component: parent owns `rotation` (degrees) and `filterId`.
// `showFilter={false}` hides the filter picker (e.g. for non-image previews
// that only need rotation).
export default function ThumbEditControls({
  rotation = 0,
  filterId = "none",
  onRotate, // (deltaDegrees) => void
  onFilter, // (filterId) => void
  showFilter = true,
  className = "",
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  // Localized labels (common.json → imageEdit.*); t() has no English fallback,
  // so fall back to the built-in English label when a key is missing.
  const { t } = useTranslations()
  const tx = (key, en) => { const v = t("imageEdit." + key); return v === "imageEdit." + key ? en : v }

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const stop = (e) => e.stopPropagation()

  return (
    <div
      ref={ref}
      onClick={stop}
      className={`flex items-center gap-1 ${className}`}
    >
      <button
        type="button"
        onClick={(e) => { stop(e); onRotate?.(-90) }}
        title={tx("rotateLeft", "Rotate left")}
        aria-label={tx("rotateLeft", "Rotate left")}
        className="w-6 h-6 rounded bg-white/90 hover:bg-white text-slate-700 shadow-sm flex items-center justify-center transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { stop(e); onRotate?.(90) }}
        title={tx("rotateRight", "Rotate right")}
        aria-label={tx("rotateRight", "Rotate right")}
        className="w-6 h-6 rounded bg-white/90 hover:bg-white text-slate-700 shadow-sm flex items-center justify-center transition-colors"
      >
        <RotateCw className="w-3.5 h-3.5" />
      </button>

      {showFilter && (
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { stop(e); setOpen((v) => !v) }}
            title={tx("filter", "Filter")}
            aria-label={tx("filter", "Filter")}
            className={`w-6 h-6 rounded shadow-sm flex items-center justify-center transition-colors ${
              filterId && filterId !== "none"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white/90 hover:bg-white text-slate-700"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {open && (
            <div
              className="absolute right-0 z-30 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
              onClick={stop}
            >
              {IMAGE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={(e) => { stop(e); onFilter?.(f.id); setOpen(false) }}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <span>{tx(f.id, f.label)}</span>
                  {filterId === f.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
