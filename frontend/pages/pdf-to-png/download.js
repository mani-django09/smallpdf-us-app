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
  ImageIcon,
  Timer,
  AlertCircle,
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

export default function DownloadPDFtoPNG() {
  const router = useLocalizedRouter()
  const { jobId } = router.query
  const { t, locale } = useTranslations()
  const [downloadData, setDownloadData] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
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
    const stored = sessionStorage.getItem("pdfToPngDownload")
    if (stored) {
      setDownloadData(JSON.parse(stored))
      setTimeout(() => setShowSuccess(true), 100)
    } else if (!jobId) {
      routerRef.current.push("/pdf-to-png")
    }
  }, [jobId]) // ✅ Only re-run if 'jobId' query param changes, not on every router render

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
    if (!downloadData?.jobId) return
    setDownloading(true)
    setDownloadError("")

    // Resolve pageCount here — downloadData is guaranteed loaded by this point
    const pc = downloadData?.totalSelected || downloadData?.pageCount || 1

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
      const downloadUrl = `${apiUrl}/api/download/${downloadData.jobId}`

      const response = await fetch(downloadUrl)

      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("content-disposition")
      let filename = pc > 1 ? "converted-images.zip" : "converted-image.png"

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
      setDownloadError(t('pdfToPng.downloadErrorFailed') || "Failed to download file. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("pdfToPngResult")
    sessionStorage.removeItem("pdfToPngDownload")
    router.push("/pdf-to-png")
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('pdfToPng.shareTitle') || "My PNG Images",
          text: t('pdfToPng.shareText') || "Check out my converted PNG images",
          url: window.location.href,
        })
      } catch (err) {
        // User cancelled or share not supported — fall through to copy
        handleCopyLink()
      }
    } else {
      handleCopyLink()
    }
  }

  if (!downloadData && !jobId) {
    return (
      <Layout>
        <SEOHead title={t('pdfToPng.downloadPageTitle') || "Download PNG Images | SmallPDF.us"} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pdfToPng.downloadLoadingImages')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const pageCount = downloadData?.totalSelected || downloadData?.pageCount || 1

  return (
    <Layout>
      {/* noIndex — transient post-conversion download page, no static indexable content */}
      <SEOHead
        title={t('pdfToPng.downloadPageTitle') || "Download PNG Images | SmallPDF.us"}
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
          .animate-checkmark { animation: checkmark-draw 0.4s ease-out 0.3s forwards; stroke-dasharray: 24; stroke-dashoffset: 24; }
          .animate-fade-up { animation: fade-up 0.5s ease-out forwards; }
          .animate-fade-up-delay-1 { animation: fade-up 0.5s ease-out 0.1s forwards; opacity: 0; }
          .animate-fade-up-delay-2 { animation: fade-up 0.5s ease-out 0.2s forwards; opacity: 0; }
          .btn-shimmer {
            background: linear-gradient(90deg, #2563eb 0%, #4f46e5 50%, #2563eb 100%);
            background-size: 200% 100%;
            animation: shimmer 2s infinite;
          }
          .glass-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
          }
        `}</style>

        {/* Header Ad */}
        <div className="bg-slate-50 px-4 pt-6">
          <div className="max-w-5xl mx-auto">
            <AdSenseUnit adSlot="8004544994" />
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            ></div>
          </div>

          <div className="relative max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  {showSuccess ? (
                    <CheckCircle className="w-7 h-7 text-white" />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-white" />
                  )}
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-white mb-1">
                    {showSuccess ? t('pdfToPng.downloadSuccess') : t('pdfToPng.downloadYourImages')}
                  </h1>
                  <p className="font-body text-sm text-white/80">
                    {`${pageCount} ${pageCount === 1 ? t('pdfToPng.downloadImagesReadyCountSingular') : t('pdfToPng.downloadImagesReadyCount')}`}
                  </p>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2.5">
                <Timer className="w-4 h-4 text-white/80" />
                <div className="text-right">
                  <div className="text-xs text-white/60 font-medium">{t('pdfToPng.downloadFilesExpire')}</div>
                  <div className="text-sm text-white font-bold font-mono">{formatTime(countdown)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen py-10 px-4">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Download Card */}
            <div className="lg:col-span-8 space-y-6">
              {/* Download Card */}
              <div className="glass-card rounded-2xl border border-blue-200/60 overflow-hidden shadow-xl">
                <div className="p-8">
                  {showSuccess && (
                    <div className="mb-8 text-center animate-fade-up">
                      <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                          <path className="animate-checkmark" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">
                        {t('pdfToPng.downloadSuccessTitle')}
                      </h2>
                      <p className="font-body text-slate-600">
                        {`${t('pdfToPng.downloadSuccessDesc')} ${pageCount} ${pageCount === 1 ? t('pdfToPng.downloadSuccessDescSuffixSingular') : t('pdfToPng.downloadSuccessDescSuffix')}`}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Download Error */}
                    {downloadError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-body text-sm text-red-700">{downloadError}</p>
                          <button
                            onClick={() => setDownloadError("")}
                            className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
                          >
                            {t('pdfToPng.dismiss') || "Dismiss"}
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handleDownload}
                      disabled={downloading || downloadComplete}
                      className={`w-full py-4 px-6 rounded-xl font-display font-bold text-base text-white transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-3 ${
                        downloadComplete
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : downloading
                          ? "bg-slate-400 cursor-not-allowed"
                          : "btn-shimmer hover:scale-[1.02]"
                      }`}
                    >
                      {downloading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>{t('pdfToPng.downloadPreparing')}</span>
                        </>
                      ) : downloadComplete ? (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          <span>{t('pdfToPng.downloadedSuccess')}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>
                            {pageCount > 1 ? t('pdfToPng.downloadButtonAll') : t('pdfToPng.downloadButtonSingle')}
                          </span>
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-slate-500 font-body">
                      {pageCount > 1
                        ? t('pdfToPng.downloadZipNote')
                        : t('pdfToPng.downloadSingleNote')
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleConvertAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t('pdfToPng.downloadConvertAnother')}</span>
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
                      {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-5 rounded-xl border border-blue-200/60">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mb-3 shadow-lg">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{t('pdfToPng.downloadCrystalClear')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('pdfToPng.downloadCrystalClearDesc')}</p>
                </div>

                <div className="glass-card p-5 rounded-xl border border-blue-200/60">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center mb-3 shadow-lg">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{t('pdfToPng.downloadInstantReady')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('pdfToPng.downloadInstantReadyDesc')}</p>
                </div>

                <div className="glass-card p-5 rounded-xl border border-blue-200/60">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center mb-3 shadow-lg">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{t('pdfToPng.downloadSecurePrivate')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('pdfToPng.downloadSecureDesc')}</p>
                </div>

                <div className="glass-card p-5 rounded-xl border border-blue-200/60">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center mb-3 shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{t('pdfToPng.downloadTransparency')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('pdfToPng.downloadTransparencyDesc')}</p>
                </div>
              </div>

              {/* More Tools */}
              <div className="glass-card rounded-2xl border border-blue-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-blue-50/50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t('pdfToPng.downloadMoreTools')}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        name: t('pdfToPng.downloadPngToPdf'),
                        desc: t('pdfToPng.downloadPngToPdfDesc'),
                        href: "/png-to-pdf",
                        color: "from-blue-500 to-indigo-600",
                      },
                      {
                        name: t('pdfToPng.downloadMergePdf'),
                        desc: t('pdfToPng.downloadMergePdfDesc'),
                        href: "/merge-pdf",
                        color: "from-indigo-500 to-purple-600",
                      },
                      {
                        name: t('pdfToPng.downloadCompressPdf'),
                        desc: t('pdfToPng.downloadCompressPdfDesc'),
                        href: "/compress-pdf",
                        color: "from-cyan-500 to-blue-600",
                      },
                    ].map((tool) => (
                      // router.href() translates EN path → correct localized URL
                      <a
                        key={tool.name}
                        href={router.href(tool.href)}
                        className="group p-4 rounded-xl border border-blue-200/80 hover:border-blue-300 hover:shadow-lg transition-all duration-300 bg-white"
                      >
                        <div
                          className={`w-10 h-10 bg-gradient-to-br ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}
                        >
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                          {t('pdfToPng.downloadTryNow')}
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
              <div className="glass-card rounded-2xl border border-blue-200/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-blue-50/50">
                  <h3 className="font-display text-base font-semibold text-slate-900">{t('pdfToPng.downloadSummaryTitle')}</h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t('pdfToPng.downloadImagesCreated')}</span>
                    <span className="font-display font-semibold text-slate-900">{pageCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t('pdfToPng.downloadOutputFormat')}</span>
                    <span className="font-display font-semibold text-blue-600">PNG</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t('pdfToPng.downloadResolution')}</span>
                    <span className="font-display font-semibold text-slate-900">150 DPI</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t('pdfToPng.downloadQuality')}</span>
                    <span className="font-display font-semibold text-emerald-600">{t('pdfToPng.downloadQualityValue')}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-sm text-slate-600">{t('pdfToPng.downloadDownloadLabel')}</span>
                      <span className="font-display font-semibold text-slate-900">
                        {pageCount > 1 ? t('pdfToPng.downloadZipArchive') : t('pdfToPng.downloadSinglePng')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="glass-card rounded-2xl border border-blue-200/60 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-slate-900">{t('pdfToPng.downloadPrivacyTitle')}</h3>
                </div>
                <p className="font-body text-sm text-slate-600 leading-relaxed">
                  {t('pdfToPng.downloadPrivacyDesc')}
                </p>
              </div>

              {/* Sidebar Ad */}
              <div className="glass-card rounded-2xl border border-blue-200/60 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body">Advertisement</p>
                <AdSenseUnit adSlot="7489539676" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
  )
}