import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import {
  Download,
  FileSpreadsheet,
  CheckCircle,
  Share2,
  RefreshCw,
  Shield,
  Zap,
  Copy,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Lock,
  Timer,
  FileText,
  Table,
} from "lucide-react"

// Inline AdSense component
function AdSenseUnit({ adSlot, style = {} }) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch (err) {
      console.error("AdSense:", err)
    }
  }, [])
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block", ...style }}
      data-ad-client="ca-pub-6913093595582462"
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

// ── i18n translations ──────────────────────────────────────────────────────────
const translations = {
  en: {
    downloadTitle: "Download Excel Spreadsheet - SmallPDF.us",
    downloadDescription: "Download your converted PDF to Excel spreadsheet",
    downloadLoadingText: "Loading your Excel file...",
    downloadSuccessTitle: "PDF to Excel Conversion Complete!",
    downloadSuccessSubtitle: "{count} PDF{plural} converted to Excel successfully",
    readyToDownload: "Ready to Download",
    convertedFilesTitle: "Converted Files",
    fromLabel: "From: ",
    downloadButton: "Download Excel Spreadsheet",
    downloadAllButton: "Download All Excel Files (ZIP)",
    downloadingButton: "Preparing Download...",
    downloadComplete: "Downloaded Successfully!",
    filesLabel: "File{plural}",
    formatLabel: "Format",
    freeLabel: "Free",
    secureLabel: "Secure",
    editableLabel: "Editable",
    convertMore: "Convert More",
    summaryTitle: "Conversion Summary",
    summaryFilesConverted: "Files Converted",
    summaryInputFormat: "Input Format",
    summaryOutputFormat: "Output Format",
    summaryStatus: "Status",
    summaryComplete: "Complete",
    fileExpiryTitle: "File Expiry",
    fileExpirySubtitle: "Auto-delete for security",
    fileExpiryTimeRemaining: "Time remaining",
    privacyTitle: "Your Privacy",
    privacy1: "256-bit SSL encryption",
    privacy2: "Isolated server processing",
    privacy3: "Auto-delete after 1 hour",
    privacy4: "No data collection",
    downloadFeature1Title: "Editable Data",
    downloadFeature1Desc: "Fully editable cells",
    downloadFeature2Title: "Tables Extracted",
    downloadFeature2Desc: "AI-powered detection",
    downloadFeature3Title: "Secure & Private",
    downloadFeature3Desc: "Auto-deleted soon",
    downloadFeature4Title: "Ready to Use",
    downloadFeature4Desc: "Open in Excel/Sheets",
    moreToolsTitle: "Explore More Tools",
    moreTool1Name: "Excel to PDF",
    moreTool1Desc: "Convert spreadsheets to PDF",
    moreTool2Name: "PDF to Word",
    moreTool2Desc: "Convert to documents",
    moreTool3Name: "Merge PDF",
    moreTool3Desc: "Combine documents",
    tryNow: "Try now",
    downloadFailedAlert: "Failed to download file: ",
    shareTitle: "My Converted Excel Document",
    shareText: "Check out my converted PDF to Excel spreadsheet",
  },
  ja: {
    downloadTitle: "Excelスプレッドシートをダウンロード - SmallPDF.us",
    downloadDescription: "変換されたPDF→Excelスプレッドシートをダウンロード",
    downloadLoadingText: "Excelファイルを読み込み中...",
    downloadSuccessTitle: "PDFからExcelへの変換完了！",
    downloadSuccessSubtitle: "{count}件のPDFがExcelに正常に変換されました",
    readyToDownload: "ダウンロード準備完了",
    convertedFilesTitle: "変換済みファイル",
    fromLabel: "変換元: ",
    downloadButton: "Excelスプレッドシートをダウンロード",
    downloadAllButton: "すべてのExcelファイルをダウンロード（ZIP）",
    downloadingButton: "ダウンロードを準備中...",
    downloadComplete: "ダウンロード完了！",
    filesLabel: "ファイル",
    formatLabel: "形式",
    freeLabel: "無料",
    secureLabel: "安全",
    editableLabel: "編集可能",
    convertMore: "さらに変換",
    summaryTitle: "変換サマリー",
    summaryFilesConverted: "変換ファイル数",
    summaryInputFormat: "入力形式",
    summaryOutputFormat: "出力形式",
    summaryStatus: "ステータス",
    summaryComplete: "完了",
    fileExpiryTitle: "ファイルの有効期限",
    fileExpirySubtitle: "セキュリティのため自動削除",
    fileExpiryTimeRemaining: "残り時間",
    privacyTitle: "プライバシー保護",
    privacy1: "256ビットSSL暗号化",
    privacy2: "独立したサーバーで処理",
    privacy3: "1時間後に自動削除",
    privacy4: "データ収集なし",
    downloadFeature1Title: "編集可能なデータ",
    downloadFeature1Desc: "完全に編集可能なセル",
    downloadFeature2Title: "表を抽出済み",
    downloadFeature2Desc: "AI搭載の検出技術",
    downloadFeature3Title: "安全でプライベート",
    downloadFeature3Desc: "まもなく自動削除",
    downloadFeature4Title: "すぐに使える",
    downloadFeature4Desc: "Excel/スプレッドシートで開く",
    moreToolsTitle: "その他のツールを探索",
    moreTool1Name: "ExcelをPDFに変換",
    moreTool1Desc: "スプレッドシートをPDFに変換",
    moreTool2Name: "PDFをWordに変換",
    moreTool2Desc: "ドキュメントに変換",
    moreTool3Name: "PDFを結合",
    moreTool3Desc: "ドキュメントを結合",
    tryNow: "今すぐ試す",
    downloadFailedAlert: "ファイルのダウンロードに失敗しました: ",
    shareTitle: "変換したExcelドキュメント",
    shareText: "PDFからExcelに変換したスプレッドシートをご覧ください",
  },
  fr: {
    downloadTitle: "Télécharger la feuille de calcul Excel – SmallPDF.us",
    downloadDescription: "Téléchargez votre feuille de calcul Excel convertie depuis PDF",
    downloadLoadingText: "Chargement de votre fichier Excel...",
    downloadSuccessTitle: "Conversion PDF en Excel terminée !",
    downloadSuccessSubtitle: "{count} PDF converti{plural} en Excel avec succès",
    readyToDownload: "Prêt à télécharger",
    convertedFilesTitle: "Fichiers convertis",
    fromLabel: "Depuis : ",
    downloadButton: "Télécharger la feuille de calcul Excel",
    downloadAllButton: "Télécharger tous les fichiers Excel (ZIP)",
    downloadingButton: "Préparation du téléchargement...",
    downloadComplete: "Téléchargé avec succès !",
    filesLabel: "Fichier{plural}",
    formatLabel: "Format",
    freeLabel: "Gratuit",
    secureLabel: "Sécurisé",
    editableLabel: "Modifiable",
    convertMore: "Convertir d’autres fichiers",
    summaryTitle: "Récapitulatif de conversion",
    summaryFilesConverted: "Fichiers convertis",
    summaryInputFormat: "Format d’entrée",
    summaryOutputFormat: "Format de sortie",
    summaryStatus: "Statut",
    summaryComplete: "Terminé",
    fileExpiryTitle: "Expiration des fichiers",
    fileExpirySubtitle: "Suppression automatique pour la sécurité",
    fileExpiryTimeRemaining: "Temps restant",
    privacyTitle: "Votre confidentialité",
    privacy1: "Chiffrement SSL 256 bits",
    privacy2: "Traitement isolé sur serveur",
    privacy3: "Suppression automatique après 1 heure",
    privacy4: "Aucune collecte de données",
    downloadFeature1Title: "Données modifiables",
    downloadFeature1Desc: "Cellules entièrement éditables",
    downloadFeature2Title: "Tableaux extraits",
    downloadFeature2Desc: "Détection par IA",
    downloadFeature3Title: "Sécurisé et confidentiel",
    downloadFeature3Desc: "Supprimé automatiquement bientôt",
    downloadFeature4Title: "Prêt à l’emploi",
    downloadFeature4Desc: "Ouvrir dans Excel/Sheets",
    moreToolsTitle: "Découvrir d’autres outils",
    moreTool1Name: "Excel en PDF",
    moreTool1Desc: "Convertir des feuilles de calcul en PDF",
    moreTool2Name: "PDF en Word",
    moreTool2Desc: "Convertir en documents",
    moreTool3Name: "Fusionner PDF",
    moreTool3Desc: "Combiner des documents",
    tryNow: "Essayer maintenant",
    downloadFailedAlert: "Échec du téléchargement du fichier : ",
    shareTitle: "Mon document Excel converti",
    shareText: "Consultez ma feuille de calcul convertie de PDF en Excel",
  },
  es: {
    downloadTitle: "Descargar hoja de cálculo Excel – SmallPDF.us",
    downloadDescription: "Descarga tu hoja de cálculo Excel convertida desde PDF",
    downloadLoadingText: "Cargando tu archivo Excel...",
    downloadSuccessTitle: "¡Conversión de PDF a Excel completada!",
    downloadSuccessSubtitle: "{count} PDF convertido{plural} a Excel con éxito",
    readyToDownload: "Listo para descargar",
    convertedFilesTitle: "Archivos convertidos",
    fromLabel: "Desde: ",
    downloadButton: "Descargar hoja de cálculo Excel",
    downloadAllButton: "Descargar todos los archivos Excel (ZIP)",
    downloadingButton: "Preparando descarga...",
    downloadComplete: "¡Descargado con éxito!",
    filesLabel: "Archivo{plural}",
    formatLabel: "Formato",
    freeLabel: "Gratis",
    secureLabel: "Seguro",
    editableLabel: "Editable",
    convertMore: "Convertir más archivos",
    summaryTitle: "Resumen de conversión",
    summaryFilesConverted: "Archivos convertidos",
    summaryInputFormat: "Formato de entrada",
    summaryOutputFormat: "Formato de salida",
    summaryStatus: "Estado",
    summaryComplete: "Completado",
    fileExpiryTitle: "Vencimiento de archivos",
    fileExpirySubtitle: "Eliminación automática por seguridad",
    fileExpiryTimeRemaining: "Tiempo restante",
    privacyTitle: "Tu privacidad",
    privacy1: "Cifrado SSL de 256 bits",
    privacy2: "Procesamiento aislado en servidor",
    privacy3: "Eliminación automática tras 1 hora",
    privacy4: "Sin recolección de datos",
    downloadFeature1Title: "Datos editables",
    downloadFeature1Desc: "Celdas completamente editables",
    downloadFeature2Title: "Tablas extraídas",
    downloadFeature2Desc: "Detección por IA",
    downloadFeature3Title: "Seguro y privado",
    downloadFeature3Desc: "Eliminado automáticamente pronto",
    downloadFeature4Title: "Listo para usar",
    downloadFeature4Desc: "Abrir en Excel/Sheets",
    moreToolsTitle: "Explorar más herramientas",
    moreTool1Name: "Excel a PDF",
    moreTool1Desc: "Convertir hojas de cálculo a PDF",
    moreTool2Name: "PDF a Word",
    moreTool2Desc: "Convertir a documentos",
    moreTool3Name: "Combinar PDF",
    moreTool3Desc: "Combinar documentos",
    tryNow: "Probar ahora",
    downloadFailedAlert: "Error al descargar el archivo: ",
    shareTitle: "Mi documento Excel convertido",
    shareText: "Mira mi hoja de cálculo convertida de PDF a Excel",
  },
  de: {
    downloadTitle: "Excel-Tabelle herunterladen – SmallPDF.us",
    downloadDescription: "Ihre konvertierte PDF-zu-Excel-Tabelle herunterladen",
    downloadLoadingText: "Ihre Excel-Datei wird geladen...",
    downloadSuccessTitle: "PDF-zu-Excel-Konvertierung abgeschlossen!",
    downloadSuccessSubtitle: "{count} PDF(s) erfolgreich in Excel konvertiert",
    readyToDownload: "Bereit zum Herunterladen",
    convertedFilesTitle: "Konvertierte Dateien",
    fromLabel: "Von: ",
    downloadButton: "Excel-Tabelle herunterladen",
    downloadAllButton: "Alle Excel-Dateien herunterladen (ZIP)",
    downloadingButton: "Download wird vorbereitet...",
    downloadComplete: "Erfolgreich heruntergeladen!",
    filesLabel: "Datei(en)",
    formatLabel: "Format",
    freeLabel: "Kostenlos",
    secureLabel: "Sicher",
    editableLabel: "Bearbeitbar",
    convertMore: "Weitere konvertieren",
    summaryTitle: "Konvertierungsübersicht",
    summaryFilesConverted: "Konvertierte Dateien",
    summaryInputFormat: "Eingabeformat",
    summaryOutputFormat: "Ausgabeformat",
    summaryStatus: "Status",
    summaryComplete: "Abgeschlossen",
    fileExpiryTitle: "Dateiablauf",
    fileExpirySubtitle: "Automatische Löschung für Sicherheit",
    fileExpiryTimeRemaining: "Verbleibende Zeit",
    privacyTitle: "Ihr Datenschutz",
    privacy1: "256-Bit-SSL-Verschlüsselung",
    privacy2: "Isolierte Serververarbeitung",
    privacy3: "Automatische Löschung nach 1 Stunde",
    privacy4: "Keine Datenerfassung",
    downloadFeature1Title: "Bearbeitbare Daten",
    downloadFeature1Desc: "Vollständig bearbeitbare Zellen",
    downloadFeature2Title: "Tabellen extrahiert",
    downloadFeature2Desc: "KI-gestützte Erkennung",
    downloadFeature3Title: "Sicher & Privat",
    downloadFeature3Desc: "Wird bald automatisch gelöscht",
    downloadFeature4Title: "Sofort einsatzbereit",
    downloadFeature4Desc: "In Excel/Tabellen öffnen",
    moreToolsTitle: "Weitere Tools entdecken",
    moreTool1Name: "Excel in PDF",
    moreTool1Desc: "Tabellen in PDF konvertieren",
    moreTool2Name: "PDF in Word",
    moreTool2Desc: "In Dokumente konvertieren",
    moreTool3Name: "PDF zusammenführen",
    moreTool3Desc: "Dokumente kombinieren",
    tryNow: "Jetzt ausprobieren",
    downloadFailedAlert: "Datei konnte nicht heruntergeladen werden: ",
    shareTitle: "Mein konvertiertes Excel-Dokument",
    shareText: "Sehen Sie sich meine von PDF in Excel konvertierte Tabelle an",
  },
  it: {
    downloadTitle: "Scarica il foglio Excel - SmallPDF.us",
    downloadDescription: "Scarica il tuo foglio Excel convertito da PDF",
    downloadLoadingText: "Caricamento del tuo file Excel...",
    downloadSuccessTitle: "Conversione da PDF a Excel completata!",
    downloadSuccessSubtitle: "{count} PDF convertiti in Excel con successo",
    readyToDownload: "Pronto per il download",
    convertedFilesTitle: "File convertiti",
    fromLabel: "Da: ",
    downloadButton: "Scarica foglio Excel",
    downloadAllButton: "Scarica tutti i file Excel (ZIP)",
    downloadingButton: "Preparazione del download...",
    downloadComplete: "Scaricato con successo!",
    filesLabel: "File",
    formatLabel: "Formato",
    freeLabel: "Gratuito",
    secureLabel: "Sicuro",
    editableLabel: "Modificabile",
    convertMore: "Converti altri",
    summaryTitle: "Riepilogo della conversione",
    summaryFilesConverted: "File convertiti",
    summaryInputFormat: "Formato di input",
    summaryOutputFormat: "Formato di output",
    summaryStatus: "Stato",
    summaryComplete: "Completato",
    fileExpiryTitle: "Scadenza file",
    fileExpirySubtitle: "Eliminazione automatica per la sicurezza",
    fileExpiryTimeRemaining: "Tempo rimanente",
    privacyTitle: "La tua privacy",
    privacy1: "Crittografia SSL a 256 bit",
    privacy2: "Elaborazione su server isolato",
    privacy3: "Eliminazione automatica dopo 1 ora",
    privacy4: "Nessuna raccolta dati",
    downloadFeature1Title: "Dati modificabili",
    downloadFeature1Desc: "Celle completamente modificabili",
    downloadFeature2Title: "Tabelle estratte",
    downloadFeature2Desc: "Rilevamento basato su IA",
    downloadFeature3Title: "Sicuro e privato",
    downloadFeature3Desc: "Eliminazione automatica a breve",
    downloadFeature4Title: "Pronto all'uso",
    downloadFeature4Desc: "Apri in Excel/Fogli",
    moreToolsTitle: "Esplora altri strumenti",
    moreTool1Name: "Excel in PDF",
    moreTool1Desc: "Converti fogli di calcolo in PDF",
    moreTool2Name: "PDF in Word",
    moreTool2Desc: "Converti in documenti",
    moreTool3Name: "Unisci PDF",
    moreTool3Desc: "Combina documenti",
    tryNow: "Prova ora",
    downloadFailedAlert: "Download del file non riuscito: ",
    shareTitle: "Il mio documento Excel convertito",
    shareText: "Guarda il mio foglio di calcolo convertito da PDF a Excel",
  },
  id: {
    downloadTitle: "Unduh Spreadsheet Excel - SmallPDF.us",
    downloadDescription: "Unduh spreadsheet Excel hasil konversi PDF Anda",
    downloadLoadingText: "Memuat file Excel Anda...",
    downloadSuccessTitle: "Konversi PDF ke Excel Selesai!",
    downloadSuccessSubtitle: "{count} PDF berhasil dikonversi ke Excel",
    readyToDownload: "Siap Diunduh",
    convertedFilesTitle: "File yang Dikonversi",
    fromLabel: "Dari: ",
    downloadButton: "Unduh Spreadsheet Excel",
    downloadAllButton: "Unduh Semua File Excel (ZIP)",
    downloadingButton: "Menyiapkan Unduhan...",
    downloadComplete: "Berhasil Diunduh!",
    filesLabel: "File",
    formatLabel: "Format",
    freeLabel: "Gratis",
    secureLabel: "Aman",
    editableLabel: "Dapat Diedit",
    convertMore: "Konversi Lagi",
    summaryTitle: "Ringkasan Konversi",
    summaryFilesConverted: "File Dikonversi",
    summaryInputFormat: "Format Input",
    summaryOutputFormat: "Format Output",
    summaryStatus: "Status",
    summaryComplete: "Selesai",
    fileExpiryTitle: "Kedaluwarsa File",
    fileExpirySubtitle: "Hapus otomatis untuk keamanan",
    fileExpiryTimeRemaining: "Sisa waktu",
    privacyTitle: "Privasi Anda",
    privacy1: "Enkripsi SSL 256-bit",
    privacy2: "Pemrosesan server terisolasi",
    privacy3: "Hapus otomatis setelah 1 jam",
    privacy4: "Tidak ada pengumpulan data",
    downloadFeature1Title: "Data yang Dapat Diedit",
    downloadFeature1Desc: "Sel yang sepenuhnya dapat diedit",
    downloadFeature2Title: "Tabel Diekstrak",
    downloadFeature2Desc: "Deteksi bertenaga AI",
    downloadFeature3Title: "Aman & Privat",
    downloadFeature3Desc: "Akan dihapus otomatis segera",
    downloadFeature4Title: "Siap Digunakan",
    downloadFeature4Desc: "Buka di Excel/Sheets",
    moreToolsTitle: "Jelajahi Lebih Banyak Alat",
    moreTool1Name: "Excel ke PDF",
    moreTool1Desc: "Konversi spreadsheet ke PDF",
    moreTool2Name: "PDF ke Word",
    moreTool2Desc: "Konversi ke dokumen",
    moreTool3Name: "Gabung PDF",
    moreTool3Desc: "Gabungkan dokumen",
    tryNow: "Coba sekarang",
    downloadFailedAlert: "Gagal mengunduh file: ",
    shareTitle: "Dokumen Excel Konversi Saya",
    shareText: "Lihat spreadsheet konversi PDF ke Excel saya",
  },
}
// ──────────────────────────────────────────────────────────────────────────────

