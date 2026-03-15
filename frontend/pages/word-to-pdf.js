import { useState, useCallback, useEffect } from "react"
import { useLocalizedRouter } from "../lib/useLocalizedRouter"
import Layout from "../components/Layout"
import RelatedTools from '../components/RelatedTools'
import SEOHead from "../components/SEOHead"
import { Upload, FileText, AlertCircle, CheckCircle2, Zap, Shield, Star, ChevronDown, Sparkles, Home } from "lucide-react"
import { useTranslations } from "../lib/i18n"
import { useFileSizeGuard } from "../hooks/useFileSizeGuard"
import { useBatchGuard } from "../hooks/useBatchGuard"

// Inline AdSense component
function AdSenseUnit({ adSlot, style = {} }) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch (err) {
      console.error("AdSense:", err)
    }
  }, [])
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block", ...style }}
      data-ad-client="ca-pub-6913093595582462"
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

// Store raw File object in memory — no base64, no sessionStorage size limit
export const wordToPdfStore = { file: null, meta: null }

export default function WordToPDF() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('word-to-pdf')
  const { checkBatch, BatchGateModal } = useBatchGuard('word-to-pdf')
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
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
    const maxSize = 100 * 1024 * 1024

    if (!validTypes.includes(file.type)) {
      setError(t("wordToPdf.errorInvalidType"))
      return false
    }

    if (file.size > maxSize) {
      setError(t("wordToPdf.errorMaxSize"))
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
    document.getElementById('file-upload').click()
  }

  const handleContinue = (fileToConvert) => {
    if (!fileToConvert) return
    if (!checkFiles([fileToConvert])) return
    if (!checkBatch([fileToConvert])) return

    setFile(fileToConvert)
    setIsProcessing(true)
    
    try {
      // Store raw File object in memory — no base64 conversion, no sessionStorage size limit
      wordToPdfStore.file = fileToConvert
      wordToPdfStore.meta = {
        name: fileToConvert.name,
        size: fileToConvert.size,
        type: fileToConvert.type,
        lastModified: fileToConvert.lastModified,
      }

      setTimeout(() => {
        router.push("/word-to-pdf/preview")
      }, 800)
    } catch (err) {
      console.error("Error storing file:", err)
      setError(t("wordToPdf.errorProcess"))
      setIsProcessing(false)
      setFile(null)
    }
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    { question: t("wordToPdf.faq1Q"), answer: t("wordToPdf.faq1A") },
    { question: t("wordToPdf.faq2Q"), answer: t("wordToPdf.faq2A") },
    { question: t("wordToPdf.faq3Q"), answer: t("wordToPdf.faq3A") },
    { question: t("wordToPdf.faq4Q"), answer: t("wordToPdf.faq4A") },
    { question: t("wordToPdf.faq5Q"), answer: t("wordToPdf.faq5A") },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "Word to PDF Converter - SmallPDF.us",
        // url omitted — SEOHead's WebPage node emits the correct per-locale
        // canonical URL, so hardcoding the EN URL here would mismatch on
        // /de/word-in-pdf, /fr/word-en-pdf, etc.
        "description": "Convert Word documents to PDF format online for free with perfect formatting preservation",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Any",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        // aggregateRating removed — fabricated ratings violate Google's structured
        // data guidelines and risk losing rich results across the entire site.
        "featureList": [
          "Supports DOC and DOCX formats",
          "Up to 100MB file size",
          "Perfect formatting preservation",
          "Maintains fonts and images",
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
        "name": "How to Convert Word to PDF",
        "description": "Step-by-step guide to converting Word documents to PDF format",
        "step": [
          {
            "@type": "HowToStep",
            "name": "Upload Word Document",
            "text": "Upload your DOC or DOCX file. Both legacy and modern Word formats are supported up to 100MB.",
            "position": 1
          },
          {
            "@type": "HowToStep",
            "name": "Automatic Conversion",
            "text": "Our system preserves all formatting, fonts, images, and layout while converting to PDF format.",
            "position": 2
          },
          {
            "@type": "HowToStep",
            "name": "Download PDF",
            "text": "Download your professional PDF file that looks perfect on any device or platform.",
            "position": 3
          }
        ]
      }
    ]
  }

  return (
    <>
      <SEOHead
        title={t("wordToPdf.seo.title")}
        description={t("wordToPdf.seo.description")}
        keywords="word to pdf, convert word to pdf, doc to pdf, docx to pdf, free word to pdf converter, word document to pdf"
        ogImage="/og-word-to-pdf.jpg"
        structuredData={structuredData}
      />

      <Layout
        title={t("wordToPdf.heroTitle")}
        description={t("wordToPdf.heroSubtitle")}
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

        {/* Header Ad */}
        <div className="bg-white px-4 pt-5">
          <div className="max-w-4xl mx-auto">
            <AdSenseUnit adSlot="8004544994" />
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-white via-blue-50 to-blue-100 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              {t("wordToPdf.heroTitle")}
            </h1>

            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
              {t("wordToPdf.heroSubtitle")}
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
                    <FileText className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t("wordToPdf.processingTitle")}</h3>
                  <p className="font-body text-sm text-slate-600">
                    {t("wordToPdf.processingSubtitle")}
                  </p>
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
                      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      multiple
                      onChange={handleFileChange}
                    />

                    <div className="p-10 text-center">
                      <div className="mb-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-3 shadow-xl transform hover:scale-110 transition-transform duration-300">
                          <FileText className="w-8 h-8 text-white animate-bounce-slow" />
                        </div>
                      </div>

                      <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                        {dragActive ? t("wordToPdf.dropActive") : t("wordToPdf.dropTitle")}
                      </h3>
                      <p className="font-body text-sm text-slate-500 mb-4">
                        {t("wordToPdf.dropSubtitle")}
                      </p>

                      <button
                        type="button"
                        onClick={handleButtonClick}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Upload className="w-5 h-5" />
                        <span>{t("wordToPdf.selectButton")}</span>
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t("wordToPdf.badge1")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-600" />
                          <span>{t("wordToPdf.badge2")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t("wordToPdf.badge3")}</span>
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
                  {t("wordToPdf.maxSizeNote")}
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
                {t("wordToPdf.featuresTitle")}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t("wordToPdf.featuresSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", title: t("wordToPdf.feature1Title"), desc: t("wordToPdf.feature1Desc") },
                { icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z", title: t("wordToPdf.feature2Title"), desc: t("wordToPdf.feature2Desc") },
                { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", title: t("wordToPdf.feature3Title"), desc: t("wordToPdf.feature3Desc") },
                { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", title: t("wordToPdf.feature4Title"), desc: t("wordToPdf.feature4Desc") },
                { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: t("wordToPdf.feature5Title"), desc: t("wordToPdf.feature5Desc") },
                { icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z", title: t("wordToPdf.feature6Title"), desc: t("wordToPdf.feature6Desc") },
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
                {t("wordToPdf.stepsTitle")}
              </h2>
              <p className="font-body text-slate-600 max-w-2xl mx-auto">
                {t("wordToPdf.stepsSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: "1", title: t("wordToPdf.step1Title"), desc: t("wordToPdf.step1Desc"), color: "bg-blue-600" },
                { step: "2", title: t("wordToPdf.step2Title"), desc: t("wordToPdf.step2Desc"), color: "bg-blue-700" },
                { step: "3", title: t("wordToPdf.step3Title"), desc: t("wordToPdf.step3Desc"), color: "bg-blue-800" },
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
                {t("wordToPdf.faqTitle")}
              </h2>
              <p className="font-body text-slate-600">
                {t("wordToPdf.faqSubtitle")}
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
              {t("wordToPdf.ctaTitle")}
            </h2>
            <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              {t("wordToPdf.ctaSubtitle")}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <FileText className="w-6 h-6" />
              <span>{t("wordToPdf.ctaButton")}</span>
            </button>
          </div>
        </div>
        {/* Bottom Ad */}
        <div className="bg-white px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">Advertisement</p>
            <AdSenseUnit adSlot="1617102171" />
          </div>
        </div>
        <RelatedTools current="word-to-pdf" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}