import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import {
  Download,
  CheckCircle2,
  ArrowLeft,
  FileText,
  Unlock,
  Shield,
  Sparkles,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import { useTranslations } from "../../lib/i18n"

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

export default function DownloadUnlockPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [result, setResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)

  // ✅ FIX: routerRef prevents infinite re-render loop.
  // useLocalizedRouter() returns a new object every render, so using it
  // directly in useEffect deps causes: effect → router change → effect → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    const storedResult = sessionStorage.getItem("unlockPdfResult")

    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult)
        setResult(parsed)
      } catch (err) {
        console.error("Error parsing result:", err)
        routerRef.current.push("/unlock-pdf")
      }
    } else {
      routerRef.current.push("/unlock-pdf")
    }
  }, []) // ✅ Empty deps — runs once on mount only

  const handleDownload = async (file) => {
    try {
      setDownloading(true)
      const API_URL = (() => {
        if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
        const { hostname, protocol } = window.location
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
        }
        return `${protocol}//${hostname}`
      })()

      if (result.fileCount === 1) {
        const response = await fetch(`${API_URL}${result.downloadUrl}`)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = file.unlockedName
          ? file.unlockedName.replace(/^(unlocked-)+/, 'unlocked-')
          : "unlocked.pdf"
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const response = await fetch(`${API_URL}/api/download-unlocked/${result.jobId}`)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `unlocked-pdfs-${result.jobId}.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }

      setDownloadComplete(true)
      setTimeout(() => {
        setDownloadComplete(false)
      }, 3000)
    } catch (error) {
      console.error("Download error:", error)
      alert(t("unlockPdf.downloadErrorAlert"))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadAll = async () => {
    if (result.fileCount === 1 && result.files && result.files.length > 0) {
      await handleDownload(result.files[0])
    } else {
      await handleDownload(null)
    }
  }

  const handleNewConversion = () => {
    sessionStorage.removeItem("unlockPdfResult")
    router.push("/unlock-pdf")
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A"
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  if (!result) {
    return (
      <Layout>
        <SEOHead noIndex={true} />
        <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-12 px-4 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600">{t("unlockPdf.downloadLoadingText")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const fileCount = result.fileCount
  const filePlural = fileCount !== 1 ? "s" : ""

  return (
    <Layout>
      <SEOHead noIndex={true} />
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header Ad */}
          <div className="mb-6">
            <AdSenseUnit adSlot="8004544994" />
          </div>

          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-4 shadow-xl animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              {t("unlockPdf.downloadSuccessTitle")}
            </h1>

            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {fileCount > 1
                ? t("unlockPdf.downloadSuccessSubtitleMultiple")
                : t("unlockPdf.downloadSuccessSubtitleSingle")}
            </p>
          </div>

          {/* Main Download Card */}
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden mb-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Unlock className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-white">
                    <h2 className="font-bold text-lg">
                      {t("unlockPdf.downloadCardTitle").replaceAll("{plural}", fileCount > 1 ? "s" : "")}
                    </h2>
                    <p className="text-sm text-amber-100">
                      {t("unlockPdf.downloadCardSubtitle").replace("{count}", fileCount).replaceAll("{plural}", filePlural)}
                    </p>
                  </div>
                </div>

                {downloadComplete && (
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-semibold">{t("unlockPdf.downloadGotItBadge")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Files List */}
            <div className="p-6">
              {result.files && result.files.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {result.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {file.unlockedName || file.originalName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>{formatFileSize(file.fileSize)}</span>
                            {file.originalSize && (
                              <>
                                <span className="text-slate-400">•</span>
                                <div className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{t("unlockPdf.downloadUnlockedBadge")}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {result.fileCount === 1 && (
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloading}
                          className="ml-4 inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">{t("unlockPdf.downloadIndividualBtn")}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-6 p-6 bg-amber-50 border-2 border-amber-200 rounded-xl text-center">
                  <Sparkles className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                  <p className="text-slate-700 font-semibold">
                    {t("unlockPdf.downloadFilesReady").replace("{count}", fileCount).replaceAll("{plural}", filePlural)}
                  </p>
                </div>
              )}

              {/* Download Button */}
              <button
                onClick={handleDownloadAll}
                disabled={downloading}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-lg transition-all shadow-xl ${
                  downloading
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 hover:shadow-2xl"
                }`}
              >
                {downloading ? (
                  <>
                    <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full"></div>
                    <span>{t("unlockPdf.downloadingBtn")}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-6 h-6" />
                    <span>
                      {fileCount > 1
                        ? t("unlockPdf.downloadBtnMultiple")
                        : t("unlockPdf.downloadBtnSingle")}
                    </span>
                  </>
                )}
              </button>

              <div className="mt-4 text-center">
                <p className="text-sm text-slate-600">
                  {fileCount > 1
                    ? t("unlockPdf.downloadHintMultiple")
                    : t("unlockPdf.downloadHintSingle")}
                </p>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-md hover:shadow-lg transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{t("unlockPdf.downloadFeature1Title")}</h3>
                  <p className="text-sm text-slate-600">{t("unlockPdf.downloadFeature1Desc")}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-md hover:shadow-lg transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{t("unlockPdf.downloadFeature2Title")}</h3>
                  <p className="text-sm text-slate-600">{t("unlockPdf.downloadFeature2Desc")}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-md hover:shadow-lg transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{t("unlockPdf.downloadFeature3Title")}</h3>
                  <p className="text-sm text-slate-600">{t("unlockPdf.downloadFeature3Desc")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleNewConversion}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-amber-600 border-2 border-amber-600 px-6 py-3 rounded-xl font-bold hover:bg-amber-50 transition-all shadow-md hover:shadow-lg"
            >
              <RefreshCw className="w-5 h-5" />
              <span>{t("unlockPdf.downloadUnlockMoreBtn")}</span>
            </button>

            <button
              onClick={() => router.push("/")}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 border-2 border-slate-200 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all shadow-md hover:shadow-lg"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t("unlockPdf.downloadBackHomeBtn")}</span>
            </button>
          </div>

          {/* Related Tools */}
          <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">{t("unlockPdf.downloadRelatedTitle")}</h3>

            <div className="grid md:grid-cols-2 gap-3">
              {[
                { nameKey: "relatedTool1Name", descKey: "relatedTool1Desc", href: "/merge-pdf",    iconBg: "bg-blue-100",   iconColor: "text-blue-600",   hoverBorder: "hover:border-blue-300",   hoverIcon: "group-hover:bg-blue-200"   },
                { nameKey: "relatedTool2Name", descKey: "relatedTool2Desc", href: "/compress-pdf", iconBg: "bg-purple-100", iconColor: "text-purple-600", hoverBorder: "hover:border-blue-300",   hoverIcon: "group-hover:bg-purple-200" },
                { nameKey: "relatedTool3Name", descKey: "relatedTool3Desc", href: "/split-pdf",    iconBg: "bg-green-100",  iconColor: "text-green-600",  hoverBorder: "hover:border-blue-300",   hoverIcon: "group-hover:bg-green-200"  },
                { nameKey: "relatedTool4Name", descKey: "relatedTool4Desc", href: "/pdf-to-word",  iconBg: "bg-orange-100", iconColor: "text-orange-600", hoverBorder: "hover:border-blue-300",   hoverIcon: "group-hover:bg-orange-200" },
              ].map((tool) => (
                <button
                  key={tool.nameKey}
                  onClick={() => router.push(tool.href)}
                  className={`flex items-center gap-3 p-4 bg-white rounded-xl hover:bg-blue-50 transition-all border border-slate-200 ${tool.hoverBorder} text-left group`}
                >
                  <div className={`w-10 h-10 ${tool.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 ${tool.hoverIcon} transition-colors`}>
                    <FileText className={`w-5 h-5 ${tool.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 mb-0.5">{t(`unlockPdf.${tool.nameKey}`)}</div>
                    <div className="text-sm text-slate-600">{t(`unlockPdf.${tool.descKey}`)}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Ad */}
          <div className="mt-6 bg-white rounded-2xl p-3 shadow-sm border border-slate-200">
            <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body">Advertisement</p>
            <AdSenseUnit adSlot="7489539676" />
          </div>
        </div>
      </div>
    </Layout>
  )
}