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
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  Zap,
  Shield,
  Star,
  ChevronDown,
  Sparkles,
  FileImage,
  Camera,
  Layers,
} from "lucide-react"

export default function PDFToJPG() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('pdf-to-jpg')
  const { checkBatch, BatchGateModal } = useBatchGuard('pdf-to-jpg')
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
    const validTypes = ["application/pdf"]
    const maxSize = 100 * 1024 * 1024

    if (!validTypes.includes(file.type)) {
      setError(t('pdfToJpg.errorInvalidType'))
      return false
    }

    if (file.size > maxSize) {
      setError(t('pdfToJpg.errorMaxSize'))
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

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const fileData = {
          name: fileToConvert.name,
          size: fileToConvert.size,
          type: fileToConvert.type,
          lastModified: fileToConvert.lastModified,
          data: e.target.result,
        }
        sessionStorage.setItem("uploadedPDFFile", JSON.stringify(fileData))

        setTimeout(() => {
          router.push("/pdf-to-jpg/preview")
        }, 800)
      } catch (err) {
        console.error("Error storing file:", err)
        setError("Failed to process file. Please try again.")
        setIsProcessing(false)
        setFile(null)
      }
    }
    reader.onerror = () => {
      setError("Failed to read file. Please try again.")
      setIsProcessing(false)
      setFile(null)
    }
    reader.readAsDataURL(fileToConvert)
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    {
      question: t('pdfToJpg.faq1Question'),
      answer: t('pdfToJpg.faq1Answer'),
    },
    {
      question: t('pdfToJpg.faq2Question'),
      answer: t('pdfToJpg.faq2Answer'),
    },
    {
      question: t('pdfToJpg.faq3Question'),
      answer: t('pdfToJpg.faq3Answer'),
    },
    {
      question: t('pdfToJpg.faq4Question'),
      answer: t('pdfToJpg.faq4Answer'),
    },
    {
      question: t('pdfToJpg.faq5Question'),
      answer: t('pdfToJpg.faq5Answer'),
    },
    {
      question: t('pdfToJpg.faq6Question'),
      answer: t('pdfToJpg.faq6Answer'),
    },
  ]

  // Tool-specific structured data — SEOHead handles site-level graph + all hreflang/canonical
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us'
  const toolStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        // Use translated strings so schema language matches page content
        "name": t('pdfToJpg.uploadTitle'),
        "description": t('pdfToJpg.heroSubtitle') || "Convert PDF documents to JPG images online for free",
        // Dynamic URL — correct for every locale
        "url": locale === 'en'
          ? `${baseUrl}/pdf-to-jpg/`
          : `${baseUrl}/${locale}/pdf-to-jpg/`,
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Any",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
        // No aggregateRating — fake ratings risk a Google manual action
        "featureList": [
          t('pdfToJpg.feature1Title'),
          t('pdfToJpg.feature2Title'),
          t('pdfToJpg.feature3Title'),
          t('pdfToJpg.feature4Title'),
          t('pdfToJpg.feature5Title'),
          t('pdfToJpg.feature6Title'),
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
        // HowTo fully localized via t()
        "@type": "HowTo",
        "name": t('pdfToJpg.stepsTitle'),
        "description": t('pdfToJpg.stepsSubtitle'),
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": t('pdfToJpg.step1Title'),
            "text": t('pdfToJpg.step1Desc'),
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": t('pdfToJpg.step2Title'),
            "text": t('pdfToJpg.step2Desc'),
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": t('pdfToJpg.step3Title'),
            "text": t('pdfToJpg.step3Desc'),
          }
        ]
      }
    ]
  }

  return (
    <Layout>
      {/*
        SEOHead must be inside Layout so Next.js <Head> merging works correctly.
        It handles: self-referencing canonical per locale, all 8 hreflang tags,
        localized OG/Twitter meta, robots directives, and site-level structured data.
        Do NOT pass a hardcoded `canonical` prop — SEOHead builds it dynamically
        from router.pathname so localized pages get their own correct canonical.
      */}
      <SEOHead
        title={t('pdfToJpg.pageTitle') || "PDF to JPG Converter Online Free - Extract Images from PDF | SmallPDF.us"}
        description={t('pdfToJpg.pageDescription') || "Convert PDF to JPG images online for free. Turn PDF pages into high-quality 300 DPI pictures instantly. Extract images from any PDF document. No watermarks, fast and secure."}
        keywords="pdf to jpg, convert pdf to jpg, pdf to image, pdf to jpeg, extract images from pdf, pdf page to jpg, free pdf converter"
        ogImage="/og-pdf-to-jpg.jpg"
        structuredData={toolStructuredData}
      />
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
              {t('pdfToJpg.uploadTitle')} <span className="text-blue-600">{t('pdfToJpg.heroHighlight')}</span>
            </h1>

            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
              {t('pdfToJpg.uploadSubtitle')}
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{t('pdfToJpg.heroBadge1')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{t('pdfToJpg.heroBadge2')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{t('pdfToJpg.heroBadge3')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-xl border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors p-8">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,application/pdf"
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
                  <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-lg opacity-30 animate-blob"></div>
                  <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-lg opacity-30 animate-blob animation-delay-2000"></div>

                  {/* Icon container */}
                  <div className="relative w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    {isProcessing ? (
                      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Upload className="w-10 h-10 text-white animate-bounce-slow" />
                    )}
                  </div>

                  {/* Corner badge */}
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">
                {isProcessing ? t('pdfToJpg.uploadProcessing') : t('pdfToJpg.uploadDropText')}
              </h2>

              <p className="font-body text-slate-600 mb-6">
                {t('pdfToJpg.uploadOrText')}
              </p>

              <button
                onClick={handleButtonClick}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-display font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Upload className="w-5 h-5" />
                <span>{t('pdfToJpg.uploadButton')}</span>
              </button>

              <p className="font-body text-xs text-slate-500 mt-4">
                {t('pdfToJpg.uploadSupport')}
              </p>

              {isProcessing && (
                <div className="mt-6">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full animate-loading-bar"></div>
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
                    {t('pdfToJpg.dismiss')}
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
                {t('pdfToJpg.featuresTitle')}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t('pdfToJpg.featuresSubtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Camera,
                  title: t('pdfToJpg.feature1Title'),
                  desc: t('pdfToJpg.feature1Desc'),
                },
                {
                  icon: Layers,
                  title: t('pdfToJpg.feature2Title'),
                  desc: t('pdfToJpg.feature2Desc'),
                },
                {
                  icon: Star,
                  title: t('pdfToJpg.feature3Title'),
                  desc: t('pdfToJpg.feature3Desc'),
                },
                {
                  icon: Shield,
                  title: t('pdfToJpg.feature4Title'),
                  desc: t('pdfToJpg.feature4Desc'),
                },
                {
                  icon: Zap,
                  title: t('pdfToJpg.feature5Title'),
                  desc: t('pdfToJpg.feature5Desc'),
                },
                {
                  icon: Sparkles,
                  title: t('pdfToJpg.feature6Title'),
                  desc: t('pdfToJpg.feature6Desc'),
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl border border-blue-200 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
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
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t('pdfToJpg.stepsTitle')}</h2>
              <p className="font-body text-slate-600">{t('pdfToJpg.stepsSubtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: t('pdfToJpg.step1Title'),
                  desc: t('pdfToJpg.step1Desc'),
                  color: "bg-blue-600",
                },
                {
                  step: "2",
                  title: t('pdfToJpg.step2Title'),
                  desc: t('pdfToJpg.step2Desc'),
                  color: "bg-indigo-600",
                },
                {
                  step: "3",
                  title: t('pdfToJpg.step3Title'),
                  desc: t('pdfToJpg.step3Desc'),
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
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t('pdfToJpg.faqTitle')}</h2>
              <p className="font-body text-slate-600">{t('pdfToJpg.faqSubtitle')}</p>
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

        {/* SEO Content Section */}
        <div className="bg-blue-50 py-12 px-4 border-t border-blue-200">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-slate max-w-none">
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">
                {t('pdfToJpg.seoSection1Title')}
              </h2>
              <p className="font-body text-slate-700 mb-4">
                {t('pdfToJpg.seoSection1Para1')}
              </p>
              <p className="font-body text-slate-700 mb-4">
                {t('pdfToJpg.seoSection1Para2')}
              </p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">
                {t('pdfToJpg.seoSection2Title')}
              </h3>
              <p className="font-body text-slate-700 mb-4">
                {t('pdfToJpg.seoSection2Para')}
              </p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">{t('pdfToJpg.seoSection3Title')}</h3>
              <p className="font-body text-slate-700">
                {t('pdfToJpg.seoSection3Para')}
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              {t('pdfToJpg.ctaTitle')}
            </h2>
            <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              {t('pdfToJpg.ctaSubtitle')}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <FileImage className="w-5 h-5" />
              <span>{t('pdfToJpg.ctaButton')}</span>
            </button>
          </div>
        </div>
      {PremiumGateModal}
      {BatchGateModal}
      <RelatedTools current="pdf-to-jpg" />
      </Layout>
  )
}