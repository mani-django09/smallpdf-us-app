import Link from "next/link"
import {
  Button, ComboBox, Disclosure, DisclosureGroup, DisclosurePanel, Heading, Input, Label,
  ListBox, ListBoxItem, Popover,
} from "react-aria-components"
import Layout from "../components/Layout"
import SEOHead from "../components/SEOHead"
import { useTranslations } from "../lib/i18n"
import { getPageMessages } from '../lib/i18nLoader'
import { getLocalizedRoute } from "../lib/route-translations"
import { useLocalizedRouter } from "../lib/useLocalizedRouter"
import AdSenseUnit from "../components/AdSenseUnit"
import HeroUpload from "../components/HeroUpload"
import {
  FileText, Merge, Scissors, Gauge, FileImage, ArrowRight, ArrowUpRight, Check,
  Lock, Zap, Shield, Clock, Users, ChevronDown, Search,
  Presentation, Table, Sparkles, Crown, Award, ScanText, RotateCw, EyeOff, PenLine
} from "lucide-react"

function L(locale, map) { return map[locale] ?? map.en ?? '' }

const INK = "text-[#14130F]"
const TONES = {
  blue: { tile: "bg-[#DCE8FF]", chip: "bg-[#2B5BFF] text-white" },
  green: { tile: "bg-[#D5F1DE]", chip: "bg-[#0F8F4F] text-white" },
  amber: { tile: "bg-[#FFE9B8]", chip: "bg-[#B86A00] text-white" },
  rose: { tile: "bg-[#FFDCDC]", chip: "bg-[#D6293E] text-white" },
  violet: { tile: "bg-[#E7DEFF]", chip: "bg-[#6D3BFF] text-white" },
  ink: { tile: "bg-[#14130F] text-white", chip: "bg-white text-[#14130F]" },
  sand: { tile: "bg-[#ECE8DD]", chip: "bg-[#14130F] text-white" },
}
// tone per tool (design only)
const TONE_BY_HREF = {
  "/merge-pdf": "blue", "/split-pdf": "violet", "/compress-pdf": "green", "/pdf-to-word": "amber", "/word-to-pdf": "sand",
  "/pdf-to-excel": "green", "/excel-to-pdf": "sand", "/pdf-to-ppt": "amber", "/ppt-to-pdf": "sand", "/pdf-to-jpg": "rose",
  "/jpg-to-pdf": "rose", "/png-to-pdf": "sand", "/pdf-to-png": "violet", "/compress-image": "green",
  "/compress-image-to-20kb": "blue", "/compress-image-to-50kb": "blue", "/compress-image-to-100kb": "blue",
  "/webp-to-png": "sand", "/png-to-webp": "sand", "/heic-to-jpg": "amber", "/heic-to-png": "amber", "/unlock-pdf": "amber",
  "/rotate-pdf": "blue", "/protect-pdf": "green", "/redact-pdf": "ink", "/ocr-pdf": "violet", "/edit-pdf": "ink",
}
const FEATURED_STYLE = {
  "/edit-pdf": { kind: "edit", tone: "blue" },
  "/redact-pdf": { kind: "redact", tone: "rose" },
  "/ocr-pdf": { kind: "ocr", tone: "violet" },
}

