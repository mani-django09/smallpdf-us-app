import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "@/lib/useLocalizedRouter"
import Layout from "@/components/Layout"
import SEOHead from "@/components/SEOHead"
import { FileText, ArrowLeft, CheckCircle2, Sparkles, Shield, Zap, Clock, Play, AlertCircle } from "lucide-react"
import { useTranslations } from "@/lib/i18n"
// FIX #8: Import the in-memory file store from the upload page
import { pendingPdfFiles } from "./index"

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

// Get API URL - use environment variable or empty string for relative URLs
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""

export default function PreviewPdfToWord() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [files, setFiles] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")

  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  })

  useEffect(() => {
    // Load file metadata from sessionStorage
    const storedMeta = sessionStorage.getItem("uploadedPdfFiles")

    if (storedMeta) {
      try {
        const parsed = JSON.parse(storedMeta)
        const metaArray = Array.isArray(parsed) ? parsed : [parsed]

        // FIX #8: If we have actual File objects in memory (same-session navigation),
        // marry them up with the metadata so we can upload them directly.
        if (pendingPdfFiles.current && pendingPdfFiles.current.length > 0) {
          const enriched = metaArray.map((meta, idx) => ({
            ...meta,
            fileObject: pendingPdfFiles.current[idx] || null,
          }))
          setFiles(enriched)
        } else {
          // Fallback: metadata only (e.g. page refresh) — we still have enough info
          // to show the preview UI; conversion will re-fetch from original file data
          setFiles(metaArray)
        }
      } catch (err) {
        console.error("Error parsing file data:", err)
        routerRef.current.push("/pdf-to-word")
      }
    } else {
      routerRef.current.push("/pdf-to-word")
    }
  }, [])

  const handleConvert = async () => {
    if (files.length === 0) return

    setConverting(true)
    setProgress(0)
    // FIX #6: Actually call setStage() — previously the return value was silently discarded
    setStage(t("pdfToWordPreview.preparingStage"))
    setError("")

    // Progress animation stages
    const stages = [
      { progress: 15, text: t("pdfToWordPreview.stage1"), delay: 400 },
      { progress: 35, text: t("pdfToWordPreview.stage2"), delay: 600 },
      { progress: 55, text: t("pdfToWordPreview.stage3"), delay: 800 },
      { progress: 75, text: t("pdfToWordPreview.stage4"), delay: 600 },
      { progress: 90, text: t("pdfToWordPreview.stage5"), delay: 400 },
    ]

    let currentStage = 0
    const progressInterval = setInterval(() => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage].progress)
        setStage(stages[currentStage].text)
        currentStage++
      }
    }, 500)

    try {
      const formData = new FormData()

      for (const fileData of files) {
        if (fileData.fileObject) {
          // FIX #8: Use in-memory File object directly — no base64 round-trip needed
          formData.append("files", fileData.fileObject)
        } else if (fileData.data) {
          // Legacy path: base64 data was stored (old behavior, kept for compatibility)
          const response = await fetch(fileData.data)
          const blob = await response.blob()
          const file = new File([blob], fileData.name, { type: "application/pdf" })
          formData.append("files", file)
        } else {
          // No file data available (e.g. after a hard refresh) — skip this file
          console.warn(`No file data for: ${fileData.name}`)
        }
      }

      // Call the conversion API
      const convertResponse = await fetch(`${API_BASE_URL}/api/pdf-to-word`, {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)

      const result = await convertResponse.json()

      if (convertResponse.ok && result.success) {
        setProgress(100)
        setStage(t("pdfToWordPreview.stageComplete"))

        // Store the conversion result with jobId for the download page
        sessionStorage.setItem("pdfWordConvertResult", JSON.stringify(result))

        // Navigate to download page
        setTimeout(() => {
          router.push(`/pdf-to-word/download?jobId=${result.jobId}`)
        }, 500)
      } else {
        throw new Error(result.error || result.details || "Conversion failed")
      }
    } catch (err) {
      clearInterval(progressInterval)
      console.error("Conversion error:", err)
      setError(err.message || t("pdfToWordPreview.conversionFailed"))
      setConverting(false)
      setProgress(0)
      setStage("")
    }
  }

  const totalPages = files.reduce((sum, f) => sum + (f.pageCount || 1), 0)
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)

  if (files.length === 0) {
    return (
      <Layout>
        <SEOHead noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("pdfToWordPreview.loadingText")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      title={t("pdfToWordPreview.layoutTitle")}
      description={t("pdfToWordPreview.layoutDesc")}
    >
      <SEOHead noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Compact Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 relative overflow-hidden">
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
            onClick={() => router.push("/pdf-to-word")}
            className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-xs font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t("pdfToWordPreview.changeFiles")}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                {t("pdfToWordPreview.readyToConvert")}
              </h1>
              <p className="font-body text-xs text-white/80">
                {files.length > 1
                  ? t("pdfToWordPreview.headerSubtitle_plural")
                      .replace("{{count}}", files.length)
                      .replace("{{pages}}", totalPages)
                  : t("pdfToWordPreview.headerSubtitle_singular")
                      .replace("{{count}}", files.length)
                      .replace("{{pages}}", totalPages)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-5">
        <div className="max-w-4xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Card */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Files Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-white truncate">
                        {files.length === 1
                          ? files[0].name
                          : `${files.length} ${t("pdfToWordPreview.pdfDocuments")}`}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>
                          {(totalSize / 1024 / 1024).toFixed(2)} {t("pdfToWordPreview.mbTotal")}
                        </span>
                        <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                        <span>
                          {totalPages} {t("pdfToWordPreview.pages")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                      <span className="text-xs font-medium text-emerald-300">{t("pdfToWordPreview.ready")}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-body text-sm text-red-800 font-medium">
                          {t("pdfToWordPreview.conversionFailed")}
                        </p>
                        <p className="font-body text-sm text-red-700 mt-1">{error}</p>
                      </div>
                    </div>
                  )}

                  {!converting ? (
                    <>
                      {/* File List */}
                      {files.length > 1 && (
                        <div className="mb-4 max-h-40 overflow-y-auto">
                          <p className="text-xs font-medium text-slate-500 mb-2">
                            {t("pdfToWordPreview.filesToConvert")}
                          </p>
                          <div className="space-y-2">
                            {files.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                                <FileText className="w-4 h-4 text-blue-600" />
                                <span className="text-sm text-slate-700 truncate flex-1">{file.name}</span>
                                <span className="text-xs text-slate-500">
                                  {file.pageCount || 1} {t("pdfToWordPreview.pg")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status Card */}
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 text-center border border-slate-200 mb-5">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-sm mb-3 border border-slate-200">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900 mb-1">
                          {t("pdfToWordPreview.documentsValidated")}
                        </h3>
                        <p className="font-body text-sm text-slate-600">
                          {t("pdfToWordPreview.validatedSubtitle")}
                        </p>
                      </div>

                      {/* Convert Button */}
                      <button
                        onClick={handleConvert}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        <span>{t("pdfToWordPreview.convertButton")}</span>
                      </button>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">{files.length}</div>
                          <div className="font-body text-xs text-slate-500">{t("pdfToWordPreview.files")}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-emerald-600">&lt;10s</div>
                          <div className="font-body text-xs text-slate-500">{t("pdfToWordPreview.estTime")}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">.DOCX</div>
                          <div className="font-body text-xs text-slate-500">{t("pdfToWordPreview.output")}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <div className="text-center mb-5">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-blue-600 border-r-blue-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                        <p className="font-body text-sm text-slate-600">
                          {progress}
                          {t("pdfToWordPreview.percentComplete")}
                        </p>
                      </div>

                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-blue-700 h-full transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="font-body text-xs text-blue-800 text-center">
                          {files.length > 1
                            ? t("pdfToWordPreview.convertingText_plural").replace("{{count}}", files.length)
                            : t("pdfToWordPreview.convertingText_singular").replace("{{count}}", files.length)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Features */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                  {t("pdfToWordPreview.whatYouGet")}
                </h3>
                <div className="space-y-2.5">
                  {[
                    { icon: Sparkles, text: t("pdfToWordPreview.feat1"), color: "text-violet-600 bg-violet-100" },
                    { icon: Shield, text: t("pdfToWordPreview.feat2"), color: "text-emerald-600 bg-emerald-100" },
                    { icon: Zap, text: t("pdfToWordPreview.feat3"), color: "text-amber-600 bg-amber-100" },
                    { icon: Clock, text: t("pdfToWordPreview.feat4"), color: "text-blue-600 bg-blue-100" },
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

              {/* Process Steps */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                  {t("pdfToWordPreview.conversionProcess")}
                </h3>
                <div className="space-y-2">
                  {[
                    { num: "1", text: t("pdfToWordPreview.step1"), color: "bg-blue-600" },
                    { num: "2", text: t("pdfToWordPreview.step2"), color: "bg-blue-700" },
                    { num: "3", text: t("pdfToWordPreview.step3"), color: "bg-emerald-600" },
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