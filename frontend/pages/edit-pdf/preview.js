// pages/edit-pdf/preview.js — click any text in the PDF and retype it directly.
//
// PDF.js gives us every text line with its exact position, baseline, font size
// and colour (see hooks/usePdfTextPages). We render the page as an image and lay
// transparent hit-targets over each detected line, so clicking one turns it into
// an input pre-filled with the original text. Only changed lines are sent up.
//
// The server covers the original line and redraws the new text as real vector
// text at the same baseline, so the page stays sharp, selectable and searchable.
//
// UI: an editor workspace — top bar (mode, highlight, undo/redo, zoom, save),
// page thumbnails on the left, a floating format bar on the active text, and a
// "Your changes" list on the right.
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react"
import { editPdfStore } from "./index"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import AdSenseUnit from "../../components/AdSenseUnit"
import AdLabel from "../../components/AdLabel"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { useAuth } from "../../context/AuthContext"
import { getApiUrl } from "../../lib/getApiUrl"
import { usePdfTextPages } from "../../hooks/usePdfTextPages"
import useDailyLimit from "../../hooks/useDailyLimit"
import {
  PenLine, ArrowLeft, Download, Shield, Zap, Clock, RotateCcw, X, Check,
  Plus, Minus, MousePointerClick, Type, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Highlighter, Bold, Italic, Trash2, FileText, Lightbulb, AlertTriangle, Palette,
} from "lucide-react"
import { goToDownload } from "../../lib/fullPageNav"

const COLOR_SWATCHES = ["#0f172a", "#dc2626", "#2563eb", "#16a34a", "#ffffff"]
const NEW_TEXT_FONT_SIZE = 16
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const FAMILIES = { sans: "sans-serif", serif: "serif", mono: "monospace" }

// Must mirror the server's font mapping so the preview matches the output.
function cssFontStack(fontFamily) {
  const f = String(fontFamily || "").toLowerCase()
  if (/mono|courier|consol/.test(f)) return "'Courier New', Courier, monospace"
  if (/sans/.test(f)) return "Arial, Helvetica, sans-serif"
  if (/times|georgia|garamond|serif|roman|minion|book|cambria/.test(f)) return "'Times New Roman', Times, serif"
  return "Arial, Helvetica, sans-serif"
}

// Width of a string in a given CSS font — lets edited text grow its box
// instead of being clipped to the original line's width.
let measureCtx = null
function measureText(text, font) {
  if (typeof document === "undefined") return 0
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")
  measureCtx.font = font
  return measureCtx.measureText(text || "").width
}

// An edit only counts if something actually differs from the original line.
function editDiffers(e) {
  const l = e.line
  return e.text !== l.str || e.fontSize !== l.fontSize || e.color !== l.color ||
    !!e.bold !== !!l.bold || !!e.italic !== !!l.italic
}

// Compact signature of the document state, used to skip no-op history entries.
function docSig(edits, newItems) {
  return JSON.stringify([
    Object.entries(edits).map(([id, e]) => [id, e.text, e.fontSize, e.color, !!e.bold, !!e.italic]),
    newItems.map((n) => [n.id, n.text, n.fontSize, n.color, !!n.bold, !!n.italic, n.family, n.x, n.top]),
  ])
}

