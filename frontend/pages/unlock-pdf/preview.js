import { useState, useEffect, useRef } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import SEOHead from "../../components/SEOHead"
import { FileText, ArrowLeft, Key, Shield, Zap, Clock, Unlock, Trash2, CheckCircle, Lock, AlertTriangle } from "lucide-react"
import { useTranslations } from "../../lib/i18n"

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

export default function PreviewUnlockPdf() {
  const router = useLocalizedRouter()
  const { t } = useTranslations()
  const [filesData, setFilesData] = useState([])
  const [unlocking, setUnlocking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [passwords, setPasswords] = useState({})
  const [errors, setErrors] = useState({})

  // ✅ FIX: Use a ref for router inside useEffect to avoid infinite re-render loop.
  // useLocalizedRouter() returns a new object each render, so putting it in the
  // dependency array causes: effect runs → router changes → effect runs → loop.
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router })

  useEffect(() => {
    const storedFiles = sessionStorage.getItem("uploadedUnlockPdfFiles")

    if (storedFiles) {
      try {
        const parsed = JSON.parse(storedFiles)
        setFilesData(parsed)
      } catch (err) {
        console.error("Error parsing file data:", err)
        routerRef.current.push("/unlock-pdf")
      }
    } else {
      routerRef.current.push("/unlock-pdf")
    }
  }, []) // ✅ Empty deps — runs once on mount only

  const handlePasswordChange = (id, value) => {
    setPasswords((prev) => ({ ...prev, [id]: value }))
    if (errors[id]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[id]
        return newErrors
      })
    }
  }

  const removeFile = (id) => {
    const newFiles = filesData.filter((f) => f.id !== id)
    setFilesData(newFiles)
    sessionStorage.setItem("uploadedUnlockPdfFiles", JSON.stringify(newFiles))

    setPasswords((prev) => {
      const newPasswords = { ...prev }
      delete newPasswords[id]
      return newPasswords
    })
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[id]
      return newErrors
    })

    if (newFiles.length === 0) {
      routerRef.current.push("/unlock-pdf")
    }
  }

  const handleUnlock = async () => {
    if (filesData.length === 0) return

    setUnlocking(true)
    setProgress(0)
    setStage(t("unlockPdf.previewStage1"))

    const stages = [
      { progress: 20, text: t("unlockPdf.previewStage2"), delay: 400 },
      { progress: 40, text: t("unlockPdf.previewStage3"), delay: 500 },
      { progress: 60, text: t("unlockPdf.previewStage4"), delay: 600 },
      { progress: 80, text: t("unlockPdf.previewStage5"), delay: 400 },
      { progress: 95, text: t("unlockPdf.previewStage6"), delay: 300 },
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

    try {
      const formData = new FormData()

      for (const fileData of filesData) {
        const response = await fetch(fileData.data)
        const blob = await response.blob()
        const file = new File([blob], fileData.name, { type: "application/pdf" })
        formData.append("files", file)
      }

      const passwordData = {}
      filesData.forEach((file) => {
        if (passwords[file.id]) {
          passwordData[file.name] = passwords[file.id]
        }
      })
      formData.append("passwords", JSON.stringify(passwordData))

      const API_URL = (() => {
        if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
        const { hostname, protocol } = window.location
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'
        }
        return `${protocol}//${hostname}`
      })()
      const response = await fetch(`${API_URL}/api/unlock-pdf`, {
        method: "POST",
        body: formData,
      })

      setProgress(100)
      setStage(t("unlockPdf.previewStageDone"))

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || "Unlock failed")
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Something went wrong")
      }

      sessionStorage.setItem("unlockPdfResult", JSON.stringify(result))
      sessionStorage.removeItem("uploadedUnlockPdfFiles")

      setTimeout(() => {
        router.push("/unlock-pdf/download")
      }, 800)
    } catch (error) {
      console.error("Unlock error:", error)
      setUnlocking(false)
      setProgress(0)
      setStage("")

      if (error.message.includes("password") || error.message.includes("incorrect")) {
        alert(t("unlockPdf.previewPasswordErrorMsg"))
      } else {
        alert(t("unlockPdf.previewUnlockErrorMsg").replace("{message}", error.message))
      }
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const count = filesData.length
  const plural = count !== 1 ? "s" : ""

  return (
    <Layout>
      <SEOHead noIndex={true} />
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header Ad */}
          <div className="mb-6">
            <AdSenseUnit adSlot="8004544994" />
          </div>

          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push("/unlock-pdf")}
              className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-semibold mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t("unlockPdf.previewBackBtn")}</span>
            </button>

            <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">
                    {t("unlockPdf.previewTitle")}
                  </h1>
                  <p className="text-slate-600">
                    {t("unlockPdf.previewSubtitle").replace("{count}", count).replaceAll("{plural}", plural)}
                  </p>
                </div>

                <div className="hidden md:block">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Unlock className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Files List */}
          <div className="space-y-4 mb-6">
            {filesData.map((file) => (
              <div
                key={file.id}
                className="bg-white rounded-xl shadow-md border border-slate-200 p-5 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-red-600" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate mb-1">{file.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <span>{formatFileSize(file.size)}</span>
                          <span className="text-slate-400">•</span>
                          <div className="flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            <span>{t("unlockPdf.previewLockedBadge")}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t("unlockPdf.previewRemoveTitle")}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor={`password-${file.id}`} className="block text-sm font-semibold text-slate-700">
                        {t("unlockPdf.previewPasswordLabel")}
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          id={`password-${file.id}`}
                          value={passwords[file.id] || ""}
                          onChange={(e) => handlePasswordChange(file.id, e.target.value)}
                          placeholder={t("unlockPdf.previewPasswordPlaceholder")}
                          className="w-full px-4 py-2.5 pl-10 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none text-slate-900"
                          disabled={unlocking}
                        />
                        <Key className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      </div>
                      {errors[file.id] && (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span>{errors[file.id]}</span>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 italic">
                        {t("unlockPdf.previewPasswordHint")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          {unlocking && (
            <div className="bg-white rounded-xl shadow-lg p-5 border-2 border-amber-200 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                  <Unlock className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 mb-1">{stage}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="font-semibold">{progress}%</span>
                    <span className="text-slate-400">•</span>
                    <span>{t("unlockPdf.previewProgressWorking")}</span>
                  </div>
                </div>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500 ease-out shadow-lg"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="bg-white rounded-xl shadow-lg p-5 border border-slate-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  <span>{t("unlockPdf.previewSecureLabel")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-600" />
                  <span>{t("unlockPdf.previewFastLabel")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span>{t("unlockPdf.previewAutoDeleteLabel")}</span>
                </div>
              </div>

              <button
                onClick={handleUnlock}
                disabled={unlocking || filesData.length === 0}
                className={`inline-flex items-center gap-3 px-7 py-3 rounded-lg font-bold transition-all shadow-xl ${
                  unlocking || filesData.length === 0
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 hover:shadow-2xl"
                }`}
              >
                <Unlock className="w-5 h-5" />
                <span>
                  {unlocking
                    ? t("unlockPdf.previewUnlockingBtn")
                    : t("unlockPdf.previewUnlockBtn").replace("{count}", count).replaceAll("{plural}", plural)
                  }
                </span>
              </button>
            </div>
          </div>

          {/* Info Boxes */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-green-900 mb-1">{t("unlockPdf.previewInfoSecureTitle")}</h4>
                  <p className="text-sm text-green-700">{t("unlockPdf.previewInfoSecureDesc")}</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Unlock className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-900 mb-1">{t("unlockPdf.previewInfoUnlockedTitle")}</h4>
                  <p className="text-sm text-amber-700">{t("unlockPdf.previewInfoUnlockedDesc")}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-blue-900 mb-1">{t("unlockPdf.previewInfoQualityTitle")}</h4>
                  <p className="text-sm text-blue-700">{t("unlockPdf.previewInfoQualityDesc")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Ad */}
          <div className="mt-6 bg-white rounded-xl p-3 shadow-sm border border-slate-200">
            <p className="text-xs text-center text-slate-400 mb-2 uppercase tracking-wide">Advertisement</p>
            <AdSenseUnit adSlot="1617102171" />
          </div>
        </div>
      </div>
    </Layout>
  )
}