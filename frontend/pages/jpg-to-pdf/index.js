import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "../../components/SEOHead"
import { Upload, FileText, AlertCircle, CheckCircle2, Zap, Shield, ChevronDown, Image } from "lucide-react"
import { useTranslations } from "../../lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"

// In-memory file store — avoids sessionStorage quota errors with large images.
// Survives Next.js client-side navigation within the same tab.
export const jpgFileStore = {
  files: [],
  set(arr) { this.files = arr },
  get() { return this.files },
  clear() { this.files = [] },
}

export default function JpgToPdf() {
const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('jpg-to-pdf')
  const { checkBatch, BatchGateModal } = useBatchGuard('jpg-to-pdf')
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
    const validTypes = ["image/jpeg", "image/jpg"]

    const ext = file.name.toLowerCase()
    const hasValidExtension = ext.endsWith('.jpg') || ext.endsWith('.jpeg')
    const hasValidMimeType = validTypes.includes(file.type)

    if (!hasValidExtension && !hasValidMimeType) {
      return { valid: false, error: t("jpgToPdf.index.errorInvalidType") }
    }

    return { valid: true }
  }

  const processFiles = async (newFiles) => {
    if (newFiles.length === 0) {
      setError(t("jpgToPdf.index.errorNoFiles"))
      return
    }

    // Freemium size gate
    if (!checkFiles(newFiles)) return

    // Batch count gate — shows upgrade modal if over plan limit
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
        // Store raw File objects in memory — no base64, no sessionStorage quota issues
      jpgFileStore.set(validFiles)

        setTimeout(() => {
          router.push("/jpg-to-pdf/preview")
        }, 600)
      } catch (err) {
        console.error("Error processing files:", err)
        setError(t("jpgToPdf.index.errorProcessing"))
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
    { question: t("jpgToPdf.index.faq1Q"), answer: t("jpgToPdf.index.faq1A") },
    { question: t("jpgToPdf.index.faq2Q"), answer: t("jpgToPdf.index.faq2A") },
    { question: t("jpgToPdf.index.faq3Q"), answer: t("jpgToPdf.index.faq3A") },
    { question: t("jpgToPdf.index.faq4Q"), answer: t("jpgToPdf.index.faq4A") },
    { question: t("jpgToPdf.index.faq5Q"), answer: t("jpgToPdf.index.faq5A") },
    { question: t("jpgToPdf.index.faq6Q"), answer: t("jpgToPdf.index.faq6A") },
    { question: t("jpgToPdf.index.faq7Q"), answer: t("jpgToPdf.index.faq7A") },
    { question: t("jpgToPdf.index.faq8Q"), answer: t("jpgToPdf.index.faq8A") },
  ]

  // Enhanced structured data with more SEO-rich content
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": `${t("jpgToPdf.index.heroTitle")} - SmallPDF.us`,
        "description": t("jpgToPdf.index.heroSubtitle"),
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Windows, Mac, Linux, iOS, Android",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        },
        "featureList": [
          t("jpgToPdf.index.feature1Title"),
          t("jpgToPdf.index.feature2Title"),
          t("jpgToPdf.index.feature3Title"),
          t("jpgToPdf.index.feature4Title"),
          t("jpgToPdf.index.feature5Title"),
          t("jpgToPdf.index.feature6Title"),
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
        "name": t("jpgToPdf.index.stepsTitle"),
        "description": t("jpgToPdf.index.stepsSubtitle"),
        "totalTime": "PT1M",
        "step": [
          {
            "@type": "HowToStep",
            "name": t("jpgToPdf.index.step1Title"),
            "text": t("jpgToPdf.index.step1Desc"),
            "position": 1
          },
          {
            "@type": "HowToStep",
            "name": t("jpgToPdf.index.step2Title"),
            "text": t("jpgToPdf.index.step2Desc"),
            "position": 2
          },
          {
            "@type": "HowToStep",
            "name": t("jpgToPdf.index.step3Title"),
            "text": t("jpgToPdf.index.step3Desc"),
            "position": 3
          }
        ]
      }
    ]
  }

  return (
    <>
      <SEOHead
        title={t("jpgToPdf.index.seo.title") || t("jpgToPdf.title")}
        description={t("jpgToPdf.index.seo.description") || t("jpgToPdf.description")}
        keywords={t("jpgToPdf.index.seo.keywords") || t("jpgToPdf.keywords")}
        ogImage="https://smallpdf.us/og-jpg-to-pdf.jpg"
        structuredData={structuredData}
      />

      <Layout
        title={t("jpgToPdf.index.heroTitle")}
        description={t("jpgToPdf.index.heroSubtitle")}
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
        `}</style>

        {/* Hero Section - SEO Optimized */}
        <div className="bg-gradient-to-br from-white via-blue-50 to-blue-100 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-4 pt-6 pb-5 text-center">
            {/* H1 with primary keyword */}
            <h1 className="font-display text-3xl md:text-5xl font-bold text-slate-900 mb-4">
              {t("jpgToPdf.index.heroTitle")}
            </h1>

            {/* Subtitle with secondary keywords */}
            <p className="font-body text-base md:text-lg text-slate-600 max-w-2xl mx-auto mb-4">
              {t("jpgToPdf.index.heroSubtitle")}
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 mb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="font-semibold">{t("jpgToPdf.index.badge1")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">{t("jpgToPdf.index.badge2")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600" />
                <span className="font-semibold">{t("jpgToPdf.index.badge3")}</span>
              </div>
            </div>
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
                    <Image className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t("jpgToPdf.index.processingTitle")}</h3>
                  <p className="font-body text-sm text-slate-600">{t("jpgToPdf.index.processingSubtitle")}</p>
                  <div className="mt-5 max-w-xs mx-auto">
                    <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
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
                        : "border-3 border-dashed border-slate-300 hover:border-blue-400 hover:bg-slate-50 hover:shadow-md"
                    }`}
                    style={{ borderWidth: dragActive ? "4px" : "3px" }}
                  >
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".jpg,.jpeg,image/jpeg"
                      multiple
                      onChange={handleFileChange}
                      aria-label="Upload JPG or JPEG files"
                    />

                    <div className="p-10 text-center">
                      <div className="mb-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-3 shadow-xl transform hover:scale-110 transition-transform duration-300">
                          <Image className="w-8 h-8 text-white animate-bounce-slow" />
                        </div>
                      </div>

                      <h2 className="font-display text-xl font-bold text-slate-900 mb-2">
                        {dragActive ? t("jpgToPdf.index.dropActive") : t("jpgToPdf.index.dropTitle")}
                      </h2>
                      <p className="font-body text-sm text-slate-500 mb-4">
                        {t("jpgToPdf.index.dropSubtitle")}
                      </p>

                      <button
                        type="button"
                        onClick={handleButtonClick}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        aria-label="Select JPG or JPEG files for conversion"
                      >
                        <Upload className="w-5 h-5" />
                        <span>{t("jpgToPdf.index.selectButton")}</span>
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t("jpgToPdf.index.badge4")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-600" />
                          <span>{t("jpgToPdf.index.badge5")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t("jpgToPdf.index.badge6")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3" role="alert">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Features Section - SEO optimized with keyword-rich content */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                {t("jpgToPdf.index.featuresTitle")}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t("jpgToPdf.index.featuresSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", title: t("jpgToPdf.index.feature1Title"), desc: t("jpgToPdf.index.feature1Desc") },
                { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", title: t("jpgToPdf.index.feature2Title"), desc: t("jpgToPdf.index.feature2Desc") },
                { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", title: t("jpgToPdf.index.feature3Title"), desc: t("jpgToPdf.index.feature3Desc") },
                { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: t("jpgToPdf.index.feature4Title"), desc: t("jpgToPdf.index.feature4Desc") },
                { icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", title: t("jpgToPdf.index.feature5Title"), desc: t("jpgToPdf.index.feature5Desc") },
                { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", title: t("jpgToPdf.index.feature6Title"), desc: t("jpgToPdf.index.feature6Desc") },
              ].map((feature, i) => (
                <div key={i} className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 border-2 border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
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

        {/* How It Works Section - SEO rich content */}
        <div className="bg-gradient-to-br from-slate-50 to-white py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                {t("jpgToPdf.index.stepsTitle")}
              </h2>
              <p className="font-body text-slate-600 max-w-2xl mx-auto">
                {t("jpgToPdf.index.stepsSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: "1", title: t("jpgToPdf.index.step1Title"), desc: t("jpgToPdf.index.step1Desc"), color: "bg-blue-600" },
                { step: "2", title: t("jpgToPdf.index.step2Title"), desc: t("jpgToPdf.index.step2Desc"), color: "bg-blue-700" },
                { step: "3", title: t("jpgToPdf.index.step3Title"), desc: t("jpgToPdf.index.step3Desc"), color: "bg-blue-800" },
              ].map((step, i) => (
                <div key={i} className="relative">
                  <div className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-blue-300 transition-all duration-300 h-full shadow-md hover:shadow-xl">
                    <div
                      className={`w-14 h-14 ${step.color} rounded-xl flex items-center justify-center mb-4 shadow-xl`}
                    >
                      <span className="font-display text-2xl font-bold text-white">{step.step}</span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
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

        {/* FAQ Section - Rich SEO content */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                {t("jpgToPdf.index.faqTitle")}
              </h2>
              <p className="font-body text-slate-600">
                {t("jpgToPdf.index.faqSubtitle")}
              </p>
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
                    aria-expanded={openFaq === index}
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

        {/* Additional SEO Content Section */}
        <div className="bg-gradient-to-br from-slate-50 to-white py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border-2 border-slate-200 shadow-lg">
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">
                {t("jpgToPdf.index.aboutTitle")}
              </h2>
              <div className="space-y-4 font-body text-slate-700 leading-relaxed">
                <p>
                  {t("jpgToPdf.index.aboutP1")}
                </p>
                <p>
                  {t("jpgToPdf.index.aboutP2")}
                </p>
                <p>
                  {t("jpgToPdf.index.aboutP3")}
                </p>
                <p>
                  {t("jpgToPdf.index.aboutP4")}
                </p>
                <p>
                  {t("jpgToPdf.index.aboutP5")}
                </p>
              </div>
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
              {t("jpgToPdf.index.ctaTitle")}
            </h2>
            <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              {t("jpgToPdf.index.ctaSubtitle")}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
              aria-label="Scroll to top to start converting JPG to PDF"
            >
              <Upload className="w-6 h-6" />
              <span>{t("jpgToPdf.index.ctaButton")}</span>
            </button>
          </div>
        </div>
        <RelatedTools current="jpg-to-pdf" />
      </Layout>

      {/* Freemium gate modal — renders only when file size limit is exceeded */}
      {PremiumGateModal}

      {/* Batch limit modal — renders when file count exceeds plan limit */}
      {BatchGateModal}
    </>
  )
}