// pages/auth/signup.js

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

export default function SignupPage() {
  const router = useRouter()
  const { signup, loginWithGoogle } = useAuth()
  const { t } = useTranslations()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  useEffect(() => {
    if (!googleReady || !window.google) return
    window.google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: handleGoogleSuccess,
    })
    window.google.accounts.id.renderButton(
      document.getElementById('google-signup-btn'),
      { theme: 'outline', size: 'large', width: 348, text: 'signup_with' }
    )
  }, [googleReady])

  const handleGoogleSuccess = async (response) => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle(response.credential)
      router.push('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (form.password !== form.confirmPassword) return setError(t('auth.signup.mismatchError') || 'Passwords do not match')
    setLoading(true)
    try {
      const data = await signup({ name: form.name, email: form.email, password: form.password })
      setSuccess(data.message || t('auth.signup.successTitle'))
      setForm({ name: '', email: '', password: '', confirmPassword: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '' }
    let score = 0
    if (pwd.length >= 8) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    const labels = ['', t('auth.signup.strengthWeak'), t('auth.signup.strengthFair'), t('auth.signup.strengthGood'), t('auth.signup.strengthStrong')]
    const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']
    return { score, label: labels[score], color: colors[score] }
  }

  const strength = getStrength(form.password)

  return (
    <>
      <Head>
        <title>{t('auth.signup.pageTitle')}</title>
        <meta name="description" content={t('auth.signup.metaDesc')} />
      </Head>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleReady(true)}
      />

      <div style={styles.page}>
        <div style={styles.card}>

          <div style={styles.logoWrap}><Logo /></div>

          <h1 style={styles.title}>{t('auth.signup.heading')}</h1>
          <p style={styles.subtitle}>{t('auth.signup.subheading')}</p>

          {success ? (
            <div style={styles.successBox}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
              <h3 style={{ margin: '0 0 8px', color: '#065f46' }}>{t('auth.signup.successTitle')}</h3>
              <p style={{ margin: 0, color: '#047857', fontSize: 14, lineHeight: 1.6 }}>{success}</p>
              <Link href="/auth/login" style={{ ...styles.link, display: 'inline-block', marginTop: 16 }}>
                {t('auth.signup.successGoLogin')}
              </Link>
            </div>
          ) : (
            <>
              {error && <div style={styles.errorBox}>{error}</div>}

              <div style={{ marginBottom: 4 }}>
                <div id="google-signup-btn" style={{ width: '100%', minHeight: 44, display: 'flex', justifyContent: 'center' }} />
                {!googleReady && (
                  <div style={styles.googlePlaceholder}>
                    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                    <span style={{ fontSize: 14, color: '#6b7280' }}>{t('auth.signup.googleLoading')}</span>
                  </div>
                )}
              </div>

              <div style={styles.divider}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>{t('auth.signup.orSignUp')}</span>
                <div style={styles.dividerLine} />
              </div>

              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>{t('auth.signup.nameLabel')}</label>
                  <input type="text" name="name" value={form.name} onChange={handleChange} placeholder={t('auth.signup.namePlaceholder')} required style={styles.input} autoComplete="name" />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>{t('auth.signup.emailLabel')}</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} placeholder={t('auth.signup.emailPlaceholder')} required style={styles.input} autoComplete="email" />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>{t('auth.signup.passwordLabel')}</label>
                  <input type="password" name="password" value={form.password} onChange={handleChange} placeholder={t('auth.signup.passwordPlaceholder')} required minLength={8} style={styles.input} autoComplete="new-password" />
                  {form.password && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(strength.score / 4) * 100}%`, height: '100%', background: strength.color, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 12, color: strength.color, fontWeight: 500 }}>{strength.label}</span>
                    </div>
                  )}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>{t('auth.signup.confirmPasswordLabel')}</label>
                  <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder={t('auth.signup.confirmPasswordPlaceholder')} required style={{ ...styles.input, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? '#ef4444' : undefined }} autoComplete="new-password" />
                </div>

                <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading ? t('auth.signup.loadingBtn') : t('auth.signup.submitBtn')}
                </button>

                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', margin: 0 }}>
                  {t('auth.signup.termsText')}{' '}
                  <Link href="/terms" style={{ color: '#6b7280' }}>{t('auth.signup.termsLink')}</Link>{' '}
                  {t('auth.signup.andText')}{' '}
                  <Link href="/privacy" style={{ color: '#6b7280' }}>{t('auth.signup.privacyLink')}</Link>
                </p>
              </form>

              <p style={styles.switchText}>
                {t('auth.signup.hasAccount')}{' '}
                <Link href="/auth/login" style={styles.link}>{t('auth.signup.loginLink')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
  card: { background: '#fff', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 6px', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', margin: '0 0 20px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 500, color: '#374151' },
  input: { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 15, outline: 'none', color: '#111827' },
  btn: { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '12px 14px', fontSize: 14, marginBottom: 12 },
  successBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '28px', textAlign: 'center' },
  googlePlaceholder: { height: 44, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' },
  dividerLine: { flex: 1, height: 1, background: '#e5e7eb' },
  dividerText: { color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' },
  switchText: { textAlign: 'center', color: '#6b7280', fontSize: 14, marginTop: 20 },
  link: { color: '#DC2626', textDecoration: 'none', fontWeight: 600 },
}