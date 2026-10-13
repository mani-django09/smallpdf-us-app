import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { getPageMessages } from "../../lib/i18nLoader"
import {
  FileText,
  ArrowLeft,
  Play,
  Trash2,
  FileSpreadsheet,
} from "lucide-react"
import AdSenseUnit from "../../components/AdSenseUnit"
import LoadingPromo from "../../components/LoadingPromo"
import { getApiUrl } from "../../lib/getApiUrl"
import useDailyLimit from '../../hooks/useDailyLimit'
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { pdfToExcelStore } from "./index"
import AdLabel from "../../components/AdLabel"
import { goToDownload } from "../../lib/fullPageNav"


// ── i18n translations ──────────────────────────────────────────────────────────
const translations = {
  en: {
    pageTitle: "Preview & Convert - PDF to Excel | SmallPDF.us",
    previewHeader: "Convert PDF to Excel",
    previewChangeFile: "Change File",
    previewFilesTitle: "PDF Files Ready to Convert",
    previewFilesSubtitle: "Review your files below",
    previewSelectAll: "Select all",
    previewDeselectAll: "Deselect all",
    previewConvertButton: "Convert {count} PDF{plural} to Excel",
    previewWaitText: "Please wait while we extract tables from your PDF...",
    previewConversionDetailsTitle: "Conversion Details",
    previewInputFormat: "Input Format",
    previewOutputFormat: "Output Format",
    previewFilesSelected: "Files Selected",
    previewTotalSize: "Total Size",
    previewWhatYouGetTitle: "What You'll Get",
    previewWhatYouGet1: "Editable Excel spreadsheet",
    previewWhatYouGet2: "Tables extracted accurately",
    previewWhatYouGet3: "Formatting preserved",
    previewWhatYouGet4: "Ready in seconds",
    previewSecurityTitle: "Your Data is Safe",
    previewSecurity1: "256-bit SSL encryption",
    previewSecurity2: "Files auto-deleted in 1 hour",
    previewSecurity3: "No data stored permanently",
    previewSecurity4: "GDPR compliant",
    previewStage1: "Preparing PDF files...",
    previewStage2: "Analyzing PDF structure...",
    previewStage3: "Detecting tables...",
    previewStage4: "Extracting data...",
    previewStage5: "Converting to Excel format...",
    previewStage6: "Generating spreadsheet...",
    previewStage7: "Finalizing...",
    previewStageComplete: "Complete!",
    previewLoadingText: "Loading files...",
    previewRemoveFile: "Remove file",
    conversionFailedAlert: "Conversion failed: ",
    conversionErrorAlert: "Failed to convert files: ",
  },
  ja: {
    pageTitle: "プレビューと変換 - PDFからExcel | SmallPDF.us",
    previewHeader: "PDFをExcelに変換",
    previewChangeFile: "ファイルを変更",
    previewFilesTitle: "変換準備完了のPDFファイル",
    previewFilesSubtitle: "以下のファイルを確認してください",
    previewSelectAll: "すべて選択",
    previewDeselectAll: "選択を解除",
    previewConvertButton: "{count}件のPDFをExcelに変換",
    previewWaitText: "PDFから表を抽出中です。しばらくお待ちください...",
    previewConversionDetailsTitle: "変換の詳細",
    previewInputFormat: "入力形式",
    previewOutputFormat: "出力形式",
    previewFilesSelected: "選択ファイル数",
    previewTotalSize: "合計サイズ",
    previewWhatYouGetTitle: "提供される機能",
    previewWhatYouGet1: "編集可能なExcelスプレッドシート",
    previewWhatYouGet2: "高精度な表の抽出",
    previewWhatYouGet3: "書式を保持",
    previewWhatYouGet4: "数秒で完了",
    previewSecurityTitle: "データは安全です",
    previewSecurity1: "256ビットSSL暗号化",
    previewSecurity2: "ファイルは1時間後に自動削除",
    previewSecurity3: "データは永続的に保存されません",
    previewSecurity4: "GDPR準拠",
    previewStage1: "PDFファイルを準備中...",
    previewStage2: "PDF構造を解析中...",
    previewStage3: "表を検出中...",
    previewStage4: "データを抽出中...",
    previewStage5: "Excel形式に変換中...",
    previewStage6: "スプレッドシートを生成中...",
    previewStage7: "最終処理中...",
    previewStageComplete: "完了！",
    previewLoadingText: "ファイルを読み込み中...",
    previewRemoveFile: "ファイルを削除",
    conversionFailedAlert: "変換に失敗しました: ",
    conversionErrorAlert: "ファイルの変換に失敗しました: ",
  },
  fr: {
    pageTitle: "Aperçu et conversion – PDF en Excel | SmallPDF.us",
    previewHeader: "Convertir PDF en Excel",
    previewChangeFile: "Changer de fichier",
    previewFilesTitle: "Fichiers PDF prêts à convertir",
    previewFilesSubtitle: "Vérifiez vos fichiers ci-dessous",
    previewSelectAll: "Tout sélectionner",
    previewDeselectAll: "Désélectionner tout",
    previewConvertButton: "Convertir {count} PDF en Excel",
    previewWaitText: "Veuillez patienter pendant l’extraction des tableaux de votre PDF...",
    previewConversionDetailsTitle: "Détails de la conversion",
    previewInputFormat: "Format d’entrée",
    previewOutputFormat: "Format de sortie",
    previewFilesSelected: "Fichiers sélectionnés",
    previewTotalSize: "Taille totale",
    previewWhatYouGetTitle: "Ce que vous obtiendrez",
    previewWhatYouGet1: "Feuille de calcul Excel modifiable",
    previewWhatYouGet2: "Tableaux extraits avec précision",
    previewWhatYouGet3: "Mise en forme préservée",
    previewWhatYouGet4: "Prêt en quelques secondes",
    previewSecurityTitle: "Vos données sont sécurisées",
    previewSecurity1: "Chiffrement SSL 256 bits",
    previewSecurity2: "Fichiers supprimés automatiquement en 1 heure",
    previewSecurity3: "Aucune donnée stockée de façon permanente",
    previewSecurity4: "Conforme au RGPD",
    previewStage1: "Préparation des fichiers PDF...",
    previewStage2: "Analyse de la structure PDF...",
    previewStage3: "Détection des tableaux...",
    previewStage4: "Extraction des données...",
    previewStage5: "Conversion au format Excel...",
    previewStage6: "Génération de la feuille de calcul...",
    previewStage7: "Finalisation...",
    previewStageComplete: "Terminé !",
    previewLoadingText: "Chargement des fichiers...",
    previewRemoveFile: "Supprimer le fichier",
    conversionFailedAlert: "Échec de la conversion : ",
    conversionErrorAlert: "Échec de la conversion des fichiers : ",
  },
  es: {
    pageTitle: "Vista previa y conversión – PDF a Excel | SmallPDF.us",
    previewHeader: "Convertir PDF a Excel",
    previewChangeFile: "Cambiar archivo",
    previewFilesTitle: "Archivos PDF listos para convertir",
    previewFilesSubtitle: "Revisa tus archivos a continuación",
    previewSelectAll: "Seleccionar todo",
    previewDeselectAll: "Deseleccionar todo",
    previewConvertButton: "Convertir {count} PDF a Excel",
    previewWaitText: "Por favor espera mientras extraemos las tablas de tu PDF...",
    previewConversionDetailsTitle: "Detalles de la conversión",
    previewInputFormat: "Formato de entrada",
    previewOutputFormat: "Formato de salida",
    previewFilesSelected: "Archivos seleccionados",
    previewTotalSize: "Tamaño total",
    previewWhatYouGetTitle: "Lo que obtendrás",
    previewWhatYouGet1: "Hoja de cálculo Excel editable",
    previewWhatYouGet2: "Tablas extraídas con precisión",
    previewWhatYouGet3: "Formato preservado",
    previewWhatYouGet4: "Listo en segundos",
    previewSecurityTitle: "Tus datos están seguros",
    previewSecurity1: "Cifrado SSL de 256 bits",
    previewSecurity2: "Archivos eliminados automáticamente en 1 hora",
    previewSecurity3: "Sin almacenamiento permanente de datos",
    previewSecurity4: "Cumple con el RGPD",
    previewStage1: "Preparando archivos PDF...",
    previewStage2: "Analizando estructura del PDF...",
    previewStage3: "Detectando tablas...",
    previewStage4: "Extrayendo datos...",
    previewStage5: "Convirtiendo a formato Excel...",
    previewStage6: "Generando hoja de cálculo...",
    previewStage7: "Finalizando...",
    previewStageComplete: "¡Completado!",
    previewLoadingText: "Cargando archivos...",
    previewRemoveFile: "Eliminar archivo",
    conversionFailedAlert: "Error en la conversión: ",
    conversionErrorAlert: "Error al convertir los archivos: ",
  },
  de: {
    pageTitle: "Vorschau & Konvertierung – PDF in Excel | SmallPDF.us",
    previewHeader: "PDF in Excel konvertieren",
    previewChangeFile: "Datei ändern",
    previewFilesTitle: "PDF-Dateien bereit zur Konvertierung",
    previewFilesSubtitle: "Überprüfen Sie Ihre Dateien unten",
    previewSelectAll: "Alle auswählen",
    previewDeselectAll: "Auswahl aufheben",
    previewConvertButton: "{count} PDF(s) in Excel konvertieren",
    previewWaitText: "Bitte warten, während wir Tabellen aus Ihrer PDF extrahieren...",
    previewConversionDetailsTitle: "Konvertierungsdetails",
    previewInputFormat: "Eingabeformat",
    previewOutputFormat: "Ausgabeformat",
    previewFilesSelected: "Ausgewählte Dateien",
    previewTotalSize: "Gesamtgröße",
    previewWhatYouGetTitle: "Was Sie erhalten",
    previewWhatYouGet1: "Bearbeitbare Excel-Tabelle",
    previewWhatYouGet2: "Tabellen präzise extrahiert",
    previewWhatYouGet3: "Formatierung erhalten",
    previewWhatYouGet4: "In Sekunden fertig",
    previewSecurityTitle: "Ihre Daten sind sicher",
    previewSecurity1: "256-Bit-SSL-Verschlüsselung",
    previewSecurity2: "Dateien werden nach 1 Stunde automatisch gelöscht",
    previewSecurity3: "Keine dauerhafte Datenspeicherung",
    previewSecurity4: "DSGVO-konform",
    previewStage1: "PDF-Dateien werden vorbereitet...",
    previewStage2: "PDF-Struktur wird analysiert...",
    previewStage3: "Tabellen werden erkannt...",
    previewStage4: "Daten werden extrahiert...",
    previewStage5: "In Excel-Format wird konvertiert...",
    previewStage6: "Tabellenkalkulation wird generiert...",
    previewStage7: "Wird abgeschlossen...",
    previewStageComplete: "Abgeschlossen!",
    previewLoadingText: "Dateien werden geladen...",
    previewRemoveFile: "Datei entfernen",
    conversionFailedAlert: "Konvertierung fehlgeschlagen: ",
    conversionErrorAlert: "Fehler beim Konvertieren der Dateien: ",
  },
  it: {
    pageTitle: "Anteprima e converti - Da PDF a Excel | SmallPDF.us",
    previewHeader: "Converti PDF in Excel",
    previewChangeFile: "Cambia file",
    previewFilesTitle: "File PDF pronti per la conversione",
    previewFilesSubtitle: "Controlla i tuoi file qui sotto",
    previewSelectAll: "Seleziona tutto",
    previewDeselectAll: "Deseleziona tutto",
    previewConvertButton: "Converti {count} PDF in Excel",
    previewWaitText: "Attendere mentre estraiamo le tabelle dal tuo PDF...",
    previewConversionDetailsTitle: "Dettagli della conversione",
    previewInputFormat: "Formato di input",
    previewOutputFormat: "Formato di output",
    previewFilesSelected: "File selezionati",
    previewTotalSize: "Dimensione totale",
    previewWhatYouGetTitle: "Cosa otterrai",
    previewWhatYouGet1: "Foglio Excel modificabile",
    previewWhatYouGet2: "Tabelle estratte con precisione",
    previewWhatYouGet3: "Formattazione preservata",
    previewWhatYouGet4: "Pronto in pochi secondi",
    previewSecurityTitle: "I tuoi dati sono al sicuro",
    previewSecurity1: "Crittografia SSL a 256 bit",
    previewSecurity2: "File eliminati automaticamente in 1 ora",
    previewSecurity3: "Nessun dato archiviato in modo permanente",
    previewSecurity4: "Conforme al GDPR",
    previewStage1: "Preparazione dei file PDF...",
    previewStage2: "Analisi della struttura PDF...",
    previewStage3: "Rilevamento delle tabelle...",
    previewStage4: "Estrazione dei dati...",
    previewStage5: "Conversione in formato Excel...",
    previewStage6: "Generazione del foglio di calcolo...",
    previewStage7: "Finalizzazione...",
    previewStageComplete: "Completato!",
    previewLoadingText: "Caricamento file...",
    previewRemoveFile: "Rimuovi file",
    conversionFailedAlert: "Conversione fallita: ",
    conversionErrorAlert: "Errore durante la conversione dei file: ",
  },
  id: {
    pageTitle: "Pratinjau & Konversi - PDF ke Excel | SmallPDF.us",
    previewHeader: "Konversi PDF ke Excel",
    previewChangeFile: "Ganti File",
    previewFilesTitle: "File PDF Siap Dikonversi",
    previewFilesSubtitle: "Tinjau file Anda di bawah ini",
    previewSelectAll: "Pilih semua",
    previewDeselectAll: "Batalkan semua pilihan",
    previewConvertButton: "Konversi {count} PDF ke Excel",
    previewWaitText: "Harap tunggu sementara kami mengekstrak tabel dari PDF Anda...",
    previewConversionDetailsTitle: "Detail Konversi",
    previewInputFormat: "Format Input",
    previewOutputFormat: "Format Output",
    previewFilesSelected: "File Dipilih",
    previewTotalSize: "Total Ukuran",
    previewWhatYouGetTitle: "Yang Akan Anda Dapatkan",
    previewWhatYouGet1: "Spreadsheet Excel yang dapat diedit",
    previewWhatYouGet2: "Tabel diekstrak dengan akurat",
    previewWhatYouGet3: "Format dipertahankan",
    previewWhatYouGet4: "Siap dalam hitungan detik",
    previewSecurityTitle: "Data Anda Aman",
    previewSecurity1: "Enkripsi SSL 256-bit",
    previewSecurity2: "File dihapus otomatis dalam 1 jam",
    previewSecurity3: "Tidak ada data yang disimpan secara permanen",
    previewSecurity4: "Sesuai GDPR",
    previewStage1: "Menyiapkan file PDF...",
    previewStage2: "Menganalisis struktur PDF...",
    previewStage3: "Mendeteksi tabel...",
    previewStage4: "Mengekstrak data...",
    previewStage5: "Mengkonversi ke format Excel...",
    previewStage6: "Membuat spreadsheet...",
    previewStage7: "Menyelesaikan...",
    previewStageComplete: "Selesai!",
    previewLoadingText: "Memuat file...",
    previewRemoveFile: "Hapus file",
    conversionFailedAlert: "Konversi gagal: ",
    conversionErrorAlert: "Gagal mengkonversi file: ",
  },
}
// ──────────────────────────────────────────────────────────────────────────────

