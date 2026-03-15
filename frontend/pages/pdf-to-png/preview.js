import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { ArrowLeft, Sparkles, Shield, Zap, Clock, ImageIcon, Check, Download, AlertCircle } from "lucide-react"

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

export default function PreviewPDFtoPNG() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const [conversionResult, setConversionResult] = useState(null)
  const [pages, setPages] = useState([])
  const [selectedPages, setSelectedPages] = useState([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [mounted, setMounted] = useState(false)
  const [downloadError, setDownloadError] = useState("")

  // ✅ FIX: Use a ref for router inside useEffect to avoid infinite re-render loop.
  // useLocalizedRouter() returns a new object each render, so putting it in the
  // dependency array causes: effect runs → router changes → effect runs → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    setMounted(true)
    const storedResult = sessionStorage.getItem("pdfToPngResult")

    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult)
        setConversionResult(parsed)

        // Create page list from the conversion result
        const pageList = Array.from({ length: parsed.pageCount }, (_, i) => ({
          id: i + 1,
          url: parsed.files ? parsed.files[i] : null,
          selected: true,
        }))
        setPages(pageList)
        setSelectedPages(pageList.map((p) => p.id))
      } catch (err) {
        console.error("Error parsing conversion result:", err)
        routerRef.current.push("/pdf-to-png")
      }
    } else {
      routerRef.current.push("/pdf-to-png")
    }
  }, []) // ✅ Empty deps — runs once on mount only

  const togglePage = (pageId) => {
    setSelectedPages((prev) => (prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]))
  }

  const selectAll = () => setSelectedPages(pages.map((p) => p.id))
  const deselectAll = () => setSelectedPages([])

  const handleDownload = async () => {
    if (selectedPages.length === 0) return

    setProcessing(true)
    setProgress(0)
    setStage(t('pdfToPng.previewStagePreparing') || "Preparing images...")

    const stages = [
      { progress: 20, text: t('pdfToPng.previewStageSelecting') || "Selecting pages...", delay: 300 },
      { progress: 45, text: t('pdfToPng.previewStagePreparingPng') || "Preparing PNG files...", delay: 400 },
      { progress: 70, text: t('pdfToPng.previewStageCreatingArchive') || "Creating archive...", delay: 500 },
      { progress: 90, text: t('pdfToPng.previewStageFinalizing') || "Finalizing...", delay: 300 },
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
      // Store download info
      sessionStorage.setItem(
        "pdfToPngDownload",
        JSON.stringify({
          ...conversionResult,
          selectedPages: selectedPages,
          totalSelected: selectedPages.length,
        }),
      )

      setProgress(100)
      setStage(t('pdfToPng.previewStageComplete') || "Complete!")

      setTimeout(() => {
        router.push(`/pdf-to-png/download?jobId=${conversionResult.jobId}`)
      }, 500)
    } catch (error) {
      console.error("Error preparing download:", error)
      setDownloadError(t("pdfToPng.previewErrorRetry") || "Failed to prepare download. Please try again.")
      setProcessing(false)
    }
  }

  if (!conversionResult) {
    return (
      <Layout>
        <SEOHead title={t("pdfToPng.previewPageTitle") || "Preview PNG Images - PDF to PNG | SmallPDF.us"} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-blue-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pdfToPng.previewLoading')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* noIndex — transient post-upload preview page, no static indexable content */}
      <SEOHead
        title={t('pdfToPng.previewPageTitle') || "Preview PNG Images - PDF to PNG | SmallPDF.us"}
        noIndex={true}
      />
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
          .font-display {
            font-family: 'Plus Jakarta Sans', sans-serif;
          }
          .font-body {
            font-family: 'DM Sans', sans-serif;
          }
        `}</style>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 relative overflow-hidden">
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
              onClick={() => router.push("/pdf-to-png")}
              className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-xs font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>{t('pdfToPng.previewConvertAnother')}</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                  {`${conversionResult.pageCount} ${conversionResult.pageCount === 1 ? t('pdfToPng.previewImagesReadySingular') : t('pdfToPng.previewImagesReady')}`}
                </h1>
                <p className="font-body text-xs text-white/80">{conversionResult.originalName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header Ad */}
        <div className="bg-blue-50 px-4 pt-5">
          <div className="max-w-5xl mx-auto">
            <AdSenseUnit adSlot="8004544994" />
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-blue-50 min-h-screen py-6 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              {/* Main Card */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-base font-bold text-white mb-0.5">{t('pdfToPng.previewSelectImages')}</h2>
                      <p className="font-body text-xs text-white/80">
                        {`${selectedPages.length} ${t('pdfToPng.previewOf')} ${pages.length} ${t('pdfToPng.previewSelected')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAll}
                        className="text-xs font-medium text-blue-300 hover:text-white transition-colors"
                      >
                        {t('pdfToPng.previewSelectAll')}
                      </button>
                      <span className="text-white/40">|</span>
                      <button
                        onClick={deselectAll}
                        className="text-xs font-medium text-blue-300 hover:text-white transition-colors"
                      >
                        {t('pdfToPng.previewDeselectAll')}
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    {!processing ? (
                      <>
                        {/* Page Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-5">
                          {pages.map((page) => (
                            <div
                              key={page.id}
                              onClick={() => togglePage(page.id)}
                              className={`relative bg-blue-50 rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-lg group ${
                                selectedPages.includes(page.id)
                                  ? "border-blue-500 ring-2 ring-blue-100"
                                  : "border-slate-200 hover:border-blue-300"
                              }`}
                            >
                              {/* Preview */}
                              <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                                    <ImageIcon className="w-6 h-6 text-white" />
                                  </div>
                                  <span className="text-xs font-medium text-slate-500">PNG</span>
                                </div>
                              </div>

                              {/* Selection Indicator */}
                              <div
                                className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                  selectedPages.includes(page.id)
                                    ? "bg-blue-600 shadow-lg"
                                    : "bg-white border-2 border-slate-300"
                                }`}
                              >
                                {selectedPages.includes(page.id) && <Check className="w-4 h-4 text-white" />}
                              </div>

                              {/* Page Number */}
                              <div className="p-2 bg-white border-t border-slate-100 text-center">
                                <span className="text-sm font-semibold text-slate-700">
                                  {t('pdfToPng.previewPageLabel') ? `${t('pdfToPng.previewPageLabel')} ${page.id}` : `Page ${page.id}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Download Error */}
                        {downloadError && (
                          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-body text-sm text-red-700">{downloadError}</p>
                              <button
                                onClick={() => setDownloadError("")}
                                className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
                              >
                                {t('pdfToPng.dismiss') || "Dismiss"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Download Button */}
                        <button
                          onClick={handleDownload}
                          disabled={selectedPages.length === 0}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-4 h-4" />
                          <span>
                            {t('pdfToPng.previewDownloadButton') || `Download ${selectedPages.length} PNG Image${selectedPages.length !== 1 ? "s" : ""}`}
                          </span>
                        </button>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3 mt-5">
                          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="font-display text-lg font-bold text-slate-900">{pages.length}</div>
                            <div className="font-body text-xs text-slate-500">{t('pdfToPng.previewTotalPages')}</div>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="font-display text-lg font-bold text-blue-600">{selectedPages.length}</div>
                            <div className="font-body text-xs text-slate-500">{t('pdfToPng.previewSelected')}</div>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="font-display text-lg font-bold text-slate-900">150</div>
                            <div className="font-body text-xs text-slate-500">{t('pdfToPng.previewDpi')}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-6">
                        <div className="text-center mb-5">
                          <div className="relative w-14 h-14 mx-auto mb-4">
                            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-blue-600 border-r-blue-600 rounded-full animate-spin"></div>
                          </div>
                          <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                          <p className="font-body text-sm text-slate-600">{progress}% {t('pdfToPng.previewProgressComplete')}</p>
                        </div>

                        <div className="bg-blue-100 rounded-full h-2 overflow-hidden mb-4">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 ease-out rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="font-body text-xs text-blue-800 text-center">
                            {t('pdfToPng.previewPreparingDownload') || `Preparing ${selectedPages.length} PNG images for download...`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
                  <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('pdfToPng.previewWhatYouGet')}</h3>
                  <div className="space-y-2.5">
                    {[
                      { icon: Sparkles, text: t('pdfToPng.previewHighQuality'), color: "text-blue-600 bg-blue-100" },
                      { icon: Shield, text: t('pdfToPng.previewSecure'), color: "text-emerald-600 bg-emerald-100" },
                      { icon: Zap, text: t('pdfToPng.previewInstant'), color: "text-amber-600 bg-amber-100" },
                      { icon: Clock, text: t('pdfToPng.previewAutoDelete'), color: "text-slate-600 bg-slate-100" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color.split(" ")[1]}`}
                        >
                          <item.icon className={`w-3.5 h-3.5 ${item.color.split(" ")[0]}`} />
                        </div>
                        <span className="font-body text-xs text-slate-700">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
                  <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('pdfToPng.previewConversionProcess')}</h3>
                  <div className="space-y-2">
                    {[
                      { num: "1", text: t('pdfToPng.previewStep1'), color: "bg-blue-600" },
                      { num: "2", text: t('pdfToPng.previewStep2'), color: "bg-indigo-600" },
                      { num: "3", text: t('pdfToPng.previewStep3'), color: "bg-blue-700" },
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 ${step.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                        >
                          {step.num}
                        </div>
                        <span className="font-body text-xs text-slate-700">{step.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sidebar Ad */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-blue-200">
                  <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">Advertisement</p>
                  <AdSenseUnit adSlot="1617102171" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
  )
}