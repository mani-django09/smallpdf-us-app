import { useState, useEffect } from "react"
import {
  Activity,
  Download,
  Upload,
  AlertCircle,
  TrendingUp,
  Users,
  FileText,
  Shield,
  Clock,
  Filter,
  RefreshCw,
  LogOut,
  BarChart3,
  Eye,
  Search,
  Calendar,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Chrome,
  MapPin,
  Zap,
  TrendingDown,
  Ban,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Crown,
  UserCheck,
  UserX,
  Star,
} from "lucide-react"

const API = typeof window !== "undefined"
  ? (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:5011"
      : `${window.location.protocol}//${window.location.hostname}`)
  : "http://localhost:5011"

export default function EnhancedAdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [token, setToken] = useState(null)
  const [activeTab, setActiveTab] = useState("analytics") // "analytics" | "users"
  const [stats, setStats] = useState(null)
  const [activityLogs, setActivityLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    type: "",
    action: "",
    status: "",
    tool: "",
    ipAddress: "",
  })
  const [selectedLog, setSelectedLog] = useState(null)
  const [selectedIP, setSelectedIP] = useState(null)
  const [ipDetails, setIPDetails] = useState(null)
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    tools: true,
    browsers: true,
    devices: true,
    ips: false,
    errors: false,
    activity: true,
  })

  // ── Users tab state ─────────────────────────────────────────────────────────
  const [userStats, setUserStats] = useState(null)
  const [users, setUsers] = useState([])
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [userFilters, setUserFilters] = useState({ search: "", plan: "", verified: "" })
  const [usersLoading, setUsersLoading] = useState(false)
  const [changingPlan, setChangingPlan] = useState(null)   // userId being edited
  const [pendingPlan, setPendingPlan] = useState("")

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok) {
        setToken(data.token)
        setIsAuthenticated(true)
        // Store token for blog admin
        localStorage.setItem('adminToken', data.token)
        fetchDashboardData(data.token)
      } else {
        setError(data.error || "Login failed")
      }
    } catch (err) {
      setError("Failed to connect to server. Make sure the backend is running on port 5011.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setToken(null)
    setStats(null)
    setActivityLogs([])
    localStorage.removeItem('adminToken')
  }

  const handleBlogAdminClick = () => {
    if (token) {
      localStorage.setItem('adminToken', token)
      window.location.href = '/admin/blog'
    }
  }

  const fetchDashboardData = async (authToken) => {
    try {
      const statsResponse = await fetch(`${API}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!statsResponse.ok) {
        throw new Error(`Stats request failed: ${statsResponse.status}`)
      }

      const statsData = await statsResponse.json()
      setStats(statsData)

      fetchActivityLogs(authToken, 1)
      fetchUserStats(authToken)
      fetchUsers(authToken, 1, {})
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(`Failed to load dashboard data: ${err.message}`)
    }
  }

  const fetchActivityLogs = async (authToken, page = 1) => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: page,
        limit: 50,
        ...filters,
      })

      const response = await fetch(`${API}/api/admin/activity?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        throw new Error(`Activity logs request failed: ${response.status}`)
      }

      const data = await response.json()
      setActivityLogs(data.logs)
      setCurrentPage(data.pagination.page)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      console.error("Error fetching logs:", err)
      setError(`Failed to load activity logs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchIPDetails = async (ipAddress) => {
    try {
      const response = await fetch(`${API}/api/admin/ip/${ipAddress}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setIPDetails(data)
        setSelectedIP(ipAddress)
      }
    } catch (err) {
      console.error("Error fetching IP details:", err)
    }
  }

  const toggleIPBlock = async (ipAddress, currentlyBlocked) => {
    try {
      const response = await fetch(`${API}/api/admin/ip/${ipAddress}/block`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ blocked: !currentlyBlocked }),
      })

      if (response.ok) {
        fetchDashboardData(token)
        if (selectedIP === ipAddress) {
          fetchIPDetails(ipAddress)
        }
      }
    } catch (err) {
      console.error("Error toggling IP block:", err)
    }
  }

  // ── Users tab helpers ───────────────────────────────────────────────────────
  const fetchUserStats = async (authToken) => {
    try {
      const res = await fetch(`${API}/api/admin/users/stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setUserStats(await res.json())
    } catch (err) { console.error("fetchUserStats:", err) }
  }

  const fetchUsers = async (authToken, page = 1, filters = {}) => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20, ...filters })
      const res = await fetch(`${API}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setUsersPage(data.pagination.page)
        setUsersTotalPages(data.pagination.totalPages)
        setUsersTotal(data.pagination.total)
      }
    } catch (err) { console.error("fetchUsers:", err) }
    finally { setUsersLoading(false) }
  }

  const toggleUserBan = async (userId, currentlyBanned) => {
    try {
      await fetch(`${API}/api/admin/users/${userId}/ban`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !currentlyBanned }),
      })
      fetchUsers(token, usersPage, userFilters)
      fetchUserStats(token)
    } catch (err) { console.error("toggleUserBan:", err) }
  }

  const changeUserPlan = async (userId, plan) => {
    try {
      await fetch(`${API}/api/admin/users/${userId}/plan`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      setChangingPlan(null)
      fetchUsers(token, usersPage, userFilters)
      fetchUserStats(token)
    } catch (err) { console.error("changeUserPlan:", err) }
  }

  const refreshData = () => {
    if (token) {
      fetchDashboardData(token)
      fetchUserStats(token)
      fetchUsers(token, usersPage, userFilters)
    }
  }

  const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A'
  
  const date = new Date(timestamp)
  
  if (isNaN(date.getTime())) return 'Invalid Date'
  
  // Always show full timestamp in IST
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  })
}
  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800 border-green-200"
      case "error":
      case "failed":
        return "bg-red-100 text-red-800 border-red-200"
      case "processing":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "blocked":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-slate-100 text-slate-800 border-slate-200"
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case "upload":
        return <Upload className="w-4 h-4" />
      case "download":
        return <Download className="w-4 h-4" />
      case "conversion":
        return <Activity className="w-4 h-4" />
      case "security_incident":
        return <Shield className="w-4 h-4" />
      case "admin":
        return <Users className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getBrowserIcon = (browser) => {
    switch (browser?.toLowerCase()) {
      case "chrome":
        return "🌐"
      case "firefox":
        return "🦊"
      case "safari":
        return "🧭"
      case "edge":
        return "🌊"
      case "opera":
        return "🎭"
      default:
        return "🌐"
    }
  }

  const getDeviceIcon = (device) => {
    switch (device?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />
      case "tablet":
        return <Tablet className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Enhanced Admin Panel</h1>
            <p className="text-slate-600 text-sm mt-2">SmallPDF.us Analytics & Monitoring</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Enter username"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Enter password"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
          
        </div>
      </div>
    )
  }

  // Loading state
  if (!stats || !stats.total) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-3 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium text-sm">Loading enhanced dashboard...</p>
        </div>
      </div>
    )
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Enhanced Admin Dashboard</h1>
                <p className="text-xs text-slate-500">Real-time Analytics & Monitoring</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tab switcher */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "analytics" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </button>
                <button
                  onClick={() => setActiveTab("users")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "users" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <Users className="w-4 h-4" />
                  Users
                  {userStats && <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{userStats.total}</span>}
                </button>
              </div>

              <button
                onClick={handleBlogAdminClick}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Blog Admin</span>
              </button>
              <button
                onClick={refreshData}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ══════════════════ USERS TAB ══════════════════ */}
        {activeTab === "users" && (
          <div>
            {/* User Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
              {[
                { label: "Total Users",    value: userStats?.total,          icon: Users,     color: "from-blue-500 to-indigo-600",   bg: "bg-blue-50" },
                { label: "Free",           value: userStats?.free_users,     icon: Users,     color: "from-slate-400 to-slate-600",   bg: "bg-slate-50" },
                { label: "Starter",        value: userStats?.starter_users,  icon: Star,      color: "from-yellow-400 to-orange-500", bg: "bg-yellow-50" },
                { label: "Pro",            value: userStats?.pro_users,      icon: Crown,     color: "from-purple-500 to-violet-600", bg: "bg-purple-50" },
                { label: "Agency",         value: userStats?.agency_users,   icon: Crown,     color: "from-emerald-500 to-teal-600",  bg: "bg-emerald-50" },
                { label: "New Today",      value: userStats?.new_today,      icon: TrendingUp, color: "from-green-500 to-emerald-600", bg: "bg-green-50" },
                { label: "New This Week",  value: userStats?.new_this_week,  icon: Calendar,  color: "from-cyan-500 to-blue-600",    bg: "bg-cyan-50" },
                { label: "New This Month", value: userStats?.new_this_month, icon: Calendar,  color: "from-rose-500 to-pink-600",    bg: "bg-rose-50" },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} rounded-xl border border-slate-200 p-4`}>
                  <div className={`w-9 h-9 bg-gradient-to-br ${s.color} rounded-lg flex items-center justify-center mb-2`}>
                    <s.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{s.value ?? "—"}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Paid vs Free visual bar */}
            {userStats && userStats.total > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-purple-500" />
                    Free vs Paid breakdown
                  </h3>
                  <span className="text-sm text-slate-500">{userStats.paid_users} paid / {userStats.free_users} free</span>
                </div>
                <div className="flex rounded-full overflow-hidden h-4 gap-0.5">
                  {userStats.free_users > 0 && <div className="bg-slate-300" style={{ width: `${(userStats.free_users / userStats.total) * 100}%` }} title={`Free: ${userStats.free_users}`} />}
                  {userStats.starter_users > 0 && <div className="bg-yellow-400" style={{ width: `${(userStats.starter_users / userStats.total) * 100}%` }} title={`Starter: ${userStats.starter_users}`} />}
                  {userStats.pro_users > 0 && <div className="bg-purple-500" style={{ width: `${(userStats.pro_users / userStats.total) * 100}%` }} title={`Pro: ${userStats.pro_users}`} />}
                  {userStats.agency_users > 0 && <div className="bg-emerald-500" style={{ width: `${(userStats.agency_users / userStats.total) * 100}%` }} title={`Agency: ${userStats.agency_users}`} />}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" />Free</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" />Starter</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" />Pro</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Agency</span>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or email…"
                    value={userFilters.search}
                    onChange={e => {
                      const f = { ...userFilters, search: e.target.value }
                      setUserFilters(f)
                      fetchUsers(token, 1, f)
                    }}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <select
                  value={userFilters.plan}
                  onChange={e => {
                    const f = { ...userFilters, plan: e.target.value }
                    setUserFilters(f)
                    fetchUsers(token, 1, f)
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">All Plans</option>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="agency">Agency</option>
                </select>
                <select
                  value={userFilters.verified}
                  onChange={e => {
                    const f = { ...userFilters, verified: e.target.value }
                    setUserFilters(f)
                    fetchUsers(token, 1, f)
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">All Verified Status</option>
                  <option value="true">Verified</option>
                  <option value="false">Unverified</option>
                </select>
                <span className="self-center text-sm text-slate-500 ml-auto">{usersTotal} users</span>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
              {usersLoading ? (
                <div className="p-12 text-center text-slate-500">Loading users…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Verified</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Auth</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Login</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No users found</td></tr>
                      ) : users.map(u => (
                        <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.is_banned ? "bg-red-50" : ""}`}>
                          {/* User name + email */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{u.email}</div>
                          </td>
                          {/* Plan badge */}
                          <td className="px-4 py-3">
                            {changingPlan === u.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  defaultValue={u.plan}
                                  onChange={e => setPendingPlan(e.target.value)}
                                  className="text-xs border border-slate-300 rounded px-2 py-1"
                                >
                                  {["free","starter","pro","agency"].map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <button onClick={() => changeUserPlan(u.id, pendingPlan || u.plan)} className="text-green-600 hover:text-green-800"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => setChangingPlan(null)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setChangingPlan(u.id); setPendingPlan(u.plan) }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border transition-all hover:opacity-80 ${
                                  u.plan === "pro" ? "bg-purple-100 text-purple-700 border-purple-200" :
                                  u.plan === "starter" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                                  u.plan === "agency" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                  "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                                title="Click to change plan"
                              >
                                {(u.plan === "pro" || u.plan === "agency") && <Crown className="w-3 h-3" />}
                                {u.plan}
                              </button>
                            )}
                          </td>
                          {/* Verified */}
                          <td className="px-4 py-3">
                            {u.email_verified
                              ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" />Yes</span>
                              : <span className="flex items-center gap-1 text-slate-400 text-xs"><XCircle className="w-3.5 h-3.5" />No</span>
                            }
                          </td>
                          {/* Auth provider */}
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-500">{u.is_google ? "🔵 Google" : "📧 Email"}</span>
                          </td>
                          {/* Joined */}
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                          {/* Last login */}
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{u.last_login_at ? formatDate(u.last_login_at) : "Never"}</td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleUserBan(u.id, u.is_banned)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                u.is_banned
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            >
                              {u.is_banned ? <><UserCheck className="w-3.5 h-3.5" />Unban</> : <><UserX className="w-3.5 h-3.5" />Ban</>}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {usersTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  disabled={usersPage <= 1}
                  onClick={() => { const p = usersPage - 1; setUsersPage(p); fetchUsers(token, p, userFilters) }}
                  className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                >← Prev</button>
                <span className="text-sm text-slate-600">Page {usersPage} of {usersTotalPages}</span>
                <button
                  disabled={usersPage >= usersTotalPages}
                  onClick={() => { const p = usersPage + 1; setUsersPage(p); fetchUsers(token, p, userFilters) }}
                  className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                >Next →</button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ ANALYTICS TAB ══════════════════ */}
        {activeTab === "analytics" && (
        <div>
        {/* Quick Stats Overview */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Overview
            </h2>
            <button
              onClick={() => toggleSection('overview')}
              className="p-1 hover:bg-slate-100 rounded"
            >
              {expandedSections.overview ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          
          {expandedSections.overview && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                {
                  label: "Total Conversions",
                  value: stats.total.conversions || 0,
                  change: stats.last24Hours.conversions || 0,
                  changeLabel: "24h",
                  icon: Activity,
                  color: "from-blue-500 to-indigo-600",
                  bgColor: "bg-blue-50",
                },
                {
                  label: "Total Downloads",
                  value: stats.total.downloads || 0,
                  change: stats.last24Hours.downloads || 0,
                  changeLabel: "24h",
                  icon: Download,
                  color: "from-green-500 to-emerald-600",
                  bgColor: "bg-green-50",
                },
                {
                  label: "Total Uploads",
                  value: stats.total.uploads || 0,
                  change: stats.last24Hours.uploads || 0,
                  changeLabel: "24h",
                  icon: Upload,
                  color: "from-purple-500 to-violet-600",
                  bgColor: "bg-purple-50",
                },
                {
                  label: "Unique Visitors (24h)",
                  value: stats.last24Hours.uniqueVisitors || 0,
                  change: stats.last7Days.uniqueVisitors || 0,
                  changeLabel: "7d",
                  icon: Users,
                  color: "from-cyan-500 to-blue-600",
                  bgColor: "bg-cyan-50",
                },
                {
                  label: "Total Errors",
                  value: stats.total.errors || 0,
                  change: stats.last24Hours.errors || 0,
                  changeLabel: "24h",
                  icon: AlertCircle,
                  color: "from-red-500 to-rose-600",
                  bgColor: "bg-red-50",
                },
              ].map((stat, idx) => (
                <div key={idx} className={`${stat.bgColor} rounded-xl shadow-sm border border-slate-200 p-6`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    {stat.change > 0 && (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-green-600 text-xs">
                          <TrendingUp className="w-3 h-3" />
                          <span className="font-semibold">+{stat.change}</span>
                        </div>
                        <span className="text-xs text-slate-500">{stat.changeLabel}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value.toLocaleString()}</div>
                  <div className="text-sm text-slate-600">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Popular Tools */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Popular Tools
              </h3>
              <button
                onClick={() => toggleSection('tools')}
                className="p-1 hover:bg-slate-100 rounded"
              >
                {expandedSections.tools ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            {expandedSections.tools && (
              <div className="space-y-3">
                {Object.entries(stats.popularTools || {}).slice(0, 8).map(([tool, count], idx) => {
                  const maxCount = Object.values(stats.popularTools)[0] || 1
                  const percentage = (count / maxCount) * 100
                  return (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700 font-medium">{tool}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full w-32">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-900 w-12 text-right">{count}</span>
                      </div>
                    </div>
                  )
                })}
                {Object.keys(stats.popularTools || {}).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No data yet</p>
                )}
              </div>
            )}
          </div>

          {/* Browser Statistics */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                Browser Statistics
              </h3>
              <button
                onClick={() => toggleSection('browsers')}
                className="p-1 hover:bg-slate-100 rounded"
              >
                {expandedSections.browsers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            {expandedSections.browsers && (
              <div className="space-y-3">
                {Object.entries(stats.browserStats || {}).map(([browser, count], idx) => {
                  const total = Object.values(stats.browserStats).reduce((a, b) => a + b, 0)
                  const percentage = ((count / total) * 100).toFixed(1)
                  return (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getBrowserIcon(browser)}</span>
                        <span className="text-sm text-slate-700 font-medium">{browser}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{percentage}%</span>
                        <span className="text-sm font-bold text-slate-900 w-12 text-right">{count}</span>
                      </div>
                    </div>
                  )
                })}
                {Object.keys(stats.browserStats || {}).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No data yet</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Device & OS Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Device Statistics */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-purple-500" />
                Device Statistics
              </h3>
              <button
                onClick={() => toggleSection('devices')}
                className="p-1 hover:bg-slate-100 rounded"
              >
                {expandedSections.devices ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            {expandedSections.devices && (
              <div className="space-y-4">
                {Object.entries(stats.deviceStats || {}).map(([device, count], idx) => {
                  const total = Object.values(stats.deviceStats).reduce((a, b) => a + b, 0)
                  const percentage = ((count / total) * 100).toFixed(1)
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(device)}
                          <span className="text-sm text-slate-700 font-medium">{device}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-violet-600 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(stats.deviceStats || {}).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No data yet</p>
                )}
              </div>
            )}
          </div>

          {/* OS Statistics */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-green-500" />
                Operating Systems
              </h3>
            </div>
            <div className="space-y-4">
              {Object.entries(stats.osStats || {}).map(([os, count], idx) => {
                const total = Object.values(stats.osStats).reduce((a, b) => a + b, 0)
                const percentage = ((count / total) * 100).toFixed(1)
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-700 font-medium">{os}</span>
                      <span className="text-sm font-bold text-slate-900">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {Object.keys(stats.osStats || {}).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Top IP Addresses */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-500" />
              Top IP Addresses
            </h3>
            <button
              onClick={() => toggleSection('ips')}
              className="p-1 hover:bg-slate-100 rounded"
            >
              {expandedSections.ips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          {expandedSections.ips && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Requests</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Conversions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Downloads</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Last Seen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(stats.topIPs || []).map((ip, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">
                          {ip.ip_address}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {ip.city ? `${ip.city}, ${ip.country}` : ip.country || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{ip.total_requests}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{ip.total_conversions}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{ip.total_downloads}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(ip.last_seen)}</td>
                      <td className="px-4 py-3">
                        {ip.blocked ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => fetchIPDetails(ip.ip_address)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleIPBlock(ip.ip_address, ip.blocked)}
                            className={`p-1 rounded ${ip.blocked ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`}
                            title={ip.blocked ? "Unblock" : "Block"}
                          >
                            {ip.blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(stats.topIPs || []).length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-sm text-slate-500">
                        No IP data available yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Logs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity
              </h3>
              <button
                onClick={() => toggleSection('activity')}
                className="p-1 hover:bg-slate-100 rounded"
              >
                {expandedSections.activity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            {expandedSections.activity && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Types</option>
                  <option value="upload">Uploads</option>
                  <option value="conversion">Conversions</option>
                  <option value="download">Downloads</option>
                  <option value="security_incident">Security</option>
                </select>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All Status</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="failed">Failed</option>
                  <option value="blocked">Blocked</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by IP..."
                  value={filters.ipAddress}
                  onChange={(e) => setFilters({ ...filters, ipAddress: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => fetchActivityLogs(token, 1)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Apply Filters
                </button>
                {(filters.type || filters.status || filters.ipAddress) && (
                  <button
                    onClick={() => {
                      setFilters({ type: "", action: "", status: "", tool: "", ipAddress: "" })
                      fetchActivityLogs(token, 1)
                    }}
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {expandedSections.activity && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tool</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">IP Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Browser</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Device</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(log.type)}
                            <span className="text-sm font-medium text-slate-900">{log.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{log.action}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{log.tool || '-'}</td>
                        <td className="px-6 py-4">
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">
                            {log.ip_address || 'Unknown'}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <span>{getBrowserIcon(log.browser)}</span>
                            <span>{log.browser || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            {getDeviceIcon(log.device)}
                            <span className="ml-1">{log.device || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(log.status)}`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {activityLogs.length === 0 && (
                      <tr>
                        <td colSpan="9" className="px-6 py-8 text-center text-sm text-slate-500">
                          No activity logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchActivityLogs(token, currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchActivityLogs(token, currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Activity Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Type</p>
                <p className="text-sm font-semibold text-slate-900">{selectedLog.type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Action</p>
                <p className="text-sm font-semibold text-slate-900">{selectedLog.action}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">IP Address</p>
                <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">{selectedLog.ip_address}</code>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Browser</p>
                <p className="text-sm text-slate-700">{selectedLog.browser}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">OS</p>
                <p className="text-sm text-slate-700">{selectedLog.os}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Device</p>
                <p className="text-sm text-slate-700">{selectedLog.device}</p>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">Full Details (JSON)</p>
              <pre className="bg-slate-50 p-4 rounded-lg text-xs overflow-x-auto border border-slate-200">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
            
            <button
              onClick={() => setSelectedLog(null)}
              className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* IP Details Modal */}
      {selectedIP && ipDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => { setSelectedIP(null); setIPDetails(null); }}>
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                IP Details: {selectedIP}
              </h3>
              <button
                onClick={() => { setSelectedIP(null); setIPDetails(null); }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            {ipDetails.analytics && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-blue-600 mb-1">Total Requests</p>
                  <p className="text-2xl font-bold text-blue-900">{ipDetails.analytics.total_requests}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-green-600 mb-1">Conversions</p>
                  <p className="text-2xl font-bold text-green-900">{ipDetails.analytics.total_conversions}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-xs text-purple-600 mb-1">Downloads</p>
                  <p className="text-2xl font-bold text-purple-900">{ipDetails.analytics.total_downloads}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-600 mb-1">Status</p>
                  <p className="text-sm font-bold text-slate-900">
                    {ipDetails.analytics.blocked ? "Blocked" : "Active"}
                  </p>
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <h4 className="text-sm font-bold text-slate-900 mb-3">Recent Activity</h4>
              <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Time</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Action</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ipDetails.recentActivity.map((activity, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs text-slate-600">{formatDate(activity.created_at)}</td>
                        <td className="px-4 py-2 text-xs text-slate-700">{activity.type}</td>
                        <td className="px-4 py-2 text-xs text-slate-700">{activity.action}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${getStatusColor(activity.status)}`}>
                            {activity.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => toggleIPBlock(selectedIP, ipDetails.analytics?.blocked)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  ipDetails.analytics?.blocked
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {ipDetails.analytics?.blocked ? 'Unblock IP' : 'Block IP'}
              </button>
              <button
                onClick={() => { setSelectedIP(null); setIPDetails(null); }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}