// hooks/usePdfTextPages.js
// Like usePdfPages, but additionally extracts every text line on each page with
// its exact position, baseline, font metrics and sampled colour. Used by the
// edit-pdf tool so the user can click any existing text and retype it directly
// instead of drawing boxes by hand.
//
// Coordinates are in the same render-pixel space as the returned dataUrl, so the
// overlay maths and the server-side rescale both stay resolution-safe.

import { useEffect, useRef, useState, useCallback } from 'react'

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

// PDFs commonly split a visual line into many small runs ("Total", ":", "1,240").
// Editing those individually would be miserable, so runs that share a baseline
// and sit next to each other get merged into one editable line.
//
// Whitespace-only runs are kept during grouping on purpose: PDF.js splits an
// indented line's leading spaces into their own run, and the real text-showing
// operator in the content stream starts at the *indent*, not at the first
// visible glyph. The server needs that true origin (runX) to find and delete the
// original text, while the visible bounds (x/width) drive drawing and covering.
function finalizeLine(items) {
  const visible = items.filter((i) => i.str.trim())
  if (visible.length === 0) return null

  let str = ''
  items.forEach((it, i) => {
    if (i > 0) {
      const prev = items[i - 1]
      const gap = it.x - (prev.x + prev.width)
      // Re-insert the space PDF text extraction usually drops between runs.
      if (gap > prev.fontSize * 0.16 && !/\s$/.test(str) && !/^\s/.test(it.str)) str += ' '
    }
    str += it.str
  })

  const first = visible[0]
  const last = visible[visible.length - 1]
  const lefts = items.map((i) => i.x)
  const rights = items.map((i) => i.x + i.width)
  const runX = Math.min(...lefts)

  return {
    str: str.trim(),
    x: first.x,
    width: (last.x + last.width) - first.x,
    runX,
    runWidth: Math.max(...rights) - runX,
    top: Math.min(...visible.map((i) => i.top)),
    height: Math.max(...visible.map((i) => i.height)),
    baselineY: first.baselineY,
    fontSize: Math.max(...visible.map((i) => i.fontSize)),
    fontFamily: first.fontFamily,
    bold: first.bold,
    italic: first.italic,
  }
}

// PDF.js inserts a synthetic " " item to bridge the gap between two separate
// text chunks on a line (e.g. "Betrag:" … "1.250,00 EUR" in another column).
// Its width is the whole gap — far wider than its characters — so treating it as
// a normal space merged columns into one line: editing the amount then redrew
// "Betrag: 1.250,00 EUR" in one font, pulling the amount out of its column.
// Real (content-stream) spaces are ~0.25–0.3 em per character.
const isGapFiller = (it) => !it.str.trim() && it.width > Math.max(1, it.str.length) * it.fontSize * 0.6

function mergeIntoLines(allItems) {
  const items = allItems.filter((it) => !isGapFiller(it))
  const sorted = [...items].sort((a, b) =>
    Math.abs(a.baselineY - b.baselineY) > Math.max(2, a.fontSize * 0.35)
      ? a.baselineY - b.baselineY
      : a.x - b.x
  )

  const groups = []
  for (const it of sorted) {
    const group = groups[groups.length - 1]
    if (group) {
      const ref = group[group.length - 1]
      const sameLine = Math.abs(ref.baselineY - it.baselineY) <= Math.max(2, ref.fontSize * 0.35)
      const gap = it.x - (ref.x + ref.width)
      const closeEnough = gap <= ref.fontSize * 0.8 && gap > -ref.fontSize * 2
      // A different typeface starts a new line too (an edit is redrawn in one font).
      const sameStyle = ref.bold === it.bold && ref.italic === it.italic &&
        (ref.fontFamily === it.fontFamily || !it.str.trim() || !ref.str.trim())
      if (sameLine && closeEnough && sameStyle) { group.push(it); continue }
    }
    groups.push([it])
  }

  return groups.map(finalizeLine).filter(Boolean)
}

