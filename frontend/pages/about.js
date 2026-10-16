import { useState, useEffect, memo } from "react"
import Link from "next/link"
import Image from "next/image"
import Layout from "../components/Layout"
import SEOHead from "../components/SEOHead"
import { useTranslations } from "../lib/i18n"
import { getPageMessages } from '../lib/i18nLoader'
import {
  Shield, Zap, Users, Globe, Heart,
  Briefcase, GraduationCap, Star, CheckCircle,
  Lock, FileText, Clock, Target,
  Lightbulb, Server, ArrowRight, Mail,
} from "lucide-react"

// ─── Team data ────────────────────────────────────────────────────────────────
const team = [
  {
    name: "Manikant Yadav",
    role: "Founder & Developer",
    education: "Computer Science",
    experience: "Full-stack developer · PDF tools & document processing",
    bio: "Manikant built SmallPDF.us from scratch after getting frustrated with PDF tools that lock basic features behind paywalls or require creating an account just to merge two files. He handles everything — from backend processing to frontend UX.",
    expertise: ["PDF Processing", "Next.js / Node.js", "Product Design"],
    photo: "/team/manikant.png",
    isFounder: true,
    accentColor: "from-blue-600 to-blue-800",
    badgeColor: "bg-blue-50 text-blue-700 border border-blue-100",
  },
]

// milestones are translated inside the component via t() — see milestonesTranslated below

// ─── Founder Card (large, featured)
const FounderCard = memo(({ member }) => (
  <div className="lg:col-span-3 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-500 group">
    <div className={`h-1.5 w-full bg-gradient-to-r ${member.accentColor}`} />
    <div className="grid md:grid-cols-[280px,1fr] gap-0">
      {/* Photo side */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 min-h-[280px] md:min-h-0">
        <Image
          src={member.photo}
          alt={`${member.name} — ${member.role}, SmallPDF.us`}
          fill
          sizes="(max-width: 768px) 100vw, 280px"
          className="object-cover object-top group-hover:scale-105 transition-transform duration-700"
          style={{ maxHeight: "360px" }}
          priority
          onError={(e) => {
            e.target.style.display = "none"
            e.target.parentElement.style.background = "linear-gradient(135deg, #1e3a5f 0%, #1e5f8f 100%)"
          }}
        />
        {/* Subtle gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/20 to-transparent md:hidden" />
        {/* Founder badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
          <span>★</span>
          <span>FOUNDER</span>
        </div>
      </div>

      {/* Info side */}
      <div className="p-6 md:p-7 flex flex-col justify-center">
        <div className="mb-1">
          <h3 className="font-black text-2xl text-gray-900 leading-tight">{member.name}</h3>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-block mt-1.5 ${member.badgeColor}`}>
            {member.role}
          </span>
        </div>

        <div className="space-y-1.5 mt-4 mb-4">
          <div className="flex items-start gap-2">
            <GraduationCap className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-gray-500">{member.education}</span>
          </div>
          <div className="flex items-start gap-2">
            <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-gray-500">{member.experience}</span>
          </div>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4 mb-4">{member.bio}</p>

        <div className="flex flex-wrap gap-1.5">
          {member.expertise.map((tag) => (
            <span key={tag} className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-md">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  </div>
))
FounderCard.displayName = "FounderCard"

// ─── Regular TeamCard 
const TeamCard = memo(({ member, index }) => (
  <div
    className="relative bg-white rounded-2xl overflow-hidden border border-gray-100 transition-all duration-400 hover:shadow-xl hover:-translate-y-1 group"
    style={{ animationDelay: `${index * 80}ms`, animation: "fadeUp 0.5s ease-out forwards", opacity: 0 }}
  >
    <div className={`h-1.5 w-full bg-gradient-to-r ${member.accentColor}`} />
    <div className="p-5">
      {/* Photo + name */}
      <div className="flex items-center gap-3.5 mb-4">
        <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md ring-2 ring-gray-100">
          <Image
            src={member.photo}
            alt={`${member.name} — ${member.role} at SmallPDF.us`}
            fill
            sizes="64px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = "none"
              e.target.parentElement.style.background = "#E5E7EB"
            }}
          />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-base text-gray-900 leading-snug">{member.name}</h3>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${member.badgeColor}`}>
            {member.role}
          </span>
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-start gap-2">
          <GraduationCap className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-gray-500">{member.education}</span>
        </div>
        <div className="flex items-start gap-2">
          <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-gray-500">{member.experience}</span>
        </div>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-50 pt-3 mb-3">{member.bio}</p>

      <div className="flex flex-wrap gap-1.5">
        {member.expertise.map((tag) => (
          <span key={tag} className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{tag}</span>
        ))}
      </div>
    </div>
  </div>
))
TeamCard.displayName = "TeamCard"

