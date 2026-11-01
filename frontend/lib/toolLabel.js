// lib/toolLabel.js
// Translated tool name for a tool slug, reusing the nav labels from common.json.
//   toolLabel(t, 'merge-pdf') -> t('nav.mergePdf')

export function toolLabel(t, toolName) {
  if (!toolName) return ''
  const key = `nav.${toolName.replace(/-(\w)/g, (_, c) => c.toUpperCase())}`
  const label = t(key)
  return label === key ? toolName : label
}
