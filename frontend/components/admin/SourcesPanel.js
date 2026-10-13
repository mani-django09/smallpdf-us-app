// Traffic sources: where visitors come from (direct / Google / Bing / social / AI chat / other sites),
// which of them go on to convert a file, top landing pages, UTM campaigns, countries and devices.
import { useState } from "react"
import { Bot, Globe2, Link2, MousePointerClick, Search, Share2, Users } from "lucide-react"
import { Badge, Card, ErrorNote, RangeTabs, Skeleton, StatCard, EmptyState, fmtNum, pct, useAdminData } from "./adminUi"
import { AreaChart, Donut, HBars } from "./charts"
import { formatIST, timeAgo } from "../../lib/adminTime"

const MEDIUM = {
  direct:   { label: "Direct",         color: "#64748b", tone: "slate" },
  organic:  { label: "Search engines", color: "#10b981", tone: "green" },
  social:   { label: "Social",         color: "#ec4899", tone: "violet" },
  ai:       { label: "AI chat",        color: "#8b5cf6", tone: "violet" },
  referral: { label: "Other websites", color: "#f59e0b", tone: "amber" },
  paid:     { label: "Paid ads",       color: "#ef4444", tone: "red" },
  campaign: { label: "Campaign links", color: "#06b6d4", tone: "blue" },
}
const mediumInfo = (m) => MEDIUM[m] || { label: m, color: "#06b6d4", tone: "blue" }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const FLAG = (cc) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : "")
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export default function SourcesPanel({ api, token, onUnauthorized }) {
  const [range, setRange] = useState("7d")
  const { data: d, error, loading, reload } = useAdminData(api, `/sources?range=${range}`, token, { interval: 60000, onUnauthorized })

  if (loading && !d) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>
  if (error && !d) return <ErrorNote error={error} onRetry={reload} />

  const T = d.totals
  const top = d.sources[0]
  const organic = d.mediums.find((m) => m.medium === "organic")
  const mediumKeys = d.mediums.map((m) => m.medium)
  const series = mediumKeys.map((m) => ({ key: m, label: mediumInfo(m).label, color: mediumInfo(m).color }))
  const fmtDay = (t) => `${Number(t.slice(8, 10))} ${MONTHS[Number(t.slice(5, 7)) - 1]}`
  const empty = T.visits === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Traffic sources</h2>
          <p className="text-xs text-slate-400">
            Where visitors landed from. {d.since ? `Tracking since ${formatIST(d.since, { seconds: false })} IST` : "No visits recorded yet"}
            {d.backfilledVisits ? ` · older history rebuilt from server logs (${fmtNum(d.backfilledVisits)} visits, approximate)` : ""}.
          </p>
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {empty ? (
        <Card><EmptyState title="No visits in this period yet" hint="New visits appear here within a minute. Each browser session is counted once, using the page's referrer and any utm_ tags." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Visits" icon={MousePointerClick} tone="blue" value={fmtNum(T.visits)} sub={`${fmtNum(T.visitors)} unique visitors`} />
            <StatCard label="Top source" icon={Globe2} tone="violet" value={top ? cap(top.source) : "—"} sub={top ? `${fmtNum(top.visitors)} visitors · ${mediumInfo(top.medium).label}` : ""} />
            <StatCard label="From search engines" icon={Search} tone="emerald" value={pct(organic ? organic.visits / T.visits : 0, 0)} sub={`${fmtNum(organic?.visitors || 0)} visitors (Google, Bing, …)`} />
            <StatCard label="Converted a file" icon={Users} tone="amber" value={pct(T.rate, 1)} sub={`${fmtNum(T.converted)} of ${fmtNum(T.visits)} visits (24 h)`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2" title="By channel" subtitle="Share of unique visitors">
              <Donut
                items={d.mediums.map((m) => ({ label: mediumInfo(m.medium).label, value: m.visitors, color: mediumInfo(m.medium).color }))}
                center={<><div className="text-xl font-bold text-slate-900">{fmtNum(T.visitors)}</div><div className="text-[11px] text-slate-400">visitors</div></>}
              />
            </Card>
            <Card className="lg:col-span-3" title="Visitors per day by channel" subtitle="India time">
              <AreaChart points={d.trend} series={series} stacked formatX={fmtDay} formatTip={(t) => `${fmtDay(t)} ${t.slice(0, 4)}`} height={220} />
            </Card>
          </div>

          <Card title="All sources" subtitle="Which visitors turn into real usage" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Source</th><th className="px-3 py-3 font-medium">Channel</th>
                  <th className="px-3 py-3 font-medium text-right">Visitors</th><th className="px-3 py-3 font-medium text-right">Visits</th>
                  <th className="px-3 py-3 font-medium text-right">Share</th><th className="px-5 py-3 font-medium text-right">Used a tool</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {d.sources.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 font-medium text-slate-800">{cap(s.source)}</td>
                      <td className="px-3 py-2.5"><Badge tone={mediumInfo(s.medium).tone}>{mediumInfo(s.medium).label}</Badge></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(s.visitors)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmtNum(s.visits)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{pct(T.visits ? s.visits / T.visits : 0, 1)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums"><span className={s.rate >= 0.3 ? "text-emerald-600 font-semibold" : s.rate < 0.1 ? "text-slate-400" : ""}>{pct(s.rate, 0)}</span> <span className="text-xs text-slate-400">({fmtNum(s.converted)})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Websites sending traffic" subtitle="Referring domains (search engines included)">
              <HBars items={d.referrers.map((r) => ({ label: r.host, value: r.visitors }))} color="#f59e0b" empty="No referrals yet — all visits were direct" />
            </Card>
            <Card title="Top landing pages" subtitle="First page of the visit and its main source">
              <HBars items={d.landing.map((l) => ({ label: l.path, value: l.visitors, sub: l.topSource ? `mostly ${l.topSource}` : "" }))} color="#3b82f6" />
            </Card>
            <Card title="Countries" subtitle="From Cloudflare's country header">
              <HBars items={d.countries.map((c) => ({ label: `${FLAG(c.country)} ${c.country}`, value: c.visitors }))} color="#06b6d4" empty="Country is recorded for new visits only" />
            </Card>
            <Card title="Campaign links (utm_campaign)" subtitle="Links you tagged yourself — Pinterest, newsletters, ads">
              <HBars items={d.campaigns.map((c) => ({ label: `${c.campaign} · ${c.source}`, value: c.visitors }))} color="#ec4899" empty="No tagged links yet. Add ?utm_source=pinterest&utm_campaign=name to links you share." />
            </Card>
          </div>

          <Card title="Latest visits" subtitle="Newest first" pad={false}>
            <ul className="divide-y divide-slate-100">
              {d.recent.map((v, i) => (
                <li key={i} className="px-5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Badge tone={mediumInfo(v.medium).tone}>{cap(v.source)}</Badge>
                  <span className="font-mono text-xs text-slate-600 truncate max-w-[16rem]">{v.landing}</span>
                  {v.ref_host && <span className="text-xs text-slate-400 inline-flex items-center gap-1"><Link2 className="w-3 h-3" />{v.ref_host}</span>}
                  <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">{v.country ? `${FLAG(v.country)} ` : ""}{v.device || ""} · <span title={formatIST(v.created_at)}>{timeAgo(v.created_at)}</span></span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
