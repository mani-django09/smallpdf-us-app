import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { Minimize2, ArrowLeft, Sparkles, Shield, Zap, Clock, Play, Trash2, CheckCircle, Settings } from "lucide-react"

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

export default function PreviewCompressImage() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [compressionLevel, setCompressionLevel] = useState("balanced")
  const [error, setError] = useState("")

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
        routerRef.current.push("/compress-image")
      }
    } else {
      routerRef.current.push("/compress-image")
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
      router.push("/compress-image")
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
      formData.append("quality", compressionLevel)

      // ✅ FIXED: Use real File objects from window.__compressFiles if available.
      // This avoids re-fetching from base64 which caused sessionStorage overflow errors.
      const windowFiles = (typeof window !== "undefined" && window.__compressFiles) || []

      let filesAttached = 0
      for (const fileData of filesToCompress) {
        // Try to get original File object from window global (set in index.js)
        const match = windowFiles.find((wf) => wf.id === fileData.id)

        if (match && match.file instanceof File) {
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

      const result = await compressResponse.json()

      setProgress(100)
      setStage(t("compressImage.previewStageComplete"))

      if (compressResponse.ok && result.success) {
        sessionStorage.setItem(
          "compressResult",
          JSON.stringify({
            ...result,
            fileCount: filesToCompress.length,
            totalSize: filesToCompress.reduce((acc, f) => acc + f.size, 0),
            compressionLevel: compressionLevel,
          })
        )
        setTimeout(() => {
          router.push(`/compress-image/download?jobId=${result.jobId}`)
        }, 500)
      } else {
        // Server returned an error response
        const errMsg = result.error || result.details || "Compression failed. Please try again."
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
            <AdSenseUnit adSlot="8004544994" />
          </div>

          {/* Back button */}
          <button
            onClick={() => router.push("/compress-image")}
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
                      {t("compressImage.previewSubtitle").replace("{count}", filesData.length).replace("{size}", (totalSize / 1024).toFixed(1))}
                    </p>
                  </div>
                </div>

                {!compressing ? (
                  <>
                    {/* Compression Level Selector */}
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span className="font-display text-sm font-semibold text-slate-700">
                          {t("compressImage.previewQualityTitle")}
                        </span>
                      </div>
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
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.src = "/placeholder.svg"
                                  }}
                                />
                                {selectedFiles.includes(f.id) && (
                                  <div className="absolute top-1 right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                                  </div>
                                )}
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
                          {compressionOptions.find((o) => o.value === compressionLevel)?.reduction}
                        </div>
                        <div className="font-body text-xs text-slate-500">{t("compressImage.previewReduction")}</div>
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
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                  {t("compressImage.previewWhatYouGet")}
                </h3>
                <div className="space-y-2.5">
                  {[
                    { icon: Sparkles, text: t("compressImage.previewBenefit1"), color: "text-purple-600 bg-purple-100" },
                    { icon: Shield, text: t("compressImage.previewBenefit2"), color: "text-slate-600 bg-slate-100" },
                    { icon: Zap, text: t("compressImage.previewBenefit3"), color: "text-amber-600 bg-amber-100" },
                    { icon: Clock, text: t("compressImage.previewBenefit4"), color: "text-slate-600 bg-slate-100" },
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
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                  {t("compressImage.previewStepsTitle")}
                </h3>
                <div className="space-y-2">
                  {[
                    { num: "1", text: t("compressImage.previewStep1"), color: "bg-purple-600" },
                    { num: "2", text: t("compressImage.previewStep2"), color: "bg-slate-600" },
                    { num: "3", text: t("compressImage.previewStep3"), color: "bg-slate-800" },
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