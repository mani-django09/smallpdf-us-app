// pages/auth/login.js

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import Script from 'next/script'
import { useAuth } from '../../context/AuthContext'
import { useTranslations } from '../../lib/i18n'

function Logo() {
  return (
    <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#DC2626"/>
        <path d="M9 8h9l6 6v10a1 1 0 01-1 1H9a1 1 0 01-1-1V9a1 1 0 011-1z" fill="white" fillOpacity="0.9"/>
        <path d="M18 8l6 6h-5a1 1 0 01-1-1V8z" fill="white" fillOpacity="0.5"/>
        <path d="M12 17h8M12 20h6" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span style={{ fontWeight: 800, fontSize: 20, color: '#111827', letterSpacing: '-0.5px' }}>
        Small<span style={{ color: '#DC2626' }}>PDF</span><span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 14 }}>.us</span>
      </span>
    </Link>
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

  const redirect = router.query.redirect || '/'
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  useEffect(() => {
    if (!googleReady || !window.google) return
    window.google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: handleGoogleSuccess,
    })
    window.google.accounts.id.renderButton(
      document.getElementById('google-login-btn'),
      { theme: 'outline', size: 'large', width: 348, text: 'continue_with' }
    )
  }, [googleReady])

  const handleGoogleSuccess = async (response) => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle(response.credential)
      router.push(redirect)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setShowResend(false)
    try {
      await login({ email: form.email, password: form.password })
      router.push(redirect)
    } catch (err) {
      setError(err.message)
      if (err.message.toLowerCase().includes('verify')) setShowResend(true)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      })
      const data = await res.json()
      setError('')
      setShowResend(false)
      alert(data.message || t('auth.login.resendVerification'))
    } catch {
      setError('Failed to resend verification email.')
    }
  }

  return (
    <>
      <Head>
        <title>{t('auth.login.pageTitle')}</title>
        <meta name="description" content={t('auth.login.metaDesc')} />
      </Head>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleReady(true)}
      />

      <div style={styles.page}>
        <div style={styles.card}>

          <div style={styles.logoWrap}><Logo /></div>

          <h1 style={styles.title}>{t('auth.login.heading')}</h1>
          <p style={styles.subtitle}>{t('auth.login.subheading')}</p>

          {error && (
            <div style={styles.errorBox}>
              {error}
              {showResend && (
                <button onClick={handleResend} style={styles.resendBtn}>
                  {t('auth.login.resendVerification')}
                </button>
              )}
            </div>
          )}

          <div style={{ marginBottom: 4 }}>
            <div id="google-login-btn" style={{ width: '100%', minHeight: 44, display: 'flex', justifyContent: 'center' }} />
            {!googleReady && (
              <div style={styles.googlePlaceholder}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                <span style={{ fontSize: 14, color: '#6b7280' }}>{t('auth.login.googleLoading')}</span>
              </div>
            )}
          </div>

          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>{t('auth.login.orContinue')}</span>
            <div style={styles.dividerLine} />
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>{t('auth.login.emailLabel')}</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder={t('auth.login.emailPlaceholder')} required style={styles.input} autoComplete="email" />
            </div>

            <div style={styles.field}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={styles.label}>{t('auth.login.passwordLabel')}</label>
                <Link href="/auth/forgot-password" style={styles.forgotLink}>{t('auth.login.forgotPassword')}</Link>
              </div>
              <input type="password" name="password" value={form.password} onChange={handleChange} placeholder={t('auth.login.passwordPlaceholder')} required style={styles.input} autoComplete="current-password" />
            </div>

            <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? t('auth.login.loadingBtn') : t('auth.login.submitBtn')}
            </button>
          </form>

          <p style={styles.switchText}>
            {t('auth.login.noAccount')}{' '}
            <Link href="/auth/signup" style={styles.link}>{t('auth.login.signupLink')}</Link>
          </p>
        </div>
      </div>
    </>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
  card: { background: '#fff', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 6px', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6b7280', margin: '0 0 20px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 500, color: '#374151' },
  input: { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 15, outline: 'none', color: '#111827' },
  btn: { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '12px 14px', fontSize: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  resendBtn: { background: 'none', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' },
  googlePlaceholder: { height: 44, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' },
  dividerLine: { flex: 1, height: 1, background: '#e5e7eb' },
  dividerText: { color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' },
  switchText: { textAlign: 'center', color: '#6b7280', fontSize: 14, marginTop: 20 },
  link: { color: '#DC2626', textDecoration: 'none', fontWeight: 600 },
  forgotLink: { color: '#DC2626', textDecoration: 'none', fontSize: 13 },
}