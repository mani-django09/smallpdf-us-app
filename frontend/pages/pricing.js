// pages/pricing.js
// Pricing page — Starter · Pro · Agency — Monthly & Yearly billing
// Razorpay checkout on CTA buttons.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SEOHead from '../components/SEOHead'
import {
  Check, X, Minus, Zap, Crown, Building2, FileText,
  ChevronDown, Sparkles, Shield, ArrowRight,
  Loader2, Star, Receipt,
} from 'lucide-react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { useTranslations } from '../lib/i18n'

// ── Plan definitions ──────────────────────────────────────────────────────────
// yearly = monthly × 10  (2 months free = ~17% off)
// NOTE: plan.name, plan.description, plan.cta, plan.badge are now translation keys
//       resolved in PlanCard via t(`pricing.plans.${plan.id}.xxx`)
const PLANS = [
  {
    id:           'starter',
    icon:         FileText,
    monthlyPrice: 9,
    yearlyPrice:  90,
    highlight:    false,
    color:        'blue',
    featureKeys: [
      { key: 'allTools',           included: true  },
      { key: 'upTo200MB',          included: true  },
      { key: 'officeUpTo50MB',     included: true  },
      { key: 'standardProcessing', included: true  },
      { key: 'retain24h',          included: true  },
      { key: 'adFree',             included: true  },
      { key: 'batch10',            included: true  },
      { key: 'priorityProcessing', included: false },
      { key: 'apiAccess',          included: false },
    ],
  },
  {
    id:           'pro',
    icon:         Zap,
    monthlyPrice: 19,
    yearlyPrice:  190,
    highlight:    true,
    color:        'red',
    featureKeys: [
      { key: 'everythingInStarter', included: true  },
      { key: 'unlimitedFileSize',   included: true  },
      { key: 'officeUnlimited',     included: true  },
      { key: 'priorityQueue',       included: true  },
      { key: 'retain48h',           included: true  },
      { key: 'adFree',              included: true  },
      { key: 'batch20',             included: true  },
      { key: 'emailSupport',        included: true  },
      { key: 'apiAccess',           included: false },
    ],
  },
  {
    id:           'agency',
    icon:         Building2,
    monthlyPrice: 49,
    yearlyPrice:  490,
    highlight:    false,
    color:        'purple',
    featureKeys: [
      { key: 'everythingInPro',      included: true },
      { key: 'unlimitedFileSize',    included: true },
      { key: 'dedicatedProcessing',  included: true },
      { key: 'retain72h',            included: true },
      { key: 'batch50',              included: true },
      { key: 'fullApiWebhooks',      included: true },
      { key: 'teamSeats',            included: true },
      { key: 'priorityPhoneEmail',   included: true },
      { key: 'customInvoicing',      included: true },
    ],
  },
]

const FREE_PLAN_FEATURE_KEYS = [
  { key: 'allTools',           included: true   },
  { key: 'upTo100MB',          included: true   },
  { key: 'officeUpTo15MB',     included: true   },
  { key: 'standardProcessing', included: true   },
  { key: 'retain1h',           included: true   },
  { key: 'adsShown',           included: 'warn' },
  { key: 'adFree',             included: false  },
  { key: 'priorityProcessing', included: false  },
  { key: 'apiAccess',          included: false  },
]

