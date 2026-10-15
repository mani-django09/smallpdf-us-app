// Nav data: ONE config drives the desktop bar, mega menus and mobile drawer (see DynamicHeader.jsx).
import {
  Merge, Scissors, Gauge, Unlock, Lock, RotateCw, EyeOff, ScanText, PenLine,
  FileText, FileImage, Image as ImageIcon, Table, Presentation, Sparkles,
} from "lucide-react"

// ── Mega-menu tool groups ────────────────────────────────────────────────────
// labelKey/descKey are i18n keys resolved at render time.
export const PDF_ORGANIZE = [
  { href: "/merge-pdf",    Icon: Merge,    labelKey: 'nav.mergePdf',    descKey: 'navDesc.mergePdf' },
  { href: "/split-pdf",    Icon: Scissors, labelKey: 'nav.splitPdf',    descKey: 'navDesc.splitPdf' },
  { href: "/rotate-pdf",   Icon: RotateCw, labelKey: 'nav.rotatePdf',   descKey: 'navDesc.rotatePdf' },
  { href: "/compress-pdf", Icon: Gauge,    labelKey: 'nav.compressPdf', descKey: 'navDesc.compressPdf' },
  { href: "/edit-pdf",     Icon: PenLine,  labelKey: 'nav.editPdf',     descKey: 'navDesc.editPdf', isNew: true },
]
export const PDF_SECURE = [
  { href: "/protect-pdf",  Icon: Lock,     labelKey: 'nav.protectPdf',  descKey: 'navDesc.protectPdf' },
  { href: "/unlock-pdf",   Icon: Unlock,   labelKey: 'nav.unlockPdf',   descKey: 'navDesc.unlockPdf' },
  { href: "/redact-pdf",   Icon: EyeOff,   labelKey: 'nav.redactPdf',   descKey: 'navDesc.redactPdf', isNew: true },
  { href: "/ocr-pdf",      Icon: ScanText, labelKey: 'nav.ocrPdf',      descKey: 'navDesc.ocrPdf',    isNew: true },
]
export const CONVERT_TO_PDF = [
  { href: "/word-to-pdf",  Icon: FileText,     labelKey: 'nav.wordToPdf',  descKey: 'navDesc.wordToPdf' },
  { href: "/excel-to-pdf", Icon: Table,        labelKey: 'nav.excelToPdf', descKey: 'navDesc.excelToPdf' },
  { href: "/ppt-to-pdf",   Icon: Presentation, labelKey: 'nav.pptToPdf',   descKey: 'navDesc.pptToPdf' },
  { href: "/jpg-to-pdf",   Icon: FileImage,    labelKey: 'nav.jpgToPdf',   descKey: 'navDesc.jpgToPdf' },
  { href: "/png-to-pdf",   Icon: FileImage,    labelKey: 'nav.pngToPdf',   descKey: 'navDesc.pngToPdf' },
]
export const CONVERT_FROM_PDF = [
  { href: "/pdf-to-word",  Icon: FileText,     labelKey: 'nav.pdfToWord',  descKey: 'navDesc.pdfToWord' },
  { href: "/pdf-to-excel", Icon: Table,        labelKey: 'nav.pdfToExcel', descKey: 'navDesc.pdfToExcel' },
  { href: "/pdf-to-ppt",   Icon: Presentation, labelKey: 'nav.pdfToPpt',   descKey: 'navDesc.pdfToPpt' },
  { href: "/pdf-to-jpg",   Icon: FileImage,    labelKey: 'nav.pdfToJpg',   descKey: 'navDesc.pdfToJpg' },
  { href: "/pdf-to-png",   Icon: FileImage,    labelKey: 'nav.pdfToPng',   descKey: 'navDesc.pdfToPng' },
]
export const CONVERT_IMAGES = [
  { href: "/compress-image", Icon: Gauge,     labelKey: 'nav.compressImage', descKey: 'navDesc.compressImage' },
  { href: "/compress-image-to-50kb", Icon: Gauge, labelKey: 'nav.compressImage50kb', descKey: 'navDesc.compressImage50kb' },
  { href: "/compress-image-to-100kb", Icon: Gauge, labelKey: 'nav.compressImage100kb', descKey: 'navDesc.compressImage100kb' },
  { href: "/compress-image-to-20kb", Icon: Gauge, labelKey: 'nav.compressImage20kb', descKey: 'navDesc.compressImage20kb' },
  { href: "/heic-to-jpg",    Icon: ImageIcon, labelKey: 'nav.heicToJpg',     descKey: 'navDesc.heicToJpg' },
  { href: "/heic-to-png",    Icon: ImageIcon, labelKey: 'nav.heicToPng',     descKey: 'navDesc.heicToPng' },
  { href: "/webp-to-png",    Icon: ImageIcon, labelKey: 'nav.webpToPng',     descKey: 'navDesc.webpToPng' },
  { href: "/png-to-webp",    Icon: ImageIcon, labelKey: 'nav.pngToWebp',     descKey: 'navDesc.pngToWebp' },
]

// One config drives the desktop bar, the mega menus, the mobile drawer and the search palette.
export function buildNav(t) {
  return [
    { type: "link", id: "merge", href: "/merge-pdf", label: t("nav.mergePdf") },
    { type: "link", id: "split", href: "/split-pdf", label: t("nav.splitPdf") },
    { type: "mega", id: "pdf", label: t("nav.pdfTools"), cols: 2, groups: [
      { heading: t("nav.groupOrganize"), items: PDF_ORGANIZE },
      { heading: t("nav.groupSecure"), items: PDF_SECURE },
    ] },
    { type: "mega", id: "convert", label: t("nav.convert"), cols: 3, groups: [
      { heading: t("nav.groupToPdf"), items: CONVERT_TO_PDF },
      { heading: t("nav.groupFromPdf"), items: CONVERT_FROM_PDF },
      { heading: t("nav.groupImages"), items: CONVERT_IMAGES },
    ] },
    { type: "link", id: "pricing", href: "/pricing", label: t("nav.pricing"), Icon: Sparkles },
  ]
}