export default function PreviewPdfToExcel() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { locale } = router
  const t = translations[locale] || translations.en

  const [filesData, setFilesData] = useState([])
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [error, setError] = useState("")
  const { handleApiError, PremiumGateModal } = useFileSizeGuard("pdf-to-excel")

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    // Files live in memory (pdfToExcelStore) — the old base64-in-sessionStorage
    // copy overflowed the ~5 MB quota for PDFs over ~3.7 MB, so "Convert" on
    // the upload page silently did nothing. After a reload the files are gone,
    // so go back to the upload page instead of showing an unconvertible list.
    if (pdfToExcelStore.files.length > 0) {
      setFilesData(pdfToExcelStore.files)
      setSelectedFiles(pdfToExcelStore.files.map((f) => f.id))
    } else {
      routerRef.current.push("/pdf-to-excel")
    }
  }, [])

  const toggleFileSelection = (id) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id],
    )
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    setSelectedFiles((prev) => prev.filter((fid) => fid !== id))
    pdfToExcelStore.files = newFiles

    if (newFiles.length === 0) {
      router.push("/pdf-to-excel")
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    }
    return (bytes / 1024).toFixed(1) + " KB"
  }

  const handleConvert = async () => {
    const filesToConvert = filesData.filter((f) => selectedFiles.includes(f.id))
    if (filesToConvert.length === 0) return

    setConverting(true)
    setError("")
    setProgress(0)
    setStage(t.previewStage1)

    const stages = [
      { progress: 15, text: t.previewStage2, delay: 500 },
      { progress: 30, text: t.previewStage3, delay: 600 },
      { progress: 50, text: t.previewStage4, delay: 700 },
      { progress: 70, text: t.previewStage5, delay: 600 },
      { progress: 85, text: t.previewStage6, delay: 400 },
      { progress: 95, text: t.previewStage7, delay: 300 },
    ]

    let currentStage = 0
    let stopped = false
    const updateProgress = () => {
      if (!stopped && currentStage < stages.length) {
        setProgress(stages[currentStage].progress)
        setStage(stages[currentStage].text)
        currentStage++
        setTimeout(updateProgress, stages[currentStage - 1].delay)
      }
    }
    updateProgress()

    try {
      const formData = new FormData()

      for (const fileData of filesToConvert) {
        formData.append("files", fileData.file, fileData.name)
      }

      const apiUrl = getApiUrl()
      const convertResponse = await fetch(`${apiUrl}/api/pdf-to-excel`, {
        method: "POST",
        body: formData,
      })

      // A proxy error page (413/502) is HTML, not JSON.
      const result = await convertResponse.json().catch(() => ({}))
      // Limit modals take over — put the page back so the user can continue.
      if (handleDailyLimitError(convertResponse.status, result) || handleApiError(convertResponse, result)) {
        stopped = true; setConverting(false); setProgress(0); setStage(""); return
      }

      if (convertResponse.ok) {
        stopped = true
        setProgress(100)
        setStage(t.previewStageComplete)
        sessionStorage.setItem(
          "pdfToExcelConvertResult",
          JSON.stringify({
            ...result,
            fileCount: filesToConvert.length,
            totalSize: filesToConvert.reduce((acc, f) => acc + f.size, 0),
          }),
        )
        setTimeout(() => {
          goToDownload(router, `/pdf-to-excel/download?jobId=${result.jobId}`)
        }, 500)
      } else {
        // Shown on the page (these used to be English alert() pop-ups).
        console.error("Conversion failed:", result)
        stopped = true
        setError(result.message || (t.conversionFailedAlert + (result.error || convertResponse.status)))
        setConverting(false); setProgress(0); setStage("")
      }
    } catch (error) {
      console.error("Error:", error)
      stopped = true
      setError((t.conversionErrorAlert || "Conversion error: ") + (error.message || ""))
      setConverting(false); setProgress(0); setStage("")
    }
  }

  const totalSize = filesData.reduce((acc, f) => acc + f.size, 0)
  const selectedCount = selectedFiles.length

  if (filesData.length === 0) {
    return (
      <Layout>
        <SEOHead title={t.pageTitle} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-blue-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t.previewLoadingText}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={t.pageTitle}>
      {/* noIndex=true — preview is a transient post-upload page with no static content for search engines */}
      <SEOHead title={t.pageTitle} noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Manrope', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/pdf-to-excel")}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-body text-sm font-medium">{t.previewChangeFile}</span>
              </button>
            </div>
            <h1 className="font-display text-xl font-bold text-white">{t.previewHeader}</h1>
            <div className="w-24" />
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 sm:px-6 lg:px-8 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" size="leaderboard" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* File List Panel */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Panel Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      {t.previewFilesTitle}
                    </h2>
                    <p className="font-body text-sm text-slate-500">{t.previewFilesSubtitle}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedFiles(filesData.map((f) => f.id))}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {t.previewSelectAll}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {t.previewDeselectAll}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {filesData.map((file) => (
                    <div
                      key={file.id}
                      className={`p-4 flex items-center gap-4 transition-colors ${
                        selectedFiles.includes(file.id) ? "bg-blue-50/50" : "hover:bg-slate-50"
                      }`}
                    >
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </label>

                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center shadow-md">
                          <FileText className="w-7 h-7 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-600 rounded-md flex items-center justify-center">
                          <FileSpreadsheet className="w-3 h-3 text-white" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-body font-medium text-slate-900 truncate">{file.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-body text-sm text-slate-500">{formatFileSize(file.size)}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                            PDF
                          </span>
                          <span className="text-slate-300">→</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            XLSX
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title={t.previewRemoveFile}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Convert Button */}
                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  {converting ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-body text-sm font-medium text-slate-700">{stage}</span>
                        <span className="font-display font-semibold text-blue-600">{progress}%</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <p className="font-body text-xs text-slate-500 text-center">{t.previewWaitText}</p>
                      <div className="flex justify-center">
                        <LoadingPromo />
                      </div>
                    </div>
                  ) : (
                    <>
                    {error && (
                      <div role="alert" className="mb-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3">
                        {error}
                      </div>
                    )}
                    <button
                      onClick={handleConvert}
                      disabled={selectedCount === 0}
                      className={`w-full py-4 rounded-xl font-display font-semibold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                        selectedCount > 0
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <Play className="w-5 h-5" />
                      <span>
                        {t.previewConvertButton
                          .replace("{count}", selectedCount)
                          .replace("{plural}", selectedCount !== 1 ? "s" : "")}
                      </span>
                    </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Sidebar Ad */}
              <div className="hidden lg:block bg-white rounded-2xl shadow-lg p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide"><AdLabel /></p>
                <AdSenseUnit adSlot="1617102171" />
              </div>

              {/* Sidebar Ad 2 */}
              <div className="hidden lg:block bg-white rounded-2xl shadow-lg p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide"><AdLabel /></p>
                <AdSenseUnit adSlot="1617102171" size="rectangle2" />
              </div>

            </div>
          </div>
        </div>
      </div>
      {DailyLimitGate}
      {PremiumGateModal}
    </Layout>
  )
}

// Layout renders nav/login/etc via t('nav.*') / t('layout.*') — those live in
// common.json, which getPageMessages always loads regardless of the namespace
// list. Without this, TranslationsProvider gets messages=undefined and every
// t() call on this page falls back to printing the raw key (e.g. "nav.pricing").
export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, []) },
    revalidate: 86400,
  }
}