import { useState, useEffect } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import AdUnit from "../../components/AdUnit"
import {
  Download,
  FileText,
  CheckCircle,
  Share2,
  RefreshCw,
  Shield,
  Zap,
  Copy,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Lock,
  Timer,
} from "lucide-react"

// Inline translations for strings not yet in JSON files
const INLINE_T = {
  defaultFilename: {
    en: "converted-images.pdf", ja: "変換済み画像.pdf", de: "konvertierte-bilder.pdf",
    fr: "images-converties.pdf", es: "imagenes-convertidas.pdf", it: "immagini-convertite.pdf",
    id: "gambar-dikonversi.pdf", pt: "imagens-convertidas.pdf",
  },
}

export default function DownloadJpgToPdf() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()

  // Helper: pick the right locale from INLINE_T, fall back to English
  const ti = (key) => INLINE_T[key]?.[locale] ?? INLINE_T[key]?.en ?? key
  const { jobId } = router.query
  const [convertResult, setConvertResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3600)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const result = sessionStorage.getItem("jpgConvertResult")
    if (result) {
      try {
        const parsed = JSON.parse(result)
        console.log("Convert result loaded:", parsed)
        setConvertResult(parsed)
        setTimeout(() => setShowSuccess(true), 100)
      } catch (err) {
        console.error("Error parsing result:", err)
        router.push("/jpg-to-pdf")
      }
    } else if (!jobId) {
      console.log("No result found, redirecting...")
      router.push("/jpg-to-pdf")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  if (!convertResult?.jobId) return
  setDownloading(true)

  try {
    // Use the correct endpoint for JPG to PDF downloads - works in dev and prod
    const { hostname, protocol } = window.location
    const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
      ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
      : `${protocol}//${hostname}`

    const downloadUrl = `${API_URL}/api/download-jpg-pdf/${convertResult.jobId}`
    const response = await fetch(downloadUrl)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Download failed")
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get("content-disposition")
    let filename = "converted-images.pdf"
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '')
      }
    }

    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    setDownloadComplete(true)
    setTimeout(() => setDownloadComplete(false), 3000)
  } catch (error) {
    console.error("Download error:", error)
    alert(t("jpgToPdf.download.downloadFailed").replace("{{error}}", error.message))
  } finally {
    setDownloading(false)
  }
}

  const handleConvertAnother = () => {
    sessionStorage.removeItem("uploadedJpgFiles")
    sessionStorage.removeItem("jpgConvertResult")
    router.push("/jpg-to-pdf")
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
          title: t("jpgToPdf.download.shareTitle"),
          text: t("jpgToPdf.download.shareText"),
          url: window.location.href,
        })
      } catch (err) {
        console.log("Share failed:", err)
      }
    } else {
      handleCopyLink()
    }
  }

  if (!convertResult && !jobId) {
    return (
      <Layout>
        <SEOHead
          title="Download JPG to PDF | SmallPDF.us"
          description="Download your converted PDF file."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-orange-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-orange-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-orange-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("jpgToPdf.download.loading")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const fileCount = convertResult?.fileCount || 1

  return (
    <Layout title={t("jpgToPdf.download.layoutTitle")} description={t("jpgToPdf.download.layoutDesc")}>
      <SEOHead
        title="Download JPG to PDF | SmallPDF.us"
        description="Download your converted PDF file."
        noIndex={true}
      />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Manrope', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        @keyframes checkmark-draw { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
        @keyframes fade-up { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .animate-checkmark { animation: checkmark-draw 0.4s ease-out 0.3s forwards; stroke-dasharray: 24; stroke-dashoffset: 24; }
        .animate-fade-up { animation: fade-up 0.5s ease-out forwards; }
        .animate-fade-up-delay-1 { animation: fade-up 0.5s ease-out 0.1s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.5s ease-out 0.2s forwards; opacity: 0; }
        .btn-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); background-size: 200% 100%; animation: shimmer 2s infinite; }
      `}</style>

      {/* Header Ad */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdUnit slot="8004544994" label="Header Ad" className="rounded-xl overflow-hidden" />
      </div>

      {/* Success Header */}
      <div className="relative overflow-hidden bg-orange-600">
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
                  {t("jpgToPdf.download.headerTitle")}
                </h1>
                <p className="font-body text-orange-100 text-sm">
                  {fileCount > 1 ? t("jpgToPdf.download.headerSubtitle_plural").replace("{{count}}", fileCount) : t("jpgToPdf.download.headerSubtitle_singular").replace("{{count}}", fileCount)}
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
                <span>{t("jpgToPdf.download.secure")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-orange-50 py-8 sm:py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Main Download Section */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-2xl border border-orange-200 shadow-lg overflow-hidden">
                {/* File Header */}
                <div className="bg-slate-800 px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-white truncate">
                        {ti("defaultFilename")}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-orange-500/20 text-orange-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                          {t("jpgToPdf.download.ready")}
                        </span>
                        <span className="text-slate-400 text-sm">
                          {fileCount > 1 ? t("jpgToPdf.download.imageCount_plural").replace("{{count}}", fileCount) : t("jpgToPdf.download.imageCount_singular").replace("{{count}}", fileCount)}
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
                    className="group relative w-full bg-orange-600 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:bg-orange-700 overflow-hidden"
                  >
                    <div className="absolute inset-0 btn-shimmer"></div>
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="relative">{t("jpgToPdf.download.preparingDownload")}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="relative">{t("jpgToPdf.download.downloadedSuccess")}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="relative">{t("jpgToPdf.download.downloadBtn")}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{fileCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("jpgToPdf.download.images")}</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-orange-600">100%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("jpgToPdf.download.quality")}</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">PDF</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("jpgToPdf.download.format")}</div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-orange-100">
                    <button
                      onClick={handleConvertAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-orange-100 hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t("jpgToPdf.download.convertMore")}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-orange-100 hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-orange-100 hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-orange-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Sparkles, title: t("jpgToPdf.download.feat1Title"), desc: t("jpgToPdf.download.feat1Desc"), color: "bg-orange-600" },
                  { icon: Zap, title: t("jpgToPdf.download.feat2Title"), desc: t("jpgToPdf.download.feat2Desc"), color: "bg-amber-500" },
                  { icon: Shield, title: t("jpgToPdf.download.feat3Title"), desc: t("jpgToPdf.download.feat3Desc"), color: "bg-slate-600" },
                  { icon: FileText, title: t("jpgToPdf.download.feat4Title"), desc: t("jpgToPdf.download.feat4Desc"), color: "bg-slate-800" },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-orange-200">
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

              {/* More Tools */}
              <div className="bg-white rounded-2xl border border-orange-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-orange-100 bg-orange-50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t("jpgToPdf.download.moreToolsTitle")}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        name: t("jpgToPdf.download.tool1Name"),
                        desc: t("jpgToPdf.download.tool1Desc"),
                        href: "/pdf-to-jpg",
                        color: "bg-slate-800",
                      },
                      { name: t("jpgToPdf.download.tool2Name"), desc: t("jpgToPdf.download.tool2Desc"), href: "/compress-pdf", color: "bg-orange-600" },
                      { name: t("jpgToPdf.download.tool3Name"), desc: t("jpgToPdf.download.tool3Desc"), href: "/merge-pdf", color: "bg-amber-600" },
                    ].map((tool) => (
                      <a
                        key={tool.name}
                        href={tool.href}
                        className="group p-4 rounded-xl border border-orange-200 hover:border-orange-300 hover:shadow-lg transition-all duration-300 bg-white"
                      >
                        <div
                          className={`w-10 h-10 ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}
                        >
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-orange-600 transition-colors">
                          {t("jpgToPdf.download.tryNow")}
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
              {/* Summary */}
              <div className="bg-white rounded-2xl border border-orange-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-orange-100 bg-orange-50">
                  <h3 className="font-display text-base font-semibold text-slate-900">{t("jpgToPdf.download.summaryTitle")}</h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t("jpgToPdf.download.imagesConverted")}</span>
                    <span className="font-display font-semibold text-slate-900">{fileCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t("jpgToPdf.download.outputFormat")}</span>
                    <span className="font-display font-semibold text-orange-600">PDF</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t("jpgToPdf.download.pages")}</span>
                    <span className="font-display font-semibold text-slate-900">{fileCount}</span>
                  </div>
                  <div className="pt-3 border-t border-orange-100">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-sm text-slate-600">{t("jpgToPdf.download.status")}</span>
                      <span className="inline-flex items-center gap-1.5 text-orange-600 font-medium text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {t("jpgToPdf.download.statusComplete")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Expiry */}
              <div className="bg-white rounded-2xl border border-orange-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Timer className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">{t("jpgToPdf.download.fileExpiry")}</h3>
                    <p className="font-body text-xs text-slate-500">{t("jpgToPdf.download.autoDelete")}</p>
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-body text-xs text-slate-600">{t("jpgToPdf.download.timeRemaining")}</span>
                    <span className="font-display font-semibold text-slate-900">{formatTime(countdown)}</span>
                  </div>
                  <div className="bg-orange-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-orange-600 h-full transition-all duration-1000"
                      style={{ width: `${(countdown / 3600) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Security Info */}
              <div className="bg-white rounded-2xl border border-orange-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">{t("jpgToPdf.download.privacyTitle")}</h3>
                </div>
                <ul className="space-y-2">
                  {[
                    t("jpgToPdf.download.security1"),
                    t("jpgToPdf.download.security2"),
                    t("jpgToPdf.download.security3"),
                    t("jpgToPdf.download.security4"),
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span className="font-body text-xs text-slate-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sidebar Ad */}
              <div className="bg-white rounded-2xl border border-orange-200 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body">Advertisement</p>
                <AdUnit slot="7489539676" label="Download Sidebar" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}