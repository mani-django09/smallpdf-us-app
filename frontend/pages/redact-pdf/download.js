// pages/redact-pdf/download.js — final step: download the redacted PDF.
import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import AdSenseUnit from "../../components/AdSenseUnit"
import PromoBanner from "../../components/PromoBanner"
import RelatedTools from "../../components/RelatedTools"
import PrivacyNotice from "../../components/PrivacyNotice"
import UpgradeUpsell from "../../components/UpgradeUpsell"
import EmailCapture from "../../components/EmailCapture"
import { useTranslations } from "../../lib/i18n"
import { getPageMessages } from '../../lib/i18nLoader'
import { Download, CheckCircle, EyeOff, RefreshCw, Printer, Trash2, Lock } from "lucide-react"
import { printBlob, printFile } from "../../lib/fileActions"
import AdLabel from "../../components/AdLabel"

export default function RedactDownload() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [result, setResult] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [downloadedBlob, setDownloadedBlob] = useState(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    const raw = sessionStorage.getItem("redactResult")
    if (raw) {
      try { setResult(JSON.parse(raw)) } catch { routerRef.current.push("/redact-pdf") }
    } else {
      routerRef.current.push("/redact-pdf")
    }
  }, [])

  const handleDownload = async () => {
    if (!result) return
    setDownloading(true); setError("")
    try {
      const resp = await fetch(result.downloadUrl)
      if (!resp.ok) throw new Error("Download failed")
      const blob = await resp.blob()
      setDownloadedBlob(blob)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.convertedName || "redacted.pdf"
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
      setDone(true); setTimeout(() => setDone(false), 3000)
    } catch (e) {
      setError(t("redactPdf.errorDownloadFailed"))
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      if (downloadedBlob) { printBlob(downloadedBlob) }
      else if (result?.downloadUrl) { await printFile(result.downloadUrl) }
    } catch (err) { console.error("Print error:", err) }
    finally { setPrinting(false) }
  }

  const handleDelete = () => {
    if (!window.confirm(t("fileActions.deleteConfirm"))) return
    sessionStorage.removeItem("redactResult")
    router.push("/redact-pdf")
  }

  if (!result) {
    return (
      <Layout>
        <SEOHead title="Download Redacted PDF | SmallPDF.us" description="Download your redacted PDF." noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={t("redactPdf.download.pageTitle")} description={t("redactPdf.download.subheading")}>
      <SEOHead title="Download Redacted PDF | SmallPDF.us" description="Download your redacted PDF." noIndex={true} />


      <div className="bg-white py-4 px-4 border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center"><AdLabel /></p>
          <div className="flex justify-center"><AdSenseUnit adSlot="8004544994" size="leaderboard" /></div>
        </div>
      </div>

      <div className="bg-slate-50 min-h-screen py-10 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 text-center bg-slate-50 border-b border-slate-200">
              <div className="w-14 h-14 mx-auto bg-white border border-slate-200 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-slate-900" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{t("redactPdf.download.heading")}</h1>
              <p className="text-slate-600 text-sm mt-1">{t("redactPdf.download.subheading")}</p>
            </div>

            <div className="p-6 sm:p-8">
              {/* True-redaction reassurance */}
              <div className="flex items-start gap-2.5 bg-slate-900 rounded-xl p-3 mb-5">
                <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-200 leading-relaxed">{t("redactPdf.download.trueNote")}</p>
              </div>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold text-base hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-lg disabled:opacity-60 flex items-center justify-center gap-3"
              >
                {downloading
                  ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>{t("redactPdf.download.preparingDownload")}</span></>)
                  : done
                  ? (<><CheckCircle className="w-5 h-5" /><span>{t("redactPdf.download.downloadedSuccess")}</span></>)
                  : (<><Download className="w-5 h-5" /><span>{t("redactPdf.download.downloadBtn")}</span></>)}
              </button>

              {error && <p className="mt-3 text-sm text-red-700 font-medium text-center">{error}</p>}

              <PrivacyNotice minutes={60} className="mt-4" />

              {/* Upgrade upsell — free users only */}
              <UpgradeUpsell className="mt-4" />

              <EmailCapture className="mt-3" />
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-2xl font-bold text-slate-900">{result.redactedPages || "—"}</div>
                  <div className="text-xs text-slate-500 mt-1">{t("redactPdf.download.pagesLabel")}</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-2xl font-bold text-emerald-600">{result.boxCount || "—"}</div>
                  <div className="text-xs text-slate-500 mt-1">{t("redactPdf.download.areasLabel")}</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-2xl font-bold text-slate-900">✓</div>
                  <div className="text-xs text-slate-500 mt-1">{t("redactPdf.download.secureLabel")}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => router.push("/redact-pdf")}
                  className="flex-1 flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 font-medium py-2">
                  <RefreshCw className="w-4 h-4" /> {t("redactPdf.download.redactAnother")}
                </button>
                <button onClick={handlePrint} disabled={printing} title={t("fileActions.print")}
                  className="py-2 px-4 rounded-xl text-sm bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center text-slate-700 disabled:opacity-60">
                  {printing ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Printer className="w-4 h-4" />}
                </button>
                <button onClick={handleDelete} title={t("fileActions.delete")}
                  className="py-2 px-4 rounded-xl text-sm bg-red-100 hover:bg-red-200 transition-colors flex items-center justify-center text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar — 2 ads beside the card instead of stacked below it */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-3">
              <div className="flex justify-center"><PromoBanner slot={0} /></div>
            </div>
            {/* Sidebar Ad 2 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3">
              <div className="flex justify-center"><PromoBanner slot={1} /></div>
            </div>
          </div>
        </div>
      </div>

      <RelatedTools current="redact-pdf" />
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["redactPdf"]) },
    revalidate: 86400,
  }
}
