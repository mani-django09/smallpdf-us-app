import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { Presentation, ArrowLeft, Shield, Play, Trash2, CheckCircle, FileText } from "lucide-react"
import AdSenseUnit from "../../components/AdSenseUnit"
import LoadingPromo from "../../components/LoadingPromo"
import useDailyLimit from '../../hooks/useDailyLimit'
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { pptToPdfStore } from "./index"
import AdLabel from "../../components/AdLabel"
import { goToDownload } from "../../lib/fullPageNav"

export default function PreviewPptToPdf() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [convertError, setConvertError] = useState("")
  const { handleApiError, PremiumGateModal } = useFileSizeGuard("ppt-to-pdf")

  // FIX: Use a ref for router inside useEffect to avoid infinite re-render loop.
  // useLocalizedRouter() returns a new object each render, so putting it in the
  // dependency array causes: effect runs → router changes → effect runs → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    // Files come from memory (pptToPdfStore); after a reload they're gone, so
    // go back to the upload page instead of showing an unconvertible list.
    if (pptToPdfStore.files.length > 0) {
      setFilesData(pptToPdfStore.files)
      setSelectedFiles(pptToPdfStore.files.map((f) => f.id))
    } else {
      routerRef.current.push("/ppt-to-pdf")
    }
  }, []) // Empty deps — runs once on mount only

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]))
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))
    pptToPdfStore.files = newFiles

    if (newFiles.length === 0) {
      routerRef.current.push("/ppt-to-pdf")
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    }
    return (bytes / 1024).toFixed(1) + " KB"
  }

  const getFileExtension = (filename) => {
    return filename.split('.').pop().toUpperCase()
  }

  const getExtensionColor = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    switch (ext) {
      case 'pptx':
        return 'bg-orange-600'
      case 'ppt':
        return 'bg-orange-700'
      case 'odp':
        return 'bg-blue-600'
      default:
        return 'bg-slate-600'
    }
  }

  const getMimeType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    switch (ext) {
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      case 'ppt':
        return 'application/vnd.ms-powerpoint'
      case 'odp':
        return 'application/vnd.oasis.opendocument.presentation'
      default:
        return 'application/octet-stream'
    }
  }

  const handleConvert = async () => {
    const filesToConvert = filesData.filter((f) => selectedFiles.includes(f.id))
    if (filesToConvert.length === 0) return

    setConverting(true)
    setConvertError("")
    setProgress(0)
    setStage(t('pptToPdf.stagePreparing'))

    const stages = [
      { progress: 15, text: t('pptToPdf.stageReading'),    delay: 400 },
      { progress: 30, text: t('pptToPdf.stageUploading'),  delay: 500 },
      { progress: 50, text: t('pptToPdf.stageProcessing'), delay: 700 },
      { progress: 70, text: t('pptToPdf.stageRendering'),  delay: 600 },
      { progress: 85, text: t('pptToPdf.stageGenerating'), delay: 500 },
      { progress: 95, text: t('pptToPdf.stageFinalizing'), delay: 300 },
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

      // FIX: getApiUrl defined inside try block, where it belongs
      function getApiUrl() {
        if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
        const { hostname, protocol } = window.location
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
        }
        return `${protocol}//${hostname}`
      }

      const convertResponse = await fetch(`${getApiUrl()}/api/ppt-to-pdf`, {
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
        setStage(t('pptToPdf.stageComplete'))
        sessionStorage.setItem(
          "pptConvertResult",
          JSON.stringify({
            ...result,
            fileCount: filesToConvert.length,
            totalSize: filesToConvert.reduce((acc, f) => acc + f.size, 0),
          }),
        )
        setTimeout(() => {
          goToDownload(routerRef.current, `/ppt-to-pdf/download?jobId=${result.jobId}`)
        }, 500)
      } else {
        // Inline (these were English alert() pop-ups).
        stopped = true
        setConvertError(result.message || ("Conversion failed: " + (result.error || convertResponse.status)))
        setConverting(false); setProgress(0); setStage("")
      }
    } catch (error) {
      console.error("Error:", error)
      stopped = true
      setConvertError("Failed to convert files: " + error.message)
      setConverting(false); setProgress(0); setStage("")
    }
  }

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)
  const selectedCount = selectedFiles.length

  if (filesData.length === 0) {
    return (
      <Layout>
        <SEOHead noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-orange-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-orange-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-orange-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pptToPdf.loadingFiles')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <SEOHead noIndex={true} />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/ppt-to-pdf")}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-body text-sm hidden sm:inline">{t('pptToPdf.backButton')}</span>
              </button>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{t('pptToPdf.previewHeader')}</h1>
                <p className="font-body text-sm text-orange-100">
                  {selectedCount} of {filesData.length} {t('pptToPdf.presentationSelected')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full">
                <Shield className="w-4 h-4 text-yellow-300" />
                <span className="font-body text-xs text-white">{t('pptToPdf.badgeSecureConversion')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-orange-50 px-4 pt-6">
        <div className="max-w-7xl mx-auto">
          <AdSenseUnit adSlot="8004544994" size="leaderboard" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-orange-50 min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Files List - Main Content */}
            <div className="lg:col-span-8 xl:col-span-7">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">{t('pptToPdf.filesHeading')}</h2>
                    <p className="font-body text-sm text-slate-500">
                      {t('pptToPdf.reviewText')} • {t('pptToPdf.totalSizeLabel')}: {formatFileSize(totalSize)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFiles(filesData.map((f) => f.id))}
                      className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      {t('pptToPdf.selectAll')}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {t('pptToPdf.deselectAll')}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {filesData.map((file, index) => (
                    <div
                      key={file.id}
                      className={`p-4 flex items-center gap-4 transition-colors ${
                        selectedFiles.includes(file.id) ? "bg-orange-50/50" : "hover:bg-slate-50"
                      }`}
                    >
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                        />
                      </label>

                      <div className="relative flex-shrink-0">
                        <div className={`w-14 h-14 ${getExtensionColor(file.name)} rounded-xl flex items-center justify-center shadow-md`}>
                          <Presentation className="w-7 h-7 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-600 rounded-md flex items-center justify-center">
                          <FileText className="w-3 h-3 text-white" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-body font-medium text-slate-900 truncate">{file.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-body text-sm text-slate-500">{formatFileSize(file.size)}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getExtensionColor(file.name)} text-white`}>
                            {getFileExtension(file.name)}
                          </span>
                          <span className="text-slate-300">→</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white">
                            PDF
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
                  {converting ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-body text-sm font-medium text-slate-700">{stage}</span>
                        <span className="font-display font-semibold text-orange-600">{progress}%</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-red-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <p className="font-body text-xs text-slate-500 text-center">
                        {t('pptToPdf.convertingWait')}
                      </p>
                      <div className="flex justify-center">
                        <LoadingPromo />
                      </div>
                    </div>
                  ) : (
                    <>
                    {convertError && (
                      <div role="alert" className="mb-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">
                        {convertError}
                      </div>
                    )}
                    <button
                      onClick={handleConvert}
                      disabled={selectedCount === 0}
                      className={`w-full py-4 rounded-xl font-display font-semibold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                        selectedCount > 0
                          ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-red-700"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <Play className="w-5 h-5" />
                      <span>
                        {t('pptToPdf.convertButton')} {selectedCount} {t('pptToPdf.presentationUnit')}
                      </span>
                    </button>
                    </>
                  )}
                </div>
              </div>

              {/* Educational Content Section */}
              <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
                <h3 className="font-display text-xl font-bold text-slate-900 mb-4">{t('pptToPdf.eduTitle')}</h3>
                <div className="prose prose-slate max-w-none">
                  <p className="font-body text-slate-600 mb-4">
                    {t('pptToPdf.eduPara1')}
                  </p>
                  <h4 className="font-display text-lg font-semibold text-slate-900 mt-6 mb-3">{t('pptToPdf.eduWhyTitle')}</h4>
                  <ul className="space-y-2 font-body text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>{t('pptToPdf.eduReason1Title')}</strong> {t('pptToPdf.eduReason1Desc')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>{t('pptToPdf.eduReason2Title')}</strong> {t('pptToPdf.eduReason2Desc')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>{t('pptToPdf.eduReason3Title')}</strong> {t('pptToPdf.eduReason3Desc')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>{t('pptToPdf.eduReason4Title')}</strong> {t('pptToPdf.eduReason4Desc')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-4 xl:col-span-3 space-y-6">
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
    props: { messages: getPageMessages(locale, ["pptToPdf"]) },
    revalidate: 86400,
  }
}
