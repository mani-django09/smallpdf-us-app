import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "../../components/SEOHead"
import { Upload, AlertCircle, CheckCircle2, Zap, Shield, ChevronDown, Unlock } from "lucide-react"
import { useTranslations } from "../../lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"

export default function UnlockPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('unlock-pdf')
  const { checkBatch, BatchGateModal } = useBatchGuard('unlock-pdf')
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

    const ext = file.name.toLowerCase()
    const hasValidExtension = ext.endsWith('.pdf')
    const hasValidMimeType = validTypes.includes(file.type)

    if (!hasValidExtension && !hasValidMimeType) {
      return { valid: false, error: t("unlockPdf.errorInvalidType") }
    }

    if (file.size > maxSize) {
      return { valid: false, error: t("unlockPdf.errorMaxSize") }
    }

    return { valid: true }
  }

  const processFiles = async (newFiles) => {
    if (newFiles.length === 0) {
      setError(t("unlockPdf.errorNoFiles"))
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

        sessionStorage.setItem("uploadedUnlockPdfFiles", JSON.stringify(fileDataArray))

        setTimeout(() => {
          router.push("/unlock-pdf/preview")
        }, 600)
      } catch (err) {
        console.error("Error processing files:", err)
        setError(t("unlockPdf.errorProcessing"))
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
    { question: t("unlockPdf.faq1Question"), answer: t("unlockPdf.faq1Answer") },
    { question: t("unlockPdf.faq2Question"), answer: t("unlockPdf.faq2Answer") },
    { question: t("unlockPdf.faq3Question"), answer: t("unlockPdf.faq3Answer") },
    { question: t("unlockPdf.faq4Question"), answer: t("unlockPdf.faq4Answer") },
    { question: t("unlockPdf.faq5Question"), answer: t("unlockPdf.faq5Answer") },
  ]

  const features = [
    {
      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
      title: t("unlockPdf.feature1Title"),
      desc: t("unlockPdf.feature1Desc"),
    },
    {
      icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
      title: t("unlockPdf.feature2Title"),
      desc: t("unlockPdf.feature2Desc"),
    },
    {
      icon: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z",
      title: t("unlockPdf.feature3Title"),
      desc: t("unlockPdf.feature3Desc"),
    },
    {
      icon: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
      title: t("unlockPdf.feature4Title"),
      desc: t("unlockPdf.feature4Desc"),
    },
    {
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      title: t("unlockPdf.feature5Title"),
      desc: t("unlockPdf.feature5Desc"),
    },
    {
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      title: t("unlockPdf.feature6Title"),
      desc: t("unlockPdf.feature6Desc"),
    },
  ]

  const steps = [
    { step: "1", title: t("unlockPdf.step1Title"), desc: t("unlockPdf.step1Desc"), color: "bg-amber-600" },
    { step: "2", title: t("unlockPdf.step2Title"), desc: t("unlockPdf.step2Desc"), color: "bg-amber-700" },
    { step: "3", title: t("unlockPdf.step3Title"), desc: t("unlockPdf.step3Desc"), color: "bg-amber-800" },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "Unlock PDF - Remove Password Protection | SmallPDF.us",
        // url omitted — SEOHead generates the correct localized URL dynamically
        "description": "Remove passwords and restrictions from PDF files instantly. Free online PDF unlocker.",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": { "@type": "Answer", "text": faq.answer },
        })),
      },
    ],
  }

  return (
    <Layout>
      <SEOHead
        title={t("unlockPdf.pageTitle")}
        description={t("unlockPdf.pageDescription")}
        keywords={t("unlockPdf.pageKeywords")}
        ogImage="/images/unlock-pdf-og.png"
        structuredData={structuredData}
      />
        {/* Compact Hero + Upload Section */}
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 py-8 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, rgb(245, 158, 11) 1px, transparent 0)`,
                backgroundSize: "32px 32px",
              }}
            ></div>
          </div>

          <div className="max-w-4xl mx-auto relative z-10">
            {/* Compact Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-md mb-3">
                <Unlock className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-slate-700">{t("unlockPdf.heroBadge")}</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 leading-tight">
                {t("unlockPdf.heroTitle")}
              </h1>

              <p className="text-base text-slate-600 max-w-2xl mx-auto mb-3">
                {t("unlockPdf.heroSubtitle")}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span>{t("unlockPdf.heroBadgeSecure")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>{t("unlockPdf.heroBadgeInstant")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>{t("unlockPdf.heroBadgeFree")}</span>
                </div>
              </div>
            </div>

            {/* Compact Upload Area */}
            <div className="bg-white rounded-xl shadow-xl p-6 border-2 border-slate-100">
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  dragActive
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-300 bg-slate-50 hover:border-amber-400 hover:bg-amber-50/30"
                } ${isProcessing ? "opacity-60 pointer-events-none" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isProcessing}
                />

                {isProcessing ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                      <Unlock className="w-8 h-8 text-white animate-bounce" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{t("unlockPdf.uploadLoadingTitle")}</h3>
                      <p className="text-sm text-slate-600">{t("unlockPdf.uploadLoadingSubtext")}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                      <Unlock className="w-8 h-8 text-white" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                      {t("unlockPdf.uploadDragTitle")}
                    </h2>

                    <p className="text-sm text-slate-600 mb-4">
                      {t("unlockPdf.uploadDragSubtext")}
                    </p>

                    <button
                      onClick={handleButtonClick}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      <Upload className="w-5 h-5" />
                      <span>{t("unlockPdf.uploadButton")}</span>
                    </button>

                    <p className="text-xs text-slate-500 mt-4">
                      {t("unlockPdf.uploadLimit")}
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {t("unlockPdf.featuresTitle")}
              </h2>
              <p className="text-slate-600">
                {t("unlockPdf.featuresSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-5 border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all"
                >
                  <div className="w-11 h-11 bg-amber-600 rounded-lg flex items-center justify-center mb-3 shadow">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-b from-amber-50 to-white py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {t("unlockPdf.stepsTitle")}
              </h2>
              <p className="text-slate-600">
                {t("unlockPdf.stepsSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {steps.map((step, i) => (
                <div key={i} className="relative">
                  <div className="bg-white rounded-lg p-5 border-2 border-slate-200 hover:border-amber-300 transition-all h-full">
                    <div className={`w-12 h-12 ${step.color} rounded-lg flex items-center justify-center mb-3 shadow-lg`}>
                      <span className="text-2xl font-bold text-white">{step.step}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                  </div>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
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
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {t("unlockPdf.faqTitle")}
              </h2>
              <p className="text-slate-600">
                {t("unlockPdf.faqSubtitle")}
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden hover:border-amber-300 transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-semibold text-slate-900 pr-4">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-amber-600 flex-shrink-0 transition-transform duration-300 ${
                        openFaq === index ? "transform rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`transition-all duration-300 ease-in-out ${
                      openFaq === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                    }`}
                  >
                    <div className="px-5 pb-4 pt-2">
                      <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 py-12 px-4 relative overflow-hidden">
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
            <h2 className="text-3xl font-bold text-white mb-3">
              {t("unlockPdf.ctaTitle")}
            </h2>
            <p className="text-lg text-orange-100 mb-6 max-w-2xl mx-auto">
              {t("unlockPdf.ctaSubtitle")}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-amber-600 px-7 py-3 rounded-lg font-bold hover:bg-amber-50 transition-all shadow-xl hover:shadow-2xl"
            >
              <Unlock className="w-5 h-5" />
              <span>{t("unlockPdf.ctaButton")}</span>
            </button>
          </div>
        </div>
      <RelatedTools current="unlock-pdf" />
      {PremiumGateModal}
      {BatchGateModal}
      </Layout>
    )
}