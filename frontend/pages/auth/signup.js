// pages/auth/signup.js — Ultra Premium Redesign

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import Script from 'next/script'
import { useAuth } from '../../context/AuthContext'
import { useTranslations } from '../../lib/i18n'
import { getPageMessages } from '../../lib/i18nLoader'
import { safeRedirect } from "../../lib/safeRedirect"

const PERKS = [
  { icon: '🚀', text: 'Instant access — no waiting' },
  { icon: '🔐', text: 'Your files auto-deleted in 1hr' },
  { icon: '📦', text: '27 PDF & image tools' },
  { icon: '💳', text: 'Free to start, no credit card' },
]

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

const strengthConfig = [
  { label: '', color: '' },
  { label: 'Weak', color: '#ef4444' },
  { label: 'Fair', color: '#f59e0b' },
  { label: 'Good', color: '#3b82f6' },
  { label: 'Strong', color: '#22c55e' },
]

export default function SignupPage() {
  const router = useRouter()
  const { signup, loginWithGoogle } = useAuth()
  const { t } = useTranslations()
  const redirect = safeRedirect(router.query.redirect)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [focused, setFocused] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  useEffect(() => {
    let cancelled = false, attempts = 0
    const tryInit = () => {
      if (cancelled) return true
      const btn = document.getElementById('google-signup-btn')
      if (!window.google || !btn) return false
      try {
        window.google.accounts.id.initialize({ client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, callback: handleGoogleSuccess })
        window.google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', width: 360, text: 'signup_with' })
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
    e.preventDefault(); setError(''); setSuccess('')
    if (form.password !== form.confirmPassword) return setError(t('auth.signup.mismatchError') || 'Passwords do not match')
    setLoading(true)
    try {
      const data = await signup({ name: form.name, email: form.email, password: form.password })
      setForm({ name: '', email: '', password: '', confirmPassword: '' })
      // Signup already returns a working token, so someone who came here from a
      // paid-plan CTA can go straight on to checkout. Showing them the "check
      // your email" screen instead used to strand them: the only way onward was
      // "Go to login", and login refuses unverified accounts.
      if (redirect && redirect !== '/') {
        router.push(redirect)
        return
      }
      setSuccess(data.message || t('auth.signup.successTitle'))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const getStrength = (pwd) => {
    if (!pwd) return 0
    let s = 0
    if (pwd.length >= 8) s++
    if (/[A-Z]/.test(pwd)) s++
    if (/[0-9]/.test(pwd)) s++
    if (/[^A-Za-z0-9]/.test(pwd)) s++
    return s
  }

  const strength = getStrength(form.password)
  const passwordMatch = form.confirmPassword && form.password === form.confirmPassword

  return (
    <>
      <Head>
        <title>{t('auth.signup.pageTitle')}</title>
        <meta name="description" content={t('auth.signup.metaDesc')} />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; }
          .auth-input { transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; }
          .auth-input:focus { border-color: #DC2626 !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.12) !important; background: #fff !important; outline: none; }
          .auth-btn { transition: all 0.2s; }
          .auth-btn:hover:not(:disabled) { background: #b91c1c !important; box-shadow: 0 4px 20px rgba(220,38,38,0.35) !important; transform: translateY(-1px); }
          .google-btn-wrap { transition: all 0.2s; }
          .google-btn-wrap:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; }
          .feat-item { animation: fadeSlideIn 0.5s ease forwards; opacity: 0; }
          @keyframes fadeSlideIn { from { opacity:0; transform: translateX(-16px); } to { opacity:1; transform: translateX(0); } }
          .float-orb { animation: floatOrb 6s ease-in-out infinite; }
          @keyframes floatOrb { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-20px) scale(1.04); } }
          .float-orb2 { animation: floatOrb 8s ease-in-out infinite reverse; }
          .eye-btn { background: none; border: none; cursor: pointer; padding: 0; color: #9ca3af; display: flex; align-items: center; }
          .eye-btn:hover { color: #6b7280; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes successPop { from { opacity:0; transform: scale(0.95) translateY(8px); } to { opacity:1; transform: scale(1) translateY(0); } }
          .success-card { animation: successPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
          .strength-seg { border-radius: 4px; height: 4px; transition: all 0.3s; }
          @media (max-width: 768px) { .panel-left { display: none !important; } .panel-right { width: 100% !important; } }
        `}</style>
      </Head>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── Left Panel ── */}
        <div className="panel-left" style={{
          width: '42%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: '60px 44px', position: 'relative', overflow: 'hidden'
        }}>
          <div className="float-orb" style={{ position: 'absolute', top: '8%', right: '-80px', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,38,38,0.22) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div className="float-orb2" style={{ position: 'absolute', bottom: '12%', left: '-60px', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,38,38,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 360 }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', marginBottom: 52 }}>
              <span style={{ fontWeight: 800, fontSize: 26, color: '#fff', letterSpacing: '-0.5px' }}>
                Small<span style={{ color: '#f87171' }}>PDF</span><span style={{ color: '#64748b', fontWeight: 400, fontSize: 18 }}>.us</span>
              </span>
            </Link>

            <div style={{ marginBottom: 48 }}>
              <h2 style={{ fontSize: 34, fontWeight: 800, color: '#fff', margin: '0 0 12px', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
                Create your<br /><span style={{ color: '#f87171' }}>free account</span>
              </h2>
              <p style={{ fontSize: 16, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                No subscription. No credit card. Just powerful PDF tools at your fingertips.
              </p>
            </div>

            {/* Perks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {PERKS.map((p, i) => (
                <div key={i} className="feat-item" style={{ display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i * 0.1}s` }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                    {p.icon}
                  </div>
                  <span style={{ fontSize: 14, color: '#cbd5e1', fontWeight: 500 }}>{p.text}</span>
                </div>
              ))}
            </div>

            {/* Real facts */}
            <div style={{ marginTop: 48, background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: 16 }}>●</span>
                27 PDF &amp; image tools — all free
              </p>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: 16 }}>●</span>
                Files deleted automatically within 1 hour
              </p>
              <p style={{ fontSize: 13, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: 16 }}>●</span>
                No credit card required
              </p>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Form ── */}
        <div className="panel-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '32px 24px', overflow: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>

            {/* Header */}
            {!success && (
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
                  {t('auth.signup.heading')}
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>{t('auth.signup.subheading')}</p>
              </div>
            )}

            {/* ── SUCCESS STATE ── */}
            {success ? (
              <div className="success-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1.5px solid #86efac', borderRadius: 20, padding: '40px 32px', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(34,197,94,0.3)' }}>
                  <svg width="32" height="32" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#15803d', margin: '0 0 10px' }}>
                  {t('auth.signup.successTitle')}
                </h2>
                <p style={{ fontSize: 15, color: '#16a34a', margin: '0 0 24px', lineHeight: 1.6 }}>{success}</p>
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                  Check your inbox — link expires in 24 hours
                </div>
                <Link href={redirect !== '/' ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : '/auth/login'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#15803d', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14 }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10,17 15,12 10,7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  {t('auth.signup.successGoLogin')}
                </Link>
              </div>
            ) : (
              <>
                {/* Error */}
                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
                    <span style={{ fontSize: 13.5, color: '#dc2626', lineHeight: 1.5 }}>{error}</span>
                  </div>
                )}

                {/* Google */}
                <div className="google-btn-wrap" style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 18 }}>
                  <div id="google-signup-btn" style={{ width: '100%', minHeight: 48, display: 'flex', justifyContent: 'center', alignItems: 'center' }} />
                  {!googleReady && (
                    <div style={{ height: 48, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <GoogleIcon />
                      <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>Sign up with Google</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{t('auth.signup.orSignUp')}</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Name */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('auth.signup.nameLabel')}</label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused === 'name' ? '#DC2626' : '#9ca3af', transition: 'color 0.2s', pointerEvents: 'none' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <input type="text" name="name" value={form.name} onChange={handleChange}
                        placeholder={t('auth.signup.namePlaceholder')} required className="auth-input"
                        onFocus={() => setFocused('name')} onBlur={() => setFocused('')}
                        style={{ width: '100%', paddingLeft: 40, paddingRight: 14, paddingTop: 12, paddingBottom: 12, border: '1.5px solid #e2e8f0', borderRadius: 11, fontSize: 14.5, color: '#0f172a', background: '#f8fafc', fontFamily: 'inherit' }}
                        autoComplete="name" />
                    </div>
                  </div>

                  {/* Email */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('auth.signup.emailLabel')}</label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused === 'email' ? '#DC2626' : '#9ca3af', transition: 'color 0.2s', pointerEvents: 'none' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      </div>
                      <input type="email" name="email" value={form.email} onChange={handleChange}
                        placeholder={t('auth.signup.emailPlaceholder')} required className="auth-input"
                        onFocus={() => setFocused('email')} onBlur={() => setFocused('')}
                        style={{ width: '100%', paddingLeft: 40, paddingRight: 14, paddingTop: 12, paddingBottom: 12, border: '1.5px solid #e2e8f0', borderRadius: 11, fontSize: 14.5, color: '#0f172a', background: '#f8fafc', fontFamily: 'inherit' }}
                        autoComplete="email" />
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('auth.signup.passwordLabel')}</label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused === 'password' ? '#DC2626' : '#9ca3af', transition: 'color 0.2s', pointerEvents: 'none' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      </div>
                      <input type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange}
                        placeholder={t('auth.signup.passwordPlaceholder')} required minLength={8} className="auth-input"
                        onFocus={() => setFocused('password')} onBlur={() => setFocused('')}
                        style={{ width: '100%', paddingLeft: 40, paddingRight: 44, paddingTop: 12, paddingBottom: 12, border: '1.5px solid #e2e8f0', borderRadius: 11, fontSize: 14.5, color: '#0f172a', background: '#f8fafc', fontFamily: 'inherit' }}
                        autoComplete="new-password" />
                      <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}
                        style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }}>
                        {showPass ? <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                      </button>
                    </div>

                    {/* Strength meter */}
                    {form.password && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[1,2,3,4].map(i => (
                            <div key={i} className="strength-seg" style={{ flex: 1, background: i <= strength ? strengthConfig[strength].color : '#e2e8f0' }} />
                          ))}
                        </div>
                        <p style={{ fontSize: 11.5, color: strengthConfig[strength].color, margin: '5px 0 0', fontWeight: 600 }}>
                          {['', 'Weak — add numbers & symbols', 'Fair — add uppercase letters', 'Good — almost there!', '✓ Strong password'][strength]}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('auth.signup.confirmPasswordLabel')}</label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused === 'confirm' ? '#DC2626' : '#9ca3af', transition: 'color 0.2s', pointerEvents: 'none' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                      </div>
                      <input type={showConfirm ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={handleChange}
                        placeholder={t('auth.signup.confirmPasswordPlaceholder')} required className="auth-input"
                        onFocus={() => setFocused('confirm')} onBlur={() => setFocused('')}
                        style={{ width: '100%', paddingLeft: 40, paddingRight: 44, paddingTop: 12, paddingBottom: 12, borderRadius: 11, fontSize: 14.5, color: '#0f172a', background: '#f8fafc', fontFamily: 'inherit',
                          border: form.confirmPassword ? `1.5px solid ${passwordMatch ? '#22c55e' : '#ef4444'}` : '1.5px solid #e2e8f0' }}
                        autoComplete="new-password" />
                      <button type="button" className="eye-btn" onClick={() => setShowConfirm(!showConfirm)}
                        style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }}>
                        {showConfirm ? <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                      </button>
                      {form.confirmPassword && (
                        <div style={{ position: 'absolute', right: 42, top: '50%', transform: 'translateY(-50%)' }}>
                          {passwordMatch
                            ? <svg width="15" height="15" fill="none" stroke="#22c55e" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
                            : <svg width="15" height="15" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                        </div>
                      )}
                    </div>
                    {form.confirmPassword && !passwordMatch && (
                      <p style={{ fontSize: 11.5, color: '#ef4444', margin: '2px 0 0', fontWeight: 500 }}>Passwords don't match</p>
                    )}
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={loading} className="auth-btn"
                    style={{ background: loading ? '#6b7280' : '#DC2626', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : '0 2px 12px rgba(220,38,38,0.25)', fontFamily: 'inherit', marginTop: 4 }}>
                    {loading ? (
                      <><svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>{t('auth.signup.loadingBtn')}</>
                    ) : <>{t('auth.signup.submitBtn')}</>}
                  </button>

                  {/* Terms */}
                  <p style={{ fontSize: 11.5, color: '#9ca3af', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                    {t('auth.signup.termsText')}{' '}
                    <Link href="/terms" style={{ color: '#64748b', textDecoration: 'underline' }}>{t('auth.signup.termsLink')}</Link>{' '}
                    {t('auth.signup.andText')}{' '}
                    <Link href="/privacy" style={{ color: '#64748b', textDecoration: 'underline' }}>{t('auth.signup.privacyLink')}</Link>
                  </p>
                </form>

                <p style={{ textAlign: 'center', color: '#64748b', fontSize: 14, marginTop: 20 }}>
                  {t('auth.signup.hasAccount')}{' '}
                  <Link href={redirect !== '/' ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : '/auth/login'} style={{ color: '#DC2626', textDecoration: 'none', fontWeight: 700 }}>
                    {t('auth.signup.loginLink')}
                  </Link>
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, color: '#94a3b8', fontSize: 12 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Your data is encrypted & never shared</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["auth"]) },
    revalidate: 86400,
  }
}
