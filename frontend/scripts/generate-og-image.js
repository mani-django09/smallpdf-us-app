/**
 * scripts/generate-og-image.js
 * Run once: node scripts/generate-og-image.js
 * Generates public/og-image.jpg (1200x630) for social sharing.
 */
const sharp = require('sharp')
const path  = require('path')
const fs    = require('fs')

const OUT = path.join(__dirname, '..', 'public', 'og-image.jpg')

// SVG template — 1200x630px, SmallPDF.us branding
const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative circles -->
  <circle cx="950" cy="120" r="220" fill="#DC2626" opacity="0.08"/>
  <circle cx="1100" cy="500" r="160" fill="#DC2626" opacity="0.06"/>
  <circle cx="80"   cy="520" r="120" fill="#3b82f6" opacity="0.06"/>

  <!-- Red accent bar -->
  <rect x="80" y="280" width="6" height="80" rx="3" fill="url(#accent)"/>

  <!-- Logo text -->
  <text x="80" y="180" font-family="'Segoe UI', Arial, sans-serif" font-size="52" font-weight="800" fill="white">
    Small<tspan fill="#ef4444">PDF</tspan>.us
  </text>

  <!-- Tagline -->
  <text x="94" y="310" font-family="'Segoe UI', Arial, sans-serif" font-size="36" font-weight="600" fill="white">
    Free PDF Tools — Fast &amp; Secure
  </text>

  <!-- Sub description -->
  <text x="94" y="365" font-family="'Segoe UI', Arial, sans-serif" font-size="22" fill="#94a3b8">
    Merge · Split · Compress · Convert · OCR — No signup required
  </text>

  <!-- Feature pills -->
  <rect x="94"  y="410" width="150" height="44" rx="22" fill="#DC2626" opacity="0.15"/>
  <text x="169" y="438" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="600" fill="#fca5a5">PDF to Word</text>

  <rect x="260" y="410" width="150" height="44" rx="22" fill="#DC2626" opacity="0.15"/>
  <text x="335" y="438" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="600" fill="#fca5a5">JPG to PDF</text>

  <rect x="426" y="410" width="170" height="44" rx="22" fill="#DC2626" opacity="0.15"/>
  <text x="511" y="438" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="600" fill="#fca5a5">Compress PDF</text>

  <rect x="612" y="410" width="120" height="44" rx="22" fill="#DC2626" opacity="0.15"/>
  <text x="672" y="438" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="600" fill="#fca5a5">OCR PDF</text>

  <!-- URL badge -->
  <rect x="94" y="510" width="220" height="48" rx="24" fill="white" opacity="0.07"/>
  <text x="204" y="541" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="18" font-weight="700" fill="white">
    smallpdf.us
  </text>

  <!-- Free badge -->
  <rect x="980" y="490" width="140" height="60" rx="16" fill="url(#accent)"/>
  <text x="1050" y="526" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="22" font-weight="800" fill="white">100% FREE</text>
</svg>
`

async function generate() {
  const buffer = Buffer.from(svg)
  await sharp(buffer)
    .resize(1200, 630)
    .jpeg({ quality: 92 })
    .toFile(OUT)
  console.log(`✅  og-image.jpg created → ${OUT}`)
}

generate().catch(err => { console.error('❌ Failed:', err); process.exit(1) })
