// hooks/usePdfThumbnail.js
// Loads PDF.js from CDN (same source the pdf-to-word page already uses) and
// exposes a generateThumbnail(file) helper that renders the first page of a PDF
// File object to a small JPEG data URL — for "preview before download" UIs.

import { useEffect, useRef, useState, useCallback } from 'react'

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

export function usePdfThumbnail() {
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

  // Returns { thumbnail: dataURL|null, pageCount: number }
  const generateThumbnail = useCallback(async (file, scale = 0.5) => {
    const pdfjs = pdfjsRef.current
    if (!pdfjs || !file) return { thumbnail: null, pageCount: 0 }
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer, isEvalSupported: false /* CVE-2024-4367: no eval of font code from untrusted PDFs */ }).promise
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: context, viewport }).promise

      return {
        thumbnail: canvas.toDataURL('image/jpeg', 0.7),
        pageCount: pdf.numPages,
      }
    } catch (_) {
      return { thumbnail: null, pageCount: 0 }
    }
  }, [])

  return { ready, generateThumbnail }
}
