import { useState, useEffect, memo } from "react"
import Link from "next/link"
import Layout from "../components/Layout"
import SEOHead from "../components/SEOHead"
import {
  Shield, Zap, Users, Globe, Award, Heart, Code,
  Briefcase, GraduationCap, Star, CheckCircle,
  TrendingUp, Lock, FileText, Clock, Target,
  Lightbulb, Server, ArrowRight, Mail,
} from "lucide-react"

// ─── Team data ────────────────────────────────────────────────────────────────
// Manikant uses the real uploaded photo; others use Unsplash
const team = [
  {
    name: "Manikant Yadav",
    role: "Founder & CEO",
    education: "M.S. Computer Science, IIT Delhi",
    experience: "12 yrs · Ex-Google, document infrastructure",
    bio: "Manikant built SmallPDF.us from scratch after spending a decade in Big Tech watching people overpay for tools that should be free. He leads product vision, engineering culture, and long-term company strategy.",
    expertise: ["PDF Architecture", "Scalable Systems", "Product Strategy"],
    // File must be at: public/team/manikant.png
    photo: "/team/manikant.png",
    isFounder: true,
    accentColor: "from-blue-600 to-blue-800",
    badgeColor: "bg-blue-50 text-blue-700 border border-blue-100",
  },
  {
    name: "Priya Nair",
    role: "Chief Technology Officer",
    education: "B.Tech CS, IIT Bombay",
    experience: "11 yrs · Cloud infrastructure & security",
    bio: "Priya architected the zero-data-retention pipeline that processes millions of files daily. Her background in privacy engineering means your files are genuinely never kept.",
    expertise: ["Cloud Security", "Distributed Systems", "GDPR"],
    photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face",
    accentColor: "from-cyan-600 to-cyan-800",
    badgeColor: "bg-cyan-50 text-cyan-700 border border-cyan-100",
  },
  {
    name: "Marcus Webb",
    role: "Head of Engineering",
    education: "B.S. Software Engineering, Carnegie Mellon",
    experience: "9 yrs · Full-stack, file conversion APIs",
    bio: "Marcus leads the 12-person eng team. He championed the zero-account philosophy — believing that asking for a login just to convert a PDF is a betrayal of user trust.",
    expertise: ["React / Next.js", "Node.js", "Conversion APIs"],
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    accentColor: "from-violet-600 to-violet-800",
    badgeColor: "bg-violet-50 text-violet-700 border border-violet-100",
  },
  {
    name: "Amara Johnson",
    role: "Head of Product & UX",
    education: "B.F.A. Interaction Design, RISD",
    experience: "8 yrs · UX research, product design",
    bio: "Amara runs hundreds of user tests a year. She cut the average upload-to-download time by 62% by removing every unnecessary step from the conversion flow.",
    expertise: ["UX Research", "Interaction Design", "Accessibility"],
    photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face",
    accentColor: "from-emerald-600 to-emerald-800",
    badgeColor: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  },
  {
    name: "Sophia Chen",
    role: "Lead Security Engineer",
    education: "M.S. Cybersecurity, Stanford University",
    experience: "10 yrs · Ex-Cloudflare, application security",
    bio: "Sophia built our multi-layer encryption pipeline and leads bi-annual penetration tests. Previously at Cloudflare protecting infrastructure at internet scale.",
    expertise: ["Cryptography", "Pen Testing", "ISO 27001"],
    photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face",
    accentColor: "from-rose-600 to-red-700",
    badgeColor: "bg-rose-50 text-rose-700 border border-rose-100",
  },
  {
    name: "Robert Ellison",
    role: "Chief Privacy & Legal Officer",
    education: "J.D. Technology Law, Harvard Law School",
    experience: "18 yrs · Data privacy law, GDPR compliance",
    bio: "Robert ensures every policy is airtight under GDPR, CCPA, and international privacy law. He personally mandated the 2-hour auto-delete guarantee into our architecture.",
    expertise: ["GDPR / CCPA", "Data Governance", "Legal Compliance"],
    photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    accentColor: "from-slate-700 to-slate-900",
    badgeColor: "bg-slate-50 text-slate-700 border border-slate-100",
  },
]

const stats = [
  { value: "100M+",  label: "Users Served",    icon: Users },
  { value: "30M+",   label: "Files Processed", icon: FileText },
  { value: "4.6★",   label: "Avg Rating",      icon: Star },
  { value: "99.98%", label: "Uptime SLA",       icon: Server },
  { value: "256-bit",label: "Encryption",       icon: Lock },
  { value: "2 hrs",  label: "Auto-Delete",      icon: Clock },
]

