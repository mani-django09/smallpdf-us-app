// pages/ocr-pdf/download.js
// Download page for OCR PDF — reads result from sessionStorage

import { useState, useEffect } from "react"
import Layout from "../../components/Layout"
import UpgradeUpsell from "../../components/UpgradeUpsell"
import EmailCapture from "../../components/EmailCapture"
import SEOHead from "../../components/SEOHead"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import {
  Download, CheckCircle2, FileText, ArrowLeft, Shield, Clock,
  Crown, ArrowRight, RefreshCw, AlertCircle, Printer, Trash2, Zap,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "../../context/AuthContext"
import { useIsIndia } from "../../hooks/useIsIndia"
import { printBlob, printFile } from "../../lib/fileActions"
import AdSenseUnit from "../../components/AdSenseUnit"
import AdLabel from "../../components/AdLabel"


export default function OcrPdfDownload() {
  const router = useLocalizedRouter()
  const { user } = useAuth()
  const { isIndia } = useIsIndia()
  const { t } = useTranslations()
  const isPro = ["starter", "pro", "agency", "enterprise"].includes(user?.plan)
  const isPaidUser = ['starter', 'pro', 'agency', 'enterprise'].includes(user?.plan)

  const [result, setResult] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [downloaded, setDownloaded] = useState({})
  const [error, setError] = useState("")
  const [printing, setPrinting] = useState(false)
  const [downloadedBlob, setDownloadedBlob] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [useCount, setUseCount] = useState(0)

  useEffect(() => {
    setMounted(true)
    const stored = sessionStorage.getItem("ocrPdfResult")
    if (stored) {
      try { setResult(JSON.parse(stored)) }
      catch { router.push("/ocr-pdf") }
    } else {
      router.push("/ocr-pdf")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const doDownload = async (urlPath, filename, key) => {
    if (downloading) return
    setDownloading(key)
    setError("")
    try {
      const API_URL =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
          ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
          : `${window.location.protocol}//${window.location.hostname}`

      const res = await fetch(`${API_URL}${urlPath}`)
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      if (key === "pdf") setDownloadedBlob(blob)  // reuse the PDF for print
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setDownloaded((prev) => ({ ...prev, [key]: true }))
      // ── Track usage for inline upsell card ───────────────────────────
      if (!isPaidUser) {
        try {
          const prev = parseInt(localStorage.getItem('smpdf_use_count') || '0', 10)
          const next = prev + 1
          localStorage.setItem('smpdf_use_count', String(next))
          setUseCount(next)
        } catch {}
      }
    } catch (err) {
      setError(err.message || "Download failed. Please try again.")
    } finally {
      setDownloading(null)
    }
  }

  const handleOcrAnother = () => {
    sessionStorage.removeItem("ocrPdfResult")
    router.push("/ocr-pdf")
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      if (downloadedBlob) {
        printBlob(downloadedBlob)
      } else {
        const API_URL =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
            ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
            : `${window.location.protocol}//${window.location.hostname}`
        await printFile(`${API_URL}${result?.pdfUrl}`)
      }
    } catch (err) {
      console.error("Print error:", err)
    } finally {
      setPrinting(false)
    }
  }

  const handleDelete = () => {
    if (!window.confirm(t("fileActions.deleteConfirm"))) return
    sessionStorage.removeItem("ocrPdfResult")
    router.push("/ocr-pdf")
  }

  const baseName = result?.originalName?.replace(/\.pdf$/i, "") || "document"

  if (!result) {
    return (
      <Layout>
        <SEOHead title="OCR PDF — SmallPDF.us" noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-violet-50">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-violet-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-violet-600 rounded-full animate-spin" />
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <>
      <SEOHead title={t("ocrPdf.download.pageTitle")} noIndex={true} />
      <Layout>
        {/* Success header */}
        <div className="relative overflow-hidden bg-slate-50 border-b border-slate-200">
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #94a3b8 1px, transparent 0)", backgroundSize: "24px 24px" }}
          />
          <div className="relative max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white border border-slate-200 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-slate-900" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t("ocrPdf.download.successTitle")}</h1>
                <p className="text-sm text-slate-600">
                  {t("ocrPdf.download.pagesProcessed", { count: result.pageCount, plural: result.pageCount === 1 ? "" : "s" })}
                  {result.wordCount ? ` · ${t("ocrPdf.download.wordsExtracted", { count: result.wordCount.toLocaleString() })}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* Ad */}
        <div className="bg-slate-50 px-4 pt-6">
          <div className="max-w-3xl mx-auto">
            <AdSenseUnit adSlot="8004544994" size="leaderboard" />
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-50 min-h-screen py-8 px-4">
          <div className="max-w-3xl mx-auto">

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 text-sm">{error}</p>
                  <button onClick={() => setError("")} className="text-xs text-red-600 hover:text-red-800 mt-1 underline">Dismiss</button>
                </div>
              </div>
            )}

            {result.isImagePdf && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm">{t("ocrPdf.download.imagePdfTitle")}</p>
                  <p className="text-xs text-amber-700 mt-1">
                    {t("ocrPdf.download.imagePdfDesc")}{" "}
                    {!isPro && <a href="/pricing" className="font-semibold underline">{t("ocrPdf.download.imagePdfUpgrade")}</a>}
                    {!isPro && " " + t("ocrPdf.download.imagePdfUpgradeSuffix")}
                  </p>
                </div>
              </div>
            )}

            {result.alreadySearchable && (
              <div className="mb-6 bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sky-900 text-sm">{t("ocrPdf.download.alreadySearchableTitle")}</p>
                  <p className="text-xs text-sky-800 mt-1">{t("ocrPdf.download.alreadySearchableDesc")}</p>
                </div>
              </div>
            )}

            {result.alreadySearchable === false && result.ocrPages === 0 && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm">{t("ocrPdf.download.noTextTitle")}</p>
                  <p className="text-xs text-amber-700 mt-1">{t("ocrPdf.download.noTextDesc")}</p>
                </div>
              </div>
            )}

            {/* Download card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-white truncate">{result.originalName || "document.pdf"}</p>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                      <span>{t("ocrPdf.download.pagesProcessed", { count: result.pageCount, plural: result.pageCount === 1 ? "" : "s" })}</span>
                      {result.wordCount > 0 && (
                        <>
                          <span className="w-1 h-1 bg-slate-500 rounded-full" />
                          <span>{t("ocrPdf.download.wordsExtracted", { count: result.wordCount.toLocaleString() })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-500/20 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-sm font-medium text-emerald-300">{t("ocrPdf.download.fileReady")}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-3">
                {result.pdfUrl && (
                  <button
                    onClick={() => doDownload(result.pdfUrl, `${baseName}-ocr.pdf`, "pdf")}
                    disabled={!!downloading}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all ${
                      downloaded.pdf
                        ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                        : downloading === "pdf"
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 hover:shadow-lg hover:shadow-violet-500/25"
                    }`}
                  >
                    {downloading === "pdf" ? (
                      <><RefreshCw className="w-5 h-5 animate-spin" /> {t("ocrPdf.download.downloading")}</>
                    ) : downloaded.pdf ? (
                      <><CheckCircle2 className="w-5 h-5" /> {t("ocrPdf.download.downloaded")}</>
                    ) : (
                      <><Download className="w-5 h-5" /> {t("ocrPdf.download.downloadPdf")}</>
                    )}
                  </button>
                )}

                {result.docxUrl && (
                  <button
                    onClick={() => doDownload(result.docxUrl, `${baseName}-ocr.docx`, "docx")}
                    disabled={!!downloading}
                    className={`w-full py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                      downloaded.docx
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : downloading === "docx"
                        ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                        : "border-violet-200 text-violet-700 hover:bg-violet-50"
                    }`}
                  >
                    {downloading === "docx" ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> {t("ocrPdf.download.downloading")}</>
                    ) : downloaded.docx ? (
                      <><CheckCircle2 className="w-4 h-4" /> {t("ocrPdf.download.downloaded")}</>
                    ) : (
                      <><FileText className="w-4 h-4" /> {t("ocrPdf.download.downloadDocx")}</>
                    )}
                  </button>
                )}

                {result.txtUrl && (
                  <button
                    onClick={() => doDownload(result.txtUrl, `${baseName}-ocr.txt`, "txt")}
                    disabled={!!downloading}
                    className={`w-full py-3 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                      downloaded.txt
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : downloading === "txt"
                        ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {downloading === "txt" ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> {t("ocrPdf.download.downloading")}</>
                    ) : downloaded.txt ? (
                      <><CheckCircle2 className="w-4 h-4" /> {t("ocrPdf.download.downloaded")}</>
                    ) : (
                      <><FileText className="w-4 h-4" /> {t("ocrPdf.download.downloadTxt")}</>
                    )}
                  </button>
                )}

                <div className="pt-2 flex items-center justify-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-600" /> {t("ocrPdf.download.secureDownload")}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-600" /> {t("ocrPdf.download.autoDeleted")}</span>
                </div>

                {/* Print + Delete actions */}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handlePrint}
                    disabled={printing}
                    title={t("fileActions.print")}
                    className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-slate-700 disabled:opacity-60"
                  >
                    {printing ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Printer className="w-4 h-4" />}
                    <span>Print</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    title={t("fileActions.delete")}
                    className="py-3 px-4 rounded-xl font-medium text-sm bg-red-100 hover:bg-red-200 transition-colors flex items-center justify-center gap-2 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Mid-content Ad */}
            <div className="my-6 bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">{t("ocrPdf.download.advertisement")}</p>
              <AdSenseUnit adSlot="ocr-pdf-dl-mid" size="leaderboard" />
            </div>

            {/* ── Upgrade upsell ── */}
            <UpgradeUpsell className="mb-4" />

            <EmailCapture className="mt-3" />
            {!isPro && (
              <div className="bg-white border border-violet-200 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-violet-600" />
                  <span className="font-bold text-violet-900">{t("ocrPdf.download.proUpsellTitle")}</span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{t("ocrPdf.download.proUpsellDesc")}</p>
                <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-700 hover:text-violet-900 transition-colors">
                  {t("ocrPdf.download.proUpsellLink")} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={handleOcrAnother}
                className="inline-flex items-center gap-2 text-slate-600 hover:text-violet-600 font-medium text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("ocrPdf.download.ocrAnother")}
              </button>
            </div>

            {/* Two ads side-by-side so they don't stack into a tall empty gap when unfilled */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">{t("ocrPdf.download.advertisement")}</p>
                <div className="flex justify-center"><AdSenseUnit adSlot="7489539676" /></div>
              </div>
              {/* Sidebar Ad 2 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center"><AdLabel /></p>
                <div className="flex justify-center"><AdSenseUnit adSlot="7489539676" size="rectangle2" /></div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["ocrPdf"]) },
    revalidate: 86400,
  }
}
