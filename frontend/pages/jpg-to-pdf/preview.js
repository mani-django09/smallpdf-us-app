import { useState, useEffect } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { FileText, ArrowLeft, Sparkles, Shield, Zap, Clock, Play, Trash2, CheckCircle } from "lucide-react"
import AdUnit from "../../components/AdUnit"

import { jpgFileStore } from "./index"

export default function PreviewJpgToPdf() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])

  useEffect(() => {
    const storedFiles = jpgFileStore.get()

    if (storedFiles && storedFiles.length > 0) {
      try {
        // Build display data using object URLs (no base64 — no quota issues)
        const parsed = storedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.file.type,
          data: URL.createObjectURL(f.file), // fast, no memory bloat
          file: f.file,                       // keep raw File for upload
        }))
        setFilesData(parsed)
        setSelectedFiles(parsed.map((f) => f.id))
      } catch (err) {
        console.error("Error reading file data:", err)
        router.push("/jpg-to-pdf")
      }
    } else {
      router.push("/jpg-to-pdf")
    }
  }, [])

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]))
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))

    // Update the in-memory store to keep it in sync
    const stored = jpgFileStore.get() || []
    jpgFileStore.set(jpgFileStore.get().filter((f) => f.id !== id))

    if (newFiles.length === 0) {
      router.push("/jpg-to-pdf")
    }
  }

  const handleConvert = async () => {
    const filesToConvert = filesData.filter((f) => selectedFiles.includes(f.id))
    if (filesToConvert.length === 0) return

    setConverting(true)
    setProgress(0)
    setStage(t('jpgToPdf.preview.stages.preparing'))

    const stages = [
      { progress: 15, text: t('jpgToPdf.preview.stages.convertingJpeg'), delay: 400 },
      { progress: 35, text: t('jpgToPdf.preview.stages.uploading'), delay: 500 },
      { progress: 55, text: t('jpgToPdf.preview.stages.creatingPdf'), delay: 600 },
      { progress: 75, text: t('jpgToPdf.preview.stages.embedding'), delay: 400 },
      { progress: 90, text: t('jpgToPdf.preview.stages.finalizing'), delay: 300 },
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

      for (const fileData of filesToConvert) {
        // fileData.file is the raw File object — append directly, no canvas needed
        formData.append('files', fileData.file, fileData.name)
      }

      setProgress(95)
      setStage(t('jpgToPdf.preview.stages.sending'))

      const { hostname, protocol } = window.location
      const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
        : `${protocol}//${hostname}`

      const response = await fetch(`${API_URL}/api/jpg-to-pdf`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to convert images")
      }

      const result = await response.json()
      
      setProgress(100)
      setStage(t('jpgToPdf.preview.stages.complete'))

      sessionStorage.setItem("jpgConvertResult", JSON.stringify(result))
      jpgFileStore.clear()

      setTimeout(() => {
        router.push(`/jpg-to-pdf/download?jobId=${result.jobId}`)
      }, 500)
    } catch (err) {
      console.error("Conversion error:", err)
      setConverting(false)
      setProgress(0)
      setStage("")
      alert(err.message || "Something went wrong. Please try again.")
    }
  }

  if (filesData.length === 0) {
    return null
  }

  return (
    <>
      <SEOHead 
        title={t('jpgToPdf.title')}
        description={t('jpgToPdf.description')}
        keywords={t('jpgToPdf.keywords')}
        noIndex={true}
      />
      <Layout>
        <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 min-h-screen py-8 px-4">
          <div className="max-w-7xl mx-auto">

            {/* Header Ad */}
            <AdUnit slot="8004544994" label="Header Ad" className="mb-6 rounded-xl overflow-hidden" />

            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => router.push("/jpg-to-pdf")}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-4 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>{t('jpgToPdf.preview.backToUpload')}</span>
              </button>

              <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                {t('jpgToPdf.preview.title')}
              </h1>
              <p className="font-body text-slate-600">
                {filesData.length} {t('jpgToPdf.preview.imagesReady')} {t('jpgToPdf.preview.reviewText')}
              </p>
            </div>

            {/* Two-column layout: main content + sidebar */}
            <div className="flex flex-col lg:flex-row gap-6">

              {/* Main content */}
              <div className="flex-1 min-w-0">

            {/* Files Grid */}
            <div className="bg-white rounded-xl border-2 border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-slate-900">{t('jpgToPdf.preview.yourImages')}</h2>
                    <p className="text-sm text-slate-600">
                      {selectedFiles.length} / {filesData.length} {t('jpgToPdf.preview.selected')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedFiles(filesData.map((f) => f.id))}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                  >
                    {t('jpgToPdf.preview.selectAll')}
                  </button>
                  <span className="text-slate-400">|</span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-sm text-slate-600 hover:text-slate-700 font-semibold transition-colors"
                  >
                    {t('jpgToPdf.preview.deselectAll')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filesData.map((file, index) => (
                  <div
                    key={file.id}
                    className={`relative group border-2 rounded-lg overflow-hidden transition-all ${
                      selectedFiles.includes(file.id)
                        ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="aspect-square bg-slate-100 relative">
                      <img src={file.data} alt={file.name} className="w-full h-full object-cover" />

                      <button
                        onClick={() => toggleFileSelection(file.id)}
                        className="absolute top-2 left-2 w-6 h-6 rounded-md bg-white border-2 border-slate-300 flex items-center justify-center hover:border-blue-500 transition-colors"
                      >
                        {selectedFiles.includes(file.id) && (
                          <CheckCircle className="w-5 h-5 text-blue-600" fill="currentColor" />
                        )}
                      </button>

                      <button
                        onClick={() => removeFile(file.id)}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t('jpgToPdf.preview.removeImage')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="absolute bottom-2 left-2 bg-slate-900/75 text-white text-xs px-2 py-1 rounded">
                        #{index + 1}
                      </div>
                    </div>

                    <div className="p-2 bg-white">
                      <p className="text-xs font-medium text-slate-900 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Convert Section */}
            <div className="bg-white rounded-xl border-2 border-slate-200 p-6">
              {converting ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>

                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                    {t('jpgToPdf.preview.converting')}
                  </h3>
                  <p className="text-slate-600 mb-6">{stage}</p>

                  <div className="max-w-md mx-auto">
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-700 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{progress}% {t('jpgToPdf.preview.stages.complete').replace('!','')}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <h3 className="font-display text-2xl font-bold text-slate-900 mb-4">
                    {t('jpgToPdf.preview.readyToConvert')}
                  </h3>

                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-semibold text-slate-900 text-sm">{t('jpgToPdf.features.secure.title')}</p>
                        <p className="text-xs text-slate-600">{t('jpgToPdf.features.secure.desc')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                      <Zap className="w-6 h-6 text-green-600 flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-semibold text-slate-900 text-sm">{t('jpgToPdf.features.fast.title')}</p>
                        <p className="text-xs text-slate-600">{t('jpgToPdf.features.fast.desc')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                      <Sparkles className="w-6 h-6 text-purple-600 flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-semibold text-slate-900 text-sm">{t('jpgToPdf.features.quality.title')}</p>
                        <p className="text-xs text-slate-600">{t('jpgToPdf.features.quality.desc')}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleConvert}
                    disabled={selectedFiles.length === 0}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Play className="w-6 h-6" />
                    <span>
                      {t('jpgToPdf.preview.convertButton')} {selectedFiles.length} {t('jpgToPdf.preview.imagesReady').replace('.','')} PDF
                    </span>
                  </button>

                  {selectedFiles.length === 0 && (
                    <p className="text-sm text-red-600 mt-3">{t('jpgToPdf.preview.selectAtLeastOne')}</p>
                  )}
                </div>
              )}
            </div>

              </div>{/* end main content */}

              {/* Sidebar */}
              <div className="lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
                {/* Sidebar Ad */}
                <div className="bg-white rounded-xl border-2 border-slate-200 p-3">
                  <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">Advertisement</p>
                  <AdUnit slot="1617102171" label="Preview Sidebar" />
                </div>

                {/* Tip box */}
                <div className="bg-blue-50 rounded-xl border-2 border-blue-100 p-4">
                  <h3 className="font-bold text-slate-800 text-sm mb-2">💡 Quick Tips</h3>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li>✓ Drag to reorder images before converting</li>
                    <li>✓ Uncheck images to exclude them from the PDF</li>
                    <li>✓ All files are deleted after 1 hour</li>
                  </ul>
                </div>
              </div>{/* end sidebar */}

            </div>{/* end two-column */}
          </div>
        </div>
      </Layout>
    </>
  )
}