import { useState } from "react"
import { Mail, CheckCircle } from "lucide-react"
import { useRouter } from "next/router"
import { getApiUrl } from "../lib/getApiUrl"

export default function EmailCapture({ className = "" }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("idle") // idle | loading | done | error

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (status === "loading" || status === "done") return
    setStatus("loading")
    try {
      const res = await fetch(`${getApiUrl()}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: router.asPath }),
      })
      if (!res.ok) throw new Error("failed")
      setStatus("done")
    } catch {
      setStatus("error")
    }
  }

  if (status === "done") {
    return (
      <div className={`flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 ${className}`}>
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>You're subscribed — we'll email you when new tools launch.</span>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/60 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 text-slate-500" />
        <p className="text-sm font-semibold text-slate-800">Get notified about new tools</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "Submitting…" : "Notify me"}
        </button>
      </form>
      {status === "error" && (
        <p className="text-xs text-red-600 mt-2">Something went wrong — please try again.</p>
      )}
    </div>
  )
}
