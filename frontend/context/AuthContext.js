// context/AuthContext.js
// Wrap your _app.js with <AuthProvider> to give auth access everywhere

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'

const AuthContext = createContext(null)

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'

// ── Token key — single source of truth ───────────────────────────────────────
const TOKEN_KEY = 'auth_token'

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
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh user from server — called after Stripe checkout to update plan
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
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