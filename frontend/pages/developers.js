// pages/developers.js — professional PDF API documentation.
import { useState } from "react"
import Layout from "../components/Layout"
import SEOHead from "../components/SEOHead"
import Link from "next/link"
import { useNamespaceMessages } from "../lib/i18n"
import { getPageMessages } from "../lib/i18nLoader"
import {
  Code2, KeyRound, Zap, Shield, Terminal, ChevronRight, Copy, Check,
  Layers, FileText, Image as ImageIcon, Lock, Gauge, Server, Clock, Globe,
} from "lucide-react"

const BASE = "https://smallpdf.us/api/v1"

// ── Code sample generators ──────────────────────────────────────────────────
function genCurl(ep) {
  const lines = [`curl -X POST ${BASE}${ep.path} \\`, `  -H "X-API-Key: YOUR_API_KEY" \\`]
  const fileLines = []
  for (const p of ep.params) {
    if (p.t.startsWith("file")) {
      if (ep.multi) { fileLines.push(`  -F "${p.n}=@image1.${ep.id.includes("png") ? "png" : ep.id.includes("jpg") ? "jpg" : "pdf"}" \\`, `  -F "${p.n}=@image2.${ep.id.includes("png") ? "png" : ep.id.includes("jpg") ? "jpg" : "pdf"}" \\`) }
      else fileLines.push(`  -F "${p.n}=@input.${ep.id === "word-to-pdf" ? "docx" : "pdf"}" \\`)
    } else if (p.req || p.n === "angle" || p.n === "quality" || p.n === "pages") {
      const ex = p.n === "password" ? "secret123" : p.n === "angle" ? "90" : p.n === "quality" ? "high" : p.n === "pages" ? "1-3" : "value"
      fileLines.push(`  -F "${p.n}=${ex}" \\`)
    }
  }
  return [...lines, ...fileLines, `  -o ${ep.out}`].join("\n")
}

function genNode(ep) {
  const fileExt = ep.id === "word-to-pdf" ? "docx" : ep.id.includes("png") ? "png" : ep.id.includes("jpg") ? "jpg" : "pdf"
  const appends = []
  for (const p of ep.params) {
    if (p.t.startsWith("file")) {
      if (ep.multi) { appends.push(`form.append('${p.n}', fs.createReadStream('a.${fileExt}'))`, `form.append('${p.n}', fs.createReadStream('b.${fileExt}'))`) }
      else appends.push(`form.append('${p.n}', fs.createReadStream('input.${fileExt}'))`)
    } else if (p.req || ["angle", "quality", "pages"].includes(p.n)) {
      const ex = p.n === "password" ? "secret123" : p.n === "angle" ? "90" : p.n === "quality" ? "high" : p.n === "pages" ? "1-3" : "value"
      appends.push(`form.append('${p.n}', '${ex}')`)
    }
  }
  return [
    `import axios from 'axios'`,
    `import FormData from 'form-data'`,
    `import fs from 'fs'`,
    ``,
    `const form = new FormData()`,
    ...appends,
    ``,
    `const { data } = await axios.post(`,
    `  '${BASE}${ep.path}',`,
    `  form,`,
    `  { headers: { ...form.getHeaders(), 'X-API-Key': 'YOUR_API_KEY' },`,
    `    responseType: 'arraybuffer' }`,
    `)`,
    `fs.writeFileSync('${ep.out}', data)`,
  ].join("\n")
}

function genPython(ep) {
  const fileExt = ep.id === "word-to-pdf" ? "docx" : ep.id.includes("png") ? "png" : ep.id.includes("jpg") ? "jpg" : "pdf"
  let filesLine, dataLine = ""
  const data = []
  for (const p of ep.params) {
    if (!p.t.startsWith("file") && (p.req || ["angle", "quality", "pages"].includes(p.n))) {
      const ex = p.n === "password" ? "secret123" : p.n === "angle" ? "90" : p.n === "quality" ? "high" : p.n === "pages" ? "1-3" : "value"
      data.push(`'${p.n}': '${ex}'`)
    }
  }
  if (ep.multi) {
    filesLine = `files = [('${ep.params[0].n}', open('a.${fileExt}','rb')), ('${ep.params[0].n}', open('b.${fileExt}','rb'))]`
  } else {
    filesLine = `files = {'file': open('input.${fileExt}','rb')}`
  }
  if (data.length) dataLine = `data = {${data.join(", ")}}`
  return [
    `import requests`,
    ``,
    filesLine,
    ...(dataLine ? [dataLine] : []),
    `r = requests.post(`,
    `    '${BASE}${ep.path}',`,
    `    headers={'X-API-Key': 'YOUR_API_KEY'},`,
    `    files=files${dataLine ? ", data=data" : ""})`,
    `open('${ep.out}', 'wb').write(r.content)`,
  ].join("\n")
}

