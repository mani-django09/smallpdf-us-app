// Overview: "how is today going" at a glance — cards vs yesterday (same time), live strip, alerts, top tools.
import { Activity, AlertTriangle, CheckCircle2, Download, IndianRupee, ShieldAlert, TrendingUp, UserPlus, Users, Wifi, XCircle } from "lucide-react"
import { Card, ErrorNote, Skeleton, StatCard, fmtMoney, fmtNum, useAdminData, EmptyState } from "./adminUi"
import { HBars } from "./charts"
import { timeAgo as agoIST } from "../../lib/adminTime"

const LEVEL = {
  critical: { icon: XCircle, box: "border-red-200 bg-red-50", text: "text-red-700", tag: "red" },
  warning: { icon: AlertTriangle, box: "border-amber-200 bg-amber-50", text: "text-amber-800", tag: "amber" },
  info: { icon: ShieldAlert, box: "border-blue-200 bg-blue-50", text: "text-blue-700", tag: "blue" },
}

export function AlertList({ items, compact = false }) {
  if (!items.length) return (
    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3"><CheckCircle2 className="w-4 h-4" />All systems normal — nothing needs attention.</div>
  )
  return (
    <ul className="space-y-2">
      {items.map((a, i) => {
        const L = LEVEL[a.level] || LEVEL.info, Icon = L.icon
        return (
          <li key={i} className={`flex items-start gap-3 rounded-xl border px-4 ${compact ? "py-2.5" : "py-3"} ${L.box}`}>
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${L.text}`} />
            <div className="min-w-0"><p className={`text-sm font-semibold ${L.text}`}>{a.title}</p><p className="text-xs text-slate-600 mt-0.5">{a.detail}</p></div>
          </li>
        )
      })}
    </ul>
  )
}

export default function OverviewPanel({ api, token, onUnauthorized, goTo }) {
  const { data, error, loading, reload } = useAdminData(api, "/overview", token, { interval: 30000, onUnauthorized })
  const src = useAdminData(api, "/sources?range=7d", token, { interval: 120000, onUnauthorized })
  if (loading && !data) return <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />
  const d = data, t = d.today, y = d.yesterdaySoFar
  const rev = d.revenue
  const revTodayUsd = rev.today.USD + rev.today.INR / rev.inrPerUsd
  const revYUsd = rev.yesterdaySoFar.USD + rev.yesterdaySoFar.INR / rev.inrPerUsd
  const successRate = t.conversions + t.failures ? t.conversions / (t.conversions + t.failures) : 1
  const revText = rev.today.payments
    ? [rev.today.INR ? fmtMoney(rev.today.INR, "INR") : null, rev.today.USD ? fmtMoney(rev.today.USD, "USD") : null].filter(Boolean).join(" + ")
    : "₹0"
  const liveNow = d.live.visitors > 0

  return (
    <div className="space-y-6">
      {/* Live strip */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3 shadow-lg shadow-blue-600/20">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3"><span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${liveNow ? "animate-ping bg-emerald-300" : "bg-slate-300"}`} /><span className={`relative inline-flex rounded-full h-3 w-3 ${liveNow ? "bg-emerald-400" : "bg-slate-300"}`} /></span>
          <div><div className="text-2xl font-bold leading-none">{fmtNum(d.live.visitors)}</div><div className="text-xs text-blue-100 mt-1">active in the last 5 min</div></div>
        </div>
        <div><div className="text-lg font-semibold leading-none">{fmtNum(d.live.events)}</div><div className="text-xs text-blue-100 mt-1">events (5 min)</div></div>
        <div><div className="text-lg font-semibold leading-none">{d.lastConversion ? agoIST(d.lastConversion.created_at) : "—"}</div><div className="text-xs text-blue-100 mt-1">last conversion{d.lastConversion ? ` · ${d.lastConversion.tool}` : ""}</div></div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button onClick={() => goTo("health")} className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-full px-3 py-1.5 font-semibold transition-colors">
            {d.alerts.critical ? <XCircle className="w-3.5 h-3.5 text-red-200" /> : d.alerts.warning ? <AlertTriangle className="w-3.5 h-3.5 text-amber-200" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />}
            {d.alerts.critical || d.alerts.warning ? `${d.alerts.critical + d.alerts.warning} alert${d.alerts.critical + d.alerts.warning > 1 ? "s" : ""}` : "All healthy"}
          </button>
        </div>
      </div>

      {/* Today cards */}
      <div>
        <div className="flex items-baseline justify-between mb-3"><h2 className="text-base font-bold text-slate-900">Today <span className="text-xs font-normal text-slate-400">· India day, compared with the same time yesterday</span></h2></div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Conversions" icon={Activity} tone="blue" value={fmtNum(t.conversions)} prev={{ cur: t.conversions, prev: y.conversions }} spark={d.spark.conversions} />
          <StatCard label="Downloads" icon={Download} tone="emerald" value={fmtNum(t.downloads)} prev={{ cur: t.downloads, prev: y.downloads }} spark={d.spark.downloads} />
          <StatCard label="Visitors" icon={Users} tone="violet" value={fmtNum(t.visitors)} prev={{ cur: t.visitors, prev: y.visitors }} spark={d.spark.visitors} />
          <StatCard label="New sign-ups" icon={UserPlus} tone="cyan" value={fmtNum(t.signups)} prev={{ cur: t.signups, prev: y.signups }} spark={d.spark.signups} />
          <StatCard label="Errors" icon={AlertTriangle} tone="rose" value={fmtNum(t.failures)} invert prev={{ cur: t.failures, prev: y.failures }} spark={d.spark.failures} />
          <StatCard label="Revenue" icon={IndianRupee} tone="amber" value={revText} prev={{ cur: revTodayUsd, prev: revYUsd }} sub={rev.today.payments ? `${rev.today.payments} payment${rev.today.payments > 1 ? "s" : ""}` : "no payments yet today"} />
        </div>
        <p className="text-xs text-slate-400 mt-3">Success rate today: <span className={`font-semibold ${successRate >= 0.9 ? "text-emerald-600" : successRate >= 0.75 ? "text-amber-600" : "text-red-600"}`}>{(successRate * 100).toFixed(1)}%</span> · {fmtNum(d.totals.users)} users, {fmtNum(d.totals.paid)} paid</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Needs attention" subtitle="Live checks on servers, tools and payments" action={<button onClick={() => goTo("health")} className="text-xs font-semibold text-blue-600 hover:underline">All checks →</button>}>
          <AlertList items={d.alerts.items} compact />
        </Card>
        <Card className="lg:col-span-2" title="Top tools today" subtitle="Successful conversions" action={<button onClick={() => goTo("charts")} className="text-xs font-semibold text-blue-600 hover:underline">Analytics →</button>}>
          {d.topTools.length ? (
            <HBars items={d.topTools.map((x) => ({ label: x.tool, value: x.conversions, sub: x.errors ? `${x.errors} failed` : "" }))} color="#3b82f6" />
          ) : <EmptyState title="No conversions yet today" hint="They'll appear here as soon as someone converts a file." />}
        </Card>
      </div>

      {src.data && src.data.totals.visits > 0 && (
        <Card title="Where visitors come from" subtitle="Last 7 days · unique visitors by source" action={<button onClick={() => goTo("sources")} className="text-xs font-semibold text-blue-600 hover:underline">Traffic sources →</button>}>
          <HBars items={src.data.sources.slice(0, 6).map((x) => ({ label: x.source.charAt(0).toUpperCase() + x.source.slice(1), value: x.visitors, sub: x.medium }))} color="#10b981" />
        </Card>
      )}
    </div>
  )
}