function hrefFor(href, locale) {
  const localizedSlug = ['ja','de','fr','es','it','id','pt','vi','hi','ar','tr'].includes(locale) ? getLocalizedRoute(href.replace(/^\//, ''), locale) : href.replace(/^\//, '')
  return locale && locale !== 'en' ? `/${locale}/${localizedSlug}` : (localizedSlug ? `/${localizedSlug}` : '/')
}

/* ───────────── illustrations (inline SVG, no external files) ───────────── */
function Page({ x, y, rot, w = 170, h = 220, tag, tagColor, lines = 6, accent = "#2B5BFF" }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect width={w} height={h} rx="16" fill="#fff" stroke="#14130F" strokeWidth="2.5" />
      <path d={`M${w - 38} 0 v26 a12 12 0 0 0 12 12 h26`} fill="#F1EEE6" stroke="#14130F" strokeWidth="2.5" />
      <rect x="18" y="22" width="64" height="9" rx="4.5" fill={accent} />
      {Array.from({ length: lines }).map((_, i) => (
        <rect key={i} x="18" y={52 + i * 20} width={i % 3 === 2 ? 70 : w - 36} height="7" rx="3.5" fill="#14130F" opacity={i % 2 ? 0.13 : 0.22} />
      ))}
      {tag && (
        <g transform={`translate(${w - 54} ${h - 34})`}>
          <rect width="64" height="30" rx="9" fill={tagColor} stroke="#14130F" strokeWidth="2.5" />
          <text x="32" y="20" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="Sora, system-ui">{tag}</text>
        </g>
      )}
    </g>
  )
}

function HeroArt() {
  return (
    <svg viewBox="0 0 520 420" aria-hidden="true" className="absolute inset-0 h-full w-full">
      <circle cx="400" cy="90" r="86" fill="#C6F432" />
      <circle cx="110" cy="330" r="64" fill="#FFDCDC" />
      <rect x="250" y="250" width="200" height="120" rx="60" fill="#DCE8FF" />
      <Page x={64} y={96} rot={-9} tag="DOCX" tagColor="#2B5BFF" lines={5} accent="#2B5BFF" />
      <Page x={290} y={72} rot={8} tag="JPG" tagColor="#6D3BFF" lines={4} accent="#6D3BFF" />
      <Page x={176} y={120} rot={-1} w={178} h={236} tag="PDF" tagColor="#D6293E" lines={7} accent="#D6293E" />
    </svg>
  )
}

function ToolArt({ kind }) {
  return (
    <svg viewBox="0 0 240 150" aria-hidden="true" className="h-full w-full">
      <rect x="62" y="14" width="116" height="132" rx="12" fill="#fff" stroke="#14130F" strokeWidth="2.5" />
      {kind === "edit" && (
        <>
          <rect x="78" y="34" width="60" height="8" rx="4" fill="#2B5BFF" />
          <rect x="78" y="54" width="84" height="6" rx="3" fill="#14130F" opacity=".2" />
          <rect x="78" y="70" width="84" height="6" rx="3" fill="#14130F" opacity=".2" />
          <rect x="78" y="86" width="52" height="6" rx="3" fill="#14130F" opacity=".2" />
          <rect x="134" y="82" width="3" height="16" fill="#14130F" />
          <path d="M150 112 l30 -30 12 12 -30 30 -16 4z" fill="#C6F432" stroke="#14130F" strokeWidth="2.5" strokeLinejoin="round" />
        </>
      )}
      {kind === "redact" && (
        <>
          <rect x="78" y="34" width="60" height="8" rx="4" fill="#14130F" opacity=".2" />
          <rect x="78" y="54" width="84" height="12" rx="3" fill="#14130F" />
          <rect x="78" y="76" width="84" height="6" rx="3" fill="#14130F" opacity=".2" />
          <rect x="78" y="92" width="62" height="12" rx="3" fill="#14130F" />
          <rect x="78" y="114" width="44" height="6" rx="3" fill="#14130F" opacity=".2" />
          <circle cx="178" cy="36" r="16" fill="#FFDCDC" stroke="#14130F" strokeWidth="2.5" />
          <path d="M170 36 h16" stroke="#14130F" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === "ocr" && (
        <>
          <rect x="78" y="34" width="84" height="6" rx="3" fill="#14130F" opacity=".25" />
          <rect x="78" y="50" width="70" height="6" rx="3" fill="#14130F" opacity=".25" />
          <rect x="78" y="66" width="84" height="6" rx="3" fill="#14130F" opacity=".25" />
          <rect x="70" y="84" width="100" height="6" rx="3" fill="#6D3BFF" />
          <rect x="78" y="102" width="60" height="6" rx="3" fill="#14130F" opacity=".25" />
          <rect x="150" y="104" width="40" height="30" rx="8" fill="#C6F432" stroke="#14130F" strokeWidth="2.5" />
          <text x="170" y="125" textAnchor="middle" fontSize="15" fontWeight="800" fill="#14130F" fontFamily="Sora, system-ui">Aa</text>
        </>
      )}
    </svg>
  )
}

function ShieldArt() {
  return (
    <svg viewBox="0 0 320 300" aria-hidden="true" className="h-full w-full">
      <circle cx="160" cy="150" r="128" fill="#D5F1DE" />
      <circle cx="160" cy="150" r="92" fill="none" stroke="#14130F" strokeOpacity=".15" strokeWidth="2" strokeDasharray="4 8" />
      <path d="M160 40 L246 74 V146 C246 204 208 242 160 262 C112 242 74 204 74 146 V74 Z" fill="#fff" stroke="#14130F" strokeWidth="3" strokeLinejoin="round" />
      <rect x="124" y="140" width="72" height="62" rx="12" fill="#C6F432" stroke="#14130F" strokeWidth="3" />
      <path d="M138 140 v-18 a22 22 0 0 1 44 0 v18" fill="none" stroke="#14130F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="160" cy="168" r="7" fill="#14130F" />
      <rect x="156.5" y="172" width="7" height="16" rx="3" fill="#14130F" />
    </svg>
  )
}

function FormatGlyph({ label, color }) {
  return (
    <svg viewBox="0 0 64 76" aria-hidden="true" className="h-16 w-14">
      <path d="M6 8 a6 6 0 0 1 6 -6 h30 l16 16 v50 a6 6 0 0 1 -6 6 H12 a6 6 0 0 1 -6 -6z" fill="#fff" stroke="#14130F" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M42 2 v14 a2 2 0 0 0 2 2 h14" fill="#F1EEE6" stroke="#14130F" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="6" y="36" width="52" height="20" rx="4" fill={color} stroke="#14130F" strokeWidth="2.5" />
      <text x="32" y="51" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Sora, system-ui">{label}</text>
    </svg>
  )
}


function Tile({ tool, locale }) {
  const tone = TONES[TONE_BY_HREF[tool.href] || "sand"]
  const { Icon } = tool
  const dark = (TONE_BY_HREF[tool.href] || "sand") === "ink"
  return (
    <Link
      href={hrefFor(tool.href, locale)}
      locale={false}
      className={`group flex h-full min-h-[132px] flex-col justify-between rounded-[24px] p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-16px_rgba(20,19,15,0.4)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#14130F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5F0] ${tone.tile}`}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.chip}`}><Icon aria-hidden="true" className="h-5 w-5" /></span>
        <span className="flex items-center gap-1.5">
          {tool.isNew && <span className="rounded-full bg-[#C6F432] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#14130F]">{tool.badge}</span>}
          <ArrowUpRight aria-hidden="true" className={`h-4 w-4 opacity-40 transition group-hover:opacity-100 ${dark ? "text-white" : INK}`} />
        </span>
      </div>
      <div className="mt-4">
        <span className="block text-[15px] font-bold leading-tight tracking-tight">{tool.name}</span>
        <span className={`mt-0.5 block text-xs ${dark ? "text-white/70" : "text-[#14130F]/65"}`}>{tool.shortDesc}</span>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const { t, locale } = useTranslations()

  

  const tools = [
    { name: t('nav.mergePdf'), shortDesc: L(locale, { ja: '複数のPDFを結合', de: 'Mehrere PDFs zusammenführen', fr: 'Combiner plusieurs PDF', es: 'Combinar varios PDF', en: 'Combine multiple PDFs', it: 'Combina più PDF', id: 'Gabungkan beberapa PDF', pt: 'Combinar vários PDFs', vi: 'Gộp nhiều PDF', hi: 'कई PDF को जोड़ें', ar: 'اجمع عدة ملفات PDF', tr: 'Birden çok PDF\'i birleştirin' }), href: "/merge-pdf", Icon: Merge, gradient: "from-blue-500 to-sky-500" },
    { name: t('nav.splitPdf'), shortDesc: L(locale, { ja: 'PDFからページを抽出', de: 'Seiten aus PDF extrahieren', fr: 'Extraire des pages du PDF', es: 'Extraer páginas de PDF', en: 'Extract pages from PDF', it: 'Estrai pagine dal PDF', id: 'Ekstrak halaman dari PDF', pt: 'Extrair páginas do PDF', vi: 'Trích xuất trang từ PDF', hi: 'PDF से पेज निकालें', ar: 'استخرج صفحات من PDF', tr: 'PDF\'ten sayfa ayırın' }), href: "/split-pdf", Icon: Scissors, gradient: "from-cyan-500 to-teal-500" },
    { name: t('nav.compressPdf'), shortDesc: L(locale, { ja: 'ファイルサイズを削減', de: 'Dateigröße reduzieren', fr: 'Réduire la taille du fichier', es: 'Reducir el tamaño del archivo', en: 'Reduce file size', it: 'Riduci la dimensione del file', id: 'Kurangi ukuran file', pt: 'Reduzir o tamanho do arquivo', vi: 'Giảm dung lượng tệp', hi: 'फ़ाइल का आकार घटाएँ', ar: 'قلّل حجم الملف', tr: 'Dosya boyutunu küçültün' }), href: "/compress-pdf", Icon: Gauge, gradient: "from-emerald-500 to-green-500" },
    { name: t('nav.pdfToWord'), shortDesc: L(locale, { ja: 'DOCXに変換', de: 'In DOCX konvertieren', fr: 'Convertir en DOCX', es: 'Convertir a DOCX', en: 'Convert to DOCX', it: 'Converti in DOCX', id: 'Konversi ke DOCX', pt: 'Converter para DOCX', vi: 'Chuyển sang DOCX', hi: 'DOCX में बदलें', ar: 'حوّل إلى DOCX', tr: 'DOCX\'e dönüştürün' }), href: "/pdf-to-word", Icon: FileText, gradient: "from-blue-500 to-cyan-500" },
    { name: t('nav.wordToPdf'), shortDesc: L(locale, { ja: 'DOCXからPDF', de: 'DOCX in PDF umwandeln', fr: 'Convertir DOCX en PDF', es: 'Convertir DOCX a PDF', en: 'Convert DOCX to PDF', it: 'Converti DOCX in PDF', id: 'Konversi DOCX ke PDF', pt: 'Converter DOCX para PDF', vi: 'Chuyển DOCX sang PDF', hi: 'DOCX को PDF में बदलें', ar: 'حوّل DOCX إلى PDF', tr: 'DOCX\'i PDF\'e dönüştürün' }), href: "/word-to-pdf", Icon: FileText, gradient: "from-indigo-500 to-blue-500" },
    { name: t('nav.pdfToExcel'), shortDesc: L(locale, { ja: 'XLSXに表を抽出', de: 'Tabellen in XLSX extrahieren', fr: 'Extraire des tableaux en XLSX', es: 'Extraer tablas a XLSX', en: 'Extract tables to XLSX', it: 'Estrai tabelle in XLSX', id: 'Ekstrak tabel ke XLSX', pt: 'Extrair tabelas para XLSX', vi: 'Trích xuất bảng sang XLSX', hi: 'टेबल को XLSX में निकालें', ar: 'استخرج الجداول إلى XLSX', tr: 'Tabloları XLSX\'e çıkarın' }), href: "/pdf-to-excel", Icon: Table, gradient: "from-green-500 to-emerald-500" },
    { name: t('nav.excelToPdf'), shortDesc: L(locale, { ja: 'XLSXからPDF', de: 'XLSX in PDF umwandeln', fr: 'Convertir XLSX en PDF', es: 'Convertir XLSX a PDF', en: 'Convert XLSX to PDF', it: 'Converti XLSX in PDF', id: 'Konversi XLSX ke PDF', pt: 'Converter XLSX para PDF', vi: 'Chuyển XLSX sang PDF', hi: 'XLSX को PDF में बदलें', ar: 'حوّل XLSX إلى PDF', tr: 'XLSX\'i PDF\'e dönüştürün' }), href: "/excel-to-pdf", Icon: Table, gradient: "from-teal-500 to-green-500" },
    { name: t('nav.pdfToPpt'), shortDesc: L(locale, { ja: 'PowerPointに変換', de: 'In PowerPoint konvertieren', fr: 'Convertir en PowerPoint', es: 'Convertir a PowerPoint', en: 'Convert to PowerPoint', it: 'Converti in PowerPoint', id: 'Konversi ke PowerPoint', pt: 'Converter para PowerPoint', vi: 'Chuyển sang PowerPoint', hi: 'PowerPoint में बदलें', ar: 'حوّل إلى PowerPoint', tr: 'PowerPoint\'e dönüştürün' }), href: "/pdf-to-ppt", Icon: Presentation, gradient: "from-blue-500 to-cyan-500" },
    { name: t('nav.pptToPdf'), shortDesc: L(locale, { ja: 'PowerPointからPDF', de: 'PowerPoint in PDF', fr: 'PowerPoint en PDF', es: 'PowerPoint a PDF', en: 'PowerPoint to PDF', it: 'PowerPoint in PDF', id: 'PowerPoint ke PDF', pt: 'PowerPoint para PDF', vi: 'PowerPoint sang PDF', hi: 'PowerPoint से PDF', ar: 'PowerPoint إلى PDF', tr: 'PowerPoint\'ten PDF\'e' }), href: "/ppt-to-pdf", Icon: Presentation, gradient: "from-cyan-500 to-blue-500" },
    { name: t('nav.pdfToJpg'), shortDesc: L(locale, { ja: '画像を抽出', de: 'Bilder extrahieren', fr: 'Extraire des images', es: 'Extraer imágenes', en: 'Extract images', it: 'Estrai immagini', id: 'Ekstrak gambar', pt: 'Extrair imagens', vi: 'Trích xuất hình ảnh', hi: 'इमेज निकालें', ar: 'استخرج الصور', tr: 'Görselleri çıkarın' }), href: "/pdf-to-jpg", Icon: FileImage, gradient: "from-yellow-500 to-cyan-500" },
    { name: t('nav.jpgToPdf'), shortDesc: L(locale, { ja: '画像からPDF', de: 'Bilder in PDF', fr: 'Images en PDF', es: 'Imágenes a PDF', en: 'Images to PDF', it: 'Immagini in PDF', id: 'Gambar ke PDF', pt: 'Imagens para PDF', vi: 'Ảnh sang PDF', hi: 'इमेज से PDF', ar: 'من الصور إلى PDF', tr: 'Görselleri PDF\'e' }), href: "/jpg-to-pdf", Icon: FileImage, gradient: "from-pink-500 to-sky-500" },
    { name: t('nav.pngToPdf'), shortDesc: L(locale, { ja: 'PNGをPDF形式に', de: 'PNG in PDF-Format', fr: 'PNG au format PDF', es: 'PNG a formato PDF', en: 'PNG to PDF format', it: 'PNG in formato PDF', id: 'PNG ke format PDF', pt: 'PNG para formato PDF', vi: 'PNG sang định dạng PDF', hi: 'PNG को PDF फ़ॉर्मेट में', ar: 'PNG إلى صيغة PDF', tr: 'PNG\'yi PDF biçimine' }), href: "/png-to-pdf", Icon: FileImage, gradient: "from-cyan-500 to-teal-500" },
    { name: t('nav.pdfToPng'), shortDesc: L(locale, { ja: 'PNGとしてエクスポート', de: 'Als PNG exportieren', fr: 'Exporter en PNG', es: 'Exportar como PNG', en: 'Export as PNG', it: 'Esporta come PNG', id: 'Ekspor sebagai PNG', pt: 'Exportar como PNG', vi: 'Xuất dưới dạng PNG', hi: 'PNG के रूप में एक्सपोर्ट करें', ar: 'صدّر بصيغة PNG', tr: 'PNG olarak dışa aktarın' }), href: "/pdf-to-png", Icon: FileImage, gradient: "from-violet-500 to-purple-500" },
    { name: t('nav.compressImage'), shortDesc: L(locale, { ja: '画像を最適化', de: 'Bilder optimieren', fr: 'Optimiser les images', es: 'Optimizar imágenes', en: 'Optimize images', it: 'Ottimizza immagini', id: 'Optimalkan gambar', pt: 'Otimizar imagens', vi: 'Tối ưu ảnh', hi: 'इमेज ऑप्टिमाइज़ करें', ar: 'حسّن الصور', tr: 'Görselleri optimize edin' }), href: "/compress-image", Icon: FileImage, gradient: "from-fuchsia-500 to-sky-500" },
    { name: t('nav.compressImage20kb'), shortDesc: L(locale, { ja: '正確に20KBに', de: 'Genau auf 20 KB', fr: 'Exactement 20 Ko', es: 'Exactamente 20 KB', en: 'Hit an exact 20KB target', it: 'Esattamente 20 KB', id: 'Tepat 20KB', pt: 'Exatamente 20KB', vi: 'Đạt đúng mục tiêu 20KB', hi: 'ठीक 20KB का लक्ष्य पाएँ', ar: 'بلوغ حجم 20KB بدقة', tr: 'Tam 20KB hedefine ulaşın' }), href: "/compress-image-to-20kb", Icon: Gauge, gradient: "from-blue-500 to-indigo-500" },
    { name: t('nav.compressImage50kb'), shortDesc: L(locale, { ja: '正確に50KBに', de: 'Genau auf 50 KB', fr: 'Exactement 50 Ko', es: 'Exactamente 50 KB', en: 'Hit an exact 50KB target', it: 'Esattamente 50 KB', id: 'Tepat 50KB', pt: 'Exatamente 50KB', vi: 'Đạt đúng mục tiêu 50KB', hi: 'ठीक 50KB का लक्ष्य पाएँ', ar: 'بلوغ حجم 50KB بدقة', tr: 'Tam 50KB hedefine ulaşın' }), href: "/compress-image-to-50kb", Icon: Gauge, gradient: "from-indigo-500 to-blue-600" },
    { name: t('nav.compressImage100kb'), shortDesc: L(locale, { ja: '正確に100KBに', de: 'Genau auf 100 KB', fr: 'Exactement 100 Ko', es: 'Exactamente 100 KB', en: 'Hit an exact 100KB target', it: 'Esattamente 100 KB', id: 'Tepat 100KB', pt: 'Exatamente 100KB', vi: 'Đạt đúng mục tiêu 100KB', hi: 'ठीक 100KB का लक्ष्य पाएँ', ar: 'بلوغ حجم 100KB بدقة', tr: 'Tam 100KB hedefine ulaşın' }), href: "/compress-image-to-100kb", Icon: Gauge, gradient: "from-blue-600 to-sky-500" },
    { name: t('nav.webpToPng'), shortDesc: L(locale, { ja: 'WebP変換', de: 'WebP-Konvertierung', fr: 'Conversion WebP', es: 'Conversión WebP', en: 'WebP conversion', it: 'Conversione WebP', id: 'Konversi WebP', pt: 'Conversão WebP', vi: 'Chuyển đổi WebP', hi: 'WebP कन्वर्ज़न', ar: 'تحويل WebP', tr: 'WebP dönüştürme' }), href: "/webp-to-png", Icon: FileImage, gradient: "from-teal-500 to-emerald-500" },
    { name: t('nav.pngToWebp'), shortDesc: L(locale, { ja: 'WebPに変換', de: 'In WebP konvertieren', fr: 'Convertir en WebP', es: 'Convertir a WebP', en: 'Convert to WebP', it: 'Converti in WebP', id: 'Konversi ke WebP', pt: 'Converter para WebP', vi: 'Chuyển sang WebP', hi: 'WebP में बदलें', ar: 'حوّل إلى WebP', tr: 'WebP\'ye dönüştürün' }), href: "/png-to-webp", Icon: FileImage, gradient: "from-lime-500 to-green-500" },
    { name: t('nav.heicToJpg'), shortDesc: L(locale, { ja: 'iPhoneの写真を変換', de: 'iPhone-Fotos konvertieren', fr: 'Convertir les photos iPhone', es: 'Convertir fotos de iPhone', en: 'Convert iPhone photos', it: 'Converti foto iPhone', id: 'Konversi foto iPhone', pt: 'Converter fotos do iPhone', vi: 'Chuyển ảnh iPhone', hi: 'iPhone फ़ोटो बदलें', ar: 'حوّل صور iPhone', tr: 'iPhone fotoğraflarını dönüştürün' }), href: "/heic-to-jpg", Icon: FileImage, gradient: "from-orange-500 to-amber-500" },
    { name: t('nav.heicToPng'), shortDesc: L(locale, { ja: 'HEICをPNGに変換', de: 'iPhone-Fotos verlustfrei', fr: 'HEIC en PNG sans perte', es: 'HEIC a PNG sin pérdida', en: 'Lossless HEIC conversion', it: 'HEIC in PNG lossless', id: 'Konversi HEIC lossless', pt: 'HEIC para PNG sem perda', vi: 'Chuyển HEIC không mất dữ liệu', hi: 'लॉसलेस HEIC कन्वर्ज़न', ar: 'تحويل HEIC بلا فقد', tr: 'Kayıpsız HEIC dönüştürme' }), href: "/heic-to-png", Icon: FileImage, gradient: "from-teal-500 to-cyan-500" },
    { name: t('nav.unlockPdf'), shortDesc: L(locale, { ja: 'パスワード保護を解除', de: 'Passwortschutz entfernen', fr: 'Supprimer la protection', es: 'Eliminar protección', en: 'Remove password protection', it: 'Rimuovi protezione password', id: 'Hapus proteksi kata sandi', pt: 'Remover proteção por senha', vi: 'Gỡ bảo vệ bằng mật khẩu', hi: 'पासवर्ड सुरक्षा हटाएँ', ar: 'إزالة حماية كلمة المرور', tr: 'Parola korumasını kaldırın' }), href: "/unlock-pdf", Icon: Lock, gradient: "from-amber-500 to-orange-500" },
    { name: t('nav.rotatePdf'), shortDesc: L(locale, { ja: 'PDFページを回転', de: 'PDF-Seiten drehen', fr: 'Pivoter les pages PDF', es: 'Rotar páginas PDF', en: 'Rotate PDF pages', it: 'Ruota le pagine PDF', id: 'Putar halaman PDF', pt: 'Girar páginas PDF', vi: 'Xoay các trang PDF', hi: 'PDF पेज घुमाएँ', ar: 'تدوير صفحات PDF', tr: 'PDF sayfalarını döndürün' }), href: "/rotate-pdf", Icon: RotateCw, gradient: "from-indigo-500 to-blue-500" },
    { name: "Protect PDF", shortDesc: L(locale, { ja: 'パスワードで保護', de: 'Mit Passwort schützen', fr: 'Protéger par mot de passe', es: 'Proteger con contraseña', en: 'Password-protect PDF', it: 'Proteggi con password', id: 'Lindungi dengan kata sandi', pt: 'Proteger com senha', vi: 'Đặt mật khẩu cho PDF', hi: 'PDF को पासवर्ड से सुरक्षित करें', ar: 'حماية PDF بكلمة مرور', tr: 'PDF\'i parolayla koruyun' }), href: "/protect-pdf", Icon: Lock, gradient: "from-emerald-500 to-teal-500" },
    { name: t('nav.redactPdf'), shortDesc: L(locale, { ja: '機密情報を完全に削除', de: 'Inhalte dauerhaft schwärzen', fr: 'Masquer définitivement', es: 'Ocultar de forma permanente', en: 'Permanently black out content', it: 'Oscura in modo permanente', id: 'Hapus konten permanen', pt: 'Ocultar permanentemente', vi: 'Che đen nội dung vĩnh viễn', hi: 'सामग्री स्थायी रूप से काली करें', ar: 'حجب المحتوى نهائياً', tr: 'İçeriği kalıcı olarak karartın' }), href: "/redact-pdf", Icon: EyeOff, gradient: "from-slate-600 to-slate-800", isNew: true },
    { name: "OCR PDF", shortDesc: L(locale, { ja: 'PDFからテキストを抽出', de: 'Text aus PDF extrahieren', fr: 'Extraire le texte du PDF', es: 'Extraer texto del PDF', en: 'Extract text from PDF', it: 'Estrai testo dal PDF', id: 'Ekstrak teks dari PDF', pt: 'Extrair texto do PDF', vi: 'Trích xuất văn bản từ PDF', hi: 'PDF से टेक्स्ट निकालें', ar: 'استخراج النص من PDF', tr: 'PDF\'ten metin çıkarın' }), href: "/ocr-pdf", Icon: ScanText, gradient: "from-violet-500 to-purple-500", isNew: true },
    { name: t('nav.editPdf'), shortDesc: L(locale, { ja: '覆って新しいテキストを入力', de: 'Überdecken und neu eintippen', fr: 'Recouvrir et retaper du texte', es: 'Cubrir y reescribir texto', en: 'Whiteout and retype text', it: 'Copri e riscrivi il testo', id: 'Tutup dan ketik ulang teks', pt: 'Cobrir e reescrever texto', vi: 'Che và gõ lại văn bản', hi: 'टेक्स्ट मिटाकर दोबारा टाइप करें', ar: 'تغطية النص وإعادة كتابته', tr: 'Metni kapatıp yeniden yazın' }), href: "/edit-pdf", Icon: PenLine, gradient: "from-blue-600 to-slate-900", isNew: true },
  ]

  const ctaText = L(locale, { ja: '試してみる', de: 'Jetzt testen', fr: 'Essayer', es: 'Probar ahora', en: 'Try it free', it: 'Provalo ora', id: 'Coba sekarang', pt: 'Experimentar', vi: 'Dùng thử miễn phí', hi: 'मुफ़्त आज़माएँ', ar: 'جرّبه مجاناً', tr: 'Ücretsiz deneyin' })
  const badgeText = L(locale, { ja: '新機能', de: 'Neu', fr: 'Nouveau', es: 'Nuevo', en: 'New', it: 'Novità', id: 'Baru', pt: 'Novo', vi: 'Mới', hi: 'नया', ar: 'جديد', tr: 'Yeni' })

  const featuredTools = [
    {
      name: t('nav.editPdf'), href: "/edit-pdf", Icon: PenLine, gradient: "from-blue-600 to-slate-900",
      longDesc: L(locale, {
        ja: 'PDF内の任意のテキストをクリックして直接打ち直せます。実際のテキスト編集で、画像化されません。',
        de: 'Klicke auf jeden Text in deinem PDF und tippe ihn direkt neu - echte Textbearbeitung, kein Bild.',
        fr: 'Cliquez sur n\'importe quel texte de votre PDF et retapez-le directement - vraie modification, pas une image.',
        es: 'Haz clic en cualquier texto de tu PDF y reescríbelo directamente - edición real, no una imagen.',
        en: 'Click any text in your PDF and retype it directly - real text editing, not a flattened image.',
        it: 'Clicca su qualsiasi testo del tuo PDF e riscrivilo direttamente - modifica reale, non un\'immagine.',
        id: 'Klik teks mana pun di PDF-mu dan ketik ulang langsung - pengeditan teks sungguhan, bukan gambar.',
        pt: 'Clique em qualquer texto do seu PDF e reescreva direto - edição real, não uma imagem.',
        vi: 'Nhấp vào bất kỳ văn bản nào trong PDF và gõ lại trực tiếp - chỉnh sửa văn bản thật, không phải ảnh phẳng.',
        hi: 'अपनी PDF में किसी भी टेक्स्ट पर क्लिक करें और सीधे दोबारा टाइप करें - असली टेक्स्ट एडिटिंग, सपाट इमेज नहीं।',
        ar: 'اضغط على أي نص في ملف PDF وأعد كتابته مباشرة، تعديل نص حقيقي وليس صورة مسطحة.',
        tr: 'PDF\'inizdeki herhangi bir metne tıklayın ve doğrudan yeniden yazın; gerçek metin düzenleme, düz bir görsel değil.',
      }), ctaText, badgeText,
    },
    {
      name: t('nav.redactPdf'), href: "/redact-pdf", Icon: EyeOff, gradient: "from-slate-600 to-slate-800",
      longDesc: L(locale, {
        ja: '機密情報を永久に削除。カバーするだけでなく、実際にPDFから取り除きます。',
        de: 'Vertrauliche Inhalte dauerhaft entfernen - nicht nur überdeckt, sondern wirklich aus dem PDF gelöscht.',
        fr: 'Supprimez définitivement les infos sensibles - pas seulement masquées, vraiment retirées du PDF.',
        es: 'Elimina información sensible de forma permanente - no solo se cubre, se quita realmente del PDF.',
        en: 'Permanently remove sensitive info - not just covered up, actually stripped from the PDF.',
        it: 'Rimuovi le informazioni sensibili in modo permanente - non solo coperte, davvero eliminate dal PDF.',
        id: 'Hapus info sensitif secara permanen - bukan hanya ditutup, benar-benar dihapus dari PDF.',
        pt: 'Remova informações sensíveis permanentemente - não só cobertas, realmente removidas do PDF.',
        vi: 'Xóa vĩnh viễn thông tin nhạy cảm - không chỉ bị che đi, mà thực sự bị gỡ khỏi PDF.',
        hi: 'संवेदनशील जानकारी स्थायी रूप से हटाएँ - सिर्फ़ ढकी नहीं, सचमुच PDF से निकाल दी जाती है।',
        ar: 'احذف المعلومات الحساسة نهائياً، فلا تُغطّى فقط بل تُزال فعلاً من ملف PDF.',
        tr: 'Hassas bilgileri kalıcı olarak silin; yalnızca örtülmez, PDF\'ten gerçekten kaldırılır.',
      }), ctaText, badgeText,
    },
    {
      name: "OCR PDF", href: "/ocr-pdf", Icon: ScanText, gradient: "from-violet-500 to-purple-500",
      longDesc: L(locale, {
        ja: 'スキャンしたPDFを検索・コピー可能なテキストに変換します。',
        de: 'Verwandle gescannte PDFs in durchsuchbaren, kopierbaren Text.',
        fr: 'Transformez un PDF scanné en texte consultable et copiable.',
        es: 'Convierte un PDF escaneado en texto que puedes buscar y copiar.',
        en: 'Turn a scanned PDF into text you can actually search and copy.',
        it: 'Trasforma un PDF scansionato in testo ricercabile e copiabile.',
        id: 'Ubah PDF hasil pindaian menjadi teks yang bisa dicari dan disalin.',
        pt: 'Transforme um PDF digitalizado em texto pesquisável e copiável.',
        vi: 'Biến PDF quét thành văn bản bạn có thể thực sự tìm kiếm và sao chép.',
        hi: 'स्कैन की गई PDF को ऐसे टेक्स्ट में बदलें जिसे आप सचमुच खोज और कॉपी कर सकें।',
        ar: 'حوّل ملف PDF الممسوح ضوئياً إلى نص يمكنك البحث فيه ونسخه فعلاً.',
        tr: 'Taranmış PDF\'i gerçekten arayıp kopyalayabileceğiniz metne dönüştürün.',
      }), ctaText, badgeText,
    },
  ]

  // FAQs - Dynamic based on locale
  const faqs = locale === 'ja' ? [
    {
      question: "このウェブサイトは本当に無料ですか？",
      answer: "はい。すべてのツールを無料で使え、支払いなしですぐに始められます。無料プランには1日の利用回数とファイルサイズの上限があります。大きなファイル、バッチ処理、広告なしの環境が必要な場合は、StarterプランとProプランをご利用ください。無料プランは少数の広告で運営しています。"
    },
    {
      question: "アップロードしたファイルのセキュリティは？",
      answer: "ファイルは暗号化されたHTTPS接続（256ビットSSL）で送信されるため、途中で第三者に読まれることはありません。無料プランでは、アップロードしたファイルと変換後のファイルは処理後約1時間で自動削除されます。有料プランでは、再ダウンロードできるよう「マイファイル」に24時間または48時間保存され、それより早く削除することもできます。変換に失敗した場合は、原因を調べるために最大24時間保管し、その後削除します。ドキュメントを販売したり共有したりすることはありません。",
    },
    {
      question: "どのファイル形式をサポートしていますか？",
      answer: "文書はPDF、Word（DOC、DOCX）、Excel（XLS、XLSX、CSV）、PowerPoint（PPT、PPTX）に対応。画像はJPG、PNG、WebPのほか、iPhoneのHEIC/HEIF写真にも対応しています。PDFの結合、分割、圧縮、変換、編集、墨消し、OCR、回転、保護、ロック解除、画像の圧縮や変換ができます。",
    },
    {
      question: "アカウントを作成する必要がありますか？",
      answer: "いいえ。アカウントを作成しなくても、すべてのツールをお使いいただけます。無料アカウントを作ると1日の上限が増え、最近のファイル履歴も確認できます。有料プランではより大きなファイルとバッチ処理が使えます。"
    },
    {
      question: "スマートフォンやタブレットで使用できますか？",
      answer: "もちろんです！サイト全体がどのデバイスでもシームレスに動作します。iPhone、Androidスマートフォン、iPad、Surfaceタブレット、MacBook、Windowsデスクトップのいずれでも、同じ高速でスムーズな体験が得られます。すべてがタッチスクリーンでも完璧に動作するように設計されているため、モバイルデバイスでボタンをタップしたりファイルをドラッグしたりするのが自然に感じられます。ダウンロードやインストールする別のアプリはありません。"
    }
  ] : locale === 'de' ? [
    {
      question: "Ist diese Website wirklich kostenlos?",
      answer: "Ja - alle Tools lassen sich kostenlos nutzen, und Sie können sofort ohne Bezahlung loslegen. Der kostenlose Plan hat ein Tageslimit und Dateigrößengrenzen; für größere Dateien, Stapelverarbeitung oder ein werbefreies Erlebnis gibt es die Pläne Starter und Pro. Den kostenlosen Plan finanzieren wir über wenige Anzeigen."
    },
    {
      question: "Wie sicher sind meine Dateien beim Hochladen?",
      answer: "Dateien werden über eine verschlüsselte HTTPS-Verbindung (256-Bit-SSL) übertragen, sodass niemand sie unterwegs lesen kann. Im Gratis-Plan werden hochgeladene und konvertierte Dateien etwa 1 Stunde nach der Verarbeitung automatisch gelöscht. In bezahlten Plänen bleiben Ergebnisse 24 oder 48 Stunden in „Meine Dateien“, damit Sie sie erneut herunterladen können, und Sie können sie auch früher löschen. Schlägt eine Konvertierung fehl, kann die hochgeladene Datei bis zu 24 Stunden zur Fehlerbehebung aufbewahrt und danach gelöscht werden. Wir verkaufen oder teilen Ihre Dokumente nie.",
    },
    {
      question: "Welche Dateiformate werden unterstützt?",
      answer: "Dokumente: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) und PowerPoint (PPT, PPTX). Bilder: JPG, PNG und WebP sowie HEIC/HEIF-Fotos vom iPhone. Sie können PDFs zusammenfügen, teilen, komprimieren, konvertieren, bearbeiten, schwärzen, per OCR erkennen, drehen, schützen und entsperren sowie Bilder komprimieren oder konvertieren.",
    },
    {
      question: "Muss ich ein Konto erstellen?",
      answer: "Nein - alle Tools funktionieren ohne Konto. Mit einem kostenlosen Konto erhalten Sie ein höheres Tageslimit und einen Verlauf Ihrer letzten Dateien; bezahlte Pläne bieten größere Dateien und Stapelverarbeitung."
    },
    {
      question: "Kann ich die Website auf meinem Smartphone oder Tablet nutzen?",
      answer: "Natürlich! Die gesamte Website funktioniert nahtlos auf jedem Gerät. Ob iPhone, Android-Smartphone, iPad, Surface-Tablet, MacBook oder Windows-Desktop – Sie erhalten überall das gleiche schnelle und flüssige Erlebnis. Alles wurde für Touchscreens optimiert, sodass das Tippen auf Schaltflächen und das Ziehen von Dateien auf Mobilgeräten ganz natürlich wirkt. Es gibt keine separate App zum Herunterladen oder Installieren."
    }
  ] : locale === 'fr' ? [
    {
      question: "Ce site est-il vraiment gratuit ?",
      answer: "Oui - tous les outils sont utilisables gratuitement et vous pouvez commencer tout de suite sans payer. Le forfait gratuit a une limite quotidienne et des tailles de fichier maximales ; pour des fichiers plus lourds, le traitement par lots ou une expérience sans publicité, les forfaits Starter et Pro sont disponibles. Le forfait gratuit est financé par quelques publicités."
    },
    {
      question: "Mes fichiers sont-ils sécurisés lors du téléchargement ?",
      answer: "Les fichiers sont envoyés via une connexion HTTPS chiffrée (SSL 256 bits) : personne ne peut les lire pendant le transfert. Avec le forfait gratuit, les fichiers envoyés et convertis sont supprimés automatiquement environ 1 heure après le traitement. Avec un forfait payant, les résultats restent 24 ou 48 heures dans « Mes fichiers » pour être retéléchargés, et vous pouvez les supprimer plus tôt. Si une conversion échoue, le fichier envoyé peut être conservé jusqu'à 24 heures pour corriger le problème, puis il est supprimé. Nous ne vendons ni ne partageons jamais vos documents.",
    },
    {
      question: "Quels formats de fichiers sont pris en charge ?",
      answer: "Documents : PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) et PowerPoint (PPT, PPTX). Images : JPG, PNG et WebP, ainsi que les photos HEIC/HEIF de l'iPhone. Vous pouvez fusionner, diviser, compresser, convertir, modifier, caviarder, passer à l'OCR, pivoter, protéger et déverrouiller des PDF, et compresser ou convertir des images.",
    },
    {
      question: "Dois-je créer un compte ?",
      answer: "Non - tous les outils fonctionnent sans compte. Un compte gratuit vous donne une limite quotidienne plus élevée et l'historique de vos fichiers récents ; les forfaits payants ajoutent des fichiers plus lourds et le traitement par lots."
    },
    {
      question: "Puis-je l'utiliser sur mon téléphone ou ma tablette ?",
      answer: "Bien sûr ! L'ensemble du site fonctionne parfaitement sur n'importe quel appareil. Que vous soyez sur un iPhone, un téléphone Android, un iPad, une tablette Surface, un MacBook ou un bureau Windows, vous bénéficierez de la même expérience rapide et fluide. Tout est conçu pour fonctionner parfaitement avec les écrans tactiles."
    }
  ] : locale === 'es' ? [
    {
      question: "¿Es realmente gratuito este sitio?",
      answer: "Sí: todas las herramientas se pueden usar gratis y puedes empezar ya mismo sin pagar. El plan gratuito tiene un límite diario y tamaños máximos de archivo; si necesitas archivos más grandes, procesamiento por lotes o una experiencia sin anuncios, están los planes Starter y Pro. Mantenemos el plan gratuito con unos pocos anuncios."
    },
    {
      question: "¿Son seguros mis archivos cuando los subo?",
      answer: "Los archivos se envían por una conexión HTTPS cifrada (SSL de 256 bits), así que nadie puede leerlos por el camino. En el plan gratuito, los archivos subidos y convertidos se eliminan automáticamente unos 60 minutos después del procesamiento. En los planes de pago, los resultados se guardan 24 o 48 horas en \"Mis archivos\" para que puedas descargarlos de nuevo, y puedes borrarlos antes. Si una conversión falla, el archivo subido puede conservarse hasta 24 horas para resolver el problema y luego se elimina. Nunca vendemos ni compartimos tus documentos.",
    },
    {
      question: "¿Qué formatos de archivo son compatibles?",
      answer: "Documentos: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) y PowerPoint (PPT, PPTX). Imágenes: JPG, PNG y WebP, además de fotos HEIC/HEIF del iPhone. Puedes unir, dividir, comprimir, convertir, editar, censurar, aplicar OCR, rotar, proteger y desbloquear PDF, y comprimir o convertir imágenes.",
    },
    {
      question: "¿Necesito crear una cuenta?",
      answer: "No: puedes usar todas las herramientas sin crear una cuenta. Una cuenta gratuita te da un límite diario más alto y el historial de tus archivos recientes, y los planes de pago añaden archivos más grandes y procesamiento por lotes."
    },
    {
      question: "¿Puedo usarlo en mi teléfono o tableta?",
      answer: "¡Por supuesto! Todo el sitio funciona perfectamente en cualquier dispositivo. Ya sea un iPhone, teléfono Android, iPad, tableta Surface, MacBook o escritorio Windows, tendrás la misma experiencia rápida y fluida. Todo está diseñado para funcionar perfectamente con pantallas táctiles también."
    }
  ] : locale === 'it' ? [
    {
      question: "Il vostro sito è davvero gratuito?",
      answer: "Sì: tutti gli strumenti si possono usare gratis e puoi iniziare subito senza pagare. Il piano gratuito ha un limite giornaliero e dimensioni massime dei file; se ti servono file più grandi, elaborazione batch o un'esperienza senza pubblicità, ci sono i piani Starter e Pro. Manteniamo il piano gratuito con pochi annunci."
    },
    {
      question: "I miei file sono sicuri quando li carico?",
      answer: "I file vengono inviati tramite una connessione HTTPS crittografata (SSL a 256 bit), quindi nessuno può leggerli durante il trasferimento. Con il piano gratuito, i file caricati e convertiti vengono eliminati automaticamente circa 1 ora dopo l'elaborazione. Con i piani a pagamento, i risultati restano in \"I miei file\" per 24 o 48 ore per poterli riscaricare, e puoi eliminarli prima. Se una conversione non riesce, il file caricato può essere conservato fino a 24 ore per risolvere il problema, poi viene eliminato. Non vendiamo né condividiamo mai i tuoi documenti.",
    },
    {
      question: "Quali formati di file sono supportati?",
      answer: "Documenti: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) e PowerPoint (PPT, PPTX). Immagini: JPG, PNG e WebP, più le foto HEIC/HEIF dell'iPhone. Puoi unire, dividere, comprimere, convertire, modificare, oscurare, applicare l'OCR, ruotare, proteggere e sbloccare PDF, e comprimere o convertire immagini.",
    },
    {
      question: "Devo creare un account?",
      answer: "No: puoi usare tutti gli strumenti senza creare un account. Un account gratuito ti offre un limite giornaliero più alto e la cronologia dei file recenti; i piani a pagamento aggiungono file più grandi ed elaborazione batch."
    },
    {
      question: "Posso usarlo sul telefono o sul tablet?",
      answer: "Certo che sì! L'intero sito funziona perfettamente su qualsiasi dispositivo. Che tu abbia un iPhone, un telefono Android, un iPad, un tablet Surface, un MacBook o un desktop Windows, avrai la stessa esperienza veloce e fluida. Tutto è stato progettato per funzionare perfettamente anche con i touchscreen, quindi toccare pulsanti e trascinare file risulta naturale sui dispositivi mobili. Non c'è nessuna app separata da scaricare o installare."
    }
  ] : locale === 'id' ? [
    {
      question: "Apakah situs ini benar-benar gratis?",
      answer: "Ya - semua alat bisa digunakan secara gratis dan Anda bisa langsung mulai tanpa membayar. Paket gratis memiliki batas harian dan batas ukuran file; jika butuh file lebih besar, pemrosesan batch, atau pengalaman tanpa iklan, tersedia paket Starter dan Pro. Paket gratis kami didukung oleh sedikit iklan."
    },
    {
      question: "Apakah file saya aman saat diunggah?",
      answer: "File dikirim lewat koneksi HTTPS terenkripsi (SSL 256-bit), jadi tidak ada yang bisa membacanya di tengah jalan. Pada paket gratis, file yang diunggah dan dikonversi dihapus otomatis sekitar 1 jam setelah diproses. Pada paket berbayar, hasil disimpan di \"File Saya\" selama 24 atau 48 jam agar bisa diunduh lagi, dan Anda bisa menghapusnya lebih cepat. Jika konversi gagal, file yang diunggah dapat disimpan hingga 24 jam untuk memperbaiki masalahnya, lalu dihapus. Kami tidak pernah menjual atau membagikan dokumen Anda.",
    },
    {
      question: "Format file apa yang didukung?",
      answer: "Dokumen: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV), dan PowerPoint (PPT, PPTX). Gambar: JPG, PNG, dan WebP, plus foto HEIC/HEIF dari iPhone. Anda bisa menggabungkan, memisah, mengompres, mengonversi, mengedit, meredaksi, OCR, memutar, melindungi, dan membuka kunci PDF, serta mengompres atau mengonversi gambar.",
    },
    {
      question: "Apakah saya perlu membuat akun?",
      answer: "Tidak - semua alat bisa digunakan tanpa membuat akun. Akun gratis memberi Anda batas harian yang lebih tinggi dan riwayat file terbaru, sedangkan paket berbayar menambahkan file lebih besar dan pemrosesan batch."
    },
    {
      question: "Bisakah saya menggunakannya di ponsel atau tablet?",
      answer: "Tentu saja! Seluruh situs bekerja dengan mulus di perangkat apa pun. Baik Anda menggunakan iPhone, ponsel Android, iPad, tablet Surface, MacBook, atau desktop Windows, Anda akan mendapatkan pengalaman yang sama cepatnya. Semuanya dirancang untuk bekerja sempurna dengan layar sentuh juga, jadi mengetuk tombol dan menyeret file terasa alami di perangkat mobile. Tidak ada aplikasi terpisah yang perlu diunduh atau diinstal."
    }
  ] : locale === 'pt' ? [
    {
      question: "Este site é realmente gratuito?",
      answer: "Sim - todas as ferramentas podem ser usadas grátis e você pode começar agora mesmo, sem pagar. O plano gratuito tem um limite diário e tamanhos máximos de arquivo; se você precisar de arquivos maiores, processamento em lote ou uma experiência sem anúncios, existem os planos Starter e Pro. Mantemos o plano gratuito com poucos anúncios."
    },
    {
      question: "Meus arquivos ficam seguros quando os envio?",
      answer: "Os arquivos são enviados por uma conexão HTTPS criptografada (SSL de 256 bits), então ninguém consegue lê-los no caminho. No plano gratuito, os arquivos enviados e convertidos são excluídos automaticamente cerca de 1 hora após o processamento. Nos planos pagos, os resultados ficam em \"Meus arquivos\" por 24 ou 48 horas para você baixar de novo, e você pode excluí-los antes. Se uma conversão falhar, o arquivo enviado pode ser mantido por até 24 horas para corrigirmos o problema e depois é excluído. Nunca vendemos nem compartilhamos seus documentos.",
    },
    {
      question: "Quais formatos de arquivo são suportados?",
      answer: "Documentos: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) e PowerPoint (PPT, PPTX). Imagens: JPG, PNG e WebP, além de fotos HEIC/HEIF do iPhone. Você pode juntar, dividir, comprimir, converter, editar, ocultar dados, aplicar OCR, girar, proteger e desbloquear PDFs, e comprimir ou converter imagens.",
    },
    {
      question: "Preciso criar uma conta?",
      answer: "Não - você pode usar todas as ferramentas sem criar conta. Uma conta gratuita dá um limite diário maior e o histórico dos seus arquivos recentes, e os planos pagos adicionam arquivos maiores e processamento em lote."
    },
    {
      question: "Posso usar no meu celular ou tablet?",
      answer: "Claro que sim! O site inteiro funciona perfeitamente em qualquer dispositivo. Seja no iPhone, Android, iPad, tablet Surface, MacBook ou computador Windows, você terá a mesma experiência rápida e fluida. Tudo foi projetado para funcionar perfeitamente com telas touch também, então tocar nos botões e arrastar arquivos parece natural em dispositivos móveis. Não há nenhum aplicativo separado para baixar ou instalar."
    }
  ] : locale === 'vi' ? [
    {
      question: "Trang web của bạn có thực sự miễn phí không?",
      answer: "Có - mọi công cụ đều có thể dùng miễn phí và bạn có thể bắt đầu ngay mà không phải trả tiền. Gói miễn phí có giới hạn hằng ngày và giới hạn dung lượng tệp; nếu bạn cần tệp lớn hơn, xử lý hàng loạt hoặc trải nghiệm không quảng cáo, có các gói Starter và Pro. Chúng tôi duy trì gói miễn phí bằng một lượng nhỏ quảng cáo."
    },
    {
      question: "Tệp của tôi an toàn đến mức nào khi tải lên?",
      answer: "Tệp được gửi qua kết nối HTTPS được mã hóa (SSL 256-bit), nên không ai đọc được trên đường truyền. Với gói miễn phí, tệp tải lên và tệp đã chuyển đổi tự động bị xóa khoảng 1 giờ sau khi xử lý. Với gói trả phí, kết quả được giữ trong \"Tệp của tôi\" 24 hoặc 48 giờ để bạn tải lại, và bạn có thể xóa sớm hơn. Nếu chuyển đổi thất bại, tệp tải lên có thể được giữ tối đa 24 giờ để khắc phục sự cố, sau đó bị xóa. Chúng tôi không bao giờ bán hay chia sẻ tài liệu của bạn.",
    },
    {
      question: "Công cụ hỗ trợ những định dạng tệp nào?",
      answer: "Tài liệu: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) và PowerPoint (PPT, PPTX). Ảnh: JPG, PNG và WebP, cùng ảnh HEIC/HEIF từ iPhone. Bạn có thể gộp, tách, nén, chuyển đổi, chỉnh sửa, che thông tin, OCR, xoay, bảo vệ và mở khóa PDF, cũng như nén hoặc chuyển đổi ảnh.",
    },
    {
      question: "Tôi có cần tạo tài khoản không?",
      answer: "Không - bạn có thể dùng mọi công cụ mà không cần tạo tài khoản. Tài khoản miễn phí cho bạn giới hạn hằng ngày cao hơn và lịch sử các tệp gần đây, còn các gói trả phí bổ sung tệp lớn hơn và xử lý hàng loạt."
    },
    {
      question: "Tôi có thể dùng trên điện thoại hoặc máy tính bảng không?",
      answer: "Chắc chắn rồi! Toàn bộ trang web hoạt động mượt mà trên mọi thiết bị bạn dùng. Dù bạn dùng iPhone, điện thoại Android, iPad, máy tính bảng Surface, MacBook hay máy tính Windows, bạn đều có trải nghiệm nhanh, mượt như nhau. Mọi thứ cũng được thiết kế để hoạt động hoàn hảo với màn hình cảm ứng, nên việc nhấn nút và kéo tệp trên thiết bị di động rất tự nhiên. Không có ứng dụng riêng nào để tải về hay cài đặt. Chỉ cần mở trình duyệt, truy cập trang web và bắt đầu làm việc. Đơn giản vậy thôi."
    }
  ] : locale === 'hi' ? [
    {
      question: "क्या आपकी वेबसाइट सचमुच मुफ़्त है?",
      answer: "हाँ - हर टूल मुफ़्त में इस्तेमाल किया जा सकता है, और आप बिना भुगतान किए तुरंत शुरू कर सकते हैं। मुफ़्त प्लान में रोज़ की सीमा और फ़ाइल आकार की सीमाएँ हैं; अगर आपको बड़ी फ़ाइलें, बैच प्रोसेसिंग या बिना विज्ञापन का अनुभव चाहिए, तो Starter और Pro प्लान उपलब्ध हैं। हम मुफ़्त प्लान को थोड़े-से विज्ञापनों के सहारे चलाते हैं।"
    },
    {
      question: "अपलोड करते समय मेरी फ़ाइलें कितनी सुरक्षित हैं?",
      answer: "फ़ाइलें एन्क्रिप्टेड HTTPS कनेक्शन (256-बिट SSL) पर भेजी जाती हैं, इसलिए रास्ते में कोई उन्हें पढ़ नहीं सकता। फ़्री प्लान पर अपलोड और कन्वर्ट की गई फ़ाइलें प्रोसेसिंग के लगभग 1 घंटे बाद अपने-आप हट जाती हैं। पेड प्लान पर नतीजे My Files में 24 या 48 घंटे रहते हैं ताकि आप दोबारा डाउनलोड कर सकें, और आप उन्हें पहले भी हटा सकते हैं। अगर कन्वर्ज़न फ़ेल हो जाए, तो समस्या ठीक करने के लिए अपलोड की गई फ़ाइल 24 घंटे तक रखी जा सकती है, फिर हटा दी जाती है। हम आपके दस्तावेज़ कभी बेचते या शेयर नहीं करते।",
    },
    {
      question: "यह कौन-से फ़ाइल फ़ॉर्मेट सपोर्ट करता है?",
      answer: "डॉक्यूमेंट: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) और PowerPoint (PPT, PPTX)। इमेज: JPG, PNG और WebP, साथ ही iPhone की HEIC/HEIF फ़ोटो। आप PDF को मर्ज, स्प्लिट, कंप्रेस, कन्वर्ट, एडिट, रिडैक्ट, OCR, रोटेट, प्रोटेक्ट और अनलॉक कर सकते हैं, और इमेज को कंप्रेस या कन्वर्ट कर सकते हैं।",
    },
    {
      question: "क्या मुझे अकाउंट बनाना ज़रूरी है?",
      answer: "नहीं - आप बिना अकाउंट बनाए हर टूल इस्तेमाल कर सकते हैं। मुफ़्त अकाउंट से आपको रोज़ की ऊँची सीमा और अपनी हाल की फ़ाइलों का इतिहास मिलता है, और पेड प्लान में बड़ी फ़ाइलें और बैच प्रोसेसिंग जुड़ जाती हैं।"
    },
    {
      question: "क्या मैं इसे अपने फ़ोन या टैबलेट पर इस्तेमाल कर सकता/सकती हूँ?",
      answer: "बिल्कुल! पूरी वेबसाइट आपके किसी भी डिवाइस पर बिना रुकावट चलती है। चाहे आप iPhone, Android फ़ोन, iPad, Surface टैबलेट, MacBook या Windows डेस्कटॉप पर हों, आपको वही तेज़, सहज अनुभव मिलेगा। सब कुछ टचस्क्रीन के साथ भी बढ़िया चलने के लिए डिज़ाइन किया गया है, इसलिए मोबाइल डिवाइस पर बटन दबाना और फ़ाइलें खींचना स्वाभाविक लगता है। डाउनलोड या इंस्टॉल करने के लिए कोई अलग ऐप नहीं है। बस अपना ब्राउज़र खोलें, वेबसाइट पर जाएँ और काम शुरू करें। इतना ही सरल है।"
    }
  ] : locale === 'ar' ? [
    {
      question: "هل موقعكم مجاني فعلاً؟",
      answer: "نعم، يمكن استخدام كل أداة مجاناً، ويمكنك البدء فوراً دون دفع. للباقة المجانية حد يومي وحدود لحجم الملف، وإن احتجت ملفات أكبر أو معالجة جماعية أو تجربة بلا إعلانات فباقتا Starter وPro متاحتان. ونُبقي الباقة المجانية تعمل بعدد قليل من الإعلانات."
    },
    {
      question: "ما مدى أمان ملفاتي عند رفعها؟",
      answer: "تُرسل الملفات عبر اتصال HTTPS مشفّر (SSL بطول 256 بت)، فلا يستطيع أحد قراءتها أثناء النقل. في الباقة المجانية تُحذف الملفات المرفوعة والمحوّلة تلقائياً بعد نحو ساعة من المعالجة. وفي الباقات المدفوعة تبقى النتائج في \"ملفاتي\" مدة 24 أو 48 ساعة لتتمكن من تنزيلها مجدداً، ويمكنك حذفها قبل ذلك. وإذا فشل التحويل، فقد يُحتفظ بالملف المرفوع حتى 24 ساعة لإصلاح المشكلة ثم يُحذف. نحن لا نبيع مستنداتك ولا نشاركها أبداً.",
    },
    {
      question: "ما صيغ الملفات التي يدعمها الموقع؟",
      answer: "المستندات: PDF وWord (DOC وDOCX) وExcel (XLS وXLSX وCSV) وPowerPoint (PPT وPPTX). الصور: JPG وPNG وWebP، إضافة إلى صور HEIC/HEIF من iPhone. يمكنك دمج ملفات PDF وتقسيمها وضغطها وتحويلها وتعديلها وتنقيحها وتطبيق OCR عليها وتدويرها وحمايتها وفك قفلها، وكذلك ضغط الصور أو تحويلها.",
    },
    {
      question: "هل أحتاج إلى إنشاء حساب؟",
      answer: "لا، يمكنك استخدام كل أداة دون إنشاء حساب. ويمنحك الحساب المجاني حداً يومياً أعلى وسجلاً بملفاتك الأخيرة، وتضيف الباقات المدفوعة ملفات أكبر ومعالجة جماعية."
    },
    {
      question: "هل أستطيع استخدامه على هاتفي أو جهازي اللوحي؟",
      answer: "بالتأكيد! يعمل الموقع كله بسلاسة على أي جهاز. سواء كنت على iPhone أو هاتف Android أو iPad أو جهاز Surface اللوحي أو MacBook أو حاسوب Windows، ستحصل على التجربة السريعة والسلسة نفسها. وقد صُمم كل شيء ليعمل بإتقان مع شاشات اللمس أيضاً، فيبدو الضغط على الأزرار وسحب الملفات طبيعياً على الجوال. ولا يوجد تطبيق منفصل لتنزيله أو تثبيته. افتح المتصفح وادخل الموقع وابدأ العمل. بهذه البساطة."
    }
  ] : locale === 'tr' ? [
    {
      question: "Web siteniz gerçekten ücretsiz mi?",
      answer: "Evet, her araç ücretsiz kullanılabilir ve ödeme yapmadan hemen başlayabilirsiniz. Ücretsiz paketin günlük bir limiti ve dosya boyutu sınırları vardır; daha büyük dosyalara, toplu işlemeye ya da reklamsız bir deneyime ihtiyacınız olursa Starter ve Pro paketleri mevcut. Ücretsiz paketi az sayıda reklamla ayakta tutuyoruz."
    },
    {
      question: "Dosyalarım yüklerken ne kadar güvende?",
      answer: "Dosyalar şifreli bir HTTPS bağlantısı (256 bit SSL) üzerinden gönderilir, bu yüzden yolda kimse okuyamaz. Ücretsiz planda yüklenen ve dönüştürülen dosyalar işlemden yaklaşık 1 saat sonra otomatik silinir. Ücretli planlarda sonuçlar tekrar indirebilmeniz için \"Dosyalarım\" bölümünde 24 veya 48 saat kalır ve isterseniz daha önce silebilirsiniz. Bir dönüştürme başarısız olursa, sorunu çözmek için yüklenen dosya en fazla 24 saat saklanabilir, ardından silinir. Belgelerinizi asla satmaz veya paylaşmayız.",
    },
    {
      question: "Hangi dosya biçimlerini destekliyor?",
      answer: "Belgeler: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) ve PowerPoint (PPT, PPTX). Görseller: JPG, PNG ve WebP, ayrıca iPhone HEIC/HEIF fotoğrafları. PDF birleştirebilir, bölebilir, sıkıştırabilir, dönüştürebilir, düzenleyebilir, karartabilir, OCR uygulayabilir, döndürebilir, koruyabilir ve kilidini açabilir; görselleri sıkıştırabilir veya dönüştürebilirsiniz.",
    },
    {
      question: "Hesap oluşturmam gerekiyor mu?",
      answer: "Hayır, her aracı hesap oluşturmadan kullanabilirsiniz. Ücretsiz bir hesap size daha yüksek günlük limit ve son dosyalarınızın geçmişini verir; ücretli paketler daha büyük dosyalar ve toplu işleme ekler."
    },
    {
      question: "Telefonumda ya da tabletimde kullanabilir miyim?",
      answer: "Tabii ki! Sitenin tamamı elinizdeki her cihazda sorunsuz çalışır. iPhone, Android telefon, iPad, Surface tablet, MacBook ya da Windows masaüstü kullanıyor olun, aynı hızlı, akıcı deneyimi yaşarsınız. Her şey dokunmatik ekranlarla da kusursuz çalışacak şekilde tasarlandı; böylece mobil cihazlarda düğmelere dokunmak ve dosyaları sürüklemek doğal hissettirir. İndirip kurulacak ayrı bir uygulama yok. Tarayıcınızı açın, siteye girin ve çalışmaya başlayın. Bu kadar basit."
    }
  ] : [
    {
      question: "Is your website really free to use?",
      answer: "Yes - every tool can be used for free, and you can start right away without paying. The free plan has a daily limit and file-size limits; if you need bigger files, batch processing or an ad-free experience, the Starter and Pro plans are available. We keep the free plan running with a small number of ads."
    },
    {
      question: "How secure are my files when I upload them?",
      answer: "Files are sent over an encrypted HTTPS connection (256-bit SSL), so nobody can read them on the way. On the free plan, your uploaded and converted files are deleted automatically about 1 hour after processing. On paid plans, results stay in My Files for 24 or 48 hours so you can download them again, and you can delete them sooner. If a conversion fails, the uploaded file may be kept for up to 24 hours so we can fix the problem, then it is deleted. We never sell or share your documents.",
    },
    {
      question: "What file formats does this support?",
      answer: "Documents: PDF, Word (DOC, DOCX), Excel (XLS, XLSX, CSV) and PowerPoint (PPT, PPTX). Images: JPG, PNG and WebP, plus HEIC/HEIF photos from iPhones. You can merge, split, compress, convert, edit, redact, OCR, rotate, protect and unlock PDFs, and compress or convert images.",
    },
    {
      question: "Do I need to create an account?",
      answer: "No - you can use every tool without creating an account. A free account gives you a higher daily limit and a history of your recent files, and paid plans add bigger files and batch processing."
    },
    {
      question: "Can I use this on my phone or tablet?",
      answer: "You bet! The entire site works seamlessly on any device you throw at it. Whether you're on an iPhone, Android phone, iPad, Surface tablet, MacBook, or Windows desktop, you'll get the same fast, smooth experience. Everything's been designed to work perfectly with touchscreens too, so tapping buttons and dragging files feels natural on mobile devices. There's no separate app to download or install. Just open your browser, visit the site, and start working. It's that straightforward."
    }
  ]

  const premFeatures = locale === 'ja' ? ["最大100MBのファイルとバッチ処理","スキャンしたドキュメント用の高度なOCR","広告なしの体験"] : locale === 'de' ? ["Dateien bis 100 MB und Stapelverarbeitung","Erweitertes OCR für gescannte Dokumente","Werbefreies Erlebnis"] : locale === 'fr' ? ["Fichiers jusqu'à 100 Mo et traitement par lots","OCR avancé pour documents numérisés","Expérience sans publicité"] : locale === 'es' ? ["Archivos de hasta 100 MB y procesamiento por lotes","OCR avanzado para documentos escaneados","Experiencia sin anuncios"] : locale === 'it' ? ["File fino a 100 MB ed elaborazione batch","OCR avanzato per documenti scansionati","Esperienza senza pubblicità"] : locale === 'id' ? ["File hingga 100 MB dan pemrosesan batch","OCR canggih untuk dokumen yang dipindai","Pengalaman bebas iklan"] : locale === 'pt' ? ["Arquivos de até 100 MB e processamento em lote","OCR avançado para documentos digitalizados","Experiência sem anúncios"] : locale === 'vi' ? ["Tệp tối đa 100 MB và xử lý hàng loạt","OCR nâng cao cho tài liệu quét","Trải nghiệm không quảng cáo"] : locale === 'hi' ? ["100 MB तक की फ़ाइलें और बैच प्रोसेसिंग","स्कैन किए दस्तावेज़ों के लिए उन्नत OCR","बिना विज्ञापन का अनुभव"] : locale === 'ar' ? ["ملفات حتى 100 MB ومعالجة جماعية","OCR متقدم للمستندات الممسوحة","تجربة بلا إعلانات"] : locale === 'tr' ? ["100 MB'a kadar dosyalar ve toplu işleme","Taranmış belgeler için gelişmiş OCR","Reklamsız deneyim"] : ["Files up to 100 MB and batch processing","Advanced OCR for scanned documents","Ad-free experience"]

  const premIncludes = locale === 'ja' ? ["無制限の変換","最大100MBのファイル","バッチ処理","広告なしの体験","優先サポート"] : locale === 'de' ? ["Unbegrenzte Konvertierungen","Dateien bis 100 MB","Stapelverarbeitung","Werbefreies Erlebnis","Vorrangiger Support"] : locale === 'fr' ? ["Conversions illimitées","Fichiers jusqu'à 100 Mo","Traitement par lots","Sans publicité","Support prioritaire"] : locale === 'es' ? ["Conversiones ilimitadas","Archivos de hasta 100 MB","Procesamiento por lotes","Sin anuncios","Soporte prioritario"] : locale === 'it' ? ["Conversioni illimitate","File fino a 100 MB","Elaborazione batch","Senza pubblicità","Supporto prioritario"] : locale === 'id' ? ["Konversi tak terbatas","File hingga 100 MB","Pemrosesan batch","Bebas iklan","Dukungan prioritas"] : locale === 'pt' ? ["Conversões ilimitadas","Arquivos de até 100 MB","Processamento em lote","Sem anúncios","Suporte prioritário"] : locale === 'vi' ? ["Chuyển đổi không giới hạn","Tệp tối đa 100 MB","Xử lý hàng loạt","Không quảng cáo","Hỗ trợ ưu tiên"] : locale === 'hi' ? ["असीमित कन्वर्ज़न","100 MB तक की फ़ाइलें","बैच प्रोसेसिंग","बिना विज्ञापन का अनुभव","प्राथमिकता सपोर्ट"] : locale === 'ar' ? ["تحويلات غير محدودة","ملفات حتى 100 MB","معالجة جماعية","بلا إعلانات","دعم ذو أولوية"] : locale === 'tr' ? ["Sınırsız dönüştürme","100 MB'a kadar dosyalar","Toplu işleme","Reklamsız","Öncelikli destek"] : ["Unlimited conversions","Files up to 100 MB","Batch processing","Ad-free experience","Priority support"]


  const router = useLocalizedRouter()
  const S = {
    h1a: L(locale, { ja: '無料オンラインPDFツール', de: 'Kostenlose Online-PDF-Tools', fr: 'Outils PDF gratuits en ligne', es: 'Herramientas PDF online gratis', en: 'Free Online PDF Tools', it: 'Strumenti PDF online gratis', id: 'Alat PDF Online Gratis', pt: 'Ferramentas PDF online grátis', vi: 'Công cụ PDF online miễn phí', hi: 'फ्री ऑनलाइन PDF टूल्स', ar: 'أدوات PDF مجانية أونلاين', tr: 'Ücretsiz Online PDF Araçları' }),
    h1b: L(locale, { ja: '毎日の書類作業に', de: 'für alltägliche Dokumente', fr: 'pour vos documents du quotidien', es: 'para tus documentos de cada día', en: 'for Everyday Documents', it: 'per i documenti di ogni giorno', id: 'untuk dokumen sehari-hari', pt: 'para os documentos do dia a dia', vi: 'cho tài liệu hằng ngày', hi: 'रोज़ के डॉक्यूमेंट के लिए', ar: 'لمستنداتك اليومية', tr: 'her gün kullandığınız belgeler için' }),
    sub: L(locale, { ja: 'PDFを数秒で変換、圧縮、結合、編集。', de: 'PDFs in Sekunden konvertieren, komprimieren, zusammenführen & bearbeiten.', fr: 'Convertissez, compressez, fusionnez et modifiez vos PDF en secondes.', es: 'Convierte, comprime, combina y edita tus PDF en segundos.', en: 'Convert, compress, merge & edit PDFs in seconds.', it: 'Converti, comprimi, unisci e modifica i tuoi PDF in pochi secondi.', id: 'Konversi, kompres, gabung & edit PDF dalam hitungan detik.', pt: 'Converta, comprima, mescle e edite PDFs em segundos.', vi: 'Chuyển đổi, nén, gộp & chỉnh sửa PDF trong vài giây.', hi: 'PDF को सेकंडों में बदलें, कंप्रेस करें, जोड़ें और एडिट करें।', ar: 'حوّل ملفات PDF واضغطها وادمجها وعدّلها في ثوانٍ.', tr: 'PDF\'leri saniyeler içinde dönüştürün, sıkıştırın, birleştirin ve düzenleyin.' }),
    pill1: L(locale, { ja: '256ビットSSL暗号化', de: '256-Bit-SSL-Verschlüsselung', fr: 'Chiffrement SSL 256 bits', es: 'Cifrado SSL 256 bits', en: '256-bit SSL encryption', it: 'Crittografia SSL 256 bit', id: 'Enkripsi SSL 256-bit', pt: 'Criptografia SSL 256 bits', vi: 'Mã hóa SSL 256-bit', hi: '256-बिट SSL एन्क्रिप्शन', ar: 'تشفير SSL بطول 256 بت', tr: '256 bit SSL şifreleme' }),
    pill2: L(locale, { ja: '超高速', de: 'Blitzschnell', fr: 'Ultra rapide', es: 'Ultra rápido', en: 'Lightning fast', it: 'Velocissimo', id: 'Sangat cepat', pt: 'Extremamente rápido', vi: 'Cực nhanh', hi: 'बिजली-सी तेज़', ar: 'سريع كالبرق', tr: 'Şimşek gibi hızlı' }),
    pill3: L(locale, { ja: '1時間で自動削除', de: 'Auto-Löschung 1 Std.', fr: 'Suppression auto 1h', es: 'Eliminación auto 1h', en: 'Auto-delete in 1hr', it: 'Eliminazione auto 1h', id: 'Hapus otomatis 1 jam', pt: 'Exclusão auto 1h', vi: 'Tự xóa sau 1 giờ', hi: '1 घंटे में अपने-आप हटेगी', ar: 'حذف تلقائي بعد ساعة', tr: '1 saatte otomatik silinir' }),
    start: L(locale, { ja: '無料で始める', de: 'Kostenlos starten', fr: 'Commencer gratuitement', es: 'Empezar gratis', en: 'Start For Free', it: 'Inizia gratis', id: 'Mulai Gratis', pt: 'Comece Grátis', vi: 'Bắt đầu miễn phí', hi: 'मुफ़्त शुरू करें', ar: 'ابدأ مجاناً', tr: 'Ücretsiz Başla' }),
    viewAll: L(locale, { ja: 'すべてのツール', de: 'Alle Tools', fr: 'Tous les outils', es: 'Todas las herramientas', en: 'View All Tools', it: 'Tutti gli strumenti', id: 'Semua Alat', pt: 'Todas as Ferramentas', vi: 'Xem tất cả công cụ', hi: 'सभी टूल देखें', ar: 'عرض كل الأدوات', tr: 'Tüm Araçları Gör' }),
    statTools: L(locale, { ja:'ツール', de:'Tools', fr:'Outils', es:'Herramientas', en:'Tools', it:'Strumenti', id:'Alat', pt:'Ferramentas', vi: 'Công cụ', hi: 'टूल', ar: 'أدوات', tr: 'Araç' }),
    statLang: L(locale, { ja:'言語', de:'Sprachen', fr:'Langues', es:'Idiomas', en:'Languages', it:'Lingue', id:'Bahasa', pt:'Idiomas', vi: 'Ngôn ngữ', hi: 'भाषाएँ', ar: 'لغات', tr: 'Dil' }),
    statPlan: L(locale, { ja:'プラン', de:'Plan', fr:'Forfait', es:'Plan', it:'Piano', id:'Paket', pt:'Plano', vi: 'Gói', hi: 'प्लान', ar: 'الباقة', tr: 'Paket', en:'Plan' }),
    done: L(locale,{ja:'変換完了',de:'Fertig',fr:'Terminé',es:'Listo',en:'Done - download ready',it:'Pronto',id:'Selesai',pt:'Pronto', vi: 'Xong - sẵn sàng tải xuống', hi: 'हो गया - डाउनलोड तैयार', ar: 'تم، التنزيل جاهز', tr: 'Tamam, indirme hazır'}),
    deleted: L(locale,{ja:'1時間後に削除',de:'Gelöscht in 1 Std.',fr:'Supprimé dans 1h',es:'Borrado en 1h',en:'Deleted in 1 hr',it:'Eliminato in 1h',id:'Dihapus dalam 1 jam',pt:'Excluído em 1h', vi: 'Xóa sau 1 giờ', hi: '1 घंटे में हटा दी जाती है', ar: 'يُحذف بعد ساعة', tr: '1 saatte silinir'}),
    launched: L(locale, { ja: '新機能', de: 'Neu bei uns', fr: 'Nouveau chez nous', es: 'Recién llegado', en: 'Just launched', it: 'Appena lanciato', id: 'Baru diluncurkan', pt: 'Recém-lançado', vi: 'Mới ra mắt', hi: 'अभी शुरू हुआ', ar: 'أُطلقت للتو', tr: 'Yeni çıktı' }),
    featH: L(locale, { ja: 'まだ試していないツールはありますか？', de: 'Diese Tools noch nicht ausprobiert?', fr: 'Vous n\'avez pas encore essayé ces outils ?', es: '¿Aún no has probado estas herramientas?', en: 'Tools you might have missed', it: 'Strumenti che potresti aver perso', id: 'Alat yang mungkin terlewat', pt: 'Ferramentas que você pode ter perdido', vi: 'Những công cụ bạn có thể đã bỏ lỡ', hi: 'वे टूल जो शायद आपसे छूट गए हों', ar: 'أدوات ربما فاتتك', tr: 'Kaçırmış olabileceğiniz araçlar' }),
    featSub: L(locale, { ja: '同じ無料・安全な処理で、新しくできることが増えました。', de: 'Gleiche kostenlose, sichere Verarbeitung - jetzt mit mehr Möglichkeiten.', fr: 'Même traitement gratuit et sécurisé - avec encore plus de possibilités.', es: 'El mismo procesamiento gratis y seguro - ahora con más posibilidades.', en: 'Same free, secure processing - now with a lot more you can do.', it: 'La stessa elaborazione gratuita e sicura - ora con molto di più.', id: 'Pemrosesan gratis dan aman yang sama - kini dengan lebih banyak kemampuan.', pt: 'O mesmo processamento grátis e seguro - agora com muito mais possibilidades.', vi: 'Vẫn xử lý miễn phí, an toàn - nhưng giờ bạn làm được nhiều hơn rất nhiều.', hi: 'वही मुफ़्त, सुरक्षित प्रोसेसिंग - अब आप और भी बहुत कुछ कर सकते हैं।', ar: 'المعالجة المجانية والآمنة نفسها، لكن مع الكثير مما يمكنك فعله الآن.', tr: 'Aynı ücretsiz, güvenli işleme; artık yapabileceğiniz çok daha fazla şeyle.' }),
    allH: L(locale, { ja:'すべてのPDFツール', de:'Alle PDF-Tools', fr:'Tous les outils PDF', es:'Todas las herramientas PDF', en:'All PDF Tools', it:'Tutti gli strumenti PDF', id:'Semua Alat PDF', pt:'Todas as Ferramentas PDF', vi: 'Tất cả công cụ PDF', hi: 'सभी PDF टूल', ar: 'كل أدوات PDF', tr: 'Tüm PDF Araçları' }),
    allSub: L(locale, { ja:'PDFファイルの作業に必要なすべて', de:'Alles für die Arbeit mit PDFs', fr:'Tout pour vos PDF', es:'Todo para trabajar con PDF', en:'Everything you need to work with PDF files', it:'Tutto per lavorare con i PDF', id:'Semua untuk bekerja dengan file PDF', pt:'Tudo para trabalhar com PDFs', vi: 'Mọi thứ bạn cần để làm việc với tệp PDF', hi: 'PDF फ़ाइलों के साथ काम करने के लिए आपको जो कुछ चाहिए', ar: 'كل ما تحتاجه للتعامل مع ملفات PDF', tr: 'PDF dosyalarıyla çalışmak için ihtiyacınız olan her şey' }),
    fmtH: L(locale, { ja:'あらゆるファイル形式に対応', de:'Mit jedem Format arbeiten', fr:'Tous les formats', es:'Cualquier formato', en:'Work With Any File Format', it:'Qualsiasi formato', id:'Format File Apa Pun', pt:'Qualquer Formato', vi: 'Làm việc với mọi định dạng tệp', hi: 'किसी भी फ़ाइल फ़ॉर्मेट के साथ काम करें', ar: 'تعامل مع أي صيغة ملف', tr: 'Her Dosya Biçimiyle Çalışın' }),
    fmtSub: L(locale, { ja:'主要な形式間でシームレスに変換', de:'Nahtlos konvertieren', fr:'Convertissez entre tous les formats', es:'Convierte entre todos los formatos', en:'Seamlessly convert between all major document and image formats', it:'Converti tra tutti i formati', id:'Konversi mulus antar format', pt:'Converta entre todos os formatos', vi: 'Chuyển đổi liền mạch giữa mọi định dạng tài liệu và ảnh phổ biến', hi: 'सभी प्रमुख दस्तावेज़ और इमेज फ़ॉर्मेट के बीच आसानी से बदलें', ar: 'حوّل بسلاسة بين كل صيغ المستندات والصور الرئيسية', tr: 'Tüm başlıca belge ve görsel biçimleri arasında sorunsuz dönüştürün' }),
    fmtImages: L(locale,{ja:'画像',de:'Bilder',fr:'Images',es:'Imágenes',en:'Images',it:'Immagini',id:'Gambar',pt:'Imagens', vi: 'Ảnh', hi: 'इमेज', ar: 'صور', tr: 'Görseller'}),
    fmtMore: L(locale,{ja:'その他',de:'Weitere',fr:'Autres',es:'Más',en:'More',it:'Altri',id:'Lainnya',pt:'Mais', vi: 'Thêm', hi: 'और', ar: 'المزيد', tr: 'Daha Fazla'}),
    whyH: L(locale, { ja: 'ログイン不要。わかりやすい制限。余計なものなし。', de: 'Kein Login nötig. Klare Limits. Kein Unsinn.', fr: 'Sans inscription. Des limites claires. Sans chichi.', es: 'Sin registro. Límites claros. Sin rodeos.', it: 'Nessun login. Limiti chiari. Niente scuse.', id: 'Tanpa login. Batas yang jelas. Tanpa omong kosong.', pt: 'Sem login. Limites claros. Sem enrolação.', vi: 'Không cần đăng nhập. Giới hạn rõ ràng. Không rườm rà.', hi: 'लॉगिन ज़रूरी नहीं। साफ़ सीमाएँ। बेकार की बातें नहीं।', ar: 'بلا تسجيل دخول. حدود واضحة. بلا مبالغات.', tr: 'Giriş gerekmez. Net limitler. Boş vaat yok.', en: 'No login needed. Clear limits. No BS.' }),
    whySub: L(locale, { ja: '他のPDFツールが面倒にしていることを、シンプルに。', de: 'Was andere PDF-Tools kompliziert machen, machen wir einfach.', fr: "Ce que les autres outils PDF compliquent, nous le simplifions.", es: 'Lo que otras herramientas PDF complican, nosotros lo simplificamos.', en: "What other PDF tools make complicated, we just make work.", it: 'Ciò che altri strumenti PDF complicano, noi lo rendiamo semplice.', id: 'Yang dipersulit alat PDF lain, kami buat mudah.', pt: 'O que outras ferramentas PDF complicam, nós simplificamos.', vi: 'Điều các công cụ PDF khác làm phức tạp, chúng tôi chỉ làm cho nó chạy.', hi: 'जो दूसरे PDF टूल पेचीदा बनाते हैं, हम उसे बस काम करने वाला बनाते हैं।', ar: 'ما تعقّده أدوات PDF الأخرى، نجعله يعمل ببساطة.', tr: 'Diğer PDF araçlarının karmaşıklaştırdığını biz basitçe çalıştırırız.' }),
    why1t: L(locale, { ja: '256ビットSSL暗号化', de: '256-Bit-SSL-Verschlüsselung', fr: 'Chiffrement SSL 256 bits', es: 'Cifrado SSL de 256 bits', en: '256-bit SSL Encryption', it: 'Crittografia SSL a 256 bit', id: 'Enkripsi SSL 256-bit', pt: 'Criptografia SSL de 256 bits', vi: 'Mã hóa SSL 256-bit', hi: '256-बिट SSL एन्क्रिप्शन', ar: 'تشفير SSL بطول 256 بت', tr: '256 bit SSL Şifreleme' }),
    why1d: L(locale, { ja: '256ビット暗号化。無料プランのファイルは処理後約1時間で自動削除。', de: '256-Bit-Verschlüsselung. Dateien im Gratis-Plan werden etwa 1 Stunde nach der Verarbeitung automatisch gelöscht.', fr: 'Chiffrement 256 bits. Avec le forfait gratuit, les fichiers sont supprimés automatiquement environ 1 heure après le traitement.', es: 'Cifrado de 256 bits. En el plan gratuito, los archivos se eliminan automáticamente aproximadamente 1 hora después del procesamiento.', it: 'Crittografia a 256 bit. Con il piano gratuito i file vengono eliminati automaticamente circa 1 ora dopo l\'elaborazione.', id: 'Enkripsi 256-bit. File paket gratis dihapus otomatis sekitar 1 jam setelah diproses.', pt: 'Criptografia de 256 bits. No plano gratuito, os arquivos são excluídos automaticamente cerca de 1 hora após o processamento.', vi: 'Mã hóa 256-bit. Tệp của gói miễn phí tự động bị xóa khoảng 1 giờ sau khi xử lý.', hi: '256-बिट एन्क्रिप्शन। फ़्री प्लान की फ़ाइलें प्रोसेसिंग के लगभग 1 घंटे बाद अपने-आप हट जाती हैं।', ar: 'تشفير 256 بت. تُحذف ملفات الباقة المجانية تلقائياً بعد نحو ساعة من المعالجة.', tr: '256 bit şifreleme. Ücretsiz plandaki dosyalar işlemden yaklaşık 1 saat sonra otomatik silinir.', en: '256-bit encryption. Free-plan files are auto-deleted about 1 hour after processing.' }),
    why2t: L(locale, { ja: '超高速', de: 'Blitzschnell', fr: 'Ultra rapide', es: 'Ultra rápido', en: 'Fast Processing', it: 'Velocissimo', id: 'Sangat Cepat', pt: 'Extremamente Rápido', vi: 'Xử lý nhanh', hi: 'तेज़ प्रोसेसिंग', ar: 'معالجة سريعة', tr: 'Hızlı İşleme' }),
    why2d: L(locale, { ja: '最適化されたサーバーで数秒でファイルを処理。', de: 'Dateien in Sekunden mit optimierten Servern verarbeiten.', fr: 'Traitement des fichiers en quelques secondes avec des serveurs optimisés.', es: 'Procesa archivos en segundos con servidores optimizados.', en: 'Process files in seconds with optimized servers.', it: 'Elabora i file in pochi secondi con server ottimizzati.', id: 'Proses file dalam hitungan detik dengan server yang dioptimalkan.', pt: 'Processe arquivos em segundos com servidores otimizados.', vi: 'Xử lý tệp trong vài giây với máy chủ được tối ưu.', hi: 'ऑप्टिमाइज़ सर्वर से फ़ाइलें सेकंडों में प्रोसेस करें।', ar: 'عالج الملفات في ثوانٍ بخوادم محسّنة.', tr: 'Optimize sunucularla dosyaları saniyeler içinde işleyin.' }),
    why3t: L(locale, { ja: '常に無料で開始', de: 'Kostenlos starten', fr: 'Commencez gratuitement', es: 'Comienza gratis', en: 'Free to Start', it: 'Inizia gratuitamente', id: 'Mulai Gratis', pt: 'Comece Grátis', vi: 'Miễn phí để bắt đầu', hi: 'शुरू करना मुफ़्त', ar: 'مجاني للبدء', tr: 'Ücretsiz Başlayın' }),
    why3d: L(locale, { ja: '隠れた費用なし。プレミアムプランでさらに強力に。', de: 'Keine versteckten Kosten. Premium-Pläne für mehr Leistung.', fr: 'Aucuns frais cachés. Passez en Premium pour plus de puissance.', es: 'Sin tarifas ocultas. Planes Premium para mayor rendimiento.', en: 'No hidden fees. Upgrade to Premium for more power.', it: 'Nessun costo nascosto. Passa a Premium per più potenza.', id: 'Tidak ada biaya tersembunyi. Upgrade ke Premium untuk lebih banyak fitur.', pt: 'Sem taxas ocultas. Faça upgrade para Premium para mais recursos.', vi: 'Không phí ẩn. Nâng cấp lên Premium để mạnh mẽ hơn.', hi: 'कोई छिपी फ़ीस नहीं। और ताकत के लिए प्रीमियम में अपग्रेड करें।', ar: 'دون رسوم مخفية. وترقّ إلى Premium لقوة أكبر.', tr: 'Gizli ücret yok. Daha fazla güç için Premium\'a yükseltin.' }),
    secH: L(locale, { ja: 'ファイルは自動で削除。共有も販売もしません。', de: 'Automatisch gelöscht. Nie geteilt oder verkauft.', fr: 'Supprimés automatiquement. Jamais partagés ni vendus.', es: 'Se borran solos. Nunca se comparten ni se venden.', it: 'Eliminati in automatico. Mai condivisi o venduti.', id: 'Dihapus otomatis. Tidak pernah dibagikan atau dijual.', pt: 'Excluídos automaticamente. Nunca compartilhados ou vendidos.', vi: 'Tự động xóa. Không bao giờ chia sẻ hay bán.', hi: 'अपने-आप हट जाती हैं। कभी शेयर या बेची नहीं जातीं।', ar: 'تُحذف تلقائياً. ولا تُشارك أو تُباع أبداً.', tr: 'Otomatik silinir. Asla paylaşılmaz veya satılmaz.', en: 'Deleted automatically. Never shared or sold.' }),
    secP: L(locale, { ja: 'ファイルは256ビットSSLで転送され、自動的に削除されます。無料プランでは処理後約1時間、有料プランでは「マイファイル」から24〜48時間後です。変換に失敗した場合は、原因を調べるために最大24時間保管し、その後削除します。', de: 'Jede Datei wird per 256-Bit-SSL übertragen und automatisch gelöscht: im Gratis-Plan etwa 1 Stunde nach der Verarbeitung, in bezahlten Plänen nach 24 bis 48 Stunden aus „Meine Dateien“. Schlägt eine Konvertierung fehl, kann die Datei bis zu 24 Stunden zur Fehlerbehebung aufbewahrt und danach gelöscht werden.', fr: 'Chaque fichier est transféré via SSL 256 bits et supprimé automatiquement : environ 1 heure après le traitement avec le forfait gratuit, ou après 24 à 48 heures depuis « Mes fichiers » avec un forfait payant. Si une conversion échoue, le fichier peut être conservé jusqu\'à 24 heures pour corriger le problème, puis il est supprimé.', es: 'Cada archivo se transfiere con SSL de 256 bits y se elimina automáticamente: unos 60 minutos después del procesamiento en el plan gratuito, o tras 24 a 48 horas desde "Mis archivos" en los planes de pago. Si una conversión falla, el archivo puede conservarse hasta 24 horas para resolver el problema y luego se elimina.', it: 'Ogni file viene trasferito via SSL a 256 bit ed eliminato automaticamente: circa 1 ora dopo l\'elaborazione con il piano gratuito, oppure dopo 24-48 ore da "I miei file" con i piani a pagamento. Se una conversione non riesce, il file può essere conservato fino a 24 ore per risolvere il problema, poi viene eliminato.', id: 'Setiap file ditransfer lewat SSL 256-bit dan dihapus otomatis: sekitar 1 jam setelah diproses pada paket gratis, atau setelah 24 hingga 48 jam dari "File Saya" pada paket berbayar. Jika konversi gagal, file dapat disimpan hingga 24 jam untuk memperbaiki masalahnya, lalu dihapus.', pt: 'Cada arquivo é transferido por SSL de 256 bits e excluído automaticamente: cerca de 1 hora após o processamento no plano gratuito, ou após 24 a 48 horas em "Meus arquivos" nos planos pagos. Se uma conversão falhar, o arquivo pode ser mantido por até 24 horas para corrigirmos o problema e depois é excluído.', vi: 'Mỗi tệp được truyền qua SSL 256-bit và tự động bị xóa: khoảng 1 giờ sau khi xử lý với gói miễn phí, hoặc sau 24 đến 48 giờ từ "Tệp của tôi" với gói trả phí. Nếu chuyển đổi thất bại, tệp có thể được giữ tối đa 24 giờ để khắc phục sự cố, sau đó bị xóa.', hi: 'हर फ़ाइल 256-बिट SSL पर ट्रांसफ़र होती है और अपने-आप हट जाती है: फ़्री प्लान पर प्रोसेसिंग के लगभग 1 घंटे बाद, और पेड प्लान पर My Files से 24 से 48 घंटे बाद। अगर कन्वर्ज़न फ़ेल हो जाए, तो समस्या ठीक करने के लिए फ़ाइल 24 घंटे तक रखी जा सकती है, फिर हटा दी जाती है।', ar: 'يُنقل كل ملف عبر SSL بطول 256 بت ويُحذف تلقائياً: بعد نحو ساعة من المعالجة في الباقة المجانية، أو بعد 24 إلى 48 ساعة من "ملفاتي" في الباقات المدفوعة. وإذا فشل التحويل، فقد يُحتفظ بالملف حتى 24 ساعة لإصلاح المشكلة ثم يُحذف.', tr: 'Her dosya 256 bit SSL ile aktarılır ve otomatik silinir: ücretsiz planda işlemden yaklaşık 1 saat sonra, ücretli planlarda ise "Dosyalarım" bölümünden 24 ila 48 saat sonra. Bir dönüştürme başarısız olursa, sorunu çözmek için dosya en fazla 24 saat saklanabilir, ardından silinir.', en: 'Every file is transferred over 256-bit SSL and deleted automatically: about 1 hour after processing on the free plan, or after 24 to 48 hours from My Files on paid plans. If a conversion fails, the file may be kept for up to 24 hours so we can fix the problem, then it is deleted.' }),
    sec1t: L(locale, { ja: '256ビットSSL暗号化', de: '256-Bit-SSL-Verschlüsselung', fr: 'Chiffrement SSL 256 bits', es: 'Cifrado SSL de 256 bits', en: '256-bit SSL Encryption', it: 'Crittografia SSL a 256 bit', id: 'Enkripsi SSL 256-bit', pt: 'Criptografia SSL de 256 bits', vi: 'Mã hóa SSL 256-bit', hi: '256-बिट SSL एन्क्रिप्शन', ar: 'تشفير SSL بطول 256 بت', tr: '256 bit SSL Şifreleme' }),
    sec1d: L(locale, { ja: '送受信中のファイルは暗号化されて保護されます', de: 'Ihre Dateien sind auf dem Weg zu und von unseren Servern verschlüsselt', fr: 'Vos fichiers sont chiffrés pendant leur transfert vers et depuis nos serveurs', es: 'Tus archivos viajan cifrados hacia y desde nuestros servidores', it: 'I tuoi file sono crittografati durante il trasferimento da e verso i nostri server', id: 'File Anda dienkripsi saat dikirim ke dan dari server kami', pt: 'Seus arquivos são criptografados no caminho de ida e volta aos nossos servidores', vi: 'Tệp của bạn được mã hóa khi truyền đến và đi từ máy chủ của chúng tôi', hi: 'हमारे सर्वर तक आते-जाते समय आपकी फ़ाइलें एन्क्रिप्टेड रहती हैं', ar: 'ملفاتك مشفّرة أثناء انتقالها من خوادمنا وإليها', tr: 'Dosyalarınız sunucularımıza gidip gelirken şifrelenir', en: 'Your files are encrypted on the way to and from our servers' }),
    sec2t: L(locale, { ja: '1時間で自動削除', de: 'Auto-Löschung nach 1 Stunde', fr: 'Suppression automatique en 1 heure', es: 'Eliminación automática en 1 hora', en: 'Auto-Delete in 1 Hour', it: 'Eliminazione automatica in 1 ora', id: 'Hapus Otomatis dalam 1 Jam', pt: 'Exclusão Automática em 1 Hora', vi: 'Tự động xóa sau 1 giờ', hi: '1 घंटे में अपने-आप हटना', ar: 'حذف تلقائي بعد ساعة', tr: '1 Saatte Otomatik Silinir' }),
    sec2d: L(locale, { ja: '無料プランのファイルはサーバーから自動的に削除されます', de: 'Dateien im Gratis-Plan werden automatisch von unseren Servern entfernt', fr: 'Avec le forfait gratuit, les fichiers sont retirés automatiquement de nos serveurs', es: 'En el plan gratuito, los archivos se eliminan automáticamente de nuestros servidores', it: 'Con il piano gratuito i file vengono rimossi automaticamente dai nostri server', id: 'File paket gratis dihapus otomatis dari server kami', pt: 'No plano gratuito, os arquivos são removidos automaticamente de nossos servidores', vi: 'Tệp của gói miễn phí được tự động xóa khỏi máy chủ của chúng tôi', hi: 'फ़्री प्लान की फ़ाइलें हमारे सर्वर से अपने-आप हटा दी जाती हैं', ar: 'تُزال ملفات الباقة المجانية من خوادمنا تلقائياً', tr: 'Ücretsiz plandaki dosyalar sunucularımızdan otomatik olarak kaldırılır', en: 'Free-plan files are removed from our servers automatically' }),
    sec3t: L(locale, { ja: '共有も販売もしない', de: 'Nie geteilt oder verkauft', fr: 'Jamais partagés ni vendus', es: 'Nunca compartidos ni vendidos', it: 'Mai condivisi o venduti', id: 'Tidak Pernah Dibagikan atau Dijual', pt: 'Nunca Compartilhados ou Vendidos', vi: 'Không chia sẻ hay bán', hi: 'कभी शेयर या बेचा नहीं', ar: 'لا مشاركة ولا بيع', tr: 'Asla Paylaşılmaz veya Satılmaz', en: 'Never Shared or Sold' }),
    sec3d: L(locale, { ja: 'ドキュメントはご依頼の変換にのみ使用し、販売や第三者との共有は行いません', de: 'Ihre Dokumente werden nur für die gewünschte Konvertierung verwendet, nie verkauft oder an Dritte weitergegeben', fr: 'Vos documents servent uniquement à la conversion demandée, sans jamais être vendus ni partagés avec des tiers', es: 'Tus documentos solo se usan para la conversión que pediste; nunca se venden ni se comparten con terceros', it: 'I tuoi documenti vengono usati solo per la conversione richiesta, mai venduti o condivisi con terzi', id: 'Dokumen Anda hanya dipakai untuk konversi yang Anda minta, tidak pernah dijual atau dibagikan ke pihak ketiga', pt: 'Seus documentos são usados apenas para a conversão solicitada, nunca vendidos ou compartilhados com terceiros', vi: 'Tài liệu của bạn chỉ được dùng cho việc chuyển đổi bạn yêu cầu, không bao giờ bị bán hay chia sẻ với bên thứ ba', hi: 'आपके दस्तावेज़ सिर्फ़ आपके माँगे गए कन्वर्ज़न के लिए इस्तेमाल होते हैं, कभी बेचे या किसी और से शेयर नहीं किए जाते', ar: 'تُستخدم مستنداتك فقط للتحويل الذي طلبته، ولا تُباع أو تُشارك مع أطراف ثالثة أبداً', tr: 'Belgeleriniz yalnızca istediğiniz dönüştürme için kullanılır, asla satılmaz veya üçüncü taraflarla paylaşılmaz', en: 'Your documents are only used for the conversion you asked for, never sold or shared with third parties' }),
    sec4t: L(locale, { ja: '管理はあなたの手に', de: 'Sie behalten die Kontrolle', fr: 'Vous gardez le contrôle', es: 'Tú tienes el control', it: 'Il controllo resta a te', id: 'Anda Tetap Memegang Kendali', pt: 'Você no Controle', vi: 'Bạn luôn kiểm soát', hi: 'कंट्रोल आपके हाथ में', ar: 'التحكم بيدك', tr: 'Kontrol Sizde', en: 'You Stay in Control' }),
    sec4d: L(locale, { ja: 'アカウントなしでツールを使用可能。マイファイルからいつでも削除できます', de: 'Tools ohne Konto nutzen und Dateien jederzeit in „Meine Dateien“ löschen', fr: 'Utilisez les outils sans compte et supprimez vos fichiers à tout moment depuis « Mes fichiers »', es: 'Usa las herramientas sin cuenta y elimina tus archivos cuando quieras desde "Mis archivos"', it: 'Usa gli strumenti senza account ed elimina i file da "I miei file" quando vuoi', id: 'Gunakan alat tanpa akun, dan hapus file dari "File Saya" kapan saja', pt: 'Use as ferramentas sem conta e exclua arquivos em "Meus arquivos" quando quiser', vi: 'Dùng công cụ không cần tài khoản và xóa tệp trong "Tệp của tôi" bất cứ lúc nào', hi: 'बिना अकाउंट टूल इस्तेमाल करें, और My Files से फ़ाइलें कभी भी हटाएँ', ar: 'استخدم الأدوات دون حساب، واحذف الملفات من "ملفاتي" في أي وقت', tr: 'Araçları hesap olmadan kullanın ve dosyaları "Dosyalarım" bölümünden istediğiniz zaman silin', en: 'Use the tools without an account, and delete files from My Files anytime' }),
    badgeShare: L(locale, { ja: '共有なし', de: 'Keine Weitergabe', fr: 'Aucun partage', es: 'Sin compartir', it: 'Nessuna condivisione', id: 'Tanpa berbagi', pt: 'Sem compartilhamento', vi: 'Không chia sẻ', hi: 'शेयर नहीं', ar: 'بلا مشاركة', tr: 'Paylaşım yok', en: 'No sharing' }),
    builtH: L(locale, { ja: 'なぜこれを作ったのか', de: 'Warum wir das gebaut haben', fr: 'Pourquoi nous avons construit cela', es: 'Por qué lo construimos', en: 'Why We Built This', it: "Perché l\'abbiamo costruito", id: 'Mengapa Kami Membangun Ini', pt: 'Por Que Construímos Isso', vi: 'Vì sao chúng tôi xây dựng công cụ này', hi: 'हमने इसे क्यों बनाया', ar: 'لماذا بنينا هذا الموقع', tr: 'Bunu Neden Yaptık' }),
    faqH: L(locale,{ja:'よくある質問',de:'Häufig gestellte Fragen',fr:'Questions fréquentes',es:'Preguntas frecuentes',en:'Frequently Asked Questions',it:'Domande frequenti',id:'Pertanyaan yang Sering Diajukan',pt:'Perguntas Frequentes', vi: 'Câu hỏi thường gặp', hi: 'अक्सर पूछे जाने वाले सवाल', ar: 'الأسئلة الشائعة', tr: 'Sık Sorulan Sorular'}),
    faqSub: L(locale,{ja:'知っておくべきすべて',de:'Alles, was Sie wissen müssen',fr:'Tout ce que vous devez savoir',es:'Todo lo que necesitas saber',en:'Everything you need to know',it:'Tutto quello che devi sapere',id:'Semua yang perlu Anda ketahui',pt:'Tudo que você precisa saber', vi: 'Mọi điều bạn cần biết', hi: 'वह सब कुछ जो आपको जानना चाहिए', ar: 'كل ما تحتاج إلى معرفته', tr: 'Bilmeniz gereken her şey'}),
    premBadge: L(locale,{ja:'プレミアム機能',de:'Premium-Funktionen',fr:'Fonctionnalités Premium',es:'Funciones Premium',en:'Premium Features',it:'Funzioni Premium',id:'Fitur Premium',pt:'Recursos Premium', vi: 'Tính năng Premium', hi: 'प्रीमियम सुविधाएँ', ar: 'مزايا Premium', tr: 'Premium Özellikler'}),
    premH: L(locale,{ja:'もっと使いたい？60秒でアップグレード。',de:'Mehr brauchen? Upgrade in 60 Sekunden.',fr:'Besoin de plus ? Passez à la version Pro en 60 sec.',es:'¿Necesitas más? Mejora en 60 segundos.',en:'Need more? Upgrade takes 60 seconds.',it:'Ne hai bisogno di più? Upgrade in 60 secondi.',id:'Butuh lebih? Upgrade dalam 60 detik.',pt:'Precisa de mais? Upgrade em 60 segundos.', vi: 'Cần nhiều hơn? Nâng cấp chỉ mất 60 giây.', hi: 'और चाहिए? अपग्रेड में 60 सेकंड लगते हैं।', ar: 'تحتاج إلى المزيد؟ الترقية تستغرق 60 ثانية.', tr: 'Daha fazlasına mı ihtiyacınız var? Yükseltme 60 saniye sürer.'}),
    premBtn: L(locale,{ja:'プレミアムを取得',de:'Premium holen',fr:'Obtenir Premium',es:'Obtener Premium',en:'Get Premium Now',it:'Ottieni Premium',id:'Dapatkan Premium',pt:'Obtenha Premium', vi: 'Dùng Premium ngay', hi: 'अभी प्रीमियम लें', ar: 'احصل على Premium الآن', tr: 'Premium\'u Şimdi Alın'}),
    premInc: L(locale,{ja:'含まれる内容',de:'Was enthalten ist',fr:'Ce qui est inclus',es:'Qué incluye',en:'What is Included',it:'Cosa è incluso',id:'Yang Termasuk',pt:'O Que Inclui', vi: 'Bao gồm những gì', hi: 'इसमें क्या शामिल है', ar: 'ما الذي تشمله', tr: 'Neler Dahil'}),
    search: L(locale, { ja: 'ツールを検索', de: 'Tools suchen', fr: 'Rechercher des outils', es: 'Buscar herramientas', en: 'Search tools', it: 'Cerca strumenti', id: 'Cari alat', pt: 'Pesquisar ferramentas', vi: 'Tìm công cụ', hi: 'टूल खोजें', ar: 'ابحث في الأدوات', tr: 'Araçlarda ara' }),
  }

  const searchTools = tools.map((x, i) => ({ ...x, id: String(i) }))
  const formats = [
    { name: "PDF", formats: "PDF", label: "PDF", color: "#D6293E" },
    { name: "Word", formats: "DOC, DOCX", label: "DOC", color: "#2B5BFF" },
    { name: "Excel", formats: "XLS, XLSX, CSV", label: "XLS", color: "#0F8F4F" },
    { name: "PowerPoint", formats: "PPT, PPTX", label: "PPT", color: "#B86A00" },
    { name: S.fmtImages, formats: "JPG, PNG, WebP", label: "JPG", color: "#6D3BFF" },
    { name: "iPhone", formats: "HEIC, HEIF", label: "HEIC", color: "#14130F" },
  ]
  const whyCards = [
    { Icon: Shield, tone: "green", title: S.why1t, desc: S.why1d },
    { Icon: Zap, tone: "amber", title: S.why2t, desc: S.why2d },
    { Icon: Award, tone: "blue", title: S.why3t, desc: S.why3d },
  ]
  const secItems = [
    { Icon: Shield, tone: "green", title: S.sec1t, desc: S.sec1d },
    { Icon: Clock, tone: "blue", title: S.sec2t, desc: S.sec2d },
    { Icon: Lock, tone: "ink", title: S.sec3t, desc: S.sec3d },
    { Icon: Users, tone: "violet", title: S.sec4t, desc: S.sec4d },
  ]

  return (
    <>
      <SEOHead title={t('seo.home.title')} description={t('seo.home.description')} keywords={t('seo.home.keywords')} pathname="" locale={locale} />
      <Layout>
        <div className={`bg-[#F7F5F0] ${INK}`} style={{ fontFamily: "'Sora','Instrument Sans',system-ui,sans-serif" }}>
          {/* HERO */}
          {/* HOMEPAGE HEADER AD — directly under the site header (moved up from below the hero on
              2026-10-16: it sat below the fold and was rarely seen). Hidden for paid users; the box
              collapses to nothing when the ad slot comes back empty. */}
          <div className="px-4 pt-3 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <AdSenseUnit size="leaderboard" className="rounded-xl overflow-hidden" />
            </div>
          </div>

          <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 md:pt-16">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr,0.95fr] lg:gap-14">
              <div>
                <h1 className="mb-5 text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl md:text-[4rem]">
                  {S.h1a}
                  <span className="mt-1 block text-[#2B5BFF]">{S.h1b}</span>
                </h1>
                <p className="mb-5 max-w-lg text-lg leading-relaxed text-[#14130F]/70">{S.sub}</p>

                <ul className="mb-6 flex flex-wrap gap-2">
                  {[{ I: Shield, x: S.pill1 }, { I: Zap, x: S.pill2 }, { I: Clock, x: S.pill3 }].map(({ I, x }, i) => (
                    <li key={i} className="flex items-center gap-1.5 rounded-full border border-[#14130F]/15 bg-white px-3 py-1.5 text-xs font-semibold">
                      <I aria-hidden="true" className="h-3.5 w-3.5" />{x}
                    </li>
                  ))}
                </ul>

                <ComboBox
                  defaultItems={searchTools}
                  menuTrigger="focus"
                  allowsEmptyCollection
                  onSelectionChange={(key) => { const x = searchTools.find((y) => y.id === key); if (x) router.push(x.href) }}
                  className="mb-6 w-full max-w-md"
                >
                  <Label className="sr-only">{S.search}</Label>
                  <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#14130F]/50" />
                    <Input placeholder={S.search} className="h-12 w-full rounded-full border-2 border-[#14130F] bg-white pl-12 pr-4 text-base placeholder:text-[#14130F]/45 focus:outline-none data-[focus-visible]:ring-4 data-[focus-visible]:ring-[#C6F432]" />
                  </div>
                  <Popover className="w-[--trigger-width] overflow-hidden rounded-3xl border-2 border-[#14130F] bg-white shadow-[0_24px_60px_-20px_rgba(20,19,15,0.45)]">
                    <ListBox className="max-h-72 overflow-auto p-2 outline-none" renderEmptyState={() => <div className="px-4 py-4 text-sm text-[#14130F]/60">-</div>}>
                      {(x) => (
                        <ListBoxItem id={x.id} textValue={`${x.name} ${x.shortDesc}`} className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 outline-none data-[focused]:bg-[#F1EEE6]">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[TONE_BY_HREF[x.href] || "sand"].chip}`}><x.Icon aria-hidden="true" className="h-4 w-4" /></span>
                          <span className="min-w-0"><span className="block truncate text-sm font-bold">{x.name}</span><span className="block truncate text-xs text-[#14130F]/60">{x.shortDesc}</span></span>
                        </ListBoxItem>
                      )}
                    </ListBox>
                  </Popover>
                </ComboBox>

                <div className="mb-8 flex flex-wrap items-center gap-3">
                  <Link href="#tools" className="group inline-flex items-center gap-2 rounded-full bg-[#14130F] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2B5BFF] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#14130F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5F0]">
                    <span>{S.start}</span><ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                  <Link href="#tools" className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#14130F] px-5 py-3 text-sm font-semibold transition hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#14130F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5F0]">
                    {S.viewAll}
                  </Link>
                  <Link href="/pricing" className="px-3 py-3 text-sm font-semibold text-[#14130F]/65 underline-offset-4 hover:text-[#14130F] hover:underline">{t('nav.pricing')}</Link>
                </div>

                <dl className="flex items-center gap-10 border-t border-[#14130F]/15 pt-6">
                  {[{ v: "27", l: S.statTools }, { v: "12", l: S.statLang }, { v: "Free", l: S.statPlan }].map((s, i) => (
                    <div key={i}><dd className="text-2xl font-extrabold leading-none tracking-tight">{s.v}</dd><dt className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#14130F]/55">{s.l}</dt></div>
                  ))}
                </dl>
              </div>

              <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[36px] bg-[#EFEAE0]"><HeroArt /></div>
                <div className="relative z-10 -mt-24 px-4 sm:-mt-28 sm:px-8">
                  <div className="rounded-[28px] border-2 border-[#14130F] bg-white p-5 shadow-[0_28px_60px_-24px_rgba(20,19,15,0.5)]">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#14130F]/50">smallpdf.us</span>
                      <span className="rounded-full bg-[#D5F1DE] px-2.5 py-0.5 text-[11px] font-bold text-[#0F8F4F]">Free</span>
                    </div>
                    <HeroUpload />
                    <ul className="mt-3 space-y-2">
                      {[{ name: 'Q3-report-final-v2.pdf', size: '2.4 MB' }, { name: 'contract-draft3.docx', size: '340 KB' }].map((f) => (
                        <li key={f.name} className="flex items-center gap-2.5 rounded-xl bg-[#F7F5F0] px-3 py-2">
                          <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-[#D6293E]" />
                          <span className="flex-1 truncate text-xs font-semibold">{f.name}</span>
                          <span className="text-[11px] text-[#14130F]/50">{f.size}</span>
                          <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#0F8F4F]" />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="absolute right-2 top-4 flex items-center gap-2 rounded-2xl border-2 border-[#14130F] bg-white px-3 py-2 text-xs font-bold shadow-lg sm:right-6">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F8F4F]"><Check aria-hidden="true" className="h-3.5 w-3.5 text-white" /></span>{S.done}
                </div>
                <div className="absolute left-2 top-24 flex items-center gap-2 rounded-2xl border-2 border-[#14130F] bg-[#C6F432] px-3 py-2 text-xs font-bold shadow-lg sm:left-6">
                  <Clock aria-hidden="true" className="h-4 w-4" />{S.deleted}
                </div>
              </div>
            </div>
          </section>

          {/* FEATURED */}
          <section className="bg-[#14130F] px-4 py-14 text-white sm:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="mb-9 text-center">
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#C6F432] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#14130F]"><Sparkles aria-hidden="true" className="h-3.5 w-3.5" />{S.launched}</span>
                <h2 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-4xl">{S.featH}</h2>
                <p className="mx-auto max-w-lg text-white/65">{S.featSub}</p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-3">
                {featuredTools.map((tool) => {
                  const st = FEATURED_STYLE[tool.href] || { kind: "edit", tone: "blue" }
                  return (
                    <li key={tool.href}>
                      <Link href={hrefFor(tool.href, locale)} locale={false} className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-white text-[#14130F] transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C6F432] focus-visible:ring-offset-2 focus-visible:ring-offset-[#14130F]">
                        <div className={`relative h-44 ${TONES[st.tone].tile}`}>
                          <ToolArt kind={st.kind} />
                          <span className="absolute right-4 top-4 rounded-full bg-[#C6F432] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">{tool.badgeText}</span>
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="text-lg font-bold tracking-tight">{tool.name}</h3>
                          <p className="mb-4 mt-1 flex-1 text-sm leading-snug text-[#14130F]/65">{tool.longDesc}</p>
                          <span className="inline-flex items-center gap-1 text-sm font-bold group-hover:gap-2">{tool.ctaText} <ArrowRight aria-hidden="true" className="h-4 w-4" /></span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>

          {/* ALL TOOLS */}
          <section id="tools" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-9 text-center">
              <h2 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-4xl">{S.allH}</h2>
              <p className="text-[#14130F]/65">{S.allSub}</p>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {tools.map((tool) => <li key={tool.href}><Tile tool={{ ...tool, badge: badgeText }} locale={locale} /></li>)}
            </ul>
          </section>

          {/* FILE FORMATS */}
          <section className="bg-white px-4 py-14 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="mb-9 text-center">
                <h2 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-4xl">{S.fmtH}</h2>
                <p className="mx-auto max-w-lg text-[#14130F]/65">{S.fmtSub}</p>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {formats.map((f, i) => (
                  <li key={i} className="flex flex-col items-center rounded-[24px] border-2 border-[#14130F]/10 bg-[#F7F5F0] px-3 py-5 text-center transition hover:border-[#14130F]">
                    <FormatGlyph label={f.label} color={f.color} />
                    <h3 className="mt-3 text-sm font-bold">{f.name}</h3>
                    <p className="text-[11px] text-[#14130F]/60">{f.formats}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* WHY */}
          <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <div className="mb-9 text-center">
              <h2 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-4xl">{S.whyH}</h2>
              <p className="text-[#14130F]/65">{S.whySub}</p>
            </div>
            <ul className="grid gap-4 md:grid-cols-3">
              {whyCards.map((f, i) => (
                <li key={i} className={`rounded-[28px] p-6 ${TONES[f.tone].tile}`}>
                  <span className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${TONES[f.tone].chip}`}><f.Icon aria-hidden="true" className="h-6 w-6" /></span>
                  <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-[#14130F]/75">{f.desc}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* SECURITY */}
          <section className="bg-white px-4 py-14 sm:px-6">
            <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
              <div className="relative mx-auto aspect-[16/15] w-full max-w-md">
                <ShieldArt />
                <span className="absolute right-0 top-6 flex items-center gap-1.5 rounded-xl border-2 border-[#14130F] bg-white px-3 py-1.5 text-xs font-bold shadow-md"><Shield aria-hidden="true" className="h-3.5 w-3.5 text-[#0F8F4F]" />SSL 256-bit</span>
                <span className="absolute bottom-8 left-0 flex items-center gap-1.5 rounded-xl border-2 border-[#14130F] bg-white px-3 py-1.5 text-xs font-bold shadow-md"><Check aria-hidden="true" className="h-3.5 w-3.5 text-[#0F8F4F]" />{S.badgeShare}</span>
                <span className="absolute right-2 top-1/2 flex items-center gap-1.5 rounded-xl border-2 border-[#14130F] bg-[#C6F432] px-3 py-1.5 text-xs font-bold shadow-md"><Clock aria-hidden="true" className="h-3.5 w-3.5" />1H</span>
              </div>
              <div>
                <h2 className="mb-3 text-2xl font-extrabold tracking-tight sm:text-4xl">{S.secH}</h2>
                <p className="mb-6 leading-relaxed text-[#14130F]/65">{S.secP}</p>
                <ul className="space-y-2.5">
                  {secItems.map((x, i) => (
                    <li key={i} className="flex items-start gap-3.5 rounded-2xl border-2 border-[#14130F]/10 bg-[#F7F5F0] p-3.5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[x.tone].chip}`}><x.Icon aria-hidden="true" className="h-5 w-5" /></span>
                      <div><h3 className="text-sm font-bold">{x.title}</h3><p className="text-xs leading-relaxed text-[#14130F]/60">{x.desc}</p></div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* WHY WE BUILT THIS */}
          <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="mb-8 text-center text-2xl font-extrabold tracking-tight sm:text-4xl">{S.builtH}</h2>
            <div className="grid items-start gap-8 rounded-[36px] border-2 border-[#14130F] bg-white p-6 sm:p-10 md:grid-cols-[220px,1fr]">
              <figure className="mx-auto w-44 md:w-full">
                <div className="overflow-hidden rounded-[28px] border-2 border-[#14130F] bg-[#DCE8FF]">
                  <img src="/team/manikant.png" alt="Manikant" width="440" height="608" loading="lazy" className="aspect-square w-full object-cover" />
                </div>
                <figcaption className="mt-3 text-center text-sm font-bold">Manikant<span className="block text-xs font-medium text-[#14130F]/55">New Delhi, India</span></figcaption>
              </figure>
              <div className="space-y-5 text-[15px] leading-[1.8] text-[#14130F]/75" style={{ fontFamily: "'Instrument Sans',system-ui,sans-serif" }}>
                  {locale === 'ja' ? (
                    <>
                      <p>
                        PDFの扱いは本当にイライラすることがあります。締め切りが迫る中で必死に複数のファイルを結合しようとしたり、メールで送信できるように巨大なドキュメントを小さくしようと苦労したり、フォーマットが完全に崩れずにPDFをWordに変換したいと切望したり。身に覚えがありますか？
                      </p>
                      <p>
                        そのフラストレーションこそが、このサイトを作った理由です。何か違うもの、期待通りに機能するものを作りたかったのです。3クリック先に埋もれた複雑なメニューも、必要なときにポップアップする驚きの有料プランもなく、画像のサイズ変更や2つのファイルの結合のためだけに、また別のアカウントを作ることを強制されることもありません。
                      </p>
                      <p>
                        真夜中に研究論文をまとめている学生でも、契約書や請求書を扱う専門家でも、ドキュメントに署名して送信する必要がある人でも、これらのツールは時間を節約し、頭痛を和らげるために設計されています。実際のユーザーフィードバックに基づいてすべての機能を改良してきました。あなたの時間が何よりも大切だからこそ、改善を続けています。
                      </p>
                    </>
                  ) : locale === 'de' ? (
                    <>
                      <p>
                        PDFs können unglaublich frustrierend sein. Wir kennen das alle: verzweifelt versuchen, mehrere Dateien zusammenzuführen, während eine Deadline näher rückt; ein riesiges Dokument verkleinern, damit es per E-Mail versandt werden kann; oder ein PDF in Word konvertieren, ohne dass die Formatierung völlig durcheinander gerät. Kommt Ihnen das bekannt vor?
                      </p>
                      <p>
                        Genau diese Frustration hat uns dazu bewogen, diese Website zu erstellen. Wir wollten etwas Anderes bauen – etwas, das so funktioniert, wie man es erwartet. Keine verwirrenden Menüs drei Klicks tief vergraben, keine überraschenden Bezahlschranken genau dann, wenn man etwas braucht, und absolut kein Zwang, noch ein weiteres Konto zu erstellen, nur um ein Bild zu verkleinern oder zwei Dateien zusammenzuführen.
                      </p>
                      <p>
                        Ob Student, der mitten in der Nacht Forschungsarbeiten zusammenstellt, ein Profi, der Verträge und Rechnungen bearbeitet, oder jemand, der schnell ein Dokument unterschreiben und versenden muss – diese Tools sind darauf ausgelegt, Zeit zu sparen und Kopfschmerzen zu ersparen. Wir haben jede Funktion auf Basis echten Nutzerfeedbacks verfeinert und verbessern uns weiter, weil Ihre Zeit das Wichtigste ist.
                      </p>
                    </>
                  ) : locale === 'fr' ? (
                    <>
                      <p>
                        Les PDF peuvent être incroyablement frustrants. Nous sommes tous passés par là : tenter désespérément de fusionner plusieurs fichiers alors qu'une échéance approche, lutter pour réduire un document volumineux afin de pouvoir l'envoyer par e-mail, ou vouloir convertir un PDF en Word sans que la mise en forme ne parte dans tous les sens. Ça vous parle ?
                      </p>
                      <p>
                        C'est exactement cette frustration qui nous a poussés à créer ce site. Nous voulions construire quelque chose de différent, quelque chose qui fonctionne vraiment comme vous l'attendez. Pas de menus déroutants enfouis à trois clics de profondeur, pas de paywalls surprises qui surgissent au mauvais moment, et absolument aucune obligation de créer encore un compte juste pour redimensionner une image ou fusionner deux fichiers.
                      </p>
                      <p>
                        Que vous soyez étudiant assemblant des travaux de recherche à minuit, un professionnel gérant des contrats et des factures, ou simplement quelqu'un qui doit signer et envoyer rapidement un document, ces outils sont conçus pour vous faire gagner du temps. Nous affinons chaque fonctionnalité en fonction des retours réels des utilisateurs.
                      </p>
                    </>
                  ) : locale === 'es' ? (
                    <>
                      <p>
                        Los PDF pueden ser increíblemente frustrantes. Todos hemos estado ahí: intentando desesperadamente combinar varios archivos mientras se acerca una fecha límite, luchando por reducir un documento enorme para poder enviarlo por correo, o queriendo convertir un PDF a Word sin que el formato se convierta en un caos total. ¿Te suena familiar?
                      </p>
                      <p>
                        Esa frustración es exactamente por qué creamos este sitio. Queríamos construir algo diferente, algo que realmente funcione como esperarías. Sin menús confusos enterrados a tres clics de profundidad, sin sorpresas de pago justo cuando más lo necesitas, y absolutamente sin obligarte a crear otra cuenta más solo para redimensionar una imagen o combinar dos archivos.
                      </p>
                      <p>
                        Ya seas un estudiante reuniendo trabajos de investigación a medianoche, un profesional manejando contratos y facturas, o simplemente alguien que necesita firmar y enviar un documento rápidamente, estas herramientas están diseñadas para ahorrarte tiempo. Hemos perfeccionado cada función basándonos en comentarios reales de usuarios.
                      </p>
                    </>
                  ) : locale === 'id' ? (
    <>
      <p>
        PDF bisa sangat membuat frustrasi. Kita semua pernah mengalaminya: mencoba menggabungkan beberapa file saat tenggat waktu semakin dekat, berjuang mengecilkan dokumen besar agar bisa dikirim lewat email, atau ingin mengkonversi PDF ke Word tanpa format berantakan. Kedengarannya familiar?
      </p>
      <p>
        Frustrasi itulah yang mendorong kami membuat situs ini. Kami ingin membangun sesuatu yang berbeda - sesuatu yang benar-benar bekerja sesuai harapan. Tidak ada menu membingungkan yang tersembunyi tiga klik lebih dalam, tidak ada paywall mengejutkan yang muncul tepat saat Anda membutuhkan sesuatu, dan sama sekali tidak memaksa Anda membuat akun lagi hanya untuk mengubah ukuran gambar atau menggabungkan dua file.
      </p>
      <p>
        Baik Anda seorang pelajar yang mengumpulkan makalah penelitian tengah malam, seorang profesional yang menangani kontrak dan faktur, atau hanya seseorang yang perlu menandatangani dan mengirim dokumen dengan cepat, alat-alat ini dirancang untuk menghemat waktu Anda. Kami terus meningkatkan karena waktu Anda yang paling penting.
      </p>
    </>
  ) : locale === 'it' ? (
                    <>
                      <p>
                        I PDF possono essere incredibilmente frustranti. Ci siamo passati tutti: cercare disperatamente di combinare più file mentre si avvicina una scadenza, lottare per ridurre un documento enorme in modo da poterlo inviare via e-mail, o voler convertire un PDF in Word senza che la formattazione diventi un caos totale. Ti suona familiare?
                      </p>
                      <p>
                        Quella frustrazione è esattamente il motivo per cui abbiamo creato questo sito. Volevamo costruire qualcosa di diverso, qualcosa che funzionasse davvero come ci si aspetta. Nessun menu confuso sepolto a tre clic di profondità, nessun paywall a sorpresa che compare proprio quando ne hai bisogno, e assolutamente nessun obbligo di creare un altro account solo per ridimensionare un'immagine o unire due file.
                      </p>
                      <p>
                        Che tu sia uno studente che assembla documenti di ricerca a mezzanotte, un professionista che gestisce contratti e fatture, o semplicemente qualcuno che ha bisogno di firmare e inviare rapidamente un documento, questi strumenti sono progettati per farti risparmiare tempo. Abbiamo perfezionato ogni funzione basandoci sul feedback reale degli utenti, e continuiamo a migliorare perché il tuo tempo è la cosa più importante.
                      </p>
                    </>
                  ) : locale === 'pt' ? (
                    <>
                      <p>
                        PDFs podem ser incrivelmente frustrantes. Já passamos por isso: desesperadamente tentando combinar vários arquivos enquanto um prazo se aproxima, lutando para reduzir um documento enorme para poder enviá-lo por e-mail, ou querendo converter um PDF para Word sem que a formatação vire um caos total. Parece familiar?
                      </p>
                      <p>
                        Essa frustração é exatamente o motivo pelo qual criamos este site. Queríamos construir algo diferente, algo que realmente funcione do jeito que você espera. Sem menus confusos enterrados três cliques de profundidade, sem paywall surpresa aparecendo exatamente quando você mais precisa, e absolutamente sem forçar você a criar mais uma conta só para redimensionar uma imagem ou mesclar dois arquivos.
                      </p>
                      <p>
                        Seja você um estudante reunindo trabalhos de pesquisa à meia-noite, um profissional lidando com contratos e faturas, ou simplesmente alguém que precisa assinar e enviar um documento rapidamente, essas ferramentas foram projetadas para economizar seu tempo. Refinamos cada recurso com base no feedback real dos usuários, e continuamos melhorando porque seu tempo é o que mais importa.
                      </p>
                    </>
                  ) : locale === 'vi' ? (
                    <>
                      <p>
                        PDF có thể gây bực bội vô cùng. Chúng ta đều từng như vậy: cuống cuồng gộp nhiều tệp khi hạn chót đang đến gần, vật lộn thu nhỏ một tài liệu khổng lồ để gửi được qua email, hoặc muốn chuyển PDF sang Word mà định dạng không bị loạn hết cả lên. Nghe quen không?
                      </p>
                      <p>
                        Chính nỗi bực bội đó là lý do chúng tôi tạo ra trang web này. Chúng tôi muốn xây dựng một thứ khác biệt - thứ thực sự hoạt động đúng như bạn mong đợi. Không có menu rối rắm giấu sâu ba cú nhấp, không có bức tường trả phí bất ngờ hiện ra đúng lúc bạn cần, và hoàn toàn không ép bạn tạo thêm một tài khoản nữa chỉ để đổi kích thước một bức ảnh hay gộp hai tệp.
                      </p>
                      <p>
                        Dù bạn là sinh viên đang tổng hợp bài nghiên cứu lúc nửa đêm, người đi làm xử lý hợp đồng và hóa đơn, hay đơn giản là người cần ký và gửi nhanh một tài liệu, các công cụ này được thiết kế để tiết kiệm thời gian của bạn. Chúng tôi tinh chỉnh từng tính năng dựa trên phản hồi thực tế của người dùng, và luôn cải thiện vì thời gian của bạn là điều quan trọng nhất.
                      </p>
                    </>
                  ) : locale === 'hi' ? (
                    <>
                      <p>
                        PDF बेहद झुँझलाहट भरी हो सकती हैं। हम सब इससे गुज़रे हैं: समय-सीमा पास आते-आते कई फ़ाइलें जोड़ने की हड़बड़ी, भारी दस्तावेज़ को ईमेल करने लायक छोटा करने की जद्दोजहद, या PDF को Word में बदलना ताकि फ़ॉर्मेटिंग पूरी तरह बिगड़ न जाए। सुना-सुना लगता है?
                      </p>
                      <p>
                        उसी झुँझलाहट की वजह से हमने यह वेबसाइट बनाई। हम कुछ अलग बनाना चाहते थे - ऐसी चीज़ जो सचमुच वैसे काम करे जैसी आप उम्मीद करते हैं। तीन क्लिक गहराई में दबे उलझे मेनू नहीं, ज़रूरत के ठीक समय अचानक आ जाने वाला पेवॉल नहीं, और इमेज का आकार बदलने या दो फ़ाइलें जोड़ने भर के लिए एक और अकाउंट बनवाने की ज़बरदस्ती बिल्कुल नहीं।
                      </p>
                      <p>
                        चाहे आप आधी रात को शोध-पत्र जोड़ते छात्र हों, अनुबंध और इनवॉइस सँभालते पेशेवर हों, या बस कोई ऐसा जिसे जल्दी से दस्तावेज़ पर हस्ताक्षर करके भेजना हो, ये टूल आपका समय बचाने के लिए बनाए गए हैं। हमने हर सुविधा को उपयोगकर्ताओं के असली फ़ीडबैक के आधार पर निखारा है, और हम सुधारते रहते हैं क्योंकि आपका समय सबसे ज़्यादा मायने रखता है।
                      </p>
                    </>
                  ) : locale === 'ar' ? (
                    <>
                      <p>
                        ملفات PDF أزعجتني دائماً. محاولة دمج الملفات قبل موعد التسليم، أو تصغير مستند ليمرّ عبر البريد، أو تحويل PDF إلى Word دون أن يتحول التنسيق إلى فوضى، كنت أصطدم بالعوائق نفسها كل مرة. كل أداة كانت تطلب مالاً أو حساباً أو الاثنين معاً.
                      </p>
                      <p>
                        لذلك بنيت هذا الموقع. دون قوائم مدفونة خلف ثلاث نقرات، ودون جدران دفع مفاجئة، ودون «يرجى إنشاء حساب» لمجرد تغيير حجم صورة. أردت شيئاً يعمل فعلاً كما تتوقع: تفتحه وتستخدمه وتمضي. هذا كل شيء.
                      </p>
                      <p>
                        أنا Manikant، مطوّر من نيودلهي في الهند. أبني كل أداة في هذا الموقع وأصونها بنفسي. وإن تعطل شيء أو احتجت ميزة فيمكنك التواصل معي مباشرة، فلا يوجد فريق دعم، أنا فقط.
                      </p>
                    </>
                  ) : locale === 'tr' ? (
                    <>
                      <p>
                        PDF'ler beni hep bıktırdı. Son teslimden önce dosyaları birleştirmeye çalışmak, bir belgeyi e-postayla gidecek kadar küçültmek, biçimlendirme bozulmadan bir PDF'i Word'e çevirmek; hep aynı duvarlara toslayıp durdum. Her araç ya para istiyordu, ya hesap, ya da ikisini birden.
                      </p>
                      <p>
                        Bu yüzden bunu yaptım. Üç tık derine gömülü menüler yok, sürpriz ödeme duvarları yok, sırf bir görseli yeniden boyutlandırmak için «lütfen hesap oluşturun» yok. Beklediğiniz gibi çalışan bir şey istedim: açarsınız, kullanırsınız, gidersiniz. Hepsi bu.
                      </p>
                      <p>
                        Ben Manikant, Yeni Delhi'den bir geliştiriciyim. Bu sitedeki her aracı kendim yapıyor ve sürdürüyorum. Bir şey bozuksa ya da bir özelliğe ihtiyacınız varsa bana doğrudan ulaşabilirsiniz; destek ekibi yok, yalnızca ben varım.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        PDFs have always frustrated me. Trying to merge files before a deadline, shrinking a document so it'll actually go through email, converting a PDF to Word without the formatting turning into chaos - I kept running into the same walls. Every tool either wanted money, an account, or both.
                      </p>
                      <p>
                        So I built this. No menus buried three clicks deep, no surprise paywalls, no "please create an account" just to resize an image. I wanted something that actually works the way you'd expect - you open it, you use it, you leave. That's it.
                      </p>
                      <p>
                        I'm Manikant, a developer from New Delhi, India. I built and maintain every tool on this site myself. If something's broken or you need a feature, you can reach me directly - there's no support team, just me.
                      </p>
                    </>
                  )}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="bg-white px-4 py-14 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 text-center">
                <h2 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-4xl">{S.faqH}</h2>
                <p className="text-[#14130F]/65">{S.faqSub}</p>
              </div>
              <DisclosureGroup defaultExpandedKeys={["faq-0"]} className="divide-y divide-[#14130F]/15 border-y border-[#14130F]/15">
                {faqs.map((f, i) => (
                  <Disclosure key={i} id={`faq-${i}`}>
                    <Heading className="m-0">
                      <Button slot="trigger" className="group flex w-full items-center justify-between gap-4 py-5 text-left text-base font-bold outline-none data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-[#14130F]">
                        {f.question}
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#14130F]/25 transition group-aria-expanded:rotate-180 group-aria-expanded:bg-[#14130F] group-aria-expanded:text-white"><ChevronDown className="h-4 w-4" /></span>
                      </Button>
                    </Heading>
                    <DisclosurePanel><p className="pb-5 pr-10 text-sm leading-relaxed text-[#14130F]/70">{f.answer}</p></DisclosurePanel>
                  </Disclosure>
                ))}
              </DisclosureGroup>
            </div>
          </section>

          {/* PREMIUM CTA */}
          <section className="px-4 py-14 sm:px-6">
            <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[36px] bg-[#14130F] p-8 text-white md:p-10">
              <div aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#C6F432]/25 blur-3xl" />
              <div className="relative grid items-center gap-8 md:grid-cols-2">
                <div>
                  <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold"><Crown aria-hidden="true" className="h-3.5 w-3.5 text-[#C6F432]" />{S.premBadge}</span>
                  <h2 className="mb-5 text-2xl font-extrabold leading-tight tracking-tight md:text-4xl">{S.premH}</h2>
                  <ul className="mb-6 space-y-3">
                    {premFeatures.map((x, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-white/85"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#C6F432]"><Check aria-hidden="true" className="h-3 w-3 text-[#14130F]" /></span>{x}</li>
                    ))}
                  </ul>
                  <Link href="/pricing" className="group inline-flex items-center gap-2 rounded-full bg-[#C6F432] px-6 py-3 text-sm font-bold text-[#14130F] transition hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14130F]">
                    <Crown aria-hidden="true" className="h-4 w-4" /><span>{S.premBtn}</span><ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-bold"><Sparkles aria-hidden="true" className="h-4 w-4 text-[#C6F432]" />{S.premInc}</h3>
                  <ul className="space-y-2">
                    {premIncludes.map((x, i) => (
                      <li key={i} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white/80"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#C6F432]" />{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Layout>
    </>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, []) },
    revalidate: 86400,
  }
}
