/**
 * RelatedTools.js
 * Shared "Related Free Tools" section for all tool pages.
 * Provides internal linking + helps Google understand site structure.
 *
 * Usage: <RelatedTools current="merge-pdf" />
 */
import Link from 'next/link'
import { useTranslations } from '../lib/i18n'

const ALL_TOOLS = {
  'merge-pdf':      { name: 'Merge PDF',         desc: 'Combine PDFs into one',           href: '/merge-pdf' },
  'split-pdf':      { name: 'Split PDF',          desc: 'Extract pages from PDF',          href: '/split-pdf' },
  'compress-pdf':   { name: 'Compress PDF',       desc: 'Shrink PDF size by 90%',          href: '/compress-pdf' },
  'pdf-to-word':    { name: 'PDF to Word',        desc: 'Convert PDF to editable DOCX',    href: '/pdf-to-word' },
  'word-to-pdf':    { name: 'Word to PDF',        desc: 'Convert DOC & DOCX to PDF',       href: '/word-to-pdf' },
  'jpg-to-pdf':     { name: 'JPG to PDF',         desc: 'Turn images into PDF',            href: '/jpg-to-pdf' },
  'pdf-to-jpg':     { name: 'PDF to JPG',         desc: 'Extract images from PDF',         href: '/pdf-to-jpg' },
  'png-to-pdf':     { name: 'PNG to PDF',         desc: 'Convert PNG images to PDF',       href: '/png-to-pdf' },
  'pdf-to-png':     { name: 'PDF to PNG',         desc: 'Convert PDF pages to PNG',        href: '/pdf-to-png' },
  'compress-image': { name: 'Compress Image',     desc: 'Reduce JPG/PNG/WEBP size',        href: '/compress-image' },
  'compress-image-to-20kb':  { name: 'Compress Image to 20KB',  desc: 'Hit an exact 20KB target',  href: '/compress-image-to-20kb' },
  'compress-image-to-50kb':  { name: 'Compress Image to 50KB',  desc: 'Hit an exact 50KB target',  href: '/compress-image-to-50kb' },
  'compress-image-to-100kb': { name: 'Compress Image to 100KB', desc: 'Hit an exact 100KB target', href: '/compress-image-to-100kb' },
  'pdf-to-excel':   { name: 'PDF to Excel',       desc: 'Extract tables to XLSX',          href: '/pdf-to-excel' },
  'excel-to-pdf':   { name: 'Excel to PDF',       desc: 'Convert XLSX & XLS to PDF',       href: '/excel-to-pdf' },
  'pdf-to-ppt':     { name: 'PDF to PowerPoint',  desc: 'Convert PDF slides to PPTX',      href: '/pdf-to-ppt' },
  'ppt-to-pdf':     { name: 'PowerPoint to PDF',  desc: 'Convert PPT & PPTX to PDF',       href: '/ppt-to-pdf' },
  'webp-to-png':    { name: 'WEBP to PNG',        desc: 'Convert WEBP to lossless PNG',    href: '/webp-to-png' },
  'png-to-webp':    { name: 'PNG to WEBP',        desc: 'Compress PNG to WEBP format',     href: '/png-to-webp' },
  'heic-to-jpg':    { name: 'HEIC to JPG',        desc: 'Convert iPhone photos to JPG',    href: '/heic-to-jpg' },
  'heic-to-png':    { name: 'HEIC to PNG',        desc: 'Convert iPhone photos to PNG',    href: '/heic-to-png' },
  'unlock-pdf':     { name: 'Unlock PDF',         desc: 'Remove PDF password instantly',   href: '/unlock-pdf' },
  'rotate-pdf':     { name: 'Rotate PDF',         desc: 'Rotate PDF pages & save',         href: '/rotate-pdf' },
  'protect-pdf':    { name: 'Protect PDF',        desc: 'Password-protect a PDF',          href: '/protect-pdf' },
  'redact-pdf':     { name: 'Redact PDF',         desc: 'Permanently black out content',   href: '/redact-pdf' },
  'ocr-pdf':        { name: 'OCR PDF',            desc: 'Extract text from scanned PDFs',  href: '/ocr-pdf' },
  'edit-pdf':       { name: 'Edit PDF',           desc: 'Whiteout and retype text',        href: '/edit-pdf' },
}

