import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import UpgradeUpsell from "../../components/UpgradeUpsell"
import EmailCapture from "../../components/EmailCapture"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
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
  Presentation,
  Layers,
  Image,
  Printer,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "../../context/AuthContext"
import { useIsIndia } from "../../hooks/useIsIndia"
import { printBlob, printFile, filenameFromDisposition } from "../../lib/fileActions"
import AdSenseUnit from "../../components/AdSenseUnit"
import AdLabel from "../../components/AdLabel"


export default function DownloadPptToPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { jobId } = router.query
  const [convertResult, setConvertResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3600)
  const [mounted, setMounted] = useState(false)
  const [useCount, setUseCount] = useState(0)
  const [printing, setPrinting] = useState(false)
  const [downloadedBlob, setDownloadedBlob] = useState(null)

  // Upsell — auth + india detection
  const { user } = useAuth()
  const { isIndia } = useIsIndia()
  const isPaidUser = ['starter', 'pro', 'agency', 'enterprise'].includes(user?.plan)

  // FIX: Use a ref for router inside useEffect to avoid infinite re-render loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    setMounted(true)
    const result = sessionStorage.getItem("pptConvertResult")
    if (result) {
      try {
        const parsed = JSON.parse(result)
        setConvertResult(parsed)
        setTimeout(() => setShowSuccess(true), 100)
      } catch (err) {
        console.error("Error parsing result:", err)
        routerRef.current.push("/ppt-to-pdf")
      }
    } else if (!jobId) {
      routerRef.current.push("/ppt-to-pdf")
    }
  }, [jobId]) // Only re-run if jobId query param changes

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
    if (!convertResult?.jobId) return
    setDownloading(true)

    try {
      function getApiUrl() {
        if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
        const { hostname, protocol } = window.location
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
        }
        return `${protocol}//${hostname}`
      }

      const apiUrl = getApiUrl()
      const downloadUrl = `${apiUrl}/api/download-ppt-pdf/${convertResult.jobId}`
      const response = await fetch(downloadUrl)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Download failed")
      }

      const blob = await response.blob()
      setDownloadedBlob(blob)  // reuse for print — backend deletes file after first serve
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      const contentDisposition = response.headers.get("content-disposition")
      let filename = convertResult.files?.[0]?.filename || "presentation.pdf"
      
      filename = filenameFromDisposition(contentDisposition, filename)

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setDownloadComplete(true)
      setTimeout(() => setDownloadComplete(false), 3000)
      // ── Track usage for inline upsell card ───────────────────────────
      if (!isPaidUser) {
        try {
          const prev = parseInt(localStorage.getItem('smpdf_use_count') || '0', 10)
          const next = prev + 1
          localStorage.setItem('smpdf_use_count', String(next))
          setUseCount(next)
        } catch {}
      }
    } catch (error) {
      console.error("Download error:", error)
      alert(`Failed to download file: ${error.message}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("uploadedPptFiles")
    sessionStorage.removeItem("pptConvertResult")
    router.push("/ppt-to-pdf")
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
          title: "My Converted PDF Document",
          text: "Check out my converted PowerPoint to PDF",
          url: window.location.href,
        })
      } catch (err) {
        console.log("Share failed:", err)
      }
    } else {
      handleCopyLink()
    }
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      if (downloadedBlob) {
        printBlob(downloadedBlob)
      } else {
        function getApiUrlForPrint() {
          if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
          const { hostname, protocol } = window.location
          if (hostname === 'localhost' || hostname === '127.0.0.1') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
          return `${protocol}//${hostname}`
        }
        await printFile(`${getApiUrlForPrint()}/api/download-ppt-pdf/${convertResult?.jobId}`)
      }
    } catch (err) {
      console.error("Print error:", err)
    } finally {
      setPrinting(false)
    }
  }

  const handleDelete = () => {
    if (!window.confirm(t("fileActions.deleteConfirm"))) return
    sessionStorage.removeItem("uploadedPptFiles")
    sessionStorage.removeItem("pptConvertResult")
    router.push("/ppt-to-pdf")
  }

  if (!convertResult && !jobId) {
    return (
      <Layout>
        <SEOHead noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-orange-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-orange-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-orange-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pptToPdf.loadingPdf')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const fileCount = convertResult?.fileCount || 1
  const files = convertResult?.files || []

  return (
    <Layout title={t('pptToPdf.downloadPageTitle')} description={t('pptToPdf.downloadPageDescription')}>
      <SEOHead title={t('pptToPdf.downloadPageTitle')} description={t('pptToPdf.downloadPageDescription')} noIndex={true} />
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
      <div className="bg-orange-50 px-4 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" size="leaderboard" />
        </div>
      </div>

      {/* Success Header */}
      <div className="relative overflow-hidden bg-slate-50 border-b border-slate-200">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, #94a3b8 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`relative flex-shrink-0 ${mounted ? "animate-fade-up" : ""}`}>
                <div className="w-14 h-14 bg-white border border-slate-200 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-900" viewBox="0 0 24 24" fill="none">
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
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {t('pptToPdf.downloadSuccessTitle')}
                </h1>
                <p className="font-body text-slate-600 text-sm">
                  {fileCount} {t('pptToPdf.downloadSuccessSubtitle')}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${mounted ? "animate-fade-up-delay-2" : "opacity-0"}`}>
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-medium text-slate-900">
                <Timer className="w-3.5 h-3.5" />
                <span>{formatTime(countdown)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-medium text-slate-900">
                <Lock className="w-3.5 h-3.5" />
                <span>{t('pptToPdf.badgeSecure')}</span>
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
                    <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-white truncate">
                        {files.length === 1 ? files[0]?.filename : `${fileCount} PDF Documents`}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                          {t('pptToPdf.readyToDownload')}
                        </span>
                        {files.length === 1 && files[0]?.fileSize && (
                          <span className="text-slate-400 text-sm">
                            {(files[0].fileSize / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Converted Files List */}
                {files.length > 0 && (
                  <div className="px-6 py-4 border-b border-orange-100 bg-orange-50/50">
                    <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('pptToPdf.convertedFilesHeading')}</h3>
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-orange-100">
                          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{file.filename}</p>
                            <p className="text-xs text-slate-500">
                              {file.originalName && `From: ${file.originalName}`}
                              {file.fileSize && ` • ${(file.fileSize / 1024).toFixed(1)} KB`}
                            </p>
                          </div>
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Actions */}
                <div className="p-6 sm:p-8">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="group relative w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-red-700 overflow-hidden"
                  >
                    <div className="absolute inset-0 btn-shimmer"></div>
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="relative">{t('pptToPdf.preparingDownload')}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="relative">{t('pptToPdf.downloadedSuccess')}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="relative">
                          {files.length > 1 ? t('pptToPdf.downloadAllZip') : t('pptToPdf.downloadPdfFile')}
                        </span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{fileCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{fileCount > 1 ? t('pptToPdf.statsFiles') : t('pptToPdf.statsFile')}</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-red-600">PDF</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('pptToPdf.statsFormat')}</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-orange-600">100%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('pptToPdf.statsPreserved')}</div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-orange-100">
                    <button
                      onClick={handleConvertAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-orange-100 hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t('pptToPdf.convertMore')}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-orange-100 hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handlePrint}
                      disabled={printing}
                      title={t("fileActions.print")}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-orange-100 hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 text-slate-700 disabled:opacity-60"
                    >
                      {printing ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Printer className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleDelete}
                      title={t("fileActions.delete")}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-red-100 hover:bg-red-200 transition-colors flex items-center justify-center gap-2 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-orange-100 hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* ── Upgrade upsell ── */}
                  <UpgradeUpsell className="mt-4" />

                  <EmailCapture className="mt-3" />
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Layers,  title: t('pptToPdf.dlFeature1Title'), desc: t('pptToPdf.dlFeature1Desc'), color: "bg-orange-600" },
                  { icon: Image,   title: t('pptToPdf.dlFeature2Title'), desc: t('pptToPdf.dlFeature2Desc'), color: "bg-red-600" },
                  { icon: Shield,  title: t('pptToPdf.dlFeature3Title'), desc: t('pptToPdf.dlFeature3Desc'), color: "bg-slate-600" },
                  { icon: Zap,     title: t('pptToPdf.dlFeature4Title'), desc: t('pptToPdf.dlFeature4Desc'), color: "bg-amber-500" },
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
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t('pptToPdf.exploreMoreTitle')}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { name: t('pptToPdf.moreTool1Name'), desc: t('pptToPdf.moreTool1Desc'), href: "/pdf-to-ppt",    color: "bg-orange-600" },
                      { name: t('pptToPdf.moreTool2Name'), desc: t('pptToPdf.moreTool2Desc'), href: "/word-to-pdf",   color: "bg-blue-600" },
                      { name: t('pptToPdf.moreTool3Name'), desc: t('pptToPdf.moreTool3Desc'), href: "/compress-pdf",  color: "bg-amber-500" },
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
                          {t('pptToPdf.tryNow')}
                          <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              {/* Mid-content Ad */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body"><AdLabel /></p>
                <AdSenseUnit adSlot="ppt-to-pdf-dl-mid" size="leaderboard" />
              </div>

            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-6">

              {/* Sidebar Ad */}
              <div className="bg-white rounded-2xl border border-orange-200 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body"><AdLabel /></p>
                <AdSenseUnit adSlot="7489539676" />
              </div>

              {/* Sidebar Ad 2 */}
              <div className="bg-white rounded-2xl border border-orange-200 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body"><AdLabel /></p>
                <AdSenseUnit adSlot="7489539676" size="rectangle2" />
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["pptToPdf"]) },
    revalidate: 86400,
  }
}
