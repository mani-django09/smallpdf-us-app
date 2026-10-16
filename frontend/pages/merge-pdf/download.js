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
  FileCheck,
  Layers,
  Timer,
  Printer,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "../../context/AuthContext"
import { useIsIndia } from "../../hooks/useIsIndia"
import { printBlob, printFile } from "../../lib/fileActions"
import AdSenseUnit from "../../components/AdSenseUnit"
import AdLabel from "../../components/AdLabel"

// AdSense Component

// Inline translations for strings not yet in JSON files
const INLINE_T = {
  shareTitle: {
    en: "My Merged PDF", ja: "結合したPDF", de: "Meine zusammengefügte PDF",
    fr: "Mon PDF fusionné", es: "Mi PDF combinado", it: "Il mio PDF unito",
    id: "PDF gabungan saya", pt: "Meu PDF mesclado",
  },
  shareText: {
    en: "Check out my merged PDF file", ja: "結合したPDFファイルをご覧ください",
    de: "Schau dir meine zusammengefügte PDF-Datei an",
    fr: "Découvrez mon fichier PDF fusionné",
    es: "Mira mi archivo PDF combinado",
    it: "Guarda il mio file PDF unito",
    id: "Lihat file PDF gabungan saya",
    pt: "Veja meu arquivo PDF mesclado",
  },
  filesSelected: {
    en: "{n} PDF Files Selected", ja: "{n}個のPDFファイルを選択",
    de: "{n} PDF-Dateien ausgewählt", fr: "{n} fichiers PDF sélectionnés",
    es: "{n} archivos PDF seleccionados", it: "{n} file PDF selezionati",
    id: "{n} file PDF dipilih", pt: "{n} arquivos PDF selecionados",
  },
  totalSize: {
    en: "Total: {size} MB", ja: "合計: {size} MB", de: "Gesamt: {size} MB",
    fr: "Total : {size} Mo", es: "Total: {size} MB", it: "Totale: {size} MB",
    id: "Total: {size} MB", pt: "Total: {size} MB",
  },
  loading: {
    en: "Loading...", ja: "読み込み中...", de: "Wird geladen...",
    fr: "Chargement...", es: "Cargando...", it: "Caricamento...",
    id: "Memuat...", pt: "Carregando...",
  },
}

