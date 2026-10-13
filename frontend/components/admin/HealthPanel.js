// Health: server gauges, app vitals, live alerts, recent error messages.
import { Cpu, Database, HardDrive, MemoryStick, Server, Timer } from "lucide-react"
import { Badge, Card, EmptyState, ErrorNote, Skeleton, fmtBytes, fmtDuration, fmtNum, useAdminData } from "./adminUi"
import { Gauge } from "./charts"
import { AlertList } from "./OverviewPanel"
import { formatIST, timeAgo } from "../../lib/adminTime"

const Vital = ({ icon: Icon, label, value, sub, tone = "slate" }) => (
  <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
    <span className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500"><Icon className="w-4 h-4" /></span>
    <div className="min-w-0"><div className="text-[11px] text-slate-500">{label}</div><div className={`text-sm font-semibold truncate ${tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-slate-900"}`}>{value}</div>{sub && <div className="text-[11px] text-slate-400 truncate">{sub}</div>}</div>
  </div>
)

export default function HealthPanel({ api, token, onUnauthorized }) {
  const { data, error, loading, reload } = useAdminData(api, "/health", token, { interval: 15000, onUnauthorized })
  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />
  const { system: s, app: a, alerts, recentErrors } = data
  const up = a.uploads
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-slate-900">Health &amp; alerts</h2><p className="text-xs text-slate-400">Refreshes every 15 seconds · last check {formatIST(data.generatedAt, { seconds: true })}</p></div>
        <Badge tone={alerts.some((x) => x.level === "critical") ? "red" : alerts.some((x) => x.level === "warning") ? "amber" : "green"}>{alerts.some((x) => x.level === "critical") ? "Action needed" : alerts.some((x) => x.level === "warning") ? "Warnings" : "Healthy"}</Badge></div>

      <Card title={`Alerts (${alerts.length})`}><AlertList items={alerts} /></Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Server" subtitle={s.platform} className="lg:col-span-2">
          <div className="flex flex-wrap justify-around gap-6 py-2">
            <Gauge value={s.loadPct} label="CPU load" sub={`${s.load[0]} · ${s.cpus} cores`} warnAt={60} critAt={90} />
            <Gauge value={s.memory.usedPct} label="Memory" sub={`${fmtBytes(s.memory.used)} / ${fmtBytes(s.memory.total)}`} warnAt={80} critAt={92} />
            {s.disk ? <Gauge value={s.disk.usedPct} label="Disk" sub={`${fmtBytes(s.disk.used)} / ${fmtBytes(s.disk.total)}`} warnAt={80} critAt={90} /> : null}
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">Server up for {fmtDuration(s.uptimeSeconds)}</p>
        </Card>
        <Card title="Backend app">
          <div className="space-y-2.5">
            <Vital icon={Server} label="Node.js" value={a.node} sub={`pid ${a.pid} · up ${fmtDuration(a.uptimeSeconds)}`} />
            <Vital icon={MemoryStick} label="App memory" value={fmtBytes(a.rss)} sub={`heap ${fmtBytes(a.heapUsed)} / ${fmtBytes(a.heapTotal)}`} />
            <Vital icon={Database} label="Database" value={fmtBytes(a.dbBytes)} sub={`query ${a.dbLatencyMs} ms`} tone={a.dbLatencyMs > 200 ? "warn" : "slate"} />
            <Vital icon={HardDrive} label="Temp files (uploads/)" value={`${fmtNum(up.files)} files · ${fmtBytes(up.bytes)}${up.sampled ? "+" : ""}`} sub={up.oldFiles ? `${up.oldFiles} older than 2 h` : "cleanup keeping up"} tone={up.oldFiles > 150 ? "warn" : "slate"} />
            <Vital icon={Timer} label="Errors in the last hour" value={fmtNum(a.errorsLastHour)} tone={a.errorsLastHour > 50 ? "bad" : a.errorsLastHour > 15 ? "warn" : "slate"} />
          </div>
        </Card>
      </div>

      <Card title="What's failing (last 24 h)" subtitle="Grouped by tool and message — fix the top ones first" pad={false}>
        {recentErrors.length ? (
          <ul className="divide-y divide-slate-100">{recentErrors.map((e, i) => (
            <li key={i} className="px-5 py-3 flex items-start gap-3"><Badge tone="red">{e.n}×</Badge>
              <div className="min-w-0"><div className="text-sm text-slate-800 break-words">{e.message}</div><div className="text-[11px] text-slate-400 mt-0.5">{e.tool || "general"} · last <span title={formatIST(e.last)}>{timeAgo(e.last)}</span></div></div></li>))}</ul>
        ) : <EmptyState title="No errors in the last 24 hours" hint="Nice — nothing to fix." />}
      </Card>
    </div>
  )
}
