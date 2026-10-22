import { useState, useEffect, useRef } from "react"
import { mergePdfStore } from "./index"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { FileText, ArrowLeft, Play, Layers, GripVertical, Trash2 } from "lucide-react"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { useAuth } from "../../context/AuthContext"
import AdSenseUnit from "../../components/AdSenseUnit"
import PromoBanner from "../../components/PromoBanner"
import { usePdfThumbnail } from "../../hooks/usePdfThumbnail"
import useDailyLimit from "../../hooks/useDailyLimit"
import { goToDownload } from "../../lib/fullPageNav"

// Inline translations for strings not yet in JSON files
const INLINE_T = {
  filesSelected: {
    en: "{n} PDF Files Selected", ja: "{n}個のPDFファイルを選択",
    de: "{n} PDF-Dateien ausgewählt", fr: "{n} fichiers PDF sélectionnés",
    es: "{n} archivos PDF seleccionados", it: "{n} file PDF selezionati",
    id: "{n} file PDF dipilih", pt: "{n} arquivos PDF selecionados",
  },
  totalSize: {
    en: "Total: {size} MB", ja: "合計: {size} MB", de: "Gesamt: {size} MB",
    fr: "Total : {size} Mo", es: "Total: {size} MB", it: "Totale: {size} MB",
    id: "Total: {size} MB", pt: "Total: {size} MB",
  },
  errPassword: {
    en: "\"{name}\" is protected with an open password. Remove it with our Unlock PDF tool first, then merge again.",
    de: "„{name}“ ist mit einem Öffnungspasswort geschützt. Entfernen Sie es zuerst mit unserem Tool „PDF entsperren“ und führen Sie die Dateien dann erneut zusammen.",
    fr: "« {name} » est protégé par un mot de passe d'ouverture. Supprimez-le d'abord avec notre outil Déverrouiller un PDF, puis fusionnez à nouveau.",
    es: "\"{name}\" está protegido con una contraseña de apertura. Quítala primero con nuestra herramienta Desbloquear PDF y vuelve a unir los archivos.",
    it: "\"{name}\" è protetto da una password di apertura. Rimuovila prima con il nostro strumento Sblocca PDF, poi unisci di nuovo.",
    id: "\"{name}\" dilindungi kata sandi pembuka. Hapus dulu dengan alat Buka Kunci PDF kami, lalu gabungkan lagi.",
    pt: "\"{name}\" está protegido por uma senha de abertura. Remova-a primeiro com nossa ferramenta Desbloquear PDF e depois junte novamente.",
    ja: "「{name}」は開くためのパスワードで保護されています。先に「PDFロック解除」ツールでパスワードを解除してから、もう一度結合してください。",
  },
  errCorrupt: {
    en: "Could not read \"{name}\". The file may be damaged — try re-saving or re-downloading it.",
    de: "„{name}“ konnte nicht gelesen werden. Die Datei ist möglicherweise beschädigt – speichern oder laden Sie sie erneut herunter.",
    fr: "Impossible de lire « {name} ». Le fichier est peut-être endommagé : réenregistrez-le ou téléchargez-le à nouveau.",
    es: "No se pudo leer \"{name}\". Es posible que el archivo esté dañado: vuelve a guardarlo o descargarlo.",
    it: "Impossibile leggere \"{name}\". Il file potrebbe essere danneggiato: salvalo o scaricalo di nuovo.",
    id: "Tidak dapat membaca \"{name}\". File mungkin rusak — coba simpan ulang atau unduh ulang.",
    pt: "Não foi possível ler \"{name}\". O arquivo pode estar danificado — tente salvá-lo ou baixá-lo novamente.",
    ja: "「{name}」を読み込めませんでした。ファイルが破損している可能性があります。保存し直すか、再度ダウンロードしてください。",
  },
  errGeneric: {
    en: "Merging failed. Please try again in a moment.", de: "Zusammenführen fehlgeschlagen. Bitte versuchen Sie es gleich noch einmal.",
    fr: "La fusion a échoué. Veuillez réessayer dans un instant.", es: "No se pudo unir. Inténtalo de nuevo en un momento.",
    it: "Unione non riuscita. Riprova tra un momento.", id: "Penggabungan gagal. Silakan coba lagi sebentar lagi.",
    pt: "Falha ao juntar. Tente novamente em instantes.", ja: "結合に失敗しました。しばらくしてからもう一度お試しください。",
  },
  loading: {
    en: "Loading...", ja: "読み込み中...", de: "Wird geladen...",
    fr: "Chargement...", es: "Cargando...", it: "Caricamento...",
    id: "Memuat...", pt: "Carregando...",
  },
}

