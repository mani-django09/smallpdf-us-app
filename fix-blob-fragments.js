/**
 * fix-blob-fragments.js
 * The previous fix-blobs.js removed @keyframes blob blocks but left orphaned
 * trailing fragments like:
 *   }
 *   66% { transform: translate(-15px, 15px) scale(0.95); }
 *   }
 * This script removes those leftover fragments.
 */

const fs = require('fs')
const path = require('path')

const pagesDir = path.join(__dirname, 'frontend', 'pages')

// All tool pages that might have these fragments
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
  'pdf-to-png/index.js',
]

// deduplicate
const unique = [...new Set(toolFiles)]
let totalFixed = 0

for (const relPath of unique) {
  const filePath = path.join(pagesDir, relPath)
  if (!fs.existsSync(filePath)) continue

  let src = fs.readFileSync(filePath, 'utf8')
  const original = src

  // Pattern 1: inline single-line: "  66% { transform: translate(-15px, 15px) scale(0.95); } }"
  // followed by closing brace on next line
  src = src.replace(/[ \t]+66%\s*\{\s*transform:\s*translate\(-15px,\s*15px\)\s*scale\(0\.95\);\s*\}\s*\}\s*\n/g, '\n')

  // Pattern 2: multi-line fragment:
  //       }
  //  (blank)
  //       66% {
  //         transform: translate(-15px, 15px) scale(0.95);
  //       }
  //     }
  src = src.replace(/[ \t]*\}\s*\n\s*\n[ \t]*66%\s*\{\s*\n[ \t]*transform:\s*translate\(-15px,\s*15px\)\s*scale\(0\.95\);\s*\n[ \t]*\}\s*\n[ \t]*\}\s*\n/g, '\n')

  // Pattern 3: single-line with just 66% { ... }  } (two closing braces on same or next line)
  src = src.replace(/[ \t]*66%\s*\{\s*transform:\s*translate\(-15px,\s*15px\)\s*scale\(0\.95\);\s*\}\s*\n[ \t]*\}\s*\n/g, '\n')

  // Clean up triple+ blank lines
  src = src.replace(/\n{3,}/g, '\n\n')

  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf8')
    console.log(`FIXED: ${relPath}`)
    totalFixed++
  } else {
    console.log(`CLEAN: ${relPath}`)
  }
}

console.log(`\nDone. Fixed ${totalFixed} files.`)
