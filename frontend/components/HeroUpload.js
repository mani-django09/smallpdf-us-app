// Homepage hero dropzone. Accepts a file, works out which tools can take it,
// and hands the file straight to the chosen tool page (lib/pendingUpload.js)
// so the visitor doesn't have to pick the file a second time.

import { useRef, useState } from 'react'
import { Upload, FileText, ChevronRight, X } from 'lucide-react'
import { useTranslations } from '../lib/i18n'
import { useLocalizedRouter } from '../lib/useLocalizedRouter'
import { openToolWithFiles } from '../lib/pendingUpload'

function L(locale, map) { return map[locale] ?? map.en ?? '' }

// First tool in each list is the most common intent for that file type.
const TOOLS_BY_KIND = {
  pdf:   [['/compress-pdf', 'nav.compressPdf'], ['/pdf-to-word', 'nav.pdfToWord'], ['/merge-pdf', 'nav.mergePdf'],
          ['/split-pdf', 'nav.splitPdf'], ['/pdf-to-jpg', 'nav.pdfToJpg'], ['/edit-pdf', 'nav.editPdf']],
  word:  [['/word-to-pdf', 'nav.wordToPdf']],
  excel: [['/excel-to-pdf', 'nav.excelToPdf']],
  ppt:   [['/ppt-to-pdf', 'nav.pptToPdf']],
  jpg:   [['/jpg-to-pdf', 'nav.jpgToPdf'], ['/compress-image', 'nav.compressImage']],
  png:   [['/png-to-pdf', 'nav.pngToPdf'], ['/compress-image', 'nav.compressImage'], ['/png-to-webp', 'nav.pngToWebp']],
  webp:  [['/webp-to-png', 'nav.webpToPng'], ['/compress-image', 'nav.compressImage']],
  heic:  [['/heic-to-jpg', 'nav.heicToJpg'], ['/heic-to-png', 'nav.heicToPng']],
}

function kindOf(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'doc' || ext === 'docx') return 'word'
  if (ext === 'xls' || ext === 'xlsx') return 'excel'
  if (ext === 'ppt' || ext === 'pptx' || ext === 'odp') return 'ppt'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'png') return 'png'
  if (ext === 'webp') return 'webp'
  if (ext === 'heic' || ext === 'heif') return 'heic'
  return null
}

export default function HeroUpload({ compact = false }) {
  const { t, locale } = useTranslations()
  const router = useLocalizedRouter()
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [drag, setDrag] = useState(false)

  const kind = files.length ? kindOf(files[0]) : null
  const tools = kind ? TOOLS_BY_KIND[kind] : []
  const totalKb = files.reduce((s, f) => s + f.size, 0) / 1024
  const sizeLabel = totalKb > 1024 ? `${(totalKb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(totalKb))} KB`

  const pick = (list) => {
    const arr = Array.from(list || [])
    if (!arr.length) return
    // Keep only files of the same kind as the first one — tools take one type.
    const k = kindOf(arr[0])
    setFiles(k ? arr.filter((f) => kindOf(f) === k) : arr.slice(0, 1))
  }

  const reset = () => {
    setFiles([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="hidden"
      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odp,.jpg,.jpeg,.png,.webp,.heic,.heif"
      onChange={(e) => pick(e.target.files)}
      aria-label={L(locale, { ja: 'ファイルを選択', de: 'Datei auswählen', fr: 'Choisir un fichier', es: 'Elegir archivo', en: 'Choose a file', it: 'Scegli un file', id: 'Pilih file', pt: 'Escolher arquivo' })}
    />
  )

  if (!files.length) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files) }}
        className={`cursor-pointer border-2 border-dashed rounded-2xl text-center transition-colors ${
          drag ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-blue-50/40 hover:border-blue-400 hover:bg-blue-50'
        } ${compact ? 'p-4 flex items-center gap-3 text-left' : 'p-5 mb-4'}`}
      >
        {input}
        <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-sky-400 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${compact ? '' : 'mx-auto mb-3'}`}>
          <Upload className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className={`font-semibold text-gray-700 mb-0.5 ${compact ? 'text-sm' : 'text-xs'}`}>
            {compact
              ? L(locale, { ja: 'ファイルを選択', de: 'Datei auswählen', fr: 'Choisir un fichier', es: 'Elegir archivo', en: 'Choose a file', it: 'Scegli un file', id: 'Pilih file', pt: 'Escolher arquivo' })
              : L(locale, { ja: 'ファイルをドロップ', de: 'Datei ablegen', fr: 'Déposer le fichier', es: 'Soltar archivo', en: 'Drop your file here', it: 'Trascina il file', id: 'Seret file di sini', pt: 'Solte o arquivo aqui' })}
          </p>
          <p className="text-[10px] text-gray-400">
            {compact ? 'PDF, DOCX, JPG, PNG, XLSX…' : L(locale, { ja: 'またはクリックして選択 · PDF, DOCX, JPG, PNG…', de: 'oder klicken · PDF, DOCX, JPG, PNG…', fr: 'ou cliquez · PDF, DOCX, JPG, PNG…', es: 'o haz clic · PDF, DOCX, JPG, PNG…', en: 'or click to browse · PDF, DOCX, JPG, PNG…', it: 'o fai clic · PDF, DOCX, JPG, PNG…', id: 'atau klik · PDF, DOCX, JPG, PNG…', pt: 'ou clique · PDF, DOCX, JPG, PNG…' })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`border-2 border-blue-200 rounded-2xl bg-white ${compact ? 'p-4' : 'p-4 mb-4'}`}>
      {input}
      <div className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2 mb-3">
        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">
          {files.length > 1 ? `${files[0].name} +${files.length - 1}` : files[0].name}
        </span>
        <span className="text-[10px] text-gray-400 flex-shrink-0">{sizeLabel}</span>
        <button type="button" onClick={reset} className="p-0.5 text-gray-400 hover:text-gray-700" aria-label="Remove">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {tools.length ? (
        <>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {L(locale, { ja: '何をしますか？', de: 'Was möchten Sie tun?', fr: 'Que voulez-vous faire ?', es: '¿Qué quieres hacer?', en: 'What do you want to do?', it: 'Cosa vuoi fare?', id: 'Apa yang ingin Anda lakukan?', pt: 'O que você quer fazer?' })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tools.map(([href, key], i) => (
              <button
                key={href}
                type="button"
                onClick={() => openToolWithFiles(router, href, files)}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  i === 0 ? 'bg-gray-950 text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {t(key)}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-red-600">
          {L(locale, { ja: 'このファイル形式には対応していません', de: 'Dieser Dateityp wird nicht unterstützt', fr: "Ce type de fichier n'est pas pris en charge", es: 'Este tipo de archivo no es compatible', en: "This file type isn't supported", it: 'Tipo di file non supportato', id: 'Jenis file ini tidak didukung', pt: 'Este tipo de arquivo não é compatível' })}
        </p>
      )}
    </div>
  )
}
