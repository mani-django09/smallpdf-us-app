// PromoBanner — 300x250 house banners that promote the owner's other sites. They replace the sidebar
// ad rectangles on the preview + download pages (those AdX rectangles earned <$1 eCPM).
//
//   <PromoBanner slot={0} />   first sidebar slot
//   <PromoBanner slot={1} />   second sidebar slot (always shows a DIFFERENT site than slot 0)
//
// • Each banner is the product in miniature (a drawn UI/outcome, not an icon + gradient): flat colour,
//   one memorable element, its own composition. Fonts are the ones the site already loads
//   (Plus Jakarta Sans for headlines, DM Sans for UI text, Georgia for the "human" touches).
// • No invented numbers or claims: copy comes from each site's own homepage title/description.
// • Rotation: every page view advances a sessionStorage counter by 2, so the two slots show a new pair
//   of sites on each page (5 sites → every pair gets shown). Both slots of one page share the same step.
// • Free users only: paid plans see nothing (same rule as the ads).
// • The 300x250 box is reserved in the server HTML and the banner fades in after mount (no CLS).
// • Tracking: every link carries utm_source=smallpdf.us&utm_medium=sidebar (+ utm_campaign = the page,
//   utm_content = slot) and a `promo_click` GA event is sent when gtag is available.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'

const PAID_PLANS = ['starter', 'pro', 'agency', 'enterprise']

const HEAD = "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', system-ui, sans-serif"
const UI = "'DM Sans', 'DM Sans Fallback', system-ui, sans-serif"
const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif"

// Shared pieces ---------------------------------------------------------------------------------
const headline = (color, size = 20) => ({
  fontFamily: HEAD, fontWeight: 800, fontSize: size, lineHeight: 1.1, letterSpacing: '-0.025em', color, margin: 0,
})

function Cta({ label, bg, fg }) {
  return (
    <span
      className="inline-block transition-transform duration-150 group-hover:-translate-y-px"
      style={{ background: bg, color: fg, fontFamily: UI, fontWeight: 700, fontSize: 13, lineHeight: 1, padding: '10px 14px', borderRadius: 8 }}
    >
      {label}
    </span>
  )
}

const domainStyle = (color) => ({ fontFamily: UI, fontWeight: 500, fontSize: 11, color })

// 1 ─ ShrinkVideos: the "original size" ghost frame next to the small solid one --------------------
function ShrinkVideos() {
  const ink = '#0A1F33', blue = '#0B5FFF'
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#E8F1FA', padding: '16px 16px 0' }}>
      <svg viewBox="0 0 268 100" width="268" height="100" aria-hidden="true" style={{ display: 'block' }}>
        {/* original size, drawn as a ghost */}
        <rect x="1.5" y="1.5" width="176" height="97" rx="10" fill="none" stroke={ink} strokeOpacity=".38" strokeWidth="1.5" strokeDasharray="5 5" />
        <path d="M80 36 l24 14 l-24 14 z" fill={ink} fillOpacity=".12" />
        <rect x="14" y="84" width="150" height="4" rx="2" fill={ink} fillOpacity=".1" />
        {/* after: small and solid */}
        <rect x="196" y="52" width="70" height="46" rx="8" fill={blue} />
        <path d="M224 65 l14 8 l-14 8 z" fill="#fff" />
        {/* the way down */}
        <path d="M150 30 C 178 30, 190 40, 214 46" fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" />
        <path d="M207 41.5 L215.5 46.3 L207.5 52" fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h3 style={{ ...headline(ink, 21), marginTop: 14 }}>Make video files small enough to send.</h3>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Cta label="Compress a video" bg={blue} fg="#fff" />
        <span style={domainStyle('#4B6178')}>shrinkvideos.com</span>
      </div>
    </div>
  )
}

// 2 ─ AI Humanizer: a redline edit — the stiff sentence struck out, the human one written in ----------
function Humanizer() {
  const ink = '#1B1233', violet = '#5B2EE6'
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#EFE9FF', padding: 16 }}>
      <h3 style={headline(ink, 21)}>Make AI writing sound like you wrote it.</h3>
      <div
        style={{
          marginTop: 12, background: '#fff', borderRadius: 10, padding: '10px 12px 11px',
          boxShadow: '0 1px 0 rgba(27,18,51,.05), 0 10px 20px -12px rgba(27,18,51,.35)',
        }}
      >
        <p style={{ margin: 0, fontFamily: UI, fontSize: 11.5, lineHeight: 1.35, color: '#8C85A0', textDecoration: 'line-through', textDecorationColor: '#D7365E', textDecorationThickness: 1.5 }}>
          It is important to note that this text was generated.
        </p>
        <p style={{ margin: '7px 0 0', fontFamily: SERIF, fontStyle: 'italic', fontSize: 15, lineHeight: 1.25, color: ink }}>
          This reads like a person wrote it.
        </p>
        <svg width="132" height="6" viewBox="0 0 132 6" aria-hidden="true" style={{ display: 'block', marginTop: 3 }}>
          <path d="M1 3 Q4.5 0 8 3 T15 3 T22 3 T29 3 T36 3 T43 3 T50 3 T57 3 T64 3 T71 3 T78 3 T85 3 T92 3 T99 3 T106 3 T113 3 T120 3 T127 3" fill="none" stroke={violet} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Cta label="Humanize my text" bg={violet} fg="#fff" />
        <span style={domainStyle('#6A5F8C')}>texthumanizer.site</span>
      </div>
    </div>
  )
}

