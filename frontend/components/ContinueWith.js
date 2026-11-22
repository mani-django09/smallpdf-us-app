// components/ContinueWith.js
// "Continue with this file" row on download pages: sends the result straight
// into the next tool, so the user doesn't have to download and re-upload it.
//
// Usage: <ContinueWith current="merge-pdf" blob={downloadedBlob}
//          getUrl={() => `${getApiUrl()}/api/...`} fileName="merged.pdf" />
//
// The file reaches the next tool through lib/pendingUpload (it fills that
// tool's own <input type="file">), so the tool's normal limits and checks run.
// ZIP results (several pages/images) are unpacked here and passed as a batch.
import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { unzipSync } from 'fflate'
import { useLocalizedRouter } from '../lib/useLocalizedRouter'
import { useTranslations } from '../lib/i18n'
import { toolLabel } from '../lib/toolLabel'
import { openToolWithFiles } from '../lib/pendingUpload'
import { filenameFromDisposition } from '../lib/fileActions'
import { getApiUrl } from '../lib/getApiUrl'

const PDF_NEXT = ['compress-pdf', 'merge-pdf', 'protect-pdf', 'split-pdf', 'rotate-pdf', 'edit-pdf']
const JPG_NEXT = ['compress-image', 'compress-image-to-50kb', 'jpg-to-pdf']
const PNG_NEXT = ['compress-image', 'png-to-webp', 'png-to-pdf']

export const CHAIN = {
  'merge-pdf':   ['compress-pdf', 'split-pdf', 'rotate-pdf', 'protect-pdf', 'edit-pdf', 'pdf-to-word'],
  'compress-pdf':['merge-pdf', 'split-pdf', 'protect-pdf', 'pdf-to-word', 'pdf-to-jpg', 'edit-pdf'],
  'split-pdf':   ['compress-pdf', 'merge-pdf', 'rotate-pdf', 'pdf-to-word', 'pdf-to-jpg', 'protect-pdf'],
  'rotate-pdf':  ['compress-pdf', 'merge-pdf', 'split-pdf', 'protect-pdf', 'pdf-to-word', 'edit-pdf'],
  'edit-pdf':    ['compress-pdf', 'protect-pdf', 'merge-pdf', 'redact-pdf', 'pdf-to-jpg', 'split-pdf'],
  'redact-pdf':  ['compress-pdf', 'protect-pdf', 'merge-pdf', 'pdf-to-jpg', 'split-pdf', 'edit-pdf'],
  'ocr-pdf':     ['pdf-to-word', 'pdf-to-excel', 'compress-pdf', 'redact-pdf', 'edit-pdf', 'merge-pdf'],
  'unlock-pdf':  ['edit-pdf', 'compress-pdf', 'merge-pdf', 'split-pdf', 'pdf-to-word', 'redact-pdf'],
  'word-to-pdf': PDF_NEXT, 'excel-to-pdf': PDF_NEXT, 'ppt-to-pdf': PDF_NEXT,
  'jpg-to-pdf':  PDF_NEXT, 'png-to-pdf': PDF_NEXT,
  'pdf-to-jpg':  JPG_NEXT, 'heic-to-jpg': JPG_NEXT,
  'pdf-to-png':  PNG_NEXT, 'heic-to-png': PNG_NEXT, 'webp-to-png': PNG_NEXT,
  'png-to-webp': ['compress-image', 'webp-to-png', 'jpg-to-pdf'],
  'compress-image': ['jpg-to-pdf', 'compress-image-to-50kb', 'compress-image-to-20kb'],
}

