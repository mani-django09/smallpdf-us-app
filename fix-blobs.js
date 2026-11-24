/**
 * fix-blobs.js
 * Removes the 2021-era "animate-blob" template pattern from all tool pages.
 * Fixes:
 *  1. Removes @import url(fonts.googleapis.com) inside <style jsx> (already in _document.js)
 *  2. Removes @keyframes blob + .animate-blob + .animation-delay-2000 definitions
 *  3. Removes the two blob <div> elements from upload sections
 *  4. Changes upload section background from blue/indigo gradient to clean gray-50
 *  5. Removes `relative overflow-hidden` left over from blob container
 *  6. Removes `relative z-10` from inner wrapper (no longer needed without blobs)
 */

const fs = require('fs')
const path = require('path')
const glob = require('path')

const pagesDir = path.join(__dirname, 'frontend', 'pages')

// All tool page dirs that have the blob pattern (from grep)
const toolFiles = [
  'heic-to-png/index.js',
  'heic-to-jpg/index.js',
  'word-to-pdf.js',
  'pdf-to-png/index.js',
  'split-pdf/index.js',
  'webp-to-png/index.js',
  'ocr-pdf/index.js',
  'png-to-webp/index.js',
  'pdf-to-ppt/index.js',
  'ppt-to-pdf/index.js',
  'excel-to-pdf/index.js',
  'pdf-to-excel/index.js',
  'png-to-pdf/index.js',
  'jpg-to-pdf/index.js',
  'pdf-to-jpg/index.js',
  'pdf-to-word/index.js',
  'compress-pdf/index.js',
]

let totalFixed = 0

for (const relPath of toolFiles) {
  const filePath = path.join(pagesDir, relPath)
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${relPath}`)
    continue
  }

  let src = fs.readFileSync(filePath, 'utf8')
  const original = src

  // 1. Remove @import url(fonts.googleapis.com) line inside style jsx
  src = src.replace(/@import url\('https:\/\/fonts\.googleapis\.com\/[^']+'\);\s*\n/g, '')

  // 2. Remove @keyframes blob block (multiline)
  src = src.replace(/@keyframes blob \{[^}]*\{[^}]*\}[^}]*\}/gs, '')

  // 3. Remove .animate-blob { ... } block
  src = src.replace(/\.animate-blob \{[^}]*\}/gs, '')

  // 4. Remove .animation-delay-2000 { ... } block
  src = src.replace(/\.animation-delay-2000 \{[^}]*\}/gs, '')

  // 5. Remove blob <div> lines (the two absolute positioned blobs)
  //    They always have "animate-blob" in className
  src = src.replace(/[ \t]*<div className="[^"]*animate-blob[^"]*"><\/div>\n/g, '')

  // 6. Remove `relative overflow-hidden` from upload section outer div
  //    (was needed to clip the blobs)
  src = src.replace(/ relative overflow-hidden/g, '')

  // 7. Remove ` relative z-10` from inner container (no blobs to be above)
  src = src.replace(/ relative z-10/g, '')

  // 8. Clean up any blank lines left by removal (max 2 consecutive)
  src = src.replace(/\n{3,}/g, '\n\n')

  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf8')
    console.log(`FIXED: ${relPath}`)
    totalFixed++
  } else {
    console.log(`NO CHANGE: ${relPath}`)
  }
}

console.log(`\nDone. Fixed ${totalFixed}/${toolFiles.length} files.`)
