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
  ArrowRight,
  Lock,
  Timer,
  Minimize2,
  TrendingDown,
  Printer,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "../../context/AuthContext"
import { useIsIndia } from "../../hooks/useIsIndia"
import AdSenseUnit from "../../components/AdSenseUnit"
import { printBlob, printFile } from "../../lib/fileActions"
import AdLabel from "../../components/AdLabel"

export default function DownloadCompressPdf() {
  const router = useLocalizedRouter()
  const { jobId } = router.query
  const { t, locale } = useTranslations()

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })
  const [compressResult, setCompressResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3600)
  const [mounted, setMounted] = useState(false)
  const [useCount, setUseCount] = useState(0)
  const [printing, setPrinting] = useState(false)
  const [downloadedBlob, setDownloadedBlob] = useState(null)
  const [expired, setExpired] = useState(false)
  const [downloadError, setDownloadError] = useState("")

  // Upsell — auth + india detection
  const { user } = useAuth()
  const { isIndia } = useIsIndia()
  const isPaidUser = ['starter', 'pro', 'agency', 'enterprise'].includes(user?.plan)

  useEffect(() => {
    setMounted(true)
    // On a reload / shared link the query is empty until the router is ready;
    // redirecting before that sent every refresh back to the upload page.
    if (!router.isReady) return
    const result = sessionStorage.getItem("pdfCompressResult")
    if (result) {
      setCompressResult(JSON.parse(result))
      setTimeout(() => setShowSuccess(true), 100)
    } else if (jobId) {
      // Session lost (e.g. page refresh, shared link) — fetch metadata from API
      const { hostname, protocol } = window.location
      const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
        : `${protocol}//${hostname}`
      fetch(`${API_URL}/api/compress-meta/${jobId}`)
        .then(r => r.ok ? r.json() : null)
        .then(meta => {
          if (meta) {
            setCompressResult(meta)
            setTimeout(() => setShowSuccess(true), 100)
          } else {
            routerRef.current.push("/compress-pdf")
          }
        })
        .catch(() => routerRef.current.push("/compress-pdf"))
    } else {
      routerRef.current.push("/compress-pdf")
    }
  }, [jobId, router.isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Files are deleted 1 h after the job was created (jobId starts with its
  // timestamp) — not 1 h after this page was opened or reloaded.
  useEffect(() => {
    const ts = parseInt(String(jobId || "").split("-")[0], 10)
    if (ts > 1e12) setCountdown(Math.max(0, Math.floor(3600 - (Date.now() - ts) / 1000)))
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

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + " " + t('compressPdf.unitMB')
    }
    return (bytes / 1024).toFixed(1) + " " + t('compressPdf.unitKB')
  }

  const handleDownload = async () => {
    if (!jobId) return
    setDownloading(true)

    try {
      const { hostname, protocol } = window.location
      const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
        : `${protocol}//${hostname}`

      const downloadUrl = `${API_URL}/api/download-compressed/${jobId}`
      const response = await fetch(downloadUrl)
      if (response.status === 404) { setExpired(true); return }
      if (!response.ok) throw new Error("Download failed")

      const blob = await response.blob()
      setDownloadedBlob(blob)  // reuse for print
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      // The old /filename="?(.+)"?/ grabbed the closing quote and the whole
      // `; filename*=UTF-8''…` part, so files saved with a mangled name.
      link.download = displayName
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
      setDownloadError(t('compressPdf.download.errorFailed'))
    } finally {
      setDownloading(false)
    }
  }

  const handleCompressAnother = () => {
    sessionStorage.removeItem("uploadedPdfFiles")
    sessionStorage.removeItem("pdfCompressResult")
    sessionStorage.removeItem("compressionLevel")
    router.push("/compress-pdf")
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
          title: t('compressPdf.download.shareTitle'),
          text: t('compressPdf.download.shareText'),
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
        const { hostname, protocol } = window.location
        const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
          ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
          : `${protocol}//${hostname}`
        await printFile(`${API_URL}/api/download-compressed/${compressResult?.jobId}`)
      }
    } catch (err) {
      console.error("Print error:", err)
    } finally {
      setPrinting(false)
    }
  }

  const handleDelete = () => {
    if (!window.confirm(t("fileActions.deleteConfirm"))) return
    sessionStorage.removeItem("uploadedPdfFiles")
    sessionStorage.removeItem("pdfCompressResult")
    sessionStorage.removeItem("compressionLevel")
    router.push("/compress-pdf")
  }

  if (!compressResult && !jobId) {
    return (
      <Layout>
        <SEOHead
          title="Download Compressed PDF | SmallPDF.us"
          description="Download your compressed PDF files."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-rose-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('compressPdf.preparingFiles')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const fileCount = compressResult?.fileCount || 1
  // Show the name the file will actually download as (the backend keeps the
  // original name). fileName comes from the preview page; the compress-meta
  // fallback (refresh / shared link) has the stored "<ts>-compressed-" name.
  const displayName = fileCount > 1
    ? 'compressed-pdfs.zip'
    : (compressResult?.fileName
      || compressResult?.files?.[0]?.filename?.replace(/^\d+-compressed-/, '')
      || 'compressed-document.pdf')
  const originalSize = compressResult?.totalOriginalSize || 0
  const compressedSize = compressResult?.compressedSize || 0
  const savings = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0
  const savingsDisplay = savings <= 0 ? '< 1' : savings
  const alreadyOptimized = savings <= 0

  const compressionLabels = {
    maximum: t('compressPdf.download.maximum'),
    balanced: t('compressPdf.download.balanced'),
    extreme:  t('compressPdf.download.extreme'),
  }

  return (
    <Layout title="Download Compressed PDF - SmallPDF.us" description="Download your compressed PDF files">
      <SEOHead
        title="Download Compressed PDF | SmallPDF.us"
        description="Download your compressed PDF files."
        noIndex={true}
      />
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
      <div className="bg-slate-50 px-4 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" size="leaderboard" label="Header Ad" className="rounded-xl overflow-hidden" />
        </div>
      </div>

      {/* Success Header */}
      <div className="relative overflow-hidden bg-rose-600">
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
                  {t('compressPdf.download.compressionComplete')}
                </h1>
                <p className="font-body text-rose-100 text-sm">
                  {fileCount} PDF{fileCount > 1 ? "s" : ""} {t('compressPdf.download.compressedSuccess')}
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
                <span>{t('compressPdf.download.secure')}</span>
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
                    <div className="w-14 h-14 bg-rose-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <Minimize2 className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-white truncate">
                        {displayName}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                          {t('compressPdf.download.readyStatus')}
                        </span>
                        <span className="text-slate-400 text-sm">
                          {fileCount} {t('compressPdf.download.files')} PDF{fileCount > 1 ? "s" : ""}
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
                    className="group relative w-full bg-rose-600 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:bg-rose-700 overflow-hidden"
                  >
                    <div className="absolute inset-0 btn-shimmer"></div>
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="relative">{t('compressPdf.download.preparingDownload')}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="relative">{t('compressPdf.download.downloadedSuccess')}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="relative">{fileCount > 1 ? t('compressPdf.download.downloadBtnPlural') : t('compressPdf.download.downloadBtn')}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {(expired || downloadError) && (
                    <div role="alert" className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
                      <p>{expired ? t('compressPdf.download.errorExpired') : downloadError}</p>
                      {expired && (
                        <button onClick={handleCompressAnother} className="mt-2 font-semibold underline">
                          {t('compressPdf.download.compressMore')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Before → after */}
                  {originalSize > 0 && compressedSize > 0 && (
                    <div className="mt-6 rounded-xl border border-slate-200 p-4">
                      <div className="flex items-end justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500">{t('compressPdf.download.originalSize')}</div>
                          <div className="font-display text-lg font-bold text-slate-400 line-through decoration-2">{formatFileSize(originalSize)}</div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400 mb-1.5 flex-shrink-0" />
                        <div className="min-w-0 text-right">
                          <div className="text-xs text-slate-500">{t('compressPdf.download.compressedSize')}</div>
                          <div className={`font-display text-2xl font-bold ${alreadyOptimized ? 'text-emerald-600' : 'text-rose-600'}`}>{formatFileSize(compressedSize)}</div>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${alreadyOptimized ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.max(3, Math.min(100, (compressedSize / originalSize) * 100))}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        {alreadyOptimized
                          ? t('compressPdf.download.alreadyOptimizedDesc')
                          : t('compressPdf.download.savedBytes', { size: formatFileSize(originalSize - compressedSize) })}
                      </p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{fileCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('compressPdf.download.files')}</div>
                    </div>
                    <div className={`text-center p-4 rounded-xl border ${alreadyOptimized ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                      <div className={`font-display text-2xl sm:text-3xl font-bold ${alreadyOptimized ? 'text-emerald-600' : 'text-rose-600'}`}>{savingsDisplay}%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{alreadyOptimized ? t('compressPdf.download.alreadyOptimized') : t('compressPdf.download.smaller')}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{t('compressPdf.download.format')}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('compressPdf.download.format')}</div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleCompressAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t('compressPdf.download.compressMore')}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handlePrint}
                      disabled={printing}
                      title={t("fileActions.print")}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700 disabled:opacity-60"
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
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-rose-600" /> : <Copy className="w-4 h-4" />}
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
                  {
                    icon: TrendingDown,
                    title: t('compressPdf.download.sizeReduced'),
                    desc: alreadyOptimized ? t('compressPdf.download.alreadyOptimized') : `${savingsDisplay}% ${t('compressPdf.download.smaller')}`,
                    color: "bg-rose-600",
                  },
                  { icon: Zap,       title: t('compressPdf.download.fastProcessing'),  desc: t('compressPdf.download.fastProcessingDesc'),    color: "bg-amber-500" },
                  { icon: Shield,    title: t('compressPdf.download.securePrivate'),    desc: t('compressPdf.download.securePrivateDesc'),     color: "bg-slate-600" },
                  { icon: FileText,  title: t('compressPdf.download.fullyFunctional'), desc: t('compressPdf.download.fullyFunctionalDesc'),   color: "bg-slate-800" },
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

              {/* More Tools */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t('compressPdf.download.exploreTools')}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        name: t('compressPdf.download.tool1Name'),
                        desc: t('compressPdf.download.tool1Desc'),
                        href: "/merge-pdf",
                        color: "bg-slate-600",
                      },
                      { name: t('compressPdf.download.tool2Name'), desc: t('compressPdf.download.tool2Desc'), href: "/pdf-to-png",   color: "bg-teal-600" },
                      { name: t('compressPdf.download.tool3Name'), desc: t('compressPdf.download.tool3Desc'), href: "/png-to-webp",  color: "bg-emerald-600" },
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
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-rose-600 transition-colors">
                          {t('compressPdf.download.tryNow')}
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
                <AdSenseUnit adSlot="compress-pdf-dl-mid" size="leaderboard" />
              </div>

            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-6">

              {/* Sidebar Ad */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body"><AdLabel /></p>
                <AdSenseUnit adSlot="7489539676" label="Download Sidebar" />
              </div>

              {/* Sidebar Ad 2 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3">
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
    props: { messages: getPageMessages(locale, ["compressPdf"]) },
    revalidate: 86400,
  }
}
