import { useState, useEffect } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import {
  Download,
  CheckCircle2,
  FileText,
  ArrowLeft,
  Shield,
  Clock,
  FileSpreadsheet,
  Share2,
  RefreshCw,
  AlertCircle,
  Mail,
  Printer,
  Archive,
} from "lucide-react"
import AdUnit from "../../components/AdUnit"

// Inline translations for strings not yet in JSON files
// Covers all 8 supported locales — no new JSON keys needed
const INLINE_T = {
  pdfDocument: {
    en: "PDF Document", ja: "PDF ドキュメント", de: "PDF-Dokument",
    fr: "Document PDF", es: "Documento PDF", it: "Documento PDF",
    id: "Dokumen PDF", pt: "Documento PDF",
  },
  conversionPreservedNote: {
    en: "Excel file successfully converted to PDF. Formatting, charts, and data fully preserved.",
    ja: "ExcelファイルがPDFに正常に変換されました。書式・グラフ・データが完全に保持されています。",
    de: "Excel-Datei erfolgreich in PDF konvertiert. Formatierung, Diagramme und Daten vollständig erhalten.",
    fr: "Fichier Excel converti en PDF avec succès. Mise en forme, graphiques et données entièrement préservés.",
    es: "Archivo Excel convertido a PDF exitosamente. Formato, gráficos y datos totalmente conservados.",
    it: "File Excel convertito in PDF con successo. Formattazione, grafici e dati completamente conservati.",
    id: "File Excel berhasil dikonversi ke PDF. Format, grafik, dan data sepenuhnya terjaga.",
    pt: "Arquivo Excel convertido para PDF com sucesso. Formatação, gráficos e dados totalmente preservados.",
  },
  loadResultError: {
    en: "Failed to load conversion result", ja: "変換結果の読み込みに失敗しました",
    de: "Konvertierungsergebnis konnte nicht geladen werden",
    fr: "Échec du chargement du résultat de conversion",
    es: "Error al cargar el resultado de conversión",
    it: "Impossibile caricare il risultato della conversione",
    id: "Gagal memuat hasil konversi", pt: "Falha ao carregar resultado da conversão",
  },
  downloadUrlNotFound: {
    en: "Download URL not found", ja: "ダウンロードURLが見つかりません",
    de: "Download-URL nicht gefunden", fr: "URL de téléchargement introuvable",
    es: "URL de descarga no encontrada", it: "URL di download non trovato",
    id: "URL unduhan tidak ditemukan", pt: "URL de download não encontrado",
  },
  downloadFailedPrefix: {
    en: "Download failed: ", ja: "ダウンロード失敗: ", de: "Download fehlgeschlagen: ",
    fr: "Échec du téléchargement : ", es: "Descarga fallida: ", it: "Download fallito: ",
    id: "Unduhan gagal: ", pt: "Download falhou: ",
  },
}

