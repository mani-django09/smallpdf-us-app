// pages/protect-pdf/index.js — Protect PDF landing page + upload.
// Picks a PDF, stores the File in memory, and routes to /protect-pdf/preview.

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
  Upload, Lock, AlertCircle, CheckCircle2, Shield, Zap, Clock,
  ChevronDown, KeyRound, ShieldCheck, MonitorSmartphone, Gift, Sparkles,
} from "lucide-react"

// In-memory store — File survives nav to /preview within the same tab.
export const protectPdfStore = { file: null, name: "", size: 0 }

const FEATURE_ICONS = [ShieldCheck, KeyRound, MonitorSmartphone, Shield, Sparkles, Gift]

export default function ProtectPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const { checkFiles, PremiumGateModal } = useFileSizeGuard("protect-pdf")
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const validateFile = (f) => {
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") return t("protectPdf.errorInvalidType")
    if (f.size > 100 * 1024 * 1024) return t("protectPdf.errorMaxSize")
    return null
  }

  const handleFile = (f) => {
    setError("")
    const v = validateFile(f)
    if (v) { setError(v); return }
    if (!checkFiles([f])) return
    setIsProcessing(true)
    protectPdfStore.file = f
    protectPdfStore.name = f.name
    protectPdfStore.size = f.size
    sessionStorage.setItem("protectPdfReady", "1")
    setTimeout(() => router.push("/protect-pdf/preview"), 500)
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

  const features = [1, 2, 3, 4, 5, 6].map((n, i) => ({ Icon: FEATURE_ICONS[i], title: t(`protectPdf.feature${n}Title`), desc: t(`protectPdf.feature${n}Desc`) }))
  const steps = [1, 2, 3].map((n) => ({ n, title: t(`protectPdf.step${n}Title`), desc: t(`protectPdf.step${n}Desc`) }))
  const faqs = [1, 2, 3, 4, 5].map((n) => ({ q: t(`protectPdf.faq${n}Q`), a: t(`protectPdf.faq${n}A`) }))
  const work = [1, 2, 3, 4].map((n) => t(`protectPdf.work${n}`))
  const personal = [1, 2, 3, 4].map((n) => t(`protectPdf.personal${n}`))

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebApplication", "name": t("protectPdf.seoTitle"), "description": t("protectPdf.seoDescription"), "applicationCategory": "BusinessApplication", "operatingSystem": "Any", "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" } },
      { "@type": "FAQPage", "mainEntity": faqs.map((f) => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) },
      { "@type": "HowTo", "name": t("protectPdf.stepsTitle"), "step": steps.map((s) => ({ "@type": "HowToStep", "position": s.n, "name": s.title, "text": s.desc })) },
    ],
  }

  return (
    <Layout title={t("protectPdf.heroTitle")} description={t("protectPdf.heroSubtitle")}>
      <SEOHead title={t("protectPdf.seoTitle")} description={t("protectPdf.seoDescription")} keywords={t("protectPdf.seoKeywords")} ogImage="/og-protect-pdf.jpg" structuredData={structuredData} />

      <div className="bg-white px-4 pt-5"><div className="max-w-4xl mx-auto"><AdSenseUnit size="leaderboard" /></div></div>

      {/* Hero + Upload */}
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{t("protectPdf.heroTitle")}</h1>
            <p className="text-base text-slate-600 max-w-2xl mx-auto">{t("protectPdf.heroSubtitle")}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-slate-100">
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 sm:p-10 text-center transition-all ${
                dragActive ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/40"
              } ${isProcessing ? "opacity-60 pointer-events-none" : ""}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            >
              <input type="file" id="protect-upload" accept=".pdf,application/pdf" className="hidden" disabled={isProcessing}
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = "" }} />
              {isProcessing ? (
                <div className="space-y-3 py-2">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg animate-pulse"><Lock className="w-8 h-8 text-white" /></div>
                  <p className="text-lg font-bold text-slate-900">{t("protectPdf.uploadLoading")}</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-lg"><Lock className="w-8 h-8 text-white" /></div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{t("protectPdf.dropTitle")}</h2>
                  <p className="text-sm text-slate-600 mb-4">{t("protectPdf.dropSubtitle")}</p>
                  <button onClick={() => document.getElementById("protect-upload").click()} className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-lg font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg">
                    <Upload className="w-5 h-5" /><span>{t("protectPdf.chooseButton")}</span>
                  </button>
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-green-600" /> {t("protectPdf.secure")}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-emerald-600" /> {t("protectPdf.instant")}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-teal-600" /> {t("protectPdf.autoDeleted")}</span>
                  </div>
                </>
              )}
            </div>
            {error && (
              <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" /><p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t("protectPdf.featuresTitle")}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">{t("protectPdf.featuresSubtitle")}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-gradient-to-br from-white to-emerald-50 rounded-xl p-5 border border-emerald-100 hover:shadow-md transition-all">
                <div className="w-11 h-11 bg-emerald-600 rounded-lg flex items-center justify-center mb-3 shadow"><f.Icon className="w-6 h-6 text-white" /></div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-b from-emerald-50 to-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t("protectPdf.stepsTitle")}</h2>
            <p className="text-slate-600">{t("protectPdf.stepsSubtitle")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="bg-white rounded-xl p-5 border-2 border-slate-200">
                <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center mb-3 shadow-lg"><span className="text-2xl font-bold text-white">{s.n}</span></div>
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
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t("protectPdf.useCasesTitle")}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">{t("protectPdf.useCasesSubtitle")}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
              <h3 className="text-xl font-bold text-slate-900 mb-4">{t("protectPdf.useCaseWorkTitle")}</h3>
              <ul className="space-y-3">{work.map((w, i) => (<li key={i} className="flex items-start gap-2 text-slate-700"><CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /><span className="text-sm">{w}</span></li>))}</ul>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-6 border border-teal-200">
              <h3 className="text-xl font-bold text-slate-900 mb-4">{t("protectPdf.useCasePersonalTitle")}</h3>
              <ul className="space-y-3">{personal.map((p, i) => (<li key={i} className="flex items-start gap-2 text-slate-700"><CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" /><span className="text-sm">{p}</span></li>))}</ul>
            </div>
          </div>
        </div>
      </div>

      {/* Deep-dive — unique, tool-specific content (not shared boilerplate) */}
      <div className="bg-white py-12 px-4 border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">{t("protectPdf.diveTitle")}</h2>
            <p className="font-body text-slate-600">{t("protectPdf.diveSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              [t("protectPdf.dive1Title"), t("protectPdf.dive1Desc")],
              [t("protectPdf.dive2Title"), t("protectPdf.dive2Desc")],
              [t("protectPdf.dive3Title"), t("protectPdf.dive3Desc")],
              [t("protectPdf.dive4Title"), t("protectPdf.dive4Desc")],
              [t("protectPdf.dive5Title"), t("protectPdf.dive5Desc")],
              [t("protectPdf.dive6Title"), t("protectPdf.dive6Desc")],
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">{t("protectPdf.faqTitle")}</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50">
                  <span className="font-semibold text-slate-900 pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-emerald-600 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
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
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{t("protectPdf.seoSectionTitle")}</h2>
          <p className="text-slate-700 mb-4">{t("protectPdf.seoP1")}</p>
          <p className="text-slate-700 mb-4">{t("protectPdf.seoP2")}</p>
          <h3 className="text-xl font-bold text-slate-900 mb-3 mt-6">{t("protectPdf.seoSubtitle")}</h3>
          <p className="text-slate-700">{t("protectPdf.seoP3")}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-600 py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">{t("protectPdf.ctaTitle")}</h2>
          <p className="text-lg text-emerald-100 mb-6 max-w-2xl mx-auto">{t("protectPdf.ctaSubtitle")}</p>
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex items-center gap-2 bg-white text-emerald-600 px-7 py-3 rounded-lg font-bold hover:bg-emerald-50 transition-all shadow-xl">
            <Lock className="w-5 h-5" /><span>{t("protectPdf.ctaButton")}</span>
          </button>
        </div>
      </div>

      <RelatedTools current="protect-pdf" />
      {PremiumGateModal}
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["protectPdf"]) },
    revalidate: 86400,
  }
}
