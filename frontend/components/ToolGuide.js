// ToolGuide — answer-first "how to" sections for long-tail searches, in every locale.
//
//   <ToolGuide tool="compress-pdf" />   "compress a PDF to 100 KB / 200 KB / 1 MB"
//   <ToolGuide tool="heic-to-jpg" />    "open HEIC on Windows", "iPhone HEIC to JPG"
//   <ToolGuide tool="unlock-pdf" />     "remove password from PDF"
//
// Content lives in messages/<locale>/<tool>.json under "guide" (title, intro, optional table,
// sections[{title, type: p|ul|ol, text|items}], optional footnote). A locale without a guide renders
// nothing. Inline markup in the strings: **bold** and [label](/en-path) — links are turned into the
// visitor's language with localePath(), so a German page links to /de/pdf-teilen/ etc.
//
// Every claim is taken from the code (checked 2026-10-28) — keep it in sync if the tools change:
//   compress levels + typical savings: backend/server.js compress settings (maximum/balanced/extreme)
//   HEIC→JPG quality 0.92: backend heic-convert call
//   unlock: qpdf --decrypt removes permissions-only encryption without a password; an open password
//           has to be entered (WRONG_PASSWORD otherwise) — nothing is cracked or guessed.
import Link from 'next/link'
import { useTranslations, useNamespaceMessages } from '../lib/i18n'
import { localePath } from '../lib/route-translations'

const NAMESPACE = { 'compress-pdf': 'compressPdf', 'heic-to-jpg': 'heicToJpg', 'unlock-pdf': 'unlockPdf' }

const H2 = 'font-display text-2xl md:text-3xl font-bold text-slate-900 mb-4'
const H3 = 'font-display text-lg md:text-xl font-bold text-slate-900 mt-8 mb-3'
const P = 'font-body text-slate-700 leading-relaxed mb-4'
const LI = 'font-body text-slate-700 leading-relaxed'

// "**bold**" and "[label](/en-path)" → React nodes. Plain text otherwise (no HTML is ever injected).
function Inline({ text, locale }) {
  const parts = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      parts.push(<strong key={m.index}>{m[1]}</strong>)
    } else {
      const href = localePath(m[3], locale).replace(/\/?$/, '/')
      parts.push(
        <Link key={m.index} href={href} className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">
          {m[2]}
        </Link>
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

export default function ToolGuide({ tool }) {
  const { locale } = useTranslations()
  const guide = useNamespaceMessages(NAMESPACE[tool])?.guide
  if (!guide || !guide.title) return null

  return (
    <section className="py-14 px-4 bg-white border-t border-slate-100">
      <div className="max-w-3xl mx-auto">
        <h2 className={H2}>{guide.title}</h2>
        {guide.intro && <p className={P}><Inline text={guide.intro} locale={locale} /></p>}

        {guide.table && (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-3">
              <table className="w-full text-left font-body text-sm">
                <thead className="bg-slate-50 text-slate-900">
                  <tr>{guide.table.headers.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="text-slate-700">
                  {guide.table.rows.map((r) => (
                    <tr key={r[0]} className="border-t border-slate-200">
                      {r.map((c, i) => <td key={i} className={`px-4 py-3 ${i === 0 ? 'font-semibold text-slate-900' : ''}`}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {guide.table.note && <p className="font-body text-sm text-slate-500 mb-4">{guide.table.note}</p>}
          </>
        )}

        {(guide.sections || []).map((s) => {
          const List = s.type === 'ol' ? 'ol' : 'ul'
          return (
            <div key={s.title}>
              <h3 className={H3}>{s.title}</h3>
              {s.type === 'p' ? (
                <p className={P}><Inline text={s.text || ''} locale={locale} /></p>
              ) : (
                <List className={`${s.type === 'ol' ? 'list-decimal' : 'list-disc'} pl-6 space-y-2 mb-4`}>
                  {(s.items || []).map((it, i) => <li key={i} className={LI}><Inline text={it} locale={locale} /></li>)}
                </List>
              )}
            </div>
          )
        })}

        {guide.footnote && <p className="font-body text-sm text-slate-500">{guide.footnote}</p>}
      </div>
    </section>
  )
}
