import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Zap,
  Shield,
  Star,
  ChevronDown,
  ImageIcon,
  Sparkles,
  Monitor,
} from "lucide-react"

export default function PDFtoPNG() {
const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('pdf-to-png')
  const { checkBatch, BatchGateModal } = useBatchGuard('pdf-to-png')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState("")
  const [openFaq, setOpenFaq] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

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
    const maxSize = 100 * 1024 * 1024

    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: t('pdfToPng.errorInvalidType') }
    }

    if (file.size > maxSize) {
      return { valid: false, error: t('pdfToPng.errorMaxSize') }
    }

    return { valid: true }
  }

  const processFile = async (newFile) => {
    if (!checkFiles([newFile])) return
    if (!checkBatch([newFile])) return
    const validation = validateFile(newFile)

    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setIsProcessing(true)
    setError("")

    function getApiUrl() {
      if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      const { hostname, protocol } = window.location
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      }
      return `${protocol}//${hostname}`
    }

    try {
      const formData = new FormData()
      formData.append("pdf", newFile)

      const API_URL = getApiUrl()
      const response = await fetch(`${API_URL}/api/pdf-to-png`, {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        sessionStorage.setItem(
          "pdfToPngResult",
          JSON.stringify({
            ...result,
            originalName: newFile.name,
            originalSize: newFile.size,
          }),
        )

        setTimeout(() => {
          router.push("/pdf-to-png/preview")
        }, 600)
      } else {
        setError(result.error || t('pdfToPng.errorConversionFailed'))
        setIsProcessing(false)
      }
    } catch (err) {
      console.error("Error converting file:", err)
      setError(t('pdfToPng.errorGeneric'))
      setIsProcessing(false)
    }
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

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    { question: t('pdfToPng.faq1Question'), answer: t('pdfToPng.faq1Answer') },
    { question: t('pdfToPng.faq2Question'), answer: t('pdfToPng.faq2Answer') },
    { question: t('pdfToPng.faq3Question'), answer: t('pdfToPng.faq3Answer') },
    { question: t('pdfToPng.faq4Question'), answer: t('pdfToPng.faq4Answer') },
    { question: t('pdfToPng.faq5Question'), answer: t('pdfToPng.faq5Answer') },
  ]

  // Custom structured data for pdf-to-png page
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "PDF to PNG Converter - SmallPDF.us",
        "url": "https://smallpdf.us/pdf-to-png",
        "description": "Convert PDF pages to high-quality PNG images online for free with transparency support",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.7",
          "ratingCount": "19824",
        },
        "featureList": [
          "Convert up to 200 PDF pages",
          "150 DPI high quality output",
          "Transparency support",
          "Batch ZIP download",
          "Individual page selection",
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
        "name": "How to Convert PDF to PNG",
        "description": "Step-by-step guide to extracting PNG images from PDF documents",
        "step": [
          {
            "@type": "HowToStep",
            "name": "Upload PDF File",
            "text": "Select a PDF document from your device. Files up to 100MB are supported.",
            "position": 1
          },
          {
            "@type": "HowToStep",
            "name": "Preview Pages",
            "text": "View all converted PNG images with transparency support. Each page becomes a separate high-quality PNG file.",
            "position": 2
          },
          {
            "@type": "HowToStep",
            "name": "Download Images",
            "text": "Download individual PNG files or get all pages in one ZIP archive. Your images are ready to use anywhere.",
            "position": 3
          }
        ]
      }
    ]
  }

  return (
    <>
      <SEOHead
        title={t('pdfToPng.pageTitle')}
        description={t('pdfToPng.pageDescription')}
        ogImage="/og-pdf-to-png.jpg"
        structuredData={structuredData}
      />

      <Layout
        title="PDF to PNG - Convert PDF to Images Online"
        description="Convert PDF pages to high-quality PNG images instantly."
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
        `}</style>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              {t('pdfToPng.heroTitle')} <span className="text-blue-600">{t('pdfToPng.heroOnlineFree')}</span>
            </h1>

            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
              {t('pdfToPng.heroSubtitle')}
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 py-8 px-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

          <div className="max-w-2xl mx-auto relative z-10">
            <div className="bg-white rounded-2xl shadow-xl border border-blue-200 p-6">
              {isProcessing ? (
                <div className="py-10 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-blue-600 border-r-blue-600 rounded-full animate-spin"></div>
                    <ImageIcon className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t('pdfToPng.loadingTitle')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('pdfToPng.loadingSubtitle')}</p>
                  <div className="mt-5 max-w-xs mx-auto">
                    <div className="bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full animate-loading-bar"></div>
                    </div>
                  </div>
                </div>
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
                          <ImageIcon className="w-8 h-8 text-white animate-bounce-slow" />
                        </div>
                      </div>

                      <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                        {dragActive ? t('pdfToPng.dragActive') : t('pdfToPng.selectPdf')}
                      </h3>
                      <p className="font-body text-sm text-slate-500 mb-4">
                        {t('pdfToPng.dragSubtitle')}
                      </p>

                      <button
                        type="button"
                        onClick={handleButtonClick}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Upload className="w-5 h-5" />
                        <span>{t('pdfToPng.chooseButton')}</span>
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          <span>{t('pdfToPng.badgePdfOnly')}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t('pdfToPng.badgeSecure')}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t('pdfToPng.badgeFast')}</span>
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

              {!isProcessing && (
                <p className="text-center font-body text-sm text-slate-600 mt-5">
                  Up to <span className="font-bold text-blue-600">{t('pdfToPng.fileLimitSize')}</span> per file •{" "}
                  <span className="font-bold text-blue-600">{t('pdfToPng.fileLimitQuality')}</span> output
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
                {t('pdfToPng.featuresTitle')}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t('pdfToPng.featuresSubtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: Sparkles,
                  title: t('pdfToPng.feature1Title'),
                  description: t('pdfToPng.feature1Desc'),
                  color: "from-blue-500 to-indigo-600",
                },
                {
                  icon: ImageIcon,
                  title: t('pdfToPng.feature2Title'),
                  description: t('pdfToPng.feature2Desc'),
                  color: "from-cyan-500 to-blue-600",
                },
                {
                  icon: Shield,
                  title: t('pdfToPng.feature3Title'),
                  description: t('pdfToPng.feature3Desc'),
                  color: "from-emerald-500 to-teal-600",
                },
                {
                  icon: Monitor,
                  title: t('pdfToPng.feature4Title'),
                  description: t('pdfToPng.feature4Desc'),
                  color: "from-violet-500 to-purple-600",
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-white to-blue-50 border border-blue-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
                >
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg`}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="font-body text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t('pdfToPng.stepsTitle')}</h2>
              <p className="font-body text-slate-600">{t('pdfToPng.stepsSubtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: t('pdfToPng.step1Title'),
                  description: t('pdfToPng.step1Desc'),
                  color: "bg-blue-600",
                },
                {
                  step: "2",
                  title: t('pdfToPng.step2Title'),
                  description: t('pdfToPng.step2Desc'),
                  color: "bg-indigo-600",
                },
                {
                  step: "3",
                  title: t('pdfToPng.step3Title'),
                  description: t('pdfToPng.step3Desc'),
                  color: "bg-blue-700",
                },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div
                    className={`w-14 h-14 ${item.color} text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg`}
                  >
                    {item.step}
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="font-body text-sm text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SEO Content Section */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold text-slate-900 mb-6">
              {t('pdfToPng.seoTitle')}
            </h2>
            <div className="prose prose-slate max-w-none space-y-4 font-body text-slate-700">
              <p>{t('pdfToPng.seoPara1')}</p>
              <p>{t('pdfToPng.seoPara2')}</p>
              <p>{t('pdfToPng.seoPara3')}</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mt-6 mb-3">{t('pdfToPng.seoSubtitle')}</h3>
              <p>{t('pdfToPng.seoPara4')}</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t('pdfToPng.faqTitle')}</h2>
              <p className="font-body text-slate-600">{t('pdfToPng.faqSubtitle')}</p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-display font-semibold text-slate-900 pr-4">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-blue-600 flex-shrink-0 transition-transform duration-300 ${
                        openFaq === index ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-4">
                      <p className="font-body text-slate-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related Tools */}
        <div className="bg-white py-12 px-4 border-t border-slate-200">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-2xl font-bold text-slate-900 mb-6">{t('pdfToPng.relatedTitle')}</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { name: t('pdfToPng.relatedPngToPdf'), href: "/png-to-pdf" },
                { name: t('pdfToPng.relatedJpgToPdf'), href: "/jpg-to-pdf" },
                { name: t('pdfToPng.relatedMergePdf'), href: "/merge-pdf" },
                { name: t('pdfToPng.relatedCompressPdf'), href: "/compress-pdf" },
                { name: t('pdfToPng.relatedSplitPdf'), href: "/split-pdf" },
              ].map((tool) => (
                <a
                  key={tool.name}
                  href={tool.href}
                  className="px-5 py-2.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 hover:text-blue-800 transition-colors font-medium text-sm"
                >
                  {tool.name}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Rating Badge */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-8 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <p className="text-white font-semibold font-body">{t('pdfToPng.ratingText')}</p>
            <p className="text-blue-100 font-body text-sm mt-1">{t('pdfToPng.ratingSubtext')}</p>
          </div>
        </div>
        <RelatedTools current="pdf-to-png" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}