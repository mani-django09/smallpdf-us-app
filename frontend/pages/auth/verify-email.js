// pages/auth/verify-email.js

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { useTranslations } from '../../lib/i18n'

export default function VerifyEmailPage() {
  const router = useRouter()
  const { t } = useTranslations()
  const { token } = router.query
  const [status, setStatus] = useState('loading') // loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'}/api/auth/verify-email?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.message) { setStatus('success'); setMessage(data.message) }
        else { setStatus('error'); setMessage(data.error || 'Verification failed') }
      })
      .catch(() => { setStatus('error'); setMessage('Something went wrong. Please try again.') })
  }, [token])

  return (
    <>
      <Head><title>{t('auth.verifyEmail.pageTitle')}</title></Head>
      <div style={styles.page}>
        <div style={styles.card}>
          <Link href="/" style={{ textDecoration: 'none', color: '#DC2626', fontWeight: 700, fontSize: 22, display: 'block', textAlign: 'center', marginBottom: 32 }}>
            📄 SmallPDF.us
          </Link>

          {status === 'loading' && (
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <p>{t('auth.verifyEmail.loadingText')}</p>
            </div>
          )}

          {status === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h2 style={{ color: '#111827', margin: '0 0 10px' }}>{t('auth.verifyEmail.successTitle')}</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>{message}</p>
              <Link href="/auth/login">
                <button style={styles.btn}>{t('auth.verifyEmail.loginBtn')}</button>
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <h2 style={{ color: '#111827', margin: '0 0 10px' }}>{t('auth.verifyEmail.errorTitle')}</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>{message}</p>
              <Link href="/auth/login" style={{ color: '#DC2626', fontWeight: 600, fontSize: 14 }}>
                {t('auth.verifyEmail.backToLogin')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
  card: { background: '#fff', borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  btn: { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
}