// ─── Page
export default function AboutPage() {
  const [mounted, setMounted] = useState(false)
  const { t } = useTranslations()

  useEffect(() => {
    setMounted(true)
    const style = document.createElement("style")
    style.innerText = `
      @keyframes fadeUp {
        from { opacity:0; transform:translateY(18px); }
        to   { opacity:1; transform:translateY(0); }
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const founder = team.find((m) => m.isFounder)
  const restTeam = team.filter((m) => !m.isFounder)

  // Translated stats labels
  const statsTranslated = [
    { value: "27",     label: t("about.statTools"),      icon: FileText },
    { value: "8",      label: t("about.statLanguages"),  icon: Users },
    { value: "256-bit",label: t("about.statEncryption"), icon: Lock },
    { value: "1 hr",   label: t("about.statAutoDelete"), icon: Clock },
    { value: "2024",   label: t("about.statLaunched"),   icon: Star },
    { value: "Free",   label: t("about.statPrice"),      icon: Server },
  ]

  // Translated values
  const valuesTranslated = [
    { icon: Heart,     title: t("about.valuesFreeTitle"),       desc: t("about.valuesFreeDesc"),       gradient: "from-rose-500 to-pink-600" },
    { icon: Shield,    title: t("about.valuesPrivacyTitle"),    desc: t("about.valuesPrivacyDesc"),    gradient: "from-green-500 to-emerald-600" },
    { icon: Zap,       title: t("about.valuesSimplicityTitle"), desc: t("about.valuesSimplicityDesc"), gradient: "from-amber-500 to-yellow-600" },
    { icon: Globe,     title: t("about.valuesGlobalTitle"),     desc: t("about.valuesGlobalDesc"),     gradient: "from-blue-500 to-cyan-600" },
    { icon: Target,    title: t("about.valuesQualityTitle"),    desc: t("about.valuesQualityDesc"),    gradient: "from-violet-500 to-purple-600" },
    { icon: Lightbulb, title: t("about.valuesRoadmapTitle"),   desc: t("about.valuesRoadmapDesc"),    gradient: "from-teal-500 to-cyan-600" },
  ]

  return (
    <>
      <SEOHead
        title={t("about.pageTitle")}
        description={t("about.pageDescription")}
        keywords="about smallpdf.us, Manikant Yadav, PDF tools team, privacy PDF, free PDF tools"
      />
      <Layout>

        {/* ── COMPACT HERO — text only, no photos  */}
        <section className="relative bg-gradient-to-br from-slate-950 to-slate-900 py-10 md:py-14 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/3 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto text-center">
            <div className={`transition-all duration-600 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 mb-4">
                <Users className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">{t("about.missionBadge")}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-3">
                {t("about.heroTitle")}
              </h1>

              <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-6 max-w-xl mx-auto">
                {t("about.heroSubtitle")}
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <Link href="#team" className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold px-5 py-2.5 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all text-sm">
                  {t("about.teamBadge")} <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="#mission" className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-white/15 transition-all text-sm">
                  {t("about.missionBadge")}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS BAR  */}
        <section className="bg-white border-b border-gray-100 py-6 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {statsTranslated.map((stat, i) => (
                <div key={i} className="text-center group">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-1.5 group-hover:bg-blue-100 transition-all">
                    <stat.icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-base font-black text-gray-900 leading-none">{stat.value}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MISSION  */}
        <section id="mission" className="py-14 md:py-20 px-4 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                  <Target className="w-3.5 h-3.5" /> {t("about.missionBadge")}
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-5 leading-tight">
                  {t("about.missionTitle")}
                </h2>
                <div className="space-y-4 text-gray-600 leading-relaxed text-sm md:text-base">
                  <p>{t("about.missionPara")}</p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2.5">
                  {["Fast, secure processing", "Files deleted within 1 hour", "No ads inside conversion flows", "Transparent about how we earn", "GDPR & CCPA compliant", "Available in 8 languages"].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Privacy architecture code block */}
              <div className="relative">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-7 shadow-2xl">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    </div>
                    <span className="text-slate-400 text-xs font-mono ml-2">privacy_architecture.md</span>
                  </div>
                  <div className="space-y-2.5 font-mono text-sm">
                    {[
                      { c: "text-purple-400", t: "UPLOAD" },
                      { c: "text-slate-400",  t: "  └─ 256-bit TLS in transit" },
                      { c: "text-purple-400", t: "PROCESS" },
                      { c: "text-slate-400",  t: "  └─ Isolated sandboxed container" },
                      { c: "text-slate-400",  t: "  └─ No file content logging" },
                      { c: "text-purple-400", t: "SERVE" },
                      { c: "text-slate-400",  t: "  └─ Signed download URL (15 min)" },
                      { c: "text-green-400",  t: "AUTO_DELETE  →  1 hour" },
                      { c: "text-cyan-400",   t: "STORED_COPIES →  0" },
                    ].map((line, i) => <div key={i} className={`${line.c} leading-tight`}>{line.t}</div>)}
                  </div>
                  <div className="mt-5 flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-lg px-3 py-2">
                    <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-green-300 text-xs font-bold">Zero data retention — by architecture, not just policy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── VALUES  */}
        <section className="py-14 md:py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">{t("about.valuesTitle")}</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto">{t("about.valuesSubtitle")}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {valuesTranslated.map((v, i) => (
                <div key={i} className="group bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className={`w-11 h-11 bg-gradient-to-br ${v.gradient} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md`}>
                    <v.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-black text-base text-gray-900 mb-1.5">{v.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TEAM  */}
        <section id="team" className="py-14 md:py-20 px-4 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                <Users className="w-3.5 h-3.5" /> {t("about.teamBadge")}
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">{t("about.teamTitle")}</h2>
              <p className="text-sm text-gray-600 max-w-xl mx-auto">
                {t("about.teamSubtitle")}
              </p>
            </div>

            {/* Founder — full-width featured card */}
            <div className="grid lg:grid-cols-3 gap-5 mb-5">
              {founder && <FounderCard member={founder} />}
            </div>

            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-7 py-4 shadow-sm">
                <p className="text-sm text-gray-600">Solo-built and maintained — every line of code, every tool, every design decision.</p>
              </div>
            </div>
          </div>
        </section>


        {/* ── TRUST SIGNALS  */}
        <section className="py-14 md:py-20 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-gray-900 mb-2">{t("about.trustTitle")}</h2>
              <p className="text-gray-500 text-sm">{t("about.trustSubtitle")}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Shield,      title: "256-bit SSL Encryption",  desc: "All file transfers are encrypted in transit. Your data is protected end-to-end.", color: "from-blue-500 to-blue-600" },
                { icon: Clock,       title: "1-Hour Auto Delete",      desc: "Every uploaded file is permanently deleted from our servers within 1 hour.", color: "from-amber-500 to-orange-500" },
                { icon: Lock,        title: "Zero Data Retention",     desc: "We don't store, analyze, or share your files. No copies are ever kept.", color: "from-violet-500 to-purple-600" },
                { icon: CheckCircle, title: "GDPR Compliant",          desc: "Built with privacy by design. Compliant with GDPR and international privacy standards.", color: "from-green-500 to-emerald-600" },
              ].map((item, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:border-gray-200 transition-all group text-center">
                  <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-black text-sm text-gray-900 mb-1.5">{item.title}</h3>
                  <p className="text-[11px] text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA  */}
        <section className="py-12 px-4 bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">{t("about.ctaTitle")}</h2>
            <p className="text-slate-400 text-sm mb-6">{t("about.ctaSubtitle")}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-black px-7 py-3 rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all text-sm">
                {t("about.ctaButton")} <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="mailto:contact@smallpdf.us" className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-5 py-3 rounded-xl hover:bg-white/15 transition-all text-sm">
                <Mail className="w-4 h-4" /> {t("about.ctaContact")}
              </a>
            </div>
          </div>
        </section>

      </Layout>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["about"]) },
    revalidate: 86400,
  }
}
