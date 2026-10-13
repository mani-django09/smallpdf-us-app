// Small dependency-free SVG charts for the admin dashboard.
import { useMemo, useRef, useState } from "react"

// Smooth line through points (Catmull-Rom → cubic Bézier, clamped so it never overshoots below 0)
function smoothPath(pts, floor) {
  if (pts.length < 2) return ""
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1y = Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6), c2y = Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6)
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c1y} ${p2[0] - (p3[0] - p1[0]) / 6},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

export function Sparkline({ values, color = "#3b82f6", width = 90, height = 32 }) {
  const { line, area } = useMemo(() => {
    const max = Math.max(...values, 1), min = 0, n = values.length
    const pts = values.map((v, i) => [(i / (n - 1)) * (width - 2) + 1, height - 3 - ((v - min) / (max - min || 1)) * (height - 8)])
    const l = smoothPath(pts, height - 2)
    return { line: l, area: `${l} L${width - 1},${height} L1,${height} Z` }
  }, [values, width, height])
  const gid = useMemo(() => "sp" + Math.random().toString(36).slice(2, 8), [])
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// Multi-series area/line chart with hover tooltip. points: [{t, ...values}]
export function AreaChart({ points, series, height = 260, formatX = (t) => t, formatTip = (t) => t, stacked = false }) {
  const wrap = useRef(null)
  const [hover, setHover] = useState(null)
  const W = 800, H = height, m = { l: 40, r: 12, t: 12, b: 26 }
  const iw = W - m.l - m.r, ih = H - m.t - m.b
  const n = points.length
  const gid = useMemo(() => "ac" + Math.random().toString(36).slice(2, 8), [])
  const max = useMemo(() => {
    const raw = Math.max(1, ...points.map((p) => (stacked ? series.reduce((a, s) => a + (p[s.key] || 0), 0) : Math.max(...series.map((s) => p[s.key] || 0)))))
    const pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
  }, [points, series, stacked])
  const x = (i) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v) => m.t + ih - (v / max) * ih
  const paths = series.map((s) => {
    const pts = points.map((p, i) => [x(i), y(p[s.key] || 0)])
    const line = smoothPath(pts, m.t + ih)
    return { s, line, area: `${line} L${x(n - 1)},${m.t + ih} L${x(0)},${m.t + ih} Z` }
  })
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const labelEvery = Math.max(1, Math.ceil(n / 8))
  const onMove = (e) => {
    const r = wrap.current.getBoundingClientRect()
    const rel = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((rel - m.l) / iw) * (n - 1)))))
  }
  const hp = hover !== null ? points[hover] : null
  return (
    <div ref={wrap} className="relative w-full select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchMove={(e) => onMove(e.touches[0])}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
        <defs>{series.map((s) => (<linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".28" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>))}</defs>
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={m.l} x2={W - m.r} y1={y(tv)} y2={y(tv)} stroke="currentColor" className="text-slate-200" strokeDasharray={i === 0 ? "" : "3 4"} />
            <text x={m.l - 6} y={y(tv) + 3} textAnchor="end" className="fill-slate-400" fontSize="10">{tv >= 1000 ? `${(tv / 1000).toFixed(tv % 1000 ? 1 : 0)}k` : Math.round(tv)}</text>
          </g>
        ))}
        {points.map((p, i) => i % labelEvery === 0 && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize="10">{formatX(p.t)}</text>)}
        {paths.map(({ s, line, area }) => (<g key={s.key}><path d={area} fill={`url(#${gid}-${s.key})`} /><path d={line} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></g>))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="currentColor" className="text-slate-300" />
            {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(hp[s.key] || 0)} r="4" fill="#fff" stroke={s.color} strokeWidth="2.2" />)}
          </g>
        )}
      </svg>
      {hp && (
        <div className="pointer-events-none absolute z-10 bg-slate-900 text-white text-xs rounded-lg shadow-lg px-3 py-2 whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 4, transform: `translateX(${hover > n * 0.65 ? "-105%" : "8%"})` }}>
          <div className="font-semibold mb-1 text-slate-200">{formatTip(hp.t)}</div>
          {series.map((s) => (<div key={s.key} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}<span className="ml-auto pl-4 font-semibold">{new Intl.NumberFormat("en-IN").format(hp[s.key] || 0)}</span></div>))}
        </div>
      )}
      <div className="flex flex-wrap gap-4 justify-center mt-1">
        {series.map((s) => (<span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>))}
      </div>
    </div>
  )
}

// Horizontal bars. items: [{label, value, sub?, color?}]
export function HBars({ items, format = (v) => new Intl.NumberFormat("en-IN").format(v), color = "#6366f1", empty = "No data yet" }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="text-sm text-slate-400 py-4 text-center">{empty}</p>
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-center justify-between text-xs mb-1 gap-2">
            <span className="font-medium text-slate-700 truncate">{it.label}</span>
            <span className="text-slate-500 shrink-0">{format(it.value)}{it.sub ? <span className="text-slate-400 ml-1.5">{it.sub}</span> : null}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: it.color || color }} /></div>
        </li>
      ))}
    </ul>
  )
}

// Donut with legend. items: [{label, value, color}]
export function Donut({ items, center, size = 150 }) {
  const total = items.reduce((a, i) => a + i.value, 0)
  const r = 52, c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="flex items-center gap-5 flex-wrap justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" width={size} height={size} className="-rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" className="text-slate-100" strokeWidth="16" />
          {total > 0 && items.map((it) => {
            const len = (it.value / total) * c, dash = `${Math.max(0, len - 1.5)} ${c - Math.max(0, len - 1.5)}`, off = -acc
            acc += len
            return <circle key={it.label} cx="70" cy="70" r={r} fill="none" stroke={it.color} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={off} />
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: it.color }} /><span className="text-slate-600">{it.label}</span><span className="font-semibold text-slate-900 ml-auto pl-3">{new Intl.NumberFormat("en-IN").format(it.value)}</span></li>
        ))}
      </ul>
    </div>
  )
}

// Circular gauge 0-100 (system health)
export function Gauge({ value, label, sub, warnAt = 75, critAt = 90 }) {
  const v = Math.max(0, Math.min(100, value || 0))
  const color = v >= critAt ? "#ef4444" : v >= warnAt ? "#f59e0b" : "#10b981"
  const r = 34, c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 84 84" className="w-24 h-24 -rotate-90"><circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" className="text-slate-100" strokeWidth="8" />
          <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .6s" }} /></svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-900">{v.toFixed(0)}%</div>
      </div>
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 -mt-0.5">{sub}</div>}
    </div>
  )
}