// 3 ─ Invoiceo: an invoice with the tax line highlighted, bleeding off the corner ------------------
function Invoiceo() {
  const row = (name, amt) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 9.5, color: '#41524D' }}>
      <span>{name}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{amt}</span>
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0D3B33', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 16, top: 18, width: 128 }}>
        <h3 style={headline('#F2FFF9', 19)}>Invoices that work out the tax for you.</h3>
      </div>
      <div style={{ position: 'absolute', left: 16, bottom: 16 }}>
        <Cta label="Make an invoice" bg="#FFD84A" fg="#15221F" />
        <div style={{ ...domainStyle('#8FB8AD'), marginTop: 9 }}>invoiceo.app</div>
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', right: 8, bottom: -22, width: 136, height: 204, background: '#fff', borderRadius: 8,
          transform: 'rotate(4deg)', padding: '13px 12px 0', fontFamily: UI, boxShadow: '0 18px 34px -12px rgba(0,0,0,.55)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#0D3B33' }}>
          <span>Invoice</span><span style={{ color: '#8AA19B', fontWeight: 500 }}>#0042</span>
        </div>
        <div style={{ height: 1, background: '#E4ECE9', marginTop: 8 }} />
        {row('Design work', '1,000')}
        {row('Hosting', '300')}
        {row('Support', '200')}
        <div style={{ margin: '10px -5px 0', padding: '4px 5px', background: '#FFD84A', borderRadius: 3, display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontWeight: 700, color: '#1a1a1a' }}>
          <span>GST 18%</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>270</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 11, fontSize: 12.5, fontWeight: 700, color: '#0D3B33' }}>
          <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>1,770</span>
        </div>
      </div>
    </div>
  )
}

// 4 ─ Resumes-Maker: a resume page tipped on the bottom-left corner ---------------------------------
function ResumesMaker() {
  const bar = (w, c = '#D9DDEA', h = 3.5, mt = 6) => ({ height: h, width: w, background: c, borderRadius: 2, marginTop: mt })
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#14193F', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 16, right: 16, top: 16 }}>
        <h3 style={headline('#fff', 21)}>Build a resume that gets past the ATS.</h3>
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 14, bottom: -46, width: 122, height: 150, background: '#fff', borderRadius: 6,
          transform: 'rotate(-5deg)', padding: '12px 11px', boxShadow: '0 16px 30px -10px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ height: 8, width: '64%', background: '#14193F', borderRadius: 2 }} />
        <div style={{ height: 3, width: '30%', background: '#3DDBC0', borderRadius: 2, marginTop: 6 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <div style={{ width: '30%' }}>
            <div style={bar('100%', '#3DDBC0', 3, 0)} />
            <div style={bar('80%')} /><div style={bar('92%')} /><div style={bar('66%')} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={bar('100%', '#14193F', 3, 0)} />
            <div style={bar('100%')} /><div style={bar('94%')} /><div style={bar('100%')} /><div style={bar('78%')} />
            <div style={bar('100%', '#14193F', 3, 10)} />
            <div style={bar('96%')} /><div style={bar('84%')} />
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 150, right: 16, top: 84 }}>
        <p style={{ margin: 0, fontFamily: UI, fontSize: 12.5, lineHeight: 1.4, color: '#B9C0F0' }}>
          AI writing help and a live preview while you type. Free to build.
        </p>
      </div>
      <div style={{ position: 'absolute', left: 150, bottom: 16 }}>
        <Cta label="Build my resume" bg="#3DDBC0" fg="#0B1230" />
        <div style={{ ...domainStyle('#8E97D6'), marginTop: 9 }}>resumes-maker.com</div>
      </div>
    </div>
  )
}

