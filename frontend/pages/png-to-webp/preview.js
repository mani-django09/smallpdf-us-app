import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { FileImage, ArrowLeft, Play, Trash2, CheckCircle } from "lucide-react"
import ThumbEditControls from "../../components/ThumbEditControls"
import { bakeImageTransform, filterCssById, hasTransform } from "../../lib/imageEdit"
import AdSenseUnit from "../../components/AdSenseUnit"
import PromoBanner from "../../components/PromoBanner"
import LoadingPromo from "../../components/LoadingPromo"
import useDailyLimit from '../../hooks/useDailyLimit'
import { pngToWebpStore } from "./index"
import { goToDownload } from "../../lib/fullPageNav"

export default function PreviewPngToWebp() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t, locale } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [transforms, setTransforms] = useState({})
  const getTransform = (id) => transforms[id] || { rotation: 0, filterId: "none" }
  const rotateFile = (id, d) => setTransforms(p => { const c = p[id] || { rotation: 0, filterId: "none" }; return { ...p, [id]: { ...c, rotation: c.rotation + d } } })
  const setFileFilter = (id, fid) => setTransforms(p => { const c = p[id] || { rotation: 0, filterId: "none" }; return { ...p, [id]: { ...c, filterId: fid } } })

  // ✅ FIX: Use a ref for router inside useEffect to avoid infinite re-render loop.
  // useLocalizedRouter() returns a new object each render, so putting it in the
  // dependency array causes: effect runs → router changes → effect runs → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    // Files come from memory; after a reload they're gone → back to upload.
    if (pngToWebpStore.files.length > 0) {
      setFilesData(pngToWebpStore.files)
      setSelectedFiles(pngToWebpStore.files.map((f) => f.id))
    } else {
      routerRef.current.push("/png-to-webp")
    }
  }, []) // ✅ Empty deps — runs once on mount only

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]))
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))
    pngToWebpStore.files = newFiles

    if (newFiles.length === 0) {
      router.push("/png-to-webp")
    }
  }

  const handleConvert = async () => {
    const filesToConvert = filesData.filter((f) => selectedFiles.includes(f.id))
    if (filesToConvert.length === 0) return

    setConverting(true)
    setProgress(0)
    setStage(t('pngToWebp.preparingImages'))

    const stages = [
      { progress: 15, text: t('pngToWebp.uploadingImages'), delay: 400 },
      { progress: 35, text: t('pngToWebp.analyzingPng'), delay: 500 },
      { progress: 55, text: t('pngToWebp.applyingWebpCompression'), delay: 600 },
      { progress: 75, text: t('pngToWebp.optimizingOutput'), delay: 400 },
      { progress: 90, text: t('pngToWebp.finalizing'), delay: 300 },
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

    function getApiUrl() {
      if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      const { hostname, protocol } = window.location
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      }
      return `${protocol}//${hostname}`
    }

    try {
      const formData = new FormData()

      for (const fileData of filesToConvert) {
        const { rotation, filterId } = getTransform(fileData.id)
        if (hasTransform(rotation, filterId)) {
          const { file } = await bakeImageTransform({ src: fileData.data, fileName: fileData.name, rotation, filterId, mimeType: fileData.type || "image/png" })
          formData.append("files", file)
        } else {
          const response = await fetch(fileData.data)
          const blob = await response.blob()
          const file = new File([blob], fileData.name, { type: fileData.type || "image/png" })
          formData.append("files", file)
        }
      }

      const API_URL = getApiUrl()
      const convertResponse = await fetch(`${API_URL}/api/png-to-webp`, {
        method: "POST",
        body: formData,
      })

      const result = await convertResponse.json()
      if (handleDailyLimitError(convertResponse.status, result)) return  // daily-limit upgrade modal

      setProgress(100)
      setStage(t('pngToWebp.complete'))

      if (convertResponse.ok) {
        if (result.skipped?.length) alert(t("toolErrors.skippedFiles", { names: result.skipped.join(", ") }))
        sessionStorage.setItem(
          "pngConvertResult",
          JSON.stringify({
            ...result,
            // what the server actually produced (unreadable files are skipped)
            fileCount: result.fileCount || filesToConvert.length,
            totalSize: filesToConvert.reduce((acc, f) => acc + f.size, 0),
          }),
        )
        setTimeout(() => {
          goToDownload(router, `/png-to-webp/download?jobId=${result.jobId}`)
        }, 500)
      } else {
        // Localized, specific reasons (was a generic "Conversion failed").
        alert(result.error === "UNREADABLE_IMAGES"
          ? t("toolErrors.unreadableImages", { names: (result.files || []).join(", ") })
          : result.error === "FILE_TOO_LARGE"
            ? t("toolErrors.fileTooLarge", { name: filesToConvert.find((f) => f.size > 100 * 1024 * 1024)?.name || "" })
            : (t('pngToWebp.errorConversionFailed') || "Conversion failed: " + result.error))
        setConverting(false)
      }
    } catch (error) {
      console.error("Error:", error)
      alert(t('pngToWebp.errorRetry') || "Failed to convert files. Please try again.")
      setConverting(false)
    }
  }

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)
  const selectedCount = selectedFiles.length

  if (filesData.length === 0) {
    return (
      <Layout>
        <SEOHead noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pngToWebp.loading')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={t('pngToWebp.previewTitle')} description={t('pngToWebp.previewDescription')}>
      <SEOHead noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="relative overflow-hidden bg-slate-50 border-b border-slate-200">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, #94a3b8 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-5">
          <button
            onClick={() => router.push("/png-to-webp")}
            className="mb-3 flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors text-xs font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t('pngToWebp.changeFiles')}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
              <FileImage className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                {t('pngToWebp.readyToConvert')} {filesData.length} {t(filesData.length > 1 ? 'pngToWebp.imagesText' : 'pngToWebp.imageText')}
              </h1>
              <p className="font-body text-xs text-slate-600">{t('pngToWebp.reviewAndConvert')}</p>
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
                {/* Header */}
                <div className="bg-slate-800 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <FileImage className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-semibold text-white">
                          {selectedCount} of {filesData.length} {t('pngToWebp.selected')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Total: {(totalSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                      <span className="text-xs font-medium text-emerald-300">{t('pngToWebp.ready')}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {!converting ? (
                    <>
                      {/* Image Grid */}
                      <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-display text-sm font-semibold text-slate-900">{t('pngToWebp.yourPngImages')}</h3>
                          <button
                            onClick={() =>
                              setSelectedFiles(
                                selectedFiles.length === filesData.length ? [] : filesData.map((f) => f.id),
                              )
                            }
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            {selectedFiles.length === filesData.length ? t('pngToWebp.deselectAll') : t('pngToWebp.selectAll')}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                          {filesData.map((f) => (
                            <div
                              key={f.id}
                              onClick={() => toggleFileSelection(f.id)}
                              className={`relative group cursor-pointer rounded-lg border-2 transition-all ${
                                selectedFiles.includes(f.id)
                                  ? "border-emerald-500 bg-emerald-50"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
                              }`}
                            >
                              <div className="p-2">
                                <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden mb-2 relative">
                                  <img
                                    src={f.data || "/placeholder.svg"}
                                    alt={f.name}
                                    className="w-full h-full object-cover transition-transform"
                                    style={{ transform: `rotate(${getTransform(f.id).rotation}deg)`, filter: filterCssById(getTransform(f.id).filterId) }}
                                  />
                                  {selectedFiles.includes(f.id) && (
                                    <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center">
                                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  )}
                                  <ThumbEditControls
                                    rotation={getTransform(f.id).rotation} filterId={getTransform(f.id).filterId}
                                    onRotate={(d) => rotateFile(f.id, d)} onFilter={(fid) => setFileFilter(f.id, fid)}
                                    className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  />
                                </div>
                                <p className="text-xs font-medium text-slate-900 truncate">{f.name}</p>
                                <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeFile(f.id)
                                }}
                                className="absolute top-1 left-1 p-1 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Convert Button */}
                      <button
                        onClick={handleConvert}
                        disabled={selectedCount === 0}
                        className="w-full bg-emerald-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:bg-emerald-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4" />
                        <span>
                          {t('pngToWebp.convertImagesTo')} {selectedCount} {t(selectedCount !== 1 ? 'pngToWebp.imagesToWebp' : 'pngToWebp.imageToWebp')}
                        </span>
                      </button>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">{selectedCount}</div>
                          <div className="font-body text-xs text-slate-500">{t('pngToWebp.selected')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-emerald-600">~35%</div>
                          <div className="font-body text-xs text-slate-500">{t('pngToWebp.smaller')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">100%</div>
                          <div className="font-body text-xs text-slate-500">{t('pngToWebp.quality')}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <div className="text-center mb-5">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-emerald-600 border-r-emerald-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                        <p className="font-body text-sm text-slate-600">{progress}% {t('pngToWebp.complete')}</p>
                      </div>

                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                        <div
                          className="bg-emerald-600 h-full transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="font-body text-xs text-emerald-800 text-center">
                          {t('pngToWebp.convertingImages')} {selectedCount} {t(selectedCount !== 1 ? 'pngToWebp.pngImagesTo' : 'pngToWebp.pngImageTo')}
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
                <PromoBanner slot={0} />
              </div>

              {/* Sidebar Ad 2 */}
              <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <PromoBanner slot={1} />
              </div>

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
    props: { messages: getPageMessages(locale, ["pngToWebp"]) },
    revalidate: 86400,
  }
}
