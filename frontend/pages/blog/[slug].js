import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import Layout from "../../components/Layout"
import { getApiUrl } from "../../lib/getApiUrl"
import {
  Calendar,
  User,
  Eye,
  Tag,
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  ArrowRight,
  Clock,
} from "lucide-react"

export default function BlogPost() {
  const router = useRouter()
  const { slug } = router.query
  const [post, setPost] = useState(null)
  const [relatedPosts, setRelatedPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (slug) {
      fetchPost()
    }
  }, [slug])

  const fetchPost = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${getApiUrl()}/api/blog/post/${slug}`)
      const data = await response.json()

      if (data.success) {
        setPost(data.post)
        setRelatedPosts(data.relatedPosts)
      }
    } catch (error) {
      console.error("Error fetching post:", error)
    } finally {
      setLoading(false)
    }
  }

  const sharePost = (platform) => {
    const url = window.location.href
    const title = post.title

    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    }

    window.open(shareUrls[platform], "_blank", "width=600,height=400")
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert("Link copied to clipboard!")
  }

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading post...</p>
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
            <h1 className="text-3xl font-bold text-slate-900 mb-4">Post Not Found</h1>
            <p className="text-slate-600 mb-6">The blog post you're looking for doesn't exist.</p>
            <a
              href="/blog"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Back to Blog
            </a>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={`${post.title} - SmallPDF.us Blog`} description={post.excerpt}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        
        .blog-content h1 {
          font-size: 2.25rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #1e293b;
        }
        .blog-content h2 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #1e293b;
        }
        .blog-content h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #334155;
        }
        .blog-content p {
          margin-bottom: 1rem;
          line-height: 1.75;
          color: #475569;
        }
        .blog-content ul,
        .blog-content ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .blog-content li {
          margin-bottom: 0.5rem;
          line-height: 1.75;
          color: #475569;
        }
        .blog-content a {
          color: #dc2626;
          text-decoration: underline;
        }
        .blog-content a:hover {
          color: #b91c1c;
        }
        .blog-content code {
          background-color: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          color: #dc2626;
        }
        .blog-content pre {
          background-color: #1e293b;
          color: #e2e8f0;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .blog-content pre code {
          background-color: transparent;
          color: inherit;
          padding: 0;
        }
        .blog-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1.5rem 0;
        }
        .blog-content blockquote {
          border-left: 4px solid #dc2626;
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: #64748b;
        }
      `}</style>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="text-sm text-slate-600 mb-6">
          <a href="/" className="hover:text-red-600">
            Home
          </a>
          <span className="mx-2">/</span>
          <a href="/blog" className="hover:text-red-600">
            Blog
          </a>
          <span className="mx-2">/</span>
          <span className="text-slate-900">{post.category}</span>
        </div>

        {/* Category Badge */}
        <div className="mb-4">
          <span className="px-3 py-1 bg-gradient-to-r from-red-600 to-orange-600 text-white text-sm font-semibold rounded-full">
            {post.category}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">{post.title}</h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-6 text-slate-600 mb-8 pb-8 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5" />
            <span className="font-medium">{post.author}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <span>{new Date(post.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <span>{post.views} views</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span>{Math.ceil(post.content.split(" ").length / 200)} min read</span>
          </div>
        </div>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="mb-8">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-auto rounded-xl shadow-lg"
            />
          </div>
        )}

        {/* Share Buttons */}
        <div className="bg-slate-50 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Share this article
          </h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => sharePost("facebook")}
              className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white rounded-lg hover:shadow-lg transition-all"
            >
              <Facebook className="w-4 h-4" />
              Facebook
            </button>
            <button
              onClick={() => sharePost("twitter")}
              className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2] text-white rounded-lg hover:shadow-lg transition-all"
            >
              <Twitter className="w-4 h-4" />
              Twitter
            </button>
            <button
              onClick={() => sharePost("linkedin")}
              className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2] text-white rounded-lg hover:shadow-lg transition-all"
            >
              <Linkedin className="w-4 h-4" />
              LinkedIn
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all"
            >
              Copy Link
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="blog-content prose prose-lg max-w-none mb-8" dangerouslySetInnerHTML={{ __html: post.content }} />

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mb-8 pt-8 border-t border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-5 h-5 text-slate-500" />
              {post.tags.map((tag) => (
                <a
                  key={tag}
                  href={`/blog?tag=${tag}`}
                  className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  #{tag}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-12 pt-12 border-t border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((related) => (
                <a
                  key={related.id}
                  href={`/blog/${related.slug}`}
                  className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all"
                >
                  {related.featuredImage && (
                    <div className="h-40 overflow-hidden bg-slate-100">
                      <img
                        src={related.featuredImage}
                        alt={related.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-red-600 transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2">{related.excerpt}</p>
                    <div className="flex items-center gap-2 text-red-600 text-sm font-medium mt-3">
                      Read More
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Back to Blog */}
        <div className="mt-12 text-center">
          <a
            href="/blog"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            Back to Blog
          </a>
        </div>
      </article>
    </Layout>
  )
}