const values = [
  { icon: Heart,     title: "Free, Always",       desc: "No trials. No paywalls. Core tools stay free forever.",                            gradient: "from-rose-500 to-pink-600" },
  { icon: Shield,    title: "Privacy by Design",  desc: "Files deleted within 2 hours — by architecture, not just policy.",                  gradient: "from-green-500 to-emerald-600" },
  { icon: Zap,       title: "Radical Simplicity", desc: "No account. No jargon. If a flow takes 3+ clicks, we redesign it.",                 gradient: "from-amber-500 to-yellow-600" },
  { icon: Globe,     title: "Built for Everyone",  desc: "8 languages, every device. A student in Jakarta or exec in Berlin — it works.",    gradient: "from-blue-500 to-cyan-600" },
  { icon: Target,    title: "Quality First",       desc: "Every engine benchmarked against 1,000+ real documents before release.",           gradient: "from-violet-500 to-purple-600" },
  { icon: Lightbulb, title: "User-Led Roadmap",   desc: "Real users vote on features. Your feedback shapes what we ship next.",              gradient: "from-teal-500 to-cyan-600" },
]

const milestones = [
  { year: "2018", event: "Founded by Manikant Yadav after leaving Google's document infrastructure team." },
  { year: "2019", event: "Launched with 4 tools. Hit 100,000 users in 90 days — zero advertising." },
  { year: "2020", event: "Added 8 language localizations and 256-bit file encryption." },
  { year: "2021", event: "Crossed 10M users. Launched mobile-optimized interface with a 12-person eng team." },
  { year: "2022", event: "ISO 27001 certified. Launched GDPR Compliance Center and 2-hour auto-delete." },
  { year: "2023", event: "50M users. Added image compression, WebP conversion, and batch processing." },
  { year: "2024", event: "100M+ users worldwide. 99.98% uptime. Zero major security incidents — ever." },
]

const pressLogos = ["TechCrunch", "Product Hunt", "Forbes", "Wired", "LifeHacker", "MakeUseOf"]

