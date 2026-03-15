import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "@/lib/useLocalizedRouter"
import Layout from "@/components/Layout"
import SEOHead from "@/components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { FileText, ArrowLeft, Sparkles, Shield, Zap, Clock, Scissors, CheckCircle, Eye, X } from "lucide-react"
import { splitPdfStore } from "./index"

// Inline AdSense component
function AdSenseUnit({ adSlot, style = {} }) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch (err) {
      console.error("AdSense:", err)
    }
  }, [])
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block", ...style }}
      data-ad-client="ca-pub-6913093595582462"
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

export default function PreviewSplitPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [fileData, setFileData] = useState(null)
  const [splitting, setSplitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [previewModal, setPreviewModal] = useState({ open: false, page: null })

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    if (splitPdfStore.fileData) {
      setFileData(splitPdfStore.fileData)
    } else {
      routerRef.current.push("/split-pdf")
    }
  }, [])

  const handleSplit = async () => {
    if (!fileData) return

    setSplitting(true)
    setProgress(0)
    setStage(t("splitPdf.previewStageInit"))

    const stages = [
      { progress: 15, text: t("splitPdf.previewStageUpload"), delay: 500 },
      { progress: 35, text: t("splitPdf.previewStageAnalyze"), delay: 600 },
      { progress: 55, text: t("splitPdf.previewStageExtract"), delay: 800 },
      { progress: 75, text: t("splitPdf.previewStageBuild"), delay: 700 },
      { progress: 90, text: t("splitPdf.previewStageFinalize"), delay: 400 },
    ]

    let currentStage = 0
    const updateProgress = () => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage].progress)
        setStage(stages[currentStage].text)
        currentStage++
        setTimeout(updateProgress, stages[currentStage - 1].delay)
      }
    }
    updateProgress()

    try {
      // Convert base64 data URL → Blob without fetch() (fetch of data: URLs is unreliable)
      function dataURLtoBlob(dataURL) {
        const parts = dataURL.split(',')
        const mime = parts[0].match(/:(.*?);/)[1]
        const binary = atob(parts[1])
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return new Blob([bytes], { type: mime })
      }

      const blob = dataURLtoBlob(fileData.data)
      const file = new File([blob], fileData.name, { type: fileData.type || "application/pdf" })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("pages", JSON.stringify(fileData.selectedPages))

      // Dev: NEXT_PUBLIC_API_URL=http://localhost:5011 | Prod: same-origin
      const API_URL = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
        ? `${window.location.protocol}//${window.location.hostname}`
        : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')

      const splitResponse = await fetch(`${API_URL}/api/split-pdf`, {
        method: "POST",
        body: formData,
      })

      const result = await splitResponse.json()

      setProgress(100)
      setStage(t("splitPdf.previewStageComplete"))

      if (splitResponse.ok) {
        sessionStorage.setItem(
          "splitPdfResult",
          JSON.stringify({
            ...result,
            originalName: fileData.name,
            selectedPages: fileData.selectedPages,
            totalPages: fileData.pageCount,
          }),
        )
        setTimeout(() => {
          router.push(`/split-pdf/download?jobId=${result.jobId}`)
        }, 600)
      } else {
        console.error("Split failed:", result.error)
        setSplitting(false)
        setProgress(0)
        setStage("")
      }
    } catch (error) {
      console.error("Error:", error)
      setSplitting(false)
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
              <div className="absolute inset-0 border-3 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("splitPdf.previewLoading")}</p>
          </div>
        </div>
      </Layout>
      </>
    )
  }

  const selectedPages = fileData.selectedPages || []
  const pageThumbnails = fileData.pageThumbnails || []

  return (
    <>
      <SEOHead noIndex={true} />
      <Layout title={t("splitPdf.previewTitle")} description={t("splitPdf.previewDescription")}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }
        .animate-pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }
      `}</style>

      {/* Preview Modal */}
      {previewModal.open && previewModal.page && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewModal({ open: false, page: null })}>
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white">Page {previewModal.page.pageNumber}</h3>
                  <p className="text-sm text-slate-400">{fileData?.name}</p>
                </div>
              </div>
              <button onClick={() => setPreviewModal({ open: false, page: null })} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 bg-slate-100">
              <img src={previewModal.page.thumbnail} alt={`Page ${previewModal.page.pageNumber}`} className="w-full rounded-lg shadow-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-5">
          <button
            onClick={() => router.push("/split-pdf")}
            className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-xs font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t("splitPdf.previewChangeSelection")}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                {t("splitPdf.previewReadyTitle")
                  .replace("{count}", selectedPages.length)
                  .replace("{plural}", selectedPages.length > 1 ? "s" : "")}
              </h1>
              <p className="font-body text-xs text-white/80">{t("splitPdf.previewReadySubtitle")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-5">
        <div className="max-w-4xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Card */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-slate-800 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-purple-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-semibold text-white truncate max-w-xs">
                          {fileData.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t("splitPdf.previewExtractingOf")
                            .replace("{selected}", selectedPages.length)
                            .replace("{total}", fileData.pageCount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-purple-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                      <span className="text-xs font-medium text-purple-300">{t("splitPdf.previewReady")}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {!splitting ? (
                    <>
                      {/* Selected Pages Preview */}
                      <div className="mb-5">
                        <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                          {t("splitPdf.previewSelectedPagesTitle")}
                        </h3>
                        
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-1">
                          {pageThumbnails.map((page) => (
                            <div
                              key={page.pageNumber}
                              className="relative group rounded-lg overflow-hidden border-2 border-purple-400 shadow-md"
                            >
                              <div className="aspect-[3/4] bg-white relative overflow-hidden">
                                <img
                                  src={page.thumbnail}
                                  alt={`Page ${page.pageNumber}`}
                                  className="w-full h-full object-cover object-top"
                                />
                                
                                {/* Overlay */}
                                <div className="absolute inset-0 bg-purple-600/5" />
                                
                                {/* Check badge */}
                                <div className="absolute top-1 left-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-3 h-3 text-white" />
                                </div>
                                
                                {/* Preview button */}
                                <button
                                  onClick={() => setPreviewModal({ open: true, page })}
                                  className="absolute top-1 right-1 p-1 bg-white/90 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                  title="Preview"
                                >
                                  <Eye className="w-3 h-3 text-slate-600" />
                                </button>
                              </div>
                              
                              {/* Page number */}
                              <div className="text-center py-1 text-xs font-medium bg-purple-100 text-purple-700">
                                {page.pageNumber}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Page Range Display */}
                      <div className="bg-slate-50 rounded-lg p-4 mb-5">
                        <p className="font-display text-sm font-semibold text-slate-700 mb-2">{t("splitPdf.previewPagesToExtract")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPages.map((pageNum) => (
                            <span
                              key={pageNum}
                              className="inline-flex items-center px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full"
                            >
                              {pageNum}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Split Button */}
                      <button
                        onClick={handleSplit}
                        className="w-full bg-purple-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:bg-purple-700 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Scissors className="w-4 h-4" />
                        <span>
                          {t("splitPdf.previewSplitButton")
                            .replace("{count}", selectedPages.length)
                            .replace("{plural}", selectedPages.length !== 1 ? "s" : "")}
                        </span>
                      </button>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-purple-600">{selectedPages.length}</div>
                          <div className="font-body text-xs text-slate-500">{t("splitPdf.previewExtracting")}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">{fileData.pageCount}</div>
                          <div className="font-body text-xs text-slate-500">{t("splitPdf.previewTotalPages")}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">PDF</div>
                          <div className="font-body text-xs text-slate-500">{t("splitPdf.previewOutputFormat")}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8">
                      {/* Progress Animation */}
                      <div className="text-center mb-6">
                        <div className="relative w-20 h-20 mx-auto mb-5">
                          <div className="absolute inset-0 border-4 border-purple-200 rounded-full animate-pulse-ring"></div>
                          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-purple-600 border-r-purple-600 rounded-full animate-spin"></div>
                          <div className="absolute inset-3 bg-purple-50 rounded-full flex items-center justify-center">
                            <Scissors className="w-6 h-6 text-purple-600" />
                          </div>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 mb-1">{stage}</p>
                        <p className="font-body text-2xl font-bold text-purple-600">{progress}%</p>
                      </div>

                      {/* Progress Bar */}
                      <div className="bg-slate-100 rounded-full h-3 overflow-hidden mb-5">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-full transition-all duration-500 ease-out rounded-full relative"
                          style={{ width: `${progress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                        </div>
                      </div>

                      {/* Info Box */}
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-display text-sm font-semibold text-purple-900">{t("splitPdf.previewSplittingTitle")}</p>
                            <p className="font-body text-xs text-purple-700 mt-1">
                              {t("splitPdf.previewSplittingDesc")
                                .replace("{count}", selectedPages.length)
                                .replace("{plural}", selectedPages.length !== 1 ? "s" : "")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* What You'll Get */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t("splitPdf.previewWhatYouGet")}</h3>
                <div className="space-y-2.5">
                  {[
                    { icon: Sparkles, text: t("splitPdf.previewBenefit1"), color: "text-purple-600 bg-purple-100" },
                    { icon: Shield, text: t("splitPdf.previewBenefit2"), color: "text-slate-600 bg-slate-100" },
                    { icon: Zap, text: t("splitPdf.previewBenefit3"), color: "text-amber-600 bg-amber-100" },
                    { icon: Clock, text: t("splitPdf.previewBenefit4"), color: "text-slate-600 bg-slate-100" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color.split(" ")[1]}`}>
                        <item.icon className={`w-3.5 h-3.5 ${item.color.split(" ")[0]}`} />
                      </div>
                      <span className="font-body text-xs text-slate-700">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Process Steps */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t("splitPdf.previewProcessTitle")}</h3>
                <div className="space-y-2">
                  {[
                    { num: "1", text: t("splitPdf.previewStep1"), done: true },
                    { num: "2", text: t("splitPdf.previewStep2"), done: true },
                    { num: "3", text: t("splitPdf.previewStep3"), done: false },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 ${step.done ? "bg-purple-600" : splitting ? "bg-purple-600 animate-pulse" : "bg-slate-400"} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {step.done ? <CheckCircle className="w-3 h-3" /> : step.num}
                      </div>
                      <span className={`font-body text-xs ${step.done ? "text-slate-900 font-medium" : "text-slate-600"}`}>
                        {step.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tip */}
              <div className="bg-gradient-to-br from-purple-50 to-slate-50 rounded-xl p-4 border border-purple-100">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-2">{t("splitPdf.previewTipTitle")}</h3>
                <p className="font-body text-xs text-slate-600 leading-relaxed">
                  {t("splitPdf.previewTipDesc")}
                </p>
              </div>

              {/* Sidebar Ad */}
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">Advertisement</p>
                <AdSenseUnit adSlot="1617102171" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
    </>
  )
}