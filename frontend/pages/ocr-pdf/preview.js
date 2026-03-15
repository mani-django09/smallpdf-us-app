// pages/ocr-pdf/preview.js
// Preview & run OCR — shows file info + options, calls /api/ocr-pdf, navigates to download

import { useState, useEffect, useRef } from "react"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import { useAuth } from "../../context/AuthContext"
import { useTranslations } from "../../lib/i18n"
import {
  ScanText, ArrowLeft, Play, FileText, Shield, Zap, Clock,
  Crown, CheckCircle2, AlertCircle, Download,
} from "lucide-react"
import { ocrPdfStore } from "./index"

const STAGES_EN = [
  { pct: 10, label: "Uploading document…" },
  { pct: 25, label: "Pre-processing pages…" },
  { pct: 45, label: "Running text extraction…" },
  { pct: 70, label: "Reconstructing text layout…" },
  { pct: 88, label: "Embedding text layer…" },
  { pct: 96, label: "Finalising your PDF…" },
]

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

export default function OcrPdfPreview() {
  const router = useLocalizedRouter()
  const { user } = useAuth()
  const { t } = useTranslations()
  const isPro = user?.plan === "pro" || user?.plan === "enterprise"

  const [file, setFile] = useState(null)
  const [status, setStatus] = useState("ready") // ready | processing | error
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [errMsg, setErrMsg] = useState("")

  const didRun = useRef(false)

  // Build translated stages, falling back to EN labels
  const stageLabels = (() => {
    const items = t("ocrPdf.process.stages")
    if (Array.isArray(items) && items.length >= 6) return items
    return STAGES_EN.map(s => s.label)
  })()

  const STAGES = STAGES_EN.map((s, i) => ({ pct: s.pct, label: stageLabels[i] || s.label }))

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true
    const f = ocrPdfStore.get()
    if (!f) {
      router.push("/ocr-pdf")
      return
    }
    setFile(f)
    setStage(STAGES[0].label)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunOcr = async () => {
    if (!file) return
    setStatus("processing")
    setProgress(0)
    setErrMsg("")

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

      const API_URL =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
          ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
          : `${window.location.protocol}//${window.location.hostname}`

      const res = await fetch(`${API_URL}/api/ocr-pdf`, {
        method: "POST",
        body: formData,
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {},
      })

      clearInterval(tick)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || `Server error ${res.status}`)
      }

      const data = await res.json()
      setProgress(100)
      sessionStorage.setItem("ocrPdfResult", JSON.stringify(data))
      ocrPdfStore.clear()
      setTimeout(() => router.push("/ocr-pdf/download"), 400)
    } catch (err) {
      clearInterval(tick)
      setErrMsg(err.message || "Something went wrong. Please try again.")
      setStatus("error")
    }
  }

  const formatSize = (bytes) => {
    if (!bytes) return ""
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    return (bytes / 1024).toFixed(0) + " KB"
  }

  if (!file) {
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
      <SEOHead title={t("ocrPdf.preview.pageTitle")} noIndex={true} />
      <Layout>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
          />
          <div className="relative max-w-4xl mx-auto px-4 py-5">
            <button
              onClick={() => router.push("/ocr-pdf")}
              className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t("ocrPdf.preview.changeFile")}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <ScanText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">{t("ocrPdf.preview.headerTitle")}</h1>
                <p className="text-xs text-white/80">{t("ocrPdf.preview.headerSubtitle")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ad */}
        <div className="bg-slate-50 px-4 pt-5">
          <div className="max-w-4xl mx-auto">
            <AdSenseUnit adSlot="8004544994" />
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-50 min-h-screen py-6 px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Main card */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

                {/* File info header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{formatSize(file.size)} · PDF</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      <span className="text-xs font-medium text-emerald-300">{t("ocrPdf.preview.fileReady")}</span>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5">
                  {status === "ready" && (
                    <>
                      {!isPro && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                          <div className="flex items-start gap-3">
                            <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-amber-900">{t("ocrPdf.preview.freePlanTitle")}</p>
                              <p className="text-xs text-amber-700 mt-1">{t("ocrPdf.preview.freePlanDesc")}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {isPro && (
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5">
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-violet-600" />
                            <span className="text-sm font-semibold text-violet-900">{t("ocrPdf.preview.proPlanDesc")}</span>
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-5">
                        <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">{t("ocrPdf.preview.whatYoullReceive")}</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            {t("ocrPdf.preview.receiveSearchablePdf")}
                          </div>
                          {isPro && (
                            <>
                              <div className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                {t("ocrPdf.preview.receiveDocx")}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                {t("ocrPdf.preview.receiveTxt")}
                              </div>
                            </>
                          )}
                          {!isPro && (
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Crown className="w-4 h-4 text-violet-400 flex-shrink-0" />
                              {t("ocrPdf.preview.receiveProOnly")}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleRunOcr}
                        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-violet-300/50"
                      >
                        <Play className="w-4 h-4" />
                        {t("ocrPdf.preview.runOcrButton")}
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-emerald-500" /> {t("ocrPdf.preview.securePrivate")}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-blue-500" /> {t("ocrPdf.preview.autoDeleted")}</span>
                      </div>
                    </>
                  )}

                  {status === "processing" && (
                    <div className="py-4">
                      <div className="text-center mb-6">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 border-4 border-violet-100 rounded-full" />
                          <div className="absolute inset-0 border-4 border-t-violet-600 border-r-violet-600 rounded-full animate-spin" />
                          <ScanText className="absolute inset-0 m-auto w-6 h-6 text-violet-600" />
                        </div>
                        <p className="font-bold text-slate-900 mb-1">{stage}</p>
                        <p className="text-sm text-slate-500">{progress}% {t("ocrPdf.preview.pleaseWait")}</p>
                      </div>
                      <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden mb-3">
                        <div
                          className="bg-gradient-to-r from-violet-600 to-purple-600 h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {status === "error" && (
                    <div className="text-center py-4">
                      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                      </div>
                      <h2 className="font-bold text-slate-900 mb-2">{t("ocrPdf.preview.ocrFailed")}</h2>
                      <p className="text-sm text-slate-600 mb-5">{errMsg}</p>
                      <div className="space-y-3">
                        <button
                          onClick={() => { setStatus("ready"); setProgress(0) }}
                          className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                          {t("ocrPdf.preview.tryAgain")}
                        </button>
                        {!isPro && errMsg.toLowerCase().includes("limit") && (
                          <a
                            href="/pricing"
                            className="flex items-center justify-center gap-2 w-full border-2 border-violet-200 text-violet-700 font-semibold py-3 rounded-xl hover:bg-violet-50 transition-colors text-sm"
                          >
                            <Crown className="w-4 h-4" /> {t("ocrPdf.preview.upgradeToPro")}
                          </a>
                        )}
                        <button
                          onClick={() => router.push("/ocr-pdf")}
                          className="w-full text-sm text-slate-500 hover:text-slate-700 underline"
                        >
                          {t("ocrPdf.preview.uploadDifferent")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">{t("ocrPdf.preview.advertisement")}</p>
                <AdSenseUnit adSlot="1617102171" />
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">{t("ocrPdf.preview.sidebarHowTitle")}</h3>
                <div className="space-y-2.5">
                  {[
                    { num: "1", color: "bg-violet-600" },
                    { num: "2", color: "bg-purple-600" },
                    { num: "3", color: "bg-fuchsia-600" },
                    { num: "4", color: "bg-emerald-600" },
                  ].map((s, i) => (
                    <div key={s.num} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 ${s.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{s.num}</div>
                      <span className="text-xs text-slate-700">{t(`ocrPdf.preview.sidebarSteps.${i}`)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">{t("ocrPdf.preview.sidebarSecurityTitle")}</h3>
                <div className="space-y-2">
                  {[
                    { icon: Shield,   color: "text-emerald-600 bg-emerald-100" },
                    { icon: Clock,    color: "text-blue-600 bg-blue-100"       },
                    { icon: Zap,      color: "text-violet-600 bg-violet-100"   },
                    { icon: Download, color: "text-amber-600 bg-amber-100"     },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color.split(" ")[1]}`}>
                        <item.icon className={`w-3.5 h-3.5 ${item.color.split(" ")[0]}`} />
                      </div>
                      <span className="text-xs text-slate-700">{t(`ocrPdf.preview.sidebarSecurityItems.${i}`)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!isPro && (
                <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl p-4 text-white">
                  <Crown className="w-5 h-5 mb-2 text-violet-200" />
                  <p className="font-bold text-sm mb-1">{t("ocrPdf.preview.sidebarProTitle")}</p>
                  <p className="text-xs text-violet-200 mb-3">{t("ocrPdf.preview.sidebarProDesc")}</p>
                  <a
                    href="/pricing"
                    className="block text-center bg-white text-violet-700 font-bold text-xs py-2 rounded-lg hover:bg-violet-50 transition-colors"
                  >
                    {t("ocrPdf.preview.sidebarProButton")}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}