import Layout from "../components/Layout"
import { useTranslations } from "../lib/i18n"
import { FileText, Shield, AlertCircle, CheckCircle, ChevronRight, Lock, Server, Scale, Mail, CreditCard } from "lucide-react"
import { useState, useEffect } from "react"

export default function Terms() {
  const { t } = useTranslations()
  const [activeSection, setActiveSection] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const style = document.createElement("style")
    style.innerText = `
      @keyframes fadeUp {
        from { opacity:0; transform:translateY(16px); }
        to   { opacity:1; transform:translateY(0); }
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const s2NotList    = t('terms.s2NotList')
  const s12BillingList = t('terms.s12BillingList')

  const sections = [
    { id: "s1",  num: 1,  label: "Acceptance of Terms",        icon: CheckCircle, color: "text-blue-600" },
    { id: "s2",  num: 2,  label: "Use of Service",             icon: Shield,      color: "text-violet-600" },
    { id: "s3",  num: 3,  label: "File Upload & Processing",   icon: FileText,    color: "text-cyan-600" },
    { id: "s4",  num: 4,  label: "Intellectual Property",      icon: Lock,        color: "text-emerald-600" },
    { id: "s5",  num: 5,  label: "Disclaimer of Warranties",   icon: AlertCircle, color: "text-amber-600" },
    { id: "s6",  num: 6,  label: "Limitation of Liability",    icon: Scale,       color: "text-red-600" },
    { id: "s7",  num: 7,  label: "Privacy & Data Protection",  icon: Shield,      color: "text-green-600" },
    { id: "s8",  num: 8,  label: "Modifications to Service",   icon: Server,      color: "text-indigo-600" },
    { id: "s9",  num: 9,  label: "Changes to Terms",           icon: FileText,    color: "text-gray-600" },
    { id: "s10", num: 10, label: "Governing Law",              icon: Scale,       color: "text-slate-600" },
    { id: "s11", num: 11, label: "Contact Information",        icon: Mail,        color: "text-blue-600" },
    { id: "s12", num: 12, label: "Subscriptions & Payments",  icon: CreditCard,  color: "text-purple-600" },
  ]

  const highlights = [
    { icon: CheckCircle, text: "Free to use — no hidden fees",         color: "from-emerald-500 to-green-600",  border: "border-emerald-100" },
    { icon: Lock,        text: "Files deleted within 2 hours",         color: "from-blue-500 to-blue-600",      border: "border-blue-100" },
    { icon: Shield,      text: "Your content stays yours — always",    color: "from-violet-500 to-purple-600",  border: "border-violet-100" },
  ]

  return (
    <Layout
      title={t('terms.layoutTitle')}
      description={t('terms.layoutDescription')}
    >
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">

        {/* ── COMPACT HERO ─────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-slate-950 to-slate-900 py-10 md:py-14 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/3 w-56 h-56 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 mb-4">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Terms of Service</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
              {t('terms.heroTitle')}
            </h1>
            <p className="text-slate-400 text-sm mb-1">{t('terms.lastUpdated')}</p>
            <p className="text-slate-300 text-sm max-w-xl mx-auto mt-2">
              Plain and simple. By using SmallPDF.us you agree to these terms.
            </p>
          </div>
        </div>

        {/* ── KEY HIGHLIGHTS ────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-10 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {highlights.map((h, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl p-4 border ${h.border} shadow-lg flex items-center gap-3.5`}
                style={{ animationDelay: `${i * 80}ms`, animation: "fadeUp 0.5s ease-out forwards", opacity: 0 }}
              >
                <div className={`w-10 h-10 bg-gradient-to-br ${h.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <h.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-bold text-gray-800 leading-snug">{h.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── IMPORTANT NOTICE ──────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
              <AlertCircle className="w-4.5 h-4.5 text-white w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-blue-900 mb-0.5">{t('terms.noticeBadge')}</h3>
              <p className="text-sm text-blue-800 leading-relaxed">{t('terms.noticeText')}</p>
            </div>
          </div>
        </div>

        {/* ── BODY: SIDEBAR + CONTENT ───────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <div className="flex gap-8 items-start">

            {/* Sticky sidebar nav */}
            <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-6">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Sections</p>
                <nav className="space-y-0.5">
                  {sections.map((s, i) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      onClick={() => setActiveSection(i)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeSection === i
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-black flex-shrink-0 ${
                        activeSection === i ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                        {s.num}
                      </span>
                      <span className="truncate">{s.label}</span>
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">

                {/* S1 — Acceptance */}
                <section id="s1" className="p-6 md:p-8">
                  <SectionHeading num={1} title={t('terms.s1Title')} icon={CheckCircle} color="text-blue-600" gradient="from-blue-500 to-blue-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('terms.s1Para')}</p>
                </section>

                {/* S2 — Use of Service */}
                <section id="s2" className="p-6 md:p-8">
                  <SectionHeading num={2} title={t('terms.s2Title')} icon={Shield} color="text-violet-600" gradient="from-violet-500 to-purple-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('terms.s2Para')}</p>
                  <h3 className="text-sm font-black text-gray-900 mb-3">{t('terms.s2NotTitle')}</h3>
                  <div className="space-y-2">
                    {Array.isArray(s2NotList) && s2NotList.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                        <span className="text-red-500 font-black text-xs flex-shrink-0 mt-0.5">✕</span>
                        <span className="text-xs text-red-800 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* S3 — File Upload */}
                <section id="s3" className="p-6 md:p-8">
                  <SectionHeading num={3} title={t('terms.s3Title')} icon={FileText} color="text-cyan-600" gradient="from-cyan-500 to-cyan-600" />
                  <div className="space-y-3">
                    {[
                      { label: t('terms.s3FileSizeLabel'),      value: t('terms.s3FileSize'),      icon: "📁" },
                      { label: t('terms.s3StorageLabel'),        value: t('terms.s3Storage'),        icon: "🗑️" },
                      { label: t('terms.s3ResponsibilityLabel'), value: t('terms.s3Responsibility'), icon: "⚖️" },
                    ].map((row, i) => (
                      <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <span className="text-base leading-none mt-0.5 flex-shrink-0">{row.icon}</span>
                        <div>
                          <span className="text-xs font-black text-gray-900">{row.label} </span>
                          <span className="text-xs text-gray-600 leading-relaxed">{row.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* S4 — IP */}
                <section id="s4" className="p-6 md:p-8">
                  <SectionHeading num={4} title={t('terms.s4Title')} icon={Lock} color="text-emerald-600" gradient="from-emerald-500 to-green-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{t('terms.s4Para1')}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{t('terms.s4Para2')}</p>
                </section>

                {/* S5 — Disclaimer */}
                <section id="s5" className="p-6 md:p-8">
                  <SectionHeading num={5} title={t('terms.s5Title')} icon={AlertCircle} color="text-amber-600" gradient="from-amber-500 to-yellow-500" />
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 font-medium leading-relaxed">{t('terms.s5Notice')}</p>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{t('terms.s5Para')}</p>
                </section>

                {/* S6 — Liability */}
                <section id="s6" className="p-6 md:p-8">
                  <SectionHeading num={6} title={t('terms.s6Title')} icon={Scale} color="text-red-600" gradient="from-red-500 to-rose-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('terms.s6Para')}</p>
                </section>

                {/* S7 — Privacy */}
                <section id="s7" className="p-6 md:p-8">
                  <SectionHeading num={7} title={t('terms.s7Title')} icon={Shield} color="text-green-600" gradient="from-green-500 to-emerald-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{t('terms.s7Para')}</p>
                  <a
                    href="/privacy"
                    className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3.5 py-2 rounded-lg hover:bg-green-100 transition-all"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Read our Privacy Policy →
                  </a>
                </section>

                {/* S8 — Modifications */}
                <section id="s8" className="p-6 md:p-8">
                  <SectionHeading num={8} title={t('terms.s8Title')} icon={Server} color="text-indigo-600" gradient="from-indigo-500 to-indigo-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('terms.s8Para')}</p>
                </section>

                {/* S9 — Changes to Terms */}
                <section id="s9" className="p-6 md:p-8">
                  <SectionHeading num={9} title={t('terms.s9Title')} icon={FileText} color="text-gray-600" gradient="from-gray-500 to-gray-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('terms.s9Para')}</p>
                </section>

                {/* S10 — Governing Law */}
                <section id="s10" className="p-6 md:p-8">
                  <SectionHeading num={10} title={t('terms.s10Title')} icon={Scale} color="text-slate-600" gradient="from-slate-500 to-slate-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('terms.s10Para')}</p>
                </section>

                {/* S11 — Contact */}
                <section id="s11" className="p-6 md:p-8">
                  <SectionHeading num={11} title={t('terms.s11Title')} icon={Mail} color="text-blue-600" gradient="from-blue-500 to-cyan-500" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('terms.s11Para')}</p>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{t('terms.s11Email')}</p>
                  </div>
                </section>

                {/* S12 — Subscriptions & Payments */}
                <section id="s12" className="p-6 md:p-8">
                  <SectionHeading num={12} title={t('terms.s12Title')} icon={CreditCard} color="text-purple-600" gradient="from-purple-500 to-purple-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('terms.s12Para')}</p>

                  {/* Billing */}
                  <h3 className="text-sm font-black text-gray-900 mb-2">{t('terms.s12BillingTitle')}</h3>
                  <div className="space-y-2 mb-5">
                    {Array.isArray(s12BillingList) && s12BillingList.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-purple-50 border border-purple-100 rounded-lg px-3.5 py-2.5">
                        <CheckCircle className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-purple-900 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Cancellation */}
                  <h3 className="text-sm font-black text-gray-900 mb-2">{t('terms.s12CancelTitle')}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-5">{t('terms.s12CancelPara')}</p>

                  {/* Refunds */}
                  <h3 className="text-sm font-black text-gray-900 mb-2">{t('terms.s12RefundTitle')}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{t('terms.s12RefundPara')}</p>
                  <a
                    href="/refund"
                    className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold px-3.5 py-2 rounded-lg hover:bg-purple-100 transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Read our Refund Policy →
                  </a>
                </section>

              </div>

              {/* Bottom CTA */}
              <div className="mt-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-7 flex flex-col sm:flex-row items-center gap-5 shadow-xl">
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <Shield className="w-5 h-5 text-green-400" />
                    <h3 className="text-base font-black text-white">{t('terms.bottomTitle')}</h3>
                  </div>
                  <p className="text-slate-400 text-xs">{t('terms.bottomSubtitle')}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-center sm:justify-start">
                  <a href="/contact" className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:shadow-lg transition-all">
                    {t('terms.bottomContact')}
                  </a>
                  <a href="/privacy" className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:bg-white/15 transition-all">
                    Privacy Policy
                  </a>
                  <a href="/refund" className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:bg-white/15 transition-all">
                    Refund Policy
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

// ─── Section Heading component ────────────────────────────────────────────────
function SectionHeading({ num, title, icon: Icon, color, gradient }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
        <span className="text-white font-black text-sm">{num}</span>
      </div>
      <h2 className="text-lg font-black text-gray-900">{title}</h2>
    </div>
  )
}