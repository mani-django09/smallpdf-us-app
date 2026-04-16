import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/router"
import Head from "next/head"
import Link from "next/link"
import Layout from "../../components/Layout"
import { getApiUrl } from "../../lib/getApiUrl"
import {
  Calendar, User, Eye, Tag, Share2,
  Facebook, Twitter, Linkedin, ArrowRight,
  Clock, Copy, Check, ChevronRight, BookOpen,
  ArrowLeft,
} from "lucide-react"

// ── Smart content processor ────────────────────────────────────────────────
// Handles mixed content: plain text + HTML tags together.
// Rules:
//   • Lines that ARE block HTML tags (h1-h6, p, ul, ol, table, blockquote,
//     pre, hr, div) → output verbatim
//   • Consecutive lines that look like list items (start with ✅❌✔️•-*
//     or a digit+dot) → group into <ul> or <ol>
//   • Empty lines → block separator
//   • Everything else → wrap in <p>
function processContent(raw) {
  if (!raw) return ""

  const BLOCK_TAG  = /^\s*<(h[1-6]|p|ul|ol|li|table|blockquote|pre|hr|div|figure|img|br)[^>]*>/i
  const LIST_ITEM  = /^([\u2705\u274C\u2714\u2022\u25CF\u2713\u2717\-\*]|\d+[\.\)])\s+/  // ✅❌✔✓✗•●-* or 1. 1)
  // A "naked list item": short line, no ending sentence punctuation, not a heading
  const NAKED_ITEM = (line) => line.length < 80 && !/[.!?:,]$/.test(line) && !BLOCK_TAG.test(line)

  const lines   = raw.split("\n")
  const out     = []
  let listBuf   = []   // pending list items
  let listType  = ""   // "ul" | "ol"
  let plainBuf  = []   // pending plain-text lines

  const flushList = () => {
    if (!listBuf.length) return
    const tag = listType || "ul"
    out.push(`<${tag}>${listBuf.map(t => `<li>${t}</li>`).join("")}</${tag}>`)
    listBuf = []; listType = ""
  }

  const flushPlain = () => {
    if (!plainBuf.length) return
    const text = plainBuf.join(" ").trim()
    if (text) out.push(`<p>${text}</p>`)
    plainBuf = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // Empty line → flush buffers
    if (!line.trim()) {
      flushList()
      flushPlain()
      continue
    }

    // Already a block HTML element → output verbatim
    if (BLOCK_TAG.test(line)) {
      flushList()
      flushPlain()
      out.push(line)
      continue
    }

    // List item
    if (LIST_ITEM.test(line)) {
      flushPlain()
      const isOrdered = /^\d+[\.\)]/.test(line)
      const newType = isOrdered ? "ol" : "ul"
      if (listType && listType !== newType) flushList()
      listType = newType
      listBuf.push(line.replace(LIST_ITEM, "").trim())
      continue
    }

    // If already in a list and this short line has no punctuation → extend list
    if (listBuf.length && NAKED_ITEM(line)) {
      listBuf.push(line.trim())
      continue
    }

    // If plain buffer already has ≥2 short naked lines, treat them as a list
    // (e.g. "PDF too large\nNeed to merge\nWant to extract" → <ul>)
    if (plainBuf.length >= 2 && plainBuf.every(NAKED_ITEM) && NAKED_ITEM(line)) {
      flushList()
      // Convert accumulated plain lines to list
      listType = "ul"
      listBuf  = plainBuf.map(l => l.trim())
      plainBuf = []
      listBuf.push(line.trim())
      continue
    }

    flushList()
    plainBuf.push(line)
  }

  flushList()
  flushPlain()

  return out.join("\n")
}

// ── Estimate reading time ──────────────────────────────────────────────────
function readingTime(content) {
  const words = content?.replace(/<[^>]*>/g, "").split(/\s+/).length || 0
  return Math.max(1, Math.ceil(words / 200))
}

// ── Format date nicely ─────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  })
}

// ── Copy-link button ───────────────────────────────────────────────────────
function CopyLinkBtn() {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handle}
      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all text-sm font-medium"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied!" : "Copy Link"}
    </button>
  )
}

