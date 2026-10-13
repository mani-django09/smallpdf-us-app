// Only same-site paths may be used as a post-login redirect target.
// `?redirect=https://evil.example` (or "//evil.example", "/\evil.example",
// "javascript:…") used to be passed straight to router.push — an open redirect
// usable for phishing right after a real login.
export function safeRedirect(value, fallback = '/') {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== 'string' || !v.startsWith('/')) return fallback
  if (v.startsWith('//') || v.startsWith('/\\') || /[\u0000-\u001f]/.test(v)) return fallback
  return v
}
