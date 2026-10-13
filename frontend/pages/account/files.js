// pages/account/files.js — "My Files" history for logged-in users.
// Lists the files produced by tools while logged in, with a download button,
// a delete button, and a countdown to auto-deletion (1h free / 24h paid).

import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import {
  FileText, Download, Trash2, Loader2, Clock, FolderOpen, ShieldCheck,
} from 'lucide-react'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { getPageMessages } from '../../lib/i18nLoader'
import { useRouter } from 'next/router'
import { getApiUrl } from '../../lib/getApiUrl'
import { useTranslations } from '../../lib/i18n'

function fmtSize(bytes) {
  if (!bytes) return '—'
  const mb = bytes / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function fmtCountdown(ms, t) {
  if (ms <= 0) return t('account.files.expired')
  const mins = Math.floor(ms / 60000)
  if (mins >= 60) return t('account.files.leftHours', { h: Math.floor(mins / 60), m: mins % 60 })
  return t('account.files.leftMinutes', { m: mins })
}

// Tool id → localized tool name from the nav keys ("merge-pdf" → nav.mergePdf);
// covers every tool that records files (the old map knew only five).
function toolLabel(tool, t) {
  const key = 'nav.' + tool.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
  const v = t(key)
  return v === key ? tool : v
}

// Must match RETENTION_MS in backend/myFiles.js.
const RETENTION_KEY = { free: 'hour1', starter: 'hours24', pro: 'hours48', agency: 'hours48', enterprise: 'hours48' }

export default function MyFilesPage() {
  const router = useRouter()
  const { user, authFetch, loading: authLoading } = useAuth()
  const { t } = useTranslations()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [now, setNow] = useState(Date.now())

  // Redirect anonymous users to login.
  useEffect(() => {
    if (typeof window !== 'undefined' && !authLoading && !user) {
      router.push('/auth/login?redirect=/account/files')
    }
  }, [user, authLoading, router])

  // Tick every 30s so countdowns stay fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true)
      const resp = await authFetch(`${getApiUrl()}/api/my-files`)
      const data = await resp.json()
      if (data.success) {
        setFiles(data.files)
        setError('')
      } else {
        setError(t('account.files.errorLoad'))
      }
    } catch (e) {
      setError(t('account.files.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [authFetch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) loadFiles()
  }, [user, loadFiles])

  const handleDownload = async (file) => {
    try {
      setBusyId(file.id)
      const resp = await authFetch(`${getApiUrl()}/api/my-files/${file.id}/download`)
      if (!resp.ok) throw new Error('Download failed')
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(t('account.files.errorDownload'))
      loadFiles()
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (file) => {
    if (!confirm(t('account.files.deleteConfirm', { name: file.name }))) return
    try {
      setBusyId(file.id)
      const resp = await authFetch(`${getApiUrl()}/api/my-files/${file.id}`, { method: 'DELETE' })
      if (resp.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== file.id))
      }
    } catch (e) {
      setError(t('account.files.errorDelete'))
    } finally {
      setBusyId(null)
    }
  }

  if (!user) return null

  // Was "24 hours" for every paid plan, but Pro/Agency/Enterprise keep files 48 h.
  const retentionKey = RETENTION_KEY[user.plan] || 'hour1'

  return (
    <Layout title={t('account.files.pageTitle')}>
      <Head><title>{`${t('account.files.pageTitle')} | SmallPDF.us`}</title></Head>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-indigo-600" /> {t('account.files.pageTitle')}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {t('account.files.subtitle')}
            </p>
          </div>
          <button
            onClick={loadFiles}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {t('account.files.refresh')}
          </button>
        </div>

        {/* Retention notice */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6">
          <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            {t('account.files.retention', { duration: t('account.files.' + retentionKey) })}
            {retentionKey !== 'hours48' && (
              <>
                {' '}
                <Link href="/pricing" className="underline font-medium">{t('account.files.upgradeText')}</Link>
              </>
            )}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-gray-500 text-sm mt-3">{t('account.files.loading')}</p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900">{t('account.files.emptyTitle')}</h3>
            <p className="text-gray-500 text-sm mt-1 mb-4">
              {t('account.files.emptyDesc')}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700"
            >
              {t('account.files.browseTools')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => {
              const remaining = file.expiresAt - now
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 hover:shadow-sm transition-shadow"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      {file.tool && (
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                          {toolLabel(file.tool, t)}
                        </span>
                      )}
                      <span>{fmtSize(file.size)}</span>
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="w-3 h-3" /> {fmtCountdown(remaining, t)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(file)}
                    disabled={busyId === file.id}
                    className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 disabled:opacity-50"
                    title={t('account.files.download')}
                  >
                    {busyId === file.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(file)}
                    disabled={busyId === file.id}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500 disabled:opacity-50"
                    title={t('account.files.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}

// Layout renders nav/login/etc via t('nav.*') / t('layout.*') — those live in
// common.json, which getPageMessages always loads regardless of the namespace
// list. Without this, TranslationsProvider gets messages=undefined and every
// t() call on this page falls back to printing the raw key (e.g. "nav.pricing").
export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, []) },
    revalidate: 86400,
  }
}
