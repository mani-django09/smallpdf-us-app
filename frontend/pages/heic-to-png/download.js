import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import UpgradeUpsell from "../../components/UpgradeUpsell"
import EmailCapture from "../../components/EmailCapture"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { Download, FileImage, CheckCircle, RefreshCw, Shield, Zap, Sparkles, Timer, ChevronRight, ArrowRight, Printer, Trash2 } from "lucide-react"
import Link from "next/link"
import AdSenseUnit from "../../components/AdSenseUnit"
import RelatedTools from "../../components/RelatedTools"
import { useAuth } from "../../context/AuthContext"
import { useIsIndia } from "../../hooks/useIsIndia"
import { printBlob, printFile, filenameFromDisposition } from "../../lib/fileActions"
import AdLabel from "../../components/AdLabel"

function getApiUrl() {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
  const { hostname, protocol } = window.location
  if (hostname === "localhost" || hostname === "127.0.0.1") return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
  return `${protocol}//${hostname}`
}

export default function DownloadHeicToPng() {
  const router = useLocalizedRouter()
  const { jobId } = router.query
  const { t } = useTranslations()
  const [convertResult, setConvertResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [downloadedBlob, setDownloadedBlob] = useState(null)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [downloadError, setDownloadError] = useState("")
  const [countdown, setCountdown] = useState(3600)
  const [mounted, setMounted] = useState(false)
  const [useCount, setUseCount] = useState(0)

  // Upsell — auth + India detection
  const { user } = useAuth()
  const { isIndia } = useIsIndia()
  const isPaidUser = ['starter', 'pro', 'agency', 'enterprise'].includes(user?.plan)

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const result = sessionStorage.getItem("heicPngConvertResult")
    if (result) {
      try { setConvertResult(JSON.parse(result)) } catch { routerRef.current.push("/heic-to-png") }
    } else if (!jobId) {
      routerRef.current.push("/heic-to-png")
    }
  }, [jobId])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [countdown])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const fileCount = convertResult?.fileCount || 1

  const handleDownload = async () => {
    const id = jobId || convertResult?.jobId
    if (!id) return
    setDownloading(true)
    setDownloadError("")
    try {
      const response = await fetch(`${getApiUrl()}/api/download-heic-png/${id}`)
      if (!response.ok) throw new Error("Download failed")
      const blob = await response.blob()
      setDownloadedBlob(blob)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      const singleName = convertResult?.files?.[0]?.downloadName || "converted-image.png"
      // Server names it (original photo name / "heic-to-png-N-images.zip")
      link.download = filenameFromDisposition(response.headers.get("content-disposition"), fileCount > 1 ? `heic-to-png-${fileCount}-images.zip` : singleName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setDownloadComplete(true)
      setTimeout(() => setDownloadComplete(false), 3000)
      // Track usage for inline upsell card
      if (!isPaidUser) {
        try {
          const next = parseInt(localStorage.getItem('smpdf_use_count') || '0', 10) + 1
          localStorage.setItem('smpdf_use_count', String(next))
          setUseCount(next)
        } catch {}
      }
    } catch (error) {
      console.error("Download error:", error)
      setDownloadError(t("heicToPng.downloadErrorFailed"))
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      if (downloadedBlob) { printBlob(downloadedBlob) }
      else { await printFile(`${getApiUrl()}/api/download-heic-png/${jobId || convertResult?.jobId}`) }
    } catch (err) { console.error("Print error:", err) }
    finally { setPrinting(false) }
  }

  const handleDelete = () => {
    if (!window.confirm(t("fileActions.deleteConfirm"))) return
    sessionStorage.removeItem("uploadedHeicPngFiles")
    sessionStorage.removeItem("heicPngConvertResult")
    router.push("/heic-to-png")
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("uploadedHeicPngFiles")
    sessionStorage.removeItem("heicPngConvertResult")
    router.push("/heic-to-png")
  }

  if (!convertResult && !jobId) {
    return (
      <Layout>
        <SEOHead noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-teal-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-teal-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("heicToPng.downloadLoadingFiles")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={t("heicToPng.downloadTitle")} description={t("heicToPng.downloadDescription")}>
      <SEOHead title={t("heicToPng.downloadTitle")} noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        @keyframes checkmark-draw { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
        @keyframes fade-up { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-checkmark { animation: checkmark-draw 0.4s ease-out 0.3s forwards; stroke-dasharray: 24; stroke-dashoffset: 24; }
        .animate-fade-up { animation: fade-up 0.5s ease-out forwards; }
      `}</style>


      {/* Header Ad */}
      <div className="bg-teal-50 px-4 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" size="leaderboard" label="Header Ad" className="rounded-xl overflow-hidden" />
        </div>
      </div>

      {/* Success Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-cyan-600">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: "24px 24px" }}></div>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
                  <path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-checkmark" />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{t("heicToPng.downloadTitle")}</h1>
                <p className="font-body text-teal-100 text-sm mt-0.5">{fileCount} {t("heicToPng.downloadImages")} · PNG</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2">
              <Timer className="w-4 h-4 text-cyan-200" />
              <span className="font-display text-sm font-semibold text-white">{formatTime(countdown)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-teal-50 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Main */}
            <div className="lg:col-span-8 space-y-6">
              {/* Download Card */}
              <div className="bg-white rounded-2xl border border-teal-200 overflow-hidden animate-fade-up">
                <div className="px-6 py-4 border-b border-teal-100 bg-gradient-to-r from-teal-700 to-cyan-700">
                  <div className="flex items-center gap-3">
                    <FileImage className="w-5 h-5 text-teal-200" />
                    <div>
                      <p className="font-display font-semibold text-white text-sm">
                        {fileCount > 1 ? `${fileCount} PNG images` : "converted-image.png"}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs text-cyan-200 font-medium mt-0.5">
                        <span className="w-1.5 h-1.5 bg-cyan-300 rounded-full"></span>
                        {t("heicToPng.downloadSummaryComplete")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {downloadError && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                      <span className="text-red-600 font-bold flex-shrink-0">⚠</span>
                      <p className="font-body text-sm text-red-700 flex-1">{downloadError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="relative w-full py-4 px-6 rounded-xl font-display font-bold text-base transition-all duration-200 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-3"
                  >
                    {downloading ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>{t("heicToPng.downloadDownloading")}</span></>
                    ) : downloadComplete ? (
                      <><CheckCircle className="w-5 h-5 text-green-300" /><span>{t("heicToPng.downloadDownloaded")}</span></>
                    ) : (
                      <><Download className="w-5 h-5" /><span>{fileCount > 1 ? t("heicToPng.downloadBtnPlural").replace("{count}", fileCount) : t("heicToPng.downloadBtnSingular")}</span></>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    {[
                      { val: fileCount, label: t("heicToPng.downloadImages") },
                      { val: "100%", label: t("heicToPng.downloadQuality"), teal: true },
                      { val: "PNG", label: t("heicToPng.downloadFormat") },
                    ].map((s, i) => (
                      <div key={i} className="text-center p-4 bg-teal-50 rounded-xl border border-teal-100">
                        <div className={`font-display text-2xl sm:text-3xl font-bold ${s.teal ? "text-teal-600" : "text-slate-900"}`}>{s.val}</div>
                        <div className="font-body text-xs text-slate-500 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-teal-100 flex items-center gap-3">
                    <button onClick={handleConvertAnother} className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-teal-100 hover:bg-teal-200 transition-colors flex items-center justify-center gap-2 text-teal-800">
                      <RefreshCw className="w-4 h-4" />
                      <span>{t("heicToPng.downloadConvertMore")}</span>
                    </button>
                    {fileCount === 1 && <button onClick={handlePrint} disabled={printing} title={t("fileActions.print")}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-teal-100 hover:bg-teal-200 transition-colors flex items-center justify-center text-teal-800 disabled:opacity-60">
                      {printing ? <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /> : <Printer className="w-4 h-4" />}
                    </button>}
                    <button onClick={handleDelete} title={t("fileActions.delete")}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-red-100 hover:bg-red-200 transition-colors flex items-center justify-center text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* ── Upgrade upsell ── */}
                  <UpgradeUpsell className="mt-4" />

                  <EmailCapture className="mt-3" />
                </div>
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Sparkles, title: t("heicToPng.downloadFeature1Title"), desc: t("heicToPng.downloadFeature1Desc") },
                  { icon: Zap, title: t("heicToPng.downloadFeature2Title"), desc: t("heicToPng.downloadFeature2Desc") },
                  { icon: Shield, title: t("heicToPng.downloadFeature3Title"), desc: t("heicToPng.downloadFeature3Desc") },
                  { icon: FileImage, title: t("heicToPng.downloadFeature4Title"), desc: t("heicToPng.downloadFeature4Desc") },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-teal-200">
                    <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center mb-3 shadow-lg">
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-display font-semibold text-slate-900 mb-1">{item.title}</h3>
                    <p className="font-body text-sm text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* More Tools */}
              <div className="bg-white rounded-2xl border border-teal-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-teal-100 bg-teal-50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t("heicToPng.downloadMoreToolsTitle")}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { name: t("heicToPng.downloadTool1Name"), desc: t("heicToPng.downloadTool1Desc"), href: "/heic-to-jpg" },
                      { name: t("heicToPng.downloadTool2Name"), desc: t("heicToPng.downloadTool2Desc"), href: "/compress-image" },
                      { name: t("heicToPng.downloadTool3Name"), desc: t("heicToPng.downloadTool3Desc"), href: "/png-to-pdf" },
                    ].map((tool) => (
                      <a key={tool.name} href={router.href(tool.href)} className="group p-4 rounded-xl border border-teal-200 hover:border-teal-300 hover:shadow-lg transition-all duration-300 bg-white">
                        <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300">
                          <FileImage className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-teal-600 group-hover:text-teal-700 transition-colors">
                          {t("heicToPng.downloadToolTryNow")}
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
                <AdSenseUnit adSlot="heic-to-png-dl-mid" size="leaderboard" />
              </div>

            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-6">

              <div className="hidden lg:block bg-white rounded-2xl border border-teal-200 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body"><AdLabel /></p>
                <AdSenseUnit adSlot="7489539676" />
              </div>

            </div>
          </div>
        </div>
      </div>

      <RelatedTools current="heic-to-png" />
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["heicToPng"]) },
    revalidate: 86400,
  }
}
