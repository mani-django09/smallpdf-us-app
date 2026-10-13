// Inline SVG icons. Extensions can't pull an icon font or CDN sprite under the
// default CSP, so the markup ships with the popup. Stroke-based, 24×24, sized
// and coloured by CSS (currentColor) — one icon serves several tools.

const ICONS = {
  merge: '<path d="M4 5h6v6H4z"/><path d="M14 13h6v6h-6z"/><path d="M10 8h4a2 2 0 0 1 2 2v3"/>',
  split: '<path d="M4 9h5v6H4z"/><path d="M15 4h5v6h-5z"/><path d="M15 14h5v6h-5z"/><path d="M9 12h3a2 2 0 0 0 2-2V7"/><path d="M14 12v5a2 2 0 0 0 2 2"/>',
  compress: '<path d="M8 3v4a1 1 0 0 1-1 1H3"/><path d="M16 3v4a1 1 0 0 0 1 1h4"/><path d="M8 21v-4a1 1 0 0 0-1-1H3"/><path d="M16 21v-4a1 1 0 0 1 1-1h4"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  edit: '<path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
  scan: '<path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M7 10h10"/><path d="M7 14h6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  redact: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8 15h8v3H8z" fill="currentColor"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 10v10"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4"/><path d="M9 20h6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5L6 20"/>',
  convert: '<path d="M4 8h13"/><path d="M14 5l3 3-3 3"/><path d="M20 16H7"/><path d="M10 13l-3 3 3 3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
}

// Tool slug → icon key. Anything unlisted falls back to a generic document.
const TOOL_ICON = {
  'merge-pdf': 'merge',
  'split-pdf': 'split',
  'compress-pdf': 'compress',
  'rotate-pdf': 'rotate',
  'edit-pdf': 'edit',
  'ocr-pdf': 'scan',

  'unlock-pdf': 'unlock',
  'protect-pdf': 'lock',
  'redact-pdf': 'redact',

  'pdf-to-word': 'doc',
  'pdf-to-excel': 'table',
  'pdf-to-ppt': 'slides',
  'pdf-to-jpg': 'image',
  'pdf-to-png': 'image',

  'word-to-pdf': 'doc',
  'excel-to-pdf': 'table',
  'ppt-to-pdf': 'slides',
  'jpg-to-pdf': 'convert',
  'png-to-pdf': 'convert',

  'compress-image': 'compress',
  'compress-image-to-20kb': 'target',
  'compress-image-to-50kb': 'target',
  'compress-image-to-100kb': 'target',
  'webp-to-png': 'convert',
  'png-to-webp': 'convert',
  'heic-to-jpg': 'image',
  'heic-to-png': 'image',
}

function iconSvg(slug, size = 20) {
  const key = TOOL_ICON[slug] || 'doc'
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`
}

if (typeof module !== 'undefined') module.exports = { ICONS, TOOL_ICON, iconSvg }
