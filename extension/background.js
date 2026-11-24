// Service worker: right-click menus, and the "file handoff".
//
// The extension never converts anything itself — every action opens the
// matching tool page on smallpdf.us (one backend, one set of limits, ads stay
// on the site). What it does add since 1.1: when the user acts on a PDF or
// image they are looking at, the worker downloads that file and hands it to the
// tool page (handoff.js), so the tool starts with the file already loaded
// instead of asking the user to download it and pick it again.

importScripts('tools.js')

const PARENT_ID = 'smallpdf-root'

// Largest file we hand over. Messages between the worker and a content script
// are JSON (base64 here), and Chrome caps a message at 64 MiB, so 45 MB of file
// is the practical ceiling. Bigger files fall back to "choose it on the page".
const MAX_HANDOFF_BYTES = 45 * 1024 * 1024

// Which tools show up in the right-click menu. The full set lives in the popup;
// a context menu with 27 entries is unusable.
const QUICK_PDF   = ['compress-pdf', 'pdf-to-word', 'split-pdf', 'pdf-to-jpg', 'protect-pdf']

// Tools that need more than one file — handing over a single file would only
// show their "add at least 2 files" error, so they open empty instead.
const NO_HANDOFF = ['merge-pdf']
const QUICK_IMAGE = ['compress-image', 'compress-image-to-50kb', 'jpg-to-pdf', 'png-to-pdf']

const PDF_LINKS   = ['*://*/*.pdf', '*://*/*.pdf?*', '*://*/*.PDF', '*://*/*.PDF?*']

function toolName(slug) {
  const tool = TOOLS.find(t => t.slug === slug)
  return tool ? tool.name : slug
}

function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PARENT_ID,
      title: 'SmallPDF.us',
      contexts: ['link', 'image', 'page'],
    })

    // Right-click on a link to a PDF → PDF tools, with the linked file.
    for (const slug of QUICK_PDF) {
      chrome.contextMenus.create({
        id: `pdflink:${slug}`,
        parentId: PARENT_ID,
        title: toolName(slug),
        contexts: ['link'],
        targetUrlPatterns: PDF_LINKS,
      })
    }

    // Right-click on a page (including a PDF open in the tab) → PDF tools.
    for (const slug of QUICK_PDF) {
      chrome.contextMenus.create({
        id: `page:${slug}`,
        parentId: PARENT_ID,
        title: toolName(slug),
        contexts: ['page'],
      })
    }

    // Right-click on an image → image tools, with that image.
    for (const slug of QUICK_IMAGE) {
      chrome.contextMenus.create({
        id: `img:${slug}`,
        parentId: PARENT_ID,
        title: toolName(slug),
        contexts: ['image'],
      })
    }

    chrome.contextMenus.create({
      id: 'sep-all',
      parentId: PARENT_ID,
      type: 'separator',
      contexts: ['link', 'image', 'page'],
    })

    chrome.contextMenus.create({
      id: 'all-tools',
      parentId: PARENT_ID,
      title: `All ${TOOLS.length} tools…`,
      contexts: ['link', 'image', 'page'],
    })
  })
}

chrome.runtime.onInstalled.addListener((details) => {
  buildMenus()
  // First install → open the site once so people see what they just added.
  if (details.reason === 'install') {
    chrome.tabs.create({ url: homeUrl('install') })
  }
})

chrome.runtime.onStartup.addListener(buildMenus)

// ─────────── File handoff ───────────

// tabId → Promise<{ name, type, data(base64) } | { error }>
const pending = new Map()

const MIME_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
}

function fileNameFrom(url, contentType, disposition) {
  let name = ''
  const m = disposition && /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  if (m) {
    try { name = decodeURIComponent(m[1]) } catch { name = m[1] }
  }
  if (!name) {
    try {
      name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
    } catch { name = '' }
  }
  name = name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'file'
  const ext = MIME_EXT[(contentType || '').split(';')[0].trim().toLowerCase()]
  if (ext && !new RegExp(`\\.${ext === 'jpg' ? 'jpe?g' : ext}$`, 'i').test(name)) {
    name += `.${ext}`
  }
  return name
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let out = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(out)
}

async function fetchForHandoff(fileUrl) {
  if (!/^https?:/i.test(fileUrl)) return { error: 'unsupported_url' }
  try {
    const res = await fetch(fileUrl, { credentials: 'include' })
    if (!res.ok) return { error: 'http_' + res.status }
    const len = Number(res.headers.get('content-length') || 0)
    if (len > MAX_HANDOFF_BYTES) return { error: 'too_large' }
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_HANDOFF_BYTES) return { error: 'too_large' }
    const type = (res.headers.get('content-type') || '').split(';')[0].trim()
    return {
      name: fileNameFrom(fileUrl, type, res.headers.get('content-disposition')),
      type,
      data: toBase64(buf),
    }
  } catch {
    // Usually: no permission for that site (CORS), or the network failed.
    return { error: 'fetch_failed' }
  }
}

// Opens the tool and, if there is a file to bring along, starts downloading it
// right away so it is ready by the time the page asks for it.
async function openTool(slug, medium, fileUrl) {
  const handoff = Boolean(fileUrl && /^https?:/i.test(fileUrl)) && !NO_HANDOFF.includes(slug)
  const tab = await chrome.tabs.create({ url: toolUrl(slug, { medium, handoff }) })
  if (handoff) {
    pending.set(tab.id, fetchForHandoff(fileUrl))
    // Never keep a file around for a tab that did not ask for it.
    setTimeout(() => pending.delete(tab.id), 2 * 60 * 1000)
  }
}

chrome.tabs.onRemoved.addListener((tabId) => pending.delete(tabId))

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return

  // From the popup: open a tool, optionally with the current tab's file.
  if (msg.type === 'open-tool') {
    openTool(msg.slug, msg.medium || 'popup', msg.fileUrl || null)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }

  // From handoff.js on a smallpdf.us tool page: "is there a file for me?"
  if (msg.type === 'get-handoff') {
    const tabId = sender.tab && sender.tab.id
    const job = pending.get(tabId)
    if (!job) { sendResponse({ none: true }); return }
    pending.delete(tabId)
    job.then(sendResponse, () => sendResponse({ error: 'fetch_failed' }))
    return true
  }
})

// ─────────── Right-click ───────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'all-tools') {
    chrome.tabs.create({ url: homeUrl('context_menu') })
    return
  }

  const [kind, slug] = String(info.menuItemId).split(':')
  if (!slug) return

  let fileUrl = null
  if (kind === 'pdflink') fileUrl = info.linkUrl
  else if (kind === 'img') fileUrl = info.srcUrl
  else if (kind === 'page') {
    // Only bring the page along when it actually is a PDF (e.g. one open in
    // Chrome's PDF viewer); on an ordinary web page just open the tool.
    const pageUrl = info.pageUrl || (tab && tab.url) || ''
    if (extensionOf(pageUrl) === 'pdf' || /\.pdf($|\?)/i.test(info.frameUrl || '')) {
      fileUrl = extensionOf(pageUrl) === 'pdf' ? pageUrl : info.frameUrl
    }
  }

  openTool(slug, 'context_menu', fileUrl)
})

// Toolbar keyboard shortcut is handled by the browser (_execute_action).