export default function DownloadExcelToPDF() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()

  // Helper: pick the right locale from INLINE_T, fall back to English
  const ti = (key) => INLINE_T[key]?.[locale] ?? INLINE_T[key]?.en ?? key
  const [result, setResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const storedResult = sessionStorage.getItem("excelToPdfResult")

    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult)
        setResult(parsed)
      } catch (err) {
        console.error("Error parsing result:", err)
        setError(ti("loadResultError"))
      }
    } else {
      router.push("/excel-to-pdf")
    }
  }, [])

  const handleDownload = async () => {
    if (!result || !result.downloadUrl) {
      setError(ti("downloadUrlNotFound"))
      return
    }

    setDownloading(true)
    setError("")

    try {
      // downloadUrl is already absolute (set by preview.js getApiUrl())
      // Works in dev (http://localhost:5011/converted/...) and prod (https://smallpdf.us/converted/...)
      const downloadUrl = result.downloadUrl.startsWith('http')
        ? result.downloadUrl
        : (() => {
            const { hostname, protocol } = window.location
            const API_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
              ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011')
              : `${protocol}//${hostname}`
            return `${API_URL}${result.downloadUrl}`
          })()

      console.log('Downloading from:', downloadUrl)
      const response = await fetch(downloadUrl)

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      // Use the clean convertedName ("MyFile.pdf") stored by preview.js
      // Fall back to deriving from originalName only if convertedName is missing
      const downloadFilename = result.convertedName
        || (result.originalName
            ? result.originalName.replace(/\.(xlsx|xls)$/i, ".pdf")
            : "converted.pdf")

      a.download = downloadFilename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setDownloaded(true)
    } catch (err) {
      console.error("Download error:", err)
      setError(
        `${ti("downloadFailedPrefix")}${err.message}`
      )
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("excelToPdfResult")
    sessionStorage.removeItem("uploadedExcelFile")
    router.push("/excel-to-pdf")
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A"
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + " MB"
    }
    return (bytes / 1024).toFixed(1) + " KB"
  }

  // Loading state
  if (!result) {
    return (
      <Layout>
        <SEOHead
          title="Download Excel to PDF | SmallPDF.us"
          description="Download your converted PDF file."
          noIndex={true}
        />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t("excelToPdf.loadingFile")}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      title={t("excelToPdf.downloadTitle")}
      description={t("excelToPdf.downloadDescription")}
    >
      <SEOHead
        title="Download Excel to PDF | SmallPDF.us"
        description="Download your converted PDF file."
        noIndex={true}
      />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        @keyframes checkmark {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-checkmark { animation: checkmark 0.5s ease-out forwards; }
      `}</style>

      {/* Success Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white animate-checkmark" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                {t("excelToPdf.conversionComplete")}
              </h1>
              <p className="font-body text-sm text-white/80">{t("excelToPdf.pdfReady")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-6">
        <div className="max-w-6xl mx-auto">
          <AdUnit slot="8004544994" label="Header Ad" className="rounded-xl overflow-hidden" />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6">

          {/* Main Column */}
          <div className="flex-1 min-w-0">

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">{error}</p>
                <button
                  onClick={() => setError("")}
                  className="text-sm text-red-600 hover:text-red-800 mt-1"
                >
                  {t("excelToPdf.dismiss")}
                </button>
              </div>
            </div>
          )}

          {/* Download Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-6">
            {/* File Info */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-display text-base font-semibold text-white truncate">
                    {result.convertedName ||
                      `${result.originalName?.replace(/\.(xlsx|xls)$/i, "")}.pdf`}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                    <span>{formatFileSize(result.fileSize)}</span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                    <span>{ti("pdfDocument")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/20 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  <span className="text-sm font-medium text-emerald-300">{t("excelToPdf.ready")}</span>
                </div>
              </div>
            </div>

            {/* Download Actions */}
            <div className="p-6">
              {/* Source info banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-display text-sm font-semibold text-emerald-900">
                      {result.originalName}
                    </p>
                    <p className="font-body text-xs text-emerald-700 mt-1">
                      {ti("conversionPreservedNote")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className={`w-full py-4 px-6 rounded-xl font-display font-semibold text-base flex items-center justify-center gap-3 transition-all ${
                  downloaded
                    ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                    : downloading
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg hover:shadow-emerald-500/25"
                }`}
              >
                {downloading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{t("excelToPdf.downloading")}</span>
                  </>
                ) : downloaded ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{t("excelToPdf.downloadedSuccess")}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>{t("excelToPdf.downloadPdf")}</span>
                  </>
                )}
              </button>

              {/* Download Again Button */}
              {downloaded && (
                <button
                  onClick={() => {
                    setDownloaded(false)
                    handleDownload()
                  }}
                  className="w-full mt-3 py-3 px-6 rounded-xl font-display font-medium text-sm flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{t("excelToPdf.downloadAgain")}</span>
                </button>
              )}

              {/* Security Note */}
              <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>{t("excelToPdf.secureDownload")}</span>
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>{t("excelToPdf.autoDelete")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Convert Another */}
          <div className="text-center">
            <button
              onClick={handleConvertAnother}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-emerald-600 font-medium text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t("excelToPdf.convertAnother")}</span>
            </button>
          </div>

          {/* Tips Section */}
          <div className="mt-8 bg-white rounded-xl p-5 border border-slate-200">
            <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
              {t("excelToPdf.whatCanYouDo")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Share2, text: t("excelToPdf.shareWithTeam") },
                { icon: Mail, text: t("excelToPdf.sendByEmail") },
                { icon: Printer, text: t("excelToPdf.printDocument") },
                { icon: Archive, text: t("excelToPdf.archiveForLater") },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <item.icon className="w-4 h-4 text-emerald-600" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Debug Info (remove in production) */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg text-xs font-mono">
              <p>
                <strong>Debug Info:</strong>
              </p>
              <p>downloadUrl: {result.downloadUrl}</p>
              <p>convertedName: {result.convertedName}</p>
              <p>originalName: {result.originalName}</p>
            </div>
          )}
          </div>{/* end main-column */}

          {/* Sidebar */}
          <div className="lg:w-72 xl:w-80 flex-shrink-0 space-y-4">

            {/* Sidebar Ad */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide font-body">Advertisement</p>
              <AdUnit slot="7489539676" label="Download Sidebar" />
            </div>

            {/* Quick Tips */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-2">💡 Quick Tips</h3>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" /><span>Your PDF preserves all sheets, charts and formatting</span></li>
                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" /><span>File is automatically deleted after 1 hour</span></li>
                <li className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" /><span>Need to compress? Use our PDF compressor after downloading</span></li>
              </ul>
            </div>
          </div>{/* end sidebar */}

          </div>{/* end two-col flex */}
        </div>
      </div>
    </Layout>
  )
}