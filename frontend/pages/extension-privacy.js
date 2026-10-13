import Layout from "../components/Layout"
import SEOHead from "../components/SEOHead"
import { getPageMessages } from "../lib/i18nLoader"
import { Shield, Database, Globe, Mail } from "lucide-react"

export default function ExtensionPrivacy() {
  return (
    <Layout>
      <SEOHead
        title="Chrome Extension Privacy Policy — SmallPDF.us"
        description="Privacy policy for the SmallPDF.us Chrome extension: what data it accesses, what it stores, and what it never sends anywhere."
        noIndex={true}
      />
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="relative bg-gradient-to-br from-slate-950 to-slate-900 py-10 md:py-14 px-4">
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 mb-4">
              <Shield className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Chrome Extension</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
              Privacy Policy
            </h1>
            <p className="text-slate-300 text-sm max-w-xl mx-auto">
              For the SmallPDF.us browser extension. Last updated September 2026.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-12 space-y-10 text-sm text-gray-700 leading-relaxed">

          <section>
            <p>
              This extension is a launcher for smallpdf.us tools — it does not process,
              upload, or read the contents of any file. Every action opens the matching
              tool page on smallpdf.us in a new tab, where our{" "}
              <a href="/privacy" className="text-red-600 font-semibold hover:underline">main privacy policy</a>{" "}
              applies to whatever you do there.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-black text-gray-900">What it stores</h2>
            </div>
            <p>
              The names of your last 4 used tools, saved locally in your browser via the
              standard <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">chrome.storage.local</code> API
              so the popup can show "Recently used." This never leaves your device and is
              never sent to us or anyone else.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-violet-600" />
              <h2 className="text-base font-black text-gray-900">What it reads</h2>
            </div>
            <p>
              When you open the popup, the extension reads the URL of your <em>current active tab</em> —
              nothing else, and only at that moment — to suggest a matching tool (for example,
              offering "Compress PDF" if you have a .pdf file open). It does not read page
              content, run in the background, or track your browsing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-black text-gray-900 mb-3">What it never does</h2>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Never collects, transmits, or sells any personal data</li>
              <li>Never reads file contents — your files stay on your device until you choose to upload them on smallpdf.us itself</li>
              <li>Never injects scripts into pages you visit</li>
              <li>Never tracks browsing history</li>
            </ul>
          </section>

          <section>
            <p className="text-xs text-gray-500">
              Links you open from the extension carry standard UTM parameters
              (<code className="bg-gray-100 px-1 py-0.5 rounded">utm_source=chrome_extension</code>) so we can
              see in aggregate analytics how many people use the extension — the same kind of
              tag any "shared from X" link carries. This is not personal data and is not tied
              to you individually.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-red-600" />
              <h2 className="text-base font-black text-gray-900">Questions</h2>
            </div>
            <p>
              <a href="mailto:support@smallpdf.us" className="text-red-600 font-semibold hover:underline">
                support@smallpdf.us
              </a>
            </p>
          </section>

        </div>
      </div>
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
