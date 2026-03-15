import Layout from "../components/Layout"
import SEOHead from "../components/SEOHead"
import { useTranslations } from "../lib/i18n"
import { Shield, Lock, Eye, Trash2, Server, FileText, CheckCircle, ChevronRight, CreditCard } from "lucide-react"
import { useState, useEffect } from "react"

export default function Privacy() {
  const { t } = useTranslations()
  const [activeSection, setActiveSection] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const collect2List = t('privacy.collect2List')
  const useList = t('privacy.useList')
  const securityList = t('privacy.securityList')
  const thirdPartyList = t('privacy.thirdPartyList')
  const rightsList = t('privacy.rightsList')

  const highlights = [
    {
      icon: Lock,
      title: t('privacy.highlight1Title'),
      desc: t('privacy.highlight1Desc'),
      gradient: "from-green-500 to-emerald-600",
      bg: "bg-green-50",
      border: "border-green-100",
    },
    {
      icon: Trash2,
      title: t('privacy.highlight2Title'),
      desc: t('privacy.highlight2Desc'),
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      icon: Eye,
      title: t('privacy.highlight3Title'),
      desc: t('privacy.highlight3Desc'),
      gradient: "from-violet-500 to-purple-600",
      bg: "bg-violet-50",
      border: "border-violet-100",
    },
  ]

  const sections = [
    { id: "intro",         label: "Introduction" },
    { id: "collect",       label: "Information We Collect" },
    { id: "use",           label: "How We Use It" },
    { id: "security",      label: "File Security" },
    { id: "retention",     label: "Data Retention" },
    { id: "third-party",   label: "Third-Party Services" },
    { id: "payments",      label: "Payment Processing" },
    { id: "rights",        label: "Your Rights" },
    { id: "children",      label: "Children's Privacy" },
    { id: "international", label: "International Users" },
    { id: "changes",       label: "Policy Changes" },
    { id: "contact",       label: "Contact Us" },
  ]

  return (
    <Layout>
      <SEOHead
        title="Privacy Policy — SmallPDF.us"
        description="SmallPDF.us privacy policy. Your files are encrypted in transit and deleted automatically within 2 hours. No data sold, no signup required."
        keywords="smallpdf privacy policy, data protection, file security, GDPR"
      />
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">

        {/* ── COMPACT HERO ─────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-slate-950 to-slate-900 py-10 md:py-14 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-green-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-green-500/15 border border-green-500/25 rounded-full px-3 py-1.5 mb-4">
              <Shield className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[11px] font-bold text-green-300 uppercase tracking-wider">Privacy Policy</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
              {t('privacy.heroTitle')}
            </h1>
            <p className="text-slate-400 text-sm mb-2">{t('privacy.lastUpdated')}</p>
            <p className="text-slate-300 text-sm max-w-xl mx-auto">
              Your files, your privacy. We process documents and delete them — nothing more.
            </p>
          </div>
        </div>

        {/* ── HIGHLIGHT CARDS ───────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-10 mb-8">
          <div className="grid md:grid-cols-3 gap-4">
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

            {/* Sticky sidebar nav — hidden on mobile */}
            <aside className="hidden lg:block w-52 flex-shrink-0 sticky top-6">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">On This Page</p>
                <nav className="space-y-0.5">
                  {sections.map((s, i) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeSection === i
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                      onClick={() => setActiveSection(i)}
                    >
                      <ChevronRight className={`w-3 h-3 flex-shrink-0 ${activeSection === i ? "text-blue-600" : "text-gray-300"}`} />
                      {s.label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">

                {/* Introduction */}
                <section id="intro" className="p-6 md:p-8">
                  <SectionHeading icon={FileText} title={t('privacy.introTitle')} color="text-blue-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.introPara')}</p>
                </section>

                {/* Information We Collect */}
                <section id="collect" className="p-6 md:p-8">
                  <SectionHeading icon={FileText} title={t('privacy.collectTitle')} color="text-blue-600" />
                  <SubHeading>{t('privacy.collect1Title')}</SubHeading>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('privacy.collect1Para')}</p>
                  <SubHeading>{t('privacy.collect2Title')}</SubHeading>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{t('privacy.collect2Intro')}</p>
                  <BulletList items={collect2List} />
                  <SubHeading>{t('privacy.collect3Title')}</SubHeading>
                  <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.collect3Para')}</p>
                </section>

                {/* How We Use */}
                <section id="use" className="p-6 md:p-8">
                  <SectionHeading icon={Server} title={t('privacy.useTitle')} color="text-violet-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{t('privacy.useIntro')}</p>
                  <BulletList items={useList} />
                </section>

                {/* File Security */}
                <section id="security" className="p-6 md:p-8">
                  <SectionHeading icon={Lock} title={t('privacy.securityTitle')} color="text-green-600" />
                  <div className="bg-green-50 border border-green-100 rounded-xl p-5 mb-4">
                    <h4 className="font-black text-sm text-green-900 mb-3">{t('privacy.securityBoxTitle')}</h4>
                    <div className="space-y-2">
                      {Array.isArray(securityList) && securityList.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-green-800">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.securityPara')}</p>
                </section>

                {/* Data Retention */}
                <section id="retention" className="p-6 md:p-8">
                  <SectionHeading icon={Trash2} title={t('privacy.retentionTitle')} color="text-amber-600" />
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm text-amber-900 leading-relaxed">{t('privacy.retentionFiles')}</p>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.retentionLogs')}</p>
                </section>

                {/* Third-Party Services */}
                <section id="third-party" className="p-6 md:p-8">
                  <SectionHeading icon={Server} title={t('privacy.thirdPartyTitle')} color="text-cyan-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{t('privacy.thirdPartyIntro')}</p>
                  <BulletList items={thirdPartyList} />
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">{t('privacy.thirdPartyNote')}</p>
                </section>

                {/* Payment Processing */}
                <section id="payments" className="p-6 md:p-8">
                  <SectionHeading icon={CreditCard} title={t('privacy.paymentTitle')} color="text-purple-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('privacy.paymentPara')}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { name: "Razorpay (India)", desc: "UPI, cards, net banking — INR payments", url: "https://razorpay.com/privacy/" },
                      { name: "Razorpay + PayPal (Intl)", desc: "USD payments via PayPal for international users", url: "https://www.paypal.com/in/legalhub/privacy-full" },
                    ].map((p, i) => (
                      <div key={i} className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                        <p className="text-xs font-black text-purple-900 mb-1">{p.name}</p>
                        <p className="text-xs text-purple-700 mb-2">{p.desc}</p>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-purple-600 hover:underline">
                          View their Privacy Policy →
                        </a>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Your Rights */}
                <section id="rights" className="p-6 md:p-8">
                  <SectionHeading icon={Shield} title={t('privacy.rightsTitle')} color="text-blue-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{t('privacy.rightsIntro')}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Array.isArray(rightsList) && rightsList.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
                        <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-700 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Children's Privacy */}
                <section id="children" className="p-6 md:p-8">
                  <SectionHeading icon={Eye} title={t('privacy.childrenTitle')} color="text-rose-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.childrenPara')}</p>
                </section>

                {/* International Users */}
                <section id="international" className="p-6 md:p-8">
                  <SectionHeading icon={Server} title={t('privacy.internationalTitle')} color="text-indigo-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.internationalPara')}</p>
                </section>

                {/* Changes */}
                <section id="changes" className="p-6 md:p-8">
                  <SectionHeading icon={FileText} title={t('privacy.changesTitle')} color="text-gray-600" />
                  <p className="text-sm text-gray-600 leading-relaxed">{t('privacy.changesPara')}</p>
                </section>

                {/* Contact */}
                <section id="contact" className="p-6 md:p-8">
                  <SectionHeading icon={Shield} title={t('privacy.contactTitle')} color="text-green-600" />
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('privacy.contactPara')}</p>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900">{t('privacy.contactEmail')}</p>
                      <p className="text-xs text-gray-500">{t('privacy.contactResponse')}</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Bottom CTA */}
              <div className="mt-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-7 flex flex-col sm:flex-row items-center gap-5 shadow-xl">
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <Shield className="w-5 h-5 text-green-400" />
                    <h3 className="text-base font-black text-white">{t('privacy.bottomTitle')}</h3>
                  </div>
                  <p className="text-slate-400 text-xs">{t('privacy.bottomSubtitle')}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-center sm:justify-start">
                  <a href="/contact" className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:shadow-lg transition-all">
                    {t('privacy.bottomContact')}
                  </a>
                  <a href="/terms" className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:bg-white/15 transition-all">
                    {t('privacy.bottomTerms')}
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

// ─── Shared sub-components ────────────────────────────────────────────────────
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

function SubHeading({ children }) {
  return <h3 className="text-sm font-black text-gray-900 mt-4 mb-2">{children}</h3>
}

function BulletList({ items }) {
  if (!Array.isArray(items)) return null
  return (
    <ul className="space-y-1.5 mb-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0 mt-1.5" />
          <span className="text-sm text-gray-600">{item}</span>
        </li>
      ))}
    </ul>
  )
}