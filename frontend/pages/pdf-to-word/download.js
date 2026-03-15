import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "@/lib/useLocalizedRouter"
import Layout from "@/components/Layout"
import SEOHead from "@/components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import {
  Download,
  FileText,
  CheckCircle,
  Share2,
  RefreshCw,
  Shield,
  Copy,
  ChevronRight,
  ArrowRight,
  Lock,
  Timer,
  FileCheck,
  Edit3,
  Layers,
  FilePlus,
  FileOutput,
} from "lucide-react"

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

// Get API URL from environment or default to relative path
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""

export default function DownloadPdfToWord() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { jobId } = router.query

  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  })

  const [convertResult, setConvertResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3600)
  // FIX #7: mounted guards the countdown display to prevent Next.js hydration mismatch.
  // The server renders "60:00" and the client starts the real timer only after mount.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const result = sessionStorage.getItem("pdfWordConvertResult")
    if (result) {
      setConvertResult(JSON.parse(result))
    } else if (!jobId) {
      routerRef.current.push("/pdf-to-word")
    }
  }, [jobId])

  useEffect(() => {
    if (!mounted) return
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [mounted, countdown])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleDownload = async () => {
    if (!jobId) return
    setDownloading(true)

    try {
      const downloadUrl = `${API_BASE_URL}/api/download-word/${jobId}`
      console.log("Downloading from:", downloadUrl)

      const response = await fetch(downloadUrl)

      if (!response.ok) {
        let errorMessage = "Download failed"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      const contentDisposition = response.headers.get("content-disposition")
      let filename = `converted-document-${jobId}.docx`

      if (contentDisposition) {
        // Handle both encoded and plain filenames
        const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;\n]*)/)
        const plainMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (encodedMatch && encodedMatch[1]) {
          filename = decodeURIComponent(encodedMatch[1])
        } else if (plainMatch && plainMatch[1]) {
          filename = plainMatch[1].replace(/['"]/g, "")
        }
      }

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setDownloadComplete(true)
      setTimeout(() => setDownloadComplete(false), 4000)
    } catch (error) {
      console.error("Download error:", error)
      alert(t("pdfToWordDownload.downloadFailed").replace("{{error}}", error.message))
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("uploadedPdfFiles")
    sessionStorage.removeItem("pdfWordConvertResult")
    router.push("/pdf-to-word")
  }

  const handleCopyLink = () => {
    const fullUrl = window.location.href
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("pdfToWordDownload.shareTitle"),
          text: t("pdfToWordDownload.shareText"),
          url: window.location.href,
        })
      } catch (err) {
        console.log("Share cancelled:", err)
      }
    } else {
      handleCopyLink()
    }
  }

  if (!convertResult && !jobId) {
    return (
      <Layout>
        <SEOHead noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("pdfToWordDownload.preparingDownload")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const fileCount = convertResult?.fileCount || 1

  return (
    <Layout
      title={t("pdfToWordDownload.layoutTitle")}
      description={t("pdfToWordDownload.layoutDesc")}
    >
      <SEOHead noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        @keyframes checkmark-draw { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
        @keyframes fade-up { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes bounce-gentle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .animate-checkmark { animation: checkmark-draw 0.4s ease-out 0.3s forwards; stroke-dasharray: 24; stroke-dashoffset: 24; }
        .animate-fade-up { animation: fade-up 0.5s ease-out forwards; }
        .animate-fade-up-delay-1 { animation: fade-up 0.5s ease-out 0.1s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.5s ease-out 0.2s forwards; opacity: 0; }
        .btn-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); background-size: 200% 100%; animation: shimmer 2s infinite; }
        .animate-bounce-gentle { animation: bounce-gentle 2s ease-in-out infinite; }
      `}</style>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* Success Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700">
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
              <div className={`relative flex-shrink-0 ${mounted ? "animate-fade-up" : ""}`}>
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-checkmark"
                    />
                  </svg>
                </div>
              </div>
              <div className={`${mounted ? "animate-fade-up-delay-1" : "opacity-0"}`}>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {fileCount > 1
                    ? t("pdfToWordDownload.headerTitle_plural")
                    : t("pdfToWordDownload.headerTitle_singular")}
                </h1>
                <p className="font-body text-blue-100 text-sm">
                  {fileCount > 1
                    ? t("pdfToWordDownload.headerSubtitle_plural").replace("{{count}}", fileCount)
                    : t("pdfToWordDownload.headerSubtitle_singular").replace("{{count}}", fileCount)}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${mounted ? "animate-fade-up-delay-2" : "opacity-0"}`}>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-white">
                <Timer className="w-3.5 h-3.5" />
                {/* FIX #7: Use mounted to guard the live countdown — prevents hydration mismatch */}
                <span>
                  {t("pdfToWordDownload.expiresIn")} {mounted ? formatTime(countdown) : "60:00"}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-white">
                <Lock className="w-3.5 h-3.5" />
                <span>{t("pdfToWordDownload.encrypted")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 py-8 sm:py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Main Download Section */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                {/* File Header */}
                <div className="bg-slate-800 px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <FileCheck className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-white truncate">
                        {fileCount > 1 ? `${fileCount}-documents.zip` : `converted-document.docx`}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                          {t("pdfToWordDownload.readyToDownload")}
                        </span>
                        <span className="text-slate-400 text-sm">
                          {fileCount > 1
                            ? t("pdfToWordDownload.wordFile_plural").replace("{{count}}", fileCount)
                            : t("pdfToWordDownload.wordFile_singular").replace("{{count}}", fileCount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Actions */}
                <div className="p-6 sm:p-8">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="group relative w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 overflow-hidden"
                  >
                    <div className="absolute inset-0 btn-shimmer"></div>
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="relative">{t("pdfToWordDownload.preparingDownloadBtn")}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="relative">{t("pdfToWordDownload.downloadedSuccess")}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce-gentle" />
                        <span className="relative">
                          {fileCount > 1
                            ? t("pdfToWordDownload.downloadButton_plural")
                            : t("pdfToWordDownload.downloadButton_singular")}
                        </span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{fileCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">
                        {fileCount > 1
                          ? t("pdfToWordDownload.document_plural")
                          : t("pdfToWordDownload.document_singular")}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-blue-600">100%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("pdfToWordDownload.editable")}</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">.DOCX</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("pdfToWordDownload.format")}</div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleConvertAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t("pdfToWordDownload.convertAnother")}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                      title="Share"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                      title="Copy link"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* What You Can Do Now */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">
                  {t("pdfToWordDownload.startEditingTitle")}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      icon: Edit3,
                      title: t("pdfToWordDownload.edit1Title"),
                      desc: t("pdfToWordDownload.edit1Desc"),
                      color: "bg-blue-600",
                    },
                    {
                      icon: Layers,
                      title: t("pdfToWordDownload.edit2Title"),
                      desc: t("pdfToWordDownload.edit2Desc"),
                      color: "bg-amber-500",
                    },
                    {
                      icon: FilePlus,
                      title: t("pdfToWordDownload.edit3Title"),
                      desc: t("pdfToWordDownload.edit3Desc"),
                      color: "bg-slate-600",
                    },
                    {
                      icon: FileOutput,
                      title: t("pdfToWordDownload.edit4Title"),
                      desc: t("pdfToWordDownload.edit4Desc"),
                      color: "bg-slate-800",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:shadow-md transition-shadow"
                    >
                      <div
                        className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-3 shadow-md`}
                      >
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="font-display font-semibold text-slate-900 mb-1">{item.title}</h4>
                      <p className="font-body text-sm text-slate-600">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* More Tools */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    {t("pdfToWordDownload.moreToolsTitle")}
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        name: t("pdfToWordDownload.tool1Name"),
                        desc: t("pdfToWordDownload.tool1Desc"),
                        href: "/word-to-pdf",
                        color: "bg-slate-800",
                      },
                      {
                        name: t("pdfToWordDownload.tool2Name"),
                        desc: t("pdfToWordDownload.tool2Desc"),
                        href: "/compress-pdf",
                        color: "bg-blue-600",
                      },
                      {
                        name: t("pdfToWordDownload.tool3Name"),
                        desc: t("pdfToWordDownload.tool3Desc"),
                        href: "/merge-pdf",
                        color: "bg-slate-600",
                      },
                    ].map((tool) => (
                      <a
                        key={tool.name}
                        href={tool.href}
                        className="group p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300 bg-white"
                      >
                        <div
                          className={`w-10 h-10 ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}
                        >
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                          {t("pdfToWordDownload.tryNow")}
                          <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Conversion Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {t("pdfToWordDownload.conversionSummary")}
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">
                      {t("pdfToWordDownload.filesConverted")}
                    </span>
                    <span className="font-display font-semibold text-slate-900">{fileCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">
                      {t("pdfToWordDownload.outputFormat")}
                    </span>
                    <span className="font-display font-semibold text-blue-600">DOCX</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">
                      {t("pdfToWordDownload.editCapability")}
                    </span>
                    <span className="font-display font-semibold text-slate-900">
                      {t("pdfToWordDownload.editCapabilityValue")}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-sm text-slate-600">{t("pdfToWordDownload.status")}</span>
                      <span className="inline-flex items-center gap-1.5 text-green-600 font-medium text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {t("pdfToWordDownload.statusComplete")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Expiry Timer */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Timer className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      {t("pdfToWordDownload.downloadWindow")}
                    </h3>
                    <p className="font-body text-xs text-slate-500">{t("pdfToWordDownload.autoDeletePrivacy")}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-body text-xs text-slate-600">{t("pdfToWordDownload.timeRemaining")}</span>
                    {/* FIX #7: Guarded by mounted — prevents hydration mismatch */}
                    <span className="font-display font-semibold text-amber-600 text-sm">
                      {mounted ? formatTime(countdown) : "60:00"}
                    </span>
                  </div>
                  <div className="bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    {/* FIX #7: Also guard width calculation */}
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-600 h-full transition-all duration-1000"
                      style={{ width: mounted ? `${(countdown / 3600) * 100}%` : "100%" }}
                    ></div>
                  </div>
                </div>
                <p className="font-body text-xs text-slate-500 mt-3 leading-relaxed">
                  {t("pdfToWordDownload.autoDeleteNotice")}
                </p>
              </div>

              {/* Security Info */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      {t("pdfToWordDownload.privacyTitle")}
                    </h3>
                    <p className="font-body text-xs text-slate-500">{t("pdfToWordDownload.privacySubtitle")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    t("pdfToWordDownload.security1"),
                    t("pdfToWordDownload.security2"),
                    t("pdfToWordDownload.security3"),
                    t("pdfToWordDownload.security4"),
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      <span className="font-body text-xs text-slate-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Ad */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body">Advertisement</p>
                <AdSenseUnit adSlot="7489539676" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}