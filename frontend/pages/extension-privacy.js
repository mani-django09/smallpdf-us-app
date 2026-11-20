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
              For the SmallPDF.us browser extension. Last updated November 2026 (version 1.1).
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-12 space-y-10 text-sm text-gray-700 leading-relaxed">

          <section>
            <p>
              This extension is a launcher for smallpdf.us tools — it does not convert or
              edit files itself. Every action opens the matching tool page on smallpdf.us in
              a new tab, where our{" "}
              <a href="/privacy" className="text-red-600 font-semibold hover:underline">main privacy policy</a>{" "}
              applies to whatever you do there.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-black text-gray-900">Sending a file to a tool</h2>
            </div>
            <p>
              When <em>you</em> choose a tool for a PDF or image you are viewing (from the popup or the
              right-click menu), the extension downloads that one file and places it into the upload
              field of the smallpdf.us tool page it just opened — exactly as if you had picked the file
              yourself. The file goes only to smallpdf.us, and only after that click. Nothing is
              downloaded or sent without it.
            </p>
            <p className="mt-3">
              To do this, the extension runs a small script on smallpdf.us tool pages that it opened.
              It does not run scripts on any other website. Files behind a link or image on
              another website can only be fetched if you turn on "Files from links &amp; images" in
              the popup, which asks your browser for that permission; you can turn it off at any time.
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
              content or track your browsing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-black text-gray-900 mb-3">What it never does</h2>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Never collects, transmits, or sells any personal data</li>
              <li>Never downloads or sends a file unless you pick a tool for it</li>
              <li>Never runs scripts on websites other than smallpdf.us</li>
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
