// pages/auth/login.js — Ultra Premium Redesign

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import Script from 'next/script'
import { useAuth } from '../../context/AuthContext'
import { useTranslations } from '../../lib/i18n'
import { getPageMessages } from '../../lib/i18nLoader'
import { safeRedirect } from "../../lib/safeRedirect"

const FEATURES = [
  { icon: '⚡', text: 'Convert PDFs in seconds' },
  { icon: '🔒', text: 'Bank-grade encryption' },
  { icon: '🌍', text: '27 tools, 8 languages' },
  { icon: '♾️', text: 'Free to start, no watermarks' },
]

function Logo() {
  return (
    <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="9" fill="#DC2626"/>
        <path d="M9 8h9l6 6v10a1 1 0 01-1 1H9a1 1 0 01-1-1V9a1 1 0 011-1z" fill="white" fillOpacity="0.95"/>
        <path d="M18 8l6 6h-5a1 1 0 01-1-1V8z" fill="white" fillOpacity="0.45"/>
        <path d="M12 17h8M12 20h6" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span style={{ fontWeight: 800, fontSize: 22, color: '#0f172a', letterSpacing: '-0.6px', fontFamily: 'system-ui' }}>
        Small<span style={{ color: '#DC2626' }}>PDF</span><span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 15 }}>.us</span>
      </span>
    </Link>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWithGoogle } = useAuth()
  const { t } = useTranslations()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [focused, setFocused] = useState('')
  const [showPass, setShowPass] = useState(false)

  const redirect = safeRedirect(router.query.redirect)
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  useEffect(() => {
    let cancelled = false, attempts = 0
    const tryInit = () => {
      if (cancelled) return true
      const btn = document.getElementById('google-login-btn')
      if (!window.google || !btn) return false
      try {
        window.google.accounts.id.initialize({ client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, callback: handleGoogleSuccess })
        window.google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', width: 360, text: 'continue_with' })
        if (!cancelled) setGoogleReady(true)
      } catch (e) {}
      return true
    }
    if (!tryInit()) {
      const interval = setInterval(() => { attempts++; if (tryInit() || attempts >= 50) clearInterval(interval) }, 100)
      return () => { cancelled = true; clearInterval(interval) }
    }
    return () => { cancelled = true }
  }, [])

  const handleGoogleSuccess = async (response) => {
    setError(''); setLoading(true)
    try { await loginWithGoogle(response.credential); router.push(redirect) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true); setShowResend(false)
    try { await login({ email: form.email, password: form.password }); router.push(redirect) }
    catch (err) { setError(err.message); if (err.message.toLowerCase().includes('verify')) setShowResend(true) }
    finally { setLoading(false) }
  }

  const handleResend = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'}/api/auth/resend-verification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email }),
      })
      const data = await res.json()
      setError(''); setShowResend(false); alert(data.message || 'Verification email sent!')
    } catch { setError('Failed to resend verification email.') }
  }

  return (
    <>
      <Head>
        <title>{t('auth.login.pageTitle')}</title>
        <meta name="description" content={t('auth.login.metaDesc')} />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; }
          .auth-input { transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; }
          .auth-input:focus { border-color: #DC2626 !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.12) !important; background: #fff !important; outline: none; }
          .auth-btn { transition: all 0.2s; }
          .auth-btn:hover:not(:disabled) { background: #b91c1c !important; box-shadow: 0 4px 20px rgba(220,38,38,0.35) !important; transform: translateY(-1px); }
          .auth-btn:active:not(:disabled) { transform: translateY(0); }
          .google-btn-wrap { transition: all 0.2s; }
          .google-btn-wrap:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; }
          .feat-item { animation: fadeSlideIn 0.5s ease forwards; opacity: 0; }
          @keyframes fadeSlideIn { from { opacity:0; transform: translateX(-16px); } to { opacity:1; transform: translateX(0); } }
          .float-orb { animation: floatOrb 6s ease-in-out infinite; }
          @keyframes floatOrb { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-20px) scale(1.04); } }
          .float-orb2 { animation: floatOrb 8s ease-in-out infinite reverse; }
          .resend-link { color: #DC2626; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; text-decoration: underline; padding: 0; font-family: inherit; }
          .resend-link:hover { color: #b91c1c; }
          .eye-btn { background: none; border: none; cursor: pointer; padding: 0; color: #9ca3af; display: flex; align-items: center; }
          .eye-btn:hover { color: #6b7280; }
          @media (max-width: 768px) { .panel-left { display: none !important; } .panel-right { width: 100% !important; } }
        `}</style>
      </Head>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── Left Panel: Branding ── */}
        <div className="panel-left" style={{
          width: '45%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: '60px 48px', position: 'relative', overflow: 'hidden'
        }}>
          {/* Decorative orbs */}
          <div className="float-orb" style={{ position: 'absolute', top: '10%', right: '-80px', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,38,38,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div className="float-orb2" style={{ position: 'absolute', bottom: '15%', left: '-60px', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,38,38,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Grid pattern */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }}>
            {/* Logo */}
            <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', marginBottom: 56 }}>
              <span style={{ fontWeight: 800, fontSize: 28, color: '#fff', letterSpacing: '-0.5px' }}>
                Small<span style={{ color: '#f87171' }}>PDF</span><span style={{ color: '#64748b', fontWeight: 400, fontSize: 20 }}>.us</span>
              </span>
            </Link>

            <h2 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 12px', lineHeight: 1.15, letterSpacing: '-0.5px' }}>
              Your PDF toolkit,<br /><span style={{ color: '#f87171' }}>always free.</span>
            </h2>
            <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 48px', lineHeight: 1.6 }}>
              All 27 PDF &amp; image tools — quick and easy to use.
            </p>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {FEATURES.map((f, i) => (
                <div key={i} className="feat-item" style={{ display: 'flex', alignItems: 'center', gap: 16, animationDelay: `${i * 0.1}s` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <span style={{ fontSize: 15, color: '#cbd5e1', fontWeight: 500 }}>{f.text}</span>
                </div>
              ))}
            </div>

            {/* Real facts */}
            <div style={{ marginTop: 56, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: 16 }}>●</span>
                27 PDF &amp; image tools, all free
              </p>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: 16 }}>●</span>
                Files deleted within 1 hour
              </p>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Form ── */}
        <div className="panel-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', overflow: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>

            {/* Mobile logo only */}
            <div style={{ display: 'none', justifyContent: 'center', marginBottom: 32 }} className="mobile-logo">
              <Logo />
            </div>

            {/* Header */}
            <div style={{ marginBottom: 36 }}>
              <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                {t('auth.login.heading')}
              </h1>
              <p style={{ fontSize: 15, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {t('auth.login.subheading')}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                  <span style={{ fontSize: 14, color: '#dc2626', lineHeight: 1.5 }}>{error}</span>
                </div>
                {showResend && (
                  <button onClick={handleResend} className="resend-link" style={{ alignSelf: 'flex-start', marginLeft: 26 }}>
                    {t('auth.login.resendVerification')}
                  </button>
                )}
              </div>
            )}

            {/* Google Sign In */}
            <div className="google-btn-wrap" style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 20 }}>
              <div id="google-login-btn" style={{ width: '100%', minHeight: 48, display: 'flex', justifyContent: 'center', alignItems: 'center' }} />
              {!googleReady && (
                <div style={{ height: 48, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <GoogleIcon />
                  <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>Continue with Google</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {t('auth.login.orContinue')}
              </span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', letterSpacing: '0.01em' }}>
                  {t('auth.login.emailLabel')}
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'email' ? '#DC2626' : '#9ca3af', transition: 'color 0.2s', pointerEvents: 'none' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <input
                    type="email" name="email" value={form.email} onChange={handleChange}
                    placeholder={t('auth.login.emailPlaceholder')} required
                    className="auth-input"
                    onFocus={() => setFocused('email')} onBlur={() => setFocused('')}
                    style={{ width: '100%', paddingLeft: 42, paddingRight: 14, paddingTop: 13, paddingBottom: 13, border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 15, color: '#0f172a', background: '#f8fafc', fontFamily: 'inherit' }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', letterSpacing: '0.01em' }}>
                    {t('auth.login.passwordLabel')}
                  </label>
                  <Link href="/auth/forgot-password" style={{ fontSize: 12, color: '#DC2626', textDecoration: 'none', fontWeight: 600 }}>
                    {t('auth.login.forgotPassword')}
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'password' ? '#DC2626' : '#9ca3af', transition: 'color 0.2s', pointerEvents: 'none' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange}
                    placeholder={t('auth.login.passwordPlaceholder')} required
                    className="auth-input"
                    onFocus={() => setFocused('password')} onBlur={() => setFocused('')}
                    style={{ width: '100%', paddingLeft: 42, paddingRight: 46, paddingTop: 13, paddingBottom: 13, border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 15, color: '#0f172a', background: '#f8fafc', fontFamily: 'inherit' }}
                    autoComplete="current-password"
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                    {showPass
                      ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="auth-btn"
                style={{ background: loading ? '#6b7280' : '#DC2626', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : '0 2px 12px rgba(220,38,38,0.25)', fontFamily: 'inherit', letterSpacing: '0.01em' }}>
                {loading ? (
                  <>
                    <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                      <path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/>
                    </svg>
                    {t('auth.login.loadingBtn')}
                  </>
                ) : t('auth.login.submitBtn')}
              </button>
            </form>

            {/* Switch */}
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: 14, marginTop: 28 }}>
              {t('auth.login.noAccount')}{' '}
              <Link href="/auth/signup" style={{ color: '#DC2626', textDecoration: 'none', fontWeight: 700 }}>
                {t('auth.login.signupLink')}
              </Link>
            </p>

            {/* Security note */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, color: '#94a3b8', fontSize: 12 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Secured with 256-bit SSL encryption</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .mobile-logo { display: flex !important; } }
      `}</style>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["auth"]) },
    revalidate: 86400,
  }
}
