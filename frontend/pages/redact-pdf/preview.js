// pages/redact-pdf/preview.js — draw black-out boxes over each page (or find text
// and mark every match), then redact.
// Boxes are recorded in each page's natural render-pixel space (resolution-safe),
// and rescaled to the server's rasterized PNG for TRUE redaction (text removed).
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { redactPdfStore } from "./index"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import AdSenseUnit from "../../components/AdSenseUnit"
import PrivacyNotice from "../../components/PrivacyNotice"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { useAuth } from "../../context/AuthContext"
import { getApiUrl } from "../../lib/getApiUrl"
import { usePdfPages } from "../../hooks/usePdfPages"
import useDailyLimit from "../../hooks/useDailyLimit"
import {
  EyeOff, ArrowLeft, Play, Lock, Trash2, X, Search, Undo2, Mail, Phone, Plus,
} from "lucide-react"
import AdLabel from "../../components/AdLabel"
import { goToDownload } from "../../lib/fullPageNav"

const MIN_BOX = 6 // ignore accidental tiny drags (natural px)

// Quick-find presets. Regexes run per text run on each page.
const PRESETS = {
  emails: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  numbers: /\+?\d[\d\s().-]{6,}\d/g, // phone numbers, IDs, account numbers
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Every match of `re` in a page's text runs → boxes in page pixel space. A match
// inside a run is located by character share of the run's width, padded so
// proportional-font glyphs at the edges stay covered.
function findBoxes(pages, re) {
  const out = []
  for (const pg of pages) {
    for (const it of pg.textItems || []) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(it.str)) !== null) {
        if (!m[0]) { re.lastIndex++; continue }
        const len = it.str.length
        const padX = it.h * 0.15
        const x = it.x + (it.w * m.index) / len - padX
        const w = (it.w * m[0].length) / len + padX * 2
        const y = it.y - it.h * 0.1
        const h = it.h * 1.35
        out.push({
          page: pg.pageNumber,
          x: Math.max(0, x), y: Math.max(0, y),
          width: Math.min(pg.width - Math.max(0, x), w), height: Math.min(pg.height - Math.max(0, y), h),
          canvasWidth: pg.width, canvasHeight: pg.height,
        })
      }
    }
  }
  return out
}

const sameBox = (a, b) =>
  a.page === b.page && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 &&
  Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1

// ── Single page with drawable redaction boxes ────────────────────────────────
function RedactCanvas({ page, boxes, matches, onAddBox, onRemoveBox, removeLabel }) {
  const ref = useRef(null)
  const [draft, setDraft] = useState(null) // {x,y,w,h} in natural px (for rendering)
  const draftRef = useRef(null)            // latest draft, read synchronously on pointer-up

  // Convert a pointer event to natural page-pixel coordinates.
  const toNatural = (e) => {
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * page.width
    const y = ((e.clientY - rect.top) / rect.height) * page.height
    return {
      x: Math.max(0, Math.min(page.width, x)),
      y: Math.max(0, Math.min(page.height, y)),
    }
  }

  const startRef = useRef(null)

  const setDraftBoth = (v) => { draftRef.current = v; setDraft(v) }

  const onPointerDown = (e) => {
    // Ignore clicks that land on a delete button.
    if (e.target.dataset?.role === "del") return
    e.preventDefault()
    try { ref.current.setPointerCapture?.(e.pointerId) } catch (_) {}
    const p = toNatural(e)
    startRef.current = p
    setDraftBoth({ x: p.x, y: p.y, w: 0, h: 0 })
  }

  const onPointerMove = (e) => {
    if (!startRef.current) return
    const p = toNatural(e)
    const s = startRef.current
    setDraftBoth({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    })
  }

  const onPointerUp = () => {
    const d = draftRef.current
    if (d && d.w >= MIN_BOX && d.h >= MIN_BOX) {
      onAddBox({
        page: page.pageNumber,
        x: d.x, y: d.y, width: d.w, height: d.h,
        canvasWidth: page.width, canvasHeight: page.height,
      })
    }
    startRef.current = null
    setDraftBoth(null)
  }

  const pct = (v, total) => `${(v / total) * 100}%`
  const place = (b) => ({ left: pct(b.x, page.width), top: pct(b.y, page.height), width: pct(b.width, page.width), height: pct(b.height, page.height) })

  return (
    <div className="relative inline-block leading-none select-none shadow-sm">
      <img
        src={page.dataUrl}
        alt={`page ${page.pageNumber}`}
        className="block w-full h-auto rounded border border-slate-200 pointer-events-none"
        draggable={false}
      />
      {/* Draw surface */}
      <div
        ref={ref}
        className="absolute inset-0 cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* search matches not yet marked */}
        {matches.map((b, i) => (
          <div key={`m${i}`} className="absolute bg-amber-300/40 ring-2 ring-amber-400 rounded-[2px] pointer-events-none" style={place(b)} />
        ))}
        {/* committed boxes */}
        {boxes.map((b, i) => (
          <div
            key={i}
            className="absolute bg-black/90 border border-red-400"
            style={place(b)}
          >
            <button
              type="button"
              data-role="del"
              aria-label={removeLabel}
              title={removeLabel}
              onPointerDown={(e) => { e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation(); onRemoveBox(i) }}
              className="absolute -top-2.5 -right-2.5 w-5 h-5 min-h-0 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow"
            >
              <X data-role="del" className="w-3 h-3 pointer-events-none" />
            </button>
          </div>
        ))}
        {/* live draft */}
        {draft && (
          <div
            className="absolute bg-black/60 border-2 border-red-500"
            style={{ left: pct(draft.x, page.width), top: pct(draft.y, page.height), width: pct(draft.w, page.width), height: pct(draft.h, page.height) }}
          />
        )}
      </div>
      <span className="absolute top-1.5 left-1.5 bg-slate-900/70 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
        {page.pageNumber}
      </span>
    </div>
  )
}

