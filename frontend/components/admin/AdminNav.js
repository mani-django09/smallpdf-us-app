// Sidebar + top bar for the admin dashboard (responsive: sidebar becomes a slide-in menu on phones).
import { Bell, FileText, Globe2, HeartPulse, LayoutDashboard, LineChart, LogOut, Menu, Moon, RefreshCw, ScrollText, Shield, Sun, Users, Wallet, X } from "lucide-react"
import { useAdminData } from "./adminUi"

export const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "charts", label: "Analytics", icon: LineChart },
  { id: "sources", label: "Traffic sources", icon: Globe2 },
  { id: "revenue", label: "Revenue", icon: Wallet },
  { id: "health", label: "Health & alerts", icon: HeartPulse, alert: true },
  { id: "users", label: "Users", icon: Users },
  { id: "logs", label: "Logs & IPs", icon: ScrollText },
]

function useAlertCounts(api, token, onUnauthorized) {
  const { data } = useAdminData(api, "/overview", token, { interval: 60000, onUnauthorized })
  return data ? data.alerts : { critical: 0, warning: 0 }
}

export function Sidebar({ api, token, onUnauthorized, active, onSelect, open, onClose, onBlog, userCount }) {
  const alerts = useAlertCounts(api, token, onUnauthorized)
  const badge = alerts.critical + alerts.warning
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/30"><Shield className="w-5 h-5 text-white" /></div>
            <div className="leading-tight"><div className="text-sm font-bold text-slate-900">SmallPDF.us</div><div className="text-[11px] text-slate-400">Admin console</div></div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close menu"><X className="w-4 h-4" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map(({ id, label, icon: Icon, alert }) => {
            const on = active === id
            return (
              <button key={id} onClick={() => { onSelect(id); onClose() }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${on ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon className={`w-[18px] h-[18px] ${on ? "text-blue-600" : "text-slate-400"}`} />
                <span>{label}</span>
                {alert && badge > 0 && <span className={`ml-auto text-[11px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center text-white ${alerts.critical ? "bg-red-500" : "bg-amber-500"}`}>{badge}</span>}
                {id === "users" && userCount ? <span className="ml-auto text-[11px] font-semibold text-slate-400">{userCount}</span> : null}
              </button>
            )
          })}
          <div className="pt-3 mt-3 border-t border-slate-200">
            <button onClick={onBlog} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"><FileText className="w-[18px] h-[18px] text-slate-400" />Blog admin</button>
          </div>
        </nav>
        <div className="p-4 border-t border-slate-200 text-[11px] text-slate-400">All times in IST (UTC+5:30)</div>
      </aside>
    </>
  )
}

export function TopBar({ api, token, onUnauthorized, title, clock, dark, onToggleDark, onRefresh, refreshing, onLogout, onMenu, onGoHealth }) {
  const alerts = useAlertCounts(api, token, onUnauthorized)
  const badge = alerts.critical + alerts.warning
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center gap-3">
      <button onClick={onMenu} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Open menu"><Menu className="w-5 h-5" /></button>
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h1>
        {clock && (
          <p className="text-[11px] font-mono text-indigo-600 flex items-center gap-1.5" suppressHydrationWarning>
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" /></span>{clock}
          </p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button onClick={onGoHealth} className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600" title={badge ? `${badge} alert(s)` : "No alerts"} aria-label="Alerts">
          <Bell className="w-5 h-5" />{badge > 0 && <span className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${alerts.critical ? "bg-red-500" : "bg-amber-500"}`}>{badge}</span>}
        </button>
        <button onClick={onToggleDark} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title={dark ? "Light mode" : "Dark mode"} aria-label="Toggle theme">{dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
        <button onClick={onRefresh} disabled={refreshing} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Refresh" aria-label="Refresh"><RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} /></button>
        <button onClick={onLogout} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">Logout</span></button>
      </div>
    </header>
  )
}
