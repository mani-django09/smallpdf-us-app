// pages/auth/reset-password.js

import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { useAuth } from '../../context/AuthContext'
import { useTranslations } from '../../lib/i18n'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { resetPassword } = useAuth()
  const { t } = useTranslations()
  const { token } = router.query

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) return setError(t('auth.resetPassword.mismatchError'))

    setLoading(true)
    try {
      const data = await resetPassword({ token, password: form.password })
      setSuccess(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>{t('auth.resetPassword.pageTitle')}</title></Head>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <Link href="/" style={{ textDecoration: 'none', color: '#DC2626', fontWeight: 700, fontSize: 22 }}>
              📄 SmallPDF.us
            </Link>
          </div>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ color: '#111827', margin: '0 0 10px' }}>{t('auth.resetPassword.successTitle')}</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>{success}</p>
              <Link href="/auth/login">
                <button style={styles.btn}>{t('auth.resetPassword.successGoLogin')}</button>
              </Link>
            </div>
          ) : (
            <>
              <h1 style={styles.title}>{t('auth.resetPassword.heading')}</h1>
              <p style={styles.subtitle}>{t('auth.resetPassword.subheading')}</p>

              {error && <div style={styles.errorBox}>{error}</div>}
              {!token && <div style={styles.errorBox}>{t('auth.resetPassword.invalidLink')}</div>}

              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>{t('auth.resetPassword.newPasswordLabel')}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                    required
                    minLength={8}
                    disabled={!token}
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{t('auth.resetPassword.confirmPasswordLabel')}</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                    required
                    disabled={!token}
                    style={styles.input}
                  />
                </div>
                <button type="submit" disabled={loading || !token} style={{ ...styles.btn, opacity: (loading || !token) ? 0.6 : 1 }}>
                  {loading ? t('auth.resetPassword.loadingBtn') : t('auth.resetPassword.submitBtn')}
                </button>
              </form>
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
  btn: { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '12px 14px', fontSize: 14, marginBottom: 4 },
}