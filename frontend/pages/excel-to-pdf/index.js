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
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Zap,
  Shield,
  Star,
  ChevronDown,
  Sparkles,
  FileText,
  BarChart2,
  Layers,
} from "lucide-react"

// Store raw File object in memory — no base64, no sessionStorage size limit
export const excelToPdfStore = { file: null, meta: null }
export default function ExcelToPDF() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('excel-to-pdf')
  const { checkBatch, BatchGateModal } = useBatchGuard('excel-to-pdf')
  const [file, setFile] = useState(null)
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
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ]
    const maxSize = 50 * 1024 * 1024

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      setError(t('excelToPdf.errorInvalidType'))
      return false
    }

    if (file.size > maxSize) {
      setError(t('excelToPdf.errorMaxSize'))
      return false
    }

    return true
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError("")

    const files = e.dataTransfer.files
    if (!files || !files[0]) return
    // Check batch limit on ALL dropped files before processing
    if (!checkBatch(files)) return
    const droppedFile = files[0]
    if (validateFile(droppedFile)) {
      handleContinue(droppedFile)
    }
  }, [checkBatch])

  const handleFileChange = (e) => {
    setError("")
    const files = e.target.files
    if (!files || !files[0]) return
    // Check batch limit on ALL selected files before processing
    if (!checkBatch(files)) return
    const selectedFile = files[0]
    if (validateFile(selectedFile)) {
      handleContinue(selectedFile)
    }
  }

  const handleButtonClick = () => {
    document.getElementById("file-upload").click()
  }

  const handleContinue = (fileToConvert) => {
    if (!fileToConvert) return
    if (!checkFiles([fileToConvert])) return
    if (!checkBatch([fileToConvert])) return

    setFile(fileToConvert)
    setIsProcessing(true)

    try {
      // Store raw File object in memory — no base64 conversion, no sessionStorage size limit
      excelToPdfStore.file = fileToConvert
      excelToPdfStore.meta = {
        name: fileToConvert.name,
        size: fileToConvert.size,
        type: fileToConvert.type,
        lastModified: fileToConvert.lastModified,
      }

      setTimeout(() => {
        router.push("/excel-to-pdf/preview")
      }, 800)
    } catch (err) {
      console.error("Error storing file:", err)
      setError("Failed to process file. Please try again.")
      setIsProcessing(false)
      setFile(null)
    }
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    {
      question: t('excelToPdf.faq1Question'),
      answer: t('excelToPdf.faq1Answer'),
    },
    {
      question: t('excelToPdf.faq2Question'),
      answer: t('excelToPdf.faq2Answer'),
    },
    {
      question: t('excelToPdf.faq3Question'),
      answer: t('excelToPdf.faq3Answer'),
    },
    {
      question: t('excelToPdf.faq4Question'),
      answer: t('excelToPdf.faq4Answer'),
    },
    {
      question: t('excelToPdf.faq5Question'),
      answer: t('excelToPdf.faq5Answer'),
    },
    {
      question: t('excelToPdf.faq6Question'),
      answer: t('excelToPdf.faq6Answer'),
    },
  ]

  // Custom structured data for excel-to-pdf page
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "Excel to PDF Converter - SmallPDF.us",
        "description": "Convert Excel spreadsheets to PDF documents online for free with perfect formatting preservation",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
        "featureList": [
          "Convert .xlsx and .xls files",
          "Preserve all formatting",
          "Multiple sheets supported",
          "Charts and graphs included",
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
        "name": t('excelToPdf.howToTitle'),
        "description": t('excelToPdf.howToDescription'),
        "step": [
          {
            "@type": "HowToStep",
            "name": t('excelToPdf.step1Title'),
            "text": t('excelToPdf.step1Desc'),
            "position": 1
          },
          {
            "@type": "HowToStep",
            "name": t('excelToPdf.step2Title'),
            "text": t('excelToPdf.step2Desc'),
            "position": 2
          },
          {
            "@type": "HowToStep",
            "name": t('excelToPdf.step3Title'),
            "text": t('excelToPdf.step3Desc'),
            "position": 3
          }
        ]
      }
    ]
  }

  return (
    <>
      <SEOHead
        title={t('excelToPdf.pageTitle')}
        description={t('excelToPdf.pageDescription')}
        keywords="excel to pdf, convert excel to pdf, xlsx to pdf, xls to pdf, spreadsheet to pdf, free excel to pdf converter"
        ogImage="/og-excel-to-pdf.jpg"
        structuredData={structuredData}
      />

      <Layout
        title={t('excelToPdf.uploadTitle')}
        description={t('excelToPdf.uploadSubtitle')}
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
        <div className="bg-gradient-to-br from-white via-emerald-50 to-teal-50 border-b border-emerald-200">
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              {t('excelToPdf.uploadTitle')} <span className="text-emerald-600">{t('excelToPdf.heroHighlight')}</span>
            </h1>

            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
              {t('excelToPdf.uploadSubtitle')}
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{t('excelToPdf.heroBadge1')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{t('excelToPdf.heroBadge2')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{t('excelToPdf.heroBadge3')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-xl border-2 border-dashed border-emerald-300 hover:border-emerald-400 transition-colors p-8">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              multiple
              onChange={handleFileChange}
              disabled={isProcessing}
            />

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`text-center transition-all ${
                dragActive ? "scale-105" : ""
              } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
            >
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  {/* Animated blob background */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-lg opacity-30 animate-blob"></div>
                  <div className="absolute -inset-2 bg-gradient-to-r from-teal-500 to-green-500 rounded-full blur-lg opacity-30 animate-blob animation-delay-2000"></div>

                  {/* Icon container */}
                  <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                    {isProcessing ? (
                      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Upload className="w-10 h-10 text-white animate-bounce-slow" />
                    )}
                  </div>

                  {/* Corner badge */}
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                    <FileSpreadsheet className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">
                {isProcessing ? t('excelToPdf.uploadProcessing') : t('excelToPdf.uploadDropText')}
              </h2>

              <p className="font-body text-slate-600 mb-6">
                {t('excelToPdf.uploadOrText')}
              </p>

              <button
                onClick={handleButtonClick}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl font-display font-semibold text-lg hover:from-emerald-700 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Upload className="w-5 h-5" />
                <span>{t('excelToPdf.uploadButton')}</span>
              </button>

              <p className="font-body text-xs text-slate-500 mt-4">
                {t('excelToPdf.uploadSupport')}
              </p>

              {isProcessing && (
                <div className="mt-6">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full animate-loading-bar"></div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-800">{error}</p>
                  <button
                    onClick={() => setError("")}
                    className="text-sm text-red-600 hover:text-red-800 mt-1 underline"
                  >
                    {t('excelToPdf.dismiss')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                {t('excelToPdf.featuresTitle')}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t('excelToPdf.featuresSubtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: FileText,
                  title: t('excelToPdf.feature1Title'),
                  desc: t('excelToPdf.feature1Desc'),
                },
                {
                  icon: Layers,
                  title: t('excelToPdf.feature2Title'),
                  desc: t('excelToPdf.feature2Desc'),
                },
                {
                  icon: BarChart2,
                  title: t('excelToPdf.feature3Title'),
                  desc: t('excelToPdf.feature3Desc'),
                },
                {
                  icon: Shield,
                  title: t('excelToPdf.feature4Title'),
                  desc: t('excelToPdf.feature4Desc'),
                },
                {
                  icon: Zap,
                  title: t('excelToPdf.feature5Title'),
                  desc: t('excelToPdf.feature5Desc'),
                },
                {
                  icon: Sparkles,
                  title: t('excelToPdf.feature6Title'),
                  desc: t('excelToPdf.feature6Desc'),
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-br from-white to-emerald-50 p-6 rounded-2xl border border-emerald-200 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="font-body text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t('excelToPdf.stepsTitle')}</h2>
              <p className="font-body text-slate-600">{t('excelToPdf.stepsSubtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: t('excelToPdf.step1Title'),
                  desc: t('excelToPdf.step1Desc'),
                  color: "bg-emerald-600",
                },
                {
                  step: "2",
                  title: t('excelToPdf.step2Title'),
                  desc: t('excelToPdf.step2Desc'),
                  color: "bg-teal-600",
                },
                {
                  step: "3",
                  title: t('excelToPdf.step3Title'),
                  desc: t('excelToPdf.step3Desc'),
                  color: "bg-emerald-700",
                },
              ].map((item) => (
                <div key={item.step} className="relative">
                  <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 transition-all duration-300 h-full">
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
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t('excelToPdf.faqTitle')}</h2>
              <p className="font-body text-slate-600">{t('excelToPdf.faqSubtitle')}</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-r from-white to-emerald-50 border border-emerald-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-emerald-50 transition-colors"
                  >
                    <h3 className="font-display text-base font-semibold text-slate-900 pr-4">{faq.question}</h3>
                    <ChevronDown
                      className={`w-5 h-5 text-emerald-600 flex-shrink-0 transition-transform duration-300 ${
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

        {/* SEO Content Section */}
        <div className="bg-emerald-50 py-12 px-4 border-t border-emerald-200">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-slate max-w-none">
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">
                {t('excelToPdf.seoSection1Title')}
              </h2>
              <p className="font-body text-slate-700 mb-4">
                {t('excelToPdf.seoSection1Para1')}
              </p>
              <p className="font-body text-slate-700 mb-4">
                {t('excelToPdf.seoSection1Para2')}
              </p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">
                {t('excelToPdf.seoSection2Title')}
              </h3>
              <p className="font-body text-slate-700 mb-4">
                {t('excelToPdf.seoSection2Para')}
              </p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">{t('excelToPdf.seoSection3Title')}</h3>
              <p className="font-body text-slate-700">
                {t('excelToPdf.seoSection3Para')}
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              {t('excelToPdf.ctaTitle')}
            </h2>
            <p className="font-body text-lg text-emerald-100 mb-8 max-w-2xl mx-auto">
              {t('excelToPdf.ctaSubtitle')}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-emerald-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-emerald-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>{t('excelToPdf.ctaButton')}</span>
            </button>
          </div>
        </div>
        <RelatedTools current="excel-to-pdf" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}