// Popup: search + category filters over the tool grid, recently-used pinned to
// the top, one-click actions for whatever file the current tab is showing, and
// arrow-key navigation so the whole thing is usable without the mouse.

const RECENT_KEY = 'recentTools'
const RECENT_MAX = 4

const FILTERS = [
  { id: 'all',    label: 'All' },
  { id: 'pdf',    label: 'PDF' },
  { id: 'from',   label: 'From PDF' },
  { id: 'to',     label: 'To PDF' },
  { id: 'image',  label: 'Image' },
  { id: 'secure', label: 'Secure' },
]

const gridEl      = document.getElementById('grid')
const searchEl    = document.getElementById('search')
const emptyEl     = document.getElementById('empty')
const filtersEl   = document.getElementById('filters')
const countEl     = document.getElementById('count')
const cardEl      = document.getElementById('context-card')
const cardIconEl  = document.getElementById('context-icon')
const cardFileEl  = document.getElementById('context-file')
const cardActions = document.getElementById('context-actions')

let recent      = []
let activeGroup = 'all'
let visible     = []   // tools currently rendered, in DOM order — drives arrow keys
let cursor      = -1

function openTool(slug, medium, src) {
  chrome.tabs.create({ url: toolUrl(slug, { medium, src }) })
  const next = [slug, ...recent.filter(s => s !== slug)].slice(0, RECENT_MAX)
  chrome.storage.local.set({ [RECENT_KEY]: next })
  window.close()
}

function makeTile(tool, { recentDot = false } = {}) {
  const btn = document.createElement('button')
  btn.className = 'tile'
  btn.title = tool.name
  btn.innerHTML =
    `<span class="tile-icon">${iconSvg(tool.slug)}</span>` +
    `<span class="tile-name"></span>` +
    (recentDot ? '<span class="dot"></span>' : '')
  btn.querySelector('.tile-name').textContent = tool.name
  btn.addEventListener('click', () => openTool(tool.slug, 'popup'))
  btn.addEventListener('mouseenter', () => setCursor(visible.indexOf(tool), false))
  return btn
}

function addGroupLabel(text) {
  const el = document.createElement('div')
  el.className = 'group-label'
  el.textContent = text
  gridEl.appendChild(el)
}

function render() {
  gridEl.textContent = ''
  visible = []
  cursor = -1

  const q = searchEl.value.trim().toLowerCase()
  let matches = TOOLS
  if (activeGroup !== 'all') matches = matches.filter(t => t.group === activeGroup)
  if (q) matches = matches.filter(t => t.name.toLowerCase().includes(q) || t.slug.includes(q))

  emptyEl.hidden = matches.length > 0
  countEl.textContent = matches.length
    ? `${matches.length} tool${matches.length > 1 ? 's' : ''}`
    : ''

  if (!matches.length) return

  // Recents only make sense on the full, unfiltered list — once the user is
  // searching or filtering they've already told us what they want.
  const showRecents = !q && activeGroup === 'all' && recent.length > 0
  if (showRecents) {
    addGroupLabel('Recently used')
    for (const slug of recent) {
      const tool = TOOLS.find(t => t.slug === slug)
      if (!tool) continue
      visible.push(tool)
      gridEl.appendChild(makeTile(tool, { recentDot: true }))
    }
  }

  for (const [group, label] of Object.entries(GROUP_LABELS)) {
    const inGroup = matches.filter(t => t.group === group)
    if (!inGroup.length) continue
    // A single-category view doesn't need a heading repeating the filter name.
    if (activeGroup === 'all') addGroupLabel(label)
    for (const tool of inGroup) {
      visible.push(tool)
      gridEl.appendChild(makeTile(tool))
    }
  }
}

// ─────────── Keyboard navigation ───────────
function tileEls() { return [...gridEl.querySelectorAll('.tile')] }

function setCursor(index, scroll = true) {
  const tiles = tileEls()
  tiles.forEach(t => t.classList.remove('active'))
  if (index < 0 || index >= tiles.length) { cursor = -1; return }
  cursor = index
  tiles[index].classList.add('active')
  if (scroll) tiles[index].scrollIntoView({ block: 'nearest' })
}

document.addEventListener('keydown', (e) => {
  const tiles = tileEls()
  if (!tiles.length) return

  // Two columns, so Up/Down move by a row and Left/Right by one tile.
  const step = { ArrowDown: 2, ArrowUp: -2, ArrowRight: 1, ArrowLeft: -1 }[e.key]
  if (step) {
    e.preventDefault()
    const next = cursor === -1
      ? (step > 0 ? 0 : tiles.length - 1)
      : Math.min(Math.max(cursor + step, 0), tiles.length - 1)
    setCursor(next)
    return
  }

  if (e.key === 'Enter' && cursor >= 0) {
    e.preventDefault()
    openTool(visible[cursor].slug, 'popup_keyboard')
    return
  }

  if (e.key === 'Escape' && searchEl.value) {
    e.preventDefault()
    searchEl.value = ''
    render()
  }
})

// ─────────── Filters ───────────
FILTERS.forEach(f => {
  const btn = document.createElement('button')
  btn.className = 'filter'
  btn.textContent = f.label
  btn.setAttribute('aria-pressed', String(f.id === activeGroup))
  btn.addEventListener('click', () => {
    activeGroup = f.id
    filtersEl.querySelectorAll('.filter').forEach(b =>
      b.setAttribute('aria-pressed', String(b === btn)))
    render()
  })
  filtersEl.appendChild(btn)
})

// ─────────── Act on the current tab's file ───────────
// A PDF already open in the browser is the highest-intent moment this extension
// gets, so it becomes a card at the top instead of something to search for.
async function showContextCard() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.url || !/^https?:/i.test(tab.url)) return

    const ext = extensionOf(tab.url)
    const suggestions = toolsFor(ext).slice(0, 3)
    if (!suggestions.length) return

    const fileName = decodeURIComponent(tab.url.split('/').pop().split('?')[0]) || tab.url
    cardFileEl.textContent = fileName
    cardFileEl.title = tab.url
    cardIconEl.innerHTML = iconSvg(suggestions[0].slug, 17)

    for (const tool of suggestions) {
      const chip = document.createElement('button')
      chip.className = 'chip'
      chip.textContent = tool.name
      chip.addEventListener('click', () => openTool(tool.slug, 'current_tab', tab.url))
      cardActions.appendChild(chip)
    }
    cardEl.hidden = false
  } catch {
    // chrome:// page or no permission — the rest of the popup still works.
  }
}

document.getElementById('open-site').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: `${SITE}/?utm_source=chrome_extension&utm_medium=popup_header` })
  window.close()
})

searchEl.addEventListener('input', render)

chrome.storage.local.get(RECENT_KEY, (data) => {
  recent = Array.isArray(data[RECENT_KEY]) ? data[RECENT_KEY] : []
  render()
})

showContextCard()
searchEl.focus()
