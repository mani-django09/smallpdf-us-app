import { useState, useCallback, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "@/components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "@/components/SEOHead"
import { Upload, FileText, AlertCircle, CheckCircle2, Zap, Shield, ChevronDown, Trash2, FileType, Eye, X } from "lucide-react"
import { useTranslations } from "@/lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"

// Module-level store for File objects — survives navigation within the session
// but avoids bloating sessionStorage with base64 data (Bug #8 fix)
export const pendingPdfFiles = { current: [] }

export default function PdfToWord() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('pdf-to-word')
  const { checkBatch, BatchGateModal } = useBatchGuard('pdf-to-word')
  const [files, setFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState("")
  const [openFaq, setOpenFaq] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewModal, setPreviewModal] = useState({ open: false, file: null, pages: [] })
  const [pdfjs, setPdfjs] = useState(null)

  // Load PDF.js with proper worker configuration
  useEffect(() => {
    const loadPdfjs = async () => {
      try {
        if (typeof window !== "undefined") {
          // If already loaded, just grab it
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
            setPdfjs(window.pdfjsLib)
            return
          }
          const script = document.createElement("script")
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
          script.onload = () => {
            if (window.pdfjsLib) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
              setPdfjs(window.pdfjsLib)
              console.log("PDF.js loaded successfully")
            }
          }
          script.onerror = (err) => {
            console.error("Failed to load PDF.js from CDN:", err)
          }
          document.head.appendChild(script)
        }
      } catch (err) {
        console.error("Failed to load PDF.js:", err)
      }
    }
    loadPdfjs()
  }, [])

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const validateFile = (file) => {
    const validTypes = ["application/pdf"]
    const maxSize = 50 * 1024 * 1024

    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: t("pdfToWord.errorInvalidType") }
    }

    if (file.size > maxSize) {
      return { valid: false, error: t("pdfToWord.errorMaxSize") }
    }

    return { valid: true }
  }

  const generateThumbnail = async (file) => {
    if (!pdfjs) {
      console.log("PDF.js not loaded yet")
      return { thumbnail: null, pageCount: 1 }
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      const page = await pdf.getPage(1)

      const scale = 0.5
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      return {
        thumbnail: canvas.toDataURL("image/jpeg", 0.7), // JPEG at 70% quality = much smaller
        pageCount: pdf.numPages,
      }
    } catch (err) {
      console.error("Error generating thumbnail:", err)
      return { thumbnail: null, pageCount: 1 }
    }
  }

  const processFiles = async (newFiles) => {
    if (!checkFiles(newFiles)) return
    if (!checkBatch(newFiles)) return
    const validFiles = []
    let hasError = false

    for (const file of newFiles) {
      const validation = validateFile(file)
      if (validation.valid) {
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const { thumbnail, pageCount } = await generateThumbnail(file)

        validFiles.push({
          file,         // Keep the actual File object reference
          id: fileId,
          name: file.name,
          size: file.size,
          thumbnail,
          pageCount,
        })
      } else {
        setError(validation.error)
        hasError = true
        break
      }
    }

    if (!hasError && validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])
      setError("")
    }
  }

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      setError("")

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(Array.from(e.dataTransfer.files))
      }
    },
    [pdfjs] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const handleFileChange = (e) => {
    setError("")
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files))
    }
    e.target.value = ""
  }

  const handleButtonClick = () => {
    document.getElementById("file-upload").click()
  }

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const openPreview = async (fileData) => {
    if (!pdfjs) {
      setError(t("pdfToWord.errorPreviewLoading"))
      return
    }

    try {
      const arrayBuffer = await fileData.file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      const pages = []

      const maxPages = Math.min(pdf.numPages, 5)
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i)
        const scale = 1
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")
        canvas.height = viewport.height
        canvas.width = viewport.width

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise

        pages.push(canvas.toDataURL("image/jpeg", 0.85))
      }

      setPreviewModal({ open: true, file: fileData, pages, totalPages: pdf.numPages })
    } catch (err) {
      console.error("Error loading preview:", err)
      setError(t("pdfToWord.errorPreviewFailed"))
    }
  }

  const handleContinue = async () => {
    if (files.length === 0) {
      setError(t("pdfToWord.errorNoFiles"))
      return
    }

    setIsProcessing(true)

    try {
      // FIX #8: Store File objects in module-level variable (avoids sessionStorage overflow).
      // Store only lightweight metadata in sessionStorage — no base64.
      pendingPdfFiles.current = files.map((f) => f.file)

      const metaArray = files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        pageCount: f.pageCount,
        thumbnail: f.thumbnail, // thumbnails are small JPEG, safe to store
      }))

      try {
        sessionStorage.setItem("uploadedPdfFiles", JSON.stringify(metaArray))
      } catch (storageErr) {
        // sessionStorage full (thumbnails still too large) — store without thumbnails
        console.warn("sessionStorage full, storing without thumbnails:", storageErr)
        const metaNoThumbs = metaArray.map(({ thumbnail, ...rest }) => rest)
        try {
          sessionStorage.setItem("uploadedPdfFiles", JSON.stringify(metaNoThumbs))
        } catch (finalErr) {
          // Extremely large batch — still navigate, preview page will use pendingPdfFiles
          console.warn("sessionStorage unavailable, using in-memory only:", finalErr)
          sessionStorage.setItem("uploadedPdfFiles", JSON.stringify([]))
        }
      }

      setTimeout(() => {
        router.push("/pdf-to-word/preview")
      }, 800)
    } catch (err) {
      console.error("Error processing files:", err)
      setError(t("pdfToWord.errorProcessing"))
      setIsProcessing(false)
    }
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    {
      question: t("pdfToWord.faq1Question"),
      answer: t("pdfToWord.faq1Answer"),
    },
    {
      question: t("pdfToWord.faq2Question"),
      answer: t("pdfToWord.faq2Answer"),
    },
    {
      question: t("pdfToWord.faq3Question"),
      answer: t("pdfToWord.faq3Answer"),
    },
    {
      question: t("pdfToWord.faq4Question"),
      answer: t("pdfToWord.faq4Answer"),
    },
    {
      question: t("pdfToWord.faq5Question"),
      answer: t("pdfToWord.faq5Answer"),
    },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "PDF to Word Converter - SmallPDF.us",
        // url is intentionally omitted here — SEOHead adds the correct localized WebPage URL
        description: "Transform PDF files into fully editable Word documents online for free",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        // aggregateRating removed: only add back when you have real, verified user reviews.
        featureList: [
          "Convert up to 10 PDF files",
          "Intelligent layout recognition",
          "Preserves formatting and images",
          "Batch processing support",
          "Fully editable output",
          "Free forever",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
      {
        "@type": "HowTo",
        name: "How to Convert PDF to Word",
        description: "Step-by-step guide to converting PDF documents to editable Word format",
        step: [
          {
            "@type": "HowToStep",
            name: "Upload PDF Documents",
            text: "Select one or more PDF files from your device. You can upload up to 10 documents at once, each up to 50MB.",
            position: 1,
          },
          {
            "@type": "HowToStep",
            name: "Automatic Processing",
            text: "Our system analyzes your PDF structure, identifying text blocks, images, and formatting to reconstruct in Word format.",
            position: 2,
          },
          {
            "@type": "HowToStep",
            name: "Download Word Files",
            text: "Download your fully editable Word documents. Open them in Microsoft Word, Google Docs, or any word processor.",
            position: 3,
          },
        ],
      },
    ],
  }

  return (
    <>
      <SEOHead
        title={t("pdfToWord.seo.title")}
        description={t("pdfToWord.seo.description")}
        keywords="pdf to word, convert pdf to word, pdf to docx, pdf to doc, pdf to editable word, free pdf to word converter"
        ogImage="/og-pdf-to-word.jpg"
        structuredData={structuredData}
      />

      <Layout
        title={t("pdfToWord.heroTitle")}
        description={t("pdfToWord.heroSubtitle")}
      >
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
          .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body { font-family: 'DM Sans', sans-serif; }
          @keyframes blob { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(20px, -30px) scale(1.05); } 66% { transform: translate(-15px, 15px) scale(0.95); } }
          .animate-blob { animation: blob 8s ease-in-out infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          @keyframes loading-bar { 0% { width: 0%; } 50% { width: 70%; } 100% { width: 100%; } }
          .animate-loading-bar { animation: loading-bar 2s ease-in-out infinite; }
          @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
          .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
          @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        `}</style>

        {/* Preview Modal */}
        {previewModal.open && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewModal({ open: false, file: null, pages: [] })}
          >
            <div
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-white truncate max-w-md">
                      {previewModal.file?.name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {t("pdfToWord.previewShowing")
                        .replace("{{shown}}", previewModal.pages.length)
                        .replace("{{total}}", previewModal.totalPages)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewModal({ open: false, file: null, pages: [] })}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] bg-slate-100">
                <div className="space-y-4">
                  {previewModal.pages.map((page, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                        <span className="text-sm font-medium text-slate-600">
                          {t("pdfToWord.previewPageLabel")} {index + 1}
                        </span>
                      </div>
                      <img
                        src={page}
                        alt={`${t("pdfToWord.previewPageLabel")} ${index + 1}`}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
                {previewModal.totalPages > 5 && (
                  <p className="text-center text-sm text-slate-500 mt-4">
                    {t("pdfToWord.previewTruncated")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-white via-blue-50 to-blue-100 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              {t("pdfToWord.heroTitle")}
            </h1>
            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
              {t("pdfToWord.heroSubtitle")}
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-gradient-to-br from-blue-50 via-slate-100 to-blue-50 py-8 px-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-8 right-20 w-64 h-64 bg-slate-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

          <div className="max-w-2xl mx-auto relative z-10">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              {isProcessing ? (
                <div className="py-10 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-blue-600 border-r-blue-600 rounded-full animate-spin"></div>
                    <FileType className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                    {t("pdfToWord.preparingTitle")}
                  </h3>
                  <p className="font-body text-sm text-slate-600">
                    {files.length > 1
                      ? t("pdfToWord.preparingSubtitle_plural").replace("{{count}}", files.length)
                      : t("pdfToWord.preparingSubtitle_singular").replace("{{count}}", files.length)}
                  </p>
                  <div className="mt-5 max-w-xs mx-auto">
                    <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full animate-loading-bar"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* File List with Thumbnails */}
                  {files.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display text-sm font-semibold text-slate-700">
                          {t("pdfToWord.yourDocuments").replace("{{count}}", files.length)}
                        </h3>
                        <button
                          onClick={() => setFiles([])}
                          className="text-xs text-red-500 hover:text-red-600 font-medium"
                        >
                          {t("pdfToWord.clearAll")}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                        {files.map((f) => (
                          <div
                            key={f.id}
                            className="relative group bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300"
                          >
                            <div className="aspect-[3/4] bg-white relative overflow-hidden">
                              {f.thumbnail ? (
                                <img
                                  src={f.thumbnail}
                                  alt={f.name}
                                  className="w-full h-full object-cover object-top"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                                  <FileText className="w-12 h-12 text-blue-400" />
                                </div>
                              )}

                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openPreview(f)}
                                  className="p-2 bg-white rounded-lg shadow-lg hover:bg-blue-50 transition-colors"
                                  title="Preview"
                                >
                                  <Eye className="w-4 h-4 text-blue-600" />
                                </button>
                                <button
                                  onClick={() => removeFile(f.id)}
                                  className="p-2 bg-white rounded-lg shadow-lg hover:bg-red-50 transition-colors"
                                  title="Remove"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>

                              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
                                {f.pageCount} {f.pageCount === 1 ? t("pdfToWord.page") : t("pdfToWord.pages")}
                              </div>
                            </div>

                            <div className="p-3">
                              <p className="text-xs font-medium text-slate-900 truncate" title={f.name}>
                                {f.name}
                              </p>
                              <p className="text-xs text-slate-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Area */}
                  {files.length === 0 && (
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`relative rounded-xl transition-all duration-300 ${
                        dragActive
                          ? "border-4 border-blue-500 bg-blue-50 scale-102 shadow-lg"
                          : "border-3 border-dashed border-slate-300 hover:border-blue-400 hover:bg-slate-50 hover:shadow-md"
                      }`}
                      style={{ borderWidth: dragActive ? "4px" : "3px" }}
                    >
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".pdf,application/pdf"
                        multiple
                        onChange={handleFileChange}
                      />

                      <div className="p-10 text-center">
                        <div className="mb-3">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-3 shadow-xl transform hover:scale-110 transition-transform duration-300">
                            <FileType className="w-8 h-8 text-white animate-bounce-slow" />
                          </div>
                        </div>

                        <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                          {dragActive ? t("pdfToWord.dropActive") : t("pdfToWord.dropTitle")}
                        </h3>
                        <p className="font-body text-sm text-slate-500 mb-4">
                          {t("pdfToWord.dropSubtitle")}
                        </p>

                        <button
                          type="button"
                          onClick={handleButtonClick}
                          className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Upload className="w-5 h-5" />
                          <span>{t("pdfToWord.selectFiles")}</span>
                        </button>

                        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>{t("pdfToWord.pdfFormat")}</span>
                          </div>
                          <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                          <div className="flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5 text-slate-600" />
                            <span>{t("pdfToWord.encryptedTransfer")}</span>
                          </div>
                          <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                          <div className="flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                            <span>{t("pdfToWord.quickResults")}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {files.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleButtonClick}
                        className="w-full mb-3 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{t("pdfToWord.addMoreDocuments")}</span>
                      </button>

                      <button
                        onClick={handleContinue}
                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-102 flex items-center justify-center gap-2"
                      >
                        <FileText className="w-5 h-5" />
                        <span>
                          {files.length > 1
                            ? t("pdfToWord.convertButton_plural").replace("{{count}}", files.length)
                            : t("pdfToWord.convertButton_singular").replace("{{count}}", files.length)}
                        </span>
                      </button>
                    </>
                  )}
                </>
              )}

              {error && (
                <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {!isProcessing && (
                <p className="text-center font-body text-sm text-slate-600 mt-5">
                  {t("pdfToWord.maxSizeNote")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                {t("pdfToWord.featuresTitle")}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t("pdfToWord.featuresSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                  title: t("pdfToWord.feature1Title"),
                  desc: t("pdfToWord.feature1Desc"),
                },
                {
                  icon: "M13 10V3L4 14h7v7l9-11h-7z",
                  title: t("pdfToWord.feature2Title"),
                  desc: t("pdfToWord.feature2Desc"),
                },
                {
                  icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                  title: t("pdfToWord.feature3Title"),
                  desc: t("pdfToWord.feature3Desc"),
                },
                {
                  icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
                  title: t("pdfToWord.feature4Title"),
                  desc: t("pdfToWord.feature4Desc"),
                },
                {
                  icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
                  title: t("pdfToWord.feature5Title"),
                  desc: t("pdfToWord.feature5Desc"),
                },
                {
                  icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z",
                  title: t("pdfToWord.feature6Title"),
                  desc: t("pdfToWord.feature6Desc"),
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="font-body text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-b from-blue-50 to-white py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                {t("pdfToWord.stepsTitle")}
              </h2>
              <p className="font-body text-slate-600 max-w-2xl mx-auto">
                {t("pdfToWord.stepsSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  step: "1",
                  title: t("pdfToWord.step1Title"),
                  desc: t("pdfToWord.step1Desc"),
                  color: "bg-blue-600",
                },
                {
                  step: "2",
                  title: t("pdfToWord.step2Title"),
                  desc: t("pdfToWord.step2Desc"),
                  color: "bg-blue-700",
                },
                {
                  step: "3",
                  title: t("pdfToWord.step3Title"),
                  desc: t("pdfToWord.step3Desc"),
                  color: "bg-blue-800",
                },
              ].map((step, i) => (
                <div key={i} className="relative">
                  <div className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-blue-300 transition-all duration-300 h-full">
                    <div
                      className={`w-14 h-14 ${step.color} rounded-xl flex items-center justify-center mb-4 shadow-xl`}
                    >
                      <span className="font-display text-2xl font-bold text-white">{step.step}</span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                    <p className="font-body text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                  </div>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                {t("pdfToWord.faqTitle")}
              </h2>
              <p className="font-body text-slate-600">{t("pdfToWord.faqSubtitle")}</p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-display font-semibold text-slate-900 pr-4">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-blue-600 flex-shrink-0 transition-transform duration-300 ${
                        openFaq === index ? "transform rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`transition-all duration-300 ease-in-out ${
                      openFaq === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                    }`}
                  >
                    <div className="px-6 pb-4 pt-2">
                      <p className="font-body text-slate-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 py-12 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            ></div>
          </div>

          <div className="max-w-3xl mx-auto text-center relative z-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              {t("pdfToWord.ctaTitle")}
            </h2>
            <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              {t("pdfToWord.ctaSubtitle")}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <FileText className="w-6 h-6" />
              <span>{t("pdfToWord.ctaButton")}</span>
            </button>
          </div>
        </div>
        <RelatedTools current="pdf-to-word" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}