// ── Compare rows — values that stay the same in every locale ──────────────────
// (sizes, counts). Only the label keys and special string values are translated.
const COMPARE_ROW_DEFS = [
  { labelKey: 'pdfToolSize',      free: '100 MB',    starter: '200 MB',       pro: 'unlimited', agency: 'unlimited'  },
  { labelKey: 'officeConversions',free: '15 MB',     starter: '50 MB',        pro: 'unlimited', agency: 'unlimited'  },
  { labelKey: 'imageTools',       free: '40 MB',     starter: '200 MB',       pro: 'unlimited', agency: 'unlimited'  },
  { labelKey: 'batchFiles',       free: '1–5 files', starter: '10 files',     pro: '10–20 files', agency: 'Up to 50' },
  { labelKey: 'processingSpeed',  free: 'standard',  starter: 'standard',     pro: 'priority',  agency: 'dedicated'  },
  { labelKey: 'fileRetention',    free: '1 hour',    starter: '24 hours',     pro: '48 hours',  agency: '72 hours'   },
  { labelKey: 'ads',              free: 'yes',       starter: 'none',         pro: 'none',      agency: 'none'       },
  { labelKey: 'apiAccess',        free: false,       starter: false,          pro: false,       agency: true         },
  { labelKey: 'teamSeats',        free: false,       starter: false,          pro: false,       agency: 'fiveSeats'  },
  { labelKey: 'emailSupport',     free: false,       starter: false,          pro: true,        agency: true         },
  { labelKey: 'phoneSupport',     free: false,       starter: false,          pro: false,       agency: true         },
]