// ── Floating format bar shown on the active text ─────────────────────────────
function FormatBar({ anchor, wrapWidth, item, isNew, t, barRef, onFormat, onRevert, onDone }) {
  // Position from the bar's REAL size. It used to assume a 50px-tall bar capped at
  // 460px wide — but its buttons need ~500px, so it wrapped to two rows (~76px) and
  // sat right on top of the line being edited.
  const [size, setSize] = useState({ w: 0, h: 44 })
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const w = el.offsetWidth, h = el.offsetHeight
    if (w !== size.w || h !== size.h) setSize({ w, h })
  })
  const maxW = Math.max(wrapWidth - 8, 200)
  const barW = size.w || Math.min(isNew ? 580 : 500, maxW)
  const left = Math.max(4, Math.min(anchor.left, wrapWidth - barW - 4))
  const gap = 8
  const above = anchor.top - size.h - gap
  const top = above > 4 ? above : anchor.top + anchor.height + gap
  const keep = (e) => e.preventDefault() // don't steal focus from the text input
  const btn = "h-8 min-w-[32px] px-1.5 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"

  return (
    <div
      ref={barRef}
      className="absolute z-40 flex w-max flex-wrap items-center gap-0.5 rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-1.5 py-1 shadow-xl shadow-slate-900/10"
      style={{ left, top, maxWidth: maxW }}
      onMouseDown={keep}
    >
      <button className={btn} onClick={() => onFormat({ sizeDelta: -1 })} aria-label={t("editPdf.preview.textSize") + " −"} title={t("editPdf.preview.textSize")}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-xs font-semibold tabular-nums text-slate-700">{Math.round(item.fontSize)}</span>
      <button className={btn} onClick={() => onFormat({ sizeDelta: 1 })} aria-label={t("editPdf.preview.textSize") + " +"} title={t("editPdf.preview.textSize")}>
        <Plus className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-5 bg-slate-200 mx-1" />
      <button className={`${btn} ${item.bold ? "bg-slate-900 text-white hover:bg-slate-800" : ""}`} onClick={() => onFormat({ bold: !item.bold })} aria-pressed={!!item.bold} title={t("editPdf.preview.bold")}>
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button className={`${btn} ${item.italic ? "bg-slate-900 text-white hover:bg-slate-800" : ""}`} onClick={() => onFormat({ italic: !item.italic })} aria-pressed={!!item.italic} title={t("editPdf.preview.italic")}>
        <Italic className="w-3.5 h-3.5" />
      </button>

      {isNew && (
        <>
          <span className="w-px h-5 bg-slate-200 mx-1" />
          {["sans", "serif", "mono"].map((f) => (
            <button
              key={f}
              onClick={() => onFormat({ family: f })}
              className={`h-8 px-2 rounded-lg text-xs font-medium transition-colors ${item.family === f ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-slate-600 hover:bg-slate-100"}`}
              style={{ fontFamily: cssFontStack(FAMILIES[f]) }}
            >
              {t(`editPdf.preview.font${f[0].toUpperCase()}${f.slice(1)}`)}
            </button>
          ))}
        </>
      )}

      <span className="w-px h-5 bg-slate-200 mx-1" />
      <div className="flex items-center gap-1 px-0.5">
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => onFormat({ color: c })}
            className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${item.color === c ? "ring-2 ring-offset-1 ring-blue-500 border-transparent" : "border-slate-300"}`}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
        <label className="relative w-6 h-6 grid place-items-center rounded-full hover:bg-slate-100 cursor-pointer" title={t("editPdf.preview.customColor")}>
          <Palette className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(item.color || "") ? item.color : "#000000"}
            onChange={(e) => onFormat({ color: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={(e) => { if (!(barRef.current && barRef.current.contains(e.relatedTarget)) && !(e.relatedTarget && e.relatedTarget.tagName === "INPUT")) onDone() }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>

      <span className="w-px h-5 bg-slate-200 mx-1" />
      <button className={`${btn} hover:text-red-600`} onClick={onRevert} title={isNew ? t("editPdf.preview.remove") : t("editPdf.preview.revert")}>
        {isNew ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
      </button>
      <button className="h-8 px-2.5 ml-0.5 inline-flex items-center gap-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700" onClick={onDone}>
        <Check className="w-3.5 h-3.5" /> {t("editPdf.preview.done")}
      </button>
    </div>
  )
}

// ── One detected text line: transparent until clicked, then an inline input ──
function TextLine({ line, edit, k, isActive, addMode, highlight, intro, onActivate, onChange, onCommit, onEscape, barRef }) {
  const inputRef = useRef(null)
  const isEdited = !!edit
  const value = isEdited ? edit.text : line.str
  const fontSize = (isEdited && edit.fontSize ? edit.fontSize : line.fontSize) * k
  const color = isEdited && edit.color ? edit.color : line.color
  const bold = isEdited ? !!edit.bold : !!line.bold
  const italic = isEdited ? !!edit.italic : !!line.italic
  const stack = cssFontStack(line.fontFamily)

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isActive])

  const textW = (isEdited || isActive)
    ? measureText(value, `${italic ? "italic " : ""}${bold ? 700 : 400} ${fontSize}px ${stack}`) + 6
    : 0
  const box = {
    left: line.x * k,
    top: line.top * k,
    width: Math.max(line.width * k, fontSize * 0.8, textW),
    height: line.height * k,
  }
  const textStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: `${box.height}px`,
    fontFamily: stack,
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? "italic" : "normal",
    color,
    whiteSpace: "pre",
  }

  if (isActive) {
    return (
      <div className="absolute z-30" style={{ ...box, minWidth: 40 }}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCommit() }
            if (e.key === "Escape") { e.preventDefault(); onEscape() }
          }}
          onBlur={(e) => { if (barRef.current && barRef.current.contains(e.relatedTarget)) return; onCommit() }}
          className="block w-full h-full bg-white outline-none ring-2 ring-blue-500 rounded-[3px] px-[1px] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
          style={textStyle}
        />
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onActivate() }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate() } }}
      title={line.str}
      className={`group absolute z-20 cursor-text rounded-[3px] transition-all duration-200 ${addMode ? "pointer-events-none" : ""} ${
        isEdited
          ? "bg-white ring-1 ring-emerald-400 hover:ring-2 hover:ring-emerald-500"
          : highlight
            ? `bg-blue-500/[0.07] ring-1 ring-blue-400/40 hover:bg-blue-500/15 hover:ring-blue-500 ${intro ? "animate-pulse" : ""}`
            : "hover:bg-blue-500/10 hover:ring-1 hover:ring-blue-400"
      }`}
      style={box}
    >
      {isEdited && (
        <>
          <span className="block w-full h-full overflow-hidden" style={textStyle}>{value}</span>
          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
        </>
      )}
    </div>
  )
}

// ── A freshly added text box (no original content underneath to cover) ───────
function NewText({ item, k, isActive, placeholder, onActivate, onChange, onCommit, onRemove, barRef }) {
  const inputRef = useRef(null)
  useEffect(() => {
    if (isActive && inputRef.current) inputRef.current.focus()
  }, [isActive])

  const fontSize = item.fontSize * k
  const stack = cssFontStack(FAMILIES[item.family] || "sans-serif")
  const style = {
    fontSize: `${fontSize}px`,
    lineHeight: `${fontSize * 1.25}px`,
    fontFamily: stack,
    fontWeight: item.bold ? 700 : 400,
    fontStyle: item.italic ? "italic" : "normal",
    color: item.color,
    whiteSpace: "pre",
  }
  const w = measureText(item.text || placeholder, `${item.italic ? "italic " : ""}${item.bold ? 700 : 400} ${fontSize}px ${stack}`) + 14
  const box = { left: item.x * k, top: item.top * k, width: Math.max(60, w) }

  if (isActive) {
    return (
      <div className="absolute z-30" style={box}>
        <input
          ref={inputRef}
          value={item.text}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCommit() }
            if (e.key === "Escape") { e.preventDefault(); onRemove() }
          }}
          onBlur={(e) => {
            if (barRef.current && barRef.current.contains(e.relatedTarget)) return
            if (!item.text.trim()) onRemove(); else onCommit()
          }}
          className="block w-full bg-white/90 outline-none ring-2 ring-blue-500 rounded-[3px] px-1 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
          style={style}
        />
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onActivate() }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onActivate() } }}
      className="absolute z-20 cursor-text rounded-[3px] px-1 ring-1 ring-violet-400 hover:ring-2 hover:ring-violet-500 bg-white/60"
      style={box}
    >
      <span style={style}>{item.text}</span>
      <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-violet-500 ring-2 ring-white" />
    </div>
  )
}

// ── One page: image + overlay layer ─────────────────────────────────────────
function PageEditor({
  page, edits, newItems, activeId, addMode, highlight, intro, zoom, t, pageRef,
  onActivate, onChangeText, onCommit, onEscapeLine, onAddAt, onChangeNew, onRemoveNew,
  onFormat, onRevertActive,
}) {
  const wrapRef = useRef(null)
  const barRef = useRef(null)
  const [renderedWidth, setRenderedWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setRenderedWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Scale factor from the PDF's render-pixel space to what's on screen now.
  const k = renderedWidth ? renderedWidth / page.width : 0

  const handleSurfaceClick = (e) => {
    if (!addMode || !k) return
    const rect = wrapRef.current.getBoundingClientRect()
    onAddAt(page.pageNumber, (e.clientX - rect.left) / k, (e.clientY - rect.top) / k)
  }

  // Anchor for the floating format bar (the active line / new box on this page).
  let active = null
  if (activeId && k) {
    const line = page.lines.find((l) => l.id === activeId)
    if (line && edits[line.id]) {
      active = { isNew: false, item: edits[line.id], anchor: { left: line.x * k, top: line.top * k, height: line.height * k } }
    } else {
      const n = newItems.find((x) => x.id === activeId)
      if (n) active = { isNew: true, item: n, anchor: { left: n.x * k, top: n.top * k, height: n.fontSize * k * 1.3 } }
    }
  }

  const pageEdits = page.lines.filter((l) => edits[l.id] && editDiffers(edits[l.id])).length + newItems.filter((n) => n.text.trim()).length
  const sizeStyle = zoom === "fit"
    ? { width: "100%", maxWidth: 920 }
    : { width: Math.round(page.width * zoom), maxWidth: "none" }

  return (
    <div ref={pageRef} data-page={page.pageNumber} className="mb-8 mx-auto scroll-mt-40" style={sizeStyle}>
      <div className="flex items-center justify-between mb-2 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <FileText className="w-3.5 h-3.5" />
          {t("editPdf.preview.pageOf", { current: page.pageNumber, total: page.total })}
          {pageEdits > 0 && (
            <span className="ml-1 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold">{pageEdits}</span>
          )}
        </span>
        {page.lines.length === 0 && (
          <span className="text-[11px] text-amber-600 font-medium">{t("editPdf.preview.noTextOnPage")}</span>
        )}
      </div>
      <div
        ref={wrapRef}
        onClick={handleSurfaceClick}
        className={`relative w-full rounded-lg bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_32px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/5 transition-shadow ${
          addMode ? "cursor-crosshair ring-2 ring-blue-400/60" : ""
        }`}
      >
        <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="block w-full select-none rounded-lg" draggable={false} />

        {k > 0 && page.lines.map((line) => (
          <TextLine
            key={line.id}
            line={line}
            edit={edits[line.id]}
            k={k}
            isActive={activeId === line.id}
            addMode={addMode}
            highlight={highlight && !addMode}
            intro={intro}
            barRef={barRef}
            onActivate={() => onActivate(line.id, line)}
            onChange={(v) => onChangeText(line.id, v)}
            onCommit={onCommit}
            onEscape={() => onEscapeLine(line.id)}
          />
        ))}

        {k > 0 && newItems.map((item) => (
          <NewText
            key={item.id}
            item={item}
            k={k}
            isActive={activeId === item.id}
            placeholder={t("editPdf.preview.newTextPlaceholder")}
            barRef={barRef}
            onActivate={() => onActivate(item.id, null)}
            onChange={(v) => onChangeNew(item.id, v)}
            onCommit={onCommit}
            onRemove={() => onRemoveNew(item.id, { silent: true })}
          />
        ))}

        {active && (
          <FormatBar
            anchor={active.anchor}
            wrapWidth={renderedWidth}
            item={active.item}
            isNew={active.isNew}
            t={t}
            barRef={barRef}
            onFormat={onFormat}
            onRevert={onRevertActive}
            onDone={onCommit}
          />
        )}
      </div>
    </div>
  )
}

function ToolbarButton({ onClick, disabled, active, title, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`h-9 min-w-[36px] px-2 inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
        active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } ${className}`}
    >
      {children}
    </button>
  )
}

export default function EditPreview() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const { authFetch } = useAuth()
  const { ready: pdfReady, renderPagesWithText } = usePdfTextPages()

  const [meta, setMeta] = useState(null)
  const [pages, setPages] = useState([])
  const [loadingPages, setLoadingPages] = useState(true)
  const [edits, setEdits] = useState({})      // lineId -> { text, fontSize, color, bold, italic, line }
  const [newItems, setNewItems] = useState([]) // freshly added text boxes
  const [activeId, setActiveId] = useState(null)
  const [addMode, setAddMode] = useState(false)
  const [highlight, setHighlight] = useState(true)
  const [intro, setIntro] = useState(false)
  const [zoom, setZoom] = useState("fit")
  const [currentPage, setCurrentPage] = useState(1)
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })
  const docRef = useRef({ edits, newItems })
  useEffect(() => { docRef.current = { edits, newItems } }, [edits, newItems])
  const pageRefs = useRef({})

  useEffect(() => {
    if (editPdfStore.file) setMeta({ name: editPdfStore.name, size: editPdfStore.size })
    else routerRef.current.push("/edit-pdf")
  }, [])

  useEffect(() => {
    let cancelled = false
    if (editPdfStore.file && pdfReady) {
      setLoadingPages(true)
      ;(async () => {
        try {
          const rendered = await renderPagesWithText(editPdfStore.file, 900)
          if (!cancelled) {
            setPages(rendered.map((p) => ({ ...p, total: rendered.length })))
            setLoadingPages(false)
            // brief pulse on the editable lines so it's obvious what can be clicked
            setIntro(true); setTimeout(() => setIntro(false), 2600)
          }
        } catch (_) {
          if (!cancelled) { setError(t("editPdf.errorRender")); setLoadingPages(false) }
        }
      })()
    }
    return () => { cancelled = true }
  }, [pdfReady, renderPagesWithText]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track which page is in view (thumbnail highlight + "Page x of y").
  useEffect(() => {
    if (!pages.length || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (vis) setCurrentPage(Number(vis.target.dataset.page))
    }, { threshold: [0.25, 0.5, 0.75] })
    Object.values(pageRefs.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [pages, zoom])

  const lineIndex = useMemo(() => {
    const m = {}
    for (const p of pages) for (const l of p.lines) m[l.id] = p.pageNumber
    return m
  }, [pages])
  const totalLines = useMemo(() => pages.reduce((s, p) => s + p.lines.length, 0), [pages])
  const changedCount = Object.values(edits).filter(editDiffers).length + newItems.filter((n) => n.text.trim()).length

  // ── History (one undo step per edit session / action) ─────────────────────
  // Snapshots are normalised (no untouched edit entries, no empty new boxes) so
  // undoing never resurrects a half-started edit.
  const normalize = (doc) => {
    const e = {}
    for (const [id, x] of Object.entries(doc.edits)) if (editDiffers(x)) e[id] = x
    return { edits: e, newItems: doc.newItems.filter((n) => n.text.trim()) }
  }
  // Update state AND the ref together, so an action followed immediately by
  // commit() in the same tick sees the new value.
  const setDoc = useCallback((doc) => {
    docRef.current = doc
    setEdits(doc.edits); setNewItems(doc.newItems)
  }, [])

  const record = useCallback(() => {
    const snap = normalize(docRef.current)
    setPast((p) => [...p.slice(-49), snap])
    setFuture([])
  }, [])

  const undo = useCallback(() => {
    if (!past.length) return
    const prev = past[past.length - 1]
    const now = normalize(docRef.current)
    setPast(past.slice(0, -1))
    setFuture((f) => [now, ...f])
    setActiveId(null)
    setDoc(prev)
  }, [past, setDoc])

  const redo = useCallback(() => {
    if (!future.length) return
    const next = future[0]
    const now = normalize(docRef.current)
    setFuture(future.slice(1))
    setPast((p) => [...p, now])
    setActiveId(null)
    setDoc(next)
  }, [future, setDoc])

  // ── Editing actions ───────────────────────────────────────────────────────
  const activate = useCallback((id, line) => {
    setAddMode(false)
    record()
    setActiveId(id)
    if (line) {
      setEdits((prev) => prev[id] ? prev : {
        ...prev,
        [id]: { text: line.str, fontSize: line.fontSize, color: line.color, bold: !!line.bold, italic: !!line.italic, line },
      })
    }
  }, [record])

  const changeText = useCallback((id, text) => {
    setEdits((prev) => prev[id] ? { ...prev, [id]: { ...prev[id], text } } : prev)
  }, [])

  const commit = useCallback(() => {
    setActiveId(null)
    // Drop entries that are identical to the original — nothing to send.
    const next = normalize(docRef.current)
    setDoc(next)
    // If this edit session changed nothing, don't leave an empty undo step.
    const sig = docSig(next.edits, next.newItems)
    setPast((p) => (p.length && docSig(p[p.length - 1].edits, p[p.length - 1].newItems) === sig) ? p.slice(0, -1) : p)
  }, [setDoc])

  const withoutEdit = (id) => {
    const e = { ...docRef.current.edits }
    delete e[id]
    return { ...docRef.current, edits: e }
  }

  const revertLine = useCallback((id) => {
    record()
    setDoc(withoutEdit(id))
  }, [record, setDoc])

  // Esc while typing: throw away this line's change and close the editor.
  const escapeLine = useCallback((id) => {
    setDoc(withoutEdit(id))
    commit()
  }, [commit, setDoc])

  const format = useCallback((patch) => {
    const apply = (o) => ({
      ...o,
      fontSize: patch.sizeDelta ? Math.max(5, Math.min(120, o.fontSize + patch.sizeDelta)) : o.fontSize,
      color: patch.color || o.color,
      bold: patch.bold !== undefined ? patch.bold : o.bold,
      italic: patch.italic !== undefined ? patch.italic : o.italic,
      family: patch.family || o.family,
    })
    setEdits((prev) => prev[activeId] ? { ...prev, [activeId]: (({ family, ...rest }) => rest)(apply(prev[activeId])) } : prev)
    setNewItems((prev) => prev.map((n) => n.id === activeId ? apply(n) : n))
  }, [activeId])

  const addAt = useCallback((pageNumber, x, y) => {
    record()
    const id = `new-${Date.now()}`
    setNewItems((prev) => [...prev, {
      id, page: pageNumber, x, top: y,
      text: "", fontSize: NEW_TEXT_FONT_SIZE, color: COLOR_SWATCHES[0], bold: false, italic: false, family: "sans", isNew: true,
    }])
    setActiveId(id)
    setAddMode(false)
  }, [record])

  const changeNew = useCallback((id, text) => {
    setNewItems((prev) => prev.map((n) => n.id === id ? { ...n, text } : n))
  }, [])

  // silent: discarding the box that is being typed into (Esc / empty blur /
  // trash on the format bar) — that's part of the current edit session, so
  // commit() folds it into (or drops) the session's history step.
  const removeNew = useCallback((id, { silent } = {}) => {
    if (!silent) record()
    setDoc({ ...docRef.current, newItems: docRef.current.newItems.filter((n) => n.id !== id) })
    if (silent) commit()
    else setActiveId((cur) => cur === id ? null : cur)
  }, [record, setDoc, commit])

  const revertActive = useCallback(() => {
    if (!activeId) return
    if (String(activeId).startsWith("new-")) removeNew(activeId, { silent: true })
    else { setDoc(withoutEdit(activeId)); commit() }
  }, [activeId, removeNew, commit, setDoc])

  const resetAll = useCallback(() => {
    record()
    setActiveId(null); setAddMode(false)
    setDoc({ edits: {}, newItems: [] })
  }, [record, setDoc])

  const jumpTo = useCallback((pageNumber, activateId, line) => {
    const el = pageRefs.current[pageNumber]
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    if (activateId) setTimeout(() => activate(activateId, line), 350)
  }, [activate])

  const zoomBy = (dir) => setZoom((z) => {
    if (z === "fit") return dir > 0 ? 1.25 : 0.75
    const i = ZOOM_STEPS.indexOf(z)
    return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))]
  })

  // Keyboard: Ctrl/Cmd+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, Esc leaves add mode.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || ""
      if (tag === "INPUT" || tag === "TEXTAREA") return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo() }
      else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo() }
      else if (e.key === "Escape") setAddMode(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo])

  const handleSubmit = async () => {
    if (!editPdfStore.file) return
    const payload = []

    for (const p of pages) {
      const cw = p.width, ch = p.height
      for (const line of p.lines) {
        const e = edits[line.id]
        if (!e || !editDiffers(e)) continue

        // PDF.js reports a line's x *after* any leading indent, but the text
        // operator in the content stream starts at the indent. To let the server
        // find and delete the original glyphs we tell it how far left it may
        // look: up to whatever else sits on this same baseline, or the page edge
        // if this line stands alone. That keeps indented lines matchable without
        // ever reaching into a neighbouring table cell.
        const tol = Math.max(2, line.fontSize * 0.35)
        let leftBound = 0
        for (const other of p.lines) {
          if (other === line) continue
          if (Math.abs(other.baselineY - line.baselineY) > tol) continue
          const otherEnd = other.x + other.width
          if (otherEnd <= line.x + 1 && otherEnd > leftBound) leftBound = otherEnd
        }

        payload.push({
          page: p.pageNumber,
          x: line.x, y: line.top, width: line.width, height: line.height,
          leftBound,
          baselineY: line.baselineY,
          fontSize: e.fontSize || line.fontSize,
          text: e.text,
          fontFamily: line.fontFamily,
          bold: e.bold !== undefined ? e.bold : line.bold,
          italic: e.italic !== undefined ? e.italic : line.italic,
          color: e.color || line.color,
          canvasWidth: cw, canvasHeight: ch,
        })
      }
      for (const n of newItems) {
        if (n.page !== p.pageNumber || !n.text.trim()) continue
        payload.push({
          page: p.pageNumber,
          x: n.x, y: n.top, width: 0, height: n.fontSize * 1.18,
          baselineY: n.top + n.fontSize * 0.8,
          fontSize: n.fontSize,
          text: n.text,
          fontFamily: FAMILIES[n.family] || "sans-serif",
          bold: !!n.bold, italic: !!n.italic,
          color: n.color,
          isNew: true,
          canvasWidth: cw, canvasHeight: ch,
        })
      }
    }

    if (payload.length === 0) { setError(t("editPdf.errorNoEdits")); return }
    setActiveId(null)
    setProcessing(true); setError(""); setProgress(0)

    const stages = [
      { p: 25, s: t("editPdf.preview.stageUploading"), d: 350 },
      { p: 60, s: t("editPdf.preview.stageProcessing"), d: 600 },
      { p: 88, s: t("editPdf.preview.stageFinalizing"), d: 400 },
    ]
    setStage(t("editPdf.preview.stagePreparing"))
    let i = 0
    const tick = () => { if (i < stages.length) { setProgress(stages[i].p); setStage(stages[i].s); const d = stages[i].d; i++; setTimeout(tick, d) } }
    tick()

    try {
      const fd = new FormData()
      fd.append("file", editPdfStore.file, editPdfStore.name)
      fd.append("edits", JSON.stringify(payload))

      const resp = await authFetch(`${getApiUrl()}/api/edit-pdf`, { method: "POST", body: fd })
      const data = await resp.json()
      if (handleDailyLimitError(resp.status, data)) { setProcessing(false); setProgress(0); return }
      if (!resp.ok || !data.success) {
        if (data.error === "PASSWORD_PROTECTED") throw new Error(t("toolErrors.passwordProtected", { name: data.fileName || editPdfStore.name }))
        if (data.error === "CORRUPT_PDF") throw new Error(t("toolErrors.corrupt", { name: data.fileName || editPdfStore.name }))
        throw new Error(t("editPdf.errorGeneric"))
      }

      setProgress(100); setStage(t("editPdf.preview.stageComplete"))
      const absoluteUrl = data.downloadUrl.startsWith("http") ? data.downloadUrl : `${getApiUrl()}${data.downloadUrl}`
      sessionStorage.setItem("editResult", JSON.stringify({
        downloadUrl: absoluteUrl, convertedName: data.convertedName,
        pageCount: data.pageCount || pages.length,
        editedPages: data.editedPages || 0,
        editCount: payload.length,
        // pages saved as an image (text the standard PDF fonts can't write, e.g. Hindi/Japanese)
        rasterizedPageNumbers: data.rasterizedPageNumbers || [],
      }))
      setTimeout(() => goToDownload(router, "/edit-pdf/download"), 400)
    } catch (e) {
      setError(e.message || t("editPdf.errorGeneric"))
      setProcessing(false); setProgress(0); setStage("")
    }
  }

  if (!meta) {
    return (
      <Layout>
        <SEOHead title="Edit PDF - Preview | SmallPDF.us" description="Edit your PDF." noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
          <div className="w-10 h-10 border-[3px] border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  // "Your changes" list
  const changes = [
    ...Object.entries(edits).filter(([, e]) => editDiffers(e)).map(([id, e]) => ({ id, kind: "edit", page: lineIndex[id] || 1, from: e.line.str, to: e.text, line: e.line })),
    ...newItems.filter((n) => n.text.trim()).map((n) => ({ id: n.id, kind: "add", page: n.page, to: n.text })),
  ].sort((a, b) => a.page - b.page)
  const editsPerPage = changes.reduce((m, c) => { m[c.page] = (m[c.page] || 0) + 1; return m }, {})
  const sizeLabel = meta.size ? `${(meta.size / 1024 / 1024).toFixed(meta.size > 1048576 ? 1 : 2)} MB` : ""
  const zoomLabel = zoom === "fit" ? t("editPdf.preview.zoomFit") : `${Math.round(zoom * 100)}%`
  const benefits = [
    { Icon: MousePointerClick, text: t("editPdf.preview.benefitWhiteout") },
    { Icon: Shield, text: t("editPdf.preview.benefitSecure") },
    { Icon: Zap, text: t("editPdf.preview.benefitFast") },
    { Icon: Clock, text: t("editPdf.preview.benefitAutoDelete") },
  ]
  const R = 34, C = 2 * Math.PI * R

  return (
    <Layout>
      <SEOHead title={t("editPdf.preview.pageTitle")} description={t("editPdf.preview.subheading")} noIndex={true} />
      {DailyLimitGate}

      <div className="min-h-screen bg-slate-100 pb-24 lg:pb-10">
        {/* ── Editor top bar ─────────────────────────────────────────────── */}
        <div className="sticky top-[68px] z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div className="max-w-[1500px] mx-auto px-3 lg:px-4 h-14 flex items-center gap-2">
            <button
              onClick={() => router.push("/edit-pdf")}
              className="h-9 w-9 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 shrink-0"
              title={t("editPdf.preview.changeFile")}
              aria-label={t("editPdf.preview.changeFile")}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2.5 min-w-0 mr-1">
              <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm">
                <PenLine className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[220px]" title={meta.name}>{meta.name}</p>
                <p className="text-[11px] text-slate-500">
                  {pages.length ? t("editPdf.preview.pagesCount", { n: pages.length }) : "…"}{sizeLabel && ` · ${sizeLabel}`}
                </p>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* Mode switch */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setAddMode(false)}
                className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium transition-all ${!addMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Type className="w-4 h-4" /><span className="hidden md:inline">{t("editPdf.preview.modeEdit")}</span>
              </button>
              <button
                onClick={() => { setAddMode(true); setActiveId(null) }}
                className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium transition-all ${addMode ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Plus className="w-4 h-4" /><span className="hidden md:inline">{t("editPdf.preview.addTextButton")}</span>
              </button>
            </div>

            <ToolbarButton onClick={() => setHighlight((v) => !v)} active={highlight} title={t("editPdf.preview.highlightToggle")} className="hidden sm:inline-flex">
              <Highlighter className="w-4 h-4" />
            </ToolbarButton>

            <div className="h-6 w-px bg-slate-200 mx-0.5" />
            <ToolbarButton onClick={undo} disabled={!past.length} title={`${t("editPdf.preview.undo")} (Ctrl+Z)`}><Undo2 className="w-4 h-4" /></ToolbarButton>
            <ToolbarButton onClick={redo} disabled={!future.length} title={`${t("editPdf.preview.redo")} (Ctrl+Shift+Z)`}><Redo2 className="w-4 h-4" /></ToolbarButton>

            <div className="hidden md:flex items-center">
              <div className="h-6 w-px bg-slate-200 mx-1.5" />
              <ToolbarButton onClick={() => zoomBy(-1)} disabled={zoom !== "fit" && zoom <= ZOOM_STEPS[0]} title={t("editPdf.preview.zoomOut")}><ZoomOut className="w-4 h-4" /></ToolbarButton>
              <button onClick={() => setZoom("fit")} className="h-9 min-w-[52px] px-1.5 rounded-lg text-xs font-semibold tabular-nums text-slate-600 hover:bg-slate-100" title={t("editPdf.preview.zoomFit")}>{zoomLabel}</button>
              <ToolbarButton onClick={() => zoomBy(1)} disabled={zoom !== "fit" && zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} title={t("editPdf.preview.zoomIn")}><ZoomIn className="w-4 h-4" /></ToolbarButton>
              <ToolbarButton onClick={() => setZoom("fit")} active={zoom === "fit"} title={t("editPdf.preview.zoomFit")}><Maximize2 className="w-4 h-4" /></ToolbarButton>
            </div>

            <div className="flex-1" />

            {pages.length > 1 && (
              <span className="hidden xl:inline text-xs font-medium text-slate-500 mr-2 tabular-nums">
                {t("editPdf.preview.pageOf", { current: currentPage, total: pages.length })}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={changedCount === 0 || processing}
              className="hidden lg:inline-flex h-10 items-center gap-2 pl-4 pr-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/30 hover:brightness-110 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all"
            >
              <Download className="w-4 h-4" />
              {t("editPdf.preview.saveButton")}
              <span className={`min-w-[24px] h-6 px-1.5 grid place-items-center rounded-full text-xs font-bold ${changedCount ? "bg-white text-blue-700" : "bg-white/25"}`}>{changedCount}</span>
            </button>
          </div>

          {addMode && (
            <div className="border-t border-blue-100 bg-blue-50/90">
              <div className="max-w-[1500px] mx-auto px-4 py-2 flex items-center gap-2 text-sm text-blue-800">
                <MousePointerClick className="w-4 h-4 shrink-0" />
                <span className="flex-1">{t("editPdf.preview.addTextHint")}</span>
                <button onClick={() => setAddMode(false)} className="text-xs font-semibold px-2 py-1 rounded-md hover:bg-blue-100">
                  {t("editPdf.preview.panelCancel")} · Esc
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Header Ad */}
        <div className="max-w-[1500px] mx-auto px-3 lg:px-4 pt-4">
          <AdSenseUnit adSlot="8004544994" size="leaderboard" label="Header Ad" className="rounded-xl overflow-hidden" />
        </div>

        {error && (
          <div className="max-w-[1500px] mx-auto px-3 lg:px-4 mt-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")} aria-label={t("editPdf.preview.dismiss")}><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        <div className="max-w-[1500px] mx-auto px-3 lg:px-4 pt-5 grid gap-5 lg:grid-cols-[120px_minmax(0,1fr)_300px] items-start">
          {/* ── Page thumbnails ── */}
          <aside className="hidden lg:block sticky top-[144px] max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">{t("editPdf.preview.pagesLabel")}</p>
            <div className="space-y-3">
              {(loadingPages ? [1, 2] : pages).map((p, i) => loadingPages ? (
                <div key={i} className="aspect-[3/4] rounded-md bg-slate-200 animate-pulse" />
              ) : (
                <button
                  key={p.pageNumber}
                  onClick={() => jumpTo(p.pageNumber)}
                  className={`group relative block w-full rounded-md overflow-hidden bg-white transition-all ${currentPage === p.pageNumber ? "ring-2 ring-blue-500 shadow-md" : "ring-1 ring-slate-200 hover:ring-slate-400"}`}
                  aria-label={t("editPdf.preview.pageOf", { current: p.pageNumber, total: pages.length })}
                >
                  <img src={p.dataUrl} alt="" className="block w-full" draggable={false} />
                  <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 text-[10px] font-semibold text-white">{p.pageNumber}</span>
                  {editsPerPage[p.pageNumber] > 0 && (
                    <span className="absolute top-1 right-1 min-w-[20px] h-5 px-1 grid place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow">{editsPerPage[p.pageNumber]}</span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* ── Canvas ── */}
          <main className="min-w-0 overflow-x-auto">
            {loadingPages ? (
              <div className="mx-auto max-w-[920px]">
                <div className="h-4 w-24 rounded bg-slate-200 animate-pulse mb-2" />
                <div className="relative aspect-[1/1.414] rounded-lg bg-white shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
                  <div className="absolute inset-0 p-[8%] space-y-4">
                    <div className="h-6 w-1/2 rounded bg-slate-100 animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
                    {[92, 80, 86, 70, 90, 60].map((w, i) => <div key={i} className="h-3 rounded bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />)}
                  </div>
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow ring-1 ring-slate-200 text-sm text-slate-600">
                      <span className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                      {t("editPdf.preview.loadingPages")}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {totalLines === 0 && pages.length > 0 && (
                  <div className="mx-auto max-w-[920px] mb-4 flex gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {t("editPdf.preview.noTextFound")}
                  </div>
                )}
                {pages.map((p) => (
                  <PageEditor
                    key={p.pageNumber}
                    page={p}
                    pageRef={(el) => { pageRefs.current[p.pageNumber] = el }}
                    edits={edits}
                    newItems={newItems.filter((n) => n.page === p.pageNumber)}
                    activeId={activeId}
                    addMode={addMode}
                    highlight={highlight}
                    intro={intro}
                    zoom={zoom}
                    t={t}
                    onActivate={activate}
                    onChangeText={changeText}
                    onCommit={commit}
                    onEscapeLine={escapeLine}
                    onAddAt={addAt}
                    onChangeNew={changeNew}
                    onRemoveNew={removeNew}
                    onFormat={format}
                    onRevertActive={revertActive}
                  />
                ))}
              </>
            )}
          </main>

          {/* ── Right panel ── */}
          <aside className="lg:sticky lg:top-[144px] space-y-4 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-sm font-bold text-slate-900">{t("editPdf.preview.changesTitle")}</h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 tabular-nums">{changedCount}</span>
                  {changedCount > 0 && (
                    <button onClick={resetAll} className="text-xs font-medium text-slate-500 hover:text-red-600 inline-flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> {t("editPdf.preview.clearAll")}
                    </button>
                  )}
                </div>
              </div>
              {changes.length === 0 ? (
                <div className="px-4 pb-4 text-center">
                  <div className="mx-auto mb-2 w-10 h-10 grid place-items-center rounded-full bg-slate-100 text-slate-400">
                    <MousePointerClick className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{t("editPdf.preview.changesEmpty")}</p>
                </div>
              ) : (
                <ul className="px-2 pb-2 max-h-[340px] overflow-y-auto">
                  {changes.map((c) => (
                    <li key={c.id} className="group flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-slate-50">
                      <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${c.kind === "edit" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
                        P{c.page}
                      </span>
                      <button
                        className="flex-1 min-w-0 text-left"
                        onClick={() => jumpTo(c.page, c.id, c.kind === "edit" ? c.line : null)}
                      >
                        {c.kind === "edit" && c.from !== c.to && (
                          <span className="block text-xs text-slate-400 line-through truncate">{c.from}</span>
                        )}
                        <span className="block text-sm text-slate-800 truncate">
                          {c.kind === "add" && <Plus className="inline w-3 h-3 mr-0.5 -mt-0.5 text-violet-600" />}
                          {c.to}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {c.kind === "edit" ? t("editPdf.preview.editedBadge") : t("editPdf.preview.addedBadge")}
                        </span>
                      </button>
                      <button
                        onClick={() => (c.kind === "edit" ? revertLine(c.id) : removeNew(c.id))}
                        className="opacity-60 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title={c.kind === "edit" ? t("editPdf.preview.revert") : t("editPdf.preview.remove")}
                      >
                        {c.kind === "edit" ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center"><AdLabel /></p>
              <div className="flex justify-center"><AdSenseUnit adSlot="1617102171" /></div>
            </div>
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center"><AdLabel /></p>
              <div className="flex justify-center"><AdSenseUnit adSlot="7489539676" size="rectangle2" /></div>
            </div>
          </aside>
        </div>

        {/* ── Mobile save bar ── */}
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 tabular-nums">{changedCount} <span className="font-medium text-slate-500">{t("editPdf.download.editsLabel")}</span></p>
              <p className="text-[11px] text-slate-500 truncate">{meta.name}</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={changedCount === 0 || processing}
              className="h-11 px-5 inline-flex items-center gap-2 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-600/25 disabled:opacity-40 disabled:shadow-none"
            >
              <Download className="w-4 h-4" /> {t("editPdf.preview.saveButton")}
            </button>
          </div>
        </div>

        {/* ── Saving overlay ── */}
        {processing && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
              <div className="relative mx-auto mb-4 w-24 h-24">
                <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
                  <circle cx="40" cy="40" r={R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <circle cx="40" cy="40" r={R} fill="none" stroke="url(#editGrad)" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - progress / 100)} className="transition-[stroke-dashoffset] duration-500" />
                  <defs>
                    <linearGradient id="editGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#2563eb" /><stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 grid place-items-center text-lg font-bold text-slate-900 tabular-nums">{progress}%</span>
              </div>
              <p className="text-base font-bold text-slate-900">{t("editPdf.preview.savingTitle")}</p>
              <p className="mt-1 text-sm text-slate-500">{stage}</p>
              <p className="mt-3 text-xs text-slate-400 truncate">{meta.name} · {changedCount} {t("editPdf.download.editsLabel")}</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["editPdf"]) },
    revalidate: 86400,
  }
}