const GEN = { curl: genCurl, node: genNode, python: genPython }
const LANGS = [{ id: "curl", label: "cURL" }, { id: "node", label: "Node.js" }, { id: "python", label: "Python" }]

const QUOTAS = [
  { plan: "Free",    calls: "50 / month",      price: "$0" },
  { plan: "Starter", calls: "1,000 / month",   price: "$9/mo" },
  { plan: "Pro",     calls: "10,000 / month",  price: "$19/mo" },
  { plan: "Max",     calls: "100,000 / month", price: "Contact sales" },
]
const ERRORS = [
  ["200", "—",                          "Success. The processed file is returned in the body."],
  ["400", "BAD_INPUT",                  "Missing or invalid file / parameters."],
  ["401", "NO_API_KEY · BAD_API_KEY",   "Missing, invalid or revoked key."],
  ["429", "QUOTA_EXCEEDED",             "Monthly quota used up — upgrade your plan."],
  ["500", "PROCESSING_ERROR",           "The file could not be processed."],
]

// ── Small components ──────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [c, setC] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setC(true); setTimeout(() => setC(false), 1500) }}
      className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors"
    >
      {c ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
    </button>
  )
}

function CodeBlock({ code }) {
  return (
    <div className="relative bg-slate-900 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/60">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Request</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 text-xs leading-relaxed overflow-x-auto text-slate-100"><code>{code}</code></pre>
    </div>
  )
}

const CAT_ICON = { organize: Layers, convert: FileText, optimize: Gauge, secure: Lock }

