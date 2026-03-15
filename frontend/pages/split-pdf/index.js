import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import { getApiUrl } from "../../lib/getApiUrl"
import Layout from "@/components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "@/components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import { Upload, FileText, AlertCircle, CheckCircle2, Zap, Shield, ChevronDown, Trash2, Scissors, Eye, X } from "lucide-react"

// Module-level store — no size limit unlike sessionStorage (5MB)
// Survives Next.js client-side navigation within the same tab
export const splitPdfStore = { fileData: null }

export default function SplitPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('split-pdf')
  const { checkBatch, BatchGateModal } = useBatchGuard('split-pdf')
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState("")
  const [openFaq, setOpenFaq] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pages, setPages] = useState([])
  const [selectedPages, setSelectedPages] = useState([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [previewModal, setPreviewModal] = useState({ open: false, pageIndex: null, image: null })

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
      return { valid: false, error: t("splitPdf.errorInvalidType") }
    }

    if (file.size > maxSize) {
      return { valid: false, error: t("splitPdf.errorMaxSize") }
    }

    return { valid: true }
  }

  const analyzePdfWithBackend = async (uploadedFile) => {
    setLoadingPages(true)
    
    try {
      const formData = new FormData()
      formData.append("file", uploadedFile)
      
      const response = await fetch(`${getApiUrl()}/api/analyze-pdf`, {
        method: "POST",
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to analyze PDF")
      }
      
      const result = await response.json()
      console.log("PDF analysis result:", result)
      
      setLoadingPages(false)
      return result
    } catch (err) {
      console.error("Error analyzing PDF:", err)
      setLoadingPages(false)
      return null
    }
  }

  const processFile = async (newFile) => {
    if (!checkFiles([newFile])) return
    if (!checkBatch([newFile])) return
    const validation = validateFile(newFile)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setLoadingPages(true)
    setError("")
    
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const analysis = await analyzePdfWithBackend(newFile)
      
      if (analysis && analysis.pageCount > 0) {
        setFile({
          file: newFile,
          id: fileId,
          name: newFile.name,
          size: newFile.size,
          pageCount: analysis.pageCount,
          jobId: analysis.jobId,
        })
        
        const pageObjects = analysis.thumbnails && analysis.thumbnails.length > 0
          ? analysis.thumbnails.map((thumb, index) => ({
              pageNumber: index + 1,
              thumbnail: thumb.url ? `${getApiUrl()}${thumb.url}` : null,
            }))
          : Array.from({ length: analysis.pageCount }, (_, i) => ({
              pageNumber: i + 1,
              thumbnail: null,
            }))
        
        setPages(pageObjects)
        setSelectedPages(pageObjects.map(p => p.pageNumber))
        setError("")
      } else {
        setError(t("splitPdf.errorReadFailed"))
      }
    } catch (err) {
      console.error("Error processing file:", err)
      setError(t("splitPdf.errorProcessFailed"))
    }
    
    setLoadingPages(false)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError("")

    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    // Check batch limit on ALL dropped files before processing
    if (!checkBatch(files)) return
    processFile(files[0])
  }, [checkBatch])

  const handleFileChange = (e) => {
    setError("")
    const files = e.target.files
    if (!files || files.length === 0) return
    // Check batch limit on ALL selected files before processing
    if (!checkBatch(files)) return
    processFile(files[0])
    e.target.value = ""
  }

  const handleButtonClick = () => {
    document.getElementById("file-upload").click()
  }

  const removeFile = () => {
    setFile(null)
    setPages([])
    setSelectedPages([])
  }

  const togglePageSelection = (pageNumber) => {
    setSelectedPages(prev => 
      prev.includes(pageNumber) 
        ? prev.filter(p => p !== pageNumber)
        : [...prev, pageNumber].sort((a, b) => a - b)
    )
  }

  const selectAllPages = () => {
    setSelectedPages(pages.map(p => p.pageNumber))
  }

  const deselectAllPages = () => {
    setSelectedPages([])
  }

  const handleContinue = async () => {
    if (!file || selectedPages.length === 0) {
      setError(t("splitPdf.errorSelectPage"))
      return
    }

    setIsProcessing(true)

    try {
      const reader = new FileReader()
      reader.onload = (e) => {
        const fileData = {
          id: file.id,
          name: file.name,
          size: file.size,
          type: file.file.type,
          data: e.target.result,
          pageCount: file.pageCount,
          selectedPages: selectedPages,
          pageThumbnails: pages.filter(p => selectedPages.includes(p.pageNumber)),
        }

        // Store large base64 data in memory (avoids sessionStorage 5MB quota error)
        splitPdfStore.fileData = fileData

        // Store only lightweight metadata in sessionStorage as a fallback signal
        try {
          sessionStorage.setItem("splitPdfFileMeta", JSON.stringify({
            name: fileData.name,
            size: fileData.size,
            pageCount: fileData.pageCount,
            selectedPages: fileData.selectedPages,
          }))
        } catch (_) {}

        setTimeout(() => {
          router.push("/split-pdf/preview")
        }, 600)
      }
      reader.onerror = () => {
        setError(t("splitPdf.errorProcessFailed"))
        setIsProcessing(false)
      }
      reader.readAsDataURL(file.file)
    } catch (err) {
      console.error("Error processing file:", err)
      setError(t("splitPdf.errorGeneral"))
      setIsProcessing(false)
    }
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    {
      question: t("splitPdf.faq1Question"),
      answer: t("splitPdf.faq1Answer"),
    },
    {
      question: t("splitPdf.faq2Question"),
      answer: t("splitPdf.faq2Answer"),
    },
    {
      question: t("splitPdf.faq3Question"),
      answer: t("splitPdf.faq3Answer"),
    },
    {
      question: t("splitPdf.faq4Question"),
      answer: t("splitPdf.faq4Answer"),
    },
    {
      question: t("splitPdf.faq5Question"),
      answer: t("splitPdf.faq5Answer"),
    },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "Split PDF - SmallPDF.us",
        // URL is intentionally omitted here — SEOHead's WebPage schema
        // already covers the canonical URL per locale.
        "description": "Extract specific pages from PDF documents online for free",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Any",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
        "featureList": [
          "Visual page selection with thumbnails",
          "Extract any page combination",
          "Preserves original quality",
          "No page limit",
          "Secure encryption",
          "Free forever"
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      },
      {
        "@type": "HowTo",
        "name": "How to Split PDF and Extract Pages",
        "description": "Step-by-step guide to extracting specific pages from PDF documents",
        "step": [
          {
            "@type": "HowToStep",
            "name": "Upload Your PDF",
            "text": "Upload your PDF file. We'll load all pages and show you thumbnail previews of each one.",
            "position": 1
          },
          {
            "@type": "HowToStep",
            "name": "Select Pages to Extract",
            "text": "Click on the pages you want to extract. They'll highlight in blue. Select any combination of pages you need.",
            "position": 2
          },
          {
            "@type": "HowToStep",
            "name": "Download New PDF",
            "text": "Click extract and download your new PDF containing only the selected pages. Your original file remains unchanged.",
            "position": 3
          }
        ]
      }
    ]
  }

  return (
    <>
      <SEOHead
        title={t("splitPdf.pageTitle")}
        description={t("splitPdf.pageDescription")}
        keywords="split pdf, extract pages from pdf, pdf splitter, separate pdf pages, cut pdf, divide pdf online free"
        ogImage="/og-split-pdf.jpg"
        structuredData={structuredData}
      />

      <Layout
        title="Split PDF - Extract Pages Online"
        description="Pull out exactly the pages you need from any PDF document."
      >
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
          .font-display {
            font-family: 'Plus Jakarta Sans', sans-serif;
          }
          .font-body {
            font-family: 'DM Sans', sans-serif;
          }
          @keyframes blob {
            0%,
            100% {
              transform: translate(0, 0) scale(1);
            }
            33% {
              transform: translate(20px, -30px) scale(1.05);
            }
            66% {
              transform: translate(-15px, 15px) scale(0.95);
            }
          }
          .animate-blob {
            animation: blob 8s ease-in-out infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          @keyframes loading-bar {
            0% {
              width: 0%;
            }
            50% {
              width: 70%;
            }
            100% {
              width: 100%;
            }
          }
          .animate-loading-bar {
            animation: loading-bar 2s ease-in-out infinite;
          }
          @keyframes bounce-slow {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-4px);
            }
          }
          .animate-bounce-slow {
            animation: bounce-slow 2s ease-in-out infinite;
          }
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
        `}</style>

        {/* Preview Modal */}
        {previewModal.open && previewModal.image && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewModal({ open: false, pageIndex: null, image: null })}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-white">Page {previewModal.pageIndex}</h3>
                    <p className="text-sm text-blue-100">{file?.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewModal({ open: false, pageIndex: null, image: null })}
                  className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="p-6 bg-blue-50">
                <img src={previewModal.image} alt={`Page ${previewModal.pageIndex}`} className="w-full rounded-lg shadow-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              {t("splitPdf.heroTitle")} <span className="text-blue-600">{t("splitPdf.heroOnlineFree")}</span>
            </h1>

            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
              {t("splitPdf.heroSubtitle")}
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 py-8 px-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-8 right-20 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

          <div className="max-w-2xl mx-auto relative z-10">
            <div className="bg-white rounded-2xl shadow-xl border border-blue-200 p-6">
              {isProcessing ? (
                <div className="py-10 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-blue-600 border-r-blue-600 rounded-full animate-spin"></div>
                    <Scissors className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t("splitPdf.loadingExtracting")}</h3>
                  <p className="font-body text-sm text-slate-600">
                    {t("splitPdf.loadingPreparingPages").replace("{count}", selectedPages.length).replace("{plural}", "")}
                  </p>
                  <div className="mt-5 max-w-xs mx-auto">
                    <div className="bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full animate-loading-bar"></div>
                    </div>
                  </div>
                </div>
              ) : loadingPages ? (
                <div className="py-10 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-blue-600 border-r-blue-600 rounded-full animate-spin"></div>
                    <FileText className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t("splitPdf.loadingReadingPdf")}</h3>
                  <p className="font-body text-sm text-slate-600">{t("splitPdf.loadingPages")}</p>
                </div>
              ) : file && pages.length > 0 ? (
                <>
                  {/* File Info */}
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-blue-200">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                        <FileText className="w-7 h-7 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-display text-lg font-semibold text-slate-900">{file.name}</p>
                        <p className="text-sm text-slate-500">
                          {file.pageCount} {t("splitPdf.fileInfoPages")} • {(file.size / 1024 / 1024).toFixed(2)} {t("splitPdf.fileInfoMb")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={removeFile}
                      className="p-2.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>

                  {/* Selection Controls */}
                  <div className="flex flex-wrap items-center gap-4 mb-5">
                    <span className="font-display text-base font-semibold text-slate-700">
                      {t("splitPdf.pagesSelected")
                        .replace("{selected}", selectedPages.length)
                        .replace("{total}", pages.length)}
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={selectAllPages}
                        className="px-4 py-2 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        {t("splitPdf.selectAll")}
                      </button>
                      <button
                        onClick={deselectAllPages}
                        className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        {t("splitPdf.deselectAll")}
                      </button>
                    </div>
                  </div>

                  {/* Page Grid */}
                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 max-h-[400px] overflow-y-auto p-2 mb-6 bg-blue-50 rounded-xl">
                    {pages.map((page) => (
                      <div
                        key={page.pageNumber}
                        onClick={() => togglePageSelection(page.pageNumber)}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          selectedPages.includes(page.pageNumber)
                            ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
                            : "border-blue-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="aspect-[3/4] bg-white relative overflow-hidden">
                          {page.thumbnail ? (
                            <img
                              src={page.thumbnail}
                              alt={`Page ${page.pageNumber}`}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                              <span className="text-xl font-bold text-blue-300">{page.pageNumber}</span>
                            </div>
                          )}

                          <div
                            className={`absolute inset-0 transition-all ${
                              selectedPages.includes(page.pageNumber) ? "bg-blue-600/20" : "bg-black/0 group-hover:bg-black/5"
                            }`}
                          />

                          <div
                            className={`absolute top-1 left-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              selectedPages.includes(page.pageNumber)
                                ? "bg-blue-600 border-blue-600"
                                : "bg-white/90 border-blue-300"
                            }`}
                          >
                            {selectedPages.includes(page.pageNumber) && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>

                          {page.thumbnail && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setPreviewModal({ open: true, pageIndex: page.pageNumber, image: page.thumbnail })
                              }}
                              className="absolute top-1 right-1 p-1 bg-white/90 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                              title="Preview"
                            >
                              <Eye className="w-3 h-3 text-slate-600" />
                            </button>
                          )}
                        </div>

                        <div
                          className={`text-center py-1 text-xs font-medium ${
                            selectedPages.includes(page.pageNumber) ? "bg-blue-100 text-blue-700" : "bg-blue-50 text-slate-600"
                          }`}
                        >
                          {page.pageNumber}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Extract Button */}
                  <button
                    onClick={handleContinue}
                    disabled={selectedPages.length === 0}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  >
                    <Scissors className="w-5 h-5" />
                    <span>
                      {t("splitPdf.extractButton")
                        .replace("{count}", selectedPages.length)
                        .replace("{plural}", selectedPages.length !== 1 ? "s" : "")}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`relative rounded-xl transition-all duration-300 ${
                      dragActive
                        ? "border-4 border-blue-500 bg-blue-50 scale-102 shadow-lg"
                        : "border-3 border-dashed border-blue-300 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
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
                          <Scissors className="w-8 h-8 text-white animate-bounce-slow" />
                        </div>
                      </div>

                      <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                        {dragActive ? t("splitPdf.uploadDropActive") : t("splitPdf.uploadDropIdle")}
                      </h3>
                      <p className="font-body text-sm text-slate-500 mb-4">
                        {t("splitPdf.uploadSubtitle")}
                      </p>

                      <button
                        type="button"
                        onClick={handleButtonClick}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Upload className="w-5 h-5" />
                        <span>{t("splitPdf.uploadButton")}</span>
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t("splitPdf.uploadBadgePdf")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-600" />
                          <span>{t("splitPdf.uploadBadgeSecure")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{t("splitPdf.uploadBadgeInstant")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {!isProcessing && !loadingPages && !file && (
                <p className="text-center font-body text-sm text-slate-600 mt-5">
                  {t("splitPdf.uploadMaxSize").replace("50MB", "")}
                  <span className="font-bold text-blue-600">50MB</span>
                  {" "}{t("splitPdf.fileInfoPages").includes("ページ") ? "ファイルサイズ" : "file size"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("splitPdf.featuresTitle")}</h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t("splitPdf.featuresSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
                  title: t("splitPdf.feature1Title"),
                  desc: t("splitPdf.feature1Desc"),
                },
                {
                  icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
                  title: t("splitPdf.feature2Title"),
                  desc: t("splitPdf.feature2Desc"),
                },
                {
                  icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                  title: t("splitPdf.feature3Title"),
                  desc: t("splitPdf.feature3Desc"),
                },
                {
                  icon: "M13 10V3L4 14h7v7l9-11h-7z",
                  title: t("splitPdf.feature4Title"),
                  desc: t("splitPdf.feature4Desc"),
                },
                {
                  icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
                  title: t("splitPdf.feature5Title"),
                  desc: t("splitPdf.feature5Desc"),
                },
                {
                  icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                  title: t("splitPdf.feature6Title"),
                  desc: t("splitPdf.feature6Desc"),
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl border border-blue-200 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
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
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("splitPdf.stepsTitle")}</h2>
              <p className="font-body text-slate-600">{t("splitPdf.stepsSubtitle")}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: t("splitPdf.step1Title"),
                  desc: t("splitPdf.step1Desc"),
                  color: "bg-blue-600",
                },
                {
                  step: "2",
                  title: t("splitPdf.step2Title"),
                  desc: t("splitPdf.step2Desc"),
                  color: "bg-indigo-600",
                },
                {
                  step: "3",
                  title: t("splitPdf.step3Title"),
                  desc: t("splitPdf.step3Desc"),
                  color: "bg-blue-700",
                },
              ].map((item) => (
                <div key={item.step} className="relative">
                  <div className="bg-white p-6 rounded-2xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 h-full">
                    <div
                      className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center text-white font-display text-2xl font-bold mb-4 shadow-lg`}
                    >
                      {item.step}
                    </div>
                    <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="font-body text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("splitPdf.faqTitle")}</h2>
              <p className="font-body text-slate-600">{t("splitPdf.faqSubtitle")}</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-r from-white to-blue-50 border border-blue-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-blue-50 transition-colors"
                  >
                    <h3 className="font-display text-base font-semibold text-slate-900 pr-4">{faq.question}</h3>
                    <ChevronDown
                      className={`w-5 h-5 text-blue-600 flex-shrink-0 transition-transform duration-300 ${
                        openFaq === index ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-4">
                      <p className="font-body text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SEO Content */}
        <div className="bg-blue-50 py-12 px-4 border-t border-blue-200">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-slate max-w-none">
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">{t("splitPdf.seoSection1Title")}</h2>
              <p className="font-body text-slate-700 mb-4">
                {t("splitPdf.seoSection1Para1")}
              </p>
              <p className="font-body text-slate-700 mb-4">
                {t("splitPdf.seoSection1Para2")}
              </p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">
                {t("splitPdf.seoSection2Title")}
              </h3>
              <p className="font-body text-slate-700">
                {t("splitPdf.seoSection2Para")}
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t("splitPdf.ctaTitle")}</h2>
            <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              {t("splitPdf.ctaSubtitle")}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <Scissors className="w-5 h-5" />
              <span>{t("splitPdf.ctaButton")}</span>
            </button>
          </div>
        </div>
        <RelatedTools current="split-pdf" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}