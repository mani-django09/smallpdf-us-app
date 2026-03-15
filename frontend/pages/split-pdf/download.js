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
  Scissors,
  Layers,
  FileOutput,
  FilePlus,
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

export default function DownloadSplitPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { jobId } = router.query
  const [splitResult, setSplitResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3600)
  const [mounted, setMounted] = useState(false)

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    setMounted(true)
    const result = sessionStorage.getItem("splitPdfResult")
    if (result) {
      setSplitResult(JSON.parse(result))
    } else if (!jobId) {
      routerRef.current.push("/split-pdf")
    }
  }, [jobId])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [countdown])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleDownload = async () => {
    if (!jobId) return
    setDownloading(true)

    try {
      const API_URL =
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
          ? `${window.location.protocol}//${window.location.hostname}`
          : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"

      const downloadUrl = `${API_URL}/api/download-split/${jobId}`
      const response = await fetch(downloadUrl)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Download failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      const contentDisposition = response.headers.get("content-disposition")
      let filename = `split-document-${jobId}.pdf`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "")
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
      alert(t("splitPdf.errorDownloadFailed").replace("{message}", error.message))
    } finally {
      setDownloading(false)
    }
  }

  const handleSplitAnother = () => {
    sessionStorage.removeItem("splitPdfFile")
    sessionStorage.removeItem("splitPdfResult")
    router.push("/split-pdf")
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
          title: t("splitPdf.shareTitle"),
          text: t("splitPdf.shareText"),
          url: window.location.href,
        })
      } catch (err) {
        console.log("Share cancelled:", err)
      }
    } else {
      handleCopyLink()
    }
  }

  if (!splitResult && !jobId) {
    return (
      <>
        <SEOHead noIndex={true} />
        <Layout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("splitPdf.downloadPreparingText")}</p>
          </div>
        </div>
      </Layout>
      </>
    )
  }

  const selectedPages = splitResult?.selectedPages || []
  const totalPages = splitResult?.totalPages || 0

  return (
    <>
      <SEOHead noIndex={true} />
      <Layout
        title={t("splitPdf.downloadPageTitle")}
        description={t("splitPdf.downloadPageDescription")}
      >
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
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700">
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
                  {t("splitPdf.downloadSuccessTitle")}
                </h1>
                <p className="font-body text-purple-100 text-sm">
                  {t("splitPdf.downloadSuccessDesc")
                    .replace("{count}", selectedPages.length)
                    .replace("{plural}", selectedPages.length > 1 ? "s" : "")}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${mounted ? "animate-fade-up-delay-2" : "opacity-0"}`}>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-white">
                <Timer className="w-3.5 h-3.5" />
                <span>{t("splitPdf.downloadExpiresIn").replace("{time}", formatTime(countdown))}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-white">
                <Lock className="w-3.5 h-3.5" />
                <span>{t("splitPdf.downloadEncrypted")}</span>
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
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <Scissors className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-white truncate">
                        {splitResult?.originalName?.replace('.pdf', '') || 'document'}-split.pdf
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                          {t("splitPdf.downloadReadyBadge")}
                        </span>
                        <span className="text-slate-400 text-sm">
                          {selectedPages.length} {t("splitPdf.fileInfoPages")}
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
                    className="group relative w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-purple-800 overflow-hidden"
                  >
                    <div className="absolute inset-0 btn-shimmer"></div>
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="relative">{t("splitPdf.downloadingButton")}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="relative">{t("splitPdf.downloadedButton")}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce-gentle" />
                        <span className="relative">{t("splitPdf.downloadButton")}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-purple-600">{selectedPages.length}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("splitPdf.downloadPagesExtracted")}</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{totalPages}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("splitPdf.downloadOriginalPages")}</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">.PDF</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("splitPdf.downloadFormat")}</div>
                    </div>
                  </div>

                  {/* Extracted Pages */}
                  {selectedPages.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <p className="font-display text-sm font-semibold text-slate-700 mb-2">{t("splitPdf.downloadExtractedPagesLabel")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPages.map((pageNum) => (
                          <span
                            key={pageNum}
                            className="inline-flex items-center px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full"
                          >
                            {pageNum}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleSplitAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t("splitPdf.downloadSplitAnother")}</span>
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
                <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">{t("splitPdf.downloadWhatCanYouDo")}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      icon: FileOutput,
                      title: t("splitPdf.downloadAction1Title"),
                      desc: t("splitPdf.downloadAction1Desc"),
                      color: "bg-purple-600",
                    },
                    { 
                      icon: Layers, 
                      title: t("splitPdf.downloadAction2Title"),
                      desc: t("splitPdf.downloadAction2Desc"),
                      color: "bg-slate-600" 
                    },
                    {
                      icon: FilePlus,
                      title: t("splitPdf.downloadAction3Title"),
                      desc: t("splitPdf.downloadAction3Desc"),
                      color: "bg-amber-500",
                    },
                    {
                      icon: FileText,
                      title: t("splitPdf.downloadAction4Title"),
                      desc: t("splitPdf.downloadAction4Desc"),
                      color: "bg-slate-800",
                    },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
                      <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-3 shadow-md`}>
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
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t("splitPdf.downloadMoreToolsTitle")}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { name: t("splitPdf.downloadTool1"), desc: t("splitPdf.downloadTool1Desc"), href: "/merge-pdf", color: "bg-purple-600" },
                      { name: t("splitPdf.downloadTool2"), desc: t("splitPdf.downloadTool2Desc"), href: "/compress-pdf", color: "bg-slate-600" },
                      { name: t("splitPdf.downloadTool3"), desc: t("splitPdf.downloadTool3Desc"), href: "/pdf-to-word", color: "bg-slate-800" },
                    ].map((tool) => (
                      <a
                        key={tool.name}
                        href={tool.href}
                        className="group p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300 bg-white"
                      >
                        <div className={`w-10 h-10 ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-purple-600 transition-colors">
                          {t("splitPdf.downloadTryNow")}
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
              {/* Split Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-display text-base font-semibold text-slate-900">{t("splitPdf.downloadSummaryTitle")}</h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t("splitPdf.downloadSummaryPagesExtracted")}</span>
                    <span className="font-display font-semibold text-purple-600">{selectedPages.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t("splitPdf.downloadSummaryOriginalDoc")}</span>
                    <span className="font-display font-semibold text-slate-900">{totalPages} {t("splitPdf.fileInfoPages")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t("splitPdf.downloadSummaryOutputFormat")}</span>
                    <span className="font-display font-semibold text-slate-900">PDF</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-sm text-slate-600">{t("splitPdf.downloadSummaryStatus")}</span>
                      <span className="inline-flex items-center gap-1.5 text-green-600 font-medium text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {t("splitPdf.downloadSummaryComplete")}
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
                    <h3 className="font-display text-sm font-semibold text-slate-900">{t("splitPdf.downloadWindowTitle")}</h3>
                    <p className="font-body text-xs text-slate-500">{t("splitPdf.downloadWindowSubtitle")}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-body text-xs text-slate-600">{t("splitPdf.downloadTimeRemaining")}</span>
                    <span className="font-display font-semibold text-amber-600 text-sm">{formatTime(countdown)}</span>
                  </div>
                  <div className="bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-600 h-full transition-all duration-1000"
                      style={{ width: `${(countdown / 3600) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <p className="font-body text-xs text-slate-500 mt-3 leading-relaxed">
                  {t("splitPdf.downloadPrivacyNote")}
                </p>
              </div>

              {/* Security Info */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">{t("splitPdf.downloadSecurityTitle")}</h3>
                    <p className="font-body text-xs text-slate-500">{t("splitPdf.downloadSecuritySubtitle")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    t("splitPdf.downloadSecurity1"),
                    t("splitPdf.downloadSecurity2"),
                    t("splitPdf.downloadSecurity3"),
                    t("splitPdf.downloadSecurity4"),
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
    </>
  )
}