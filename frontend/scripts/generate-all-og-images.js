/**
 * scripts/generate-all-og-images.js
 * Run: node scripts/generate-all-og-images.js
 * Generates 1200×630 OG images for every tool page + default.
 */
const sharp = require('sharp')
const path  = require('path')
const fs    = require('fs')

const OUT_DIR = path.join(__dirname, '..', 'public')

const TOOLS = [
  { file: 'og-merge-pdf.jpg',      icon: '⊞', label: 'Merge PDF',             tag: 'Combine multiple PDFs into one',        accent: '#3b82f6' },
  { file: 'og-split-pdf.jpg',      icon: '⊟', label: 'Split PDF',             tag: 'Extract pages from any PDF',            accent: '#8b5cf6' },
  { file: 'og-compress-pdf.jpg',   icon: '⬇', label: 'Compress PDF',          tag: 'Shrink PDF size by up to 90%',          accent: '#ef4444' },
  { file: 'og-pdf-to-word.jpg',    icon: 'W', label: 'PDF to Word',           tag: 'Convert PDF to editable DOCX',          accent: '#2563eb' },
  { file: 'og-word-to-pdf.jpg',    icon: 'W', label: 'Word to PDF',           tag: 'Convert DOC & DOCX to PDF',             accent: '#1d4ed8' },
  { file: 'og-jpg-to-pdf.jpg',     icon: '🖼', label: 'JPG to PDF',            tag: 'Turn images into professional PDFs',    accent: '#f59e0b' },
  { file: 'og-pdf-to-jpg.jpg',     icon: '📸', label: 'PDF to JPG',            tag: 'Extract high-quality images from PDF',  accent: '#f97316' },
  { file: 'og-png-to-pdf.jpg',     icon: '🖼', label: 'PNG to PDF',            tag: 'Convert PNG images to PDF online',      accent: '#10b981' },
  { file: 'og-pdf-to-png.jpg',     icon: '📸', label: 'PDF to PNG',            tag: 'Convert PDF pages to clear PNG images', accent: '#06b6d4' },
  { file: 'og-compress-image.jpg', icon: '⬇', label: 'Compress Image',        tag: 'Reduce JPG, PNG, WEBP size by 80%',    accent: '#84cc16' },
  { file: 'og-pdf-to-excel.jpg',   icon: '📊', label: 'PDF to Excel',          tag: 'Extract tables from PDF to XLSX',       accent: '#16a34a' },
  { file: 'og-excel-to-pdf.jpg',   icon: '📊', label: 'Excel to PDF',          tag: 'Convert XLSX & XLS to PDF',             accent: '#15803d' },
  { file: 'og-pdf-to-ppt.jpg',     icon: '📊', label: 'PDF to PowerPoint',     tag: 'Convert PDF slides to editable PPTX',  accent: '#dc2626' },
  { file: 'og-ppt-to-pdf.jpg',     icon: '📊', label: 'PowerPoint to PDF',     tag: 'Convert PPT & PPTX to PDF',             accent: '#b91c1c' },
  { file: 'og-webp-to-png.jpg',    icon: '🖼', label: 'WEBP to PNG',           tag: 'Convert WEBP images to lossless PNG',   accent: '#7c3aed' },
  { file: 'og-png-to-webp.jpg',    icon: '🖼', label: 'PNG to WEBP',           tag: 'Compress PNG to 35% smaller WEBP',      accent: '#6d28d9' },
  { file: 'og-unlock-pdf.jpg',     icon: '🔓', label: 'Unlock PDF',            tag: 'Remove PDF password & restrictions',    accent: '#f59e0b' },
  { file: 'og-ocr-pdf.jpg',        icon: '🔍', label: 'OCR PDF',               tag: 'Extract text from scanned PDFs',        accent: '#0ea5e9' },
]

function makeSvg(tool) {
  // Escape XML special chars in label/tag
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const label = esc(tool.label)
  const tag   = esc(tool.tag)
  const acc   = tool.accent

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${acc}"/>
      <stop offset="100%" stop-color="${acc}cc"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative blobs -->
  <circle cx="950" cy="130"  r="240" fill="${acc}" opacity="0.07"/>
  <circle cx="1100" cy="510" r="170" fill="${acc}" opacity="0.05"/>
  <circle cx="80"   cy="520" r="130" fill="#3b82f6" opacity="0.05"/>

  <!-- Left accent bar -->
  <rect x="80" y="270" width="6" height="90" rx="3" fill="url(#acc)"/>

  <!-- Tool name chip -->
  <rect x="80" y="120" width="${label.length * 14 + 48}" height="44" rx="22" fill="${acc}22"/>
  <text x="104" y="149" font-family="'Segoe UI',Arial,sans-serif" font-size="18" font-weight="700" fill="${acc}">${label}</text>

  <!-- Brand logo -->
  <text x="80" y="240" font-family="'Segoe UI',Arial,sans-serif" font-size="48" font-weight="800" fill="white">
    Small<tspan fill="#ef4444">PDF</tspan>.us
  </text>

  <!-- Main headline -->
  <text x="94" y="316" font-family="'Segoe UI',Arial,sans-serif" font-size="38" font-weight="700" fill="white">${label} — Free Online</text>

  <!-- Tag line -->
  <text x="94" y="372" font-family="'Segoe UI',Arial,sans-serif" font-size="22" fill="#94a3b8">${tag}</text>

  <!-- Feature pills -->
  <rect x="94"  y="420" width="140" height="42" rx="21" fill="${acc}22"/>
  <text x="164" y="447" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="15" font-weight="600" fill="${acc}">100% Free</text>

  <rect x="250" y="420" width="140" height="42" rx="21" fill="${acc}22"/>
  <text x="320" y="447" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="15" font-weight="600" fill="${acc}">No Sign Up</text>

  <rect x="406" y="420" width="140" height="42" rx="21" fill="${acc}22"/>
  <text x="476" y="447" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="15" font-weight="600" fill="${acc}">Instant</text>

  <!-- URL -->
  <rect x="94" y="510" width="200" height="46" rx="23" fill="white" opacity="0.07"/>
  <text x="194" y="540" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="17" font-weight="700" fill="white">smallpdf.us</text>

  <!-- Free badge -->
  <rect x="988" y="488" width="132" height="56" rx="14" fill="url(#acc)"/>
  <text x="1054" y="523" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="20" font-weight="800" fill="white">FREE</text>
</svg>`
}

async function generateOne(tool) {
  const outPath = path.join(OUT_DIR, tool.file)
  const buf = Buffer.from(makeSvg(tool))
  await sharp(buf)
    .resize(1200, 630)
    .jpeg({ quality: 90 })
    .toFile(outPath)
  console.log(`✅  ${tool.file}`)
}

async function main() {
  console.log(`Generating ${TOOLS.length} OG images → ${OUT_DIR}\n`)
  for (const tool of TOOLS) {
    await generateOne(tool)
  }
  console.log('\n🎉  All OG images created!')
}

main().catch(err => { console.error('❌', err); process.exit(1) })
