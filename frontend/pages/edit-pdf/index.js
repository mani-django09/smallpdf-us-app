// pages/edit-pdf/index.js — Edit PDF landing page + upload.
// Picks a PDF, stores the File in memory, and routes to /edit-pdf/preview.

import { useState, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import AdSenseUnit from "../../components/AdSenseUnit"
import RelatedTools from "../../components/RelatedTools"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import {
  Upload, PenLine, AlertCircle, CheckCircle2, Shield, Zap, Clock,
  ChevronDown, Type, Sparkles, Gift,
} from "lucide-react"

// In-memory store — the File object survives client-side nav to /preview within
// the same tab (no base64 / sessionStorage bloat for large PDFs).
export const editPdfStore = { file: null, name: "", size: 0 }

const FEATURE_ICONS = [PenLine, Type, Shield, Sparkles, Zap, Gift]

export default function EditPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard("edit-pdf")
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const validateFile = (f) => {
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      return t("editPdf.errorInvalidType")
    }
    if (f.size > 100 * 1024 * 1024) return t("editPdf.errorMaxSize")
    return null
  }

  const handleFile = (f) => {
    setError("")
    const v = validateFile(f)
    if (v) { setError(v); return }
    if (!checkFiles([f])) return

    setIsProcessing(true)
    editPdfStore.file = f
    editPdfStore.name = f.name
    editPdfStore.size = f.size
    sessionStorage.setItem("editPdfReady", "1")
    setTimeout(() => router.push("/edit-pdf/preview"), 500)
  }

  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const features = [1, 2, 3, 4, 5, 6].map((n, i) => ({
    Icon: FEATURE_ICONS[i],
    title: t(`editPdf.feature${n}Title`),
    desc: t(`editPdf.feature${n}Desc`),
  }))
  const steps = [1, 2, 3].map((n) => ({ n, title: t(`editPdf.step${n}Title`), desc: t(`editPdf.step${n}Desc`) }))
  const faqs = [1, 2, 3, 4, 5].map((n) => ({ q: t(`editPdf.faq${n}Q`), a: t(`editPdf.faq${n}A`) }))
  const work = [1, 2, 3, 4].map((n) => t(`editPdf.work${n}`))
  const personal = [1, 2, 3, 4].map((n) => t(`editPdf.personal${n}`))

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": t("editPdf.seoTitle"),
        "description": t("editPdf.seoDescription"),
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqs.map((f) => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })),
      },
      {
        "@type": "HowTo",
        "name": t("editPdf.stepsTitle"),
        "step": steps.map((s) => ({ "@type": "HowToStep", "position": s.n, "name": s.title, "text": s.desc })),
      },
    ],
  }

  return (
    <Layout title={t("editPdf.heroTitle")} description={t("editPdf.heroSubtitle")}>
      <SEOHead
        title={t("editPdf.seoTitle")}
        description={t("editPdf.seoDescription")}
        keywords={t("editPdf.seoKeywords")}
        ogImage="/og-edit-pdf.jpg"
        structuredData={structuredData}
      />

      {/* Header Ad */}
      <div className="bg-white px-4 pt-5">
        <div className="max-w-4xl mx-auto"><AdSenseUnit size="leaderboard" /></div>
      </div>

      {/* Hero + Upload */}
      <div className="bg-gradient-to-br from-blue-50 via-slate-50 to-red-50 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{t("editPdf.heroTitle")}</h1>
            <p className="text-base text-slate-600 max-w-2xl mx-auto">{t("editPdf.heroSubtitle")}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-slate-100">
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 sm:p-10 text-center transition-all ${
                dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"
              } ${isProcessing ? "opacity-60 pointer-events-none" : ""}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            >
              <input
                type="file" id="edit-upload" accept=".pdf,application/pdf" className="hidden" disabled={isProcessing}
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = "" }}
              />
              {isProcessing ? (
                <div className="space-y-3 py-2">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-600 to-slate-900 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                    <PenLine className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-lg font-bold text-slate-900">{t("editPdf.uploadLoading")}</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-blue-600 to-slate-900 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-lg">
                    <PenLine className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{t("editPdf.dropTitle")}</h2>
                  <p className="text-sm text-slate-600 mb-4">{t("editPdf.dropSubtitle")}</p>
                  <button
                    onClick={() => document.getElementById("edit-upload").click()}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-black transition-all shadow-lg"
                  >
                    <Upload className="w-5 h-5" /><span>{t("editPdf.chooseButton")}</span>
                  </button>
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-green-600" /> {t("editPdf.secure")}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-slate-600" /> {t("editPdf.instant")}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-blue-600" /> {t("editPdf.autoDeleted")}</span>
                  </div>
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

      {/* Features */}
      <div className="bg-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t("editPdf.featuresTitle")}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">{t("editPdf.featuresSubtitle")}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-5 border border-slate-200 hover:shadow-md transition-all">
                <div className="w-11 h-11 bg-blue-600 rounded-lg flex items-center justify-center mb-3 shadow">
                  <f.Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-b from-slate-50 to-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t("editPdf.stepsTitle")}</h2>
            <p className="text-slate-600">{t("editPdf.stepsSubtitle")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="bg-white rounded-xl p-5 border-2 border-slate-200">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-3 shadow-lg">
                  <span className="text-2xl font-bold text-white">{s.n}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{s.title}</h3>
                <p className="text-sm text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Use cases */}
      <div className="bg-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t("editPdf.useCasesTitle")}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">{t("editPdf.useCasesSubtitle")}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-4">{t("editPdf.useCaseWorkTitle")}</h3>
              <ul className="space-y-3">
                {work.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" /><span className="text-sm">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-4">{t("editPdf.useCasePersonalTitle")}</h3>
              <ul className="space-y-3">
                {personal.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" /><span className="text-sm">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Deep-dive — unique, tool-specific content (not shared boilerplate) */}
      <div className="bg-white py-12 px-4 border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("editPdf.diveTitle")}</h2>
            <p className="font-body text-slate-600">{t("editPdf.diveSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              [t("editPdf.dive1Title"), t("editPdf.dive1Desc")],
              [t("editPdf.dive2Title"), t("editPdf.dive2Desc")],
              [t("editPdf.dive3Title"), t("editPdf.dive3Desc")],
              [t("editPdf.dive4Title"), t("editPdf.dive4Desc")],
              [t("editPdf.dive5Title"), t("editPdf.dive5Desc")],
              [t("editPdf.dive6Title"), t("editPdf.dive6Desc")],
            ].map(([title, desc], i) => (
              <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="font-body text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-slate-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">{t("editPdf.faqTitle")}</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50">
                  <span className="font-semibold text-slate-900 pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-blue-600 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && <div className="px-5 pb-4 pt-1"><p className="text-slate-600 leading-relaxed">{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SEO content */}
      <div className="bg-white py-12 px-4 border-t border-slate-200">
        <div className="max-w-4xl mx-auto prose prose-slate max-w-none">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{t("editPdf.seoSectionTitle")}</h2>
          <p className="text-slate-700 mb-4">{t("editPdf.seoP1")}</p>
          <p className="text-slate-700 mb-4">{t("editPdf.seoP2")}</p>
          <h3 className="text-xl font-bold text-slate-900 mb-3 mt-6">{t("editPdf.seoSubtitle")}</h3>
          <p className="text-slate-700">{t("editPdf.seoP3")}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-blue-700 to-slate-950 py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">{t("editPdf.ctaTitle")}</h2>
          <p className="text-lg text-slate-300 mb-6 max-w-2xl mx-auto">{t("editPdf.ctaSubtitle")}</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-2 bg-white text-slate-900 px-7 py-3 rounded-lg font-bold hover:bg-slate-100 transition-all shadow-xl"
          >
            <PenLine className="w-5 h-5" /><span>{t("editPdf.ctaButton")}</span>
          </button>
        </div>
      </div>

      <RelatedTools current="edit-pdf" />
      {PremiumGateModal}
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["editPdf"]) },
    revalidate: 86400,
  }
}
