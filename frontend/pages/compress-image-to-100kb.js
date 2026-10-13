import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../lib/useLocalizedRouter"
import Layout from "../components/Layout"
import RelatedTools from "../components/RelatedTools"
import SEOHead from "../components/SEOHead"
import AdSenseUnit from "../components/AdSenseUnit"
import { useTranslations } from "@/lib/i18n"
import { getPageMessages } from '../lib/i18nLoader'
import { useFileSizeGuard } from "../hooks/useFileSizeGuard"
import { useBatchGuard } from "../hooks/useBatchGuard"
import { Upload, AlertCircle, ChevronDown, Trash2, Minimize2 } from "lucide-react"
import AdLabel from "../components/AdLabel"

const TARGET_KB = 100

export default function CompressImageTo100KB() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard("compress-image")
  const { checkBatch, BatchGateModal } = useBatchGuard("compress-image")
  const [files, setFiles] = useState([])
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
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!validTypes.includes(file.type)) return { valid: false, error: t("compressImage100kb.errorInvalidType") }
    return { valid: true }
  }

  const processFiles = (newFiles) => {
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
          preview: URL.createObjectURL(file),
        })
      } else {
        setError(validation.error)
        hasError = true
        break
      }
    }
    if (!hasError && validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])
      setError("")
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError("")
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFiles(Array.from(e.dataTransfer.files))
  }, [])

  const handleFileChange = (e) => {
    setError("")
    if (e.target.files && e.target.files.length > 0) processFiles(Array.from(e.target.files))
    e.target.value = ""
  }

  const handleButtonClick = () => document.getElementById("file-upload").click()

  const removeFile = (id) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file?.preview) URL.revokeObjectURL(file.preview)
      return prev.filter((f) => f.id !== id)
    })
  }

  const handleContinue = async () => {
    if (files.length === 0) {
      setError(t("compressImage100kb.errorMinFiles"))
      return
    }
    const rawFiles = files.map((f) => f.file)
    if (!checkFiles(rawFiles)) return
    if (!checkBatch(rawFiles)) return
    setIsProcessing(true)
    try {
      const fileMetadata = files.map((f) => ({ id: f.id, name: f.name, size: f.size, type: f.file.type, preview: f.preview }))
      sessionStorage.setItem("uploadedCompressImages", JSON.stringify(fileMetadata))
      sessionStorage.setItem("compressImageDefaultTargetKB", String(TARGET_KB))
      // Locale-independent flag — router.asPath contains the LOCALIZED slug
      // (e.g. /de/bild-auf-100kb-komprimieren), not the literal English
      // "compress-image-to-100kb", so preview/download can't detect the landing
      // page by string-matching the URL. This flag survives across pages
      // within the same tab session (cleared when a fresh /compress-image
      // visit starts, via the tool's own reset points).
      sessionStorage.setItem("compressImageLandingBase", "/compress-image-to-100kb")
      if (typeof window !== "undefined") {
        window.__compressFiles = files.map((f) => ({ id: f.id, file: f.file }))
      }
      setTimeout(() => router.push("/compress-image-to-100kb/preview"), 600)
    } catch (err) {
      console.error("Error processing files:", err)
      setError(t("compressImage100kb.errorGeneric"))
      setIsProcessing(false)
    }
  }

  const toggleFaq = (i) => setOpenFaq(openFaq === i ? null : i)

  const faqs = [
    { q: t("compressImage100kb.faq1Q"), a: t("compressImage100kb.faq1A") },
    { q: t("compressImage100kb.faq2Q"), a: t("compressImage100kb.faq2A") },
    { q: t("compressImage100kb.faq3Q"), a: t("compressImage100kb.faq3A") },
    { q: t("compressImage100kb.faq4Q"), a: t("compressImage100kb.faq4A") },
    { q: t("compressImage100kb.faq5Q"), a: t("compressImage100kb.faq5A") },
  ]

  const features = [
    { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", title: t("compressImage100kb.feature1Title"), desc: t("compressImage100kb.feature1Desc") },
    { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: t("compressImage100kb.feature2Title"), desc: t("compressImage100kb.feature2Desc") },
    { icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", title: t("compressImage100kb.feature3Title"), desc: t("compressImage100kb.feature3Desc") },
    { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", title: t("compressImage100kb.feature4Title"), desc: t("compressImage100kb.feature4Desc") },
    { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", title: t("compressImage100kb.feature5Title"), desc: t("compressImage100kb.feature5Desc") },
    { icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9", title: t("compressImage100kb.feature6Title"), desc: t("compressImage100kb.feature6Desc") },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Compress Image to 100KB — SmallPDF.us",
        url: "https://smallpdf.us/compress-image-to-100kb",
        description: t("compressImage100kb.pageDescription"),
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  }

  return (
    <>
      <SEOHead
        title={t("compressImage100kb.pageTitle")}
        description={t("compressImage100kb.pageDescription")}
        keywords="compress image to 100kb, reduce photo to 100kb, image compressor 100kb, photo size 100kb for exam, signature size 100kb"
        structuredData={structuredData}
      />
      <Layout>
        <div className="bg-white px-4 pt-5">
          <div className="max-w-4xl mx-auto">
            <AdSenseUnit adSlot="8004544994" size="leaderboard" />
          </div>
        </div>

        <div className="bg-gradient-to-b from-blue-50 to-white py-10 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-3">
              {t("compressImage100kb.heroTitle")}
            </h1>
            <p className="font-body text-lg text-slate-600 max-w-2xl mx-auto">
              {t("compressImage100kb.heroSubtitle")}
            </p>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="max-w-3xl mx-auto px-4 pb-10">
            <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-slate-100">
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-all duration-300 cursor-pointer ${
                  dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleButtonClick}
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-lg">
                  <Minimize2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900 mb-2">{t("compressImage100kb.dropzoneTitle")}</h2>
                <p className="font-body text-sm text-slate-500 mb-3 sm:mb-5">{t("compressImage100kb.dropzoneSubtitle")}</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-blue-700 hover:to-blue-900 transition-all shadow-lg"
                >
                  <Upload className="w-4 h-4" />
                  {t("compressImage100kb.chooseButton")}
                </button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="font-body text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 pb-10">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {t("compressImage100kb.selectedTitle", { count: files.length, plural: files.length > 1 ? "s" : "" })}
                </h2>
                <button onClick={handleButtonClick} className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1">
                  + {t("compressImage100kb.addMoreButton")}
                </button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
                {files.map((f) => (
                  <div key={f.id} className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <div className="aspect-square overflow-hidden">
                      <img src={f.preview} alt={f.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-slate-800 truncate">{f.name}</p>
                      <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="absolute top-1.5 right-1.5 p-1 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleContinue}
                disabled={isProcessing}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t("compressImage100kb.preparingButton")}</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-5 h-5" />
                    <span>{t("compressImage100kb.compressButton")}</span>
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("compressImage100kb.featuresTitle")}</h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">{t("compressImage100kb.featuresSubtitle")}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl border border-blue-200 hover:shadow-lg transition-all duration-300">
                  <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("compressImage100kb.stepsTitle")}</h2>
              <p className="font-body text-slate-600">{t("compressImage100kb.stepsSubtitle")}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: "1", title: t("compressImage100kb.step1Title"), desc: t("compressImage100kb.step1Desc"), color: "bg-blue-600" },
                { step: "2", title: t("compressImage100kb.step2Title"), desc: t("compressImage100kb.step2Desc"), color: "bg-indigo-600" },
                { step: "3", title: t("compressImage100kb.step3Title"), desc: t("compressImage100kb.step3Desc"), color: "bg-blue-700" },
              ].map((item) => (
                <div key={item.step} className="relative">
                  <div className="bg-white p-6 rounded-2xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 h-full">
                    <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center text-white font-display text-2xl font-bold mb-4 shadow-lg`}>
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

        {/* Deep-dive — unique, tool-specific content (not shared boilerplate) */}
        <div className="bg-blue-50/60 py-12 px-4 border-t border-blue-100">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("compressImage100kb.diveTitle")}</h2>
              <p className="font-body text-slate-600">{t("compressImage100kb.diveSubtitle")}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                [t("compressImage100kb.dive1Title"), t("compressImage100kb.dive1Desc")],
                [t("compressImage100kb.dive2Title"), t("compressImage100kb.dive2Desc")],
                [t("compressImage100kb.dive3Title"), t("compressImage100kb.dive3Desc")],
                [t("compressImage100kb.dive4Title"), t("compressImage100kb.dive4Desc")],
                [t("compressImage100kb.dive5Title"), t("compressImage100kb.dive5Desc")],
                [t("compressImage100kb.dive6Title"), t("compressImage100kb.dive6Desc")],
              ].map(([title, desc], i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-blue-200">
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="font-body text-sm text-slate-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("compressImage100kb.faqTitle")}</h2>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-gradient-to-r from-white to-blue-50 border border-blue-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-blue-50 transition-colors"
                  >
                    <h3 className="font-display text-base font-semibold text-slate-900 pr-4">{faq.q}</h3>
                    <ChevronDown className={`w-5 h-5 text-blue-600 flex-shrink-0 transition-transform duration-300 ${openFaq === index ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-4">
                      <p className="font-body text-sm text-slate-600 leading-relaxed">{faq.a}</p>
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
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">{t("compressImage100kb.whyTitle")}</h2>
              <p className="font-body text-slate-700 mb-4">{t("compressImage100kb.whyP1")}</p>
              <p className="font-body text-slate-700 mb-4">{t("compressImage100kb.whyP2")}</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">{t("compressImage100kb.howTitle")}</h3>
              <p className="font-body text-slate-700">{t("compressImage100kb.howP")}</p>
              <p className="font-body text-slate-700 mt-4">
                {t("compressImage100kb.relatedLinkText")}{" "}
                <a href="/compress-image" className="text-blue-600 font-semibold hover:underline">
                  {t("compressImage100kb.relatedLinkTool")}
                </a>{" "}
                {t("compressImage100kb.relatedLinkSuffix")}
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t("compressImage100kb.ctaTitle")}</h2>
            <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">{t("compressImage100kb.ctaSubtitle")}</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <Minimize2 className="w-5 h-5" />
              <span>{t("compressImage100kb.ctaButton")}</span>
            </button>
          </div>
        </div>

        {/* Bottom Ad */}
        <div className="bg-white px-4 py-6">
          <div className="hidden lg:block max-w-4xl mx-auto">
            <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide"><AdLabel /></p>
            <AdSenseUnit adSlot="1617102171" />
          </div>
        </div>
        <RelatedTools current="compress-image" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["compressImage100kb"]) },
    revalidate: 86400,
  }
}
