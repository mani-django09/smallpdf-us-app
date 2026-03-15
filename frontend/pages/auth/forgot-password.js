// pages/auth/forgot-password.js

import { useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { useAuth } from '../../context/AuthContext'
import { useTranslations } from '../../lib/i18n'

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const { t } = useTranslations()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>{t('auth.forgotPassword.pageTitle')}</title>
      </Head>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <Link href="/" style={{ textDecoration: 'none', color: '#DC2626', fontWeight: 700, fontSize: 22 }}>
              📄 SmallPDF.us
            </Link>
          </div>

          {submitted ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h2 style={{ color: '#111827', margin: '0 0 10px' }}>{t('auth.forgotPassword.sentTitle')}</h2>
              <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 24px', lineHeight: 1.6 }}>
                {t('auth.forgotPassword.sentDesc')} <strong>{email}</strong>, {t('auth.forgotPassword.sentDescSuffix')}
              </p>
              <Link href="/auth/login" style={styles.link}>{t('auth.forgotPassword.backToLogin')}</Link>
            </div>
          ) : (
            <>
              <h1 style={styles.title}>{t('auth.forgotPassword.heading')}</h1>
              <p style={styles.subtitle}>{t('auth.forgotPassword.subheading')}</p>

              {error && <div style={styles.errorBox}>{error}</div>}

              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>{t('auth.forgotPassword.emailLabel')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.forgotPassword.emailPlaceholder')}
                    required
                    style={styles.input}
                  />
                </div>
                <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
                  {loading ? t('auth.forgotPassword.loadingBtn') : t('auth.forgotPassword.submitBtn')}
                </button>
              </form>

              <p style={styles.switchText}>
                <Link href="/auth/login" style={styles.link}>{t('auth.forgotPassword.backToLogin')}</Link>
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
  card: { background: '#fff', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  logo: { textAlign: 'center', marginBottom: 28 },
  title: { fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 6px', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', margin: '0 0 24px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 500, color: '#374151' },
  input: { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 15, outline: 'none', color: '#111827' },
  btn: { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '12px 14px', fontSize: 14, marginBottom: 4 },
  switchText: { textAlign: 'center', marginTop: 20 },
  link: { color: '#DC2626', textDecoration: 'none', fontWeight: 600, fontSize: 14 },
}