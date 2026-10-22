// pages/rotate-pdf/preview.js — review + rotate, then send to /download.
import { useState, useEffect, useRef } from "react"
import { rotatePdfStore } from "./index"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import AdSenseUnit from "../../components/AdSenseUnit"
import PromoBanner from "../../components/PromoBanner"
import PrivacyNotice from "../../components/PrivacyNotice"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { useAuth } from "../../context/AuthContext"
import { getApiUrl } from "../../lib/getApiUrl"
import { usePdfThumbnail } from "../../hooks/usePdfThumbnail"
import useDailyLimit from '../../hooks/useDailyLimit'
import {
  RotateCw, RotateCcw, ArrowLeft, FileText, Play,
} from "lucide-react"
import { goToDownload } from "../../lib/fullPageNav"

export default function RotatePreview() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const { authFetch } = useAuth()
  const { ready: pdfReady, generateThumbnail } = usePdfThumbnail()

  const [meta, setMeta] = useState(null)        // { name, size }
  const [thumb, setThumb] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    if (rotatePdfStore.file) {
      setMeta({ name: rotatePdfStore.name, size: rotatePdfStore.size })
    } else {
      routerRef.current.push("/rotate-pdf")
    }
  }, [])

  // Thumbnail once PDF.js ready.
  useEffect(() => {
    let cancelled = false
    if (rotatePdfStore.file && pdfReady) {
      ;(async () => {
        const { thumbnail, pageCount } = await generateThumbnail(rotatePdfStore.file, 0.9)
        if (!cancelled) { setThumb(thumbnail); setPageCount(pageCount) }
      })()
    }
    return () => { cancelled = true }
  }, [pdfReady, generateThumbnail])

  const rotateLeft = () => setRotation((r) => (r + 270) % 360)
  const rotateRight = () => setRotation((r) => (r + 90) % 360)
  const flip = () => setRotation((r) => (r + 180) % 360)

  const handleRotate = async () => {
    if (!rotatePdfStore.file) return
    if (rotation === 0) { setError(t("rotatePdf.errorPickRotation")); return }
    setProcessing(true); setError(""); setProgress(0)

    const stages = [
      { p: 20, s: t("rotatePdf.preview.stageUploading"), d: 350 },
      { p: 55, s: t("rotatePdf.preview.stageProcessing"), d: 500 },
      { p: 85, s: t("rotatePdf.preview.stageFinalizing"), d: 350 },
    ]
    setStage(t("rotatePdf.preview.stagePreparing"))
    let i = 0
    const tick = () => { if (i < stages.length) { setProgress(stages[i].p); setStage(stages[i].s); const d = stages[i].d; i++; setTimeout(tick, d) } }
    tick()

    try {
      const fd = new FormData()
      fd.append("file", rotatePdfStore.file, rotatePdfStore.name)
      fd.append("angle", String(rotation))

      const resp = await authFetch(`${getApiUrl()}/api/rotate-pdf`, { method: "POST", body: fd })
      const data = await resp.json()
      if (handleDailyLimitError(resp.status, data)) { setProcessing(false); setProgress(0); return }  // daily-limit upgrade modal
      if (!resp.ok || !data.success) {
        // Server sends codes (English text is only a fallback) → localized message.
        if (data.error === "PASSWORD_PROTECTED") throw new Error(t("toolErrors.passwordProtected", { name: data.fileName || rotatePdfStore.name }))
        if (data.error === "CORRUPT_PDF") throw new Error(t("toolErrors.corrupt", { name: data.fileName || rotatePdfStore.name }))
        throw new Error(t("rotatePdf.errorGeneric"))
      }

      setProgress(100); setStage(t("rotatePdf.preview.stageComplete"))
      const absoluteUrl = data.downloadUrl.startsWith("http") ? data.downloadUrl : `${getApiUrl()}${data.downloadUrl}`
      sessionStorage.setItem("rotateResult", JSON.stringify({
        downloadUrl: absoluteUrl, convertedName: data.convertedName, pageCount: data.pageCount || pageCount, angle: rotation,
      }))
      setTimeout(() => goToDownload(router, "/rotate-pdf/download"), 400)
    } catch (e) {
      setError(e.message || t("rotatePdf.errorGeneric"))
      setProcessing(false); setProgress(0); setStage("")
    }
  }

  if (!meta) {
    return (
      <Layout>
        <SEOHead title="Rotate PDF - Preview | SmallPDF.us" description="Rotate your PDF." noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={t("rotatePdf.preview.pageTitle")} description={t("rotatePdf.heroSubtitle")}>
      <SEOHead title="Rotate PDF - Preview | SmallPDF.us" description="Rotate your PDF and download." noIndex={true} />

      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <button onClick={() => router.push("/rotate-pdf")} className="mb-3 flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /><span>{t("rotatePdf.preview.changeFile")}</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center"><RotateCw className="w-5 h-5 text-slate-900" /></div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">{t("rotatePdf.preview.heading")}</h1>
              <p className="text-xs text-slate-600">{t("rotatePdf.preview.subheading")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 px-4 pt-5"><div className="max-w-5xl mx-auto"><AdSenseUnit adSlot="8004544994" size="leaderboard" /></div></div>

      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-10 gap-5">
          {/* Main */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              {!processing ? (
                <div className="grid sm:grid-cols-2 gap-6 items-center">
                  {/* Preview */}
                  <div className="flex flex-col items-center">
                    <div className="w-full aspect-[3/4] max-w-xs bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt="preview" className="max-h-full max-w-full shadow-md transition-transform duration-300" style={{ transform: `rotate(${rotation}deg)` }} />
                      ) : (
                        <div className="text-slate-400 flex flex-col items-center gap-2"><FileText className="w-10 h-10" /><span className="text-xs">{t("rotatePdf.loadingPreview")}</span></div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 truncate max-w-xs">
                      {meta.name}{pageCount > 0 && ` · ${pageCount} ${pageCount > 1 ? t("rotatePdf.pagesWord") : t("rotatePdf.pageWord")}`}
                    </p>
                  </div>
                  {/* Controls */}
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">{t("rotatePdf.chooseRotation")}</h3>
                    <p className="text-sm text-slate-500 mb-4">{t("rotatePdf.appliesAllPages", { deg: rotation })}</p>
                    <div className="flex items-center gap-3 mb-5">
                      <button onClick={rotateLeft} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 rounded-lg font-semibold"><RotateCcw className="w-5 h-5" /> {t("rotatePdf.left")}</button>
                      <button onClick={flip} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 rounded-lg font-semibold">180°</button>
                      <button onClick={rotateRight} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 rounded-lg font-semibold"><RotateCw className="w-5 h-5" /> {t("rotatePdf.right")}</button>
                    </div>
                    <button onClick={handleRotate} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3.5 rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg flex items-center justify-center gap-2">
                      <Play className="w-4 h-4" /> {t("rotatePdf.rotateButton")}
                    </button>
                    {error && <p className="mt-3 text-sm text-red-700 font-medium">{error}</p>}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="font-bold text-slate-900 mb-1">{stage}</p>
                  <p className="text-sm text-slate-600 mb-4">{progress}{t("rotatePdf.preview.percentComplete")}</p>
                  <div className="max-w-xs mx-auto bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
            {!processing && <PrivacyNotice minutes={60} variant="inline" className="mt-4" />}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <PromoBanner slot={0} />
            </div>

            <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <PromoBanner slot={1} />
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
    props: { messages: getPageMessages(locale, ["rotatePdf"]) },
    revalidate: 86400,
  }
}
