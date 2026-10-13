// Shared building blocks for the admin dashboard panels.
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowUpRight, ArrowDownRight, Minus, Loader2 } from "lucide-react"
import { Sparkline } from "./charts"

export const fmtNum = (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : new Intl.NumberFormat("en-IN").format(Math.round(n)))
export const fmtCompact = (n) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0)
export const fmtMoney = (n, cur = "USD") =>
  (cur === "INR" ? "₹" : "$") + new Intl.NumberFormat("en-IN", { maximumFractionDigits: n % 1 ? 2 : 0 }).format(n || 0)
export const fmtBytes = (b) => {
  if (!b && b !== 0) return "—"
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0, v = b
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}
export const fmtDuration = (sec) => {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}
export const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`

// Fetch a dashboard endpoint (optionally polling). 401 → session over.
export function useAdminData(api, path, token, { interval = 0, onUnauthorized } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)
  // Keep the callback in a ref, NOT in load's deps: the admin page re-renders
  // every second (IST clock) and passes a fresh onUnauthorized each time, which
  // re-created `load` and re-ran the fetch effect once a second per panel —
  // ~100 requests a minute, enough for nginx to answer 429 to the dashboard.
  const onUnauthorizedRef = useRef(onUnauthorized)
  onUnauthorizedRef.current = onUnauthorized
  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true)
    try {
      const res = await fetch(`${api}/api/admin/dash${path}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) { onUnauthorizedRef.current && onUnauthorizedRef.current(); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (alive.current) { setData(json); setError("") }
    } catch (e) { if (alive.current) setError(e.message || "Failed to load") }
    finally { if (alive.current) setLoading(false) }
  }, [api, path, token])
  useEffect(() => { alive.current = true; load(false); return () => { alive.current = false } }, [load])
  useEffect(() => {
    if (!interval) return
    const t = setInterval(() => load(true), interval)
    return () => clearInterval(t)
  }, [interval, load])
  return { data, error, loading, reload: () => load(false) }
}

// Authenticated CSV download (the token can't ride on a plain <a href>).
export async function downloadCsv(api, path, token, filename) {
  const res = await fetch(`${api}/api/admin/dash${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Export failed (${res.status})`)
  triggerBlobDownload(await res.blob(), filename)
}
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}
export function csvFromRows(headers, rows) {
  const cell = (v) => { let s = v === null || v === undefined ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return new Blob(["﻿" + [headers.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n")], { type: "text/csv;charset=utf-8" })
}

export function Card({ title, subtitle, action, children, className = "", pad = true }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  )
}

export function Skeleton({ className = "h-24" }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />
}

export function Spinner({ label = "Loading…" }) {
  return <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" />{label}</div>
}

export function ErrorNote({ error, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 flex items-center justify-between">
      <span>Could not load this section ({error}).</span>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">Retry</button>}
    </div>
  )
}

// ▲ +12% / ▼ 8% — `invert` for metrics where up is bad (errors)
export function Delta({ cur, prev, invert = false, suffix = "vs yesterday" }) {
  if (prev === undefined || prev === null) return null
  if (!prev && !cur) return <span className="text-[11px] text-slate-400 inline-flex items-center gap-0.5"><Minus className="w-3 h-3" /> no change</span>
  if (!prev) return <span className="text-[11px] font-medium text-emerald-600 inline-flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />new {suffix}</span>
  const change = (cur - prev) / prev
  const up = change > 0, flat = Math.abs(change) < 0.005
  const good = flat ? null : invert ? !up : up
  const tone = flat ? "text-slate-400" : good ? "text-emerald-600" : "text-red-600"
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return <span className={`text-[11px] font-medium inline-flex items-center gap-0.5 ${tone}`}><Icon className="w-3 h-3" />{flat ? "0%" : `${Math.abs(change * 100).toFixed(0)}%`}<span className="text-slate-400 font-normal ml-1">{suffix}</span></span>
}

const TONES = {
  blue: { chip: "bg-blue-50 text-blue-600", line: "#3b82f6" },
  emerald: { chip: "bg-emerald-50 text-emerald-600", line: "#10b981" },
  violet: { chip: "bg-violet-50 text-violet-600", line: "#8b5cf6" },
  amber: { chip: "bg-amber-50 text-amber-600", line: "#f59e0b" },
  rose: { chip: "bg-rose-50 text-rose-600", line: "#f43f5e" },
  cyan: { chip: "bg-cyan-50 text-cyan-600", line: "#06b6d4" },
  slate: { chip: "bg-slate-100 text-slate-600", line: "#64748b" },
}
export const toneColor = (t) => (TONES[t] || TONES.blue).line

export function StatCard({ label, value, prev, icon: Icon, tone = "blue", spark, invert, sub, suffix }) {
  const t = TONES[tone] || TONES.blue
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col gap-2 min-w-0 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {Icon && <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.chip}`}><Icon className="w-4 h-4" /></span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-2xl font-bold text-slate-900 tracking-tight truncate">{value}</div>
          {sub ? <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div> : <Delta cur={typeof prev === "object" ? prev.cur : undefined} prev={typeof prev === "object" ? prev.prev : prev} invert={invert} suffix={suffix} />}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} color={t.line} width={84} height={34} />}
      </div>
    </div>
  )
}

export function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-700", red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-700", violet: "bg-violet-100 text-violet-700",
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[tone] || map.slate}`}>{children}</span>
}

export function RangeTabs({ value, onChange, options = ["24h", "7d", "30d", "90d"] }) {
  return (
    <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${value === o ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{o}</button>
      ))}
    </div>
  )
}

export function EmptyState({ title, hint }) {
  return <div className="text-center py-8"><p className="text-sm font-medium text-slate-600">{title}</p>{hint && <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{hint}</p>}</div>
}
