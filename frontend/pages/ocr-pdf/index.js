// pages/ocr-pdf/index.js
// OCR PDF — Extract searchable text from scanned/image-based PDFs.
// Free: 10 MB · 2 pages · 1 OCR/day · Standard speed
// Pro : 100 MB+ · Unlimited pages · Batch OCR · Word/TXT export · Priority queue

import { useState, useCallback } from "react"
import Link from "next/link"
import Layout from "../../components/Layout"
import RelatedTools from '../../components/RelatedTools'
import SEOHead from "../../components/SEOHead"
import {
  Upload, FileText, AlertCircle, CheckCircle2, Zap, Shield,
  ChevronDown, ScanText, Lock, Globe, Clock, Languages,
  ArrowRight, Star, FileSearch, Crown, Users,
} from "lucide-react"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import { useAuth } from "../../context/AuthContext"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import { useTranslations } from "../../lib/i18n"

// ── In-memory file store — survives client-side Next.js navigation ────────────
export const ocrPdfStore = {
  file: null,
  set(f)  { this.file = f    },
  get()   { return this.file },
  clear() { this.file = null },
}

export default function OcrPdf() {
  const router = useLocalizedRouter()
  const { user } = useAuth()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard("ocr-pdf")
  const { checkBatch, BatchGateModal }   = useBatchGuard("ocr-pdf")

  const [dragActive,   setDragActive]   = useState(false)
  const [error,        setError]        = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [openFaq,      setOpenFaq]      = useState(null)

  const isPro = user?.plan === "pro" || user?.plan === "enterprise"

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }, [])

  const validateFile = (file) => {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return { valid: false, error: t("ocrPdf.upload.errorOnlyPdf") }
    }
    return { valid: true }
  }

  const processFile = useCallback(async (file) => {
    if (!file) return
    if (!checkFiles([file])) return
    if (!checkBatch([file])) return
    const validation = validateFile(file)
    if (!validation.valid) { setError(validation.error); return }
    setIsProcessing(true)
    setError("")
    ocrPdfStore.set(file)
    setTimeout(() => router.push("/ocr-pdf/preview"), 500)
  }, [checkFiles, checkBatch, router])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError("")
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = (e) => {
    setError("")
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  // FAQ from translations (supports both array and dot-notation fallback)
  const faqItems = t("ocrPdf.faq.items")
  const faqs = Array.isArray(faqItems)
    ? faqItems
    : [0,1,2,3,4,5,6,7].map(i => ({
        q: t(`ocrPdf.faq.items.${i}.q`),
        a: t(`ocrPdf.faq.items.${i}.a`),
      }))

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "OCR PDF – Extract Text from Scanned PDF | SmallPDF.us",
        url: "https://smallpdf.us/ocr-pdf",
        description: "Free online OCR tool to extract searchable text from scanned PDFs. Supports 100+ languages, outputs searchable PDF, Word (.docx), or plain text (.txt). No install required.",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        offers: [
          { "@type": "Offer", price: "0",  priceCurrency: "USD", name: "Free" },
          { "@type": "Offer", price: "19", priceCurrency: "USD", name: "Pro",
            eligibleQuantity: { "@type": "QuantitativeValue", unitText: "month" } },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  }

  return (
    <>
      <SEOHead
        title={t("ocrPdf.seo.title")}
        description={t("ocrPdf.seo.description")}
        keywords={t("ocrPdf.seo.keywords")}
        structuredData={structuredData}
      />

      <Layout>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
          .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
          .font-body    { font-family: 'DM Sans', sans-serif; }
          @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
          .animate-float { animation: float 3s ease-in-out infinite; }
          @keyframes loading-bar { 0% { width: 0%; } 60% { width: 75%; } 100% { width: 100%; } }
          .animate-loading-bar { animation: loading-bar 1.8s ease-in-out infinite; }
        `}</style>

        {/* HERO */}
        <div className="bg-gradient-to-br from-violet-50 via-white to-purple-50 border-b border-violet-100">
          <div className="max-w-4xl mx-auto px-4 pt-12 pb-8 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 leading-tight">
              {t("ocrPdf.hero.title")}{" "}
              <span className="text-violet-600">{t("ocrPdf.hero.titleHighlight")}</span>{" "}
              {t("ocrPdf.hero.titleSuffix")}
            </h1>
            <p className="font-body text-lg text-slate-600 max-w-2xl mx-auto mb-7">
              {t("ocrPdf.hero.subtitle")}
            </p>
          </div>
        </div>

        {/* UPLOAD */}
        <div className="bg-gradient-to-br from-violet-50 via-slate-50 to-purple-50 py-10 px-4 relative overflow-hidden">
          <div className="absolute top-0 left-10 w-72 h-72 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />
          <div className="absolute bottom-0 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />

          <div className="max-w-2xl mx-auto relative z-10">
            <div className="bg-white rounded-2xl shadow-xl border border-violet-100 p-6">

              {isProcessing ? (
                <div className="py-12 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 border-4 border-violet-100 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-violet-600 border-r-violet-600 rounded-full animate-spin" />
                    <ScanText className="absolute inset-0 m-auto w-6 h-6 text-violet-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t("ocrPdf.upload.preparing")}</h3>
                  <p className="font-body text-sm text-slate-500 mb-5">{t("ocrPdf.upload.preparingSubtitle")}</p>
                  <div className="max-w-xs mx-auto">
                    <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-violet-600 h-full rounded-full animate-loading-bar" />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  style={{ borderWidth: dragActive ? "3px" : "2px" }}
                  className={`rounded-xl transition-all duration-200 cursor-pointer ${
                    dragActive ? "border-violet-500 bg-violet-50" : "border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50/30"
                  }`}
                  onClick={() => document.getElementById("ocr-file-upload").click()}
                >
                  <input type="file" id="ocr-file-upload" className="hidden" accept=".pdf,application/pdf" multiple onChange={handleFileChange} />
                  <div className="p-10 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-600 rounded-2xl mb-4 shadow-lg animate-float">
                      <ScanText className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="font-display text-xl font-bold text-slate-900 mb-2">
                      {dragActive ? t("ocrPdf.upload.dropActive") : t("ocrPdf.upload.heading")}
                    </h2>
                    <p className="font-body text-sm text-slate-500 mb-5">{t("ocrPdf.upload.subheading")}</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); document.getElementById("ocr-file-upload").click() }}
                      className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-8 py-4 rounded-xl font-bold text-base transition-all shadow-lg hover:shadow-violet-300/50 hover:scale-105"
                    >
                      <Upload className="w-5 h-5" />
                      {t("ocrPdf.upload.button")}
                    </button>
                    <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-green-500" /> {t("ocrPdf.upload.sslEncrypted")}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-blue-500" /> {t("ocrPdf.upload.filesDeleted")}</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-violet-500" /> {t("ocrPdf.upload.noSignUp")}</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body text-sm text-red-700 font-medium">{error}</p>
                    {error.includes("Upgrade") && (
                      <Link href="/pricing" className="text-xs text-violet-700 font-semibold underline mt-1 block">
                        {t("ocrPdf.upload.errorSeePlans")}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {!isProcessing && (
                <p className="text-center text-xs text-slate-400 mt-4">
                  {t("ocrPdf.upload.freeLimits")}&nbsp;<strong className="text-slate-600">{t("ocrPdf.upload.freeLimitsValue")}</strong>
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  {t("ocrPdf.upload.proLimits")}&nbsp;<strong className="text-violet-600">{t("ocrPdf.upload.proLimitsValue")}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <div className="bg-slate-50 py-14 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("ocrPdf.features.sectionTitle")}</h2>
              <p className="font-body text-slate-600 max-w-2xl mx-auto">{t("ocrPdf.features.sectionSubtitle")}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: <ScanText className="w-6 h-6 text-white" />,  bg: "bg-violet-600"  },
                { icon: <Languages className="w-6 h-6 text-white" />, bg: "bg-blue-600"    },
                { icon: <FileSearch className="w-6 h-6 text-white" />,bg: "bg-emerald-600" },
                { icon: <Zap className="w-6 h-6 text-white" />,       bg: "bg-amber-500"   },
                { icon: <Shield className="w-6 h-6 text-white" />,    bg: "bg-red-600"     },
                { icon: <FileText className="w-6 h-6 text-white" />,  bg: "bg-pink-600"    },
              ].map((f, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                  <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-4 shadow-md`}>{f.icon}</div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{t(`ocrPdf.features.items.${i}.title`)}</h3>
                  <p className="font-body text-sm text-slate-600 leading-relaxed">{t(`ocrPdf.features.items.${i}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="bg-white py-14 px-4 border-y border-slate-100">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("ocrPdf.howItWorks.sectionTitle")}</h2>
              <p className="font-body text-slate-600">{t("ocrPdf.howItWorks.sectionSubtitle")}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {["bg-violet-600","bg-purple-600","bg-violet-700"].map((color, i) => (
                <div key={i} className="text-center">
                  <div className={`w-14 h-14 ${color} text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-4 shadow-lg`}>{i+1}</div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{t(`ocrPdf.howItWorks.steps.${i}.title`)}</h3>
                  <p className="font-body text-sm text-slate-600 mb-3 leading-relaxed">{t(`ocrPdf.howItWorks.steps.${i}.desc`)}</p>
                  <span className="inline-block text-xs bg-violet-50 text-violet-700 font-semibold px-3 py-1 rounded-full border border-violet-200">{t(`ocrPdf.howItWorks.steps.${i}.badge`)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* USE CASES */}
        <div className="bg-violet-50 py-14 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("ocrPdf.useCases.sectionTitle")}</h2>
              <p className="font-body text-slate-600 max-w-xl mx-auto">{t("ocrPdf.useCases.sectionSubtitle")}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {["⚖️","🏥","📚","🏢","🌍","🏗️"].map((emoji, i) => (
                <div key={i} className="bg-white rounded-xl border border-violet-100 p-5 hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-3">{emoji}</div>
                  <h3 className="font-display font-bold text-slate-900 mb-1.5">{t(`ocrPdf.useCases.items.${i}.title`)}</h3>
                  <p className="font-body text-sm text-slate-600 leading-relaxed">{t(`ocrPdf.useCases.items.${i}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white py-14 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("ocrPdf.faq.sectionTitle")}</h2>
              <p className="font-body text-slate-600">{t("ocrPdf.faq.sectionSubtitle")}</p>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-violet-50/40 transition-colors"
                  >
                    <span className="font-display font-semibold text-slate-900 pr-4 text-sm">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-96" : "max-h-0"}`}>
                    <div className="px-6 py-4 bg-violet-50/30 border-t border-slate-100">
                      <p className="font-body text-sm text-slate-700 leading-relaxed">{faq.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SEO CONTENT */}
        <div className="bg-slate-50 py-14 px-4 border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">{t("ocrPdf.seoContent.h2")}</h2>
            <p className="font-body text-slate-700 mb-5 leading-relaxed">{t("ocrPdf.seoContent.p1")}</p>
            <p className="font-body text-slate-700 mb-5 leading-relaxed">{t("ocrPdf.seoContent.p2")}</p>
            <h3 className="font-display text-xl font-bold text-slate-900 mb-3 mt-8">{t("ocrPdf.seoContent.h3")}</h3>
            <p className="font-body text-slate-700 mb-5 leading-relaxed">{t("ocrPdf.seoContent.p3")}</p>
            <p className="font-body text-slate-700 leading-relaxed">{t("ocrPdf.seoContent.p4")}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 py-14 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <ScanText className="w-12 h-12 text-violet-300 mx-auto mb-4" />
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-3">{t("ocrPdf.cta.heading")}</h2>
            <p className="font-body text-violet-200 mb-8 text-lg max-w-lg mx-auto">{t("ocrPdf.cta.subtitle")}</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold px-8 py-4 rounded-xl hover:bg-violet-50 transition-all shadow-xl hover:scale-105"
            >
              <ScanText className="w-5 h-5" />
              {t("ocrPdf.cta.button")}
            </button>
          </div>
        </div>
        <RelatedTools current="ocr-pdf" />
      </Layout>

      {PremiumGateModal}
      {BatchGateModal}
    </>
  )
}