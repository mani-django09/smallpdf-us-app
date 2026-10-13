// Print a file from a blob URL (already fetched by the caller).
// Opens it in a hidden iframe and triggers window.print(). Falls back to a
// new tab if the iframe print is blocked (cross-origin PDF viewers, etc.).
export function printBlob(blob) {
  const blobUrl = window.URL.createObjectURL(blob)

  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
  iframe.src = blobUrl

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch {
      // PDF viewer inside iframe may block print() — open in new tab instead.
      window.open(blobUrl, "_blank")
    }
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl)
      iframe.remove()
    }, 60000)
  }

  document.body.appendChild(iframe)
}

// Fetch + print a file URL. NOTE: many download endpoints delete the file
// after the first successful fetch (one-time serve). If your page already
// has the blob from a previous download, prefer passing it to printBlob()
// directly so you don't need a second request.
export async function printFile(fileUrl) {
  if (!fileUrl) return
  const response = await fetch(fileUrl)
  if (!response.ok) {
    // File was likely already deleted after the first download.
    // Open the URL in a new tab as a best-effort fallback.
    window.open(fileUrl, "_blank")
    return
  }
  const blob = await response.blob()
  printBlob(blob)
}

// Native share if available (mostly mobile), otherwise copy the link.
export async function shareLink({ title, text, url } = {}) {
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "")
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url: shareUrl })
      return "shared"
    } catch {
      return "cancelled"
    }
  }
  try {
    await navigator.clipboard.writeText(shareUrl)
    return "copied"
  } catch {
    return "failed"
  }
}

// Filename from a Content-Disposition header. Prefers RFC 5987 `filename*=UTF-8''…`
// (the server sends it for non-Latin names — the plain `filename="…"` then holds
// "???" placeholders, e.g. "??? 2025.png" for 請求書 2025). Falls back when the
// header is missing/unreadable (cross-origin in dev without exposed headers).
export function filenameFromDisposition(header, fallback) {
  if (!header) return fallback
  const star = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;\n]+)/)
  if (star) {
    try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, "")) } catch (_) {}
  }
  const plain = header.match(/filename\s*=\s*(?:"([^"]*)"|([^;\n]*))/)
  const name = plain ? (plain[1] ?? plain[2] ?? "").trim() : ""
  return name && !/^\?+[.\s-]/.test(name) ? name : fallback
}
