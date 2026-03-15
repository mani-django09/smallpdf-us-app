/**
 * Returns the correct API base URL for both development and production.
 *
 * Dev  → NEXT_PUBLIC_API_URL (.env.local)  e.g. http://localhost:5011
 * Prod → same-origin (Nginx proxies /api/* to Express)  e.g. https://smallpdf.us
 */
export function getApiUrl() {
  if (typeof window === 'undefined') {
    // SSR fallback
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
  }
  const { hostname, protocol } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
  }
  return `${protocol}//${hostname}`
}