export default function DownloadMergePDF() {
  const router = useLocalizedRouter()
  const { file } = router.query
  const { t, locale } = useTranslations()

  // Helper: pick the right locale from INLINE_T, fall back to English
  const ti = (key, replacements = {}) => {
    let str = INLINE_T[key]?.[locale] ?? INLINE_T[key]?.en ?? key
    for (const [k, v] of Object.entries(replacements)) {
      str = str.replace(`{${k}}`, v)
    }
    return str
  }
  const [mergeResult, setMergeResult] = useState(null)
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

  // ✅ FIX: routerRef prevents infinite re-render loop.
  // useLocalizedRouter() returns a new object every render, so using it
  // directly in useEffect deps causes: effect → router change → effect → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    setMounted(true)
    const result = sessionStorage.getItem("mergeResult")
    if (result) {
      setMergeResult(JSON.parse(result))
      setTimeout(() => setShowSuccess(true), 100)
    } else if (!file) {
      routerRef.current.push("/merge-pdf")
    }
  }, [file]) // ✅ Only re-run if 'file' query param changes, not on every router render

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

    try {
      // 'file' is already an absolute URL (set by preview.js getApiUrl())
      // Works in dev (http://localhost:5011/uploads/...) and prod (https://smallpdf.us/uploads/...)
      const downloadUrl = file.startsWith('http') ? file : `${window.location.origin}${file}`
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error("Download failed")

      const blob = await response.blob()
      setDownloadedBlob(blob)  // reuse for print — backend deletes file after first serve
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `merged-document-${Date.now()}.pdf`
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
      alert(t('mergePdf.download.errorFailed'))
    } finally {
      setDownloading(false)
    }
  }

  const handleMergeAnother = () => {
    sessionStorage.removeItem("uploadedPDFs")
    sessionStorage.removeItem("mergeResult")
    router.push("/merge-pdf")
  }

  const handleCopyLink = () => {
    const fullUrl = file.startsWith('http') ? file : `${window.location.origin}${file}`
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: ti('shareTitle'),
          text: ti('shareText'),
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
        const printUrl = file && file.startsWith('http') ? file : `${window.location.origin}${file}`
        await printFile(printUrl)
      }
    } catch (err) {
      console.error("Print error:", err)
    } finally {
      setPrinting(false)
    }
  }

  const handleDelete = () => {
    if (!window.confirm(t("fileActions.deleteConfirm"))) return
    sessionStorage.removeItem("uploadedPDFs")
    sessionStorage.removeItem("mergeResult")
    router.push("/merge-pdf")
  }

  if (!mergeResult && !file) {
    return (
      <Layout>
        <SEOHead
          title="Download Merged PDF | SmallPDF.us"
          description="Download your merged PDF file."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('mergePdf.download.loadingFile')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const fileCount = mergeResult?.fileCount || 2
  const totalSize = mergeResult?.totalSize || 0

  return (
    <Layout title={t('mergePdf.download.pageTitle')} description={t('mergePdf.download.pageDescription')}>
      <SEOHead
        title="Download Merged PDF | SmallPDF.us"
        description="Download your merged PDF file."
        noIndex={true}
      />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
        
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        
        @keyframes checkmark-draw {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes circle-fill {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
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
        .animate-circle { animation: circle-fill 0.3s ease-out forwards; }
        .animate-fade-up { animation: fade-up 0.5s ease-out forwards; }
        .animate-fade-up-delay-1 { animation: fade-up 0.5s ease-out 0.1s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.5s ease-out 0.2s forwards; opacity: 0; }
        .btn-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
        }
        .pdf-icon-gradient {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }
      `}</style>


      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-6">
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
                  {t('mergePdf.download.mergedSuccess')}
                </h1>
                <p className="font-body text-slate-600 text-sm">{t('mergePdf.download.filesCombined').replace('{count}', fileCount)}</p>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${mounted ? "animate-fade-up-delay-2" : "opacity-0"}`}>
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-medium text-slate-900">
                <Timer className="w-3.5 h-3.5" />
                <span>{formatTime(countdown)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-medium text-slate-900">
                <Lock className="w-3.5 h-3.5" />
                <span>{t('mergePdf.download.encrypted')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Banner Ad */}
      <div className="bg-white py-4 px-4 border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <p className="font-body text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center">
            <AdLabel />
          </p>
          <div className="flex justify-center">
            <AdSenseUnit 
              adSlot="4209491059"
              style={{ width: "728px", height: "90px" }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50/50 py-8 sm:py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Main Download Section */}
            <div className="lg:col-span-8 space-y-6">
              <div className="glass-card rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/50 overflow-hidden">
                {/* File Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 pdf-icon-gradient rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
                      <Layers className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-white truncate">
                        merged-document.pdf
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                          {t('mergePdf.download.ready')}
                        </span>
                        <span className="text-slate-400 text-sm">{t('mergePdf.download.filesMerged').replace('{count}', fileCount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Actions */}
                <div className="p-6 sm:p-8">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="group relative w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:from-emerald-500 hover:to-emerald-600 overflow-hidden"
                  >
                    <div className="absolute inset-0 btn-shimmer"></div>
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="relative">{t('mergePdf.download.preparingDownload')}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="relative">{t('mergePdf.download.downloadedSuccess')}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="relative">{t('mergePdf.download.downloadBtn')}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{fileCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('mergePdf.download.filesMergedLabel')}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-emerald-600">100%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('mergePdf.download.qualityLabel')}</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">&lt;3s</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t('mergePdf.download.processingLabel')}</div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleMergeAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t('mergePdf.download.mergeMore')}</span>
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
                      {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* ── Upgrade upsell ── */}
                  <UpgradeUpsell className="mt-4" />

                  <EmailCapture className="mt-3" />
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-5 rounded-xl border border-slate-200/60">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20">
                    <FileCheck className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{t('mergePdf.download.losslessQuality')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('mergePdf.download.losslessDesc')}</p>
                </div>

                <div className="glass-card p-5 rounded-xl border border-slate-200/60">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{t('mergePdf.download.fastProcessing')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('mergePdf.download.fastDesc')}</p>
                </div>

                <div className="glass-card p-5 rounded-xl border border-slate-200/60">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{t('mergePdf.download.securePrivate')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('mergePdf.download.secureDesc')}</p>
                </div>

                <div className="glass-card p-5 rounded-xl border border-slate-200/60">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mb-3 shadow-lg shadow-blue-500/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{t('mergePdf.download.professionalOutput')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('mergePdf.download.professionalDesc')}</p>
                </div>
              </div>

              {/* Mobile Ad - Below Features */}
              <div className="lg:hidden">
                <p className="font-body text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center">
                  <AdLabel />
                </p>
                <div className="flex justify-center">
                  <AdSenseUnit 
                    adSlot="4209491059"
                    style={{ width: "320px", height: "50px" }}
                  />
                </div>
              </div>

              {/* More Tools */}
              <div className="glass-card rounded-2xl border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t('mergePdf.download.exploreTools')}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        name: t('mergePdf.download.tool1Name'),
                        desc: t('mergePdf.download.tool1Desc'),
                        href: "/word-to-pdf",
                        color: "from-red-500 to-red-600",
                      },
                      {
                        name: t('mergePdf.download.tool2Name'),
                        desc: t('mergePdf.download.tool2Desc'),
                        href: "/split-pdf",
                        color: "from-blue-500 to-blue-600",
                      },
                      {
                        name: t('mergePdf.download.tool3Name'),
                        desc: t('mergePdf.download.tool3Desc'),
                        href: "/compress-pdf",
                        color: "from-rose-500 to-rose-600",
                      },
                    ].map((tool) => (
                      <a
                        key={tool.name}
                        href={tool.href}
                        className="group p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 bg-white"
                      >
                        <div
                          className={`w-10 h-10 bg-gradient-to-br ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}
                        >
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                          {t('mergePdf.download.tryNow')}
                          <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Ad Space 1 */}
              <div className="glass-card rounded-2xl border border-slate-200/60 p-4">
                <p className="font-body text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center">
                  <AdLabel />
                </p>
                <div className="flex justify-center">
                  <AdSenseUnit
                    adSlot="2896409385"
                    style={{ width: "300px", height: "250px" }}
                  />
                </div>
              </div>

              {/* Ad Space 2 */}
              <div className="glass-card rounded-2xl border border-slate-200/60 p-4">
                <p className="font-body text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center">
                  <AdLabel />
                </p>
                <div className="flex justify-center">
                  <AdSenseUnit
                    adSlot="2896409385"
                    size="rectangle2"
                    style={{ width: "300px", height: "250px" }}
                  />
                </div>
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
    props: { messages: getPageMessages(locale, ["mergePdf"]) },
    revalidate: 86400,
  }
}
