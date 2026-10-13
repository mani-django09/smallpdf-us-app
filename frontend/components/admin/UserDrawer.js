// Slide-over with everything about one user: profile, plan, payments, files, API keys, plan actions.
import { useEffect, useState } from "react"
import { Ban, CheckCircle2, Crown, FileText, KeyRound, Mail, ShieldCheck, X } from "lucide-react"
import { Badge, ErrorNote, Skeleton, fmtBytes, fmtMoney, fmtNum, useAdminData } from "./adminUi"
import { formatIST, formatISTDate, timeAgo } from "../../lib/adminTime"

const PLAN_TONE = { free: "slate", starter: "amber", pro: "violet", agency: "green", enterprise: "green" }
const Row = ({ k, children }) => (<div className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-slate-500 shrink-0">{k}</span><span className="text-slate-900 text-right break-all">{children}</span></div>)
const Section = ({ title, children }) => (<div className="mt-6"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</h4>{children}</div>)

export default function UserDrawer({ api, token, userId, onClose, onUnauthorized, onChanged }) {
  const { data, error, loading, reload } = useAdminData(api, `/users/${userId}`, token, { onUnauthorized })
  const [plan, setPlan] = useState("")
  const [busy, setBusy] = useState("")
  const [note, setNote] = useState("")
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k) }, [onClose])
  useEffect(() => { if (data) setPlan(data.user.plan) }, [data])

  const call = async (path, body, label) => {
    setBusy(label); setNote("")
    try {
      const res = await fetch(`${api}/api/admin/${path}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
      if (res.status === 401) return onUnauthorized && onUnauthorized()
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setNote(`${label} — done`); reload(); onChanged && onChanged()
    } catch (e) { setNote(`Failed: ${e.message}`) } finally { setBusy("") }
  }
  const u = data?.user

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto border-l border-slate-200 animate-[slideIn_.2s_ease-out]">
        <style>{`@keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}`}</style>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">User details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          {loading && !data ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /></div> : error && !data ? <ErrorNote error={error} onRetry={reload} /> : (
            <>
              <div className="flex items-center gap-4">
                {u.avatar ? <img src={u.avatar} alt="" className="w-14 h-14 rounded-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl font-bold">{(u.name || u.email || "?")[0].toUpperCase()}</div>}
                <div className="min-w-0"><div className="font-semibold text-slate-900 truncate">{u.name || "—"}</div><div className="text-sm text-slate-500 truncate flex items-center gap-1"><Mail className="w-3.5 h-3.5 shrink-0" />{u.email}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge tone={PLAN_TONE[u.plan] || "slate"}>{u.plan}</Badge>{u.email_verified ? <Badge tone="green">verified</Badge> : <Badge tone="amber">unverified</Badge>}{u.is_banned ? <Badge tone="red">banned</Badge> : null}{u.google ? <Badge tone="blue">Google</Badge> : null}</div></div>
              </div>

              <Section title="Account">
                <Row k="User ID">#{u.id}</Row>
                <Row k="Joined"><span title={formatIST(u.created_at)}>{formatIST(u.created_at, { seconds: false })}</span></Row>
                <Row k="Last login">{u.last_login_at ? <span title={formatIST(u.last_login_at)}>{timeAgo(u.last_login_at)}</span> : "Never"}</Row>
                <Row k="Plan ends">{u.plan_expires_at ? formatISTDate(u.plan_expires_at) : u.plan === "free" ? "—" : "no expiry"}</Row>
                <Row k="Gateway">{[u.has_razorpay && "Razorpay", u.has_paypal && "PayPal", data.subscriptions.some((s) => s.gateway === "lemonsqueezy") && "Lemon Squeezy"].filter(Boolean).join(", ") || "—"}</Row>
                {u.is_banned && u.ban_reason ? <Row k="Ban reason">{u.ban_reason}</Row> : null}
              </Section>

              <Section title="Actions">
                <div className="flex items-center gap-2">
                  <select value={plan} onChange={(e) => setPlan(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    {["free", "starter", "pro", "agency"].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button disabled={busy || plan === u.plan} onClick={() => call(`users/${u.id}/plan`, { plan }, "Plan changed")} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-indigo-700 inline-flex items-center gap-1.5"><Crown className="w-3.5 h-3.5" />Set plan</button>
                </div>
                <button disabled={!!busy} onClick={() => { if (!u.is_banned && !confirm(`Ban ${u.email}?`)) return; call(`users/${u.id}/ban`, { banned: !u.is_banned, reason: u.is_banned ? "" : "Banned by admin" }, u.is_banned ? "User unbanned" : "User banned") }}
                  className={`mt-2 w-full px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 ${u.is_banned ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-700 hover:bg-red-100"}`}>
                  {u.is_banned ? <><CheckCircle2 className="w-4 h-4" />Unban user</> : <><Ban className="w-4 h-4" />Ban user</>}
                </button>
                {note && <p className={`text-xs mt-2 ${note.startsWith("Failed") ? "text-red-600" : "text-emerald-600"}`}>{note}</p>}
              </Section>

              <Section title={`Payments (${data.payments.length})`}>
                {data.payments.length ? <ul className="divide-y divide-slate-100">{data.payments.map((p, i) => (
                  <li key={i} className="py-2 flex items-center gap-2 text-sm"><Badge tone={{ activated: "green", renewed: "blue", failed: "red" }[p.event] || "slate"}>{p.event}</Badge><span className="text-slate-600">{p.plan} · {p.gateway}</span><span className="ml-auto text-right"><div className="font-semibold">{p.amount ? fmtMoney(p.amount / 100, p.currency) : "—"}</div><div className="text-[11px] text-slate-400">{formatISTDate(p.created_at)}</div></span></li>))}</ul>
                  : <p className="text-sm text-slate-400">No payments recorded{data.subscriptions.length ? " (older subscription below)" : ""}.</p>}
                {data.subscriptions.map((s, i) => (<div key={i} className="text-xs text-slate-500 mt-1">{s.gateway} · {s.plan} · <b>{s.status}</b>{s.current_period_end ? ` · until ${formatISTDate(s.current_period_end)}` : ""}</div>))}
              </Section>

              <Section title={`Recent files (${data.files.length})`}>
                {data.files.length ? <ul className="space-y-1.5">{data.files.map((f, i) => (<li key={i} className="flex items-center gap-2 text-sm"><FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate text-slate-700">{f.original_name}</span><span className="ml-auto text-[11px] text-slate-400 whitespace-nowrap">{f.tool} · {fmtBytes(f.file_size)} · {timeAgo(f.created_at)}</span></li>))}</ul> : <p className="text-sm text-slate-400">No saved files (files are kept only 1–48 h).</p>}
                {data.tools.length ? <div className="flex flex-wrap gap-1.5 mt-3">{data.tools.map((t) => <Badge key={t.tool} tone="blue">{t.tool} · {t.n}</Badge>)}</div> : null}
              </Section>

              {(data.apiKeys.length || data.apiUsage.length) ? (
                <Section title="API access">
                  {data.apiKeys.map((k, i) => (<div key={i} className="flex items-center gap-2 text-sm py-1"><KeyRound className="w-3.5 h-3.5 text-slate-400" /><span className="font-mono text-xs">{k.key_prefix}…</span><span className="text-slate-500 truncate">{k.name}</span>{k.revoked ? <Badge tone="red">revoked</Badge> : <Badge tone="green">active</Badge>}<span className="ml-auto text-[11px] text-slate-400">{k.last_used_at ? timeAgo(k.last_used_at) : "never used"}</span></div>))}
                  {data.apiUsage.map((x, i) => (<div key={i} className="text-xs text-slate-500">{x.period}: {fmtNum(x.count)} calls</div>))}
                </Section>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
