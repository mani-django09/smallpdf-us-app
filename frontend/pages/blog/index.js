import { useState, useEffect } from "react"
import Layout from "../../components/Layout"
import { Calendar, User, Eye, ArrowRight, Search, Tag, Folder } from "lucide-react"
import { getApiUrl } from "../../lib/getApiUrl"

export default function Blog() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedTag, setSelectedTag] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchPosts()
  }, [currentPage, selectedCategory, selectedTag])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 9,
      })
      
      if (selectedCategory) params.append("category", selectedCategory)
      if (selectedTag) params.append("tag", selectedTag)

      const response = await fetch(`${getApiUrl()}/api/blog/posts?${params}`)
      const data = await response.json()

      if (data.success) {
        setPosts(data.posts)
        setCategories(data.categories)
        setTags(data.tags)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error("Error fetching posts:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    try {
      const response = await fetch(`${getApiUrl()}/api/blog/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()

      if (data.success) {
        setPosts(data.results)
        setTotalPages(1)
      }
    } catch (error) {
      console.error("Error searching posts:", error)
    }
  }

  return (
    <Layout title="Blog - SmallPDF.us" description="Tips, tricks, and guides for PDF tools">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
      `}</style>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-red-600 via-orange-600 to-red-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">SmallPDF.us Blog</h1>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Tips, tricks, and guides to make the most of your PDF tools
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blog posts..."
                  className="w-full px-6 py-4 pr-12 rounded-xl text-slate-900 focus:ring-2 focus:ring-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Categories */}
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-500" />
              <select
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="">All Tags</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {(selectedCategory || selectedTag) && (
              <button
                onClick={() => {
                  setSelectedCategory("")
                  setSelectedTag("")
                  setCurrentPage(1)
                }}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Blog Posts Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 text-lg">No blog posts found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all group"
                >
                  {/* Featured Image */}
                  {post.featuredImage && (
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-gradient-to-r from-red-600 to-orange-600 text-white text-xs font-semibold rounded-full">
                          {post.category}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-6">
                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {post.author}
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {post.views}
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-red-600 transition-colors">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-slate-600 text-sm mb-4 line-clamp-3">{post.excerpt}</p>

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Read More */}
                    <a
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-semibold text-sm group/link"
                    >
                      Read More
                      <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </article>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}