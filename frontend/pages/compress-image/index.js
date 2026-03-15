import { useEffect, useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "@/lib/i18n"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import { Upload, AlertCircle, ChevronDown, Trash2, Minimize2 } from "lucide-react"

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

export default function CompressImage() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard('compress-image')
  const { checkBatch, BatchGateModal } = useBatchGuard('compress-image')
  const [files, setFiles] = useState([])
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
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (!validTypes.includes(file.type)) {
      return { valid: false, error: t("compressImage.errorInvalidType") }
    }
    if (file.size > maxSize) {
      return { valid: false, error: t("compressImage.errorMaxSize") }
    }
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

  const removeFile = (id) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file?.preview) URL.revokeObjectURL(file.preview)
      return prev.filter((f) => f.id !== id)
    })
  }

  // ✅ FIXED handleContinue — no more base64 in sessionStorage
  const handleContinue = async () => {
    if (files.length === 0) {
      setError(t("compressImage.errorMinFiles"))
      return
    }
    const rawFiles = files.map((f) => f.file)
    if (!checkFiles(rawFiles)) return
    if (!checkBatch(rawFiles)) return
    setIsProcessing(true)
    try {
      // Store only lightweight metadata in sessionStorage (no base64 data)
      const fileMetadata = files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.file.type,
        preview: f.preview, // blob URL — valid within same tab session
      }))

      sessionStorage.setItem("uploadedCompressImages", JSON.stringify(fileMetadata))

      // ✅ Store actual File objects in window global — survives same-tab navigation
      // This avoids the base64 → sessionStorage overflow that caused the error
      if (typeof window !== "undefined") {
        window.__compressFiles = files.map((f) => ({
          id: f.id,
          file: f.file,
        }))
      }

      setTimeout(() => {
        router.push("/compress-image/preview")
      }, 600)
    } catch (err) {
      console.error("Error processing files:", err)
      setError(t("compressImage.errorProcessFailed"))
      setIsProcessing(false)
    }
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    { question: t("compressImage.faq1Q"), answer: t("compressImage.faq1A") },
    { question: t("compressImage.faq2Q"), answer: t("compressImage.faq2A") },
    { question: t("compressImage.faq3Q"), answer: t("compressImage.faq3A") },
    { question: t("compressImage.faq4Q"), answer: t("compressImage.faq4A") },
    { question: t("compressImage.faq5Q"), answer: t("compressImage.faq5A") },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "Image Compressor - SmallPDF.us",
        "url": "https://smallpdf.us/compress-image",
        "description": "Compress images online free - reduce file size without quality loss",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "featureList": [
          "Compress up to 20 images",
          "50-80% file size reduction",
          "Supports JPG, PNG, WEBP",
          "Batch processing",
          "No quality loss",
          "Free forever",
        ],
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": { "@type": "Answer", "text": faq.answer },
        })),
      },
      {
        "@type": "HowTo",
        "name": "How to Compress Images",
        "description": "Step-by-step guide to compressing images without losing quality",
        "step": [
          {
            "@type": "HowToStep",
            "name": "Upload Images",
            "text": "Upload your JPG, PNG, or WEBP files. Add up to 20 images for batch compression.",
            "position": 1,
          },
          {
            "@type": "HowToStep",
            "name": "Smart Compression",
            "text": "Our system automatically optimizes each image to reduce file size by 50-80% while maintaining visual quality.",
            "position": 2,
          },
          {
            "@type": "HowToStep",
            "name": "Download Compressed Images",
            "text": "Download your optimized images individually or get all files in a convenient ZIP archive.",
            "position": 3,
          },
        ],
      },
    ],
  }

  return (
    <>
      <SEOHead
        title={t("compressImage.pageTitle")}
        description={t("compressImage.pageDescription")}
        ogImage="/og-compress-image.jpg"
        structuredData={structuredData}
      />
      <Layout>
        {/* Header Ad */}
        <div className="bg-white px-4 pt-5">
          <div className="max-w-4xl mx-auto">
            <AdSenseUnit adSlot="8004544994" />
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-b from-blue-50 to-white py-10 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-3">
              {t("compressImage.heroTitle")}
            </h1>
            <p className="font-body text-lg text-slate-600 max-w-2xl mx-auto">
              {t("compressImage.heroSubtitle")}
            </p>
          </div>
        </div>

        {/* Upload / File Selection Area */}
        {files.length === 0 ? (
          // ── Empty state: drag & drop zone ──
          <div className="max-w-3xl mx-auto px-4 pb-10">
            <div
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-300 bg-white hover:border-blue-400 hover:bg-blue-50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={handleButtonClick}
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900 mb-2">
                {t("compressImage.dropzoneTitle")}
              </h2>
              <p className="font-body text-sm text-slate-500 mb-4">
                {t("compressImage.dropzoneSubtitle")}
              </p>
              <button
                type="button"
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md"
              >
                {t("compressImage.chooseFilesButton")}
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

            {error && (
              <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="font-body text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}
          </div>
        ) : (
          // ── Files selected state ──
          <div className="max-w-3xl mx-auto px-4 pb-10">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {t("compressImage.selectedTitle").replace("{count}", files.length)}
                </h2>
                <button
                  onClick={handleButtonClick}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                >
                  + {t("compressImage.addMoreButton")}
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

              {/* File Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
                {files.map((f) => (
                  <div key={f.id} className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={f.preview}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-slate-800 truncate">{f.name}</p>
                      <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => removeFile(f.id)}
                      className="absolute top-1.5 right-1.5 p-1 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Compress Button */}
              <button
                onClick={handleContinue}
                disabled={isProcessing}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t("compressImage.processingButton")}</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-5 h-5" />
                    <span>
                      {t("compressImage.compressButton")
                        .replace("{count}", files.length)
                        .replace("{plural}", files.length > 1 ? "s" : "")}
                    </span>
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

        {/* Features Section */}
        <div className="bg-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                {t("compressImage.featuresTitle")}
              </h2>
              <p className="font-body text-slate-600 max-w-3xl mx-auto">
                {t("compressImage.featuresSubtitle")}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                  title: t("compressImage.feature1Title"),
                  desc: t("compressImage.feature1Desc"),
                },
                {
                  icon: "M13 10V3L4 14h7v7l9-11h-7z",
                  title: t("compressImage.feature2Title"),
                  desc: t("compressImage.feature2Desc"),
                },
                {
                  icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                  title: t("compressImage.feature3Title"),
                  desc: t("compressImage.feature3Desc"),
                },
                {
                  icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                  title: t("compressImage.feature4Title"),
                  desc: t("compressImage.feature4Desc"),
                },
                {
                  icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
                  title: t("compressImage.feature5Title"),
                  desc: t("compressImage.feature5Desc"),
                },
                {
                  icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
                  title: t("compressImage.feature6Title"),
                  desc: t("compressImage.feature6Desc"),
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl border border-blue-200 hover:shadow-lg transition-all duration-300"
                >
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

        {/* How It Works Section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("compressImage.stepsTitle")}</h2>
              <p className="font-body text-slate-600">{t("compressImage.stepsSubtitle")}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: "1", title: t("compressImage.step1Title"), desc: t("compressImage.step1Desc"), color: "bg-blue-600" },
                { step: "2", title: t("compressImage.step2Title"), desc: t("compressImage.step2Desc"), color: "bg-indigo-600" },
                { step: "3", title: t("compressImage.step3Title"), desc: t("compressImage.step3Desc"), color: "bg-blue-700" },
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
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("compressImage.faqTitle")}</h2>
              <p className="font-body text-slate-600">{t("compressImage.faqSubtitle")}</p>
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
                {t("compressImage.seo1Title")}
              </h2>
              <p className="font-body text-slate-700 mb-4">{t("compressImage.seo1P1")}</p>
              <p className="font-body text-slate-700 mb-4">{t("compressImage.seo1P2")}</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">
                {t("compressImage.seo2Title")}
              </h3>
              <p className="font-body text-slate-700 mb-4">{t("compressImage.seo2P")}</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-6">
                {t("compressImage.seo3Title")}
              </h3>
              <p className="font-body text-slate-700">{t("compressImage.seo3P")}</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              {t("compressImage.ctaTitle")}
            </h2>
            <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              {t("compressImage.ctaSubtitle")}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <Minimize2 className="w-5 h-5" />
              <span>{t("compressImage.ctaButton")}</span>
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
        <RelatedTools current="compress-image" />
      </Layout>
      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}