export default function DownloadPdfToExcel() {
  const router = useLocalizedRouter()
  const { locale } = router
  const t = translations[locale] || translations.en

  const { jobId } = router.query
  const [convertResult, setConvertResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState(3600)
  const [mounted, setMounted] = useState(false)

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    setMounted(true)
    const result = sessionStorage.getItem("pdfToExcelConvertResult")
    if (result) {
      try {
        const parsed = JSON.parse(result)
        setConvertResult(parsed)
        setTimeout(() => setShowSuccess(true), 100)
      } catch (err) {
        console.error("Error parsing result:", err)
        routerRef.current.push("/pdf-to-excel")
      }
    } else if (!jobId) {
      console.log("No result found, redirecting...")
      routerRef.current.push("/pdf-to-excel")
    }
  }, [jobId])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [countdown])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleDownload = async () => {
    if (!convertResult?.jobId) return
    setDownloading(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5011"
      const downloadUrl = `${apiUrl}/api/download-excel/${convertResult.jobId}`
      const response = await fetch(downloadUrl)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Download failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      const contentDisposition = response.headers.get("content-disposition")
      let filename = convertResult.files?.[0]?.filename || "converted-spreadsheet.xlsx"

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "")
        }
      }

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setDownloadComplete(true)
      setTimeout(() => setDownloadComplete(false), 3000)
    } catch (error) {
      console.error("Download error:", error)
      alert(t.downloadFailedAlert + error.message)
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("uploadedPdfFilesForExcel")
    sessionStorage.removeItem("pdfToExcelConvertResult")
    router.push("/pdf-to-excel")
  }

  const handleCopyLink = () => {
    const fullUrl = window.location.href
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t.shareTitle,
          text: t.shareText,
          url: window.location.href,
        })
      } catch (err) {
        console.log("Share failed:", err)
      }
    } else {
      handleCopyLink()
    }
  }

  if (!convertResult && !jobId) {
    return (
      <Layout>
        <SEOHead title={t.downloadTitle} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-blue-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 border-3 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t.downloadLoadingText}</p>
          </div>
        </div>
      </Layout>
    )
  }

  const fileCount = convertResult?.fileCount || 1
  const files = convertResult?.files || []

  return (
    <Layout title={t.downloadTitle} description={t.downloadDescription}>
      {/* noIndex=true — download is a transient post-conversion page, not for indexing */}
      <SEOHead title={t.downloadTitle} description={t.downloadDescription} noIndex={true} />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Manrope', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        @keyframes checkmark-draw { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
        @keyframes fade-up { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .animate-checkmark { animation: checkmark-draw 0.4s ease-out 0.3s forwards; stroke-dasharray: 24; stroke-dashoffset: 24; }
        .animate-fade-up { animation: fade-up 0.5s ease-out forwards; }
        .animate-fade-up-delay-1 { animation: fade-up 0.5s ease-out 0.1s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.5s ease-out 0.2s forwards; opacity: 0; }
        .btn-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); background-size: 200% 100%; animation: shimmer 2s infinite; }
      `}</style>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 sm:px-6 lg:px-8 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

      {/* Success Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`relative flex-shrink-0 ${mounted ? "animate-fade-up" : ""}`}>
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-checkmark"
                    />
                  </svg>
                </div>
              </div>
              <div className={`${mounted ? "animate-fade-up-delay-1" : "opacity-0"}`}>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {t.downloadSuccessTitle}
                </h1>
                <p className="font-body text-blue-100 text-sm">
                  {t.downloadSuccessSubtitle
                    .replace("{count}", fileCount)
                    .replace("{plural}", fileCount > 1 ? "s" : "")}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${mounted ? "animate-fade-up-delay-2" : "opacity-0"}`}>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-white">
                <Timer className="w-3.5 h-3.5" />
                <span>{formatTime(countdown)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-white">
                <Lock className="w-3.5 h-3.5" />
                <span>{t.secureLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-blue-50 py-8 sm:py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

            {/* Main Download Section */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-2xl border border-blue-200 shadow-lg overflow-hidden">
                {/* File Header */}
                <div className="bg-slate-800 px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <FileSpreadsheet className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg sm:text-xl font-semibold text-white truncate">
                        {files.length === 1
                          ? files[0]?.filename
                          : `${fileCount} Excel Spreadsheets`}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-300 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                          {t.readyToDownload}
                        </span>
                        {files.length === 1 && files[0]?.fileSize && (
                          <span className="text-slate-400 text-sm">
                            {(files[0].fileSize / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Converted Files List */}
                {files.length > 0 && (
                  <div className="px-6 py-4 border-b border-blue-100 bg-blue-50/50">
                    <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                      {t.convertedFilesTitle}
                    </h3>
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-2 bg-white rounded-lg border border-blue-100"
                        >
                          <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center flex-shrink-0">
                            <FileSpreadsheet className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{file.filename}</p>
                            <p className="text-xs text-slate-500">
                              {file.originalName && `${t.fromLabel}${file.originalName}`}
                              {file.fileSize && ` • ${(file.fileSize / 1024).toFixed(1)} KB`}
                            </p>
                          </div>
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Actions */}
                <div className="p-6 sm:p-8">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="group relative w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 overflow-hidden"
                  >
                    <div className="absolute inset-0 btn-shimmer"></div>
                    {downloading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="relative">{t.downloadingButton}</span>
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span className="relative">{t.downloadComplete}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 group-hover:animate-bounce" />
                        <span className="relative">
                          {files.length > 1 ? t.downloadAllButton : t.downloadButton}
                        </span>
                        <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                      </>
                    )}
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{fileCount}</div>
                      <div className="font-body text-xs text-slate-500 mt-1">
                        {t.filesLabel.replace("{plural}", fileCount > 1 ? "s" : "")}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-green-600">XLSX</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t.formatLabel}</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="font-display text-2xl sm:text-3xl font-bold text-blue-600">100%</div>
                      <div className="font-body text-xs text-slate-500 mt-1">{t.freeLabel}</div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-blue-100">
                    <button
                      onClick={handleConvertAnother}
                      className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-blue-100 hover:bg-blue-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t.convertMore}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-blue-100 hover:bg-blue-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="py-3 px-4 rounded-xl font-medium text-sm bg-blue-100 hover:bg-blue-200 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Table,       title: t.downloadFeature1Title, desc: t.downloadFeature1Desc, color: "bg-green-600" },
                  { icon: Sparkles,    title: t.downloadFeature2Title, desc: t.downloadFeature2Desc, color: "bg-blue-600" },
                  { icon: Shield,      title: t.downloadFeature3Title, desc: t.downloadFeature3Desc, color: "bg-slate-600" },
                  { icon: Zap,         title: t.downloadFeature4Title, desc: t.downloadFeature4Desc, color: "bg-amber-500" },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-blue-200">
                    <div
                      className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-3 shadow-lg`}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-display font-semibold text-slate-900 mb-1">{item.title}</h3>
                    <p className="font-body text-sm text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* More Tools */}
              <div className="bg-white rounded-2xl border border-blue-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-blue-100 bg-blue-50">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{t.moreToolsTitle}</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { name: t.moreTool1Name, desc: t.moreTool1Desc, href: "/excel-to-pdf",  color: "bg-green-600" },
                      { name: t.moreTool2Name, desc: t.moreTool2Desc, href: "/pdf-to-word",   color: "bg-blue-600" },
                      { name: t.moreTool3Name, desc: t.moreTool3Desc, href: "/merge-pdf",     color: "bg-slate-800" },
                    ].map((tool) => (
                      <a
                        key={tool.name}
                        href={tool.href}
                        className="group p-4 rounded-xl border border-blue-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 bg-white"
                      >
                        <div
                          className={`w-10 h-10 ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}
                        >
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 mb-0.5">{tool.name}</h4>
                        <p className="font-body text-sm text-slate-500 mb-2">{tool.desc}</p>
                        <span className="inline-flex items-center text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                          {t.tryNow}
                          <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Summary */}
              <div className="bg-white rounded-2xl border border-blue-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-blue-100 bg-blue-50">
                  <h3 className="font-display text-base font-semibold text-slate-900">{t.summaryTitle}</h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t.summaryFilesConverted}</span>
                    <span className="font-display font-semibold text-slate-900">{fileCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t.summaryInputFormat}</span>
                    <span className="font-display font-semibold text-red-600">PDF</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm text-slate-600">{t.summaryOutputFormat}</span>
                    <span className="font-display font-semibold text-green-600">XLSX</span>
                  </div>
                  <div className="pt-3 border-t border-blue-100">
                    <div className="flex justify-between items-center">
                      <span className="font-body text-sm text-slate-600">{t.summaryStatus}</span>
                      <span className="inline-flex items-center gap-1.5 text-green-600 font-medium text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {t.summaryComplete}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Expiry */}
              <div className="bg-white rounded-2xl border border-blue-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Timer className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">{t.fileExpiryTitle}</h3>
                    <p className="font-body text-xs text-slate-500">{t.fileExpirySubtitle}</p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-body text-xs text-slate-600">{t.fileExpiryTimeRemaining}</span>
                    <span className="font-display font-semibold text-slate-900">{formatTime(countdown)}</span>
                  </div>
                  <div className="bg-blue-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-1000"
                      style={{ width: `${(countdown / 3600) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Security Info */}
              <div className="bg-white rounded-2xl border border-blue-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">{t.privacyTitle}</h3>
                </div>
                <ul className="space-y-2">
                  {[t.privacy1, t.privacy2, t.privacy3, t.privacy4].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="font-body text-xs text-slate-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sidebar Ad */}
              <div className="bg-white rounded-2xl border border-blue-200 p-3">
                <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body">Advertisement</p>
                <AdSenseUnit adSlot="7489539676" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}