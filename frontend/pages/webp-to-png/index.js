import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import { Upload, ImageIcon, AlertCircle, CheckCircle2, Zap, Shield, ChevronDown, FileImage } from "lucide-react"

export default function WebpToPng() {
const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('webp-to-png')
  const { checkBatch, BatchGateModal } = useBatchGuard('webp-to-png')
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
    const validTypes = ["image/webp"]
    const maxSize = 50 * 1024 * 1024

    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith(".webp")) {
      return { valid: false, error: t("webpToPng.errorWebpOnly") }
    }

    if (file.size > maxSize) {
      return { valid: false, error: t("webpToPng.errorMaxSize") }
    }

    return { valid: true }
  }

  const processFiles = async (newFiles) => {
    if (newFiles.length === 0) {
      setError(t("webpToPng.errorMinFiles"))
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
                resolve({ id: f.id, name: f.name, size: f.size, type: f.file.type, data: e.target.result })
              }
              reader.onerror = reject
              reader.readAsDataURL(f.file)
            })
          }),
        )

        sessionStorage.setItem("uploadedWebpFiles", JSON.stringify(fileDataArray))

        setTimeout(() => {
          router.push("/webp-to-png/preview")
        }, 600)
      } catch (err) {
        console.error("Error processing files:", err)
        setError(t("webpToPng.errorProcessFailed"))
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
    { question: t("webpToPng.faq1Q"), answer: t("webpToPng.faq1A") },
    { question: t("webpToPng.faq2Q"), answer: t("webpToPng.faq2A") },
    { question: t("webpToPng.faq3Q"), answer: t("webpToPng.faq3A") },
    { question: t("webpToPng.faq4Q"), answer: t("webpToPng.faq4A") },
    { question: t("webpToPng.faq5Q"), answer: t("webpToPng.faq5A") },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "WEBP to PNG Converter - SmallPDF.us",
        // url omitted — SEOHead's WebPage node already emits the correct
        // per-locale canonical URL, so no need to hardcode it here.
        "description": "Convert WEBP images to PNG format online for free",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "featureList": ["Convert up to 20 WEBP images", "Lossless quality conversion", "Universal PNG compatibility", "Batch processing support", "Secure encryption", "Free forever"]
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
        }))
      },
      {
        "@type": "HowTo",
        "name": "How to Convert WEBP to PNG",
        "description": "Step-by-step guide to converting WEBP images to PNG format",
        "step": [
          { "@type": "HowToStep", "name": "Upload WEBP Images", "text": "Select your WEBP files from your device. You can upload up to 20 images at once for batch conversion.", "position": 1 },
          { "@type": "HowToStep", "name": "Preview and Confirm", "text": "Review your uploaded images. Remove any you don't want to convert before proceeding.", "position": 2 },
          { "@type": "HowToStep", "name": "Download PNG Files", "text": "Download your converted PNG images individually or get all files in a single ZIP archive.", "position": 3 }
        ]
      }
    ]
  }

  return (
    <>
      <SEOHead
        title={t("webpToPng.pageTitle")}
        description={t("webpToPng.pageDescription")}
        ogImage="/og-webp-to-png.jpg"
        structuredData={structuredData}
      />

      <Layout
        title="WEBP to PNG - Convert WEBP Images Online"
        description="Convert WEBP images to PNG format instantly."
      >
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
          .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body { font-family: 'DM Sans', sans-serif; }
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(20px, -30px) scale(1.05); }
            66% { transform: translate(-15px, 15px) scale(0.95); }
          }
          .animate-blob { animation: blob 8s ease-in-out infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          @keyframes loading-bar {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
          }
          .animate-loading-bar { animation: loading-bar 2s ease-in-out infinite; }
          @keyframes bounce-slow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        `}</style>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-white via-teal-50 to-emerald-50 border-b border-teal-200">
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              {t("webpToPng.heroTitle")} <span className="text-teal-600">{t("webpToPng.heroOnlineFree")}</span>
            </h1>
            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
              {t("webpToPng.heroSubtitle")}
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-gradient-to-br from-teal-50 via-emerald-50 to-teal-50 py-8 px-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-8 right-20 w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

          <div className="max-w-2xl mx-auto relative z-10">
            <div className="bg-white rounded-2xl shadow-xl border border-teal-200 p-6">
              {isProcessing ? (
                <div className="py-10 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 border-4 border-teal-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-teal-600 border-r-teal-600 rounded-full animate-spin"></div>
                    <FileImage className="absolute inset-0 m-auto w-6 h-6 text-teal-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t("webpToPng.previewStageUpload")}</h3>
                  <p className="font-body text-sm text-slate-600">{t("webpToPng.previewLoading")}</p>
                  <div className="mt-5 max-w-xs mx-auto">
                    <div className="bg-teal-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-teal-600 h-full rounded-full animate-loading-bar"></div>
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
                        ? "border-4 border-teal-500 bg-teal-50 scale-102 shadow-lg"
                        : "border-3 border-dashed border-teal-300 hover:border-teal-400 hover:bg-teal-50 hover:shadow-md"
                    }`}
                    style={{ borderWidth: dragActive ? "4px" : "3px" }}
                  >
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".webp,image/webp"
                      multiple
                      onChange={handleFileChange}
                    />

                    <div className="p-10 text-center">
                      <div className="mb-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-3 shadow-xl transform hover:scale-110 transition-transform duration-300">
                          <FileImage className="w-8 h-8 text-white animate-bounce-slow" />
                        </div>
                      </div>

                      <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                        {dragActive ? t("webpToPng.uploadDropActive") : t("webpToPng.uploadDropIdle")}
                      </h3>
                      <p className="font-body text-sm text-slate-500 mb-4">
                        {t("webpToPng.uploadSubtitle")}
                      </p>

                      <button
                        type="button"
                        onClick={handleButtonClick}
                        className="inline-flex items-center gap-2 bg-teal-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Upload className="w-5 h-5" />
                        <span>{t("webpToPng.uploadButton")}</span>
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          <span>{t("webpToPng.uploadBadgeFormats")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-600" />
                          <span>{t("webpToPng.uploadBadgeSecure")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t("webpToPng.uploadBadgeFast")}</span>
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
                  Up to <span className="font-bold text-teal-600">50MB</span> {t("webpToPng.uploadLimitPerFile")} |{" "}
                  <span className="font-bold text-teal-600">20 files</span> {t("webpToPng.uploadLimitMaximum")}
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
                {t("webpToPng.featuresTitle")}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t("webpToPng.featuresSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", title: t("webpToPng.feature1Title"), desc: t("webpToPng.feature1Desc") },
                { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: t("webpToPng.feature2Title"), desc: t("webpToPng.feature2Desc") },
                { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", title: t("webpToPng.feature3Title"), desc: t("webpToPng.feature3Desc") },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-white to-teal-50 p-6 rounded-2xl border border-teal-200 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
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
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("webpToPng.stepsTitle")}</h2>
              <p className="font-body text-slate-600">{t("webpToPng.stepsSubtitle")}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: "1", title: t("webpToPng.step1Title"), desc: t("webpToPng.step1Desc"), color: "bg-teal-600" },
                { step: "2", title: t("webpToPng.step2Title"), desc: t("webpToPng.step2Desc"), color: "bg-emerald-600" },
                { step: "3", title: t("webpToPng.step3Title"), desc: t("webpToPng.step3Desc"), color: "bg-teal-700" },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className={`w-14 h-14 ${item.color} text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg`}>
                    {item.step}
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="font-body text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("webpToPng.faqTitle")}</h2>
              <p className="font-body text-slate-600">{t("webpToPng.faqSubtitle")}</p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-teal-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-teal-50 transition-colors"
                  >
                    <span className="font-display font-semibold text-slate-900 pr-4">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-teal-600 flex-shrink-0 transition-transform duration-300 ${openFaq === index ? "rotate-180" : ""}`} />
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

        {/* SEO Content */}
        <div className="bg-teal-50 py-12 px-4 border-t border-teal-200">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-slate max-w-none">
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">{t("webpToPng.seo1Title")}</h2>
              <p className="font-body text-slate-700 mb-4">{t("webpToPng.seo1P1")}</p>
              <p className="font-body text-slate-700 mb-4">{t("webpToPng.seo1P2")}</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">{t("webpToPng.seo2Title")}</h3>
              <p className="font-body text-slate-700">{t("webpToPng.seo2P")}</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-teal-600 to-emerald-600 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t("webpToPng.ctaTitle")}</h2>
            <p className="font-body text-lg text-teal-100 mb-8 max-w-2xl mx-auto">{t("webpToPng.ctaSubtitle")}</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-teal-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-teal-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <FileImage className="w-5 h-5" />
              <span>{t("webpToPng.ctaButton")}</span>
            </button>
          </div>
        </div>
        <RelatedTools current="webp-to-png" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}