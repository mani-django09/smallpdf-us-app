/**
 * Adds PostDownloadUpsell + UsageNudge to all tool download pages.
 * Run: node frontend/scripts/add-upsell-to-downloads.js
 */

const fs   = require('fs')
const path = require('path')

const TOOLS = [
  'jpg-to-pdf', 'merge-pdf', 'compress-pdf', 'word-to-pdf',
  'pdf-to-word', 'split-pdf', 'unlock-pdf', 'ocr-pdf',
  'pdf-to-jpg', 'pdf-to-png', 'pdf-to-ppt', 'pdf-to-excel',
  'excel-to-pdf', 'ppt-to-pdf', 'png-to-pdf', 'png-to-webp', 'webp-to-png',
]

const PAGES_DIR = path.join(__dirname, '..', 'pages')

let patched = 0, skipped = 0, errors = 0

for (const tool of TOOLS) {
  const file = path.join(PAGES_DIR, tool, 'download.js')
  if (!fs.existsSync(file)) {
    console.log(`⚠  SKIP (not found): ${tool}/download.js`)
    skipped++
    continue
  }

  let src = fs.readFileSync(file, 'utf8')

  // ── Skip if already patched ─────────────────────────────────────
  if (src.includes('usePostDownloadUpsell') || src.includes('useUsageNudge')) {
    console.log(`✓  ALREADY DONE: ${tool}/download.js`)
    skipped++
    continue
  }

  // ── 1. Add imports ──────────────────────────────────────────────
  // Insert after UpgradeBanner import if present, else after Layout import
  const upgradeImportRe = /^(import UpgradeBanner from .+)$/m
  const layoutImportRe  = /^(import Layout from .+)$/m

  const importLines = `import { usePostDownloadUpsell } from "../../components/PostDownloadUpsell"\nimport { useUsageNudge } from "../../components/UsageNudge"`

  if (upgradeImportRe.test(src)) {
    src = src.replace(upgradeImportRe, `$1\n${importLines}`)
  } else if (layoutImportRe.test(src)) {
    src = src.replace(layoutImportRe, `$1\n${importLines}`)
  } else {
    console.log(`✗  ERROR (no Layout import): ${tool}`)
    errors++
    continue
  }

  // ── 2. Add hook declarations after downloadComplete state ───────
  const downloadStateRe = /(const \[downloadComplete, setDownloadComplete\] = useState\([^)]*\))/
  const hookLines = `const { triggerUpsell, UpsellModal } = usePostDownloadUpsell('${tool}')\n  const { recordUse, NudgeToast }      = useUsageNudge()`

  if (downloadStateRe.test(src)) {
    src = src.replace(downloadStateRe, `$1\n  ${hookLines}`)
  } else {
    // Fallback: add after first useState line in component
    const firstUseState = /^(  const \[.+useState\(.+\))$/m
    if (firstUseState.test(src)) {
      src = src.replace(firstUseState, `$1\n  ${hookLines}`)
    } else {
      console.log(`✗  ERROR (no useState): ${tool}`)
      errors++
      continue
    }
  }

  // ── 3. Add trigger calls after setDownloadComplete(true) ────────
  // There may be multiple setDownloadComplete(true) — target the first one
  // that's followed by setTimeout (the real download success)
  const triggerCalls = `\n      // ── Upsell + usage nudge ──────────────────────────────────────\n      triggerUpsell()\n      recordUse()`

  // Match setDownloadComplete(true) followed by optional setTimeout
  const setCompleteRe = /(setDownloadComplete\(true\))([\s\S]*?setTimeout\(\(\) => setDownloadComplete\(false\)[^)]*\))/
  if (setCompleteRe.test(src)) {
    src = src.replace(setCompleteRe, `$1$2${triggerCalls}`)
  } else {
    // Simple fallback: after first setDownloadComplete(true)
    src = src.replace('setDownloadComplete(true)', `setDownloadComplete(true)${triggerCalls}`)
  }

  // ── 4. Add JSX modals ───────────────────────────────────────────
  const modalJSX = `\n    {UpsellModal}\n    {NudgeToast}`

  if (src.includes('<UpgradeBanner')) {
    // Add after UpgradeBanner tag
    src = src.replace(/(<UpgradeBanner[^/]*\/>)(\s*<\/>|\s*\)\s*\})/,
      (match, banner, closing) => `${banner}${modalJSX}${closing}`)

    // If that didn't work, add before </> closing fragment
    if (!src.includes('{UpsellModal}')) {
      src = src.replace(/(<UpgradeBanner[^/]*\/>)/, `$1${modalJSX}`)
    }
  } else {
    // No UpgradeBanner — add before closing </Layout> or </>
    // Check if file uses fragment wrapper
    if (/\s+<\/>\s*\)\s*\}\s*$/.test(src)) {
      src = src.replace(/(\s+<\/>\s*\)\s*\}\s*)$/, `\n    {UpsellModal}\n    {NudgeToast}$1`)
    } else {
      // Wrap return in fragment
      src = src.replace(/(\s+<\/Layout>\s*\)\s*\}\s*)$/, `\n    {UpsellModal}\n    {NudgeToast}$1`)
    }
  }

  // ── Write back ──────────────────────────────────────────────────
  fs.writeFileSync(file, src, 'utf8')
  console.log(`✅ PATCHED: ${tool}/download.js`)
  patched++
}

console.log(`\nDone — patched: ${patched}, skipped: ${skipped}, errors: ${errors}`)
