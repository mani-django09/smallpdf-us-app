// Service worker: right-click menus for PDFs, images and links.
//
// The whole extension is a thin client — it never processes files itself, it
// opens the matching tool page on smallpdf.us. That keeps one backend, one set
// of limits, and (deliberately) keeps ad impressions on the site.

importScripts('tools.js')

const PARENT_ID = 'smallpdf-root'

// Which tools show up in the right-click menu. The full set lives in the popup;
// a context menu with 27 entries is unusable.
const QUICK_PDF   = ['compress-pdf', 'pdf-to-word', 'merge-pdf', 'split-pdf']
const QUICK_IMAGE = ['compress-image', 'jpg-to-pdf', 'png-to-pdf']

function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PARENT_ID,
      title: 'SmallPDF.us',
      contexts: ['link', 'image', 'page'],
    })

    for (const slug of QUICK_PDF) {
      const tool = TOOLS.find(t => t.slug === slug)
      chrome.contextMenus.create({
        id: `pdf:${slug}`,
        parentId: PARENT_ID,
        title: tool.name,
        contexts: ['link', 'page'],
      })
    }

    chrome.contextMenus.create({
      id: 'sep-1',
      parentId: PARENT_ID,
      type: 'separator',
      contexts: ['image'],
    })

    for (const slug of QUICK_IMAGE) {
      const tool = TOOLS.find(t => t.slug === slug)
      chrome.contextMenus.create({
        id: `img:${slug}`,
        parentId: PARENT_ID,
        title: tool.name,
        contexts: ['image'],
      })
    }

    chrome.contextMenus.create({
      id: 'all-tools',
      parentId: PARENT_ID,
      title: 'All 27 tools…',
      contexts: ['link', 'image', 'page'],
    })
  })
}

chrome.runtime.onInstalled.addListener((details) => {
  buildMenus()
  // First install → open the site once so people see what they just added.
  if (details.reason === 'install') {
    chrome.tabs.create({ url: `${SITE}/?utm_source=chrome_extension&utm_medium=install` })
  }
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'all-tools') {
    chrome.tabs.create({ url: `${SITE}/?utm_source=chrome_extension&utm_medium=context_menu` })
    return
  }

  const slug = String(info.menuItemId).split(':')[1]
  if (!slug) return

  // Prefer whatever the user actually right-clicked; fall back to the page.
  const src = info.linkUrl || info.srcUrl || info.pageUrl || (tab && tab.url) || null
  chrome.tabs.create({ url: toolUrl(slug, { medium: 'context_menu', src }) })
})
