import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { Minimize2, ArrowLeft, Play, Trash2, CheckCircle, Settings, Target } from "lucide-react"
import ThumbEditControls from "../../components/ThumbEditControls"
import { bakeImageTransform, filterCssById, hasTransform } from "../../lib/imageEdit"
import AdSenseUnit from "../../components/AdSenseUnit"
import PromoBanner from "../../components/PromoBanner"
import useDailyLimit from '../../hooks/useDailyLimit'
import { goToDownload } from "../../lib/fullPageNav"

export default function PreviewCompressImage() {
  const router = useLocalizedRouter()
  // Keep the branded URL when arriving via the /compress-image-to-50kb landing
  // page — it reuses this preview/download page via a next.config.js rewrite
  // alias rather than a separate copy.
  // Checking asPath for a literal English slug doesn't work once translated
  // (e.g. German asPath is /de/bild-auf-50kb-komprimieren/vorschau, which
  // doesn't contain "compress-image-to-50kb"), so a session flag set by the
  // landing page (storing its own base path) is used instead —
  // locale-independent and works for any /compress-image-to-*kb variant.
  const toolBase = (typeof window !== "undefined" && sessionStorage.getItem("compressImageLandingBase")) || "/compress-image"
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [compressionLevel, setCompressionLevel] = useState("balanced")
  // Size targeting: "quality" uses the preset tiles below; "target" lets the
  // user pick/type an exact KB ceiling (e.g. for a form upload with a 100KB cap).
  const [sizeMode, setSizeMode] = useState("target")
  // Landing pages like /compress-image-to-50kb pre-seed this via sessionStorage
  // so the target-size preset matches what the user searched for/clicked.
  // The initializer must stay side-effect free: React may call it twice (Strict
  // Mode), and removing the key inside it made the 2nd call fall back to 100 —
  // the 50 KB / 20 KB landing pages then opened with "≤100KB" selected.
  const [targetSizeKB, setTargetSizeKB] = useState(() => {
    if (typeof window === "undefined") return 100
    const parsed = parseInt(sessionStorage.getItem("compressImageDefaultTargetKB"), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
  })
  useEffect(() => {
    // Consume the landing-page preset once the page has mounted.
    try { sessionStorage.removeItem("compressImageDefaultTargetKB") } catch (_) {}
  }, [])
  const [customTargetInput, setCustomTargetInput] = useState("")
  const [error, setError] = useState("")
  const [transforms, setTransforms] = useState({})
  const getTransform = (id) => transforms[id] || { rotation: 0, filterId: "none" }
  const rotateFile = (id, delta) => setTransforms(prev => { const c = prev[id] || { rotation: 0, filterId: "none" }; return { ...prev, [id]: { ...c, rotation: c.rotation + delta } } })
  const setFileFilter = (id, filterId) => setTransforms(prev => { const c = prev[id] || { rotation: 0, filterId: "none" }; return { ...prev, [id]: { ...c, filterId } } })

  // ✅ routerRef prevents infinite re-render loop.
  // useLocalizedRouter() returns a new object every render, so using it
  // directly in useEffect deps causes: effect → router change → effect → loop.
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  })

  useEffect(() => {
    const storedFiles = sessionStorage.getItem("uploadedCompressImages")
    if (storedFiles) {
      try {
        const parsed = JSON.parse(storedFiles)
        setFilesData(parsed)
        setSelectedFiles(parsed.map((f) => f.id))
      } catch (err) {
        console.error("Error parsing file data:", err)
        routerRef.current.push(toolBase)
      }
    } else {
      routerRef.current.push(toolBase)
    }
  }, []) // ✅ Empty deps — runs once on mount only

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]))
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))
    sessionStorage.setItem("uploadedCompressImages", JSON.stringify(newFiles))
    // Also clean up from window global
    if (typeof window !== "undefined" && window.__compressFiles) {
      window.__compressFiles = window.__compressFiles.filter((wf) => wf.id !== id)
    }
    if (newFiles.length === 0) {
      router.push(toolBase)
    }
  }

  // ✅ Get API URL — works for localhost and production
  function getApiUrl() {
    if (typeof window === "undefined") {
      return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
    }
    const { hostname, protocol } = window.location
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
    }
    // Production: use env var if set, otherwise assume Nginx proxies /api/ correctly
    return process.env.NEXT_PUBLIC_API_URL || `${protocol}//${hostname}`
  }

  const handleCompress = async () => {
    const filesToCompress = filesData.filter((f) => selectedFiles.includes(f.id))
    if (filesToCompress.length === 0) return

    setError("")
    setCompressing(true)
    setProgress(0)
    setStage(t("compressImage.previewStageInit"))

    // Animated progress stages
    const stages = [
      { progress: 15, text: t("compressImage.previewStageAnalyze"), delay: 400 },
      { progress: 35, text: t("compressImage.previewStageAlgorithm"), delay: 500 },
      { progress: 55, text: t("compressImage.previewStageOptimize"), delay: 600 },
      { progress: 75, text: t("compressImage.previewStageReduce"), delay: 400 },
      { progress: 90, text: t("compressImage.previewStageFinalize"), delay: 300 },
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
      if (sizeMode === "target" && targetSizeKB > 0) {
        formData.append("targetSizeKB", String(targetSizeKB))
      } else {
        formData.append("quality", compressionLevel)
      }

      // ✅ FIXED: Use real File objects from window.__compressFiles if available.
      // This avoids re-fetching from base64 which caused sessionStorage overflow errors.
      const windowFiles = (typeof window !== "undefined" && window.__compressFiles) || []

      let filesAttached = 0
      for (const fileData of filesToCompress) {
        // Try to get original File object from window global (set in index.js)
        const match = windowFiles.find((wf) => wf.id === fileData.id)

        const { rotation, filterId } = getTransform(fileData.id)
        const needsBake = hasTransform(rotation, filterId)
        const src = fileData.preview || fileData.data

        if (needsBake && src) {
          try {
            const { file } = await bakeImageTransform({ src, fileName: fileData.name, rotation, filterId, mimeType: fileData.type })
            formData.append("files", file); filesAttached++
          } catch (bakeErr) { console.warn(`Bake failed for ${fileData.name}:`, bakeErr) }
        } else if (match && match.file instanceof File) {
          // ✅ Best path: use the actual File object directly
          formData.append("files", match.file)
          filesAttached++
        } else if (fileData.preview && fileData.preview.startsWith("blob:")) {
          // ✅ Fallback path A: reconstruct from blob URL (works same tab)
          try {
            const response = await fetch(fileData.preview)
            const blob = await response.blob()
            const file = new File([blob], fileData.name, { type: fileData.type })
            formData.append("files", file)
            filesAttached++
          } catch (blobErr) {
            console.warn(`Could not fetch blob URL for ${fileData.name}:`, blobErr)
          }
        } else if (fileData.data && fileData.data.startsWith("data:")) {
          // ✅ Fallback path B: reconstruct from base64 data URI (legacy support)
          try {
            const response = await fetch(fileData.data)
            const blob = await response.blob()
            const file = new File([blob], fileData.name, { type: fileData.type })
            formData.append("files", file)
            filesAttached++
          } catch (b64Err) {
            console.warn(`Could not reconstruct file from base64 for ${fileData.name}:`, b64Err)
          }
        } else {
          console.warn(`No usable file source found for: ${fileData.name}`)
        }
      }

      if (filesAttached === 0) {
        throw new Error("No files could be prepared for upload. Please go back and re-select your images.")
      }

      const API_URL = getApiUrl()
      const compressResponse = await fetch(`${API_URL}/api/compress-image`, {
        method: "POST",
        body: formData,
      })

      // A proxy error page (413/502) is HTML, not JSON.
      const result = await compressResponse.json().catch(() => ({}))
      if (handleDailyLimitError(compressResponse.status, result)) { setCompressing(false); setProgress(0); return }  // daily-limit upgrade modal

      setProgress(100)
      setStage(t("compressImage.previewStageComplete"))

      if (compressResponse.ok && result.success) {
        sessionStorage.setItem(
          "compressResult",
          JSON.stringify({
            ...result,
            fileCount: filesToCompress.length,
            totalSize: filesToCompress.reduce((acc, f) => acc + f.size, 0),
            compressionLevel: sizeMode === "target" ? "target" : compressionLevel,
          })
        )
        setTimeout(() => {
          goToDownload(router, `${toolBase}/download?jobId=${result.jobId}`)
        }, 500)
      } else {
        // Server returned an error response
        const errMsg = result.message || (typeof result.error === 'string' && /s/.test(result.error) ? result.error : '') || t("compressImage.previewErrorRetry")
        setError(errMsg)
        setCompressing(false)
        setProgress(0)
      }
    } catch (error) {
      console.error("Compress error:", error)
      setError(
        error.message ||
          t("compressImage.previewErrorRetry") ||
          "Failed to compress images. Please try again."
      )
      setCompressing(false)
      setProgress(0)
    }
  }

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)
  const selectedCount = selectedFiles.length

  const compressionOptions = [
    {
      value: "maximum",
      label: t("compressImage.previewMaxLabel"),
      desc: t("compressImage.previewMaxDesc"),
      reduction: t("compressImage.previewMaxReduction"),
    },
    {
      value: "balanced",
      label: t("compressImage.previewBalancedLabel"),
      desc: t("compressImage.previewBalancedDesc"),
      reduction: t("compressImage.previewBalancedReduction"),
    },
    {
      value: "light",
      label: t("compressImage.previewLightLabel"),
      desc: t("compressImage.previewLightDesc"),
      reduction: t("compressImage.previewLightReduction"),
    },
  ]

  // Common upload-form / email-attachment caps — covers the sizes people
  // actually get asked for (passport photo forms, government portals, etc.)
  const targetSizePresets = [20, 50, 100, 200, 500]
  const isCustomTarget = !targetSizePresets.includes(targetSizeKB)

  if (filesData.length === 0) {
    return (
      <Layout>
        <SEOHead
          title="Compress Image - Preview | SmallPDF.us"
          description="Review and compress your images."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("compressImage.previewLoading")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <SEOHead
        title="Compress Image - Preview | SmallPDF.us"
        description="Review and compress your images."
        noIndex={true}
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header Ad */}
          <div className="mb-6">
            <AdSenseUnit adSlot="8004544994" size="leaderboard" />
          </div>

          {/* Back button */}
          <button
            onClick={() => router.push(toolBase)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium text-sm mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            {t("compressImage.previewBack")}
          </button>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main panel */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Minimize2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h1 className="font-display text-lg font-bold text-slate-900">
                      {t("compressImage.previewTitle")}
                    </h1>
                    <p className="font-body text-xs text-slate-500">
                      {t("compressImage.previewSubtitle")
                        .replace("{count}", filesData.length)
                        .replace("{plural}", filesData.length > 1 ? "s" : "")
                        .replace("{size}", (totalSize / 1024).toFixed(1))}
                    </p>
                  </div>
                </div>

                {!compressing ? (
                  <>
                    {/* Compression mode: quality preset vs. exact target size */}
                    <div className="mb-5">
                      <div className="inline-flex items-center gap-1 bg-slate-100 rounded-full p-1 mb-4">
                        <button
                          onClick={() => setSizeMode("quality")}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            sizeMode === "quality" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {t("compressImage.previewQualityTitle")}
                        </button>
                        <button
                          onClick={() => setSizeMode("target")}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                            sizeMode === "target" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          <Target className="w-3.5 h-3.5" />
                          {t("compressImage.previewTargetSize")}
                        </button>
                      </div>

                      {sizeMode === "quality" ? (
                        <div className="grid grid-cols-3 gap-2">
                          {compressionOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setCompressionLevel(option.value)}
                              className={`p-3 rounded-xl border-2 text-left transition-all ${
                                compressionLevel === option.value
                                  ? "border-purple-500 bg-purple-50"
                                  : "border-slate-200 hover:border-slate-300 bg-white"
                              }`}
                            >
                              <div className="font-display text-sm font-bold text-slate-900">{option.label}</div>
                              <div className="font-body text-xs text-slate-500 mt-0.5">{option.desc}</div>
                              <div
                                className={`font-display text-xs font-bold mt-1 ${
                                  compressionLevel === option.value ? "text-purple-600" : "text-slate-400"
                                }`}
                              >
                                {option.reduction}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-slate-500 mb-3">
                            {t("compressImage.previewTargetHint")}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {targetSizePresets.map((kb) => (
                              <button
                                key={kb}
                                onClick={() => { setTargetSizeKB(kb); setCustomTargetInput("") }}
                                className={`px-4 py-2 rounded-xl border-2 font-display text-sm font-bold transition-all ${
                                  !isCustomTarget && targetSizeKB === kb
                                    ? "border-purple-500 bg-purple-50 text-purple-700"
                                    : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                                }`}
                              >
                                {kb} KB
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500">{t("compressImage.previewCustom")}</span>
                            <div className="relative">
                              <input
                                type="number"
                                min="5"
                                max="10000"
                                placeholder={t("compressImage.previewCustomPlaceholder")}
                                value={customTargetInput}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setCustomTargetInput(v)
                                  const n = parseInt(v, 10)
                                  if (Number.isFinite(n) && n > 0) setTargetSizeKB(n)
                                }}
                                className={`w-28 pl-3 pr-9 py-1.5 rounded-lg border-2 text-sm font-semibold outline-none transition-all ${
                                  isCustomTarget
                                    ? "border-purple-500 bg-purple-50 text-purple-700"
                                    : "border-slate-200 focus:border-purple-400 text-slate-700"
                                }`}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                                KB
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* File list */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-display text-sm font-semibold text-slate-700">
                          {t("compressImage.previewImagesTitle")} ({filesData.length})
                        </span>
                        <button
                          onClick={() =>
                            setSelectedFiles(
                              selectedFiles.length === filesData.length ? [] : filesData.map((f) => f.id)
                            )
                          }
                          className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                        >
                          {selectedFiles.length === filesData.length
                            ? t("compressImage.previewDeselectAll")
                            : t("compressImage.previewSelectAll")}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                        {filesData.map((f) => (
                          <div
                            key={f.id}
                            onClick={() => toggleFileSelection(f.id)}
                            className={`relative group cursor-pointer rounded-lg border-2 transition-all ${
                              selectedFiles.includes(f.id)
                                ? "border-purple-500 bg-purple-50"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300"
                            }`}
                          >
                            <div className="p-2">
                              <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden mb-2 relative">
                                {/* ✅ Use preview blob URL; fallback to data URI if present */}
                                <img
                                  src={f.preview || f.data || "/placeholder.svg"}
                                  alt={f.name}
                                  className="w-full h-full object-cover transition-transform"
                                  style={{ transform: `rotate(${getTransform(f.id).rotation}deg)`, filter: filterCssById(getTransform(f.id).filterId) }}
                                  // Swap to the fallback only once: re-setting the same src on
                                  // every error re-requested it forever (40k+ requests/day
                                  // back when /placeholder.svg was missing).
                                  onError={(e) => { if (!e.currentTarget.src.endsWith("/placeholder.svg")) e.currentTarget.src = "/placeholder.svg" }}
                                />
                                {selectedFiles.includes(f.id) && (
                                  <div className="absolute top-1 right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                                  </div>
                                )}
                                <ThumbEditControls
                                  rotation={getTransform(f.id).rotation}
                                  filterId={getTransform(f.id).filterId}
                                  onRotate={(d) => { rotateFile(f.id, d) }}
                                  onFilter={(fid) => setFileFilter(f.id, fid)}
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

                    {/* Error message */}
                    {error && (
                      <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                        <span className="text-red-600 text-lg leading-none mt-0.5">⚠</span>
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                      </div>
                    )}

                    {/* Compress Button */}
                    <button
                      onClick={handleCompress}
                      disabled={selectedCount === 0 || compressing}
                      className="w-full bg-purple-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:bg-purple-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" />
                      <span>
                        {t("compressImage.previewCompressBtn")
                          .replace("{count}", selectedCount)
                          .replace("{plural}", selectedCount !== 1 ? "s" : "")}
                      </span>
                    </button>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-5">
                      <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="font-display text-lg font-bold text-slate-900">{selectedCount}</div>
                        <div className="font-body text-xs text-slate-500">{t("compressImage.previewSelected")}</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="font-display text-lg font-bold text-purple-600">&lt;5s</div>
                        <div className="font-body text-xs text-slate-500">{t("compressImage.previewEstTime")}</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="font-display text-lg font-bold text-slate-900">
                          {sizeMode === "target"
                            ? `≤${targetSizeKB}KB`
                            : compressionOptions.find((o) => o.value === compressionLevel)?.reduction}
                        </div>
                        <div className="font-body text-xs text-slate-500">
                          {sizeMode === "target" ? "Target" : t("compressImage.previewReduction")}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  // ── Compressing progress view ──
                  <div className="py-6">
                    <div className="text-center mb-5">
                      <div className="relative w-14 h-14 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-purple-600 border-r-purple-600 rounded-full animate-spin"></div>
                      </div>
                      <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                      <p className="font-body text-sm text-slate-600">
                        {t("compressImage.previewProgressPct").replace("{progress}", progress)}
                      </p>
                    </div>

                    <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                      <div
                        className="bg-purple-600 h-full transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <p className="font-body text-xs text-purple-800 text-center">
                        {t("compressImage.previewCompressingMsg")
                          .replace("{count}", selectedCount)
                          .replace("{plural}", selectedCount !== 1 ? "s" : "")}
                      </p>
                    </div>
                  </div>
                )}
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
    props: { messages: getPageMessages(locale, ["compressImage"]) },
    revalidate: 86400,
  }
}
