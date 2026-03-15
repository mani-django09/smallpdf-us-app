import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import { Upload, FileText, AlertCircle, CheckCircle2, Shield, ChevronDown, ImageIcon } from "lucide-react"

export default function PngToPdf() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('png-to-pdf')
  const { checkBatch, BatchGateModal } = useBatchGuard('png-to-pdf')
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
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    const maxSize = 50 * 1024 * 1024

    if (!validTypes.includes(file.type)) {
      return { valid: false, error: t('pngToPdf.errorInvalidType') }
    }

    if (file.size > maxSize) {
      return { valid: false, error: t('pngToPdf.errorMaxSize') }
    }

    return { valid: true }
  }

  const processFiles = async (newFiles) => {
    if (newFiles.length === 0) {
      setError(t('pngToPdf.errorMinFiles'))
      return
    }

    if (!checkFiles(newFiles)) return
    if (!checkBatch(newFiles)) return

    const validFiles = []
    let hasError = false

    for (const file of newFiles) {
      const validation = validateFile(file)
      if (validation.valid) {
        validFiles.push({
          file,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
        })
      } else {
        setError(validation.error)
        hasError = true
        break
      }
    }

    if (!hasError && validFiles.length > 0) {
      setIsProcessing(true)
      setError("")

      try {
        const fileDataArray = await Promise.all(
          validFiles.map(async (f) => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = (e) => {
                resolve({
                  id: f.id,
                  name: f.name,
                  size: f.size,
                  type: f.file.type,
                  data: e.target.result,
                })
              }
              reader.onerror = reject
              reader.readAsDataURL(f.file)
            })
          }),
        )

        sessionStorage.setItem("uploadedPngFiles", JSON.stringify(fileDataArray))

        setTimeout(() => {
          router.push("/png-to-pdf/preview")
        }, 600)
      } catch (err) {
        console.error("Error processing files:", err)
        setError(t('pngToPdf.errorProcessing'))
        setIsProcessing(false)
      }
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError("")

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files))
    }
  }, [])

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

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    {
      question: t('pngToPdf.faq1Question'),
      answer: t('pngToPdf.faq1Answer'),
    },
    {
      question: t('pngToPdf.faq2Question'),
      answer: t('pngToPdf.faq2Answer'),
    },
    {
      question: t('pngToPdf.faq3Question'),
      answer: t('pngToPdf.faq3Answer'),
    },
    {
      question: t('pngToPdf.faq4Question'),
      answer: t('pngToPdf.faq4Answer'),
    },
    {
      question: t('pngToPdf.faq5Question'),
      answer: t('pngToPdf.faq5Answer'),
    },
  ]

  // Tool-specific structured data — SEOHead handles site-level graph, canonical, and all 8 hreflang tags
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us'
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        // Use t() so schema language matches page content for every locale
        "name": t('pngToPdf.pageTitle'),
        "description": t('pngToPdf.pageDescription'),
        // Dynamic URL — correct per locale, never hardcoded to EN path
        "url": `${baseUrl}${locale === 'en' ? '' : '/' + locale}/png-to-pdf/`,
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Any",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
        // No aggregateRating — fabricated ratings risk a Google manual action
        "featureList": [
          t('pngToPdf.feature1Title'),
          t('pngToPdf.feature2Title'),
          t('pngToPdf.feature3Title'),
          t('pngToPdf.feature4Title'),
          t('pngToPdf.feature5Title'),
          t('pngToPdf.feature6Title'),
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
        // HowTo fully localized via t() — schema language now matches page language
        "@type": "HowTo",
        "name": t('pngToPdf.stepsTitle'),
        "description": t('pngToPdf.stepsSubtitle'),
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": t('pngToPdf.step1Title'),
            "text": t('pngToPdf.step1Desc'),
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": t('pngToPdf.step2Title'),
            "text": t('pngToPdf.step2Desc'),
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": t('pngToPdf.step3Title'),
            "text": t('pngToPdf.step3Desc'),
          }
        ]
      }
    ]
  }

  return (
    <>
    <Layout>
      {/*
        SEOHead must be inside Layout so Next.js <Head> merging works correctly.
        It auto-builds: self-referencing canonical per locale, all 8 hreflang tags,
        localized OG/Twitter meta, and robots directives.
        Never pass a hardcoded `canonical` prop — SEOHead derives it dynamically
        from router.pathname so each locale gets its own correct canonical URL.
      */}
      <SEOHead
        title={t('pngToPdf.pageTitle')}
        description={t('pngToPdf.pageDescription')}
        keywords="png to pdf, convert png to pdf, image to pdf, jpg to pdf, webp to pdf, photos to pdf, pictures to pdf, free image converter"
        ogImage="/og-png-to-pdf.jpg"
        structuredData={structuredData}
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
              {t('pngToPdf.heroTitle')} <span className="text-blue-600">{t('pngToPdf.heroOnlineFree')}</span>
            </h1>

            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
              {t('pngToPdf.heroSubtitle')}
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
                    <FileText className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t('pngToPdf.loadingTitle')}</h3>
                  <p className="font-body text-sm text-slate-600">{t('pngToPdf.loadingSubtitle')}</p>
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
                      accept="image/png,image/jpeg,image/jpg,image/webp"
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
                        {dragActive ? t('pngToPdf.dragActive') : t('pngToPdf.selectImages')}
                      </h3>
                      <p className="font-body text-sm text-slate-500 mb-4">
                        {t('pngToPdf.dragSubtitle')}
                      </p>

                      <button
                        type="button"
                        onClick={handleButtonClick}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Upload className="w-5 h-5" />
                        <span>{t('pngToPdf.chooseButton')}</span>
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t('pngToPdf.badgePng')}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-600" />
                          <span>{t('pngToPdf.badgeSecure')}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{t('pngToPdf.badgeInstant')}</span>
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
                  Up to <span className="font-bold text-blue-600">{t('pngToPdf.fileLimitSize')}</span> per file |{" "}
                  <span className="font-bold text-blue-600">{t('pngToPdf.fileLimitCount')}</span> maximum
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
                {t('pngToPdf.featuresTitle')}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t('pngToPdf.featuresSubtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
                  title: t('pngToPdf.feature1Title'),
                  desc: t('pngToPdf.feature1Desc'),
                },
                {
                  icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                  title: t('pngToPdf.feature2Title'),
                  desc: t('pngToPdf.feature2Desc'),
                },
                {
                  icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                  title: t('pngToPdf.feature3Title'),
                  desc: t('pngToPdf.feature3Desc'),
                },
                {
                  icon: "M13 10V3L4 14h7v7l9-11h-7z",
                  title: t('pngToPdf.feature4Title'),
                  desc: t('pngToPdf.feature4Desc'),
                },
                {
                  icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
                  title: t('pngToPdf.feature5Title'),
                  desc: t('pngToPdf.feature5Desc'),
                },
                {
                  icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                  title: t('pngToPdf.feature6Title'),
                  desc: t('pngToPdf.feature6Desc'),
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
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t('pngToPdf.stepsTitle')}</h2>
              <p className="font-body text-slate-600">{t('pngToPdf.stepsSubtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: t('pngToPdf.step1Title'),
                  desc: t('pngToPdf.step1Desc'),
                  color: "bg-blue-600",
                },
                {
                  step: "2",
                  title: t('pngToPdf.step2Title'),
                  desc: t('pngToPdf.step2Desc'),
                  color: "bg-indigo-600",
                },
                {
                  step: "3",
                  title: t('pngToPdf.step3Title'),
                  desc: t('pngToPdf.step3Desc'),
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
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t('pngToPdf.faqTitle')}</h2>
              <p className="font-body text-slate-600">{t('pngToPdf.faqSubtitle')}</p>
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
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">
                {t('pngToPdf.seoTitle')}
              </h2>
              <p className="font-body text-slate-700 mb-4">
                {t('pngToPdf.seoPara1')}
              </p>
              <p className="font-body text-slate-700 mb-4">
                {t('pngToPdf.seoPara2')}
              </p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">{t('pngToPdf.seoSubtitle')}</h3>
              <p className="font-body text-slate-700">
                {t('pngToPdf.seoPara3')}
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t('pngToPdf.ctaTitle')}</h2>
            <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              {t('pngToPdf.ctaSubtitle')}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <Upload className="w-5 h-5" />
              <span>{t('pngToPdf.ctaButton')}</span>
            </button>
          </div>
        </div>
        <RelatedTools current="png-to-pdf" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}