export default function RedactPreview() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const { authFetch } = useAuth()
  const { ready: pdfReady, renderPages } = usePdfPages()

  const [meta, setMeta] = useState(null)
  const [pages, setPages] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [loadingPages, setLoadingPages] = useState(true)
  const [boxes, setBoxes] = useState([]) // flat list; each has .page
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [preset, setPreset] = useState(null) // "emails" | "numbers" | null

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    if (redactPdfStore.file) {
      setMeta({ name: redactPdfStore.name, size: redactPdfStore.size })
    } else {
      routerRef.current.push("/redact-pdf")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (redactPdfStore.file && pdfReady) {
      setLoadingPages(true)
      setPages([])
      ;(async () => {
        try {
          // Pages appear one by one as they render.
          await renderPages(redactPdfStore.file, 820, (pg, n) => {
            if (cancelled) return
            setTotalPages(n)
            setPages((prev) => [...prev, pg])
          })
          if (!cancelled) setLoadingPages(false)
        } catch (_) {
          if (!cancelled) { setError(t("redactPdf.errorRender")); setLoadingPages(false) }
        }
      })()
    }
    return () => { cancelled = true }
  }, [pdfReady, renderPages]) // eslint-disable-line react-hooks/exhaustive-deps

  const addBox = useCallback((box) => setBoxes((prev) => [...prev, box]), [])
  const removeBoxOnPage = useCallback((pageNumber, indexOnPage) => {
    setBoxes((prev) => {
      let seen = -1
      return prev.filter((b) => {
        if (b.page !== pageNumber) return true
        seen++
        return seen !== indexOnPage
      })
    })
  }, [])
  const undo = useCallback(() => setBoxes((prev) => prev.slice(0, -1)), [])
  const clearAll = () => setBoxes([])

  // Ctrl/Cmd+Z removes the last box (not while typing in the search field).
  useEffect(() => {
    const onKey = (e) => {
      if (processing) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && e.target.tagName !== "INPUT") {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, processing])

  const hasText = pages.some((p) => p.textItems && p.textItems.length)

  // Current search → candidate boxes that aren't marked yet.
  const matches = useMemo(() => {
    const q = query.trim()
    let re = null
    if (preset) re = new RegExp(PRESETS[preset].source, PRESETS[preset].flags)
    else if (q.length >= 2) re = new RegExp(escapeRe(q), "gi")
    if (!re) return []
    return findBoxes(pages, re).filter((m) => !boxes.some((b) => sameBox(b, m)))
  }, [query, preset, pages, boxes])
  const searching = !!preset || query.trim().length >= 2

  const markMatches = () => {
    if (!matches.length) return
    setBoxes((prev) => [...prev, ...matches])
    setQuery("")
    setPreset(null)
  }

  const boxesForPage = (n) => boxes.filter((b) => b.page === n)
  const matchesForPage = (n) => matches.filter((b) => b.page === n)

  const handleRedact = async () => {
    if (!redactPdfStore.file) return
    if (boxes.length === 0) { setError(t("redactPdf.errorNoBoxes")); return }
    setProcessing(true); setError(""); setProgress(0)
    window.scrollTo({ top: 0, behavior: "smooth" })

    const stages = [
      { p: 25, s: t("redactPdf.preview.stageUploading"), d: 350 },
      { p: 60, s: t("redactPdf.preview.stageProcessing"), d: 600 },
      { p: 88, s: t("redactPdf.preview.stageFinalizing"), d: 400 },
    ]
    setStage(t("redactPdf.preview.stagePreparing"))
    let i = 0
    let stopped = false
    const tick = () => { if (!stopped && i < stages.length) { setProgress(stages[i].p); setStage(stages[i].s); const d = stages[i].d; i++; setTimeout(tick, d) } }
    tick()

    try {
      const fd = new FormData()
      fd.append("file", redactPdfStore.file, redactPdfStore.name)
      fd.append("boxes", JSON.stringify(boxes))

      const resp = await authFetch(`${getApiUrl()}/api/redact-pdf`, { method: "POST", body: fd })
      // A proxy error page (413/502) isn't JSON — don't surface "Unexpected token <".
      const data = await resp.json().catch(() => ({}))
      if (handleDailyLimitError(resp.status, data)) { stopped = true; setProcessing(false); setProgress(0); return }
      if (!resp.ok || !data.success) throw new Error(data.message || data.error || t("redactPdf.errorGeneric"))

      stopped = true
      setProgress(100); setStage(t("redactPdf.preview.stageComplete"))
      const absoluteUrl = data.downloadUrl.startsWith("http") ? data.downloadUrl : `${getApiUrl()}${data.downloadUrl}`
      sessionStorage.setItem("redactResult", JSON.stringify({
        downloadUrl: absoluteUrl, convertedName: data.convertedName,
        pageCount: data.pageCount || pages.length, redactedPages: data.redactedPages || 0, boxCount: boxes.length,
      }))
      setTimeout(() => goToDownload(router, "/redact-pdf/download"), 400)
    } catch (e) {
      stopped = true
      setError(e.message || t("redactPdf.errorGeneric"))
      setProcessing(false); setProgress(0); setStage("")
    }
  }

  if (!meta) {
    return (
      <Layout>
        <SEOHead title="Redact PDF - Preview | SmallPDF.us" description="Redact your PDF." noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  const redactLabel = `${t("redactPdf.preview.redactButton")}${boxes.length > 0 ? ` (${boxes.length})` : ""}`

  return (
    <Layout title={t("redactPdf.preview.pageTitle")} description={t("redactPdf.heroSubtitle")}>
      <SEOHead title="Redact PDF - Preview | SmallPDF.us" description="Redact your PDF and download." noIndex={true} />

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <button onClick={() => router.push("/redact-pdf")} className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /><span>{t("redactPdf.preview.changeFile")}</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center"><EyeOff className="w-5 h-5 text-white" /></div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white">{t("redactPdf.preview.heading")}</h1>
              <p className="text-xs text-white/80">{t("redactPdf.preview.subheading")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 px-4 pt-5"><div className="max-w-6xl mx-auto"><AdSenseUnit adSlot="8004544994" size="leaderboard" /></div></div>

      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-10 gap-5">
          {/* Main — pages */}
          <div className="lg:col-span-7 min-w-0">
            {processing ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="py-10 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
                  <p className="font-bold text-slate-900 mb-1">{stage}</p>
                  <p className="text-sm text-slate-600 mb-4">{progress}{t("redactPdf.preview.percentComplete")}</p>
                  <div className="max-w-xs mx-auto bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-700 to-slate-900 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                {/* Sticky action bar — the Redact button stays reachable while scrolling pages */}
                <div className="sticky top-[68px] z-20 bg-white/95 backdrop-blur border-b border-slate-200 rounded-t-xl px-3 sm:px-4 py-2.5 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 flex-shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-slate-900 text-white text-xs">{boxes.length}</span>
                    <span className="hidden sm:inline">{t("redactPdf.preview.areasMarked")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={undo}
                    disabled={boxes.length === 0}
                    title={`${t("redactPdf.preview.undo")} (Ctrl+Z)`}
                    className="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Undo2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t("redactPdf.preview.undo")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={boxes.length === 0}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t("redactPdf.preview.clearAll")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRedact}
                    disabled={boxes.length === 0}
                    className="min-w-0 inline-flex items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-950 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-bold hover:from-slate-900 hover:to-black shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{redactLabel}</span>
                  </button>
                </div>

                <div className="p-4 sm:p-5">
                  {/* Find & redact */}
                  {!loadingPages && hasText && (
                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">{t("redactPdf.preview.findTitle")}</p>
                      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                        <div className="relative flex-1 min-w-0">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="search"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setPreset(null) }}
                            onKeyDown={(e) => { if (e.key === "Enter") markMatches() }}
                            placeholder={t("redactPdf.preview.findPlaceholder")}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={markMatches}
                          disabled={!matches.length}
                          className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold bg-slate-900 text-white px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          <Plus className="w-4 h-4" /> {t("redactPdf.preview.markMatches", { count: matches.length })}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500">{t("redactPdf.preview.quickFind")}</span>
                        {[["emails", Mail, t("redactPdf.preview.presetEmails")], ["numbers", Phone, t("redactPdf.preview.presetNumbers")]].map(([key, Icon, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => { setPreset(preset === key ? null : key); setQuery("") }}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 min-h-0 rounded-full border ${preset === key ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"}`}
                          >
                            <Icon className="w-3 h-3" /> {label}
                          </button>
                        ))}
                        {searching && (
                          <span className="text-xs text-slate-600 ml-auto">
                            {matches.length ? t("redactPdf.preview.matchesFound", { count: matches.length }) : t("redactPdf.preview.noMatches")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900 text-sm">{t("redactPdf.preview.instruction")}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{t("redactPdf.preview.instructionHint")}</p>
                  </div>

                  <div className="space-y-5">
                    {pages.map((pg) => (
                      <div key={pg.pageNumber} className="flex justify-center">
                        <RedactCanvas
                          page={pg}
                          boxes={boxesForPage(pg.pageNumber)}
                          matches={matchesForPage(pg.pageNumber)}
                          onAddBox={addBox}
                          onRemoveBox={(idx) => removeBoxOnPage(pg.pageNumber, idx)}
                          removeLabel={t("redactPdf.preview.removeBox")}
                        />
                      </div>
                    ))}
                    {loadingPages && (
                      <div className="py-12 text-center text-slate-400">
                        <div className="w-10 h-10 mx-auto mb-3 border-3 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
                        <p className="text-sm">
                          {totalPages > 0
                            ? t("redactPdf.preview.renderingPage", { current: Math.min(pages.length + 1, totalPages), total: totalPages })
                            : t("redactPdf.preview.loadingPages")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <button
                      onClick={handleRedact}
                      disabled={boxes.length === 0}
                      className="w-full bg-gradient-to-r from-slate-800 to-slate-950 text-white py-3.5 rounded-xl font-bold hover:from-slate-900 hover:to-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" /> {redactLabel}
                    </button>
                    {error && <p className="mt-3 text-sm text-red-700 font-medium text-center">{error}</p>}
                  </div>
                </div>
              </div>
            )}
            {!processing && <PrivacyNotice minutes={60} variant="inline" className="mt-4" />}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide"><AdLabel /></p>
              <AdSenseUnit adSlot="1617102171" />
            </div>

            <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide"><AdLabel /></p>
              <AdSenseUnit adSlot="1617102171" size="rectangle2" />
            </div>

          </div>
        </div>
      </div>
      {DailyLimitGate}
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["redactPdf"]) },
    revalidate: 86400,
  }
}
