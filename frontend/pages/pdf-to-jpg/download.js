import { useState, useEffect } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { useTranslations } from "../../lib/i18n"
import {
  Download,
  CheckCircle2,
  ImageIcon,
  ArrowLeft,
  Shield,
  Clock,
  FileImage,
  Share2,
  RefreshCw,
  AlertCircle,
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

export default function DownloadJPG() {
  const router = useLocalizedRouter()
  const { t, locale } = useTranslations()
  const [result, setResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const storedResult = sessionStorage.getItem("jpgConversionResult")
    
    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult)
        setResult(parsed)
      } catch (err) {
        console.error("Error parsing result:", err)
        setError(t('pdfToJpg.loadResultError') || "Failed to load conversion result")
      }
    } else {
      router.push("/pdf-to-jpg")
    }
  }, [])

  const handleDownload = async () => {
    if (!result || !result.downloadUrl) {
      setError(t('pdfToJpg.downloadUrlNotFound') || 'Download URL not found')
      return
    }

    setDownloading(true)
    setError("")

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
      const downloadUrl = `${API_URL}${result.downloadUrl}`
      
      const response = await fetch(downloadUrl)
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }
      
      const blob = await response.blob()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Determine filename based on isZip flag
      let downloadFilename
      if (result.isZip === true) {
        downloadFilename = result.convertedName || 'converted-images.zip'
      } else {
        const originalBaseName = result.originalName?.replace(/\.pdf$/i, '') || 'converted'
        downloadFilename = `${originalBaseName}.jpg`
      }
      
      a.download = downloadFilename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setDownloaded(true)
    } catch (err) {
      console.error('Download error:', err)
      setError(`${t('pdfToJpg.downloadFailed') || 'Download failed: '}${err.message}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertAnother = () => {
    sessionStorage.removeItem("jpgConversionResult")
    sessionStorage.removeItem("uploadedPDFFile")
    router.push("/pdf-to-jpg")
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
        <SEOHead title={t('pdfToJpg.downloadPageTitle') || "Download JPG Images | SmallPDF.us"} noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <div className="absolute inset-0 border-3 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium text-sm">{t('pdfToJpg.loadingImages')}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Download JPG Images" description="Your converted JPG images are ready">
      {/* noIndex — transient post-conversion page, no static indexable content */}
      <SEOHead title={t('pdfToJpg.downloadPageTitle') || "Download JPG Images | SmallPDF.us"} noIndex={true} />
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

      {/* Header Ad */}
      <div className="bg-slate-50 px-4 pt-6">
        <div className="max-w-3xl mx-auto">
          <AdSenseUnit adSlot="8004544994" />
        </div>
      </div>

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
                {t('pdfToJpg.conversionComplete')}
              </h1>
              <p className="font-body text-sm text-white/80">
                {result.pageCount === 1 
                  ? t('pdfToJpg.singleImageReady')
                  : `${result.pageCount} ${t('pdfToJpg.multipleImagesReady')}`
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-slate-50 min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto">
          
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
                  {t('pdfToJpg.dismiss')}
                </button>
              </div>
            </div>
          )}

          {/* Download Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-6">
            {/* File Info */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  {result.isZip ? (
                    <FileImage className="w-7 h-7 text-white" />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-display text-base font-semibold text-white truncate">
                    {result.isZip 
                      ? result.convertedName 
                      : `${result.originalName?.replace(/\.pdf$/i, '')}.jpg`
                    }
                  </p>
                  <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                    <span>{formatFileSize(result.fileSize)}</span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                    <span>
                      {result.pageCount === 1 
                        ? "1 Image (JPG)" 
                        : `${result.pageCount} Images (ZIP)`
                      }
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/20 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  <span className="text-sm font-medium text-emerald-300">{t('pdfToJpg.ready')}</span>
                </div>
              </div>
            </div>

            {/* Download Actions */}
            <div className="p-6">
              {/* Info Banner for Single Image */}
              {!result.isZip && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                  <div className="flex items-start gap-3">
                    <ImageIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-display text-sm font-semibold text-blue-900">
                        {t('pdfToJpg.singlePagePdf')}
                      </p>
                      <p className="font-body text-xs text-blue-700 mt-1">
                        {t('pdfToJpg.singlePageDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info Banner for ZIP */}
              {result.isZip && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5">
                  <div className="flex items-start gap-3">
                    <FileImage className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="font-display text-sm font-semibold text-indigo-900">
                        {result.pageCount} {t('pdfToJpg.imagesInZip')}
                      </p>
                      <p className="font-body text-xs text-indigo-700 mt-1">
                        {t('pdfToJpg.multiPageDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className={`w-full py-4 px-6 rounded-xl font-display font-semibold text-base flex items-center justify-center gap-3 transition-all ${
                  downloaded
                    ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                    : downloading
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/25"
                }`}
              >
                {downloading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{t('pdfToJpg.downloading')}</span>
                  </>
                ) : downloaded ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{t('pdfToJpg.downloadedSuccess')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>
                      {result.isZip 
                        ? `${t('pdfToJpg.downloadZip').replace('images', result.pageCount + ' images')}` 
                        : t('pdfToJpg.downloadJpgImage')
                      }
                    </span>
                  </>
                )}
              </button>

              {/* Download Again Button */}
              {downloaded && (
                <button
                  onClick={() => { setDownloaded(false); handleDownload(); }}
                  className="w-full mt-3 py-3 px-6 rounded-xl font-display font-medium text-sm flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('pdfToJpg.downloadAgain')}</span>
                </button>
              )}

              {/* Security Note */}
              <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>{t('pdfToJpg.secureDownload')}</span>
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>{t('pdfToJpg.autoDelete')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Convert Another */}
          <div className="text-center">
            <button
              onClick={handleConvertAnother}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 font-medium text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('pdfToJpg.convertAnother')}</span>
            </button>
          </div>

          {/* Tips Section */}
          <div className="mt-8 bg-white rounded-xl p-5 border border-slate-200">
            <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
              {t('pdfToJpg.whatCanYouDo')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Share2, text: t('pdfToJpg.shareOnSocial') },
                { icon: FileImage, text: t('pdfToJpg.useInPresentations') },
                { icon: ImageIcon, text: t('pdfToJpg.addToDocuments') },
                { icon: Download, text: t('pdfToJpg.archiveForLater') },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <item.icon className="w-4 h-4 text-blue-600" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Ad */}
          <div className="mt-6 bg-white rounded-xl p-3 shadow-sm border border-slate-200">
            <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">Advertisement</p>
            <AdSenseUnit adSlot="7489539676" />
          </div>

        </div>
      </div>
    </Layout>
  )
}