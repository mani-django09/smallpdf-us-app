// pages/account.js
// User account page - protected, redirect to login if not logged in

import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth, withAuth } from '../context/AuthContext'
import { useTranslations } from '../lib/i18n'

function AccountPage() {
  const { user, logout, authFetch } = useAuth()
  const { t } = useTranslations()
  const [tab, setTab] = useState('profile')
  const [name, setName] = useState(user?.name || '')
  const [passwords, setPasswords] = useState({ current: '', newPwd: '', confirm: '' })
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [saving, setSaving] = useState(false)

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'

  const showMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await authFetch(`${API}/api/auth/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (res.ok) showMsg('success', data.message)
      else showMsg('error', data.error)
    } catch { showMsg('error', 'Failed to update profile') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwords.newPwd !== passwords.confirm) return showMsg('error', t('account.passwordMismatch'))
    setSaving(true)
    try {
      const res = await authFetch(`${API}/api/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPwd }),
      })
      const data = await res.json()
      if (res.ok) { showMsg('success', data.message); setPasswords({ current: '', newPwd: '', confirm: '' }) }
      else showMsg('error', data.error)
    } catch { showMsg('error', 'Failed to change password') }
    finally { setSaving(false) }
  }

  const planColors = { free: '#6b7280', pro: '#DC2626', enterprise: '#7c3aed' }
  const planColor = planColors[user?.plan] || planColors.free

  const planBadgeLabel =
    user?.plan === 'pro' ? t('account.planBadgePro')
    : user?.plan === 'enterprise' ? t('account.planBadgeEnterprise')
    : t('account.planBadgeFree')

  const tabs = [
    { id: 'profile',  label: t('account.tabProfile')  },
    { id: 'security', label: t('account.tabSecurity') },
    { id: 'plan',     label: t('account.tabPlan')     },
  ]

  // proFeatures is an array in the JSON — access directly via messages object
  // t() returns the key string if value isn't a string, so we read it differently
  const proFeatures = (() => {
    const raw = [0,1,2,3,4].map(i => t(`account.proFeatures.${i}`)).filter(v => !v.startsWith('account.'))
    return raw.length ? raw : ['Unlimited file processing','No file size limits','Priority support','Batch processing','No ads']
  })()

  return (
    <>
      <Head><title>{t('account.pageTitle')}</title></Head>
      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <Link href="/" style={styles.logoLink}>📄 SmallPDF.us</Link>
          <button onClick={logout} style={styles.logoutBtn}>{t('account.logOut')}</button>
        </div>

        <div style={styles.container}>
          {/* Sidebar */}
          <aside style={styles.sidebar}>
            <div style={styles.userCard}>
              <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
              <div>
                <div style={styles.userName}>{user?.name}</div>
                <div style={styles.userEmail}>{user?.email}</div>
                <span style={{ ...styles.planBadge, background: planColor }}>{planBadgeLabel}</span>
              </div>
            </div>

            <nav style={styles.nav}>
              {tabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  style={{ ...styles.navItem, ...(tab === item.id ? styles.navItemActive : {}) }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main style={styles.main}>
            {msg.text && (
              <div style={{
                ...styles.msgBox,
                background:   msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                borderColor:  msg.type === 'success' ? '#bbf7d0' : '#fecaca',
                color:        msg.type === 'success' ? '#15803d' : '#dc2626',
              }}>
                {msg.text}
              </div>
            )}

            {/* ── Profile tab ── */}
            {tab === 'profile' && (
              <form onSubmit={handleUpdateProfile} style={styles.section}>
                <h2 style={styles.sectionTitle}>{t('account.profileTitle')}</h2>
                <div style={styles.field}>
                  <label style={styles.label}>{t('account.fullNameLabel')}</label>
                  <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{t('account.emailLabel')}</label>
                  <input
                    style={{ ...styles.input, background: '#f9fafb', color: '#6b7280' }}
                    value={user?.email}
                    disabled
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{t('account.emailCannotChange')}</span>
                </div>
                <button type="submit" disabled={saving} style={styles.btn}>
                  {saving ? t('account.saving') : t('account.saveChanges')}
                </button>
              </form>
            )}

            {/* ── Security tab ── */}
            {tab === 'security' && (
              <form onSubmit={handleChangePassword} style={styles.section}>
                <h2 style={styles.sectionTitle}>{t('account.securityTitle')}</h2>
                <div style={styles.field}>
                  <label style={styles.label}>{t('account.currentPassword')}</label>
                  <input
                    type="password"
                    style={styles.input}
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{t('account.newPassword')}</label>
                  <input
                    type="password"
                    style={styles.input}
                    value={passwords.newPwd}
                    onChange={(e) => setPasswords({ ...passwords, newPwd: e.target.value })}
                    required
                    minLength={8}
                    placeholder={t('account.newPasswordPlaceholder')}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{t('account.confirmNewPassword')}</label>
                  <input
                    type="password"
                    style={styles.input}
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" disabled={saving} style={styles.btn}>
                  {saving ? t('account.updating') : t('account.updatePassword')}
                </button>
              </form>
            )}

            {/* ── Plan tab ── */}
            {tab === 'plan' && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>{t('account.planTitle')}</h2>
                <div style={{ background: '#fef2f2', border: '2px solid #DC2626', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 20, color: '#111827' }}>
                        {planBadgeLabel} Plan
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
                        {user?.plan === 'free' ? t('account.planFreeDesc') : t('account.planPaidDesc')}
                      </div>
                    </div>
                    <span style={{ ...styles.planBadge, background: planColor, fontSize: 14, padding: '6px 14px' }}>
                      {planBadgeLabel}
                    </span>
                  </div>
                </div>

                {user?.plan === 'free' && (
                  <div>
                    <h3 style={{ color: '#111827', marginBottom: 16 }}>{t('account.upgradeToPro')}</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {proFeatures.map((f) => (
                        <li key={f} style={{ color: '#374151', fontSize: 14, display: 'flex', gap: 8 }}>
                          <span style={{ color: '#22c55e' }}>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                    <button style={{ ...styles.btn, background: '#DC2626' }}>{t('account.upgradeBtn')}</button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f4f4f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' },
  header: { background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 },
  logoLink: { textDecoration: 'none', color: '#DC2626', fontWeight: 700, fontSize: 20 },
  logoutBtn: { background: 'none', border: '1px solid #d1d5db', color: '#374151', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 },
  container: { maxWidth: 900, margin: '32px auto', padding: '0 16px', display: 'flex', gap: 24, alignItems: 'flex-start' },
  sidebar: { width: 240, flexShrink: 0, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
  userCard: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f3f4f6' },
  avatar: { width: 44, height: 44, borderRadius: '50%', background: '#DC2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 },
  userName: { fontWeight: 600, color: '#111827', fontSize: 14 },
  userEmail: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  planBadge: { display: 'inline-block', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, marginTop: 4 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: { background: 'none', border: 'none', textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', color: '#374151', fontSize: 14, fontWeight: 500 },
  navItemActive: { background: '#fef2f2', color: '#DC2626', fontWeight: 600 },
  main: { flex: 1, background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
  section: { display: 'flex', flexDirection: 'column', gap: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 500, color: '#374151' },
  input: { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 15, outline: 'none', color: '#111827' },
  btn: { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' },
  msgBox: { border: '1px solid', borderRadius: 8, padding: '12px 16px', fontSize: 14, marginBottom: 4 },
}

export default withAuth(AccountPage)