// Revenue: MRR/ARR from active plans, real payment history, funnel, renewals at risk.
import { CalendarClock, CreditCard, Download, IndianRupee, TrendingUp, UserCheck, Users } from "lucide-react"
import { Badge, Card, EmptyState, ErrorNote, Skeleton, StatCard, downloadCsv, fmtMoney, fmtNum, pct, useAdminData } from "./adminUi"
import { Donut, HBars } from "./charts"
import { formatIST, formatISTDate, timeAgo } from "../../lib/adminTime"

const GATEWAY = {
  razorpay: { label: "Razorpay (INR)", color: "#3b82f6" }, razorpay_intl: { label: "Razorpay (USD)", color: "#06b6d4" },
  paypal: { label: "PayPal", color: "#f59e0b" }, lemonsqueezy: { label: "Lemon Squeezy", color: "#a855f7" }, manual: { label: "Manual / admin", color: "#94a3b8" },
}
const PLAN_TONE = { starter: "amber", pro: "violet", agency: "green" }
const EVENT_TONE = { activated: "green", renewed: "blue", failed: "red" }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function RevenuePanel({ api, token, onUnauthorized, openUser }) {
  const { data, error, loading, reload } = useAdminData(api, "/revenue", token, { interval: 120000, onUnauthorized })
  if (loading && !data) return <div className="space-y-4"><div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />
  const d = data, money = (usd, inr) => [inr ? fmtMoney(inr, "INR") : null, usd ? fmtMoney(usd, "USD") : null].filter(Boolean).join(" + ") || "₹0"

  // last 6 months of collected payments (IST months), USD & INR kept separate
  const months = {}
  for (const r of d.history.monthly) { (months[r.m] = months[r.m] || { USD: 0, INR: 0, n: 0 })[r.currency] = (r.total || 0) / 100; months[r.m].n += r.n }
  const monthRows = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  const gatewayItems = Object.entries(d.byGateway).map(([g, n]) => ({ label: (GATEWAY[g] || GATEWAY.manual).label, value: n, color: (GATEWAY[g] || GATEWAY.manual).color }))
  const planItems = Object.entries(d.byPlan).map(([p, n]) => ({ label: p, value: n, color: { starter: "#f59e0b", pro: "#8b5cf6", agency: "#10b981" }[p] || "#64748b" }))
  const f = d.funnel

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-bold text-slate-900">Revenue</h2>
          <p className="text-xs text-slate-400">MRR is estimated from active plans at list price. Payment history below is recorded {d.history.since ? `since ${formatISTDate(d.history.since)}` : "from the next payment onwards"}.</p></div>
        <button onClick={() => downloadCsv(api, "/export/revenue", token, "payments.csv").catch((e) => alert(e.message))} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"><Download className="w-3.5 h-3.5" />Payments CSV</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="MRR (monthly recurring)" icon={IndianRupee} tone="emerald" value={money(d.mrr.USD, d.mrr.INR)} sub={d.mrr.INR && d.mrr.USD ? `≈ ${fmtMoney(d.mrr.usdEstimate)} total` : d.activeSubscribers ? "from active plans" : "no active paid plans"} />
        <StatCard label="ARR (yearly run-rate)" icon={TrendingUp} tone="blue" value={money(d.arr.USD, d.arr.INR)} sub={d.mrr.INR && d.mrr.USD ? `≈ ${fmtMoney(d.arr.usdEstimate)} total` : "MRR × 12"} />
        <StatCard label="Paying customers" icon={UserCheck} tone="violet" value={fmtNum(d.activeSubscribers)} sub={`${pct(f.conversionRate, 2)} of ${fmtNum(f.totalUsers)} users`} />
        <StatCard label="Failed payments (30 d)" icon={CreditCard} tone="rose" value={fmtNum(d.history.failedLast30d)} sub={d.history.failedLast30d ? "follow up with these users" : "none — great"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Plans" subtitle="Active paying customers">
          {d.activeSubscribers ? <Donut items={planItems} center={<><div className="text-xl font-bold text-slate-900">{d.activeSubscribers}</div><div className="text-[11px] text-slate-400">paid</div></>} /> : <EmptyState title="No paid plans yet" hint="Your first paying customer will show up here." />}
        </Card>
        <Card title="By gateway" subtitle="Where customers pay">
          {d.activeSubscribers ? <HBars items={gatewayItems.map((g) => ({ ...g }))} format={(v) => `${v} customer${v > 1 ? "s" : ""}`} /> : <EmptyState title="Nothing yet" />}
        </Card>
        <Card title="Sign-up → paid funnel" subtitle="How visitors turn into customers">
          <ul className="space-y-3 text-sm">
            {[["Users", f.totalUsers, "#94a3b8"], ["Email verified", f.verified, "#06b6d4"], ["Ever paid", f.everPaid, "#8b5cf6"], ["Paying now", f.paidNow, "#10b981"]].map(([l, v, c]) => (
              <li key={l}><div className="flex justify-between text-xs mb-1"><span className="text-slate-600">{l}</span><span className="font-semibold text-slate-900">{fmtNum(v)} <span className="text-slate-400 font-normal">{f.totalUsers ? `(${pct(v / f.totalUsers, 1)})` : ""}</span></span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(1.5, f.totalUsers ? (v / f.totalUsers) * 100 : 0)}%`, background: c }} /></div></li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 mt-4">Average time from sign-up to first payment: <strong>{f.avgDaysToPay === null ? "not enough data yet" : `${f.avgDaysToPay.toFixed(1)} days`}</strong></p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Collected by month" subtitle="Real payments recorded (activations + renewals, IST months)" pad={false}>
          {monthRows.length ? (
            <table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="text-left px-5 py-2 font-semibold">Month</th><th className="text-right px-3 py-2 font-semibold">Payments</th><th className="text-right px-5 py-2 font-semibold">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{monthRows.map(([m, v]) => (<tr key={m}><td className="px-5 py-2.5 font-medium text-slate-800">{MONTHS[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</td><td className="px-3 py-2.5 text-right tabular-nums">{v.n}</td><td className="px-5 py-2.5 text-right font-semibold">{money(v.USD, v.INR)}</td></tr>))}</tbody></table>
          ) : <EmptyState title="No payments recorded yet" hint="Every new payment and renewal from Razorpay, PayPal and Lemon Squeezy is now logged here automatically." />}
        </Card>
        <Card title="Latest payments" pad={false}>
          {d.history.recent.length ? (
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">{d.history.recent.map((p) => (
              <li key={p.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                <Badge tone={EVENT_TONE[p.event] || "slate"}>{p.event}</Badge>
                <div className="min-w-0"><div className="truncate text-slate-800">{p.email || "—"}</div><div className="text-[11px] text-slate-400">{(GATEWAY[p.gateway] || GATEWAY.manual).label} · {p.plan || "?"} · <span title={formatIST(p.created_at)}>{timeAgo(p.created_at)}</span></div></div>
                <div className="ml-auto font-semibold text-slate-900 whitespace-nowrap">{p.amount ? fmtMoney(p.amount / 100, p.currency) : "—"}</div>
              </li>))}</ul>
          ) : <EmptyState title="No payment events yet" />}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Renewals due in 7 days" subtitle="Reach out before they lapse" action={<CalendarClock className="w-4 h-4 text-slate-400" />}>
          {d.risk.renewingSoon.length ? (
            <ul className="space-y-2">{d.risk.renewingSoon.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-sm"><button onClick={() => openUser(s.id)} className="text-blue-600 hover:underline truncate text-left">{s.email}</button><Badge tone={PLAN_TONE[s.plan] || "slate"}>{s.plan}</Badge><span className="ml-auto text-xs text-slate-500 whitespace-nowrap">{s.daysLeft < 1 ? "today" : `in ${Math.ceil(s.daysLeft)} d`} · {formatISTDate(s.expiresAt)}</span></li>))}</ul>
          ) : <p className="text-sm text-slate-400">No renewals due this week.</p>}
        </Card>
        <Card title="Recently lapsed" subtitle="Plan ended in the last 30 days — win-back list">
          {d.risk.lapsed.length || d.risk.cancelled.length ? (
            <ul className="space-y-2">{[...d.risk.lapsed.map((u) => ({ id: u.id, email: u.email, plan: u.plan, when: u.plan_expires_at })), ...d.risk.cancelled.map((c) => ({ id: c.user_id, email: c.email, plan: c.plan, when: c.updated_at, tag: c.status }))].slice(0, 12).map((u, i) => (
              <li key={i} className="flex items-center gap-3 text-sm"><button onClick={() => u.id && openUser(u.id)} className="text-blue-600 hover:underline truncate text-left">{u.email || "—"}</button><Badge tone="red">{u.tag || "expired"}</Badge><span className="ml-auto text-xs text-slate-500 whitespace-nowrap">{u.plan} · {timeAgo(u.when)}</span></li>))}</ul>
          ) : <p className="text-sm text-slate-400">Nobody has lapsed recently.</p>}
        </Card>
      </div>

      <Card title="Active subscribers" pad={false}>
        {d.subscribers.length ? (
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="text-left px-5 py-2 font-semibold">Customer</th><th className="text-left px-3 py-2 font-semibold">Plan</th><th className="text-left px-3 py-2 font-semibold">Gateway</th><th className="text-right px-3 py-2 font-semibold">Per month</th><th className="text-right px-5 py-2 font-semibold">Renews / ends</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{d.subscribers.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openUser(s.id)}>
                <td className="px-5 py-2.5"><div className="font-medium text-slate-800">{s.name || "—"}</div><div className="text-[11px] text-slate-400">{s.email}</div></td>
                <td className="px-3 py-2.5"><Badge tone={PLAN_TONE[s.plan] || "slate"}>{s.plan}</Badge> <span className="text-[11px] text-slate-400">{s.interval}</span></td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{(GATEWAY[s.gateway] || GATEWAY.manual).label}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{fmtMoney(s.monthly, s.currency)}</td>
                <td className="px-5 py-2.5 text-right text-xs text-slate-500" title={s.expiresAt ? formatIST(s.expiresAt) : ""}>{s.expiresAt ? formatISTDate(s.expiresAt) : "no expiry"}</td>
              </tr>))}</tbody></table></div>
        ) : <EmptyState title="No paying customers yet" />}
      </Card>
    </div>
  )
}