// ─── Founder Card (large, featured) 
const FounderCard = memo(({ member }) => (
  <div className="lg:col-span-3 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-500 group">
    <div className={`h-1.5 w-full bg-gradient-to-r ${member.accentColor}`} />
    <div className="grid md:grid-cols-[280px,1fr] gap-0">
      {/* Photo side */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 min-h-[280px] md:min-h-0">
        <img
          src={member.photo}
          alt={`${member.name} — ${member.role}, SmallPDF.us`}
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
          style={{ maxHeight: "360px" }}
          loading="eager"
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
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md ring-2 ring-gray-100">
          <img
            src={member.photo}
            alt={`${member.name} — ${member.role} at SmallPDF.us`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
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

  return (
    <>
      <SEOHead
        title="About SmallPDF.us — Our Team, Mission & Values"
        description="Meet the experts behind SmallPDF.us. Founded by Manikant Yadav — 26 engineers, designers, security specialists & privacy lawyers making PDF tools free for everyone."
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
                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">About Us</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-3">
                We built the PDF tools<br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  we always wished existed
                </span>
              </h1>

              <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-6 max-w-xl mx-auto">
                Founded by <strong className="text-white">Manikant Yadav</strong> and run by 26 engineers, designers, security experts, and privacy lawyers — united by one belief: essential document tools should be <strong className="text-white">free, fast, and truly private</strong>.
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <Link href="#team" className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold px-5 py-2.5 rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all text-sm">
                  Meet the Team <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="#mission" className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-white/15 transition-all text-sm">
                  Our Mission
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS BAR  */}
        <section className="bg-white border-b border-gray-100 py-6 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {stats.map((stat, i) => (
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
                  <Target className="w-3.5 h-3.5" /> Our Mission
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-5 leading-tight">
                  Democratizing professional document tools
                </h2>
                <div className="space-y-4 text-gray-600 leading-relaxed text-sm md:text-base">
                  <p>In 2018, Manikant Yadav left a document infrastructure role with one observation: the tools professionals use every day cost hundreds a year — yet the technology isn't expensive to build.</p>
                  <p>Students couldn't afford them. Small businesses resented monthly fees. Freelancers in emerging markets were locked out entirely.</p>
                  <p>So we built SmallPDF.us: <strong className="text-gray-900">the same quality, for free, forever</strong> — with privacy protections stronger than most paid competitors.</p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2.5">
                  {["No account required — ever", "Files deleted within 2 hours", "No ads inside conversion flows", "Transparent about how we earn", "GDPR & CCPA compliant", "Available in 8 languages"].map((item) => (
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
                      { c: "text-green-400",  t: "AUTO_DELETE  →  2 hours" },
                      { c: "text-cyan-400",   t: "STORED_COPIES →  0" },
                    ].map((line, i) => <div key={i} className={`${line.c} leading-tight`}>{line.t}</div>)}
                  </div>
                  <div className="mt-5 flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-lg px-3 py-2">
                    <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-green-300 text-xs font-bold">Zero data retention — verified by external audit</span>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl px-4 py-2.5 border border-gray-100 flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <div>
                    <div className="text-xs font-black text-gray-900">ISO 27001</div>
                    <div className="text-[10px] text-gray-500">Certified 2022</div>
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
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">What we stand for</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto">Six principles guiding every decision — from product features to privacy policy.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {values.map((v, i) => (
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
                <Users className="w-3.5 h-3.5" /> Leadership Team
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">The people behind SmallPDF.us</h2>
              <p className="text-sm text-gray-600 max-w-xl mx-auto">
                Engineers, designers, and lawyers who believe great software should be open to everyone — not locked behind a paywall.
              </p>
            </div>

            {/* Founder — full-width featured card */}
            <div className="grid lg:grid-cols-3 gap-5 mb-5">
              {founder && <FounderCard member={founder} />}
            </div>

            {/* Rest of team — 2-col then 3-col grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {restTeam.map((member, i) => (
                <TeamCard key={member.name} member={member} index={i} />
              ))}
            </div>

            <div className="mt-8 text-center">
              <div className="inline-flex flex-col sm:flex-row items-center gap-4 bg-white border border-gray-200 rounded-2xl px-7 py-4 shadow-sm">
                <p className="text-sm text-gray-600">
                  <strong className="text-gray-900">26 people</strong> across engineering, design, security, legal & support ·{" "}
                  <strong className="text-gray-900">11 countries</strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── TIMELINE  */}
        <section className="py-14 md:py-20 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                <TrendingUp className="w-3.5 h-3.5" /> Our Journey
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900">From 0 to 100M users</h2>
            </div>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-600 via-cyan-500 to-emerald-500" />
              <div className="space-y-5">
                {milestones.map((m, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="relative flex-shrink-0 z-10">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-md ring-4 ring-white group-hover:scale-110 transition-transform">
                        {m.year.slice(2)}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-xl p-3.5 flex-1 hover:shadow-md hover:border-gray-200 transition-all">
                      <span className="text-xs font-black text-blue-600 block mb-0.5">{m.year}</span>
                      <p className="text-xs text-gray-700 leading-relaxed">{m.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PRESS  */}
        <section className="py-9 px-4 bg-gray-50 border-y border-gray-100">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">As Seen In</p>
            <div className="flex flex-wrap justify-center gap-8">
              {pressLogos.map((name) => (
                <span key={name} className="text-gray-400 font-black text-lg hover:text-gray-600 transition-colors cursor-default select-none">{name}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRUST SIGNALS  */}
        <section className="py-14 md:py-20 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-gray-900 mb-2">Why you can trust us</h2>
              <p className="text-gray-500 text-sm">Credentials and certifications — not just words.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Award,       title: "ISO 27001 Certified",    desc: "Independently audited information security management since 2022.", color: "from-yellow-400 to-amber-500" },
                { icon: Shield,      title: "GDPR & CCPA Compliant",  desc: "Verified by external legal counsel. Full EU & US privacy compliance.",  color: "from-blue-500 to-blue-600" },
                { icon: Code,        title: "Bi-Annual Pen Tests",    desc: "Third-party penetration testing — reports available on request.",        color: "from-violet-500 to-purple-600" },
                { icon: CheckCircle, title: "Zero Security Incidents", desc: "No data breaches in 6 years of operation. Ever.",                      color: "from-green-500 to-emerald-600" },
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
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Ready to try the tools we built?</h2>
            <p className="text-slate-400 text-sm mb-6">No account. No credit card. No BS. Free, fast, private PDF tools.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-black px-7 py-3 rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all text-sm">
                Try SmallPDF.us Free <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="mailto:contact@smallpdf.us" className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-5 py-3 rounded-xl hover:bg-white/15 transition-all text-sm">
                <Mail className="w-4 h-4" /> Contact the Team
              </a>
            </div>
          </div>
        </section>

      </Layout>
    </>
  )
}