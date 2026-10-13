// pages/account/api.js — Developer API dashboard: keys + usage.
import { useEffect, useState, useCallback } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  KeyRound, Plus, Trash2, Copy, Check, Loader2, AlertCircle, Code2, Zap,
} from "lucide-react"
import Layout from "../../components/Layout"
import { useAuth } from "../../context/AuthContext"
import { useRouter } from "next/router"
import { getApiUrl } from "../../lib/getApiUrl"
import { getPageMessages } from "../../lib/i18nLoader"

function fmtDate(d) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function ApiDashboard() {
  const router = useRouter()
  const { user, authFetch, loading: authLoading } = useAuth()
  const [keys, setKeys] = useState([])
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState(null)   // shown once
  const [copied, setCopied] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (typeof window !== "undefined" && !authLoading && !user) router.push("/auth/login?redirect=/account/api")
  }, [user, authLoading, router])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const r = await authFetch(`${getApiUrl()}/api/keys`)
      const d = await r.json()
      if (d.success) { setKeys(d.keys); setUsage(d.usage); setError("") }
      else setError(d.error || "Could not load keys")
    } catch { setError("Could not load keys") }
    finally { setLoading(false) }
  }, [authFetch])

  useEffect(() => { if (user) load() }, [user, load])

  const createKey = async () => {
    const name = prompt("Name this key (e.g. 'Production', 'My script'):", "Default")
    if (name === null) return
    try {
      setCreating(true); setError("")
      const r = await authFetch(`${getApiUrl()}/api/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const d = await r.json()
      if (d.success) { setNewKey(d.key); load() }
      else setError(d.error || "Could not create key")
    } catch { setError("Could not create key") }
    finally { setCreating(false) }
  }

  const revokeKey = async (id) => {
    if (!confirm("Revoke this key? Apps using it will stop working immediately.")) return
    try {
      setBusyId(id)
      const r = await authFetch(`${getApiUrl()}/api/keys/${id}`, { method: "DELETE" })
      if (r.ok) setKeys((p) => p.filter((k) => k.id !== id))
    } catch { setError("Could not revoke key") }
    finally { setBusyId(null) }
  }

  const copyKey = () => {
    navigator.clipboard?.writeText(newKey)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (!user) return null
  const pct = usage ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0

  return (
    <Layout title="API Keys">
      <Head><title>API Keys | SmallPDF.us</title></Head>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-emerald-600" /> API Keys
            </h1>
            <p className="text-gray-500 text-sm mt-1">Use the SmallPDF API in your own apps and scripts.</p>
          </div>
          <Link href="/developers" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
            <Code2 className="w-4 h-4" /> Docs
          </Link>
        </div>

        {/* Usage */}
        {usage && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-800">
                Usage this month <span className="text-gray-400 font-normal">({usage.period})</span>
              </span>
              <span className="text-sm text-gray-600">{usage.used.toLocaleString()} / {usage.quota.toLocaleString()} calls</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500 capitalize">Plan: <strong>{usage.plan}</strong></span>
              {usage.plan === "free" && (
                <Link href="/pricing" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Upgrade for more
                </Link>
              )}
            </div>
          </div>
        )}

        {/* New key reveal */}
        {newKey && (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-emerald-900 mb-1">Your new API key</p>
            <p className="text-xs text-emerald-700 mb-3">Copy it now — for security we won't show it again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-800 break-all">{newKey}</code>
              <button onClick={copyKey} className="flex-shrink-0 inline-flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-emerald-700">
                {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
              </button>
            </div>
            <button onClick={() => setNewKey(null)} className="text-xs text-emerald-700 hover:text-emerald-900 mt-3">Done</button>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

        <div className="flex justify-end mb-3">
          <button onClick={createKey} disabled={creating} className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-emerald-700 disabled:opacity-60">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create new key
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12"><Loader2 className="w-7 h-7 text-emerald-600 animate-spin mx-auto" /></div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
            <KeyRound className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">No API keys yet</p>
            <p className="text-gray-500 text-sm mt-1">Create one to start using the API.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{k.name || "Unnamed"}</p>
                  <p className="text-xs text-gray-500 font-mono">{k.key_prefix}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Created {fmtDate(k.created_at)} · Last used {fmtDate(k.last_used_at)}</p>
                </div>
                <button onClick={() => revokeKey(k.id)} disabled={busyId === k.id} className="p-2 hover:bg-red-50 rounded-lg text-red-500 disabled:opacity-50" title="Revoke">
                  {busyId === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/developers" className="text-sm text-gray-500 hover:text-gray-700">Read the API documentation →</Link>
        </div>
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
