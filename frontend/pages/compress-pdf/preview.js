import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from '../../lib/i18n'
import { FileText, ArrowLeft, Sparkles, Shield, Zap, Clock, Play, Trash2, CheckCircle, Minimize2 } from "lucide-react"
import { compressPdfStore } from "./index"
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

export default function PreviewCompressPdf() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [compressionLevel, setCompressionLevel] = useState("balanced")

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    // Read raw File objects from memory store (no size limit, no base64 needed)
    if (compressPdfStore.files && compressPdfStore.files.length > 0) {
      const files = compressPdfStore.files
      setFilesData(files)
      setSelectedFiles(files.map((f) => f.id))
      const storedLevel = sessionStorage.getItem("compressionLevel")
      if (storedLevel) setCompressionLevel(storedLevel)
    } else {
      // Store cleared (e.g. page refresh) — send back to upload
      routerRef.current.push("/compress-pdf")
    }
  }, [])

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]))
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))
    compressPdfStore.files = newFiles

    if (newFiles.length === 0) {
      router.push("/compress-pdf")
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + " " + t('compressPdf.unitMB')
    }
    return (bytes / 1024).toFixed(1) + " " + t('compressPdf.unitKB')
  }

  const handleCompress = async () => {
  const filesToCompress = filesData.filter((f) => selectedFiles.includes(f.id))
  if (filesToCompress.length === 0) return

  setCompressing(true)
  setProgress(0)
  setStage(t('compressPdf.preview.stages.preparing'))

  const stages = [
    { progress: 15, text: t('compressPdf.preview.stages.uploading'), delay: 400 },
    { progress: 35, text: t('compressPdf.preview.stages.analyzing'), delay: 500 },
    { progress: 55, text: t('compressPdf.preview.stages.optimizing'), delay: 700 },
    { progress: 75, text: t('compressPdf.preview.stages.compressing'), delay: 500 },
    { progress: 90, text: t('compressPdf.preview.stages.finalizing'), delay: 300 },
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
    const formData = new FormData()

    // Append raw File objects directly — no base64 conversion needed
    for (const fileData of filesToCompress) {
      formData.append("files", fileData.file, fileData.name)
    }
    formData.append("level", compressionLevel)

    const API_URL = getApiUrl()
    const response = await fetch(`${API_URL}/api/compress-pdf-batch`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(errText || `Server error: ${response.status}`)
    }

    const result = await response.json()

    setProgress(100)
    setStage(t('compressPdf.preview.stages.complete'))

    sessionStorage.setItem(
      "pdfCompressResult",
      JSON.stringify({
        ...result,
        fileCount: filesToCompress.length,
        totalOriginalSize: filesToCompress.reduce((acc, f) => acc + f.size, 0),
        compressionLevel,
      }),
    )
    
    setTimeout(() => {
      router.push(`/compress-pdf/download?jobId=${result.jobId}`)
    }, 500)
  } catch (error) {
    console.error("Compression Error:", error)
    setCompressing(false)
    setProgress(0)
    setStage("")
  }
}

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)
  const selectedCount = selectedFiles.length

  const compressionOptions = [
    {
      id: "maximum",
      name: t('compressPdf.preview.maximum.name'),
      desc: t('compressPdf.preview.maximum.desc'),
      reduction: t('compressPdf.preview.maximum.reduction'),
      color: "bg-blue-600",
    },
    {
      id: "balanced",
      name: t('compressPdf.preview.balanced.name'),
      desc: t('compressPdf.preview.balanced.desc'),
      reduction: t('compressPdf.preview.balanced.reduction'),
      color: "bg-rose-600",
    },
    {
      id: "extreme",
      name: t('compressPdf.preview.extreme.name'),
      desc: t('compressPdf.preview.extreme.desc'),
      reduction: t('compressPdf.preview.extreme.reduction'),
      color: "bg-amber-600",
    },
  ]

  const compressionLabels = {
    maximum: { name: t('compressPdf.preview.maximum.name'), reduction: t('compressPdf.preview.maximum.reduction') },
    balanced: { name: t('compressPdf.preview.balanced.name'), reduction: t('compressPdf.preview.balanced.reduction') },
    extreme:  { name: t('compressPdf.preview.extreme.name'),  reduction: t('compressPdf.preview.extreme.reduction')  },
  }

  if (filesData.length === 0) {
    return (
      <Layout>
        <SEOHead
          title="Compress PDF - Preview | SmallPDF.us"
          description="Review and compress your PDF files."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-rose-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('compressPdf.gettingReady')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Preview & Compress - PDF Compressor" description="Review your PDF files and compress them">
      <SEOHead
        title="Compress PDF - Preview | SmallPDF.us"
        description="Review and compress your PDF files."
        noIndex={true}
      />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display {
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .font-body {
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>

      {/* Header */}
      <div className="bg-rose-600 relative overflow-hidden">
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
            onClick={() => router.push("/compress-pdf")}
            className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-xs font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t('compressPdf.preview.changeFiles')}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <Minimize2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                {t('compressPdf.preview.readyToCompress')} {filesData.length} PDF{filesData.length > 1 ? "s" : ""}
              </h1>
              <p className="font-body text-xs text-white/80">{t('compressPdf.preview.chooseCompressionLevel')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-6">
        <div className="max-w-4xl mx-auto">
          <AdUnit slot="8004544994" label="Header Ad" className="rounded-xl overflow-hidden" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Card */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-slate-800 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-rose-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <Minimize2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-semibold text-white">
                          {selectedCount} {t('compressPdf.preview.selectedOf')} {filesData.length} {t('compressPdf.preview.selected')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{t('compressPdf.preview.total')}: {formatFileSize(totalSize)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-rose-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                      <span className="text-xs font-medium text-rose-300">{t('compressPdf.preview.ready')}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {!compressing ? (
                    <>
                      {/* Compression Level Selector */}
                      <div className="mb-5">
                        <h3 className="font-display text-sm font-semibold text-slate-700 mb-3">
                          {t('compressPdf.preview.chooseLevel')}
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {compressionOptions.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setCompressionLevel(option.id)}
                              className={`p-3 rounded-xl border-2 transition-all text-left ${
                                compressionLevel === option.id
                                  ? "border-rose-500 bg-rose-50 shadow-md"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
                              }`}
                            >
                              <div
                                className={`w-8 h-8 ${option.color} rounded-lg flex items-center justify-center mb-2`}
                              >
                                <Minimize2 className="w-4 h-4 text-white" />
                              </div>
                              <p className="text-xs font-semibold text-slate-900">{option.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{option.reduction} {t('compressPdf.preview.estSmaller')}</p>
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                          {compressionLevel === "maximum" && t('compressPdf.preview.maximum.hint')}
                          {compressionLevel === "balanced" && t('compressPdf.preview.balanced.hint')}
                          {compressionLevel === "extreme"  && t('compressPdf.preview.extreme.hint')}
                        </p>
                      </div>

                      {/* File List */}
                      <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-display text-sm font-semibold text-slate-900">{t('compressPdf.preview.yourPdfFiles')}</h3>
                          <button
                            onClick={() =>
                              setSelectedFiles(
                                selectedFiles.length === filesData.length ? [] : filesData.map((f) => f.id),
                              )
                            }
                            className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                          >
                            {selectedFiles.length === filesData.length ? t('compressPdf.preview.deselectAll') : t('compressPdf.preview.selectAll')}
                          </button>
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {filesData.map((f) => (
                            <div
                              key={f.id}
                              onClick={() => toggleFileSelection(f.id)}
                              className={`relative group cursor-pointer rounded-lg border-2 transition-all p-3 flex items-center gap-3 ${
                                selectedFiles.includes(f.id)
                                  ? "border-rose-500 bg-rose-50"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
                              }`}
                            >
                              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                                <FileText className="w-5 h-5 text-rose-600" />
                                {selectedFiles.includes(f.id) && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                                <p className="text-xs text-slate-500">{formatFileSize(f.size)}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeFile(f.id)
                                }}
                                className="p-1.5 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Compress Button */}
                      <button
                        onClick={handleCompress}
                        disabled={selectedCount === 0}
                        className="w-full bg-rose-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:bg-rose-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="w-4 h-4" />
                        <span>
                          {selectedCount !== 1 ? t('compressPdf.preview.compressBtnPlural').replace('{n}', selectedCount) : t('compressPdf.preview.compressBtn').replace('{n}', selectedCount)}
                        </span>
                      </button>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">{selectedCount}</div>
                          <div className="font-body text-xs text-slate-500">{t('compressPdf.preview.selected')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-rose-600">
                            {compressionLabels[compressionLevel].reduction}
                          </div>
                          <div className="font-body text-xs text-slate-500">{t('compressPdf.preview.estSmaller')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">&lt;10s</div>
                          <div className="font-body text-xs text-slate-500">{t('compressPdf.preview.estTime')}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <div className="text-center mb-5">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-rose-600 border-r-rose-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                        <p className="font-body text-sm text-slate-600">{progress}{t('compressPdf.preview.percentComplete')}</p>
                      </div>

                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                        <div
                          className="bg-rose-600 h-full transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                        <p className="font-body text-xs text-rose-800 text-center">
                          {selectedCount !== 1 ? t('compressPdf.preview.compressBtnPlural').replace('{n}', selectedCount) : t('compressPdf.preview.compressBtn').replace('{n}', selectedCount)}{" "}
                          {compressionLabels[compressionLevel].name} {t('compressPdf.preview.compressingWith')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('compressPdf.preview.whatYouGet')}</h3>
                <div className="space-y-2.5">
                  {[
                    {
                      icon: Sparkles,
                      text: `${compressionLabels[compressionLevel].reduction} ${t('compressPdf.preview.estSmaller')}`,
                      color: "text-rose-600 bg-rose-100",
                    },
                    { icon: Shield, text: t('compressPdf.preview.secureProcessing'), color: "text-slate-600 bg-slate-100" },
                    { icon: Zap,    text: t('compressPdf.preview.fastCompression'),  color: "text-amber-600 bg-amber-100" },
                    { icon: Clock,  text: t('compressPdf.preview.autoDelete'),        color: "text-slate-600 bg-slate-100" },
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

              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">{t('compressPdf.preview.compressionSteps')}</h3>
                <div className="space-y-2">
                  {[
                    { num: "1", text: t('compressPdf.preview.step1'), color: "bg-rose-600" },
                    { num: "2", text: t('compressPdf.preview.step2'), color: "bg-slate-600" },
                    { num: "3", text: t('compressPdf.preview.step3'), color: "bg-slate-800" },
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

              {/* Sidebar Ad */}
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body">Advertisement</p>
                <AdUnit slot="1617102171" label="Preview Sidebar" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}