import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { FileText, ArrowLeft, Sparkles, Shield, Zap, Clock, Play, Trash2, AlertCircle } from "lucide-react"

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

export default function PreviewPngToPdf() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [settings, setSettings] = useState({ pageSize: "a4", orientation: "auto" })
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [convertError, setConvertError] = useState("")

  // ✅ FIX: Use a ref for router inside useEffect to avoid infinite re-render loop.
  // useLocalizedRouter() returns a new object each render, so putting it in the
  // dependency array causes: effect runs → router changes → effect runs → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    const storedFiles = sessionStorage.getItem("uploadedPngFiles")
    const storedSettings = sessionStorage.getItem("pdfSettings")

    if (storedFiles) {
      try {
        setFilesData(JSON.parse(storedFiles))
        if (storedSettings) setSettings(JSON.parse(storedSettings))
      } catch (err) {
        console.error("Error parsing data:", err)
        routerRef.current.push("/png-to-pdf")
      }
    } else {
      routerRef.current.push("/png-to-pdf")
    }
  }, []) // ✅ Empty deps — runs once on mount only

  const handleReorder = (fromIndex, toIndex) => {
    const newFiles = [...filesData]
    const [removed] = newFiles.splice(fromIndex, 1)
    newFiles.splice(toIndex, 0, removed)
    setFilesData(newFiles)
    sessionStorage.setItem("uploadedPngFiles", JSON.stringify(newFiles))
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    handleReorder(draggedIndex, index)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    sessionStorage.setItem("uploadedPngFiles", JSON.stringify(newFiles))

    if (newFiles.length === 0) {
      router.push("/png-to-pdf")
    }
  }

  function getApiUrl() {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
    const { hostname, protocol } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
    }
    return `${protocol}//${hostname}`
  }

  const handleConvert = async () => {
    if (filesData.length === 0) return

    setConverting(true)
    setProgress(0)
    setStage(t('pngToPdf.previewPreparing') || "Preparing images...")

    const stages = [
      { progress: 15, text: t('pngToPdf.previewUploading') || "Uploading images...", delay: 400 },
      { progress: 35, text: t('pngToPdf.previewProcessing') || "Processing files...", delay: 500 },
      { progress: 55, text: t('pngToPdf.previewCreating') || "Creating PDF pages...", delay: 600 },
      { progress: 75, text: t('pngToPdf.previewOptimizing') || "Optimizing document...", delay: 400 },
      { progress: 90, text: t('pngToPdf.previewFinalizing') || "Finalizing PDF...", delay: 300 },
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
      const formData = new FormData()

      for (const fileData of filesData) {
        const response = await fetch(fileData.data)
        const blob = await response.blob()
        const file = new File([blob], fileData.name, { type: fileData.type })
        formData.append("files", file)
      }

      formData.append("pageSize", settings.pageSize)
      formData.append("orientation", settings.orientation)

      const API_URL = getApiUrl()

      const convertResponse = await fetch(`${API_URL}/api/png-to-pdf`, {
        method: "POST",
        body: formData,
      })

      const result = await convertResponse.json()

      setProgress(100)
      setStage(t('pngToPdf.previewComplete') || "Complete!")

      if (convertResponse.ok) {
        // Make downloadUrl absolute — works in dev (port 5011) and prod (same origin)
        const absoluteDownloadUrl = result.downloadUrl.startsWith('http')
          ? result.downloadUrl
          : `${API_URL}${result.downloadUrl}`

        sessionStorage.setItem(
          "pngToPdfResult",
          JSON.stringify({
            ...result,
            downloadUrl: absoluteDownloadUrl,
            fileCount: filesData.length,
            totalSize: filesData.reduce((acc, f) => acc + f.size, 0),
          }),
        )
        setTimeout(() => {
          router.push(`/png-to-pdf/download?file=${encodeURIComponent(absoluteDownloadUrl)}`)
        }, 500)
      } else {
        // Show inline — no alert(), uses t(), doesn't block the UI
        setConvertError((t('pngToPdf.previewConversionFailed') || "Conversion failed: ") + result.error)
        setConverting(false)
      }
    } catch (error) {
      console.error("Conversion error:", error)
      setConvertError(t('pngToPdf.previewErrorRetry') || "Failed to convert files. Please try again.")
      setConverting(false)
    }
  }

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)

  if (filesData.length === 0) {
    return (
      <Layout>
        <SEOHead title={t('pngToPdf.previewPageTitle') || "Preview & Convert - Images to PDF | SmallPDF.us"} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-slate-700 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pngToPdf.previewLoading')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Preview & Convert - Images to PDF" description="Review your images and create PDF">
      {/* noIndex — transient post-upload page, no static content for search engines */}
      <SEOHead title={t('pngToPdf.previewPageTitle') || "Preview & Convert - Images to PDF | SmallPDF.us"} noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Back Header */}
      <div className="bg-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push("/png-to-pdf")}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('pngToPdf.previewBack')}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden bg-slate-800">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                  {t('pngToPdf.previewTitle') || `Ready to Create PDF from ${filesData.length} Image${filesData.length > 1 ? "s" : ""}`}
                </h1>
                <p className="font-body text-slate-300 text-sm mt-0.5">{t('pngToPdf.previewSubtitle')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 sm:px-6 lg:px-8 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Main */}
            <div className="lg:col-span-8 space-y-6">
              {/* File Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-display font-semibold text-slate-900 text-sm">
                      {filesData.length} {t('pngToPdf.previewImagesSelected')}
                    </span>
                    <span className="text-slate-500 text-xs font-body">
                      Total: {(totalSize / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-body">{t('pngToPdf.previewDragReorder')}</span>
                </div>

                <div className="p-4">
                  {!converting ? (
                    <>
                      {/* Image Grid */}
                      <div className="mb-5">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                          {filesData.map((f, index) => (
                            <div
                              key={f.id}
                              className="relative group cursor-grab active:cursor-grabbing"
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden">
                                <img
                                  src={f.data || "/placeholder.svg"}
                                  alt={f.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute top-1 left-1 w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {index + 1}
                              </div>
                              <button
                                onClick={() => removeFile(f.id)}
                                className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Settings */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-5">
                        <h4 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('pngToPdf.previewSettingsTitle')}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="font-body text-xs text-slate-600 mb-1.5 block">{t('pngToPdf.previewPageSize')}</label>
                            <select
                              value={settings.pageSize}
                              onChange={(e) => setSettings((s) => ({ ...s, pageSize: e.target.value }))}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
                            >
                              <option value="a4">{t('pngToPdf.previewPageSizeA4')}</option>
                              <option value="letter">{t('pngToPdf.previewPageSizeLetter')}</option>
                              <option value="legal">{t('pngToPdf.previewPageSizeLegal')}</option>
                              <option value="fit">{t('pngToPdf.previewPageSizeFit')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="font-body text-xs text-slate-600 mb-1.5 block">{t('pngToPdf.previewOrientation')}</label>
                            <select
                              value={settings.orientation}
                              onChange={(e) => setSettings((s) => ({ ...s, orientation: e.target.value }))}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
                            >
                              <option value="auto">{t('pngToPdf.previewOrientationAuto')}</option>
                              <option value="portrait">{t('pngToPdf.previewOrientationPortrait')}</option>
                              <option value="landscape">{t('pngToPdf.previewOrientationLandscape')}</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Inline conversion error — replaces alert() */}
                      {convertError && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-body text-sm text-red-700">{convertError}</p>
                            <button
                              onClick={() => setConvertError("")}
                              className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
                            >
                              {t('pngToPdf.dismiss') || "Dismiss"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Convert Button */}
                      <button
                        onClick={handleConvert}
                        className="w-full bg-slate-800 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:bg-slate-900 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        <span>
                          {t('pngToPdf.previewCreateButton') || `Create PDF from ${filesData.length} Image${filesData.length > 1 ? "s" : ""}`}
                        </span>
                      </button>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">{filesData.length}</div>
                          <div className="font-body text-xs text-slate-500">{t('pngToPdf.previewPages')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-700">&lt;5s</div>
                          <div className="font-body text-xs text-slate-500">{t('pngToPdf.previewEstTime')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">100%</div>
                          <div className="font-body text-xs text-slate-500">{t('pngToPdf.previewQuality')}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <div className="text-center mb-5">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-slate-700 border-r-slate-700 rounded-full animate-spin"></div>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                        <p className="font-body text-sm text-slate-600">{progress}% {t('pngToPdf.previewProgressComplete')}</p>
                      </div>

                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                        <div
                          className="bg-slate-700 h-full transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
                        <p className="font-body text-xs text-slate-700 text-center">
                          {t('pngToPdf.previewCreatingFrom') || `Creating PDF from ${filesData.length} image${filesData.length > 1 ? "s" : ""}...`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('pngToPdf.previewWhatYouGet')}</h3>
                <div className="space-y-2.5">
                  {[
                    { icon: Sparkles, text: t('pngToPdf.previewHighQuality'), color: "text-slate-700 bg-slate-100" },
                    { icon: Shield, text: t('pngToPdf.previewSecure'), color: "text-slate-600 bg-slate-100" },
                    { icon: Zap, text: t('pngToPdf.previewFast'), color: "text-amber-600 bg-amber-100" },
                    { icon: Clock, text: t('pngToPdf.previewAutoDelete'), color: "text-slate-600 bg-slate-100" },
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

              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('pngToPdf.previewStepsTitle')}</h3>
                <div className="space-y-2">
                  {[
                    { num: "1", text: t('pngToPdf.previewStep1'), color: "bg-slate-600" },
                    { num: "2", text: t('pngToPdf.previewStep2'), color: "bg-slate-700" },
                    { num: "3", text: t('pngToPdf.previewStep3'), color: "bg-slate-800" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 ${step.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {step.num}
                      </div>
                      <span className="font-body text-xs text-slate-700">{step.text}</span>
                    </div>
                  ))}
                </div>
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
  )
}