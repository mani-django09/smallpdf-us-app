// pages/ocr-pdf/process.js
// Processing / results page for OCR PDF.

import { useState, useEffect, useRef } from "react"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import Link from "next/link"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import { useAuth } from "../../context/AuthContext"
import { useTranslations } from "../../lib/i18n"
import {
  ScanText, ArrowLeft, Download, FileText, CheckCircle2,
  AlertCircle, Crown, ArrowRight, Clock, Zap,
} from "lucide-react"
import { ocrPdfStore } from "./index"

const STAGES_EN = [
  { pct: 10, label: "Uploading document…"          },
  { pct: 25, label: "Pre-processing pages…"         },
  { pct: 45, label: "Running character recognition…"},
  { pct: 70, label: "Reconstructing text layout…"   },
  { pct: 88, label: "Embedding text layer…"         },
  { pct: 96, label: "Finalising your PDF…"          },
]

export default function OcrPdfProcess() {
  const router  = useLocalizedRouter()
  const { user } = useAuth()
  const { t } = useTranslations()
  const isPro   = user?.plan === "pro" || user?.plan === "enterprise"

  const [status,   setStatus]   = useState("processing")
  const [progress, setProgress] = useState(0)
  const [stage,    setStage]    = useState("")
  const [result,   setResult]   = useState(null)
  const [errMsg,   setErrMsg]   = useState("")

  const didRun = useRef(false)

  const stageLabels = (() => {
    const items = t("ocrPdf.process.stages")
    if (Array.isArray(items) && items.length >= 6) return items
    return STAGES_EN.map(s => s.label)
  })()

  const STAGES = STAGES_EN.map((s, i) => ({ pct: s.pct, label: stageLabels[i] || s.label }))

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true
    setStage(STAGES[0].label)
    const file = ocrPdfStore.get()
    if (!file) { router.push("/ocr-pdf"); return }
    runOcr(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runOcr(file) {
    let stageIdx = 0
    const tick = setInterval(() => {
      if (stageIdx < STAGES.length - 1) {
        stageIdx++
        setProgress(STAGES[stageIdx].pct)
        setStage(STAGES[stageIdx].label)
      }
    }, 900)

    try {
      const formData = new FormData()
      formData.append("file", file)
      if (isPro) formData.append("outputFormats", "pdf,docx,txt")

      const API_URL =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
          ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011")
          : `${window.location.protocol}//${window.location.hostname}`

      const res = await fetch(`${API_URL}/api/ocr-pdf`, {
        method: "POST",
        body: formData,
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {},
      })

      clearInterval(tick)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }

      const data = await res.json()
      setProgress(100)
      setResult(data)
      setStatus("done")
      ocrPdfStore.clear()
    } catch (err) {
      clearInterval(tick)
      setErrMsg(err.message || "Something went wrong. Please try again.")
      setStatus("error")
    }
  }

  return (
    <>
      <SEOHead title={t("ocrPdf.process.pageTitle")} noIndex={true} />
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 py-12 px-4">
          <div className="max-w-xl mx-auto">

            <button
              onClick={() => router.push("/ocr-pdf")}
              className="flex items-center gap-2 text-violet-600 hover:text-violet-800 font-semibold text-sm mb-8 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {t("ocrPdf.process.backLink")}
            </button>

            <div className="bg-white rounded-2xl shadow-xl border border-violet-100 p-8">

              {/* Processing */}
              {status === "processing" && (
                <div className="text-center">
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-violet-100 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-violet-600 border-r-violet-600 rounded-full animate-spin" />
                    <ScanText className="absolute inset-0 m-auto w-8 h-8 text-violet-600" />
                  </div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">{t("ocrPdf.process.processingTitle")}</h1>
                  <p className="text-slate-500 text-sm mb-7">{stage}</p>
                  <div className="bg-slate-100 rounded-full h-3 overflow-hidden mb-3">
                    <div
                      className="bg-gradient-to-r from-violet-600 to-purple-600 h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">{progress}%</p>
                  {!isPro && (
                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                      <Clock className="w-3.5 h-3.5" />
                      {t("ocrPdf.process.standardQueue")}
                    </div>
                  )}
                </div>
              )}

              {/* Done */}
              {status === "done" && result && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 className="w-9 h-9 text-green-600" />
                  </div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">{t("ocrPdf.process.doneTitle")}</h1>
                  {result.pageCount && (
                    <p className="text-slate-500 text-sm mb-6">
                      {result.pageCount} {t("ocrPdf.process.pagesProcessed")}
                      {result.wordCount ? ` · ~${result.wordCount.toLocaleString()} ${t("ocrPdf.process.wordsExtracted")}` : ""}
                    </p>
                  )}

                  <div className="space-y-3 mb-7">
                    {result.pdfUrl && (
                      <a
                        href={result.pdfUrl}
                        download
                        className="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-violet-300/50"
                      >
                        <Download className="w-5 h-5" />
                        {t("ocrPdf.process.downloadPdf")}
                      </a>
                    )}
                    {isPro && result.docxUrl && (
                      <a
                        href={result.docxUrl}
                        download
                        className="flex items-center justify-center gap-2 w-full border-2 border-violet-200 text-violet-700 font-bold py-3 rounded-xl hover:bg-violet-50 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        {t("ocrPdf.process.downloadDocx")}
                      </a>
                    )}
                    {isPro && result.txtUrl && (
                      <a
                        href={result.txtUrl}
                        download
                        className="flex items-center justify-center gap-2 w-full border-2 border-slate-200 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        {t("ocrPdf.process.downloadTxt")}
                      </a>
                    )}
                  </div>

                  {!isPro && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-4 h-4 text-violet-600" />
                        <span className="font-display font-bold text-sm text-violet-900">{t("ocrPdf.process.upsellTitle")}</span>
                      </div>
                      <p className="text-xs text-slate-600 mb-3">{t("ocrPdf.process.upsellDesc")}</p>
                      <Link href="/pricing" className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-900">
                        {t("ocrPdf.process.upgradePro")} <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}

                  <button
                    onClick={() => router.push("/ocr-pdf")}
                    className="mt-5 text-sm text-slate-500 hover:text-slate-700 underline"
                  >
                    {t("ocrPdf.process.ocrAnother")}
                  </button>
                </div>
              )}

              {/* Error */}
              {status === "error" && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                    <AlertCircle className="w-9 h-9 text-red-500" />
                  </div>
                  <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">{t("ocrPdf.process.errorTitle")}</h1>
                  <p className="text-sm text-slate-600 mb-6">{errMsg}</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => router.push("/ocr-pdf")}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-colors"
                    >
                      {t("ocrPdf.process.ocrAnother")}
                    </button>
                    {!isPro && errMsg.toLowerCase().includes("limit") && (
                      <Link
                        href="/pricing"
                        className="flex items-center justify-center gap-2 w-full border-2 border-violet-200 text-violet-700 font-semibold py-3 rounded-xl hover:bg-violet-50 transition-colors text-sm"
                      >
                        <Zap className="w-4 h-4" /> {t("ocrPdf.process.upgradePro")}
                      </Link>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}