import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import {
  Download,
  Minimize2,
  CheckCircle,
  Share2,
  RefreshCw,
  Shield,
  Zap,
  Copy,
  Sparkles,
  ArrowRight,
  Lock,
  Timer,
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

export default function DownloadCompressImage() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { jobId } = router.query
  const [compressResult, setCompressResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3600)
  const [mounted, setMounted] = useState(false)

  // ✅ routerRef prevents infinite re-render loop.
  // useLocalizedRouter() returns a new object every render, so using it
  // directly in useEffect deps causes: effect → router change → effect → loop.
  const routerRef = useRef(router)
  useEffect(() => {
    routerRef.current = router
  })

  useEffect(() => {
    setMounted(true)
    const result = sessionStorage.getItem("compressResult")
    if (result) {
      try {
        setCompressResult(JSON.parse(result))
        setTimeout(() => setShowSuccess(true), 100)
      } catch (e) {
        console.error("Failed to parse compress result:", e)
      }
    } else if (!jobId) {
      routerRef.current.push("/compress-image")
    }
  }, [jobId]) // ✅ Only re-run if 'jobId' query param changes

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

  // ✅ Consistent getApiUrl helper — same logic as preview.js
  function getApiUrl() {
    if (typeof window === "undefined") {
      return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
    }
    const { hostname, protocol } = window.location
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
    }
    return process.env.NEXT_PUBLIC_API_URL || `${protocol}//${hostname}`
  }

  const handleDownload = async () => {
    if (!jobId) return
    setDownloading(true)

    try {
      const API_URL = getApiUrl()
      const downloadUrl = `${API_URL}/api/download-compressed/${jobId}`
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error("Download failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      // ✅ FIXED: fileCount was referenced before being defined — moved below
      const contentDisposition = response.headers.get("content-disposition")
      let filename = fileCount > 1 ? `compressed-images-${jobId}.zip` : `compressed-image.jpg`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match && match[1]) filename = match[1].replace(/['"]/g, "")
      }

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setDownloadComplete(true)
      // ✅ Clear window.__compressFiles after successful download (cleanup)
      if (typeof window !== "undefined") {
        window.__compressFiles = null
      }
      setTimeout(() => setDownloadComplete(false), 3000)
    } catch (error) {
      console.error("Download error:", error)
      alert(t("compressImage.downloadErrorFailed") || "Failed to download file. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  const handleCompressMore = () => {
    // ✅ Clear all state — sessionStorage, window global, and navigate back
    sessionStorage.removeItem("uploadedCompressImages")
    sessionStorage.removeItem("compressResult")
    if (typeof window !== "undefined") {
      window.__compressFiles = null
    }
    router.push("/compress-image")
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
          title: "My Compressed Images",
          text: "Check out my compressed images",
          url: window.location.href,
        })
      } catch (err) {
        console.log("Share failed:", err)
      }
    } else {
      handleCopyLink()
    }
  }

  if (!compressResult && !jobId) {
    return (
      <Layout>
        <SEOHead
          title="Download Compressed Images | SmallPDF.us"
          description="Download your compressed image files."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("compressImage.downloadLoadingFiles")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  // ✅ All derived values defined ONCE here — used everywhere below safely
  const fileCount = compressResult?.fileCount || 1
  const originalSize = compressResult?.totalSize || 0
  const compressedSize = compressResult?.compressedSize || compressResult?.totalCompressedSize || 0
  const savedPercentage =
    originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : compressResult?.savedPercentage || 0
  const outputExt = compressResult?.files?.[0]?.filename?.split(".").pop() || "jpg"

  return (
    <Layout title={t("compressImage.downloadTitle")} description={t("compressImage.downloadDescription")}>
      <SEOHead
        title="Download Compressed Images | SmallPDF.us"
        description="Download your compressed image files."
        noIndex={true}
      />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        @keyframes checkmark-draw {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes fade-up {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-checkmark {
          animation: checkmark-draw 0.4s ease-out 0.3s forwards;
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
        }
        .animate-fade-up { animation: fade-up 0.5s ease-out forwards; }
        .animate-fade-up-delay-1 { animation: fade-up 0.5s ease-out 0.1s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.5s ease-out 0.2s forwards; opacity: 0; }
        .btn-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* Success Header */}
      <div className="relative overflow-hidden bg-purple-600">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
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
                  {t("compressImage.downloadSuccessTitle")}
                </h1>
                <p className="font-body text-purple-100 text-sm">
                  {t("compressImage.downloadSuccessDesc")
                    .replace("{count}", fileCount)
                    .replace("{plural}", fileCount > 1 ? "s" : "")
                    .replace("{saved}", savedPercentage)}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${mounted ? "animate-fade-up-delay-2" : "opacity-0"}`}>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-white">
                <Timer className="w-3.5 h-3.5" />
                <span>{formatTime(countdown)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-white">
                <Lock className="w-3.5 h-3.5" />
                <span>{t("compressImage.downloadSecure")}</span>
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
                    <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <Minimize2 className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-white truncate">
                        {fileCount > 1 ? `compressed-images.zip` : `compressed-image.${outputExt}`}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                          {t("compressImage.downloadReadyBadge")}
                        </span>
                        <span className="text-slate-400 text-sm">
                          {t("compressImage.downloadFileCount")
                            .replace("{count}", fileCount)
                            .replace("{plural}", fileCount > 1 ? "s" : "")}
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
                    className="group relative w-full bg-purple-600 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:bg-purple-700 overflow-hidden"
                  >
                    <div className="absolute inset-0 btn-shimmer pointer-events-none"></div>
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="relative">{t("compressImage.downloadingBtn")}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="relative">{t("compressImage.downloadedBtn")}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="relative">
                          {t("compressImage.downloadBtn").replace("{label}", fileCount > 1 ? "Files" : "Image")}
                        </span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{fileCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("compressImage.downloadImages")}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-green-600">
                        {savedPercentage}%
                      </div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("compressImage.downloadSaved")}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                        {(compressedSize / 1024 / 1024).toFixed(1)}MB
                      </div>
                      <div className="font-body text-xs text-slate-500 mt-1">
                        {t("compressImage.downloadNewSize")}
                      </div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleCompressMore}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t("compressImage.downloadCompressMore")}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-purple-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    icon: Sparkles,
                    title: t("compressImage.downloadFeature1Title"),
                    desc: t("compressImage.downloadFeature1Desc"),
                    color: "bg-purple-600",
                  },
                  {
                    icon: Zap,
                    title: t("compressImage.downloadFeature2Title"),
                    desc: t("compressImage.downloadFeature2Desc"),
                    color: "bg-amber-500",
                  },
                  {
                    icon: Shield,
                    title: t("compressImage.downloadFeature3Title"),
                    desc: t("compressImage.downloadFeature3Desc"),
                    color: "bg-slate-600",
                  },
                  {
                    icon: Minimize2,
                    title: t("compressImage.downloadFeature4Title"),
                    desc: t("compressImage.downloadFeature4Desc").replace("{saved}", savedPercentage),
                    color: "bg-green-600",
                  },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-200">
                    <div
                      className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-3 shadow-lg`}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-display font-semibold text-slate-900 mb-1">{item.title}</h3>
                    <p className="font-body text-sm text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {t("compressImage.downloadSummaryTitle")}
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">
                      {t("compressImage.downloadSummaryImages")}
                    </span>
                    <span className="font-display font-semibold text-slate-900">{fileCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">
                      {t("compressImage.downloadSummaryOriginal")}
                    </span>
                    <span className="font-display font-semibold text-slate-900">
                      {(originalSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">
                      {t("compressImage.downloadSummaryCompressed")}
                    </span>
                    <span className="font-display font-semibold text-purple-600">
                      {(compressedSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-sm text-slate-600">
                        {t("compressImage.downloadSummarySpaceSaved")}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-green-600 font-bold text-sm">
                        {savedPercentage}%
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
                      {t("compressImage.downloadExpiryTitle")}
                    </h3>
                    <p className="font-body text-xs text-slate-500">
                      {t("compressImage.downloadExpirySubtitle")}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-body text-xs text-slate-600">
                      {t("compressImage.downloadTimeRemaining")}
                    </span>
                    <span className="font-display font-bold text-slate-900">{formatTime(countdown)}</span>
                  </div>
                  <div className="bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all duration-1000"
                      style={{ width: `${(countdown / 3600) * 100}%` }}
                    />
                  </div>
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