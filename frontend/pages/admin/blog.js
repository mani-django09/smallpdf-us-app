import { useState, useEffect } from "react"
import { formatISTDate } from "../../lib/adminTime"
import Layout from "../../components/Layout"
import { getApiUrl } from "../../lib/getApiUrl"
import { getPageMessages } from "../../lib/i18nLoader"
import {
  FileText,
  Upload,
  Save,
  Eye,
  Trash2,
  Edit,
  Image,
  Tag,
  Folder,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Link as LinkIcon,
  Copy,
} from "lucide-react"

export default function AdminBlog() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [token, setToken] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: "", text: "" })

  // Form state
  const [formData, setFormData] = useState({
    id: null,
    title: "",
    excerpt: "",
    content: "",
    author: "Admin",
    category: "PDF Tools",
    tags: "",
    status: "published",
  })
  const [featuredImage, setFeaturedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [generatedSlug, setGeneratedSlug] = useState("")

  useEffect(() => {
    const savedToken = localStorage.getItem("adminToken")
    if (savedToken) {
      setToken(savedToken)
      setIsAuthenticated(true)
      fetchPosts(savedToken)
    }
  }, [])

  // Generate slug when title changes
  useEffect(() => {
    if (formData.title) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      setGeneratedSlug(slug)
    } else {
      setGeneratedSlug("")
    }
  }, [formData.title])

  // Admin tokens expire after 12h. Always send the newest one (logging in
  // again at /admin in another tab refreshes localStorage), and on expiry keep
  // the editor contents instead of throwing the user out mid-post.
  const currentToken = () => localStorage.getItem("adminToken") || token
  const SESSION_EXPIRED = "Session expired. Log in again at /admin in a new tab, then click Save again — your post is kept here."

  const fetchPosts = async (authToken) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/blog/admin/posts`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (response.status === 401) {
        localStorage.removeItem("adminToken")
        setIsAuthenticated(false)
        return
      }
      const data = await response.json()
      if (data.success) {
        setPosts(data.posts)
      }
    } catch (error) {
      console.error("Error fetching posts:", error)
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFeaturedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const copySlugToClipboard = () => {
    const fullUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us'}/blog/${generatedSlug}`
    navigator.clipboard.writeText(fullUrl)
    setMessage({ type: "success", text: "Blog URL copied to clipboard!" })
    setTimeout(() => setMessage({ type: "", text: "" }), 3000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: "", text: "" })

    try {
      const formDataToSend = new FormData()
      formDataToSend.append("title", formData.title)
      formDataToSend.append("excerpt", formData.excerpt)
      formDataToSend.append("content", formData.content)
      formDataToSend.append("author", formData.author)
      formDataToSend.append("category", formData.category)
      formDataToSend.append("tags", formData.tags)
      formDataToSend.append("status", formData.status)
      
      if (featuredImage) {
        formDataToSend.append("featuredImage", featuredImage)
      }

      const url = formData.id
        ? `${getApiUrl()}/api/blog/update/${formData.id}`
        : `${getApiUrl()}/api/blog/create`
      
      const method = formData.id ? "PUT" : "POST"

      const response = await fetch(url, {
        method: method,
        headers: { Authorization: `Bearer ${currentToken()}` },
        body: formDataToSend,
      })
      if (response.status === 401) {
        setMessage({ type: "error", text: SESSION_EXPIRED })
        return
      }

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: "success", text: data.message })
        fetchPosts(currentToken())
        resetForm()
        setShowEditor(false)
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save post" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save post" })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (post) => {
    setFormData({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      author: post.author,
      category: post.category,
      tags: post.tags.join(", "),
      status: post.status,
    })
    setImagePreview(post.featured_image)
    setShowEditor(true)
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this post?")) return

    try {
      const response = await fetch(`${getApiUrl()}/api/blog/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${currentToken()}` },
      })
      if (response.status === 401) {
        setMessage({ type: "error", text: SESSION_EXPIRED })
        return
      }

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: "success", text: "Post deleted successfully" })
        fetchPosts(currentToken())
      } else {
        setMessage({ type: "error", text: data.error })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to delete post" })
    }
  }

  const resetForm = () => {
    setFormData({
      id: null,
      title: "",
      excerpt: "",
      content: "",
      author: "Admin",
      category: "PDF Tools",
      tags: "",
      status: "published",
    })
    setFeaturedImage(null)
    setImagePreview(null)
    setGeneratedSlug("")
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Blog Admin</h1>
              <p className="text-slate-600 text-sm mt-2">Please login to manage blog posts</p>
            </div>
            <button
              onClick={() => (window.location.href = "/admin")}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Go to Admin Login
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Blog Admin - SmallPDF.us" description="Manage blog posts">
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Blog Management</h1>
              <p className="text-slate-600 mt-1">Create and manage blog posts</p>
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowEditor(!showEditor)
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              <FileText className="w-5 h-5" />
              {showEditor ? "View Posts" : "New Post"}
            </button>
          </div>

          {/* Message */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
              message.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
            }`}>
              {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <p>{message.text}</p>
            </div>
          )}

          {/* Editor */}
          {showEditor ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Content */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Post Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        placeholder="Enter post title..."
                        required
                      />
                    </div>

                    {/* Slug Preview */}
                    {generatedSlug && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-blue-700 mb-1 flex items-center gap-2">
                              <LinkIcon className="w-4 h-4" />
                              Post URL Preview
                            </label>
                            <p className="text-sm text-blue-600 font-mono break-all">
                              {(process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us')}/blog/{generatedSlug}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={copySlugToClipboard}
                            className="ml-4 p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                            title="Copy URL"
                          >
                            <Copy className="w-4 h-4 text-blue-700" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Excerpt */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Excerpt</label>
                      <textarea
                        value={formData.excerpt}
                        onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        rows="3"
                        placeholder="Brief summary of the post..."
                      />
                    </div>

                    {/* Content */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
                      {/* HTML formatting toolbar */}
                      <div className="flex flex-wrap gap-1 mb-2 p-2 bg-slate-50 border border-slate-200 rounded-t-lg">
                        {[
                          { label: 'H2',     wrap: ['<h2>', '</h2>'] },
                          { label: 'H3',     wrap: ['<h3>', '</h3>'] },
                          { label: 'B',      wrap: ['<strong>', '</strong>'] },
                          { label: 'I',      wrap: ['<em>', '</em>'] },
                          { label: 'UL',     wrap: ['<ul>\n  <li>', '</li>\n</ul>'] },
                          { label: 'OL',     wrap: ['<ol>\n  <li>', '</li>\n</ol>'] },
                          { label: 'LI',     wrap: ['<li>', '</li>'] },
                          { label: 'P',      wrap: ['<p>', '</p>'] },
                          { label: 'Quote',  wrap: ['<blockquote>', '</blockquote>'] },
                          { label: 'HR',     wrap: ['<hr />', ''] },
                          { label: 'Code',   wrap: ['<code>', '</code>'] },
                          { label: 'Link',   wrap: ['<a href="URL">', '</a>'] },
                        ].map(({ label, wrap }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              const ta = document.getElementById('blog-content-ta')
                              const start = ta.selectionStart
                              const end   = ta.selectionEnd
                              const sel   = formData.content.substring(start, end)
                              const newVal = formData.content.substring(0, start) + wrap[0] + sel + wrap[1] + formData.content.substring(end)
                              setFormData({ ...formData, content: newVal })
                              setTimeout(() => { ta.focus(); ta.setSelectionRange(start + wrap[0].length, start + wrap[0].length + sel.length) }, 10)
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        id="blog-content-ta"
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-b-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none font-mono text-sm"
                        rows="24"
                        placeholder={`Write your post content in HTML.\n\nExample:\n<h2>Section Title</h2>\n<p>Your paragraph text here...</p>\n<ul>\n  <li>Point one</li>\n  <li>Point two</li>\n</ul>`}
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1.5">💡 Select text then click a toolbar button to wrap it with a tag.</p>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Featured Image */}
                    <div className="bg-slate-50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        Featured Image
                      </label>
                      {imagePreview && (
                        <div className="mb-3">
                          <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                      />
                    </div>

                    {/* Author */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Author
                      </label>
                      <input
                        type="text"
                        value={formData.author}
                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Folder className="w-4 h-4" />
                        Category
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      >
                        <option>PDF Tools</option>
                        <option>Tutorials</option>
                        <option>Tips & Tricks</option>
                        <option>News</option>
                        <option>General</option>
                      </select>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Tags
                      </label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        placeholder="pdf, convert, merge (comma separated)"
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          {formData.id ? "Update Post" : "Publish Post"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            /* Posts List */
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Views</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {posts.map((post) => (
                      <tr key={post.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {post.featured_image && (
                              <img src={post.featured_image} alt="" className="w-12 h-12 object-cover rounded" />
                            )}
                            <div>
                              <p className="font-medium text-slate-900">{post.title}</p>
                              <p className="text-sm text-slate-500">{post.author}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                            /blog/{post.slug}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{post.category}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            post.status === "published" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {post.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{post.views}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatISTDate(post.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => window.open(`/blog/${post.slug}`, "_blank")}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(post)}
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {posts.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No blog posts yet. Create your first post!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

// Layout (nav/footer) needs the common messages; without this the header shows raw keys.
export async function getStaticProps({ locale }) {
  return { props: { messages: getPageMessages(locale, []) } }
}