const RELATED_MAP = {
  'merge-pdf':      ['split-pdf', 'compress-pdf', 'pdf-to-word', 'pdf-to-jpg', 'rotate-pdf'],
  'split-pdf':      ['merge-pdf', 'compress-pdf', 'pdf-to-word', 'pdf-to-jpg', 'rotate-pdf'],
  'compress-pdf':   ['merge-pdf', 'split-pdf', 'pdf-to-word', 'compress-image', 'pdf-to-jpg'],
  'pdf-to-word':    ['word-to-pdf', 'pdf-to-excel', 'pdf-to-ppt', 'compress-pdf', 'merge-pdf'],
  'word-to-pdf':    ['pdf-to-word', 'pdf-to-jpg', 'pdf-to-excel', 'compress-pdf', 'merge-pdf'],
  'jpg-to-pdf':     ['png-to-pdf', 'pdf-to-jpg', 'compress-image', 'merge-pdf', 'compress-pdf'],
  'pdf-to-jpg':     ['jpg-to-pdf', 'pdf-to-png', 'compress-image', 'compress-pdf', 'split-pdf'],
  'png-to-pdf':     ['jpg-to-pdf', 'pdf-to-png', 'compress-image', 'merge-pdf', 'compress-pdf'],
  'pdf-to-png':     ['png-to-pdf', 'pdf-to-jpg', 'compress-image', 'compress-pdf', 'split-pdf'],
  'compress-image': ['compress-pdf', 'jpg-to-pdf', 'png-to-pdf', 'pdf-to-jpg', 'pdf-to-png'],
  'pdf-to-excel':   ['pdf-to-word', 'excel-to-pdf', 'pdf-to-ppt', 'compress-pdf', 'merge-pdf'],
  'excel-to-pdf':   ['pdf-to-excel', 'pdf-to-word', 'ppt-to-pdf', 'compress-pdf', 'merge-pdf'],
  'pdf-to-ppt':     ['pdf-to-word', 'ppt-to-pdf', 'pdf-to-excel', 'compress-pdf', 'merge-pdf'],
  'ppt-to-pdf':     ['pdf-to-ppt', 'word-to-pdf', 'excel-to-pdf', 'compress-pdf', 'merge-pdf'],
  'webp-to-png':    ['png-to-webp', 'compress-image', 'jpg-to-pdf', 'png-to-pdf', 'pdf-to-png'],
  'png-to-webp':    ['webp-to-png', 'compress-image', 'jpg-to-pdf', 'png-to-pdf', 'pdf-to-png'],
  'heic-to-jpg':    ['heic-to-png', 'jpg-to-pdf', 'compress-image', 'png-to-pdf', 'pdf-to-jpg'],
  'heic-to-png':    ['heic-to-jpg', 'compress-image', 'jpg-to-pdf', 'png-to-pdf', 'webp-to-png'],
  'unlock-pdf':     ['protect-pdf', 'redact-pdf', 'merge-pdf', 'split-pdf', 'compress-pdf'],
  'rotate-pdf':     ['merge-pdf', 'split-pdf', 'compress-pdf', 'pdf-to-jpg', 'edit-pdf'],
  'protect-pdf':    ['redact-pdf', 'unlock-pdf', 'edit-pdf', 'merge-pdf', 'compress-pdf'],
  'redact-pdf':     ['edit-pdf', 'protect-pdf', 'unlock-pdf', 'ocr-pdf', 'compress-pdf'],
  'ocr-pdf':        ['redact-pdf', 'edit-pdf', 'pdf-to-word', 'pdf-to-excel', 'compress-pdf'],
  'edit-pdf':       ['redact-pdf', 'protect-pdf', 'unlock-pdf', 'merge-pdf', 'compress-pdf'],
}

// 'merge-pdf' -> 'mergePdf' (the nav.* / navDesc.* keys in common.json, present in all locales)
const toKey = (slug) => slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

export default function RelatedTools({ current }) {
  const { t } = useTranslations()
  const keys = RELATED_MAP[current] || []
  if (keys.length === 0) return null
  // t() returns the key itself when a translation is missing — fall back to English then.
  const tr = (key, fallback) => { const v = t(key); return v === key ? fallback : v }

  return (
    <section className="bg-gray-50 border-t border-gray-200 py-10 px-4">
      <div className="max-w-4xl mx-auto">

        <h2 className="text-base font-bold text-gray-900 mb-4 uppercase tracking-wide">
          {tr('footer.moreFreeTools', 'More Free PDF Tools')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {keys.map(key => {
            const tool = ALL_TOOLS[key]
            return (
              <Link
                key={key}
                href={tool.href}
                className="flex flex-col items-center text-center bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:border-red-200 hover:shadow-md transition-all group"
              >
                <span className="text-xs font-bold text-gray-900 group-hover:text-red-600 transition-colors leading-tight">
                  {tr(`nav.${toKey(key)}`, tool.name)}
                </span>
                <span className="text-[11px] text-gray-500 mt-1 leading-tight">
                  {tr(`navDesc.${toKey(key)}`, tool.desc)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
