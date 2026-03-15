/**
 * pages/webp-to-png/download.js
 *
 * FIXES vs original:
 * 1. `fileCount` was referenced on line 91 BEFORE `convertResult` was available
 *    (it was declared on line 161 using `convertResult?.fileCount || 1`).
 *    Now fileCount is derived safely from state inside handlers.
 * 2. `getApiUrl()` extracted to a module-level helper — no more duplicate
 *    definitions in handleDownload and handleConvert.
 * 3. Minor: share title/text uses t() for i18n consistency.
 */

import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import {
  Download,
  FileImage,
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

// ── Module-level API URL helper (no more duplicate inline definitions) ─────
function getApiUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
  }
  const { hostname, protocol } = window.location
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
  }
  return `${protocol}//${hostname}`
}

export default function DownloadWebpToPng() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { jobId } = router.query

  const [convertResult, setConvertResult] = useState(null)
  const [downloading, setDownloading] = useState(false)

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
    const result = sessionStorage.getItem("webpConvertResult")
    if (result) {
      setConvertResult(JSON.parse(result))
    } else if (!jobId) {
      routerRef.current.push("/webp-to-png")
    }
  }, [jobId]) // ✅ Only re-run if jobId query param changes

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // ✅ FIX: fileCount is now derived inside the handler where convertResult is
  // guaranteed to be in scope, instead of being referenced before it's defined.
  const handleDownload = async () => {
    if (!jobId) return
    setDownloading(true)

    // Safe: convertResult is already loaded by the time the user can click Download
    const fileCount = convertResult?.fileCount ?? 1

    try {
      const API_URL = getApiUrl()
      const response = await fetch(`${API_URL}/api/download/${jobId}`)
      if (!response.ok) throw new Error("Download failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      // Parse filename from Content-Disposition header, with a sensible default
      const contentDisposition = response.headers.get("content-disposition")
      let filename = fileCount > 1 ? "converted-images.zip" : "converted-image.png"

      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match?.[1]) {
          filename = match[1].replace(/['"]/g, "")
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
      alert(t("webpToPng.downloadErrorFailed") || "Failed to download file. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("uploadedWebpFiles")
    sessionStorage.removeItem("webpConvertResult")
    router.push("/webp-to-png")
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
          title: t("webpToPng.downloadTitle"),
          text: t("webpToPng.downloadDescription"),
          url: window.location.href,
        })
      } catch {
        // Share was cancelled or failed — silently fall back to copy
        handleCopyLink()
      }
    } else {
      handleCopyLink()
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!convertResult && !jobId) {
    return (
      <>
        <SEOHead noIndex={true} />
        <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-teal-200 rounded-full" />
              <div className="absolute inset-0 border-3 border-t-teal-600 rounded-full animate-spin" />
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("webpToPng.downloadLoadingFiles")}</p>
          </div>
        </div>
      </Layout>
      </>
    )
  }

  // ✅ FIX: fileCount is now declared AFTER convertResult is confirmed available
  const fileCount = convertResult?.fileCount ?? 1

  return (
    <>
      <SEOHead noIndex={true} />
      <Layout title={t("webpToPng.downloadTitle")} description={t("webpToPng.downloadDescription")}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body    { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Header Ad */}
      <div className="bg-white px-4 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 pt-8 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-12 gap-8">

            {/* Main column */}
            <div className="lg:col-span-8 space-y-6">

              {/* Download card */}
              <div className="bg-white rounded-2xl border border-teal-200/60 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="font-display text-lg font-bold text-white">
                        {t("webpToPng.downloadTitle")}
                      </h1>
                      <p className="font-body text-sm text-teal-100">
                        {t("webpToPng.downloadDescription")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {/* Primary download button */}
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="group relative w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-display font-bold text-base hover:from-teal-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>{t("webpToPng.downloadDownloaded")}</span>
                      </>
                    ) : downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{t("webpToPng.downloadDownloading")}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>
                          {fileCount > 1
                            ? t("webpToPng.downloadBtnPlural").replace("{count}", fileCount)
                            : t("webpToPng.downloadBtnSingular")}
                        </span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-teal-50 rounded-xl border border-teal-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{fileCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("webpToPng.downloadImages")}</div>
                    </div>
                    <div className="text-center p-4 bg-teal-50 rounded-xl border border-teal-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-teal-600">100%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("webpToPng.downloadQuality")}</div>
                    </div>
                    <div className="text-center p-4 bg-teal-50 rounded-xl border border-teal-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">PNG</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t("webpToPng.downloadFormat")}</div>
                    </div>
                  </div>

                  {/* Secondary actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleConvertAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t("webpToPng.downloadConvertMore")}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                      aria-label="Share"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                      aria-label="Copy link"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Sparkles, title: t("webpToPng.downloadFeature1Title"), desc: t("webpToPng.downloadFeature1Desc"), color: "from-teal-500 to-emerald-600" },
                  { icon: Zap,      title: t("webpToPng.downloadFeature2Title"), desc: t("webpToPng.downloadFeature2Desc"), color: "from-amber-500 to-orange-600" },
                  { icon: Shield,   title: t("webpToPng.downloadFeature3Title"), desc: t("webpToPng.downloadFeature3Desc"), color: "from-slate-600 to-slate-700" },
                  { icon: FileImage,title: t("webpToPng.downloadFeature4Title"), desc: t("webpToPng.downloadFeature4Desc"), color: "from-emerald-600 to-teal-700" },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-teal-200/60">
                    <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center mb-3 shadow-lg`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-display font-semibold text-slate-900 mb-1">{item.title}</h3>
                    <p className="font-body text-sm text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* More tools */}
              <div className="bg-white rounded-2xl border border-teal-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-teal-50/50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t("webpToPng.downloadMoreToolsTitle")}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { name: t("webpToPng.downloadTool1Name"), desc: t("webpToPng.downloadTool1Desc"), href: router.href("/png-to-pdf"),  color: "from-teal-500 to-teal-600" },
                      { name: t("webpToPng.downloadTool2Name"), desc: t("webpToPng.downloadTool2Desc"), href: router.href("/jpg-to-pdf"),  color: "from-emerald-500 to-emerald-600" },
                      { name: t("webpToPng.downloadTool3Name"), desc: t("webpToPng.downloadTool3Desc"), href: router.href("/merge-pdf"),   color: "from-cyan-500 to-cyan-600" },
                    ].map((tool) => (
                      <a
                        key={tool.href}
                        href={tool.href}
                        className="group p-4 rounded-xl border border-teal-200/80 hover:border-teal-300 hover:shadow-lg transition-all duration-300 bg-white"
                      >
                        <div className={`w-10 h-10 bg-gradient-to-br ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                          <FileImage className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-teal-600 transition-colors">
                          {t("webpToPng.downloadToolTryNow")}
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
              <div className="bg-white rounded-2xl border border-teal-200/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-teal-50/50">
                  <h3 className="font-display text-base font-semibold text-slate-900">{t("webpToPng.downloadSummaryTitle")}</h3>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    [t("webpToPng.downloadSummaryImages"), fileCount],
                    [t("webpToPng.downloadSummaryFormat"),  <span className="text-teal-600 font-semibold">PNG</span>],
                    [t("webpToPng.downloadSummaryQuality"), t("webpToPng.downloadSummaryQualityValue")],
                  ].map(([label, value], i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="font-body text-sm text-slate-600">{label}</span>
                      <span className="font-display font-semibold text-slate-900">{value}</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t("webpToPng.downloadSummaryStatus")}</span>
                    <span className="inline-flex items-center gap-1.5 text-teal-600 font-medium text-sm">
                      <CheckCircle className="w-4 h-4" />
                      {t("webpToPng.downloadSummaryComplete")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expiry countdown */}
              <div className="bg-white rounded-2xl border border-teal-200/60 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Timer className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">{t("webpToPng.downloadExpiryTitle")}</h3>
                    <p className="font-body text-xs text-slate-500">{t("webpToPng.downloadExpirySubtitle")}</p>
                  </div>
                </div>
                <div className="bg-teal-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-body text-xs text-slate-600">{t("webpToPng.downloadTimeRemaining")}</span>
                    <span className="font-display font-semibold text-slate-900">{formatTime(countdown)}</span>
                  </div>
                  <div className="bg-teal-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-1000"
                      style={{ width: `${(countdown / 3600) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar Ad */}
              <div className="bg-white rounded-2xl border border-teal-200/60 p-3">
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