export default function PreviewMergePDF() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const { authFetch } = useAuth()

  // Helper: pick the right locale from INLINE_T, fall back to English
  const ti = (key, replacements = {}) => {
    let str = INLINE_T[key]?.[locale] ?? INLINE_T[key]?.en ?? key
    for (const [k, v] of Object.entries(replacements)) {
      str = str.replace(`{${k}}`, v)
    }
    return str
  }
  const [filesData, setFilesData] = useState([])
  const [merging, setMerging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [error, setError] = useState("")
  // First-page thumbnails for preview-before-merge, keyed by file id.
  const [thumbs, setThumbs] = useState({})
  const { ready: pdfReady, generateThumbnail } = usePdfThumbnail()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()

  // ✅ FIX: Use a ref for router inside useEffect to avoid infinite re-render loop.
  // useLocalizedRouter() returns a new object each render, so putting it in the
  // dependency array causes: effect runs → router changes → effect runs → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    // Read from in-memory store (File objects, no base64 bloat)
    if (mergePdfStore.files.length >= 2) {
      setFilesData(mergePdfStore.files.map(f => ({ id: f.id, name: f.name, size: f.size })))
    } else {
      routerRef.current.push("/merge-pdf")
    }
  }, []) // ✅ Empty deps — runs once on mount only

  // Generate first-page thumbnails once PDF.js is ready (preview before merge).
  useEffect(() => {
    if (!pdfReady || mergePdfStore.files.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const entry of mergePdfStore.files) {
        if (cancelled || thumbs[entry.id]) continue
        const { thumbnail, pageCount } = await generateThumbnail(entry.file)
        if (cancelled) return
        setThumbs((prev) => ({ ...prev, [entry.id]: { thumbnail, pageCount } }))
      }
    })()
    return () => { cancelled = true }
  }, [pdfReady, filesData, generateThumbnail]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReorder = (fromIndex, toIndex) => {
    const newMeta = [...filesData]
    const [removedMeta] = newMeta.splice(fromIndex, 1)
    newMeta.splice(toIndex, 0, removedMeta)
    setFilesData(newMeta)

    // Keep store in sync
    const newStore = [...mergePdfStore.files]
    const [removedFile] = newStore.splice(fromIndex, 1)
    newStore.splice(toIndex, 0, removedFile)
    mergePdfStore.files = newStore
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    handleReorder(draggedIndex, index)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const removeFile = (id) => {
    const newMeta = filesData.filter((f) => f.id !== id)
    setFilesData(newMeta)
    mergePdfStore.files = mergePdfStore.files.filter((f) => f.id !== id)

    if (newMeta.length < 2) {
      router.push("/merge-pdf")
    }
  }

  const handleMerge = async () => {
    if (filesData.length < 2) return

    setMerging(true)
    setProgress(0)
    setStage(t('mergePdf.preview.stages.preparing'))
    setError("")

    const stages = [
      { progress: 15, text: t('mergePdf.preview.stages.uploading'), delay: 400 },
      { progress: 35, text: t('mergePdf.preview.stages.processing'), delay: 500 },
      { progress: 55, text: t('mergePdf.preview.stages.combining'), delay: 600 },
      { progress: 75, text: t('mergePdf.preview.stages.optimizing'), delay: 400 },
      { progress: 90, text: t('mergePdf.preview.stages.finalizing'), delay: 300 },
    ]

    let currentStage = 0
    const updateProgress = () => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage].progress)
        setStage(stages[currentStage].text)
        currentStage++
        setTimeout(updateProgress, stages[currentStage - 1].delay)
      }
    }
    updateProgress()

    function getApiUrl() {
      if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      const { hostname, protocol } = window.location
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      }
      return `${protocol}//${hostname}`
    }

    try {
      const formData = new FormData()

      // Use File objects directly from in-memory store — no base64 conversion needed
      for (const fileEntry of mergePdfStore.files) {
        formData.append("files", fileEntry.file, fileEntry.name)
      }

      const API_URL = getApiUrl()

      const mergeResponse = await authFetch(`${API_URL}/api/merge-pdf`, {
        method: "POST",
        body: formData,
      })

      if (!mergeResponse.ok) {
        let body = null
        let errorText = ''
        try {
          const cloned = mergeResponse.clone()
          body = await cloned.json()
        } catch (_) {
          errorText = await mergeResponse.text()
        }
        if (handleDailyLimitError(mergeResponse.status, body)) return  // daily limit modal
        console.error('Merge failed:', mergeResponse.status, body || errorText.slice(0, 300))
        // Show a readable, localized message — this used to dump the raw JSON body.
        if (body?.error === 'PASSWORD_PROTECTED') throw new Error(ti('errPassword', { name: body.fileName || '' }))
        if (body?.error === 'CORRUPT_PDF') throw new Error(ti('errCorrupt', { name: body.fileName || '' }))
        throw new Error(body?.message && mergeResponse.status < 500 ? body.message : ti('errGeneric'))
      }

      const contentType = mergeResponse.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await mergeResponse.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        throw new Error(ti('errGeneric'))
      }

      const result = await mergeResponse.json()

      if (!result.success) {
        throw new Error(result.error || 'Merge failed')
      }

      setProgress(100)
      setStage(t('mergePdf.preview.stages.complete'))

      // Make downloadUrl absolute — works in dev (port 5011) and prod (same origin)
      const absoluteDownloadUrl = result.downloadUrl.startsWith('http')
        ? result.downloadUrl
        : `${API_URL}${result.downloadUrl}`

      sessionStorage.setItem(
        "mergeResult",
        JSON.stringify({
          ...result,
          downloadUrl: absoluteDownloadUrl,
          fileCount: filesData.length,
          totalSize: filesData.reduce((acc, f) => acc + f.size, 0),
        }),
      )
      
      setTimeout(() => {
        goToDownload(router, `/merge-pdf/download?file=${encodeURIComponent(absoluteDownloadUrl)}`)
      }, 500)
    } catch (error) {
      console.error("❌ Merge error:", error)
      setError(error.message)
      setMerging(false)
      setProgress(0)
      setStage("")
    }
  }

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)

  if (filesData.length === 0) {
    return (
      <Layout>
        <SEOHead
          title="Merge PDF - Preview | SmallPDF.us"
          description="Review and merge your PDF files into one document."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{ti('loading')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      title={t('mergePdf.preview.pageTitle')}
      description={t('mergePdf.preview.pageDescription')}
    >
      <SEOHead
        title="Merge PDF - Preview | SmallPDF.us"
        description="Review and merge your PDF files into one document."
        noIndex={true}
      />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="relative overflow-hidden bg-slate-50 border-b border-slate-200">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, #94a3b8 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-5">
          <button
            onClick={() => router.push("/merge-pdf")}
            className="mb-3 flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors text-xs font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t('mergePdf.preview.changeFiles')}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                {t('mergePdf.preview.reviewOrder').replace('{n}', filesData.length)}
              </h1>
              <p className="font-body text-xs text-slate-600">{t('mergePdf.preview.reviewOrder').replace('{n}', filesData.length)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-5">
        <div className="max-w-7xl mx-auto">
          <AdSenseUnit adSlot="8004544994" size="leaderboard" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-5">

            {/* Main Card */}
            <div className="lg:col-span-6 lg:col-start-1">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <Layers className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-semibold text-white">
                          {ti('filesSelected', { n: filesData.length })}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {ti('totalSize', { size: (totalSize / 1024 / 1024).toFixed(2) })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                      <span className="text-xs font-medium text-emerald-300">{t('mergePdf.preview.ready')}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {!merging ? (
                    <>
                      {/* Error Display */}
                      {error && (
                        <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-xl p-4">
                          <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                      )}

                      {/* File List */}
                      <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-display text-sm font-semibold text-slate-900">{t('mergePdf.preview.documentOrder')}</h3>
                          <span className="text-xs text-slate-500">{t('mergePdf.preview.dragToReorder')}</span>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {filesData.map((f, index) => (
                            <div
                              key={f.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 cursor-move hover:bg-slate-100 transition-colors ${
                                draggedIndex === index ? "opacity-50 scale-95" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <GripVertical className="w-4 h-4 text-slate-400" />
                                <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                  {index + 1}
                                </div>
                              </div>
                              {thumbs[f.id]?.thumbnail ? (
                                <img
                                  src={thumbs[f.id].thumbnail}
                                  alt={f.name}
                                  className="w-9 h-11 object-cover rounded border border-slate-300 bg-white flex-shrink-0 shadow-sm"
                                />
                              ) : (
                                <div className="w-9 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-white" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                                <p className="text-xs text-slate-500">
                                  {(f.size / 1024 / 1024).toFixed(2)} MB
                                  {thumbs[f.id]?.pageCount > 0 && ` · ${thumbs[f.id].pageCount} page${thumbs[f.id].pageCount > 1 ? "s" : ""}`}
                                </p>
                              </div>
                              <button
                                onClick={() => removeFile(f.id)}
                                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Merge Button */}
                      <button
                        onClick={handleMerge}
                        disabled={filesData.length < 2}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 px-6 rounded-xl font-display font-semibold text-sm hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        <span>{t('mergePdf.preview.mergeButton').replace('{n}', filesData.length)}</span>
                      </button>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mt-5">
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">{filesData.length}</div>
                          <div className="font-body text-xs text-slate-500">{t('mergePdf.preview.filesLabel')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-emerald-600">&lt;5s</div>
                          <div className="font-body text-xs text-slate-500">{t('mergePdf.preview.estTime')}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="font-display text-lg font-bold text-slate-900">100%</div>
                          <div className="font-body text-xs text-slate-500">{t('mergePdf.preview.qualityLabel')}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <div className="text-center mb-5">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-indigo-600 border-r-indigo-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 mb-0.5">{stage}</p>
                        <p className="font-body text-sm text-slate-600">{progress}{t('mergePdf.preview.percentComplete')}</p>
                      </div>

                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
                        <div
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                        <p className="font-body text-xs text-indigo-800 text-center">
                          {t('mergePdf.preview.combining').replace('{n}', filesData.length)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Sidebar Ad */}
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <PromoBanner slot={0} />
              </div>

              {/* Sidebar Ad 2 */}
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <PromoBanner slot={1} />
              </div>

            </div>
          </div>
        </div>
      </div>
      {DailyLimitGate}
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["mergePdf"]) },
    revalidate: 86400,
  }
}