// Best-effort text colour: the darkest pixel inside the glyph box. Text is
// almost always darker than the paper behind it, so this reads real colours
// (dark blue headings, red totals) without needing to parse content streams.
function sampleTextColor(ctx, x, y, w, h) {
  try {
    const sx = Math.max(0, Math.floor(x))
    const sy = Math.max(0, Math.floor(y))
    const sw = Math.max(1, Math.min(Math.floor(w), ctx.canvas.width - sx))
    const sh = Math.max(1, Math.min(Math.floor(h), ctx.canvas.height - sy))
    if (sw <= 0 || sh <= 0) return '#000000'
    const { data } = ctx.getImageData(sx, sy, sw, sh)
    let best = null
    let bestLum = Infinity
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      if (lum < bestLum) { bestLum = lum; best = [r, g, b] }
    }
    if (!best || bestLum > 205) return '#000000' // nothing dark found — assume black
    const hex = (v) => v.toString(16).padStart(2, '0')
    return `#${hex(best[0])}${hex(best[1])}${hex(best[2])}`
  } catch (_) {
    return '#000000'
  }
}

export function usePdfTextPages() {
  const [ready, setReady] = useState(false)
  const pdfjsRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const attach = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
        pdfjsRef.current = window.pdfjsLib
        setReady(true)
        return true
      }
      return false
    }

    if (attach()) return

    let script = document.querySelector(`script[src="${PDFJS_SRC}"]`)
    const onLoad = () => attach()
    if (!script) {
      script = document.createElement('script')
      script.src = PDFJS_SRC
      script.onload = onLoad
      document.head.appendChild(script)
    } else {
      script.addEventListener('load', onLoad)
    }
    return () => script && script.removeEventListener('load', onLoad)
  }, [])

  // Returns [{ pageNumber, dataUrl, width, height, lines: [...] }]
  // Each line: { id, str, x, top, width, height, baselineY, fontSize, fontFamily, bold, italic, color }
  const renderPagesWithText = useCallback(async (file, maxWidth = 900) => {
    const pdfjs = pdfjsRef.current
    if (!pdfjs || !file) return []
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer, isEvalSupported: false /* CVE-2024-4367: no eval of font code from untrusted PDFs */ }).promise
    const out = []

    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const unscaled = page.getViewport({ scale: 1 })
      const scale = Math.min(2, maxWidth / unscaled.width)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvasContext: ctx, viewport }).promise

      // ── Text extraction ──────────────────────────────────────────────────
      let lines = []
      try {
        const tc = await page.getTextContent()
        const raw = []
        for (const item of tc.items) {
          const str = item.str
          // Whitespace-only runs are kept (see finalizeLine) — only truly empty
          // items are useless.
          if (!str) continue

          // Map the item's text-space matrix into viewport (canvas) space.
          const tx = pdfjs.Util.transform(viewport.transform, item.transform)
          const fontSize = Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1])
          if (!fontSize || fontSize < 1) continue
          // Only text that reads horizontally on screen can be edited in a
          // horizontal box (vertical text on a rotated page got a sideways box).
          if (Math.abs(Math.atan2(tx[1], tx[0])) > 0.09) continue

          const style = tc.styles?.[item.fontName] || {}
          const family = String(style.fontFamily || '')
          const ascent = typeof style.ascent === 'number' && style.ascent > 0 ? style.ascent : 0.8

          const x = tx[4]
          const baselineY = tx[5]
          const width = Math.abs(item.width) * scale
          const top = baselineY - fontSize * ascent

          if (width < 1) continue

          raw.push({
            str,
            x,
            top,
            width,
            height: fontSize * 1.18,
            baselineY,
            fontSize,
            fontFamily: family,
            bold: /bold|black|heavy|semibold/i.test(family),
            italic: /italic|oblique/i.test(family),
          })
        }

        lines = mergeIntoLines(raw).map((l, i) => ({
          ...l,
          id: `${n}-${i}`,
          color: sampleTextColor(ctx, l.x, l.top, l.width, l.height),
        }))
      } catch (_) {
        lines = [] // scanned/image-only page — nothing selectable, that's fine
      }

      out.push({
        pageNumber: n,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
        lines,
      })
    }
    return out
  }, [])

  return { ready, renderPagesWithText }
}