export default function Developers() {
  const [lang, setLang] = useState("curl")
  const d = useNamespaceMessages('developers')

  // Endpoint catalogue — descriptions stay in English (industry standard for API docs)
  const CATEGORIES = [
    { id: "organize", label: d.categories.organize },
    { id: "convert",  label: d.categories.convert  },
    { id: "optimize", label: d.categories.optimize },
    { id: "secure",   label: d.categories.secure   },
  ]

  const ENDPOINTS = [
    {
      id: "merge", name: "Merge PDF", path: "/merge", cat: "organize", multi: true, out: "merged.pdf",
      desc: "Combine two or more PDFs into a single document, in the order provided.",
      params: [{ n: "files", t: "file[]", req: true, d: "Two or more PDF files." }],
    },
    {
      id: "split", name: "Split PDF", path: "/split", cat: "organize", out: "split.pdf",
      desc: "Split a PDF. Without `pages` you receive a ZIP with one PDF per page; with `pages` you receive a single PDF of just those pages.",
      params: [
        { n: "file", t: "file", req: true, d: "The PDF to split." },
        { n: "pages", t: "string", req: false, d: 'Optional range, e.g. "1,3,5-7".' },
      ],
    },
    {
      id: "rotate", name: "Rotate PDF", path: "/rotate", cat: "organize", out: "rotated.pdf",
      desc: "Rotate every page by a multiple of 90 degrees.",
      params: [
        { n: "file", t: "file", req: true, d: "The PDF to rotate." },
        { n: "angle", t: "int", req: false, d: "90, 180 or 270. Default 90." },
      ],
    },
    {
      id: "pdf-to-word", name: "PDF to Word", path: "/pdf-to-word", cat: "convert", out: "converted.docx",
      desc: "Convert a PDF into an editable Word (.docx) document with layout preserved.",
      params: [{ n: "file", t: "file", req: true, d: "The PDF to convert." }],
    },
    {
      id: "word-to-pdf", name: "Word to PDF", path: "/word-to-pdf", cat: "convert", out: "converted.pdf",
      desc: "Convert a Word document (.doc, .docx, .odt, .rtf) into a PDF.",
      params: [{ n: "file", t: "file", req: true, d: "The document to convert." }],
    },
    {
      id: "pdf-to-jpg", name: "PDF to JPG", path: "/pdf-to-jpg", cat: "convert", out: "pages.zip", zip: true,
      desc: "Render each PDF page to a JPG image. Returns a ZIP archive.",
      params: [
        { n: "file", t: "file", req: true, d: "The PDF to convert." },
        { n: "quality", t: "string", req: false, d: "standard (150dpi) · high (300) · maximum (600)." },
      ],
    },
    {
      id: "pdf-to-png", name: "PDF to PNG", path: "/pdf-to-png", cat: "convert", out: "pages.zip", zip: true,
      desc: "Render each PDF page to a PNG image. Returns a ZIP archive.",
      params: [
        { n: "file", t: "file", req: true, d: "The PDF to convert." },
        { n: "quality", t: "string", req: false, d: "standard · high · maximum." },
      ],
    },
    {
      id: "jpg-to-pdf", name: "JPG to PDF", path: "/jpg-to-pdf", cat: "convert", multi: true, out: "images.pdf",
      desc: "Combine one or more JPG images into a single PDF (one image per page).",
      params: [{ n: "files", t: "file[]", req: true, d: "One or more JPG images." }],
    },
    {
      id: "png-to-pdf", name: "PNG to PDF", path: "/png-to-pdf", cat: "convert", multi: true, out: "images.pdf",
      desc: "Combine one or more PNG images into a single PDF (one image per page).",
      params: [{ n: "files", t: "file[]", req: true, d: "One or more PNG images." }],
    },
    {
      id: "compress", name: "Compress PDF", path: "/compress", cat: "optimize", out: "compressed.pdf",
      desc: "Reduce a PDF's file size with lossless stream compression.",
      params: [{ n: "file", t: "file", req: true, d: "The PDF to compress." }],
    },
    {
      id: "protect", name: "Protect PDF", path: "/protect", cat: "secure", out: "protected.pdf",
      desc: "Encrypt a PDF with AES-256 so it can only be opened with the password.",
      params: [
        { n: "file", t: "file", req: true, d: "The PDF to protect." },
        { n: "password", t: "string", req: true, d: "Password required to open the file." },
      ],
    },
  ]

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "SmallPDF.us PDF API Documentation",
    "description": "REST API to merge, split, rotate, compress, protect and convert PDF, Word and image files. Authenticate with an API key.",
  }

  return (
    <Layout title={d.pageTitle} description={d.pageDescription}>
      <SEOHead
        title={d.pageTitle}
        description={d.pageDescription}
        keywords="pdf api, rest pdf api, merge pdf api, pdf to word api, compress pdf api, convert pdf api, document api"
        structuredData={structuredData}
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 ring-1 ring-white/15 px-3 py-1.5 rounded-full mb-5">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold">{d.heroBadge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">{d.heroTitle}</h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-8">{d.heroDesc}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/account/api" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-3 rounded-lg font-bold transition-colors">
              {d.heroCtaPrimary}
            </Link>
            <a href="#quickstart" className="bg-white/10 hover:bg-white/20 ring-1 ring-white/15 px-6 py-3 rounded-lg font-semibold transition-colors">
              {d.heroCtaSecondary}
            </a>
          </div>
          {/* trust bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mt-12">
            {[
              { Icon: Server,  key: "endpoints" },
              { Icon: Zap,     key: "noSdk"     },
              { Icon: Shield,  key: "private"   },
              { Icon: Globe,   key: "anyLang"   },
            ].map(({ Icon, key }) => (
              <div key={key} className="bg-white/5 ring-1 ring-white/10 rounded-xl p-4">
                <Icon className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <div className="font-bold text-sm">{d.trust[key].title}</div>
                <div className="text-xs text-slate-400">{d.trust[key].desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 lg:grid lg:grid-cols-12 lg:gap-10">
        {/* Sticky TOC */}
        <aside className="hidden lg:block lg:col-span-3">
          <nav className="sticky top-24 space-y-1 text-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{d.toc.label}</p>
            {[
              ["quickstart",   d.toc.quickstart   ],
              ["authentication", d.toc.authentication],
              ["base-url",     d.toc.baseUrl       ],
              ["endpoints",    d.toc.endpoints     ],
              ["quota",        d.toc.quota         ],
              ["errors",       d.toc.errors        ],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">{label}</a>
            ))}
            <div className="pt-3">
              <Link href="/account/api" className="block px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition-colors">→ {d.toc.apiKeys}</Link>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <div className="lg:col-span-9 space-y-16">

          {/* Quick start */}
          <section id="quickstart" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-5">{d.sections.quickstart}</h2>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {[
                { Icon: KeyRound, key: "getKey"       },
                { Icon: Terminal, key: "callEndpoint" },
                { Icon: Zap,      key: "getResult"    },
              ].map(({ Icon, key }) => (
                <div key={key} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">{d.steps[key].title}</h3>
                  <p className="text-sm text-slate-600">{d.steps[key].desc}</p>
                </div>
              ))}
            </div>
            <CodeBlock code={genCurl(ENDPOINTS[0])} />
          </section>

          {/* Auth */}
          <section id="authentication" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">{d.sections.authentication}</h2>
            <p className="text-slate-600 mb-4">
              {d.auth.desc} <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono">X-API-Key</code> {d.auth.desc2}{" "}
              <Link href="/account/api" className="text-emerald-600 font-medium">{d.auth.dashboard}</Link>. {d.auth.warning}
            </p>
            <CodeBlock code={`X-API-Key: sk_live_xxxxxxxxxxxxxxxxxxxxxxxx`} />
          </section>

          {/* Base URL / responses */}
          <section id="base-url" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">{d.sections.baseUrl}</h2>
            <p className="text-slate-600 mb-4">
              {d.baseUrl.desc} <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono">POST</code> {d.baseUrl.desc2}
            </p>
            <div className="bg-slate-900 text-emerald-300 font-mono text-sm rounded-xl px-4 py-3 mb-4">{BASE}</div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> {d.baseUrl.bullet1}</li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> {d.baseUrl.bullet2} <code className="bg-slate-100 px-1 rounded">{`{ "error": "...", "code": "..." }`}</code></li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> {d.baseUrl.bullet3} <code className="bg-slate-100 px-1 rounded">X-RateLimit-Limit</code> / <code className="bg-slate-100 px-1 rounded">X-RateLimit-Remaining</code></li>
              <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /> {d.baseUrl.bullet4}</li>
            </ul>
          </section>

          {/* Endpoints */}
          <section id="endpoints" className="scroll-mt-24">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <h2 className="text-2xl font-bold text-slate-900">{d.sections.endpoints}</h2>
              {/* Language switcher */}
              <div className="inline-flex bg-slate-100 rounded-lg p-1">
                {LANGS.map((l) => (
                  <button key={l.id} onClick={() => setLang(l.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${lang === l.id ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {CATEGORIES.map((cat) => {
              const eps = ENDPOINTS.filter((e) => e.cat === cat.id)
              if (!eps.length) return null
              const CatIcon = CAT_ICON[cat.id]
              return (
                <div key={cat.id} className="mb-10">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                    <CatIcon className="w-4 h-4" /> {cat.label}
                  </h3>
                  <div className="space-y-6">
                    {eps.map((ep) => (
                      <div key={ep.id} id={ep.id} className="scroll-mt-24 border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[11px] font-bold text-white bg-emerald-600 px-2 py-1 rounded">POST</span>
                            <code className="text-sm font-mono text-slate-800">/v1{ep.path}</code>
                            <span className="text-sm font-semibold text-slate-700 ml-auto">{ep.name}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-2">{ep.desc}</p>
                        </div>
                        <div className="p-5 grid lg:grid-cols-2 gap-5">
                          {/* Params */}
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{d.params.label}</p>
                            <div className="space-y-2">
                              {ep.params.map((p) => (
                                <div key={p.n} className="text-sm">
                                  <div className="flex items-center gap-2">
                                    <code className="font-mono text-slate-800 font-medium">{p.n}</code>
                                    <span className="text-xs text-slate-400">{p.t}</span>
                                    {p.req
                                      ? <span className="text-[10px] uppercase font-bold text-red-500">{d.params.required}</span>
                                      : <span className="text-[10px] uppercase font-bold text-slate-400">{d.params.optional}</span>}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">{p.d}</p>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-4">
                              <strong>{d.params.returns}:</strong> {ep.zip ? "ZIP archive of images" : ep.out.endsWith(".docx") ? "Word .docx file" : "PDF file"} ·{" "}
                              <code className="bg-slate-100 px-1 rounded">{ep.out}</code>
                            </p>
                          </div>
                          {/* Code */}
                          <CodeBlock code={GEN[lang](ep)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>

          {/* Quota */}
          <section id="quota" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{d.sections.quota}</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">{d.quota.cols.plan}</th>
                    <th className="text-left px-4 py-3 font-semibold">{d.quota.cols.calls}</th>
                    <th className="text-left px-4 py-3 font-semibold">{d.quota.cols.price}</th>
                  </tr>
                </thead>
                <tbody>
                  {QUOTAS.map((q) => (
                    <tr key={q.plan} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-800">{q.plan}</td>
                      <td className="px-4 py-3 text-slate-600">{q.calls}</td>
                      <td className="px-4 py-3 text-slate-600">{q.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-500 mt-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {d.quota.note}{" "}
              <Link href="/pricing" className="text-emerald-600 font-medium ml-1">{d.quota.pricing} →</Link>
            </p>
          </section>

          {/* Errors */}
          <section id="errors" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{d.sections.errors}</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">{d.errors.cols.http}</th>
                    <th className="text-left px-4 py-3 font-semibold">{d.errors.cols.code}</th>
                    <th className="text-left px-4 py-3 font-semibold">{d.errors.cols.meaning}</th>
                  </tr>
                </thead>
                <tbody>
                  {ERRORS.map((e) => (
                    <tr key={e[0]} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-slate-800">{e[0]}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{e[1]}</td>
                      <td className="px-4 py-3 text-slate-600">{e[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-2">{d.cta.title}</h2>
            <p className="text-emerald-100 mb-6">{d.cta.desc}</p>
            <Link href="/account/api" className="inline-flex items-center gap-2 bg-white text-emerald-700 px-6 py-3 rounded-lg font-bold hover:bg-emerald-50 transition-colors">
              {d.cta.button} <ChevronRight className="w-4 h-4" />
            </Link>
          </section>
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ['developers']) },
    revalidate: 86400,
  }
}
