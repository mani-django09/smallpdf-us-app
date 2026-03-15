import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import {
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Zap,
  Clock,
  Play,
  FileText,
  Settings,
  AlignLeft,
  AlignCenter,
} from "lucide-react"
import { excelToPdfStore } from "./index"
import AdUnit from "../../components/AdUnit"

// Dev: NEXT_PUBLIC_API_URL=http://localhost:5011 | Prod: same-origin
function getApiUrl() {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
  const { hostname, protocol } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
  }
  return `${protocol}//${hostname}`
}

export default function PreviewExcelToPDF() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [fileData, setFileData] = useState(null)
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [orientation, setOrientation] = useState("portrait")
  const [fitToPage, setFitToPage] = useState(true)

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    // Read from in-memory store (no size limit, no base64)
    if (excelToPdfStore.file && excelToPdfStore.meta) {
      setFileData(excelToPdfStore.meta)
    } else {
      // Store cleared (e.g. page refresh) — send back to upload
      routerRef.current.push("/excel-to-pdf")
    }
  }, [])

  const handleConvert = async () => {
    if (!fileData) return

    setConverting(true)
    setProgress(0)

    // All stage labels now come from the translation JSON — no more locale ternaries
    const stages = [
      { progress: 15, text: t("excelToPdf.stages.uploading"),   delay: 400 },
      { progress: 30, text: t("excelToPdf.stages.analyzing"),   delay: 500 },
      { progress: 50, text: t("excelToPdf.stages.rendering"),   delay: 600 },
      { progress: 70, text: t("excelToPdf.stages.converting"),  delay: 400 },
      { progress: 85, text: t("excelToPdf.stages.building"),    delay: 300 },
      { progress: 95, text: t("excelToPdf.stages.packaging"),   delay: 200 },
    ]

    setStage(stages[0].text)

    let currentStage = 0
    const updateProgress = () => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage].progress)
        setStage(stages[currentStage].text)
        currentStage++
        setTimeout(updateProgress, stages[currentStage - 1].delay)
      }
    }
    updateProgress()

    try {
      // Use raw File object directly — no base64, no fetch(data:URL)
      const formData = new FormData()
      formData.append("file", excelToPdfStore.file, excelToPdfStore.file.name)
      formData.append("orientation", orientation)
      formData.append("fitToPage", fitToPage)

      const API_URL = getApiUrl()
      console.log('Sending request to backend...')
      const convertResponse = await fetch(`${API_URL}/api/excel-to-pdf`, {
        method: "POST",
        body: formData,
      })

      console.log('Response status:', convertResponse.status)

      // Safe JSON parse — server may return HTML on 500
      let result
      const contentType = convertResponse.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        result = await convertResponse.json()
      } else {
        const text = await convertResponse.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        throw new Error(`Server error ${convertResponse.status}: Check LibreOffice is installed`)
      }

      console.log('Response data:', result)

      setProgress(100)
      setStage(t("excelToPdf.stages.complete"))

      if (convertResponse.ok && (result.downloadUrl || (result.files && result.files.length > 0))) {
        // Use downloadUrl if present, otherwise build from jobId as fallback
        const rawUrl = result.downloadUrl || `/api/download-excel-pdf/${result.jobId}`

        // Make downloadUrl absolute for dev/prod compatibility
        const absoluteDownloadUrl = rawUrl.startsWith('http')
          ? rawUrl
          : `${API_URL}${rawUrl}`

        // convertedName is now the clean "MyFile.pdf" (not the internal prefixed upload name)
        const cleanName = result.convertedName
          || (result.files && result.files[0] && result.files[0].filename)
          || (result.originalName
              ? result.originalName.replace(/\.(xlsx|xls)$/i, ".pdf")
              : "converted.pdf")

        sessionStorage.setItem("excelToPdfResult", JSON.stringify({
          ...result,
          downloadUrl: absoluteDownloadUrl,
          convertedName: cleanName,
          originalName: result.originalName || (result.files && result.files[0] && result.files[0].originalName),
          fileSize: result.fileSize || (result.files && result.files[0] && result.files[0].fileSize),
        }))
        setTimeout(() => {
          router.push(`/excel-to-pdf/download`)
        }, 500)
      } else {
        console.error("Conversion failed:", result.error || result)
        alert(`${t("excelToPdf.stages.failed")}: ${result.error || result.details || "Unknown error. Make sure LibreOffice is installed on the server."}`)
        setConverting(false)
        setProgress(0)
        setStage("")
      }
    } catch (error) {
      console.error("Error:", error)
      setConverting(false)
      setProgress(0)
      setStage("")
    }
  }

  if (!fileData) {
    return (
      <Layout>
        <SEOHead
          title="Excel to PDF - Preview | SmallPDF.us"
          description="Review and convert your Excel file to PDF."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("excelToPdf.loading")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      title={t("excelToPdf.previewTitle")}
      description={t("excelToPdf.previewDescription")}
    >
      <SEOHead
        title="Excel to PDF - Preview | SmallPDF.us"
        description="Review and convert your Excel file to PDF."
        noIndex={true}
      />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Compact Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-green-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-5">
          <button
            onClick={() => router.push("/excel-to-pdf")}
            className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-xs font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t("excelToPdf.changeFile")}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                {t("excelToPdf.readyToConvert")}
              </h1>
              <p className="font-body text-xs text-white/80">{t("excelToPdf.configureStart")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-6">
        <div className="max-w-5xl mx-auto">
          <AdUnit slot="8004544994" label="Header Ad" className="rounded-xl overflow-hidden" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_280px] gap-5">
          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* File Info Bar */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm font-semibold text-white truncate">{fileData.name}</p>
                <p className="font-body text-xs text-slate-400">
                  {(fileData.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                <span className="text-xs font-medium text-emerald-300">{t("excelToPdf.ready")}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              {!converting ? (
                <>
                  {/* Output Settings */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200 mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Settings className="w-4 h-4 text-slate-600" />
                      <h3 className="font-display text-sm font-semibold text-slate-900">
                        {t("excelToPdf.outputSettings")}
                      </h3>
                    </div>

                    {/* Orientation */}
                    <div className="mb-4">
                      <p className="font-body text-xs text-slate-500 mb-2">{t("excelToPdf.orientationLabel")}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            id: "portrait",
                            label: t("excelToPdf.orientationPortrait"),
                            desc: t("excelToPdf.orientationPortraitDesc"),
                            icon: AlignLeft,
                          },
                          {
                            id: "landscape",
                            label: t("excelToPdf.orientationLandscape"),
                            desc: t("excelToPdf.orientationLandscapeDesc"),
                            icon: AlignCenter,
                          },
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setOrientation(option.id)}
                            className={`p-3 rounded-lg border-2 transition-all text-left flex items-center gap-2.5 ${
                              orientation === option.id
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <option.icon
                              className={`w-4 h-4 flex-shrink-0 ${
                                orientation === option.id ? "text-emerald-600" : "text-slate-400"
                              }`}
                            />
                            <div>
                              <div className="font-display text-xs font-semibold text-slate-900">
                                {option.label}
                              </div>
                              <div className="text-xs text-slate-500">{option.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fit to Page Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-display text-xs font-semibold text-slate-900">
                          {t("excelToPdf.fitToPage")}
                        </p>
                        <p className="font-body text-xs text-slate-500">{t("excelToPdf.fitToPageDesc")}</p>
                      </div>
                      <button
                        onClick={() => setFitToPage(!fitToPage)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          fitToPage ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            fitToPage ? "translate-x-4.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Status Card */}
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 text-center border border-emerald-200 mb-5">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-sm mb-3 border border-emerald-200">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 mb-1">
                      {t("excelToPdf.analyzedSuccess")}
                    </h3>
                    <p className="font-body text-sm text-slate-600">{t("excelToPdf.sheetsReady")}</p>
                  </div>

                  {/* Convert Button */}
                  <button
                    onClick={handleConvert}
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:from-emerald-700 hover:to-green-700 hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>{t("excelToPdf.convertButton")}</span>
                  </button>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-5">
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="font-display text-lg font-bold text-slate-900">
                        {(fileData.size / 1024).toFixed(0)}
                      </div>
                      <div className="font-body text-xs text-slate-500">{t("excelToPdf.kbSize")}</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="font-display text-lg font-bold text-emerald-600">&lt;5s</div>
                      <div className="font-body text-xs text-slate-500">{t("excelToPdf.estTime")}</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="font-display text-lg font-bold text-emerald-600">PDF</div>
                      <div className="font-body text-xs text-slate-500">{t("excelToPdf.sheetsCount")}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6">
                  <div className="text-center mb-5">
                    <div className="relative w-14 h-14 mx-auto mb-4">
                      <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-emerald-600 border-r-emerald-600 rounded-full animate-spin"></div>
                    </div>
                    <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                    <p className="font-body text-sm text-slate-600">
                      {progress}% {t("excelToPdf.stages.progressSuffix")}
                    </p>
                  </div>

                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                    <div
                      className="bg-gradient-to-r from-emerald-600 to-green-600 h-full transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="font-body text-xs text-emerald-800 text-center">
                      {t("excelToPdf.convertingFile")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* What You Get */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                {t("excelToPdf.whatYouGet")}
              </h3>
              <div className="space-y-2.5">
                {[
                  { icon: FileText, text: t("excelToPdf.formattingPreserved"), color: "text-emerald-600 bg-emerald-100" },
                  { icon: Shield, text: t("excelToPdf.secureHandling"), color: "text-blue-600 bg-blue-100" },
                  { icon: Zap, text: t("excelToPdf.rapidProcessing"), color: "text-yellow-600 bg-yellow-100" },
                  { icon: Clock, text: t("excelToPdf.autoCleanup"), color: "text-purple-600 bg-purple-100" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color.split(" ")[1]}`}
                    >
                      <item.icon className={`w-3.5 h-3.5 ${item.color.split(" ")[0]}`} />
                    </div>
                    <span className="font-body text-xs text-slate-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Process Steps */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                {t("excelToPdf.conversionProcess")}
              </h3>
              <div className="space-y-2">
                {[
                  { num: "1", text: t("excelToPdf.parseExcel"), color: "bg-emerald-600" },
                  { num: "2", text: t("excelToPdf.renderSheets"), color: "bg-green-600" },
                  { num: "3", text: t("excelToPdf.buildPdf"), color: "bg-teal-600" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div
                      className={`w-5 h-5 ${step.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                    >
                      {step.num}
                    </div>
                    <span className="font-body text-xs text-slate-700">{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Output Info */}
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200">
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-2">
                {t("excelToPdf.outputFormat")}
              </h3>
              <div className="space-y-1.5 text-xs text-slate-600">
                <p>{t("excelToPdf.allSheetsIncluded")}</p>
                <p>{t("excelToPdf.formatsRetained")}</p>
                <p>{t("excelToPdf.chartsConverted")}</p>
                <p>{t("excelToPdf.universalCompat")}</p>
              </div>
            </div>

            {/* Sidebar Ad */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body">Advertisement</p>
              <AdUnit slot="1617102171" label="Preview Sidebar" />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}