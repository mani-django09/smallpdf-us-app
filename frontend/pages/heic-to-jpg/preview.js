import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { FileImage, ArrowLeft, Play, Trash2, CheckCircle } from "lucide-react"
import ThumbEditControls from "../../components/ThumbEditControls"
import { filterCssById } from "../../lib/imageEdit"
import AdSenseUnit from "../../components/AdSenseUnit"
import PromoBanner from "../../components/PromoBanner"
import LoadingPromo from "../../components/LoadingPromo"
import useDailyLimit from '../../hooks/useDailyLimit'
import { heicToJpgStore } from "./index"
import { goToDownload } from "../../lib/fullPageNav"

export default function PreviewHeicToJpg() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [transforms, setTransforms] = useState({})
  // Browsers other than Safari can't display HEIC → show an icon for those.
  const [noPreview, setNoPreview] = useState({})
  const getTransform = (id) => transforms[id] || { rotation: 0, filterId: "none" }
  const rotateFile = (id, d) => setTransforms(p => { const c = p[id] || { rotation: 0, filterId: "none" }; return { ...p, [id]: { ...c, rotation: c.rotation + d } } })
  const setFileFilter = (id, fid) => setTransforms(p => { const c = p[id] || { rotation: 0, filterId: "none" }; return { ...p, [id]: { ...c, filterId: fid } } })

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    // Files come from memory; after a reload they're gone → back to upload.
    if (heicToJpgStore.files.length > 0) {
      setFilesData(heicToJpgStore.files)
      setSelectedFiles(heicToJpgStore.files.map((f) => f.id))
    } else {
      routerRef.current.push("/heic-to-jpg")
    }
  }, [])

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]))
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))
    heicToJpgStore.files = newFiles
    if (newFiles.length === 0) router.push("/heic-to-jpg")
  }

  const handleConvert = async () => {
    const filesToConvert = filesData.filter((f) => selectedFiles.includes(f.id))
    if (filesToConvert.length === 0) return

    setConverting(true)
    setProgress(0)
    setStage(t("heicToJpg.previewStageInit"))

    const stages = [
      { progress: 15, text: t("heicToJpg.previewStageUpload"), delay: 400 },
      { progress: 35, text: t("heicToJpg.previewStageProcess"), delay: 500 },
      { progress: 55, text: t("heicToJpg.previewStageConvert"), delay: 800 },
      { progress: 75, text: t("heicToJpg.previewStageOptimize"), delay: 400 },
      { progress: 90, text: t("heicToJpg.previewStageFinalize"), delay: 300 },
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
      if (hostname === 'localhost' || hostname === '127.0.0.1') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      return `${protocol}//${hostname}`
    }

    try {
      // Raw files + per-file rotation/filter, applied on the server. Baking them in
      // the browser needs it to decode HEIC, which only Safari can — in Chrome a
      // rotated photo made the whole conversion fail.
      const formData = new FormData()
      for (const fileData of filesToConvert) {
        formData.append("files", fileData.file, fileData.name)
      }
      formData.append("transforms", JSON.stringify(filesToConvert.map((f) => getTransform(f.id))))

      const API_URL = getApiUrl()
      const headers = {} // auth header comes from the global fetch wrapper (AuthContext)

      const convertResponse = await fetch(`${API_URL}/api/heic-to-jpg`, { method: "POST", headers, body: formData })

      if (convertResponse.status === 429) {
        const data = await convertResponse.json()
        if (handleDailyLimitError(convertResponse.status, data)) { setConverting(false); return }
      }

      const result = await convertResponse.json()
      setProgress(100)
      setStage(t("heicToJpg.previewStageComplete"))

      if (convertResponse.ok) {
        // Unreadable photos are skipped — say which; fileCount = what the server made.
        if (result.skipped?.length) alert(t("toolErrors.skippedFiles", { names: result.skipped.join(", ") }))
        sessionStorage.setItem("heicConvertResult", JSON.stringify({
          ...result,
          fileCount: result.fileCount || filesToConvert.length,
          totalSize: filesToConvert.reduce((acc, f) => acc + f.size, 0),
        }))
        setTimeout(() => goToDownload(router, `/heic-to-jpg/download?jobId=${result.jobId}`), 500)
      } else {
        alert(result.error === "UNREADABLE_IMAGES"
          ? t("toolErrors.unreadableImages", { names: (result.files || []).join(", ") })
          : result.error === "FILE_TOO_LARGE"
            ? t("toolErrors.fileTooLarge", { name: filesToConvert.find((f) => f.size > 100 * 1024 * 1024)?.name || "" })
            : t("heicToJpg.previewErrorRetry"))
        setConverting(false)
      }
    } catch (error) {
      console.error("Error:", error)
      alert(t("heicToJpg.previewErrorRetry"))
      setConverting(false)
    }
  }

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)
  const selectedCount = selectedFiles.length

  if (filesData.length === 0) {
    return (
      <>
        <SEOHead noIndex={true} />
        <Layout>
          <div className="min-h-screen flex items-center justify-center bg-orange-50">
            <div className="text-center">
              <div className="relative w-12 h-12 mx-auto mb-3">
                <div className="absolute inset-0 border-3 border-orange-200 rounded-full"></div>
                <div className="absolute inset-0 border-3 border-t-orange-600 rounded-full animate-spin"></div>
              </div>
              <p className="text-slate-600 font-medium text-sm">{t("heicToJpg.previewLoading")}</p>
            </div>
          </div>
        </Layout>
      </>
    )
  }

  return (
    <>
      <SEOHead noIndex={true} />
      <Layout title={t("heicToJpg.previewTitle")} description={t("heicToJpg.previewDescription")}>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
          .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body { font-family: 'DM Sans', sans-serif; }
        `}</style>

        {/* Header */}
        <div className="relative overflow-hidden bg-slate-50 border-b border-slate-200">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, #94a3b8 1px, transparent 0)`, backgroundSize: "24px 24px" }}></div>
          </div>
          <div className="relative max-w-5xl mx-auto px-4 py-5">
            <button onClick={() => router.push("/heic-to-jpg")} className="mb-3 flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors text-xs font-medium group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>{t("heicToJpg.previewChangeFiles")}</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
                <FileImage className="w-5 h-5 text-slate-900" />
              </div>
              <div>
                <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                  {(filesData.length === 1 ? t("heicToJpg.previewReadyTitleSingular") : t("heicToJpg.previewReadyTitlePlural")).replace("{count}", filesData.length)}
                </h1>
                <p className="font-body text-xs text-slate-600">{t("heicToJpg.previewReadySubtitle")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header Ad */}
        <div className="bg-orange-50 px-4 pt-5">
          <div className="max-w-4xl mx-auto">
            <AdSenseUnit adSlot="8004544994" size="leaderboard" />
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-orange-50 min-h-screen py-6 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Main Card */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-700 to-amber-700 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                          <FileImage className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-display text-sm font-semibold text-white">
                            {t("heicToJpg.previewSelectedOf").replace("{selected}", selectedCount).replace("{total}", filesData.length)}
                          </p>
                          <p className="text-xs text-orange-200 mt-0.5">
                            {t("heicToJpg.previewTotalSize").replace("{size}", (totalSize / 1024 / 1024).toFixed(2))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 bg-amber-300 rounded-full"></span>
                        <span className="text-xs font-medium text-amber-200">{t("heicToJpg.previewReadyBadge")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {!converting ? (
                      <>
                        <div className="mb-5">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-display text-sm font-semibold text-slate-900">{t("heicToJpg.previewYourImages")}</h3>
                            <button
                              onClick={() => setSelectedFiles(selectedFiles.length === filesData.length ? [] : filesData.map((f) => f.id))}
                              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                            >
                              {selectedFiles.length === filesData.length ? t("heicToJpg.previewDeselectAll") : t("heicToJpg.previewSelectAll")}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                            {filesData.map((f) => (
                              <div
                                key={f.id}
                                onClick={() => toggleFileSelection(f.id)}
                                className={`relative group cursor-pointer rounded-lg border-2 transition-all ${selectedFiles.includes(f.id) ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-slate-50 hover:border-orange-300"}`}
                              >
                                <div className="p-2">
                                  <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden mb-2 relative flex items-center justify-center">
                                    {f.data && !noPreview[f.id] ? (
                                      <img src={f.data} alt={f.name} onError={() => setNoPreview((p) => ({ ...p, [f.id]: true }))} className="w-full h-full object-cover transition-transform"
                                        style={{ transform: `rotate(${getTransform(f.id).rotation}deg)`, filter: filterCssById(getTransform(f.id).filterId) }} />
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-full">
                                        <FileImage className="w-8 h-8 text-orange-400" />
                                        <span className="text-xs text-slate-500 mt-1">HEIC</span>
                                      </div>
                                    )}
                                    {selectedFiles.includes(f.id) && (
                                      <div className="absolute top-1 right-1 w-5 h-5 bg-orange-600 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                                      </div>
                                    )}
                                    {(
                                      <ThumbEditControls
                                        rotation={getTransform(f.id).rotation} filterId={getTransform(f.id).filterId}
                                        onRotate={(d) => rotateFile(f.id, d)} onFilter={(fid) => setFileFilter(f.id, fid)}
                                        className="absolute bottom-1 right-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                      />
                                    )}
                                  </div>
                                  <p className="text-xs font-medium text-slate-900 truncate">{f.name}</p>
                                  <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}
                                  className="absolute top-1 left-1 p-1 bg-white rounded-full shadow-sm sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleConvert}
                          disabled={selectedCount === 0}
                          className="w-full bg-gradient-to-r from-orange-600 to-amber-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:from-orange-700 hover:to-amber-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Play className="w-4 h-4" />
                          <span>
                            {(selectedCount === 1 ? t("heicToJpg.previewConvertBtnSingular") : t("heicToJpg.previewConvertBtnPlural")).replace("{count}", selectedCount)}
                          </span>
                        </button>

                        <div className="grid grid-cols-3 gap-3 mt-5">
                          {[
                            { val: selectedCount, label: t("heicToJpg.previewSelected") },
                            { val: "<3s", label: t("heicToJpg.previewEstTime") },
                            { val: "92%", label: t("heicToJpg.previewQuality") },
                          ].map((s, i) => (
                            <div key={i} className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                              <div className={`font-display text-lg font-bold ${i === 2 ? "text-orange-600" : "text-slate-900"}`}>{s.val}</div>
                              <div className="font-body text-xs text-slate-500">{s.label}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="py-6">
                        <div className="text-center mb-5">
                          <div className="relative w-14 h-14 mx-auto mb-4">
                            <div className="absolute inset-0 border-4 border-orange-200 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-orange-600 border-r-orange-600 rounded-full animate-spin"></div>
                          </div>
                          <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                          <p className="font-body text-sm text-slate-600">{t("heicToJpg.previewProgressPct").replace("{progress}", progress)}</p>
                        </div>
                        <div className="bg-orange-100 rounded-full h-2 overflow-hidden mb-4">
                          <div className="bg-gradient-to-r from-orange-600 to-amber-600 h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <p className="font-body text-xs text-orange-800 text-center">
                            {(selectedCount === 1 ? t("heicToJpg.previewConvertingMsgSingular") : t("heicToJpg.previewConvertingMsgPlural")).replace("{count}", selectedCount)}
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
                <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-orange-200">
                  <PromoBanner slot={0} />
                </div>

                {/* Sidebar Ad 2 */}
                <div className="hidden lg:block bg-white rounded-xl p-3 shadow-sm border border-orange-200">
                  <PromoBanner slot={1} />
                </div>

              </div>
            </div>
          </div>
        </div>
        {DailyLimitGate}
      </Layout>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["heicToJpg"]) },
    revalidate: 86400,
  }
}