// ── Per-tool limits — tool names stay in EN (they are brand names) ──────────
const TOOL_GROUPS_DEF = [
  {
    groupKey: 'pdfTools',
    tools: [
      { name: 'OCR PDF',      free: { size: '10 MB',  batch: '1 file · 2 pages · 1/day' }, starter: { size: '100 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files'  }, agency: { size: 'Unlimited', batch: '20 files'  } },
      { name: 'Merge PDF',    free: { size: '100 MB', batch: '2 files'  }, starter: { size: '200 MB',  batch: '10 files' }, pro: { size: 'Unlimited', batch: 'Unlimited' }, agency: { size: 'Unlimited', batch: 'Unlimited' } },
      { name: 'Split PDF',    free: { size: '100 MB', batch: '1 file'   }, starter: { size: '200 MB',  batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files'  }, agency: { size: 'Unlimited', batch: '10 files'  } },
      { name: 'Compress PDF', free: { size: '200 MB', batch: '2 files'  }, starter: { size: '200 MB',  batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files'  }, agency: { size: 'Unlimited', batch: '10 files'  } },
      { name: 'Unlock PDF',   free: { size: '100 MB', batch: '—'        }, starter: { size: '200 MB',  batch: '—'        }, pro: { size: 'Unlimited', batch: '—'          }, agency: { size: 'Unlimited', batch: '—'          } },
    ],
  },
  {
    groupKey: 'officeConversions',
    tools: [
      { name: 'Word → PDF',   free: { size: '15 MB', batch: '1 file'  }, starter: { size: '50 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files' }, agency: { size: 'Unlimited', batch: '10 files' } },
      { name: 'PPT → PDF',    free: { size: '15 MB', batch: '1 file'  }, starter: { size: '50 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files' }, agency: { size: 'Unlimited', batch: '10 files' } },
      { name: 'Excel → PDF',  free: { size: '15 MB', batch: '1 file'  }, starter: { size: '50 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files' }, agency: { size: 'Unlimited', batch: '10 files' } },
      { name: 'PDF → Word',   free: { size: '15 MB', batch: '1 file'  }, starter: { size: '50 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files' }, agency: { size: 'Unlimited', batch: '10 files' } },
      { name: 'PDF → PPT',    free: { size: '15 MB', batch: '1 file'  }, starter: { size: '50 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files' }, agency: { size: 'Unlimited', batch: '10 files' } },
      { name: 'PDF → Excel',  free: { size: '15 MB', batch: '1 file'  }, starter: { size: '50 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files' }, agency: { size: 'Unlimited', batch: '10 files' } },
    ],
  },
  {
    groupKey: 'imageTools',
    tools: [
      { name: 'PDF → JPG',       free: { size: '25 MB',  batch: '2 files' }, starter: { size: '200 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '10 files' }, agency: { size: 'Unlimited', batch: '10 files' } },
      { name: 'PDF → PNG',       free: { size: '25 MB',  batch: '—'       }, starter: { size: '200 MB', batch: '—'        }, pro: { size: 'Unlimited', batch: '—'         }, agency: { size: 'Unlimited', batch: '—'         } },
      { name: 'JPG → PDF',       free: { size: '40 MB',  batch: '2 files' }, starter: { size: '200 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '20 files' }, agency: { size: 'Unlimited', batch: '20 files' } },
      { name: 'PNG → PDF',       free: { size: '40 MB',  batch: '5 files' }, starter: { size: '200 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '20 files' }, agency: { size: 'Unlimited', batch: '20 files' } },
      { name: 'WebP → PNG',      free: { size: '40 MB',  batch: '2 files' }, starter: { size: '200 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '20 files' }, agency: { size: 'Unlimited', batch: '20 files' } },
      { name: 'PNG → WebP',      free: { size: '40 MB',  batch: '2 files' }, starter: { size: '200 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '20 files' }, agency: { size: 'Unlimited', batch: '20 files' } },
      { name: 'Compress Image',  free: { size: '200 MB', batch: '2 files' }, starter: { size: '200 MB', batch: '10 files' }, pro: { size: 'Unlimited', batch: '20 files' }, agency: { size: 'Unlimited', batch: '20 files' } },
    ],
  },
]

// ── Feature cell ───────────────────────────────────────────────────────────────
function Cell({ val, t }) {
  if (val === true)  return <Check className="w-4 h-4 text-green-500 mx-auto" />
  if (val === false) return <X     className="w-4 h-4 text-gray-200 mx-auto" />
  // Translate special value keys (unlimited, priority, dedicated, yes, none, fiveSeats)
  const specialKeys = ['unlimited', 'priority', 'dedicated', 'yes', 'none', 'standard', 'fiveSeats']
  if (specialKeys.includes(val)) {
    const translated = t(`pricing.compareTable.values.${val}`)
    const hi = val === 'unlimited' || val === 'dedicated' || val === 'priority'
    return <span className={`text-sm font-medium ${hi ? 'text-red-600 font-bold' : 'text-gray-700'}`}>{translated}</span>
  }
  const hi = val === 'Unlimited' || val === 'Dedicated' || val === 'Priority'
  return <span className={`text-sm font-medium ${hi ? 'text-red-600 font-bold' : 'text-gray-700'}`}>{val}</span>
}

// ── FAQ item ───────────────────────────────────────────────────────────────────
function FAQ({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-sm pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 pt-1 text-sm text-gray-500 leading-relaxed border-t border-gray-100">{a}</div>
      )}
    </div>
  )
}

// ── Plan card ──────────────────────────────────────────────────────────────────
function PlanCard({ plan, interval, isCurrentPlan, onCheckout, onCheckoutInr, loading, t }) {
  const Icon = plan.icon

  const colorMap = {
    blue:   { ring: 'ring-blue-400',   bg: 'bg-blue-500',   btn: 'bg-blue-500 hover:bg-blue-400 shadow-blue-200',       badge: 'bg-blue-100 text-blue-700',   save: 'bg-blue-100 text-blue-700' },
    red:    { ring: 'ring-red-400',    bg: 'bg-red-500',    btn: 'bg-red-500 hover:bg-red-400 shadow-red-200',           badge: 'bg-red-100 text-red-700',     save: 'bg-red-100 text-red-600'   },
    purple: { ring: 'ring-purple-400', bg: 'bg-purple-500', btn: 'bg-purple-500 hover:bg-purple-400 shadow-purple-200', badge: 'bg-purple-100 text-purple-700', save: 'bg-purple-100 text-purple-700' },
    gray:   { ring: 'ring-gray-200',   bg: 'bg-gray-400',   btn: 'bg-gray-800 hover:bg-gray-700',                       badge: 'bg-gray-100 text-gray-600',   save: 'bg-gray-100 text-gray-500' },
  }
  const c      = colorMap[plan.color] || colorMap.gray
  const isPro  = plan.highlight
  const isYear = interval === 'yearly'

  const displayPrice  = isYear ? Math.round(plan.yearlyPrice / 12 * 10) / 10 : plan.monthlyPrice
  const annualTotal   = plan.yearlyPrice
  const annualSaving  = plan.monthlyPrice * 12 - plan.yearlyPrice

  const planName        = t(`pricing.plans.${plan.id}.name`)
  const planDescription = t(`pricing.plans.${plan.id}.description`)
  const planCta         = t(`pricing.plans.${plan.id}.cta`)
  const planBadge       = plan.id === 'pro' ? t('pricing.plans.pro.badge') : null

  return (
    <div className={`relative rounded-3xl flex flex-col p-8 transition-all ${
      isPro
        ? `bg-gray-900 text-white ring-2 ${c.ring} shadow-2xl scale-[1.03]`
        : 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
    }`}>
      {planBadge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-full shadow ${c.badge}`}>
            <Star className="w-3 h-3 fill-current" /> {planBadge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className={`font-bold text-lg ${isPro ? 'text-white' : 'text-gray-900'}`}>{planName}</h3>
          <p className={`text-xs ${isPro ? 'text-gray-400' : 'text-gray-500'}`}>{planDescription}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl sm:text-5xl font-black tracking-tight ${isPro ? 'text-white' : 'text-gray-900'}`}>
            ${isYear ? displayPrice.toFixed(2).replace('.00','') : displayPrice}
          </span>
          <span className={`text-sm ${isPro ? 'text-gray-400' : 'text-gray-400'}`}>{t('pricing.perMonth')}</span>
        </div>
        {isYear ? (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <p className={`text-xs ${isPro ? 'text-gray-400' : 'text-gray-400'}`}>
              {t('pricing.billing.billedAnnually', { total: annualTotal })}
            </p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPro ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
              {t('pricing.billing.save', { amount: annualSaving })}
            </span>
          </div>
        ) : (
          <p className={`text-xs mt-1.5 ${isPro ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('pricing.billing.billedMonthly')}
          </p>
        )}
      </div>

      {/* CTA */}
      {isCurrentPlan ? (
        <button
          disabled
          className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-2 disabled:opacity-60 cursor-default ${
            isPro ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {t('pricing.currentPlan')}
        </button>
      ) : (
        <div className="flex flex-col gap-2 mb-2">
          {/* Primary — Paddle (USD · Cards, PayPal, Apple Pay) */}
          <button
            onClick={() => onCheckout(plan.id, interval)}
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 ${c.btn} text-white active:scale-[0.98]`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {planCta}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
          {/* Secondary — Razorpay (INR · for India) */}
          <button
            onClick={() => onCheckoutInr(plan.id, interval)}
            disabled={loading}
            className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 border ${
              isPro
                ? 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
            }`}
          >
            Pay in ₹ INR · Razorpay
          </button>
        </div>
      )}

      <div className="mb-3" />

      {/* Divider */}
      <div className={`border-t mb-6 ${isPro ? 'border-gray-700' : 'border-gray-100'}`} />

      {/* Features */}
      <ul className="space-y-3 flex-1">
        {plan.featureKeys.map((f, i) => (
          <li key={i} className={`flex items-start gap-3 ${f.included === false ? 'opacity-35' : ''}`}>
            {f.included === true  && <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-400" />}
            {f.included === false && <X     className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />}
            {f.included === 'warn'&& <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />}
            <span className={`text-sm ${isPro ? 'text-gray-300' : 'text-gray-600'}`}>
              {t(`pricing.features.${f.key}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Free plan stripe ───────────────────────────────────────────────────────────
function FreeBanner({ isCurrentPlan, t }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <p className="font-bold text-gray-800">{t('pricing.freeBanner.title')}</p>
          <p className="text-sm text-gray-500 mt-0.5">{t('pricing.freeBanner.subtitle')}</p>
        </div>
      </div>
      {isCurrentPlan ? (
        <span className="text-sm font-semibold text-gray-400 bg-gray-100 px-4 py-2 rounded-xl whitespace-nowrap">
          {t('pricing.currentPlan')}
        </span>
      ) : (
        <Link
          href="/auth/signup"
          className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
        >
          {t('pricing.freeBanner.signupLink')}
        </Link>
      )}
    </div>
  )
}

// ── Billing toggle ─────────────────────────────────────────────────────────────
function BillingToggle({ interval, onChange, t }) {
  return (
    <div className="inline-flex items-center gap-3 bg-gray-100 rounded-full p-1">
      <button
        onClick={() => onChange('monthly')}
        className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
          interval === 'monthly'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {t('pricing.billing.monthly')}
      </button>
      <button
        onClick={() => onChange('yearly')}
        className={`relative px-5 py-2 rounded-full text-sm font-semibold transition-all ${
          interval === 'yearly'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {t('pricing.billing.yearly')}
        <span className="ml-2 inline-flex items-center bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {t('pricing.billing.monthsFree')}
        </span>
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const { user }   = useAuth()
  const { startCheckout, startPaddleCheckout, loading, error } = useSubscription()
  const [cancelled, setCancelled] = useState(false)
  const [interval,  setInterval]  = useState('monthly')
  const { t } = useTranslations()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('cancelled=1')) {
      setCancelled(true)
    }
  }, [])

  // Build translated FAQ items from the JSON array
  const faqItems = (() => {
    // Access the raw array via the messages object — we need to reach into the
    // pricing.faq.items array. Since t() only resolves strings, we pull directly.
    // Fallback: use the hook locale to grab the array gracefully.
    try {
      const raw = t('pricing.faq.items')
      // If t() returns the key string (array not stringifiable), handle gracefully.
      // Instead, build FAQ items by index convention — safer approach:
      const items = []
      for (let i = 0; i < 7; i++) {
        const q = t(`pricing.faq.items.${i}.q`)
        const a = t(`pricing.faq.items.${i}.a`)
        if (q === `pricing.faq.items.${i}.q`) break // key not found
        items.push({ q, a })
      }
      return items
    } catch {
      return []
    }
  })()

  const pricingStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'SmallPDF.us Pricing — PDF Tools Plans',
    description: 'Affordable PDF tool plans. Starter $9/mo, Pro $19/mo, Agency $49/mo. Cancel anytime. Cards, PayPal, UPI accepted.',
    url: 'https://smallpdf.us/pricing/',
    provider: {
      '@type': 'Organization',
      name: 'SmallPDF.us',
      url: 'https://smallpdf.us',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter Plan',
        price: '9.00',
        priceCurrency: 'USD',
        priceSpecification: { '@type': 'UnitPriceSpecification', price: '9.00', priceCurrency: 'USD', unitText: 'MONTH' },
        eligibleCustomerType: 'http://purl.org/goodrelations/v1#Individual',
        url: 'https://smallpdf.us/pricing/',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '19.00',
        priceCurrency: 'USD',
        priceSpecification: { '@type': 'UnitPriceSpecification', price: '19.00', priceCurrency: 'USD', unitText: 'MONTH' },
        url: 'https://smallpdf.us/pricing/',
      },
      {
        '@type': 'Offer',
        name: 'Agency Plan',
        price: '49.00',
        priceCurrency: 'USD',
        priceSpecification: { '@type': 'UnitPriceSpecification', price: '49.00', priceCurrency: 'USD', unitText: 'MONTH' },
        url: 'https://smallpdf.us/pricing/',
      },
    ],
  }

  return (
    <Layout title={t('pricing.pageTitle')}>
      <SEOHead
        title="Pricing — Starter, Pro & Agency Plans | SmallPDF.us"
        description="Simple, transparent pricing for SmallPDF.us. Starter $9/mo, Pro $19/mo, Agency $49/mo. All PDF tools included. Cancel anytime. Pay with Card, PayPal, or UPI."
        keywords="SmallPDF pricing, PDF tools subscription, PDF converter price, merge PDF price, compress PDF price, PDF plan"
        structuredData={pricingStructuredData}
      />

      <div className="bg-gradient-to-b from-slate-50 via-white to-white min-h-screen">

        {/* Cancelled notice */}
        {cancelled && (
          <div className="bg-amber-50 border-b border-amber-200 py-3 px-4 text-center">
            <p className="text-sm text-amber-700">
              {t('pricing.notices.checkoutCancelled')}{' '}
              <button onClick={() => setCancelled(false)} className="underline font-medium">
                {t('pricing.notices.dismiss')}
              </button>
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 py-3 px-4 text-center">
            <p className="text-sm text-red-700">
              {error} —{' '}
              <Link href="/contact" className="underline font-medium">
                {t('pricing.notices.contactSupport')}
              </Link>
            </p>
          </div>
        )}

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 pt-16 pb-6 text-center">
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 rounded-full px-4 py-1.5 text-sm text-red-600 font-semibold mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            {t('pricing.badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
            {t('pricing.hero.title')}
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            {t('pricing.hero.subtitle')}
          </p>

          {/* Billing interval toggle */}
          <div className="mt-8 flex justify-center">
            <BillingToggle interval={interval} onChange={setInterval} t={t} />
          </div>

          {interval === 'yearly' && (
            <p className="mt-3 text-sm text-green-600 font-semibold">
              {t('pricing.billing.saveAnnually')}
            </p>
          )}

        </section>

        {/* Plan cards — 3 paid plans */}
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {PLANS.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                interval={interval}
                isCurrentPlan={user?.plan === plan.id}
                onCheckout={startPaddleCheckout}
                onCheckoutInr={startCheckout}
                loading={loading}
                t={t}
              />
            ))}
          </div>

          {/* Free plan strip */}
          <div className="mt-6">
            <FreeBanner isCurrentPlan={!user?.plan || user?.plan === 'free'} t={t} />
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            No credit card tricks · Cancel anytime
          </p>
        </section>

        {/* Trust badges */}
        <section className="bg-white border-y border-gray-100 py-10">
          <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: '🔒', key: 'ssl'        },
              { icon: '🗑️', key: 'autoDelete' },
              { icon: '⚡', key: 'fast'       },
              { icon: '✨', key: 'noFees'     },
            ].map(({ icon, key }) => (
              <div key={key} className="flex flex-col items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <p className="text-sm font-bold text-gray-800">{t(`pricing.trustBadges.${key}.title`)}</p>
                <p className="text-xs text-gray-400">{t(`pricing.trustBadges.${key}.subtitle`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Full comparison table */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              {t('pricing.compareTable.title')}
            </h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-4 px-6 text-left text-sm font-bold text-gray-500 w-2/5">
                    {t('pricing.compareTable.featureCol')}
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-gray-500">{t('pricing.plans.free.name')}</th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-blue-600">{t('pricing.plans.starter.name')}</th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-red-600">{t('pricing.plans.pro.name')}</th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-purple-600">{t('pricing.plans.agency.name')}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROW_DEFS.map((row, i) => (
                  <tr key={row.labelKey} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="py-3.5 px-6 text-sm text-gray-600 font-medium">
                      {t(`pricing.compareTable.rows.${row.labelKey}`)}
                    </td>
                    <td className="py-3.5 px-4 text-center"><Cell val={row.free}    t={t} /></td>
                    <td className="py-3.5 px-4 text-center bg-blue-50/20"><Cell val={row.starter} t={t} /></td>
                    <td className="py-3.5 px-4 text-center bg-red-50/30"><Cell val={row.pro}     t={t} /></td>
                    <td className="py-3.5 px-4 text-center bg-purple-50/20"><Cell val={row.agency}  t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Per-Tool Limits */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              {t('pricing.toolLimits.title')}
            </h2>
            <p className="text-gray-500 mt-2 text-sm max-w-xl mx-auto">
              {t('pricing.toolLimits.subtitle')}
              <br /><span className="text-gray-400">{t('pricing.toolLimits.singleFileNote')}</span>
            </p>
          </div>

          <div className="space-y-8">
            {TOOL_GROUPS_DEF.map(group => (
              <div key={group.groupKey}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
                  {t(`pricing.toolLimits.groups.${group.groupKey}`)}
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="py-3 px-5 text-left text-xs font-bold text-gray-500 w-[30%]">Tool</th>
                        <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 w-[17%]">
                          <div>{t('pricing.plans.free.name')}</div>
                          <div className="font-normal text-gray-400 normal-case">{t('pricing.toolLimits.colSize')}</div>
                        </th>
                        <th className="py-3 px-4 text-center text-xs font-bold text-blue-600 w-[17%]">
                          <div>{t('pricing.plans.starter.name')}</div>
                          <div className="font-normal text-blue-400 normal-case">{t('pricing.toolLimits.colSize')}</div>
                        </th>
                        <th className="py-3 px-4 text-center text-xs font-bold text-red-600 w-[17%]">
                          <div>{t('pricing.plans.pro.name')}</div>
                          <div className="font-normal text-red-400 normal-case">{t('pricing.toolLimits.colSize')}</div>
                        </th>
                        <th className="py-3 px-4 text-center text-xs font-bold text-purple-600 w-[17%]">
                          <div>{t('pricing.plans.agency.name')}</div>
                          <div className="font-normal text-purple-400 normal-case">{t('pricing.toolLimits.colSize')}</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tools.map((tool, i) => (
                        <tr key={tool.name} className={`border-t border-gray-100 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                          <td className="py-3 px-5 text-sm font-semibold text-gray-800">{tool.name}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="text-xs text-gray-700 font-medium">{tool.free.size}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{tool.free.batch}</div>
                          </td>
                          <td className="py-3 px-4 text-center bg-blue-50/30">
                            <div className="text-xs text-gray-700 font-medium">{tool.starter.size}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{tool.starter.batch}</div>
                          </td>
                          <td className="py-3 px-4 text-center bg-red-50/30">
                            <div className={`text-xs font-bold ${tool.pro.size === 'Unlimited' ? 'text-red-600' : 'text-gray-700'}`}>{tool.pro.size}</div>
                            <div className={`text-xs mt-0.5 ${tool.pro.batch === 'Unlimited' ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>{tool.pro.batch}</div>
                          </td>
                          <td className="py-3 px-4 text-center bg-purple-50/20">
                            <div className={`text-xs font-bold ${tool.agency.size === 'Unlimited' ? 'text-purple-600' : 'text-gray-700'}`}>{tool.agency.size}</div>
                            <div className={`text-xs mt-0.5 ${tool.agency.batch === 'Unlimited' ? 'text-purple-500 font-semibold' : 'text-gray-500'}`}>{tool.agency.batch}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 pb-20">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 text-center mb-10">
            {t('pricing.faq.title')}
          </h2>
          <div className="space-y-3">
            {faqItems.map(f => <FAQ key={f.q} q={f.q} a={f.a} />)}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-gray-900 py-16 px-4 text-center text-white">
          <Crown className="w-10 h-10 mx-auto mb-4 text-red-400" />
          <h2 className="text-3xl font-extrabold mb-3">{t('pricing.bottomCta.title')}</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            {t('pricing.bottomCta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => startPaddleCheckout('pro', interval)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold px-8 py-3.5 rounded-xl transition-colors text-sm shadow-lg disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {interval === 'yearly' ? t('pricing.bottomCta.proBtnYearly') : t('pricing.bottomCta.proBtnMonthly')}
            </button>
            <button
              onClick={() => startPaddleCheckout('agency', interval)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-sm"
            >
              {t('pricing.bottomCta.agencyBtn')}
            </button>
          </div>
        </section>

      </div>
    </Layout>
  )
}