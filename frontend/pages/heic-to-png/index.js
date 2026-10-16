import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import AdSenseUnit from "../../components/AdSenseUnit"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import { Upload, AlertCircle, CheckCircle2, Zap, Shield, ChevronDown, FileImage } from "lucide-react"

// Picked files stay in memory for the preview page. They used to be base64'd
// into sessionStorage (~5 MB quota): two ordinary iPhone photos (2–5 MB each)
// were enough to fail with "error processing files" before anything uploaded.
export const heicToPngStore = { files: [] }

export default function HeicToPng() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('heic-to-png')
  const { checkBatch, BatchGateModal } = useBatchGuard('heic-to-png')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState("")
  const [openFaq, setOpenFaq] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }, [])

  const validateFile = (file) => {
    const validTypes = ["image/heic", "image/heif"]
    const name = file.name.toLowerCase()
    if (!validTypes.includes(file.type) && !name.endsWith(".heic") && !name.endsWith(".heif")) {
      return { valid: false, error: t("heicToPng.errorHeicOnly") }
    }
    // Size: useFileSizeGuard (plan-aware + 100 MB hard cap per file).
    return { valid: true }
  }

  const processFiles = async (newFiles) => {
    if (newFiles.length === 0) { setError(t("heicToPng.errorMinFiles")); return }
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
        heicToPngStore.files = validFiles.map((f) => ({
          id: f.id, name: f.name, size: f.size, type: f.file.type, file: f.file,
          data: URL.createObjectURL(f.file), // thumbnail (Safari renders HEIC; others show an icon)
        }))
        setTimeout(() => router.push("/heic-to-png/preview"), 600)
      } catch (err) {
        console.error("Error processing files:", err)
        setError(t("heicToPng.errorProcessFailed"))
        setIsProcessing(false)
      }
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false); setError("")
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFiles(Array.from(e.dataTransfer.files))
  }, [])

  const handleFileChange = (e) => {
    setError("")
    if (e.target.files && e.target.files.length > 0) processFiles(Array.from(e.target.files))
    e.target.value = ""
  }

  const faqs = [
    { question: t("heicToPng.faq1Q"), answer: t("heicToPng.faq1A") },
    { question: t("heicToPng.faq2Q"), answer: t("heicToPng.faq2A") },
    { question: t("heicToPng.faq3Q"), answer: t("heicToPng.faq3A") },
    { question: t("heicToPng.faq4Q"), answer: t("heicToPng.faq4A") },
    { question: t("heicToPng.faq5Q"), answer: t("heicToPng.faq5A") },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "HEIC to PNG Converter - SmallPDF.us",
        "description": "Convert HEIC photos from iPhone and iPad to lossless PNG format online for free",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "featureList": ["Convert 5 HEIC images at once on the free plan (up to 20 on Pro)", "100% lossless PNG output", "Transparency support", "Batch processing support", "Secure encryption", "Free plan available"]
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
        "name": "How to Convert HEIC to PNG",
        "description": "Step-by-step guide to converting HEIC photos to PNG",
        "step": [
          { "@type": "HowToStep", "name": "Upload HEIC Files", "text": "Select your HEIC or HEIF files from your iPhone, iPad, or Mac.", "position": 1 },
          { "@type": "HowToStep", "name": "Preview and Confirm", "text": "Review your uploaded photos before converting.", "position": 2 },
          { "@type": "HowToStep", "name": "Download PNG Files", "text": "Download your converted PNG images individually or in a ZIP archive.", "position": 3 }
        ]
      }
    ]
  }

  return (
    <>
      <SEOHead
        title={t("heicToPng.pageTitle")}
        description={t("heicToPng.pageDescription")}
        keywords="heic to png, convert heic to png, iphone photo converter, heic converter, heif to png, lossless heic conversion"
        ogImage="/og-heic-to-png.jpg"
        structuredData={structuredData}
      />

      <Layout title="HEIC to PNG - Convert iPhone Photos Online" description="Convert HEIC images to lossless PNG format instantly.">
        {/* Header Ad */}
        <div className="bg-white px-4 pt-5">
          <div className="max-w-4xl mx-auto">
            <AdSenseUnit size="leaderboard" />
          </div>
        </div>

        <style jsx global>{`
                    .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body { font-family: 'DM Sans', sans-serif; }
          

          @keyframes loading-bar { 0% { width: 0%; } 50% { width: 70%; } 100% { width: 100%; } }
          .animate-loading-bar { animation: loading-bar 2s ease-in-out infinite; }
          @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
          .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        `}</style>

        {/* Hero */}
        <div className="bg-gradient-to-br from-white via-teal-50 to-cyan-50 border-b border-teal-200">
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              {t("heicToPng.heroTitle")} <span className="text-teal-600">{t("heicToPng.heroOnlineFree")}</span>
            </h1>
            <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">{t("heicToPng.heroSubtitle")}</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-teal-50 py-8 px-4">

          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-teal-200 p-6">
              {isProcessing ? (
                <div className="py-10 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 border-4 border-teal-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-teal-600 border-r-teal-600 rounded-full animate-spin"></div>
                    <FileImage className="absolute inset-0 m-auto w-6 h-6 text-teal-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t("heicToPng.previewStageUpload")}</h3>
                  <p className="font-body text-sm text-slate-600">{t("heicToPng.previewLoading")}</p>
                  <div className="mt-5 max-w-xs mx-auto">
                    <div className="bg-teal-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-teal-600 h-full rounded-full animate-loading-bar"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    className={`relative rounded-xl transition-all duration-300 ${
                      dragActive ? "border-4 border-teal-500 bg-teal-50 scale-102 shadow-lg" : "border-3 border-dashed border-teal-300 hover:border-teal-400 hover:bg-teal-50 hover:shadow-md"
                    }`}
                    style={{ borderWidth: dragActive ? "4px" : "3px" }}
                  >
                    <input type="file" id="file-upload" className="hidden" accept=".heic,.heif,image/heic,image/heif" multiple onChange={handleFileChange} />
                    <div className="p-6 sm:p-10 text-center">
                      <div className="mb-3">
                        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-teal-600 rounded-2xl mb-2 sm:mb-3 shadow-xl transform hover:scale-110 transition-transform duration-300">
                          <FileImage className="w-8 h-8 text-white animate-bounce-slow" />
                        </div>
                      </div>
                      <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                        {dragActive ? t("heicToPng.uploadDropActive") : t("heicToPng.uploadDropIdle")}
                      </h3>
                      <p className="font-body text-sm text-slate-500 mb-3 sm:mb-4">{t("heicToPng.uploadSubtitle")}</p>
                      <button
                        type="button"
                        onClick={() => document.getElementById("file-upload").click()}
                        className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base hover:bg-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Upload className="w-5 h-5" />
                        <span>{t("heicToPng.uploadButton")}</span>
                      </button>
                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          <span>{t("heicToPng.uploadBadgeFormats")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-600" />
                          <span>{t("heicToPng.uploadBadgeSecure")}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-cyan-600" />
                          <span>{t("heicToPng.uploadBadgeFast")}</span>
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
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("heicToPng.featuresTitle")}</h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">{t("heicToPng.featuresSubtitle")}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", title: t("heicToPng.feature1Title"), desc: t("heicToPng.feature1Desc") },
                { icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01", title: t("heicToPng.feature2Title"), desc: t("heicToPng.feature2Desc") },
                { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", title: t("heicToPng.feature3Title"), desc: t("heicToPng.feature3Desc") },
              ].map((f, i) => (
                <div key={i} className="bg-gradient-to-br from-white to-teal-50 p-6 rounded-2xl border border-teal-200 hover:shadow-lg transition-all duration-300">
                  <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                    </svg>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="font-body text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("heicToPng.stepsTitle")}</h2>
              <p className="font-body text-slate-600">{t("heicToPng.stepsSubtitle")}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: "1", title: t("heicToPng.step1Title"), desc: t("heicToPng.step1Desc"), color: "bg-teal-600" },
                { step: "2", title: t("heicToPng.step2Title"), desc: t("heicToPng.step2Desc"), color: "bg-cyan-600" },
                { step: "3", title: t("heicToPng.step3Title"), desc: t("heicToPng.step3Desc"), color: "bg-teal-700" },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className={`w-14 h-14 ${item.color} text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg`}>{item.step}</div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="font-body text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deep-dive — unique, tool-specific content (not shared boilerplate) */}
        <div className="bg-slate-50 py-12 px-4 border-t border-slate-100">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("heicToPng.diveTitle")}</h2>
              <p className="font-body text-slate-600">{t("heicToPng.diveSubtitle")}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                [t("heicToPng.dive1Title"), t("heicToPng.dive1Desc")],
                [t("heicToPng.dive2Title"), t("heicToPng.dive2Desc")],
                [t("heicToPng.dive3Title"), t("heicToPng.dive3Desc")],
                [t("heicToPng.dive4Title"), t("heicToPng.dive4Desc")],
                [t("heicToPng.dive5Title"), t("heicToPng.dive5Desc")],
                [t("heicToPng.dive6Title"), t("heicToPng.dive6Desc")],
              ].map(([title, desc], i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200">
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="font-body text-sm text-slate-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("heicToPng.faqTitle")}</h2>
              <p className="font-body text-slate-600">{t("heicToPng.faqSubtitle")}</p>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-teal-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-teal-50 transition-colors">
                    <span className="font-display font-semibold text-slate-900 pr-4">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-teal-600 flex-shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-4"><p className="font-body text-slate-600 leading-relaxed">{faq.answer}</p></div>
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
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">{t("heicToPng.seo1Title")}</h2>
              <p className="font-body text-slate-700 mb-4">{t("heicToPng.seo1P1")}</p>
              <p className="font-body text-slate-700 mb-4">{t("heicToPng.seo1P2")}</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">{t("heicToPng.seo2Title")}</h3>
              <p className="font-body text-slate-700">{t("heicToPng.seo2P")}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-teal-600 to-cyan-600 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t("heicToPng.ctaTitle")}</h2>
            <p className="font-body text-lg text-teal-100 mb-8 max-w-2xl mx-auto">{t("heicToPng.ctaSubtitle")}</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-teal-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-teal-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <FileImage className="w-5 h-5" />
              <span>{t("heicToPng.ctaButton")}</span>
            </button>
          </div>
        </div>
        <RelatedTools current="heic-to-png" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["heicToPng"]) },
    revalidate: 86400,
  }
}
