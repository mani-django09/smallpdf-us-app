import { useState, useEffect } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { FileText, ArrowLeft, Sparkles, Shield, Zap, Clock, Play, Trash2, CheckCircle, Presentation, Layers, Edit3, AlertCircle } from "lucide-react"

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

export default function PreviewPdfToPpt() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [convertError, setConvertError] = useState("")

  useEffect(() => {
    const storedFiles = sessionStorage.getItem("uploadedPdfFilesForPpt")

    if (storedFiles) {
      try {
        const parsed = JSON.parse(storedFiles)
        setFilesData(parsed)
        setSelectedFiles(parsed.map((f) => f.id))
      } catch (err) {
        console.error("Error parsing file data:", err)
        router.push("/pdf-to-ppt")
      }
    } else {
      router.push("/pdf-to-ppt")
    }
  }, [])

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]))
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))
    sessionStorage.setItem("uploadedPdfFilesForPpt", JSON.stringify(newFiles))

    if (newFiles.length === 0) {
      router.push("/pdf-to-ppt")
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    }
    return (bytes / 1024).toFixed(1) + " KB"
  }

  const handleConvert = async () => {
    const filesToConvert = filesData.filter((f) => selectedFiles.includes(f.id))
    if (filesToConvert.length === 0) return

    setConverting(true)
    setConvertError("")
    setProgress(0)
    setStage(t('pdfToPpt.stagePreparing'))

    const stages = [
      { progress: 15, text: t('pdfToPpt.stageAnalyzing'), delay: 500 },
      { progress: 30, text: t('pdfToPpt.stageExtracting'), delay: 600 },
      { progress: 50, text: t('pdfToPpt.stageCreating'), delay: 700 },
      { progress: 70, text: t('pdfToPpt.stageFormatting'), delay: 600 },
      { progress: 85, text: t('pdfToPpt.stageGenerating'), delay: 500 },
      { progress: 95, text: t('pdfToPpt.stageFinalizing'), delay: 300 },
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

      for (const fileData of filesToConvert) {
        try {
          const response = await fetch(fileData.data)
          const blob = await response.blob()
          const file = new File([blob], fileData.name, {
            type: fileData.type || 'application/pdf',
            lastModified: Date.now()
          })
          formData.append("files", file)
        } catch (fileError) {
          console.error(`Error processing file ${fileData.name}:`, fileError)
        }
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
      const convertResponse = await fetch(`${apiUrl}/api/pdf-to-ppt`, {
        method: "POST",
        body: formData,
      })

      const result = await convertResponse.json()

      setProgress(100)
      setStage(t('pdfToPpt.stageComplete'))

      if (convertResponse.ok) {
        sessionStorage.setItem(
          "pdfToPptConvertResult",
          JSON.stringify({
            ...result,
            fileCount: filesToConvert.length,
            totalSize: filesToConvert.reduce((acc, f) => acc + f.size, 0),
          }),
        )
        setTimeout(() => {
          router.push(`/pdf-to-ppt/download?jobId=${result.jobId}`)
        }, 500)
      } else {
        // Show error inline — no alert(), uses the t() system, doesn't block UI
        setConvertError(t('pdfToPpt.conversionFailed') || ("Conversion failed: " + (result.error || "Unknown error")))
        setConverting(false)
      }
    } catch (error) {
      console.error("Conversion error:", error)
      setConvertError(t('pdfToPpt.convertError') || ("Failed to convert files: " + error.message))
      setConverting(false)
    }
  }

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)
  const selectedCount = selectedFiles.length

  if (filesData.length === 0) {
    return (
      <Layout>
        <SEOHead title={t('pdfToPpt.previewTitle') || "Preview & Convert - PDF to PPT | SmallPDF.us"} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-red-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-red-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pdfToPpt.loadingFiles')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={t('pdfToPpt.previewTitle')}>
      {/* noIndex — transient post-upload page, no static content for search engines */}
      <SEOHead title={t('pdfToPpt.previewTitle') || "Preview & Convert - PDF to PPT | SmallPDF.us"} noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Manrope', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/pdf-to-ppt")}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-body text-sm hidden sm:inline">{t('pdfToPpt.backButton')}</span>
              </button>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{t('pdfToPpt.previewHeader')}</h1>
                <p className="font-body text-sm text-red-100">
                  {selectedCount} of {filesData.length} PDF{filesData.length > 1 ? "s" : ""} {t('pdfToPpt.selectedLabel')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full">
                <Shield className="w-4 h-4 text-yellow-300" />
                <span className="font-body text-xs text-white">{t('pdfToPpt.badgeSecure')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-red-50 px-4 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-red-50 min-h-screen py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Files List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">{t('pdfToPpt.pdfFilesHeading')}</h2>
                    <p className="font-body text-sm text-slate-500">
                      {t('pdfToPpt.totalSizeLabel')}: {formatFileSize(totalSize)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFiles(filesData.map((f) => f.id))}
                      className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      {t('pdfToPpt.selectAll')}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {t('pdfToPpt.deselectAll')}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {filesData.map((file, index) => (
                    <div
                      key={file.id}
                      className={`p-4 flex items-center gap-4 transition-colors ${
                        selectedFiles.includes(file.id) ? "bg-red-50/50" : "hover:bg-slate-50"
                      }`}
                    >
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                      </label>

                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center shadow-md">
                          <FileText className="w-7 h-7 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-600 rounded-md flex items-center justify-center">
                          <Presentation className="w-3 h-3 text-white" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-body font-medium text-slate-900 truncate">{file.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-body text-sm text-slate-500">{formatFileSize(file.size)}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white">
                            PDF
                          </span>
                          <span className="text-slate-300">→</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-600 text-white">
                            PPTX
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove file"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Convert Button */}
                <div className="p-6 bg-slate-50 border-t border-slate-100">
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
                          {t('pdfToPpt.dismiss') || "Dismiss"}
                        </button>
                      </div>
                    </div>
                  )}
                  {converting ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-body text-sm font-medium text-slate-700">{stage}</span>
                        <span className="font-display font-semibold text-red-600">{progress}%</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <p className="font-body text-xs text-slate-500 text-center">
                        {t('pdfToPpt.convertingWait')}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleConvert}
                      disabled={selectedCount === 0}
                      className={`w-full py-4 rounded-xl font-display font-semibold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                        selectedCount > 0
                          ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:from-red-600 hover:to-orange-600"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <Play className="w-5 h-5" />
                      <span>
                        {t('pdfToPpt.convertButton')} {selectedCount} PDF{selectedCount !== 1 ? "s" : ""}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Conversion Info */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">{t('pdfToPpt.conversionDetailsHeading')}</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="font-body text-sm text-slate-600">{t('pdfToPpt.inputFormatLabel')}</span>
                    <span className="font-display font-semibold text-red-600">PDF</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="font-body text-sm text-slate-600">{t('pdfToPpt.outputFormatLabel')}</span>
                    <span className="font-display font-semibold text-orange-600">PPTX</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="font-body text-sm text-slate-600">{t('pdfToPpt.filesSelectedLabel')}</span>
                    <span className="font-display font-semibold text-slate-900">{selectedCount}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="font-body text-sm text-slate-600">{t('pdfToPpt.totalSizeLabel')}</span>
                    <span className="font-display font-semibold text-slate-900">{formatFileSize(totalSize)}</span>
                  </div>
                </div>
              </div>

              {/* What You Get */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">{t('pdfToPpt.whatYouGet')}</h3>
                
                <div className="space-y-3">
                  {[
                    { icon: Layers, text: t('pdfToPpt.getFeature1'), color: "text-red-600" },
                    { icon: Edit3, text: t('pdfToPpt.getFeature2'), color: "text-orange-600" },
                    { icon: Sparkles, text: t('pdfToPpt.getFeature3'), color: "text-purple-600" },
                    { icon: Zap, text: t('pdfToPpt.getFeature4'), color: "text-amber-500" },
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <feature.icon className={`w-5 h-5 ${feature.color}`} />
                      <span className="font-body text-sm text-slate-700">{feature.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security */}
              <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-8 h-8 text-yellow-300" />
                  <h3 className="font-display text-lg font-semibold">{t('pdfToPpt.dataSafeHeading')}</h3>
                </div>
                <ul className="space-y-2">
                  {[
                    t('pdfToPpt.security1'),
                    t('pdfToPpt.security2'),
                    t('pdfToPpt.security3'),
                    t('pdfToPpt.security4'),
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 font-body text-sm text-red-100">
                      <CheckCircle className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sidebar Ad */}
              <div className="bg-white rounded-2xl shadow-lg p-3">
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