// pages/ocr-pdf/download.js
// Download page for OCR PDF — reads result from sessionStorage

import { useState, useEffect } from "react"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import Link from "next/link"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import { useAuth } from "../../context/AuthContext"
import { useTranslations } from "../../lib/i18n"
import {
  Download, CheckCircle2, FileText, ArrowLeft, Shield, Clock,
  Crown, ArrowRight, RefreshCw, AlertCircle,
} from "lucide-react"

function AdSenseUnit({ adSlot }) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch (err) {
      console.error("AdSense:", err)
    }
  }, [])
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client="ca-pub-6913093595582462"
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

export default function OcrPdfDownload() {
  const router = useLocalizedRouter()
  const { user } = useAuth()
  const { t } = useTranslations()
  const isPro = user?.plan === "pro" || user?.plan === "enterprise"

  const [result, setResult] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [downloaded, setDownloaded] = useState({})
  const [error, setError] = useState("")

  useEffect(() => {
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
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setDownloaded((prev) => ({ ...prev, [key]: true }))
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
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
          />
          <div className="relative max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">{t("ocrPdf.download.successTitle")}</h1>
                <p className="text-sm text-white/80">
                  {result.pageCount} {t("ocrPdf.download.pagesProcessed")}
                  {result.wordCount ? ` · ~${result.wordCount.toLocaleString()} ${t("ocrPdf.download.wordsExtracted")}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Ad */}
        <div className="bg-slate-50 px-4 pt-6">
          <div className="max-w-3xl mx-auto">
            <AdSenseUnit adSlot="8004544994" />
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
                      <span>{result.pageCount} {t("ocrPdf.download.pagesProcessed")}</span>
                      {result.wordCount > 0 && (
                        <>
                          <span className="w-1 h-1 bg-slate-500 rounded-full" />
                          <span>~{result.wordCount.toLocaleString()} {t("ocrPdf.download.wordsExtracted")}</span>
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
              </div>
            </div>

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

            <div className="mt-8 bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">{t("ocrPdf.download.advertisement")}</p>
              <AdSenseUnit adSlot="7489539676" />
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}