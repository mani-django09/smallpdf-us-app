import { useState, useEffect } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { FileText, ArrowLeft, Sparkles, Shield, Zap, Clock, Play, Trash2, CheckCircle } from "lucide-react"
import AdSenseUnit from "../../components/AdSenseUnit"
import PromoBanner from "../../components/PromoBanner"
import LoadingPromo from "../../components/LoadingPromo"
import ThumbEditControls from "../../components/ThumbEditControls"
import { bakeImageTransform, filterCssById, hasTransform } from "../../lib/imageEdit"

import { jpgFileStore } from "./index"
import useDailyLimit from '../../hooks/useDailyLimit'
import { goToDownload } from "../../lib/fullPageNav"

export default function PreviewJpgToPdf() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t, locale } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  // Per-image edits (rotation degrees + filter id), keyed by file id.
  const [transforms, setTransforms] = useState({})

  const getTransform = (id) => transforms[id] || { rotation: 0, filterId: "none" }

  const rotateFile = (id, delta) => {
    setTransforms((prev) => {
      const cur = prev[id] || { rotation: 0, filterId: "none" }
      return { ...prev, [id]: { ...cur, rotation: cur.rotation + delta } }
    })
  }

  const setFileFilter = (id, filterId) => {
    setTransforms((prev) => {
      const cur = prev[id] || { rotation: 0, filterId: "none" }
      return { ...prev, [id]: { ...cur, filterId } }
    })
  }

  useEffect(() => {
    const storedFiles = jpgFileStore.get()

    if (storedFiles && storedFiles.length > 0) {
      try {
        // Build display data using object URLs (no base64 — no quota issues)
        const parsed = storedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.file.type,
          data: URL.createObjectURL(f.file), // fast, no memory bloat
          file: f.file,                       // keep raw File for upload
        }))
        setFilesData(parsed)
        setSelectedFiles(parsed.map((f) => f.id))
      } catch (err) {
        console.error("Error reading file data:", err)
        router.push("/jpg-to-pdf")
      }
    } else {
      router.push("/jpg-to-pdf")
    }
  }, [])

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]))
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))

    // Update the in-memory store to keep it in sync
    const stored = jpgFileStore.get() || []
    jpgFileStore.set(jpgFileStore.get().filter((f) => f.id !== id))

    if (newFiles.length === 0) {
      router.push("/jpg-to-pdf")
    }
  }

  const handleConvert = async () => {
    const filesToConvert = filesData.filter((f) => selectedFiles.includes(f.id))
    if (filesToConvert.length === 0) return

    setConverting(true)
    setProgress(0)
    setStage(t('jpgToPdf.preview.stages.preparing'))

    const stages = [
      { progress: 15, text: t('jpgToPdf.preview.stages.convertingJpeg'), delay: 400 },
      { progress: 35, text: t('jpgToPdf.preview.stages.uploading'), delay: 500 },
      { progress: 55, text: t('jpgToPdf.preview.stages.creatingPdf'), delay: 600 },
      { progress: 75, text: t('jpgToPdf.preview.stages.embedding'), delay: 400 },
      { progress: 90, text: t('jpgToPdf.preview.stages.finalizing'), delay: 300 },
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
        const { rotation, filterId } = getTransform(fileData.id)
        if (hasTransform(rotation, filterId)) {
          // Bake rotation + filter into a fresh image before upload.
          const { file } = await bakeImageTransform({
            src: fileData.data,
            fileName: fileData.name,
            rotation,
            filterId,
            mimeType: fileData.type,
          })
          formData.append('files', file, fileData.name)
        } else {
          // fileData.file is the raw File object — append directly, no canvas needed
          formData.append('files', fileData.file, fileData.name)
        }
      }

      setProgress(95)
      setStage(t('jpgToPdf.preview.stages.sending'))

      const { hostname, protocol } = window.location
      const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
        : `${protocol}//${hostname}`

      const response = await fetch(`${API_URL}/api/jpg-to-pdf`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let _dlBody = null; try { _dlBody = await response.clone().json() } catch (_) {}
        if (handleDailyLimitError(response.status, _dlBody)) return
        const errorData = await response.json().catch(() => ({}))
        // Specific, localized reasons (was a generic alert for every failure).
        if (errorData.error === "UNREADABLE_IMAGES") throw new Error(t("toolErrors.unreadableImages", { names: (errorData.files || []).join(", ") }))
        if (errorData.error === "FILE_TOO_LARGE") throw new Error(t("toolErrors.fileTooLarge", { name: filesToConvert.find((f) => f.size > 100 * 1024 * 1024)?.name || "" }))
        throw new Error(t("jpgToPdf.index.errorProcessing"))
      }

      const result = await response.json()
      
      setProgress(100)
      setStage(t('jpgToPdf.preview.stages.complete'))

      sessionStorage.setItem("jpgConvertResult", JSON.stringify(result))
      // Some images were unreadable (e.g. damaged) — the PDF has the rest; say which.
      if (result.skipped?.length) alert(t("toolErrors.someSkipped", { names: result.skipped.join(", ") }))
      jpgFileStore.clear()

      setTimeout(() => {
        goToDownload(router, `/jpg-to-pdf/download?jobId=${result.jobId}`)
      }, 500)
    } catch (err) {
      console.error("Conversion error:", err)
      setConverting(false)
      setProgress(0)
      setStage("")
      // Messages above are already localized; anything else (network) → generic.
      alert(err.message && !/fetch|network/i.test(err.message) ? err.message : t("jpgToPdf.index.errorProcessing"))
    }
  }

  if (filesData.length === 0) {
    return null
  }

  return (
    <>
      <SEOHead
        title={t('jpgToPdf.title')}
        description={t('jpgToPdf.description')}
        keywords={t('jpgToPdf.keywords')}
        noIndex={true}
      />
      <Layout>
        {/* Leaderboard ad — full-width strip above content */}
        <div className="bg-slate-50 px-4 pt-3 pb-1">
          <div className="max-w-6xl mx-auto">
            <AdSenseUnit adSlot="8004544994" size="leaderboard" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 min-h-screen py-4 px-4">
          <div className="max-w-6xl mx-auto">

            {/* Compact header row */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => router.push("/jpg-to-pdf")}
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('jpgToPdf.preview.backToUpload')}
              </button>
              <span className="text-xs text-slate-500">
                {filesData.length} {t('jpgToPdf.preview.imagesReady')}
              </span>
            </div>

            {/* Two-column layout */}
            <div className="flex flex-col lg:flex-row gap-4">

              {/* ── Main content ── */}
              <div className="flex-1 min-w-0 space-y-3">

                {/* Files grid card */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  {/* Card header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h2 className="font-display font-bold text-slate-900 text-sm leading-tight">
                          {t('jpgToPdf.preview.yourImages')}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {selectedFiles.length}/{filesData.length} {t('jpgToPdf.preview.selected')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => setSelectedFiles(filesData.map((f) => f.id))}
                        className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                      >
                        {t('jpgToPdf.preview.selectAll')}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => setSelectedFiles([])}
                        className="text-slate-500 hover:text-slate-700 font-semibold transition-colors"
                      >
                        {t('jpgToPdf.preview.deselectAll')}
                      </button>
                    </div>
                  </div>

                  {/* Image grid — tighter gap, more columns */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {filesData.map((file, index) => (
                      <div
                        key={file.id}
                        className={`relative group border-2 rounded-lg overflow-hidden transition-all cursor-pointer ${
                          selectedFiles.includes(file.id)
                            ? "border-blue-500 ring-1 ring-blue-200"
                            : "border-slate-200 hover:border-blue-300"
                        }`}
                        onClick={() => toggleFileSelection(file.id)}
                      >
                        <div className="aspect-square bg-slate-100 relative">
                          <img
                            src={file.data}
                            alt={file.name}
                            className="w-full h-full object-cover transition-transform"
                            style={{
                              transform: `rotate(${getTransform(file.id).rotation}deg)`,
                              filter: filterCssById(getTransform(file.id).filterId),
                            }}
                          />

                          {/* Checkbox overlay */}
                          <div className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                            selectedFiles.includes(file.id)
                              ? "bg-blue-600 border-blue-600"
                              : "bg-white/90 border-slate-300"
                          }`}>
                            {selectedFiles.includes(file.id) && (
                              <CheckCircle className="w-4 h-4 text-white" fill="currentColor" />
                            )}
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(file.id) }}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t('jpgToPdf.preview.removeImage')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>

                          {/* Page number badge */}
                          <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[10px] px-1.5 py-0.5 rounded leading-none">
                            #{index + 1}
                          </span>

                          {/* Rotate + filter controls */}
                          <ThumbEditControls
                            rotation={getTransform(file.id).rotation}
                            filterId={getTransform(file.id).filterId}
                            onRotate={(d) => rotateFile(file.id, d)}
                            onFilter={(fid) => setFileFilter(file.id, fid)}
                            className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </div>

                        {/* Filename */}
                        <div className="px-1.5 py-1 bg-white">
                          <p className="text-[10px] font-medium text-slate-700 truncate leading-tight" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Convert card */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  {converting ? (
                    <div className="flex flex-col items-center py-4 gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <div className="w-7 h-7 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-slate-900 text-sm">{t('jpgToPdf.preview.converting')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{stage}</p>
                      </div>
                      <div className="w-full max-w-xs">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1 text-center">{progress}%</p>
                      </div>
                      <LoadingPromo />
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Compact feature chips */}
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          <Shield className="w-3.5 h-3.5" /> {t('jpgToPdf.features.secure.title')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          <Zap className="w-3.5 h-3.5" /> {t('jpgToPdf.features.fast.title')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          <Sparkles className="w-3.5 h-3.5" /> {t('jpgToPdf.features.quality.title')}
                        </span>
                      </div>

                      {/* Convert button */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <button
                          onClick={handleConvert}
                          disabled={selectedFiles.length === 0}
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Play className="w-4 h-4" />
                          {t('jpgToPdf.preview.convertButton')} {selectedFiles.length} → PDF
                        </button>
                        {selectedFiles.length === 0 && (
                          <p className="text-xs text-red-500">{t('jpgToPdf.preview.selectAtLeastOne')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>


              </div>{/* end main */}

              {/* ── Sidebar ── */}
              <div className="lg:w-64 xl:w-72 flex-shrink-0 space-y-3">

                {/* Sidebar ad */}
                <div className="hidden lg:block bg-white rounded-xl border border-slate-200 p-2.5">
                  <PromoBanner slot={0} />
                </div>

                {/* Sidebar ad 2 */}
                <div className="hidden lg:block bg-white rounded-xl border border-slate-200 p-2.5">
                  <PromoBanner slot={1} />
                </div>

              </div>{/* end sidebar */}

            </div>{/* end two-column */}
          </div>
        </div>
      {DailyLimitGate}
      </Layout>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["jpgToPdf"]) },
    revalidate: 86400,
  }
}
