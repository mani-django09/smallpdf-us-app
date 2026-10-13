// hooks/usePdfPages.js
// Loads PDF.js from CDN (same version usePdfThumbnail uses) and renders EVERY
// page of a PDF File to a PNG data URL at a display-fit scale. Used by the
// redact-pdf preview where the user draws redaction boxes over each page.

import { useEffect, useRef, useState, useCallback } from 'react'

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

export function usePdfPages() {
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

  // Render every page. Returns array of { pageNumber, dataUrl, width, height, textItems }.
  // `maxWidth` caps the rendered display width (CSS px); the box coordinates the
  // frontend records are in this same pixel space and are rescaled server-side.
  // `onPage(page, numPages)` fires as each page finishes so the UI can show
  // pages progressively instead of waiting for the whole document.
  // `textItems` are the page's horizontal text runs ({ str, x, y, w, h }, top-left
  // origin, same pixel space) — empty for scanned pages.
  const renderPages = useCallback(async (file, maxWidth = 800, onPage) => {
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
      const context = canvas.getContext('2d')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvasContext: context, viewport }).promise

      const textItems = []
      try {
        const content = await page.getTextContent()
        for (const item of content.items) {
          if (!item.str || !item.str.trim()) continue
          const tx = pdfjs.Util.transform(viewport.transform, item.transform)
          // Only runs that read left-to-right on screen (skip rotated/vertical text).
          if (Math.abs(tx[1]) > 0.01 || Math.abs(tx[2]) > 0.01 || tx[0] <= 0) continue
          const h = Math.abs(tx[3])
          textItems.push({ str: item.str, x: tx[4], y: tx[5] - h, w: item.width * viewport.scale, h })
        }
      } catch (_) {}

      const rendered = {
        pageNumber: n,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
        textItems,
      }
      out.push(rendered)
      if (onPage) onPage(rendered, pdf.numPages)
      canvas.width = canvas.height = 0 // release the bitmap early on long documents
    }
    return out
  }, [])

  return { ready, renderPages }
}