const TEXT = {
  en: ['Continue with this file', 'No need to download and upload it again.', "Couldn't load the file. Please download it and upload it to the next tool."],
  hi: ['इसी फ़ाइल के साथ आगे बढ़ें', 'डाउनलोड करके दोबारा अपलोड करने की ज़रूरत नहीं।', 'फ़ाइल लोड नहीं हो सकी। कृपया इसे डाउनलोड करके अगले टूल में अपलोड करें।'],
  ja: ['このファイルで続ける', 'ダウンロードして再アップロードする必要はありません。', 'ファイルを読み込めませんでした。ダウンロードして次のツールにアップロードしてください。'],
  de: ['Mit dieser Datei weitermachen', 'Kein erneutes Herunter- und Hochladen nötig.', 'Die Datei konnte nicht geladen werden. Bitte laden Sie sie herunter und im nächsten Tool hoch.'],
  fr: ['Continuer avec ce fichier', 'Inutile de le télécharger puis de le réimporter.', "Impossible de charger le fichier. Téléchargez-le puis importez-le dans l'outil suivant."],
  es: ['Continuar con este archivo', 'No hace falta descargarlo y volver a subirlo.', 'No se pudo cargar el archivo. Descárgalo y súbelo a la siguiente herramienta.'],
  it: ['Continua con questo file', 'Non serve scaricarlo e caricarlo di nuovo.', 'Impossibile caricare il file. Scaricalo e caricalo nello strumento successivo.'],
  id: ['Lanjutkan dengan file ini', 'Tidak perlu mengunduh dan mengunggahnya lagi.', 'File tidak dapat dimuat. Silakan unduh lalu unggah ke alat berikutnya.'],
  pt: ['Continuar com este arquivo', 'Não precisa baixar e enviar de novo.', 'Não foi possível carregar o arquivo. Baixe-o e envie para a próxima ferramenta.'],
  vi: ['Tiếp tục với tệp này', 'Không cần tải xuống rồi tải lên lại.', 'Không thể tải tệp. Vui lòng tải xuống và tải lên công cụ tiếp theo.'],
  ar: ['تابع بهذا الملف', 'لا حاجة لتنزيله ورفعه مرة أخرى.', 'تعذّر تحميل الملف. يُرجى تنزيله ثم رفعه إلى الأداة التالية.'],
  tr: ['Bu dosyayla devam edin', 'İndirip yeniden yüklemenize gerek yok.', 'Dosya yüklenemedi. Lütfen indirip sonraki araca yükleyin.'],
  ru: ['Продолжить с этим файлом', 'Не нужно скачивать и загружать его заново.', 'Не удалось загрузить файл. Скачайте его и загрузите в следующий инструмент.'],
  pl: ['Kontynuuj z tym plikiem', 'Nie musisz go pobierać i wgrywać od nowa.', 'Nie udało się wczytać pliku. Pobierz go i wgraj do następnego narzędzia.'],
}

const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const extOf = (name) => (name.split('.').pop() || '').toLowerCase()

async function resultFiles(blob, url, fallbackName) {
  let name = fallbackName || 'file'
  if (!blob) {
    if (!url) throw new Error('no url')
    const res = await fetch(/^https?:/.test(url) ? url : `${getApiUrl()}${url}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    name = filenameFromDisposition(res.headers.get('content-disposition'), name)
    blob = await res.blob()
  }
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  if (!isZip) {
    const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : (MIME[extOf(name)] || '')
    return [new File([blob], name, { type })]
  }
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  return Object.keys(entries)
    .filter((p) => !p.endsWith('/') && MIME[extOf(p)])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((p) => new File([entries[p]], p.split('/').pop(), { type: MIME[extOf(p)] }))
}

export default function ContinueWith({ current, blob, getUrl, fileName }) {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(false)
  const targets = CHAIN[current]
  if (!targets) return null
  const [title, sub, errText] = TEXT[router.locale] || TEXT.en

  const go = async (slug) => {
    setBusy(slug); setError(false)
    try {
      const files = await resultFiles(blob, getUrl && getUrl(), fileName)
      if (!files.length) throw new Error('empty')
      openToolWithFiles(router, `/${slug}`, files)
    } catch (err) {
      console.error('Continue with file failed:', err)
      setError(true); setBusy(null)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mb-3 text-xs text-slate-600">{sub}</p>
      <div className="flex flex-wrap gap-2">
        {targets.map((slug) => (
          <button
            key={slug}
            type="button"
            onClick={() => go(slug)}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-60"
          >
            {toolLabel(t, slug.replace('compress-image-to-', 'compress-image-'))}
            {busy === slug
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600" role="alert">{errText}</p>}
    </div>
  )
}
