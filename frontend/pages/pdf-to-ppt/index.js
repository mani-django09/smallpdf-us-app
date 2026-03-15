import { useState, useRef, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import {
  Presentation,
  Upload,
  CheckCircle,
  Shield,
  Zap,
  Clock,
  Star,
  ArrowRight,
  FileText,
  ChevronDown,
  ChevronUp,
  Layers,
  Monitor,
  FileCheck,
  Lock,
  Sparkles,
  Image,
  Edit3,
  AlertCircle,
  Trash2,
} from "lucide-react"

export default function PdfToPpt() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('pdf-to-ppt')
  const { checkBatch, BatchGateModal } = useBatchGuard('pdf-to-ppt')
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState([])
  const [error, setError] = useState("")
  const [openFaq, setOpenFaq] = useState(null)

  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  const MAX_FILES = 10
  const ACCEPTED_EXTENSIONS = [".pdf"]
  const ACCEPTED_TYPES = ["application/pdf"]

  const validateFile = (file) => {
    const ext = "." + file.name.split(".").pop().toLowerCase()

    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
      return { valid: false, error: `${file.name}: ${t('pdfToPpt.errorInvalidType')}` }
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `${file.name}: ${t('pdfToPpt.errorMaxSize')}` }
    }

    return { valid: true }
  }

  const processFiles = useCallback(
    (newFiles) => {
      setError("")
      const fileArray = Array.from(newFiles)

      if (!checkFiles(fileArray)) return
      if (!checkBatch(fileArray)) return
      if (files.length + fileArray.length > MAX_FILES) {
        setError(t('pdfToPpt.errorMaxFiles'))
        return
      }

      const validFiles = []
      const errors = []

      fileArray.forEach((file) => {
        const validation = validateFile(file)
        if (validation.valid) {
          validFiles.push(file)
        } else {
          errors.push(validation.error)
        }
      })

      if (errors.length > 0) {
        setError(errors.join(". "))
      }

      if (validFiles.length > 0) {
        const filesWithIds = validFiles.map((file) => ({
          id: Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
        }))

        setFiles((prev) => [...prev, ...filesWithIds])
      }
    },
    [files.length],
  )

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles],
  )

  const handleFileSelect = useCallback(
    (e) => {
      if (e.target.files) {
        processFiles(e.target.files)
      }
    },
    [processFiles],
  )

  const handleConvert = async () => {
    if (files.length === 0) return

    const filesData = await Promise.all(
      files.map(async (f) => {
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(f.file)
        })
        return {
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
          data: base64,
        }
      }),
    )

    sessionStorage.setItem("uploadedPdfFilesForPpt", JSON.stringify(filesData))
    router.push("/pdf-to-ppt/preview")
  }

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    }
    return (bytes / 1024).toFixed(1) + " KB"
  }

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const faqs = [
    {
      q: t('pdfToPpt.faq1Question'),
      a: t('pdfToPpt.faq1Answer'),
    },
    {
      q: t('pdfToPpt.faq2Question'),
      a: t('pdfToPpt.faq2Answer'),
    },
    {
      q: t('pdfToPpt.faq3Question'),
      a: t('pdfToPpt.faq3Answer'),
    },
    {
      q: t('pdfToPpt.faq4Question'),
      a: t('pdfToPpt.faq4Answer'),
    },
    {
      q: t('pdfToPpt.faq5Question'),
      a: t('pdfToPpt.faq5Answer'),
    },
    {
      q: t('pdfToPpt.faq6Question'),
      a: t('pdfToPpt.faq6Answer'),
    },
  ]

  // Tool-specific structured data — SEOHead handles site-level graph, canonical, and all hreflang
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us'
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        // Use t() so schema language matches page content for every locale
        name: t('pdfToPpt.heroTitle'),
        description: t('pdfToPpt.pageDescription'),
        // Dynamic URL — correct for every locale, not hardcoded to EN
        url: `${baseUrl}${router.locale === 'en' ? '' : '/' + router.locale}/pdf-to-ppt/`,
        applicationCategory: "UtilityApplication",
        operatingSystem: "Any",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        // No aggregateRating — fake ratings risk a Google manual action penalty
        featureList: [
          t('pdfToPpt.feature1Title'),
          t('pdfToPpt.feature2Title'),
          t('pdfToPpt.feature3Title'),
          t('pdfToPpt.feature4Title'),
          t('pdfToPpt.feature5Title'),
          t('pdfToPpt.feature6Title'),
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
      {
        // HowTo fully localized via t() — schema language now matches page language
        "@type": "HowTo",
        name: t('pdfToPpt.stepsTitle'),
        description: t('pdfToPpt.stepsSubtitle'),
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: t('pdfToPpt.step1Title'),
            text: t('pdfToPpt.step1Desc'),
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: t('pdfToPpt.step2Title'),
            text: t('pdfToPpt.step2Desc'),
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: t('pdfToPpt.step3Title'),
            text: t('pdfToPpt.step3Desc'),
          },
        ],
      },
    ],
  }

  return (
    <Layout>
      {/*
        SEOHead is inside Layout so Next.js <Head> merging works correctly.
        It auto-builds: self-referencing canonical per locale, all 8 hreflang
        tags (de/fr/es/it/id/pt/ja/en + x-default), localized OG/Twitter meta,
        and robots directives. Never pass a hardcoded `canonical` prop here —
        SEOHead derives it dynamically from router.pathname so every localized
        page gets its own correct canonical URL.
      */}
      <SEOHead
        title={t('pdfToPpt.pageTitle')}
        description={t('pdfToPpt.pageDescription')}
        keywords="pdf to ppt, pdf to pptx, pdf to powerpoint, convert pdf to ppt, pdf to presentation, pdf converter, powerpoint converter, free pdf to ppt, online pdf to powerpoint, editable ppt from pdf"
        ogImage="https://smallpdf.us/images/pdf-to-ppt-og.png"
        structuredData={structuredData}
      />

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap");
        .font-display {
          font-family: "Plus Jakarta Sans", sans-serif;
        }
        .font-body {
          font-family: "DM Sans", sans-serif;
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
      <div className="bg-gradient-to-br from-white via-red-50 to-orange-50 border-b border-red-200">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            {t('pdfToPpt.heroTitle')} <span className="text-red-600">{t('pdfToPpt.heroOnlineFree')}</span>
          </h1>

          <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
            {t('pdfToPpt.heroSubtitle')}
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-gradient-to-br from-red-50 via-orange-50 to-red-50 py-8 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-8 right-20 w-64 h-64 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <div className="max-w-2xl mx-auto relative z-10">
          <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-6">
            {files.length > 0 ? (
              <>
                {/* File Info */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-red-200">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-7 h-7 text-red-600" />
                    </div>
                    <div>
                      <p className="font-display text-lg font-semibold text-slate-900">
                        {files.length} {files.length > 1 ? t('pdfToPpt.filesSelected') : t('pdfToPpt.fileSelected')}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))} total
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFiles([])}
                    className="p-2.5 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove all files"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>

                {/* Selected Files List */}
                <div className="max-h-64 overflow-y-auto space-y-2 mb-6">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-body text-sm font-medium text-slate-800 truncate">{file.name}</p>
                          <p className="font-body text-xs text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(file.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Convert Button */}
                <button
                  onClick={handleConvert}
                  className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-base hover:bg-red-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform hover:scale-105"
                >
                  <Presentation className="w-5 h-5" />
                  <span>{t('pdfToPpt.convertButton')}</span>
                </button>
              </>
            ) : (
              <>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative rounded-xl transition-all duration-300 ${
                    isDragging
                      ? "border-4 border-red-500 bg-red-50 scale-102 shadow-lg"
                      : "border-3 border-dashed border-red-300 hover:border-red-400 hover:bg-red-50 hover:shadow-md"
                  }`}
                  style={{ borderWidth: isDragging ? "4px" : "3px" }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                  />

                  <div className="p-10 text-center">
                    <div className="mb-3">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-3 shadow-xl transform hover:scale-110 transition-transform duration-300">
                        <Presentation className="w-8 h-8 text-white animate-bounce-slow" />
                      </div>
                    </div>

                    <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                      {isDragging ? t('pdfToPpt.dropHere') : t('pdfToPpt.uploadDropTitle')}
                    </h3>
                    <p className="font-body text-sm text-slate-500 mb-4">
                      {t('pdfToPpt.uploadDropSubtitle')}
                    </p>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 bg-red-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-red-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <Upload className="w-5 h-5" />
                      <span>{t('pdfToPpt.chooseButton')}</span>
                    </button>

                    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>{t('pdfToPpt.badgePdfFormat')}</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                      <div className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-slate-600" />
                        <span>{t('pdfToPpt.badgeSecure')}</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-orange-600" />
                        <span>{t('pdfToPpt.badgeInstant')}</span>
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

            {files.length === 0 && (
              <p className="text-center font-body text-sm text-slate-600 mt-5">
                {t('pdfToPpt.uploadSupport')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t('pdfToPpt.stepsTitle')}
            </h2>
            <p className="font-body text-lg text-slate-600 max-w-2xl mx-auto">
              {t('pdfToPpt.stepsSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Upload,
                title: t('pdfToPpt.step1Title'),
                description: t('pdfToPpt.step1Desc'),
                color: "from-red-500 to-red-600",
              },
              {
                step: "02",
                icon: Layers,
                title: t('pdfToPpt.step2Title'),
                description: t('pdfToPpt.step2Desc'),
                color: "from-red-600 to-orange-500",
              },
              {
                step: "03",
                icon: Edit3,
                title: t('pdfToPpt.step3Title'),
                description: t('pdfToPpt.step3Desc'),
                color: "from-orange-500 to-orange-600",
              },
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="bg-slate-50 rounded-2xl p-8 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="absolute -top-4 left-8">
                    <span className="font-display text-6xl font-bold text-slate-100 group-hover:text-red-100 transition-colors">
                      {item.step}
                    </span>
                  </div>

                  <div
                    className={`relative w-16 h-16 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}
                  >
                    <item.icon className="w-8 h-8 text-white" />
                  </div>

                  <h3 className="font-display text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="font-body text-slate-600">{item.description}</p>
                </div>

                {/* Connector Arrow */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t('pdfToPpt.featuresTitle')}
            </h2>
            <p className="font-body text-lg text-slate-600 max-w-2xl mx-auto">
              {t('pdfToPpt.featuresSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Edit3,
                title: t('pdfToPpt.feature1Title'),
                description: t('pdfToPpt.feature1Desc'),
                color: "bg-red-600",
              },
              {
                icon: Layers,
                title: t('pdfToPpt.feature2Title'),
                description: t('pdfToPpt.feature2Desc'),
                color: "bg-orange-600",
              },
              {
                icon: Image,
                title: t('pdfToPpt.feature3Title'),
                description: t('pdfToPpt.feature3Desc'),
                color: "bg-pink-600",
              },
              {
                icon: Zap,
                title: t('pdfToPpt.feature4Title'),
                description: t('pdfToPpt.feature4Desc'),
                color: "bg-amber-500",
              },
              {
                icon: Shield,
                title: t('pdfToPpt.feature5Title'),
                description: t('pdfToPpt.feature5Desc'),
                color: "bg-green-600",
              },
              {
                icon: Monitor,
                title: t('pdfToPpt.feature6Title'),
                description: t('pdfToPpt.feature6Desc'),
                color: "bg-blue-600",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100"
              >
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="font-body text-slate-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Conversion Flow */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                {t('pdfToPpt.whyConvertTitle')}
              </h2>
              <p className="font-body text-lg text-slate-600 mb-8">
                {t('pdfToPpt.whyConvertSubtitle')}
              </p>

              <div className="space-y-4">
                {[
                  t('pdfToPpt.whyReason1'),
                  t('pdfToPpt.whyReason2'),
                  t('pdfToPpt.whyReason3'),
                  t('pdfToPpt.whyReason4'),
                  t('pdfToPpt.whyReason5'),
                  t('pdfToPpt.whyReason6'),
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="font-body text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl p-8">
              <div className="text-center mb-6">
                <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t('pdfToPpt.conversionFlowTitle')}</h3>
                <p className="font-body text-slate-600 text-sm">{t('pdfToPpt.conversionFlowSubtitle')}</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm text-center flex-1">
                  <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <span className="font-display font-bold text-slate-900">PDF</span>
                  <p className="font-body text-xs text-slate-500 mt-1">{t('pdfToPpt.inputLabel')}</p>
                </div>

                <ArrowRight className="w-8 h-8 text-red-400 flex-shrink-0" />

                <div className="bg-white p-6 rounded-2xl shadow-sm text-center flex-1">
                  <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Presentation className="w-8 h-8 text-white" />
                  </div>
                  <span className="font-display font-bold text-slate-900">PPTX</span>
                  <p className="font-body text-xs text-slate-500 mt-1">{t('pdfToPpt.outputLabel')}</p>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="font-body text-sm text-slate-600">
                  {t('pdfToPpt.conversionFlowCompat')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t('pdfToPpt.faqTitle')}
            </h2>
            <p className="font-body text-lg text-slate-600">{t('pdfToPpt.faqSubtitle')}</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-display font-semibold text-slate-900 pr-4">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-red-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6">
                    <p className="font-body text-slate-600">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-red-500 via-red-600 to-orange-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('pdfToPpt.ctaTitle')}
          </h2>
          <p className="font-body text-lg text-red-100 mb-8 max-w-2xl mx-auto">
            {t('pdfToPpt.ctaSubtitle')}
          </p>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-3 bg-white text-red-600 px-8 py-4 rounded-xl font-display font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <Upload className="w-6 h-6" />
            <span>{t('pdfToPpt.ctaButton')}</span>
          </button>

          <p className="font-body text-sm text-red-200 mt-6">
            {t('pdfToPpt.ctaNote')}
          </p>
        </div>
      </section>

      {/* Related Tools */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">{t('pdfToPpt.relatedToolsTitle')}</h2>
            <p className="font-body text-slate-600">{t('pdfToPpt.relatedToolsSubtitle')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: t('pdfToPpt.relatedTool1'), href: "/ppt-to-pdf", icon: Presentation, color: "bg-orange-600" },
              { name: t('pdfToPpt.relatedTool2'), href: "/pdf-to-word", icon: FileText, color: "bg-blue-600" },
              { name: t('pdfToPpt.relatedTool3'), href: "/pdf-to-excel", icon: FileCheck, color: "bg-green-600" },
              { name: t('pdfToPpt.relatedTool4'), href: "/merge-pdf", icon: Layers, color: "bg-purple-600" },
              { name: t('pdfToPpt.relatedTool5'), href: "/compress-pdf", icon: Zap, color: "bg-amber-500" },
              { name: t('pdfToPpt.relatedTool6'), href: "/pdf-to-jpg", icon: Image, color: "bg-pink-600" },
            ].map((tool) => (
              // router.href() translates the EN path to the correct localized URL
              // e.g. /ppt-to-pdf → /de/ppt-in-pdf for German users
              <a
                key={tool.name}
                href={router.href(tool.href)}
                className="group p-4 bg-slate-50 rounded-xl hover:bg-white hover:shadow-lg transition-all duration-300 text-center"
              >
                <div
                  className={`w-12 h-12 ${tool.color} rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md group-hover:scale-110 transition-transform`}
                >
                  <tool.icon className="w-6 h-6 text-white" />
                </div>
                <span className="font-display text-sm font-semibold text-slate-900">{tool.name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <RelatedTools current="pdf-to-ppt" />
      {PremiumGateModal}
      {BatchGateModal}
    </Layout>
  )
}