// 5 ─ GIF Maker: a filmstrip where the dot moves a little in every frame ----------------------------
function GifMaker() {
  const ink = '#17171C', pink = '#FF4F7B'
  const frames = [0, 1, 2, 3, 4, 5]
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#FFD23F', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 16, right: 16, top: 14 }}>
        <h3 style={headline(ink, 21)}>Make a GIF from any video.</h3>
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', left: -14, right: -14, top: 70, transform: 'rotate(-3deg)', background: ink, padding: '7px 0' }}>
        <div style={{ height: 4, backgroundImage: 'repeating-linear-gradient(90deg, #FFD23F 0 7px, transparent 7px 14px)', opacity: 0.9 }} />
        <div style={{ display: 'flex', gap: 6, padding: '6px 6px', overflow: 'hidden' }}>
          {frames.map((i) => (
            <div key={i} style={{ position: 'relative', flex: '0 0 52px', height: 40, borderRadius: 4, background: i % 2 ? '#fff' : '#FFE88A', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', left: 5 + i * 6, bottom: 6 + Math.abs(2.5 - i) * -3.4 + 8, width: 13, height: 13, borderRadius: '50%', background: pink }} />
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, background: ink, opacity: 0.14 }} />
            </div>
          ))}
        </div>
        <div style={{ height: 4, backgroundImage: 'repeating-linear-gradient(90deg, #FFD23F 0 7px, transparent 7px 14px)', opacity: 0.9 }} />
      </div>
      <p style={{ position: 'absolute', left: 16, right: 16, top: 160, margin: 0, fontFamily: UI, fontWeight: 500, fontSize: 12.5, lineHeight: 1.35, color: '#3A3320' }}>
        Shows the file size before you make it.
      </p>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Cta label="Make a GIF" bg={ink} fg="#FFD23F" />
        <span style={domainStyle('#5E5322')}>onlinegifmaker.app</span>
      </div>
    </div>
  )
}

const BANNERS = [
  { id: 'shrinkvideos', domain: 'shrinkvideos.com', url: 'https://shrinkvideos.com/', aria: 'Make video files small enough to send', Art: ShrinkVideos },
  { id: 'texthumanizer', domain: 'texthumanizer.site', url: 'https://texthumanizer.site/', aria: 'Make AI writing sound like you wrote it', Art: Humanizer },
  { id: 'invoiceo', domain: 'invoiceo.app', url: 'https://invoiceo.app/', aria: 'Invoices that work out the tax for you', Art: Invoiceo },
  { id: 'resumes-maker', domain: 'resumes-maker.com', url: 'https://resumes-maker.com/', aria: 'Build a resume that gets past the ATS', Art: ResumesMaker },
  { id: 'onlinegifmaker', domain: 'onlinegifmaker.app', url: 'https://onlinegifmaker.app/', aria: 'Make a GIF from any video', Art: GifMaker },
]

// One rotation step per page view, shared by both slots of that page (guarded so React Strict Mode's
// double effect and the second slot reuse the same step).
function stepFor(path) {
  if (typeof window === 'undefined') return 0
  const cur = window.__spPromo
  if (cur && cur.path === path) return cur.n
  let n
  try {
    const stored = sessionStorage.getItem('sp_promo_n')
    n = stored === null ? Math.floor(Math.random() * BANNERS.length) : parseInt(stored, 10) || 0
    sessionStorage.setItem('sp_promo_n', String((n + 2) % BANNERS.length))
  } catch {
    n = Math.floor(Math.random() * BANNERS.length)
  }
  window.__spPromo = { path, n }
  return n
}

export default function PromoBanner({ slot = 0 }) {
  const { user } = useAuth()
  const router = useRouter()
  const isPaid = user && PAID_PLANS.includes(user.plan)
  const [idx, setIdx] = useState(-1)

  useEffect(() => {
    setIdx((stepFor(router.asPath) + slot) % BANNERS.length)
  }, [router.asPath, slot])

  if (isPaid) return null

  const box = { width: 300, height: 250, maxWidth: '100%' }
  if (idx < 0) return <div style={box} aria-hidden="true" />   // reserved space, no layout shift

  const b = BANNERS[idx]
  const parts = router.asPath.split('?')[0].split('/').filter(Boolean)
  const campaign = (parts.slice(-2).join('-') || 'home').toLowerCase().slice(0, 60)
  const href = `${b.url}?utm_source=smallpdf.us&utm_medium=sidebar&utm_campaign=${encodeURIComponent(campaign)}&utm_content=slot${slot + 1}`

  const onClick = () => {
    try { window.gtag && window.gtag('event', 'promo_click', { promo: b.id, slot: slot + 1, page: router.asPath.split('?')[0] }) } catch {}
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      onClick={onClick}
      aria-label={`${b.aria} - ${b.domain}`}
      className="promo-fade group relative block overflow-hidden rounded-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      style={{ ...box, boxShadow: '0 0 0 1px rgba(15,23,42,.08)' }}
    >
      <b.Art />
    </a>
  )
}
