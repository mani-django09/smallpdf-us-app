import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import SEOHead from '../components/SEOHead'
import { useTranslations } from '../lib/i18n'
import { Mail, Clock, MessageSquare, Send, CheckCircle, AlertCircle, Shield, Zap, Users } from 'lucide-react'

export default function Contact() {
  const { t } = useTranslations()
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [focused, setFocused] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        setStatus('success')
        setFormData({ name: '', email: '', subject: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const infoCards = [
    {
      icon: Mail,
      title: t('contact.emailCardTitle'),
      value: t('contact.emailAddress'),
      href: `mailto:${t('contact.emailAddress')}`,
      gradient: "from-blue-500 to-cyan-500",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      icon: Clock,
      title: t('contact.responseCardTitle'),
      value: t('contact.responseTime'),
      href: null,
      gradient: "from-violet-500 to-purple-500",
      bg: "bg-violet-50",
      border: "border-violet-100",
    },
    {
      icon: MessageSquare,
      title: "Live Support",
      value: "Mon – Fri, 9am – 6pm IST",
      href: null,
      gradient: "from-emerald-500 to-green-500",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
  ]

  return (
    <Layout>
      <SEOHead
        title="Contact SmallPDF.us — Support & Feedback"
        description="Get in touch with SmallPDF.us support team. We respond within 24 hours to all questions about PDF conversion, billing, and features."
        keywords="contact smallpdf, support, help, customer service, feedback"
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">

        {/* ── COMPACT HERO ─────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-slate-950 to-slate-900 py-10 md:py-14 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/3 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-500/25 rounded-full px-3 py-1.5 mb-4">
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Contact Us</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
              {t('contact.heroTitle')}
            </h1>
            <p className="text-slate-300 text-sm max-w-lg mx-auto leading-relaxed">
              {t('contact.heroSubtitle')}
            </p>
          </div>
        </div>

        {/* ── INFO CARDS ────────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10 mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {infoCards.map((card, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl p-5 border ${card.border} shadow-lg flex items-center gap-4`}
                style={{ animationDelay: `${i * 80}ms`, animation: "fadeUp 0.5s ease-out forwards", opacity: 0 }}
              >
                <div className={`w-11 h-11 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{card.title}</p>
                  {card.href ? (
                    <a href={card.href} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors truncate block">
                      {card.value}
                    </a>
                  ) : (
                    <p className="text-sm font-bold text-gray-900 truncate">{card.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <div className="grid lg:grid-cols-[1fr,320px] gap-6 items-start">

            {/* Contact Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-black text-gray-900">{t('contact.formTitle')}</h2>
                <p className="text-xs text-gray-500 mt-0.5">We read every message and reply within 24 hours.</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Name + Email row */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">{t('contact.nameLabel')}</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder={t('contact.namePlaceholder')}
                      className="contact-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">{t('contact.emailLabel')}</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder={t('contact.emailPlaceholder')}
                      className="contact-input"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">{t('contact.subjectLabel')}</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    placeholder={t('contact.subjectPlaceholder')}
                    className="contact-input"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">{t('contact.messageLabel')}</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    placeholder={t('contact.messagePlaceholder')}
                    className="contact-input resize-none"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Status messages */}
                {status === 'success' && (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <p className="text-sm font-medium text-green-800">{t('contact.successMessage')}</p>
                  </div>
                )}
                {status === 'error' && (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm font-medium text-red-800">{t('contact.errorMessage')}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white transition-all ${
                    loading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5'
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      {t('contact.sendingButton')}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {t('contact.submitButton')}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right sidebar — trust + quick help */}
            <div className="space-y-4">

              {/* Trust signals */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-black text-gray-900 mb-4">Why people trust us</h3>
                <div className="space-y-3">
                  {[
                    { icon: Shield, text: "Your messages are encrypted in transit", color: "text-green-500 bg-green-50" },
                    { icon: Zap,    text: "We reply within 24 hours, usually sooner", color: "text-amber-500 bg-amber-50" },
                    { icon: Users,  text: "Real humans read and respond, no bots", color: "text-blue-500 bg-blue-50" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-7 h-7 ${item.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed pt-0.5">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick topics */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-black text-gray-900 mb-3">Common topics</h3>
                <div className="space-y-1.5">
                  {[
                    "File conversion not working",
                    "Privacy / data questions",
                    "Feature request",
                    "Bug report",
                    "Business / partnerships",
                    "Something else",
                  ].map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, subject: topic }))}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-medium transition-all flex items-center gap-2 group"
                    >
                      <span className="w-1.5 h-1.5 bg-gray-300 group-hover:bg-blue-400 rounded-full flex-shrink-0 transition-colors" />
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Privacy note */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <h3 className="text-xs font-black text-white">Privacy guaranteed</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Contact form data is used only to respond to your message and is deleted after 30 days.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  )
}