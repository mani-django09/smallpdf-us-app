import { useState, useEffect } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { FileText, ArrowLeft, Shield, Play, Trash2, Presentation, AlertCircle } from "lucide-react"
import AdSenseUnit from "../../components/AdSenseUnit"
import LoadingPromo from "../../components/LoadingPromo"
import useDailyLimit from '../../hooks/useDailyLimit'
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { pdfToPptStore } from "./index"
import AdLabel from "../../components/AdLabel"
import { goToDownload } from "../../lib/fullPageNav"

export default function PreviewPdfToPpt() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [convertError, setConvertError] = useState("")
  const { handleApiError, PremiumGateModal } = useFileSizeGuard("pdf-to-ppt")

  useEffect(() => {
    // Files come from memory (pdfToPptStore); after a reload they're gone, so
    // go back to the upload page instead of showing an unconvertible list.
    if (pdfToPptStore.files.length > 0) {
      setFilesData(pdfToPptStore.files)
      setSelectedFiles(pdfToPptStore.files.map((f) => f.id))
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
    pdfToPptStore.files = newFiles

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
    let stopped = false
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
      const formData = new FormData()

      for (const fileData of filesToConvert) {
        formData.append("files", fileData.file, fileData.name)
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
      const convertResponse = await fetch(`${apiUrl}/api/pdf-to-ppt`, {
        method: "POST",
        body: formData,
      })

      // A proxy error page (413/502) is HTML, not JSON.
      const result = await convertResponse.json().catch(() => ({}))
      // Limit modals take over — put the page back so the user can continue.
      if (handleDailyLimitError(convertResponse.status, result) || handleApiError(convertResponse, result)) {
        stopped = true; setConverting(false); setProgress(0); setStage(""); return
      }

      if (convertResponse.ok) {
        stopped = true
        setProgress(100)
        setStage(t('pdfToPpt.stageComplete'))
        sessionStorage.setItem(
          "pdfToPptConvertResult",
          JSON.stringify({
            ...result,
            fileCount: filesToConvert.length,
            totalSize: filesToConvert.reduce((acc, f) => acc + f.size, 0),
          }),
        )
        setTimeout(() => {
          goToDownload(router, `/pdf-to-ppt/download?jobId=${result.jobId}`)
        }, 500)
      } else {
        // Show error inline — no alert(), uses the t() system, doesn't block UI
        stopped = true
        // The server's message says WHY (e.g. password-protected PDF).
        setConvertError(result.message || t('pdfToPpt.conversionFailed'))
        setConverting(false); setProgress(0); setStage("")
      }
    } catch (error) {
      console.error("Conversion error:", error)
      stopped = true
      setConvertError(t('pdfToPpt.convertError') || ("Failed to convert files: " + error.message))
      setConverting(false); setProgress(0); setStage("")
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
          <AdSenseUnit adSlot="8004544994" size="leaderboard" />
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
                      <div className="flex justify-center">
                        <LoadingPromo />
                      </div>
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
              {/* Sidebar Ad */}
              <div className="hidden lg:block bg-white rounded-2xl shadow-lg p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide"><AdLabel /></p>
                <AdSenseUnit adSlot="1617102171" />
              </div>

              {/* Sidebar Ad 2 */}
              <div className="hidden lg:block bg-white rounded-2xl shadow-lg p-3">
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
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["pdfToPpt"]) },
    revalidate: 86400,
  }
}
