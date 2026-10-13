// context/AuthContext.js
// Wrap your _app.js with <AuthProvider> to give auth access everywhere

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'

const AuthContext = createContext(null)

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'

// ── Token key — single source of truth ───────────────────────────────────────
const TOKEN_KEY = 'auth_token'

// Read the `plan` claim from a JWT without verifying it (display/sync only —
// the server still verifies every token).
function tokenPlan(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64)).plan
  } catch {
    return undefined
  }
}

// ── Attach the login token to every request to OUR API ──────────────────────
// ~20 tool pages call the API with a bare fetch(), so the server's plan-aware
// limiters (fileSizeLimiter, batchLimiter, dailyConversionLimiter — all read the
// JWT) treated paying users as guests: 3 conversions/day and free size limits,
// and their files never reached "My Files". Patching fetch once fixes every page.
// Only same-site /api/ URLs get the header, and never one that already set it.
function isOwnApi(url) {
  try {
    const u = new URL(url, window.location.href)
    if (!u.pathname.startsWith('/api/')) return false
    if (u.origin === window.location.origin) return true
    const devApi = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    return local && u.origin === new URL(devApi).origin
  } catch {
    return false
  }
}

// Random per-browser id (not tied to the person or the account). Sent as
// X-Client-Id on our own API calls; see dailyConversionLimiter on the server.
const CLIENT_ID_KEY = 'sp_client_id'
export function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).toLowerCase()
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

if (typeof window !== 'undefined' && !window.__spAuthFetch) {
  window.__spAuthFetch = true
  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : null
      if (url && isOwnApi(url)) {
        const token = localStorage.getItem(TOKEN_KEY)
        const headers = new Headers((init && init.headers) || undefined)
        // Browser id for the daily free-use counter, so the 5/day allowance is
        // shared between "not logged in" and "logged in" on the same browser.
        const cid = getClientId()
        if (cid && !headers.has('X-Client-Id')) headers.set('X-Client-Id', cid)
        if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
        return nativeFetch(input, { ...(init || {}), headers })
      }
    } catch {}
    return nativeFetch(input, init)
  }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Load user from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      fetchMe(token)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchMe = useCallback(async (token) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        // The upload limiters trust the `plan` claim inside the JWT. If the
        // plan changed since this token was issued (paid on another device,
        // subscription lapsed), swap in a fresh token so limits match the plan.
        if (tokenPlan(token) !== data.user?.plan) {
          const r = await fetch(`${API_BASE}/api/auth/refresh-token`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null)
          if (r?.ok) {
            const fresh = await r.json()
            if (fresh.token) localStorage.setItem(TOKEN_KEY, fresh.token)
            if (fresh.user) setUser(fresh.user)
          }
        }
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh user + JWT from server — called after checkout success to update plan.
  // Uses /refresh-token (not /me) because fileSizeLimiter/dailyConversionLimiter
  // read `plan` off the JWT itself for speed — without a fresh token the user's
  // upload limits stay stuck at whatever plan was active when they last logged in.
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem(TOKEN_KEY, data.token)
        setUser(data.user)
        return data.user
      }
    } catch {}
    // Fallback — at least keep the displayed user data current
    await fetchMe(token)
  }, [fetchMe])

  const signup = useCallback(async ({ name, email, password }) => {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Signup failed')
    // Signup now returns a token immediately (before email verification) so the
    // user's free-account daily quota (5/day) applies right away instead of
    // leaving them on the guest quota (3/day) until they verify + log in.
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
    }
    return data
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    return data
  }, [])

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Google sign-in failed')
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    router.push('/')
  }, [router])

  const forgotPassword = useCallback(async (email) => {
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [])

  const resetPassword = useCallback(async ({ token, password }) => {
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Reset failed')
    return data
  }, [])

  // Authenticated fetch — automatically attaches auth_token header
  const authFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem(TOKEN_KEY)
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signup,
        login,
        loginWithGoogle,
        logout,
        forgotPassword,
        resetPassword,
        authFetch,
        refreshUser,   // ← added: called by /payment/success to update plan immediately
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// HOC to protect pages — redirects to /auth/login if not logged in
export function withAuth(Component) {
  return function ProtectedPage(props) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading && !user) {
        router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`)
      }
    }, [user, loading, router])

    if (loading || !user) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>
        </div>
      )
    }

    return <Component {...props} />
  }
}