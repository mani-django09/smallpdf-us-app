import { useState, useEffect } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import {
  ImageIcon,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Zap,
  Clock,
  Play,
  FileImage,
  Settings,
  Palette,
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

export default function PreviewPDFToJPG() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const [fileData, setFileData] = useState(null)
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [quality, setQuality] = useState("high")
  const [convertError, setConvertError] = useState("")

  useEffect(() => {
    const storedFile = sessionStorage.getItem("uploadedPDFFile")

    if (storedFile) {
      try {
        const parsed = JSON.parse(storedFile)
        setFileData(parsed)
      } catch (err) {
        console.error("Error parsing file data:", err)
        router.push("/pdf-to-jpg")
      }
    } else {
      router.push("/pdf-to-jpg")
    }
  }, [])  // run once on mount only

  const handleConvert = async () => {
    if (!fileData) return

    setConverting(true)
    setConvertError("")
    setProgress(0)
    setStage(t('pdfToJpg.stage1'))

    const stages = [
      { progress: 15, text: t('pdfToJpg.stage1'), delay: 400 },
      { progress: 30, text: t('pdfToJpg.stage2'), delay: 500 },
      { progress: 50, text: t('pdfToJpg.stage3'), delay: 600 },
      { progress: 70, text: t('pdfToJpg.stage4'), delay: 400 },
      { progress: 85, text: t('pdfToJpg.stage5'), delay: 300 },
      { progress: 95, text: t('pdfToJpg.stage6'), delay: 200 },
    ]

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
      const response = await fetch(fileData.data)
      const blob = await response.blob()
      const file = new File([blob], fileData.name, { type: fileData.type })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("quality", quality)

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      const convertResponse = await fetch(`${API_URL}/api/pdf-to-jpg`, {
        method: "POST",
        body: formData,
      })

      const result = await convertResponse.json()

      setProgress(100)
      setStage(t('pdfToJpg.stageComplete'))

      if (convertResponse.ok) {
        sessionStorage.setItem("jpgConversionResult", JSON.stringify(result))
        setTimeout(() => {
          router.push(`/pdf-to-jpg/download?file=${encodeURIComponent(result.downloadUrl)}`)
        }, 500)
      } else {
        // Show error inline instead of alert()
        setConvertError(t('pdfToJpg.conversionFailed') + (result.error || ''))
        setConverting(false)
      }
    } catch (error) {
      console.error("Conversion error:", error)
      setConvertError(t('pdfToJpg.convertError'))
      setConverting(false)
    }
  }
  if (!fileData) {
    return (
      <Layout>
        <SEOHead title={t('pdfToJpg.previewPageTitle') || "Preview & Convert - PDF to JPG | SmallPDF.us"} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-amber-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pdfToJpg.loading')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Preview & Convert - PDF to JPG" description="Preview your PDF and convert to JPG images">
      {/* noIndex — transient post-upload page, no static indexable content */}
      <SEOHead title={t('pdfToJpg.previewPageTitle') || "Preview & Convert - PDF to JPG | SmallPDF.us"} noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Compact Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 relative overflow-hidden">
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
            onClick={() => router.push("/pdf-to-jpg")}
            className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-xs font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t('pdfToJpg.changeFile')}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <FileImage className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white">{t('pdfToJpg.readyToExtract')}</h1>
              <p className="font-body text-xs text-white/80">{t('pdfToJpg.configureStart')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-5">
        <div className="max-w-4xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Card */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* File Info Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-white truncate">
                        {fileData.name}
                      </p>
                      <p className="font-body text-xs text-slate-400">
                        {(fileData.size / 1024).toFixed(1)} KB • PDF
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                      <span className="text-xs font-medium text-emerald-300">{t('pdfToJpg.ready')}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {!converting ? (
                    <>
                      {/* Quality Selection */}
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200 mb-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Settings className="w-4 h-4 text-slate-600" />
                          <h3 className="font-display text-sm font-semibold text-slate-900">{t('pdfToJpg.outputQuality')}</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "standard", label: t('pdfToJpg.qualityStandard'), dpi: t('pdfToJpg.dpi150'), desc: t('pdfToJpg.goodForWeb') },
                            { id: "high", label: t('pdfToJpg.qualityHigh'), dpi: t('pdfToJpg.dpi300'), desc: t('pdfToJpg.printQuality') },
                            { id: "maximum", label: t('pdfToJpg.qualityMaximum'), dpi: t('pdfToJpg.dpi600'), desc: t('pdfToJpg.bestDetail') },
                          ].map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setQuality(option.id)}
                              className={`p-3 rounded-lg border-2 transition-all text-left ${
                                quality === option.id
                                  ? "border-amber-500 bg-amber-50"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="font-display text-xs font-semibold text-slate-900">{option.label}</div>
                              <div className="text-xs text-amber-600 font-medium">{option.dpi}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{option.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Status Card */}
                      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 text-center border border-amber-200 mb-5">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-sm mb-3 border border-amber-200">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900 mb-1">
                          {t('pdfToJpg.analyzedSuccess')}
                        </h3>
                        <p className="font-body text-sm text-slate-600">{t('pdfToJpg.pagesReady')}</p>
                      </div>

                      {/* Conversion Error */}
                      {convertError && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                          <span className="text-red-600 mt-0.5">⚠</span>
                          <div className="flex-1">
                            <p className="font-body text-sm text-red-700">{convertError}</p>
                            <button
                              onClick={() => setConvertError("")}
                              className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
                            >
                              {t('pdfToJpg.dismiss')}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Convert Button */}
                      <button
                        onClick={handleConvert}
                        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:from-amber-700 hover:to-orange-700 hover:shadow-lg hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        <span>{t('pdfToJpg.extractButton')}</span>
                      </button>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">
                            {(fileData.size / 1024).toFixed(0)}
                          </div>
                          <div className="font-body text-xs text-slate-500">{t('pdfToJpg.kbSize')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-emerald-600">&lt;5s</div>
                          <div className="font-body text-xs text-slate-500">{t('pdfToJpg.estTime')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-amber-600">300</div>
                          <div className="font-body text-xs text-slate-500">{t('pdfToJpg.dpiOutput')}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <div className="text-center mb-5">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-amber-600 border-r-amber-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                        <p className="font-body text-sm text-slate-600">{progress}% {t('pdfToJpg.progressComplete')}</p>
                      </div>

                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                        <div
                          className="bg-gradient-to-r from-amber-600 to-orange-600 h-full transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="font-body text-xs text-amber-800 text-center">
                          {t('pdfToJpg.extractingImages')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Sidebar Ad */}
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">Advertisement</p>
                <AdSenseUnit adSlot="1617102171" />
              </div>
              {/* Features */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('pdfToJpg.whatYouGet')}</h3>
                <div className="space-y-2.5">
                  {[
                    { icon: Palette, text: t('pdfToJpg.vividColor'), color: "text-amber-600 bg-amber-100" },
                    { icon: Shield, text: t('pdfToJpg.secureHandling'), color: "text-emerald-600 bg-emerald-100" },
                    { icon: Zap, text: t('pdfToJpg.rapidProcessing'), color: "text-yellow-600 bg-yellow-100" },
                    { icon: Clock, text: t('pdfToJpg.autoCleanup'), color: "text-blue-600 bg-blue-100" },
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
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('pdfToJpg.extractionProcess')}</h3>
                <div className="space-y-2">
                  {[
                    { num: "1", text: t('pdfToJpg.parsePdf'), color: "bg-amber-600" },
                    { num: "2", text: t('pdfToJpg.renderPages'), color: "bg-orange-600" },
                    { num: "3", text: t('pdfToJpg.downloadJpg'), color: "bg-emerald-600" },
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
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-2">{t('pdfToJpg.outputFormat')}</h3>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p>{t('pdfToJpg.individualJpg')}</p>
                  <p>{t('pdfToJpg.zipArchive')}</p>
                  <p>{t('pdfToJpg.optimizedSizes')}</p>
                  <p>{t('pdfToJpg.universalCompat')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}