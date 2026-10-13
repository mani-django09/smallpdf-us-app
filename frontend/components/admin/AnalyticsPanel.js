// Analytics: trend charts (IST), tool performance table, audience breakdowns, CSV export.
import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Badge, Card, ErrorNote, RangeTabs, Skeleton, csvFromRows, fmtNum, pct, triggerBlobDownload, useAdminData, EmptyState } from "./adminUi"
import { AreaChart, Donut, HBars } from "./charts"
import { formatIST, timeAgo } from "../../lib/adminTime"

const PLAN_COLORS = { free: "#94a3b8", starter: "#f59e0b", pro: "#8b5cf6", agency: "#10b981" }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function AnalyticsPanel({ api, token, onUnauthorized }) {
  const [range, setRange] = useState("7d")
  const [view, setView] = useState("traffic")
  const [sortKey, setSortKey] = useState("attempts")
  const ts = useAdminData(api, `/timeseries?range=${range}`, token, { interval: 60000, onUnauthorized })
  const tools = useAdminData(api, `/tools?range=${range}`, token, { interval: 60000, onUnauthorized })

  const formatX = (t) => {
    if (range === "24h") { const h = Number(t.slice(11, 13)); return `${h % 12 || 12}${h < 12 ? "a" : "p"}` }
    const m = Number(t.slice(5, 7)) - 1; return `${Number(t.slice(8, 10))} ${MONTHS[m]}`
  }
  const formatTip = (t) => (range === "24h" ? `${formatX(t)} · ${Number(t.slice(8, 10))} ${MONTHS[Number(t.slice(5, 7)) - 1]} (IST)` : `${formatX(t)} ${t.slice(0, 4)}`)

  const series = view === "traffic"
    ? [{ key: "conversions", label: "Conversions", color: "#3b82f6" }, { key: "downloads", label: "Downloads", color: "#10b981" }]
    : view === "visitors"
      ? [{ key: "visitors", label: "Visitors", color: "#8b5cf6" }, { key: "signups", label: "Sign-ups", color: "#06b6d4" }]
      : [{ key: "failures", label: "Errors", color: "#f43f5e" }]

  const totals = useMemo(() => {
    if (!ts.data) return null
    const p = ts.data.points
    const sum = (k) => p.reduce((a, x) => a + x[k], 0)
    const conv = sum("conversions"), fail = sum("failures")
    return { conv, down: sum("downloads"), fail, sign: sum("signups"), visitors: sum("visitors"), rate: conv + fail ? conv / (conv + fail) : 1 }
  }, [ts.data])

  const sortedTools = useMemo(() => {
    if (!tools.data) return []
    const arr = [...tools.data.tools]
    arr.sort((a, b) => (sortKey === "tool" ? a.tool.localeCompare(b.tool) : (b[sortKey] || 0) - (a[sortKey] || 0)))
    return arr
  }, [tools.data, sortKey])

  const exportTimeseries = () => {
    if (!ts.data) return
    triggerBlobDownload(csvFromRows(["Time (IST)", "Conversions", "Downloads", "Uploads", "Errors", "Visitors", "Sign-ups"],
      ts.data.points.map((p) => [p.t, p.conversions, p.downloads, p.uploads, p.failures, p.visitors, p.signups])), `traffic-${range}.csv`)
  }
  const exportTools = () => {
    if (!tools.data) return
    triggerBlobDownload(csvFromRows(["Tool", "Conversions", "Failed", "Error rate", "Downloads", "Visitors", "Last used (IST)"],
      tools.data.tools.map((t) => [t.tool, t.success, t.errors, (t.errorRate * 100).toFixed(1) + "%", t.downloads, t.visitors, formatIST(t.lastUsed)])), `tools-${range}.csv`)
  }

  const Th = ({ k, children, right }) => (
    <th onClick={() => setSortKey(k)} className={`px-3 py-2 font-semibold text-xs text-slate-500 cursor-pointer select-none hover:text-slate-900 ${right ? "text-right" : "text-left"}`}>{children}{sortKey === k ? " ↓" : ""}</th>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-bold text-slate-900">Analytics</h2><p className="text-xs text-slate-400">All times and days are India Standard Time.</p></div>
        <div className="flex items-center gap-2">
          <RangeTabs value={range} onChange={setRange} />
          <button onClick={exportTimeseries} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"><Download className="w-3.5 h-3.5" />CSV</button>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[["Conversions", fmtNum(totals.conv), "text-blue-600"], ["Downloads", fmtNum(totals.down), "text-emerald-600"], ["Sign-ups", fmtNum(totals.sign), "text-cyan-600"], ["Errors", fmtNum(totals.fail), "text-rose-600"], ["Success rate", pct(totals.rate, 1), totals.rate >= 0.9 ? "text-emerald-600" : "text-amber-600"]].map(([l, v, c]) => (
            <div key={l} className="bg-white border border-slate-200 rounded-xl px-4 py-3"><div className="text-xs text-slate-500">{l} <span className="text-slate-300">· {range}</span></div><div className={`text-xl font-bold ${c}`}>{v}</div></div>
          ))}
        </div>
      )}

      <Card title="Trend" action={<div className="inline-flex bg-slate-100 rounded-lg p-0.5">{[["traffic", "Traffic"], ["visitors", "Audience"], ["errors", "Errors"]].map(([k, l]) => (<button key={k} onClick={() => setView(k)} className={`px-3 py-1 text-xs font-semibold rounded-md ${view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{l}</button>))}</div>}>
        {ts.loading && !ts.data ? <Skeleton className="h-64" /> : ts.error && !ts.data ? <ErrorNote error={ts.error} onRetry={ts.reload} /> : <AreaChart points={ts.data.points} series={series} formatX={formatX} formatTip={formatTip} />}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Tool performance" subtitle={`Last ${range} vs the ${range} before`} pad={false}
          action={<button onClick={exportTools} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"><Download className="w-3.5 h-3.5" />CSV</button>}>
          {tools.loading && !tools.data ? <div className="p-5"><Skeleton className="h-64" /></div> : tools.error && !tools.data ? <div className="p-5"><ErrorNote error={tools.error} onRetry={tools.reload} /></div> : !sortedTools.length ? <EmptyState title="No tool activity in this period" /> : (
            <div className="overflow-x-auto max-h-[480px]">
              <table className="min-w-full text-sm mt-2">
                <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-200"><Th k="tool">Tool</Th><Th k="attempts" right>Used</Th><Th k="errors" right>Failed</Th><Th k="errorRate" right>Error rate</Th><Th k="visitors" right>Visitors</Th><th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Trend</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTools.map((t) => {
                    const change = t.prevAttempts ? (t.attempts - t.prevAttempts) / t.prevAttempts : null
                    return (
                      <tr key={t.tool} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-800" title={t.lastUsed ? `Last used ${formatIST(t.lastUsed)}` : ""}>{t.tool}<div className="text-[11px] font-normal text-slate-400">{t.lastUsed ? timeAgo(t.lastUsed) : ""}</div></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(t.attempts)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{t.errors ? <span className="text-rose-600">{fmtNum(t.errors)}</span> : <span className="text-slate-300">0</span>}</td>
                        <td className="px-3 py-2.5 text-right"><Badge tone={t.errorRate >= 0.25 ? "red" : t.errorRate >= 0.1 ? "amber" : "green"}>{pct(t.errorRate, 1)}</Badge></td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtNum(t.visitors)}</td>
                        <td className="px-3 py-2.5 text-right text-xs">{change === null ? <span className="text-violet-600 font-semibold">new</span> : <span className={change >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change * 100).toFixed(0)}%</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Users by plan">
            {tools.data ? (
              <Donut center={<><div className="text-xl font-bold text-slate-900">{fmtNum(tools.data.plans.reduce((a, p) => a + p.n, 0))}</div><div className="text-[11px] text-slate-400">users</div></>}
                items={tools.data.plans.map((p) => ({ label: p.plan, value: p.n, color: PLAN_COLORS[p.plan] || "#64748b" }))} />
            ) : <Skeleton className="h-36" />}
          </Card>
          <Card title="Top countries" subtitle="Unique visitors">
            {tools.data ? <HBars items={tools.data.breakdowns.countries.map((c) => ({ label: c.name, value: c.n }))} color="#06b6d4" empty="No location data" /> : <Skeleton className="h-32" />}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[["Devices", "devices", "#6366f1"], ["Browsers", "browsers", "#f59e0b"], ["Operating systems", "systems", "#10b981"]].map(([title, key, color]) => (
          <Card key={key} title={title} subtitle="Unique visitors">
            {tools.data ? <HBars items={tools.data.breakdowns[key].map((c) => ({ label: c.name, value: c.n }))} color={color} /> : <Skeleton className="h-32" />}
          </Card>
        ))}
      </div>
    </div>
  )
}
