import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
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

export default function DownloadPngToPdf() {
  const router = useLocalizedRouter()
  const { file } = router.query
  const { t, locale } = useTranslations()
  const [convertResult, setConvertResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3600)
  const [mounted, setMounted] = useState(false)
  const [downloadError, setDownloadError] = useState("")

  // ✅ FIX: routerRef prevents infinite re-render loop.
  // useLocalizedRouter() returns a new object every render, so using it
  // directly in useEffect deps causes: effect → router change → effect → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    setMounted(true)
    const result = sessionStorage.getItem("pngToPdfResult")
    if (result) {
      setConvertResult(JSON.parse(result))
    } else if (!file) {
      routerRef.current.push("/png-to-pdf")
    }
  }, [file]) // ✅ Only re-run if 'file' query param changes

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
    if (!file) return
    setDownloading(true)
    setDownloadError("")

    try {
      // 'file' is already an absolute URL (set by preview.js getApiUrl())
      const downloadUrl = file.startsWith('http') ? file : `${window.location.origin}${file}`
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error("Download failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      // Use a locale-neutral filename — no hardcoded Portuguese
      link.download = convertResult?.filename || `converted-images-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setDownloadComplete(true)
      setTimeout(() => setDownloadComplete(false), 3000)
    } catch (error) {
      console.error("Download error:", error)
      // Show inline — no alert(), uses t(), doesn't block the UI
      setDownloadError(t('pngToPdf.downloadErrorFailed') || "Failed to download file. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("uploadedPngFiles")
    sessionStorage.removeItem("pdfSettings")
    sessionStorage.removeItem("pngToPdfResult")
    router.push("/png-to-pdf")
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
          title: t('pngToPdf.shareTitle') || "My PDF Document",
          text: t('pngToPdf.shareText') || "Check out my PDF document",
          url: window.location.href,
        })
      } catch (err) {
        // Share cancelled or failed — not an error worth surfacing
      }
    } else {
      handleCopyLink()
    }
  }

  if (!convertResult && !file) {
    return (
      <Layout>
        <SEOHead title={t('pngToPdf.downloadPageTitle') || "Download PDF | SmallPDF.us"} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-slate-700 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pngToPdf.downloadLoadingFile')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const pageCount = convertResult?.pageCount || 1

  return (
    <Layout title="Download PDF - SmallPDF.us" description="Download your PDF document">
      {/* noIndex — transient post-conversion page, no static content for search engines */}
      <SEOHead title={t('pngToPdf.downloadPageTitle') || "Download PDF | SmallPDF.us"} noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
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
      <div className="bg-slate-50 px-4 sm:px-6 lg:px-8 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* Success Header */}
      <div className="relative overflow-hidden bg-slate-800">
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
              <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
                  <path
                    d="M7 12l3 3 7-7"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-checkmark"
                  />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                  {t('pngToPdf.downloadSuccessTitle') || "PDF Created Successfully!"}
                </h1>
                <p className="font-body text-slate-300 text-sm mt-0.5">
                  {pageCount} {t('pngToPdf.downloadPageGenerated') || "page(s) generated from your images"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2">
                <Timer className="w-4 h-4 text-amber-400" />
                <span className="font-display text-sm font-semibold text-white">{formatTime(countdown)}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2">
                <Lock className="w-4 h-4 text-green-400" />
                <span className="font-body text-sm text-slate-200">{t('pngToPdf.downloadSecure') || "Secure"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Main */}
            <div className="lg:col-span-8 space-y-6">
              {/* Download Card */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-fade-up">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-slate-300" />
                      <div>
                        {/* Use result filename or a locale-neutral fallback — no Portuguese hardcoded */}
                        <p className="font-display font-semibold text-white text-sm">
                          {convertResult?.filename || "converted-images.pdf"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                            {t('pngToPdf.downloadReadyLabel') || "Ready to Download"}
                          </span>
                          <span className="text-slate-500 text-xs">·</span>
                          <span className="text-slate-400 text-xs font-body">{pageCount} {t('pngToPdf.downloadPages') || "pages"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {/* Inline download error — replaces alert() */}
                  {downloadError && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                      <span className="text-red-600 font-bold flex-shrink-0">⚠</span>
                      <div className="flex-1">
                        <p className="font-body text-sm text-red-700">{downloadError}</p>
                        <button
                          onClick={() => setDownloadError("")}
                          className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
                        >
                          {t('pngToPdf.dismiss') || "Dismiss"}
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Main Download Button */}
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="relative w-full py-4 px-6 rounded-xl font-display font-bold text-base transition-all duration-200 overflow-hidden bg-slate-800 hover:bg-slate-900 text-white shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-3"
                  >
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{t('pngToPdf.downloadDownloading') || "Downloading..."}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span>{t('pngToPdf.downloadComplete') || "Downloaded!"}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>{t('pngToPdf.downloadButton') || "Download PDF"}</span>
                      </>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{pageCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('pngToPdf.downloadPages') || "Pages"}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-700">100%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('pngToPdf.downloadQuality') || "Quality"}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">PDF</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('pngToPdf.downloadFormat') || "Format"}</div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleConvertAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t('pngToPdf.downloadConvertMore')}</span>
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
                      {copied ? <CheckCircle className="w-4 h-4 text-slate-700" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Sparkles, title: t('pngToPdf.downloadProfessional'), desc: t('pngToPdf.downloadProfessionalDesc'), color: "bg-slate-700" },
                  { icon: Zap, title: t('pngToPdf.downloadFast'), desc: t('pngToPdf.downloadFastDesc'), color: "bg-slate-600" },
                  { icon: Shield, title: t('pngToPdf.downloadSecurePrivate'), desc: t('pngToPdf.downloadSecureDesc'), color: "bg-slate-800" },
                  { icon: FileText, title: t('pngToPdf.downloadUniversal'), desc: t('pngToPdf.downloadUniversalDesc'), color: "bg-slate-700" },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-200">
                    <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-3 shadow-lg`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-display font-semibold text-slate-900 mb-1">{item.title}</h3>
                    <p className="font-body text-sm text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* More Tools */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t('pngToPdf.downloadMoreTools')}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { name: t('pngToPdf.downloadMergePdf'), desc: t('pngToPdf.downloadMergePdfDesc'), href: "/merge-pdf", color: "bg-slate-800" },
                      { name: t('pngToPdf.downloadWebpToPng'), desc: t('pngToPdf.downloadWebpToPngDesc'), href: "/webp-to-png", color: "bg-teal-600" },
                      { name: t('pngToPdf.downloadPdfToPng'), desc: t('pngToPdf.downloadPdfToPngDesc'), href: "/pdf-to-png", color: "bg-slate-700" },
                    ].map((tool) => (
                      // router.href() translates the EN path to the correct localized URL
                      <a
                        key={tool.name}
                        href={router.href(tool.href)}
                        className="group p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300 bg-white"
                      >
                        <div className={`w-10 h-10 ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                          {t('pngToPdf.downloadTryNow')}
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
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-display text-base font-semibold text-slate-900">{t('pngToPdf.downloadSummaryTitle')}</h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t('pngToPdf.downloadPagesCreated')}</span>
                    <span className="font-display font-semibold text-slate-900">{pageCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t('pngToPdf.downloadOutputFormat')}</span>
                    <span className="font-display font-semibold text-slate-700">PDF</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t('pngToPdf.downloadQualityLabel')}</span>
                    <span className="font-display font-semibold text-slate-900">{t('pngToPdf.downloadOriginal')}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-sm text-slate-600">{t('pngToPdf.downloadStatus')}</span>
                      <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {t('pngToPdf.downloadComplete')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Expiry */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Timer className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">{t('pngToPdf.downloadExpiry')}</h3>
                    <p className="font-body text-xs text-slate-500">{t('pngToPdf.downloadExpiryDesc')}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-body text-xs text-slate-600">{t('pngToPdf.downloadTimeRemaining')}</span>
                    <span className="font-display font-semibold text-slate-900">{formatTime(countdown)}</span>
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