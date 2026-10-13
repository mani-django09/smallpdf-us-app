import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { FileText, ArrowLeft, CheckCircle2, Play } from "lucide-react"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { wordToPdfStore } from "../word-to-pdf"
import AdSenseUnit from "../../components/AdSenseUnit"
import LoadingPromo from "../../components/LoadingPromo"
import useDailyLimit from '../../hooks/useDailyLimit'
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import AdLabel from "../../components/AdLabel"
import { goToDownload } from "../../lib/fullPageNav"

// Dev: NEXT_PUBLIC_API_URL=http://localhost:5011 | Prod: same-origin
function getApiUrl() {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
  const { hostname, protocol } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
  }
  return `${protocol}//${hostname}`
}

export default function PreviewWordToPDF() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const [fileData, setFileData] = useState(null)
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")
  const { handleApiError, PremiumGateModal } = useFileSizeGuard("word-to-pdf")

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    // Read raw File object from memory store (no size limit, no base64)
    if (wordToPdfStore.file && wordToPdfStore.meta) {
      setFileData(wordToPdfStore.meta)
    } else {
      // Store cleared (e.g. page refresh) — send back to upload
      routerRef.current.push("/word-to-pdf")
    }
  }, [])

  const handleConvert = async () => {
    if (!fileData) return

    setConverting(true)
    setProgress(0)
    setStage(t("wordToPdf.preview.stages.uploading"))

    const stages = [
      { progress: 20, text: t("wordToPdf.preview.stages.uploading"), delay: 300 },
      { progress: 40, text: t("wordToPdf.preview.stages.processing"), delay: 400 },
      { progress: 60, text: t("wordToPdf.preview.stages.converting"), delay: 500 },
      { progress: 80, text: t("wordToPdf.preview.stages.finalizing"), delay: 300 },
      { progress: 95, text: t("wordToPdf.preview.stages.almostDone"), delay: 200 }
    ]

    let currentStage = 0
    let stopped = false
    setError("")
    const updateProgress = () => {
      if (!stopped && currentStage < stages.length) {
        setProgress(stages[currentStage].progress)
        setStage(stages[currentStage].text)
        currentStage++
        setTimeout(updateProgress, stages[currentStage - 1].delay)
      }
    }
    updateProgress()

    try {
      // Use raw File object directly — no base64, no fetch(data:URL)
      const formData = new FormData()
      formData.append("file", wordToPdfStore.file, wordToPdfStore.file.name)

      const API_URL = getApiUrl()
      const convertResponse = await fetch(`${API_URL}/api/word-to-pdf`, {
        method: "POST",
        body: formData,
      })

      // A proxy error page (413/502) is HTML, not JSON.
      const result = await convertResponse.json().catch(() => ({}))
      // Limit modals take over — put the page back so the user can continue
      // (the spinner used to keep spinning behind the modal).
      if (handleDailyLimitError(convertResponse.status, result) || handleApiError(convertResponse, result)) {
        stopped = true; setConverting(false); setProgress(0); setStage(""); return
      }

      if (convertResponse.ok && result.downloadUrl) {
        stopped = true
        setProgress(100)
        setStage(t("wordToPdf.preview.stages.complete"))
        // Make downloadUrl absolute so it works in dev (port 5011) and prod (same-origin)
        const absoluteDownloadUrl = result.downloadUrl.startsWith('http')
          ? result.downloadUrl
          : `${API_URL}${result.downloadUrl}`

        sessionStorage.setItem("conversionResult", JSON.stringify({
          ...result,
          downloadUrl: absoluteDownloadUrl,
        }))
        setTimeout(() => {
          goToDownload(router, `/word-to-pdf/download?file=${encodeURIComponent(absoluteDownloadUrl)}`)
        }, 500)
      } else {
        // Failures used to just stop the spinner with no message at all.
        console.error("Conversion failed:", result.error)
        stopped = true
        setError(result.message || t("wordToPdf.preview.errorGeneric"))
        setConverting(false)
        setProgress(0)
        setStage("")
      }
    } catch (error) {
      console.error("Error:", error)
      stopped = true
      setError(t("wordToPdf.preview.errorGeneric"))
      setConverting(false)
      setProgress(0)
      setStage("")
    }
  }

  if (!fileData) {
    return (
      <>
        <SEOHead noIndex={true} />
        <Layout>
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="relative w-12 h-12 mx-auto mb-3">
                <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
                <div className="absolute inset-0 border-3 border-t-red-600 rounded-full animate-spin"></div>
              </div>
              <p className="text-slate-600 font-medium text-sm">{t("wordToPdf.preview.loading")}</p>
            </div>
          </div>
        </Layout>
      </>
    )
  }

  return (
    <>
      <SEOHead noIndex={true} />
      <Layout
        title={t("wordToPdf.preview.layoutTitle")}
        description={t("wordToPdf.preview.layoutDesc")}
      >
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Compact Header */}
      <div className="bg-gradient-to-r from-red-600 to-rose-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto px-4 py-5">
          <button
            onClick={() => router.push("/word-to-pdf")}
            className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-xs font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t("wordToPdf.preview.changeFile")}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                {t("wordToPdf.preview.readyToConvert")}
              </h1>
              <p className="font-body text-xs text-white/80">{t("wordToPdf.preview.headerSubtitle")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-5">
        <div className="max-w-4xl mx-auto">
          <AdSenseUnit adSlot="8004544994" size="leaderboard" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Card */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* File Info Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-white truncate">{fileData.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{(fileData.size / 1024 / 1024).toFixed(2)} {t("wordToPdf.preview.mbSize")}</span>
                        <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                        <span>{fileData.name.split('.').pop().toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                      <span className="text-xs font-medium text-emerald-300">{t("wordToPdf.preview.ready")}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {!converting ? (
                    <>
                      {/* Status Card */}
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 text-center border border-slate-200 mb-5">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-sm mb-3 border border-slate-200">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900 mb-1">
                          {t("wordToPdf.preview.documentValidated")}
                        </h3>
                        <p className="font-body text-sm text-slate-600">
                          {t("wordToPdf.preview.validatedSubtitle")}
                        </p>
                      </div>

                      {error && (
                        <div role="alert" className="mb-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">
                          {error}
                        </div>
                      )}

                      {/* Convert Button */}
                      <button
                        onClick={handleConvert}
                        className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:from-red-700 hover:to-rose-700 hover:shadow-lg hover:shadow-red-500/25 transition-all flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        <span>{t("wordToPdf.preview.startConversion")}</span>
                      </button>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">{(fileData.size / 1024).toFixed(0)}</div>
                          <div className="font-body text-xs text-slate-500">{t("wordToPdf.preview.kbSize")}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-emerald-600">&lt;3s</div>
                          <div className="font-body text-xs text-slate-500">{t("wordToPdf.preview.estTime")}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">100%</div>
                          <div className="font-body text-xs text-slate-500">{t("wordToPdf.preview.quality")}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <div className="text-center mb-5">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-red-600 border-r-red-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                        <p className="font-body text-sm text-slate-600">{progress}{t("wordToPdf.preview.percentComplete")}</p>
                      </div>

                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                        <div
                          className="bg-gradient-to-r from-red-600 to-rose-600 h-full transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="font-body text-xs text-red-800 text-center">
                          {t("wordToPdf.preview.pleaseWait")}
                        </p>
                      </div>

                      <div className="flex justify-center mt-3">
                        <LoadingPromo />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Sidebar Ad */}
              <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide"><AdLabel /></p>
                <AdSenseUnit adSlot="1617102171" />
              </div>

              {/* Sidebar Ad 2 */}
              <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide"><AdLabel /></p>
                <AdSenseUnit adSlot="1617102171" size="rectangle2" />
              </div>

            </div>
          </div>
        </div>
      </div>
      {DailyLimitGate}
      {PremiumGateModal}
    </Layout>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["wordToPdf"]) },
    revalidate: 86400,
  }
}