export default function BlogPost() {
  const router = useRouter()
  const { slug } = router.query
  const [post, setPost]           = useState(null)
  const [relatedPosts, setRelated] = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeId, setActiveId]   = useState("")
  const [toc, setToc]             = useState([])
  const contentRef = useRef(null)

  useEffect(() => { if (slug) fetchPost() }, [slug])

  const fetchPost = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${getApiUrl()}/api/blog/post/${slug}`)
      const data = await res.json()
      if (data.success) {
        setPost(data.post)
        setRelated(data.relatedPosts)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Build table of contents from rendered headings
  useEffect(() => {
    if (!post || !contentRef.current) return
    const headings = contentRef.current.querySelectorAll("h1,h2,h3")
    const items = []
    headings.forEach((h, i) => {
      if (!h.id) h.id = `heading-${i}`
      items.push({ id: h.id, text: h.textContent, tag: h.tagName })
    })
    setToc(items)
  }, [post])

  // Highlight active TOC item on scroll
  useEffect(() => {
    if (!toc.length) return
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.id) })
      },
      { rootMargin: "-20% 0% -70% 0%" }
    )
    toc.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [toc])

  const sharePost = (platform) => {
    const url   = window.location.href
    const title = post.title
    const urls  = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter:  `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    }
    window.open(urls[platform], "_blank", "width=600,height=400")
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Loading article…</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!post) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Post Not Found</h1>
            <p className="text-slate-500 mb-6">The article you're looking for doesn't exist.</p>
            <Link href="/blog" className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Blog
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const htmlContent = processContent(post.content)
  const mins        = readingTime(post.content)

  return (
    <Layout title={`${post.title} — SmallPDF.us Blog`} description={post.excerpt}>
      <Head>
        <meta property="og:title"       content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:type"        content="article" />
        {post.featuredImage && <meta property="og:image" content={post.featuredImage} />}
      </Head>

      {/* ── Article-level CSS ─────────────────────────────────────────── */}
      <style jsx global>{`
        .blog-content { font-family: 'Georgia', 'Times New Roman', serif; }
        .blog-content h1,.blog-content h2,.blog-content h3,.blog-content h4 {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 700; color: #0f172a; line-height: 1.3;
          scroll-margin-top: 80px;
        }
        .blog-content h2 { font-size: 1.6rem; margin: 2.5rem 0 1rem; padding-bottom: .5rem; border-bottom: 2px solid #f1f5f9; }
        .blog-content h3 { font-size: 1.25rem; margin: 2rem 0 .75rem; color: #1e293b; }
        .blog-content h4 { font-size: 1.05rem; margin: 1.5rem 0 .5rem; color: #334155; }
        .blog-content p  { margin-bottom: 1.4rem; line-height: 1.85; color: #374151; font-size: 1.05rem; }
        .blog-content ul,.blog-content ol { margin: 0 0 1.4rem 1.5rem; }
        .blog-content li { margin-bottom: .6rem; line-height: 1.75; color: #374151; font-size: 1.05rem; }
        .blog-content ul li { list-style-type: disc; }
        .blog-content ol li { list-style-type: decimal; }
        .blog-content a  { color: #dc2626; font-weight: 500; text-decoration-thickness: 1px; text-underline-offset: 2px; }
        .blog-content a:hover { color: #b91c1c; }
        .blog-content strong { color: #0f172a; font-weight: 700; }
        .blog-content em { font-style: italic; color: #475569; }
        .blog-content code {
          background: #fef2f2; color: #dc2626; padding: 2px 6px;
          border-radius: 4px; font-size: .875rem; font-family: 'Fira Code', monospace;
        }
        .blog-content pre {
          background: #1e293b; color: #e2e8f0; padding: 1.25rem 1.5rem;
          border-radius: .75rem; overflow-x: auto; margin: 1.5rem 0;
        }
        .blog-content pre code { background: transparent; color: inherit; padding: 0; }
        .blog-content img {
          max-width: 100%; height: auto; border-radius: .75rem;
          margin: 2rem auto; display: block; box-shadow: 0 4px 24px rgba(0,0,0,.1);
        }
        .blog-content blockquote {
          border-left: 4px solid #dc2626; background: #fff7f7;
          padding: 1rem 1.25rem; margin: 1.5rem 0; border-radius: 0 .5rem .5rem 0;
          font-style: italic; color: #64748b;
        }
        .blog-content table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
        .blog-content th { background: #f8fafc; font-weight: 600; color: #1e293b; }
        .blog-content th,.blog-content td { padding: .75rem 1rem; border: 1px solid #e2e8f0; font-size: .95rem; }
        .blog-content hr { border: none; border-top: 2px solid #f1f5f9; margin: 2rem 0; }
      `}</style>

      <div className="bg-slate-50 min-h-screen">

        {/* ── Hero / Header ─────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-4 pt-10 pb-10">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-6">
              <Link href="/" className="hover:text-red-600 transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/blog" className="hover:text-red-600 transition-colors">Blog</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-600 font-medium truncate max-w-[200px]">{post.category}</span>
            </nav>

            {/* Category badge */}
            <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-5 uppercase tracking-wide">
              {post.category}
            </span>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-6 max-w-3xl">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg text-slate-500 max-w-2xl mb-6 leading-relaxed">{post.excerpt}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-xs">
                  {post.author?.[0]?.toUpperCase() || "A"}
                </div>
                <span className="font-semibold text-slate-700">{post.author || "Admin"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(post.createdAt)}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {mins} min read
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {post.views} views
              </div>
            </div>
          </div>
        </div>

        {/* ── Featured image ─────────────────────────────────────────────── */}
        {post.featuredImage && (
          <div className="max-w-5xl mx-auto px-4 -mt-0 pt-8">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full max-h-[420px] object-cover rounded-2xl shadow-lg"
            />
          </div>
        )}

        {/* ── Two-column layout: content + sidebar ────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex gap-10 items-start">

            {/* ── Main content ──────────────────────────────────────────── */}
            <article className="flex-1 min-w-0">
              {/* Content card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 md:p-12 mb-8">
                <div
                  ref={contentRef}
                  className="blog-content"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              </div>

              {/* Tags */}
              {post.tags?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    {post.tags.map(tag => (
                      <Link
                        key={tag}
                        href={`/blog?tag=${tag}`}
                        className="px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Share */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8">
                <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-slate-400" />
                  Share this article
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => sharePost("facebook")}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                  >
                    <Facebook className="w-4 h-4" /> Facebook
                  </button>
                  <button
                    onClick={() => sharePost("twitter")}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                  >
                    <Twitter className="w-4 h-4" /> Twitter
                  </button>
                  <button
                    onClick={() => sharePost("linkedin")}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                  >
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </button>
                  <CopyLinkBtn />
                </div>
              </div>

              {/* Author card */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 mb-8 text-white">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                    {post.author?.[0]?.toUpperCase() || "A"}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{post.author || "SmallPDF.us Team"}</p>
                    <p className="text-slate-400 text-sm mt-1">
                      PDF tools expert — writing guides to help you work faster with documents.
                    </p>
                    <Link
                      href="/blog"
                      className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm font-medium mt-3 transition-colors"
                    >
                      More articles <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Related posts */}
              {relatedPosts.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-5">Related Articles</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {relatedPosts.map(related => (
                      <Link
                        key={related.id}
                        href={`/blog/${related.slug}`}
                        className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all"
                      >
                        {related.featuredImage ? (
                          <div className="h-36 overflow-hidden bg-slate-100">
                            <img
                              src={related.featuredImage}
                              alt={related.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ) : (
                          <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-slate-300" />
                          </div>
                        )}
                        <div className="p-5">
                          <h3 className="font-semibold text-slate-900 mb-1.5 group-hover:text-red-600 transition-colors line-clamp-2 text-sm leading-snug">
                            {related.title}
                          </h3>
                          <p className="text-xs text-slate-500 line-clamp-2">{related.excerpt}</p>
                          <div className="flex items-center gap-1 text-red-600 text-xs font-semibold mt-3">
                            Read More <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to blog */}
              <div className="mt-10 text-center">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 border-2 border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-600 px-6 py-3 rounded-xl font-semibold transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Blog
                </Link>
              </div>
            </article>

            {/* ── Sidebar ───────────────────────────────────────────────── */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24 space-y-6">

                {/* Table of contents */}
                {toc.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Table of Contents
                    </p>
                    <nav className="space-y-1">
                      {toc.map(item => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className={`block text-sm py-1 transition-colors leading-snug ${
                            item.tag === "H3" ? "pl-4 text-xs" : item.tag === "H4" ? "pl-6 text-xs" : ""
                          } ${
                            activeId === item.id
                              ? "text-red-600 font-semibold"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          {item.text}
                        </a>
                      ))}
                    </nav>
                  </div>
                )}

                {/* Quick share sidebar */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Share</p>
                  <div className="space-y-2">
                    {[
                      { platform: "facebook", label: "Facebook",  bg: "bg-[#1877F2]", Icon: Facebook },
                      { platform: "twitter",  label: "Twitter",   bg: "bg-[#1DA1F2]", Icon: Twitter  },
                      { platform: "linkedin", label: "LinkedIn",  bg: "bg-[#0A66C2]", Icon: Linkedin },
                    ].map(({ platform, label, bg, Icon }) => (
                      <button
                        key={platform}
                        onClick={() => sharePost(platform)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white text-sm font-medium ${bg} hover:opacity-90 transition-opacity`}
                      >
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA box */}
                <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl p-5 text-white text-center">
                  <p className="font-bold text-base mb-1">Try SmallPDF.us Free</p>
                  <p className="text-red-100 text-xs mb-4 leading-snug">Compress, merge, convert PDFs — all tools free.</p>
                  <Link
                    href="/"
                    className="block bg-white text-red-600 font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    Start for Free →
                  </Link>
                </div>

              </div>
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  )
}
