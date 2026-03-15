import Layout from "../components/Layout"
import SEOHead from "../components/SEOHead"
import { CreditCard, CheckCircle, XCircle, Clock, Mail, AlertCircle, RefreshCw, Shield } from "lucide-react"
import { useState } from "react"
import { useTranslations } from "../lib/i18n"

export default function RefundPolicy() {
  const { t } = useTranslations()
  const [activeSection, setActiveSection] = useState(0)

  const sections = [
    { id: "overview",   label: t("refund.nav1") },
    { id: "eligible",   label: t("refund.nav2") },
    { id: "ineligible", label: t("refund.nav3") },
    { id: "process",    label: t("refund.nav4") },
    { id: "timeline",   label: t("refund.nav5") },
    { id: "intl",       label: t("refund.nav6") },
    { id: "cancel",     label: t("refund.nav7") },
    { id: "contact",    label: t("refund.nav8") },
  ]

  const highlights = [
    {
      icon: Clock,
      title: t("refund.highlight1Title"),
      desc:  t("refund.highlight1Desc"),
      gradient: "from-blue-500 to-blue-600",
      border: "border-blue-100",
    },
    {
      icon: CheckCircle,
      title: t("refund.highlight2Title"),
      desc:  t("refund.highlight2Desc"),
      gradient: "from-emerald-500 to-green-600",
      border: "border-emerald-100",
    },
    {
      icon: RefreshCw,
      title: t("refund.highlight3Title"),
      desc:  t("refund.highlight3Desc"),
      gradient: "from-violet-500 to-purple-600",
      border: "border-violet-100",
    },
  ]

  const eligibleItems = [
    t("refund.eligible1"),
    t("refund.eligible2"),
    t("refund.eligible3"),
    t("refund.eligible4"),
  ]

  const ineligibleItems = [
    t("refund.ineligible1"),
    t("refund.ineligible2"),
    t("refund.ineligible3"),
    t("refund.ineligible4"),
    t("refund.ineligible5"),
    t("refund.ineligible6"),
  ]

  return (
    <Layout>
      <SEOHead
        title={t("refund.seoTitle")}
        description={t("refund.seoDescription")}
        keywords={t("refund.seoKeywords")}
      />
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-slate-950 to-slate-900 py-10 md:py-14 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/3 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 mb-4">
              <CreditCard className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">{t("refund.badge")}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
              {t("refund.heroTitle")}
            </h1>
            <p className="text-slate-400 text-sm mb-1">{t("refund.lastUpdated")}</p>
            <p className="text-slate-300 text-sm max-w-xl mx-auto mt-2">
              {t("refund.heroSubtitle")}
            </p>
          </div>
        </div>

        {/* ── HIGHLIGHT CARDS ───────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-10 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {highlights.map((h, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl p-5 border ${h.border} shadow-lg flex items-start gap-4`}
                style={{ animationDelay: `${i * 80}ms`, animation: "fadeUp 0.5s ease-out forwards", opacity: 0 }}
              >
                <div className={`w-11 h-11 bg-gradient-to-br ${h.gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <h.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-gray-900 mb-0.5">{h.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BODY: SIDEBAR + CONTENT ───────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <div className="flex gap-8 items-start">

            {/* Sticky sidebar nav */}
            <aside className="hidden lg:block w-52 flex-shrink-0 sticky top-6">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t("refund.navOnThisPage")}</p>
                <nav className="space-y-0.5">
                  {sections.map((s, i) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      onClick={() => setActiveSection(i)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeSection === i
                          ? "bg-purple-50 text-purple-700 font-bold"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeSection === i ? "bg-purple-500" : "bg-gray-300"}`} />
                      {s.label}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Quick Contact Card */}
              <div className="mt-4 bg-purple-50 border border-purple-100 rounded-2xl p-4">
                <p className="text-xs font-black text-purple-900 mb-1">{t("refund.sidebarNeedRefund")}</p>
                <p className="text-[11px] text-purple-700 mb-3">{t("refund.sidebarNeedRefundDesc")}</p>
                <a
                  href={`mailto:contact@smallpdf.us?subject=${t("refund.contactSubjectHint")}`}
                  className="block text-center bg-purple-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {t("refund.sidebarEmailUs")}
                </a>
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">

                {/* Overview */}
                <section id="overview" className="p-6 md:p-8">
                  <SectionHeading icon={Shield} title={t("refund.overviewTitle")} color="text-blue-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    {t("refund.overviewPara1")}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t("refund.overviewPara2")}
                  </p>
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {t("refund.overviewNote")}
                    </p>
                  </div>
                </section>

                {/* Eligible */}
                <section id="eligible" className="p-6 md:p-8">
                  <SectionHeading icon={CheckCircle} title={t("refund.eligibleTitle")} color="text-emerald-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {t("refund.eligibleIntro")}
                  </p>
                  <div className="space-y-2">
                    {eligibleItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-emerald-900 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Not Eligible */}
                <section id="ineligible" className="p-6 md:p-8">
                  <SectionHeading icon={XCircle} title={t("refund.ineligibleTitle")} color="text-red-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {t("refund.ineligibleIntro")}
                  </p>
                  <div className="space-y-2">
                    {ineligibleItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-red-900 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* How to Request */}
                <section id="process" className="p-6 md:p-8">
                  <SectionHeading icon={Mail} title={t("refund.processTitle")} color="text-violet-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-5">
                    {t("refund.processIntro")}
                  </p>
                  <div className="space-y-3">
                    {[
                      { num: "1", label: t("refund.step1Label"), desc: t("refund.step1Desc") },
                      { num: "2", label: t("refund.step2Label"), desc: t("refund.step2Desc") },
                      { num: "3", label: t("refund.step3Label"), desc: t("refund.step3Desc") },
                      { num: "4", label: t("refund.step4Label"), desc: t("refund.step4Desc") },
                    ].map((step) => (
                      <div key={step.num} className="flex items-start gap-3.5 bg-gray-50 border border-gray-100 rounded-xl p-4">
                        <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-black text-xs">{step.num}</span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900 mb-0.5">{step.label}</p>
                          <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5">
                    <a
                      href={`mailto:contact@smallpdf.us?subject=${t("refund.contactSubjectHint")}`}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition-all"
                    >
                      <Mail className="w-4 h-4" />
                      {t("refund.sendRequestBtn")}
                    </a>
                  </div>
                </section>

                {/* Processing Time */}
                <section id="timeline" className="p-6 md:p-8">
                  <SectionHeading icon={Clock} title={t("refund.timelineTitle")} color="text-amber-600" />
                  <div className="space-y-3">
                    {[
                      { step: t("refund.timeline1Step"), label: t("refund.timeline1Label"), desc: t("refund.timeline1Desc") },
                      { step: t("refund.timeline2Step"), label: t("refund.timeline2Label"), desc: t("refund.timeline2Desc") },
                      { step: t("refund.timeline3Step"), label: t("refund.timeline3Label"), desc: t("refund.timeline3Desc") },
                    ].map((row, i) => (
                      <div key={i} className="flex items-start gap-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <div className="text-center flex-shrink-0 w-14">
                          <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{row.step}</span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-amber-900 mb-0.5">{row.label}</p>
                          <p className="text-xs text-amber-800 leading-relaxed">{row.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* International Payments */}
                <section id="intl" className="p-6 md:p-8">
                  <SectionHeading icon={CreditCard} title={t("refund.intlTitle")} color="text-cyan-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {t("refund.intlPara")}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
                      <p className="text-xs font-black text-cyan-900 mb-1">{t("refund.intlEligibilityTitle")}</p>
                      <p className="text-xs text-cyan-800 leading-relaxed">{t("refund.intlEligibilityDesc")}</p>
                    </div>
                    <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
                      <p className="text-xs font-black text-cyan-900 mb-1">{t("refund.intlMethodTitle")}</p>
                      <p className="text-xs text-cyan-800 leading-relaxed">{t("refund.intlMethodDesc")}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {t("refund.intlNote")}
                  </p>
                </section>

                {/* Cancellation */}
                <section id="cancel" className="p-6 md:p-8">
                  <SectionHeading icon={RefreshCw} title={t("refund.cancelTitle")} color="text-indigo-600" />
                  <div className="space-y-4">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                      <h3 className="text-sm font-black text-indigo-900 mb-2">{t("refund.cancelIndiaTitle")}</h3>
                      <p className="text-xs text-indigo-800 leading-relaxed">
                        {t("refund.cancelIndiaPara")}
                      </p>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                      <h3 className="text-sm font-black text-indigo-900 mb-2">{t("refund.cancelIntlTitle")}</h3>
                      <p className="text-xs text-indigo-800 leading-relaxed">
                        {t("refund.cancelIntlPara")}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Contact */}
                <section id="contact" className="p-6 md:p-8">
                  <SectionHeading icon={Mail} title={t("refund.contactTitle")} color="text-blue-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {t("refund.contactPara")}
                  </p>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{t("refund.contactEmail")}</p>
                      <p className="text-xs text-gray-500">{t("refund.contactResponseTime")}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    Subject line: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{t("refund.contactSubjectHint")}</span>
                  </p>
                </section>

              </div>

              {/* Bottom CTA */}
              <div className="mt-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-7 flex flex-col sm:flex-row items-center gap-5 shadow-xl">
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-black text-white">{t("refund.ctaTitle")}</h3>
                  </div>
                  <p className="text-slate-400 text-xs">{t("refund.ctaSubtitle")}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-center">
                  <a
                    href={`mailto:contact@smallpdf.us?subject=${t("refund.contactSubjectHint")}`}
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-violet-500 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:shadow-lg transition-all"
                  >
                    {t("refund.ctaRequestBtn")}
                  </a>
                  <a href="/terms" className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:bg-white/15 transition-all">
                    {t("refund.ctaTermsBtn")}
                  </a>
                  <a href="/privacy" className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:bg-white/15 transition-all">
                    {t("refund.ctaPrivacyBtn")}
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, title, color }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <h2 className="text-lg font-black text-gray-900">{title}</h2>
    </div>
  )
}