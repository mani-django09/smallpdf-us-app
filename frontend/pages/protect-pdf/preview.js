// pages/protect-pdf/preview.js — set password, encrypt, then send to /download.
import { useState, useEffect, useRef } from "react"
import { protectPdfStore } from "./index"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import AdSenseUnit from "../../components/AdSenseUnit"
import PrivacyNotice from "../../components/PrivacyNotice"
import { useTranslations } from "../../lib/i18n"
import { useAuth } from "../../context/AuthContext"
import { getApiUrl } from "../../lib/getApiUrl"
import { usePdfThumbnail } from "../../hooks/usePdfThumbnail"
import { Lock, ArrowLeft, FileText, Eye, EyeOff, ShieldCheck, KeyRound, Shield, Clock } from "lucide-react"
import useDailyLimit from '../../hooks/useDailyLimit'

function strength(pw) {
  let s = 0
  if (pw.length >= 6) s++
  if (pw.length >= 10) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(s, 3) // 0..3
}

export default function ProtectPreview() {
  const router = useLocalizedRouter()
  const { handleDailyLimitError, DailyLimitGate } = useDailyLimit()
  const { t } = useTranslations()
  const { authFetch } = useAuth()
  const { ready: pdfReady, generateThumbnail } = usePdfThumbnail()

  const [meta, setMeta] = useState(null)
  const [thumb, setThumb] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [error, setError] = useState("")

  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    if (protectPdfStore.file) setMeta({ name: protectPdfStore.name, size: protectPdfStore.size })
    else routerRef.current.push("/protect-pdf")
  }, [])

  useEffect(() => {
    let cancelled = false
    if (protectPdfStore.file && pdfReady) {
      ;(async () => {
        const { thumbnail, pageCount } = await generateThumbnail(protectPdfStore.file, 0.9)
        if (!cancelled) { setThumb(thumbnail); setPageCount(pageCount) }
      })()
    }
    return () => { cancelled = true }
  }, [pdfReady, generateThumbnail])

  const handleProtect = async () => {
    if (!protectPdfStore.file) return
    if (!password) { setError(t("protectPdf.errorNoPassword")); return }
    if (password !== confirm) { setError(t("protectPdf.errorMismatch")); return }
    setProcessing(true); setError(""); setProgress(0)

    const stages = [
      { p: 25, s: t("protectPdf.preview.stageUploading"), d: 350 },
      { p: 60, s: t("protectPdf.preview.stageProcessing"), d: 500 },
      { p: 88, s: t("protectPdf.preview.stageFinalizing"), d: 350 },
    ]
    setStage(t("protectPdf.preview.stagePreparing"))
    let i = 0
    const tick = () => { if (i < stages.length) { setProgress(stages[i].p); setStage(stages[i].s); const d = stages[i].d; i++; setTimeout(tick, d) } }
    tick()

    try {
      const fd = new FormData()
      fd.append("file", protectPdfStore.file, protectPdfStore.name)
      fd.append("password", password)
      const resp = await authFetch(`${getApiUrl()}/api/protect-pdf`, { method: "POST", body: fd })
      const data = await resp.json()
      if (!resp.ok || !data.success) throw new Error(data.error || t("protectPdf.errorGeneric"))

      setProgress(100); setStage(t("protectPdf.preview.stageComplete"))
      const absoluteUrl = data.downloadUrl.startsWith("http") ? data.downloadUrl : `${getApiUrl()}${data.downloadUrl}`
      sessionStorage.setItem("protectResult", JSON.stringify({ downloadUrl: absoluteUrl, convertedName: data.convertedName, pageCount: pageCount }))
      setTimeout(() => router.push("/protect-pdf/download"), 400)
    } catch (e) {
      setError(e.message || t("protectPdf.errorGeneric"))
      setProcessing(false); setProgress(0); setStage("")
    }
  }

  if (!meta) {
    return (
      <Layout>
        <SEOHead title="Protect PDF - Set Password | SmallPDF.us" description="Password-protect your PDF." noIndex={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      </Layout>
    )
  }

  const sLevel = strength(password)
  const sLabels = [t("protectPdf.strengthWeak"), t("protectPdf.strengthWeak"), t("protectPdf.strengthMedium"), t("protectPdf.strengthStrong")]
  const sColors = ["bg-red-400", "bg-red-400", "bg-amber-400", "bg-emerald-500"]
  const benefits = [
    { Icon: ShieldCheck, text: t("protectPdf.preview.benefitEncryption"), c: "text-emerald-600 bg-emerald-100" },
    { Icon: Shield, text: t("protectPdf.preview.benefitSecure"), c: "text-teal-600 bg-teal-100" },
    { Icon: KeyRound, text: t("protectPdf.preview.benefitNoStore"), c: "text-violet-600 bg-violet-100" },
    { Icon: Clock, text: t("protectPdf.preview.benefitAutoDelete"), c: "text-blue-600 bg-blue-100" },
  ]

  return (
    <Layout title={t("protectPdf.preview.pageTitle")} description={t("protectPdf.heroSubtitle")}>
      <SEOHead title="Protect PDF - Set Password | SmallPDF.us" description="Password-protect your PDF and download." noIndex={true} />

      <div className="bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <button onClick={() => router.push("/protect-pdf")} className="mb-3 flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /><span>{t("protectPdf.preview.changeFile")}</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center"><Lock className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">{t("protectPdf.preview.heading")}</h1>
              <p className="text-xs text-white/80">{t("protectPdf.preview.subheading")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 px-4 pt-5"><div className="max-w-5xl mx-auto"><AdSenseUnit adSlot="8004544994" size="leaderboard" /></div></div>

      <div className="bg-slate-50 min-h-screen py-6 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-10 gap-5">
          <div className="lg:col-span-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              {!processing ? (
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Preview */}
                  <div className="flex flex-col items-center">
                    <div className="w-full aspect-[3/4] max-w-xs bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden relative">
                      {thumb ? <img src={thumb} alt="preview" className="max-h-full max-w-full shadow-md" /> : <div className="text-slate-400 flex flex-col items-center gap-2"><FileText className="w-10 h-10" /><span className="text-xs">{t("protectPdf.loadingPreview")}</span></div>}
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10"><div className="w-12 h-12 bg-emerald-600/90 rounded-full flex items-center justify-center shadow-lg"><Lock className="w-6 h-6 text-white" /></div></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 truncate max-w-xs">{meta.name}{pageCount > 0 && ` · ${pageCount} ${pageCount > 1 ? t("protectPdf.pagesWord") : t("protectPdf.pageWord")}`}</p>
                  </div>
                  {/* Password form */}
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">{t("protectPdf.setPassword")}</h3>
                    <p className="text-sm text-slate-500 mb-4">{t("protectPdf.setPasswordHint")}</p>

                    <label className="block text-xs font-medium text-slate-600 mb-1">{t("protectPdf.passwordLabel")}</label>
                    <div className="relative mb-3">
                      <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("protectPdf.passwordPlaceholder")}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {password && (
                      <div className="mb-3">
                        <div className="flex gap-1 mb-1">
                          {[0, 1, 2].map((i) => (<div key={i} className={`h-1.5 flex-1 rounded-full ${i <= sLevel - 1 ? sColors[sLevel] : "bg-slate-200"}`} />))}
                        </div>
                        <span className="text-xs text-slate-500">{sLabels[sLevel]}</span>
                      </div>
                    )}

                    <label className="block text-xs font-medium text-slate-600 mb-1">{t("protectPdf.confirmLabel")}</label>
                    <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("protectPdf.confirmPlaceholder")}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none mb-4" />

                    <button onClick={handleProtect} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4" /> {t("protectPdf.protectButton")}
                    </button>
                    {error && <p className="mt-3 text-sm text-red-700 font-medium">{error}</p>}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                  <p className="font-bold text-slate-900 mb-1">{stage}</p>
                  <p className="text-sm text-slate-600 mb-4">{progress}{t("protectPdf.preview.percentComplete")}</p>
                  <div className="max-w-xs mx-auto bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-gradient-to-r from-emerald-600 to-teal-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} /></div>
                </div>
              )}
            </div>
            {!processing && <PrivacyNotice minutes={60} variant="inline" className="mt-4" />}
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{t("protectPdf.preview.whatYouGet")}</h3>
              <div className="space-y-2.5">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${b.c.split(" ")[1]}`}><b.Icon className={`w-3.5 h-3.5 ${b.c.split(" ")[0]}`} /></div>
                    <span className="text-xs text-slate-700">{b.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">Advertisement</p>
              <AdSenseUnit adSlot="1617102171" />
            </div>
          </div>
        </div>
      </div>
      {DailyLimitGate}
    </Layout>
  )
}
