// pages/404.js — Custom 404 page with SEO + helpful navigation
import Link from 'next/link'
import { FileSearch, Home, ArrowRight, Merge, Zap, FileText } from 'lucide-react'
import Layout from '../components/Layout'
import SEOHead from '../components/SEOHead'
import { useTranslations } from '../lib/i18n'

const QUICK_LINKS = [
  { href: '/merge-pdf',     label: 'Merge PDF',     Icon: Merge    },
  { href: '/compress-pdf',  label: 'Compress PDF',  Icon: Zap      },
  { href: '/pdf-to-word',   label: 'PDF to Word',   Icon: FileText },
]

export default function NotFound() {
  const { t } = useTranslations()

  return (
    <Layout title="Page Not Found — SmallPDF.us">
      <SEOHead
        title="Page Not Found (404) — SmallPDF.us"
        description="The page you're looking for doesn't exist. Go back to SmallPDF.us and use our free PDF tools."
        noIndex={true}
      />

      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center py-20">

        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mb-6">
          <FileSearch className="w-10 h-10 text-red-500" />
        </div>

        {/* Heading */}
        <p className="text-7xl font-black text-gray-100 leading-none mb-2 select-none">404</p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">
          Page not found
        </h1>
        <p className="text-gray-500 text-base max-w-md mb-8">
          The page you're looking for has moved or doesn't exist. Try one of our popular tools below, or go back home.
        </p>

        {/* Primary CTA */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm shadow-md mb-10"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Quick tool links */}
        <div className="w-full max-w-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Popular Tools
          </p>
          <div className="flex flex-col gap-2">
            {QUICK_LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between gap-3 bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 rounded-xl px-4 py-3 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{label}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Help link */}
        <p className="mt-8 text-sm text-gray-400">
          Need help?{' '}
          <Link href="/contact" className="text-red-500 hover:text-red-600 font-medium underline underline-offset-2">
            Contact support
          </Link>
        </p>
      </div>
    </Layout>
  )
}
