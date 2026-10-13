// pages/pricing.js
// Pricing page — Free · Starter · Pro — Monthly & Yearly billing
// Razorpay checkout on CTA buttons.

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import SEOHead from '../components/SEOHead'
import {
  Check, X, Minus, Zap, Crown, FileText, Shield,
  ChevronDown, Sparkles, ArrowRight,
  Loader2, Star,
} from 'lucide-react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { useTranslations } from '../lib/i18n'
import { getPageMessages } from '../lib/i18nLoader'

// ── Plan definitions ──────────────────────────────────────────────────────────
// yearly = monthly × 10  (2 months free = ~17% off)
// NOTE: plan.name, plan.description, plan.cta, plan.badge are now translation keys
//       resolved in PlanCard via t(`pricing.plans.${plan.id}.xxx`)
// INR prices for Indian users (₹) — actually charged via Razorpay
const INR_PRICES = {
  starter: { monthly: 399, yearly: 3990 },
  pro:     { monthly: 799, yearly: 7990 },
}

// Discounted USD prices for Indonesian users — actually charged via Lemon
// Squeezy (no Indonesian payment gateway, so USD stays the billed currency;
// see LEMONSQUEEZY_VARIANT_*_IDN env vars / lemonSqueezyRoutes.js). These
// values must match the price on the corresponding "* - Indonesia" LS variant.
const USD_PRICES_ID = {
  starter: { monthly: 5,   yearly: 50   },
  pro:     { monthly: 9.5, yearly: 95   },
}

// "≈ Rp" reference shown next to the discounted USD price above — purely a
// local-currency hint (USD is still what's billed). Rough reference at
// ~15,800 IDR/USD, rounded to clean numbers.
const IDR_PRICES = {
  starter: { monthly: 79000,  yearly: 790000  },
  pro:     { monthly: 150000, yearly: 1500000 },
}

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

const PLANS = [
  {
    id:           'free',
    icon:         Shield,
    monthlyPrice: 0,
    yearlyPrice:  0,
    highlight:    false,
    color:        'gray',
    featureKeys:  FREE_PLAN_FEATURE_KEYS,
  },
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
]

// ── Compare rows — values that stay the same in every locale ──────────────────
// (sizes, counts). Only the label keys and special string values are translated.
const COMPARE_ROW_DEFS = [
  { labelKey: 'dailyUses',        free: 'fivePerDay', starter: 'unlimited',   pro: 'unlimited' },
  { labelKey: 'pdfToolSize',      free: '10–25 MB',  starter: '100–200 MB',   pro: '100 MB'    },
  { labelKey: 'officeConversions',free: '5 MB',      starter: '20 MB',        pro: '100 MB'    },
  { labelKey: 'imageTools',       free: '5–15 MB',   starter: '20 MB',        pro: '100 MB'    },
  { labelKey: 'batchFiles',       free: '1–5 files', starter: '10 files',     pro: '10–20 files' },
  { labelKey: 'processingSpeed',  free: 'standard',  starter: 'standard',     pro: 'priority'  },
  { labelKey: 'fileRetention',    free: '1 hour',    starter: '24 hours',     pro: '48 hours'  },
  { labelKey: 'ads',              free: 'yes',       starter: 'none',         pro: 'none'      },
  { labelKey: 'apiAccess',        free: false,       starter: false,          pro: false       },
  { labelKey: 'teamSeats',        free: false,       starter: false,          pro: false       },
  { labelKey: 'emailSupport',     free: false,       starter: false,          pro: true        },
]

// ── Per-tool limits — tool names stay in EN (they are brand names) ──────────
const TOOL_GROUPS_DEF = [
  {
    groupKey: 'pdfTools',
    tools: [
      { name: 'OCR PDF',      free: { size: '10 MB',  batch: '1 file · 2 pages · 1/day' }, starter: { size: '100 MB',  batch: '10 files' }, pro: { size: '100 MB', batch: '10 files'  } },
      { name: 'Merge PDF',    free: { size: '25 MB',  batch: '2 files'  }, starter: { size: '200 MB',  batch: '10 files' }, pro: { size: '100 MB', batch: 'Unlimited' } },
      { name: 'Split PDF',    free: { size: '10 MB',  batch: '1 file'   }, starter: { size: '100 MB',  batch: '10 files' }, pro: { size: '100 MB', batch: '10 files'  } },
      { name: 'Compress PDF', free: { size: '20 MB',  batch: '2 files'  }, starter: { size: '100 MB',  batch: '10 files' }, pro: { size: '100 MB', batch: '10 files'  } },
      { name: 'Rotate PDF',   free: { size: '10 MB',  batch: '—'        }, starter: { size: '100 MB',  batch: '—'        }, pro: { size: '100 MB', batch: '—'          } },
      { name: 'Unlock PDF',   free: { size: '10 MB',  batch: '5 files'  }, starter: { size: '100 MB',  batch: '10 files' }, pro: { size: '100 MB', batch: '20 files'   } },
      { name: 'Protect PDF',  free: { size: '10 MB',  batch: '—'        }, starter: { size: '100 MB',  batch: '—'        }, pro: { size: '100 MB', batch: '—'          } },
      { name: 'Redact PDF',   free: { size: '10 MB',  batch: '—'        }, starter: { size: '100 MB',  batch: '—'        }, pro: { size: '100 MB', batch: '—'          } },
      { name: 'Edit PDF',     free: { size: '10 MB',  batch: '—'        }, starter: { size: '100 MB',  batch: '—'        }, pro: { size: '100 MB', batch: '—'          } },
    ],
  },
  {
    groupKey: 'officeConversions',
    tools: [
      { name: 'Word → PDF',   free: { size: '5 MB', batch: '1 file'  }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '10 files' } },
      { name: 'PPT → PDF',    free: { size: '5 MB', batch: '1 file'  }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '10 files' } },
      { name: 'Excel → PDF',  free: { size: '5 MB', batch: '1 file'  }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '10 files' } },
      { name: 'PDF → Word',   free: { size: '5 MB', batch: '1 file'  }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '10 files' } },
      { name: 'PDF → PPT',    free: { size: '5 MB', batch: '1 file'  }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '10 files' } },
      { name: 'PDF → Excel',  free: { size: '5 MB', batch: '1 file'  }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '10 files' } },
    ],
  },
  {
    groupKey: 'imageTools',
    tools: [
      { name: 'PDF → JPG',       free: { size: '5 MB',  batch: '2 files' }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '10 files' } },
      { name: 'PDF → PNG',       free: { size: '5 MB',  batch: '—'       }, starter: { size: '20 MB', batch: '—'        }, pro: { size: '100 MB', batch: '—'         } },
      { name: 'JPG → PDF',       free: { size: '5 MB',  batch: '2 files' }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '20 files' } },
      { name: 'PNG → PDF',       free: { size: '5 MB',  batch: '5 files' }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '20 files' } },
      { name: 'WebP → PNG',      free: { size: '5 MB',  batch: '2 files' }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '20 files' } },
      { name: 'PNG → WebP',      free: { size: '5 MB',  batch: '2 files' }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '20 files' } },
      { name: 'Compress Image',  free: { size: '15 MB', batch: '2 files' }, starter: { size: '20 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '20 files' } },
      { name: 'HEIC → JPG',      free: { size: '10 MB', batch: '5 files' }, starter: { size: '40 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '20 files' } },
      { name: 'HEIC → PNG',      free: { size: '10 MB', batch: '5 files' }, starter: { size: '40 MB', batch: '10 files' }, pro: { size: '100 MB', batch: '20 files' } },
    ],
  },
]

// ── Feature cell ───────────────────────────────────────────────────────────────
function Cell({ val, t }) {
  if (val === true)  return <Check className="w-4 h-4 text-green-500 mx-auto" />
  if (val === false) return <X     className="w-4 h-4 text-gray-200 mx-auto" />
  // Translate special value keys (unlimited, priority, dedicated, yes, none, fiveSeats)
  const specialKeys = ['unlimited', 'priority', 'dedicated', 'yes', 'none', 'standard', 'fiveSeats', 'fivePerDay']
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
    <div className={`border rounded-xl overflow-hidden transition-colors duration-200 ${open ? 'border-gray-300 shadow-sm' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex justify-between items-center px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-sm pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-6 pb-5 pt-1 text-sm text-gray-500 leading-relaxed border-t border-gray-100">{a}</div>
      </div>
    </div>
  )
}

// ── Plan card ──────────────────────────────────────────────────────────────────
function PlanCard({ plan, interval, isCurrentPlan, onCheckout, onCheckoutPayPal, onCheckoutInr, loading, isIndia, isIndonesia, t }) {
  const Icon = plan.icon

  const colorMap = {
    blue:   { ring: 'ring-blue-400',   bg: 'bg-gradient-to-br from-blue-500 to-blue-600',   btn: 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25',                     badge: 'bg-blue-100 text-blue-700',   save: 'bg-blue-100 text-blue-700' },
    red:    { ring: 'ring-red-400',    bg: 'bg-gradient-to-br from-red-500 to-orange-500',  btn: 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-500/30', badge: 'bg-red-100 text-red-700', save: 'bg-red-100 text-red-600' },
    gray:   { ring: 'ring-slate-200',  bg: 'bg-gradient-to-br from-slate-600 to-slate-700', btn: 'bg-slate-800 hover:bg-slate-700',                                               badge: 'bg-slate-100 text-slate-600', save: 'bg-slate-100 text-slate-500' },
  }
  const isFree = plan.id === 'free'
  const c      = colorMap[plan.color] || colorMap.gray
  const isPro  = plan.highlight
  const isYear = interval === 'yearly'

  // India: INR, actually billed via Razorpay. Indonesia: discounted USD,
  // actually billed via the "* - Indonesia" Lemon Squeezy variant. Everyone
  // else: standard USD.
  const inrPrices    = INR_PRICES[plan.id] || { monthly: 0, yearly: 0 }
  const usdIdPrices  = USD_PRICES_ID[plan.id] || { monthly: plan.monthlyPrice, yearly: plan.yearlyPrice }
  const isIdDiscount = isIndonesia && !isIndia && !isFree
  const baseMonthly  = isIdDiscount ? usdIdPrices.monthly : plan.monthlyPrice
  const baseYearly   = isIdDiscount ? usdIdPrices.yearly  : plan.yearlyPrice

  const displayPrice = isIndia
    ? (isYear ? Math.round(inrPrices.yearly / 12) : inrPrices.monthly)
    : (isYear ? Math.round(baseYearly / 12 * 10) / 10 : baseMonthly)
  const currency     = isIndia ? '₹' : '$'
  const annualTotal  = isIndia ? inrPrices.yearly : baseYearly
  const annualSaving = isIndia
    ? (inrPrices.monthly * 12 - inrPrices.yearly)
    : (baseMonthly * 12 - baseYearly)

  // "≈ Rp" hint under the (discounted, for Indonesia) USD price — informational
  // only; USD via Lemon Squeezy is still what's actually billed.
  const idrPrices   = IDR_PRICES[plan.id] || { monthly: 0, yearly: 0 }
  const idrDisplay  = isYear ? Math.round(idrPrices.yearly / 12) : idrPrices.monthly
  const showIdrHint = isIdDiscount

  // Real, calculated annual-billing discount (not a marketing number) — used
  // for the strikethrough price and the "Save X%" badge on the yearly view.
  const originalMonthly = isIndia ? inrPrices.monthly : baseMonthly
  const percentOff = !isFree && originalMonthly > 0
    ? Math.round((1 - (isIndia ? inrPrices.yearly : baseYearly) / (originalMonthly * 12)) * 100)
    : 0

  const planName        = t(`pricing.plans.${plan.id}.name`)
  const planDescription = t(`pricing.plans.${plan.id}.description`)
  const planCta         = t(`pricing.plans.${plan.id}.cta`)
  const planBadge       = plan.id === 'pro' ? t('pricing.plans.pro.badge') : null

  return (
    <div className={`relative rounded-3xl flex flex-col p-7 sm:p-8 transition-all duration-300 ${
      isPro
        ? 'bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl shadow-slate-900/30 lg:scale-[1.04] lg:-my-1 ring-1 ring-white/10'
        : 'bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1'
    }`}>
      {/* Pro glow accent */}
      {isPro && (
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-red-500/20 blur-3xl" />
      )}

      {planBadge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-4 py-1.5 rounded-full shadow-lg shadow-red-500/30 bg-gradient-to-r from-red-500 to-orange-500 text-white">
            <Star className="w-3 h-3 fill-current" /> {planBadge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="relative flex items-center gap-3 mb-6">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${
          isPro ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/30' : c.bg
        }`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className={`font-bold text-lg leading-tight ${isPro ? 'text-white' : 'text-slate-900'}`}>{planName}</h3>
          <p className={`text-xs mt-0.5 ${isPro ? 'text-slate-400' : 'text-slate-500'}`}>{planDescription}</p>
        </div>
      </div>

      {/* Price */}
      <div className="relative mb-6">
        {!isFree && isYear && (
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-lg font-semibold line-through ${isPro ? 'text-slate-500' : 'text-slate-400'}`}>
              {currency}{originalMonthly}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm shadow-emerald-500/30">
              {percentOff}% OFF
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-1.5">
          <span className={`text-5xl font-black tracking-tight ${isPro ? 'text-white' : 'text-slate-900'}`}>
            {isFree ? `${currency}0` : `${currency}${isYear ? displayPrice.toFixed(isIndia ? 0 : 2).replace('.00','') : displayPrice}`}
          </span>
          <span className={`text-sm font-medium ${isPro ? 'text-slate-400' : 'text-slate-400'}`}>{t('pricing.perMonth')}</span>
        </div>
        {isFree ? (
          <p className="text-xs mt-2 text-slate-400">No credit card required</p>
        ) : isYear ? (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className={`text-xs ${isPro ? 'text-slate-400' : 'text-slate-400'}`}>
              {currency}{annualTotal} {t('pricing.billing.billedAnnually', { total: annualTotal }).replace(/[\$₹]\d+/g, '')}
            </p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isPro ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
              You save {currency}{annualSaving}/yr
            </span>
          </div>
        ) : (
          <p className={`text-xs mt-2 ${isPro ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('pricing.billing.billedMonthly')}
          </p>
        )}
        {showIdrHint && (
          <p className={`text-[11px] mt-1 ${isPro ? 'text-slate-500' : 'text-slate-400'}`}>
            ≈ Rp {idrDisplay.toLocaleString('id-ID')} — billed in USD
          </p>
        )}
      </div>

      {/* CTA */}
      {isFree ? (
        isCurrentPlan ? (
          <button disabled className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-2 bg-gray-100 text-gray-400 cursor-default">
            {t('pricing.currentPlan')}
          </button>
        ) : (
          <Link
            href="/auth/signup"
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mb-2 ${c.btn} text-white active:scale-[0.98]`}
          >
            {planCta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )
      ) : isCurrentPlan ? (
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
          {isIndia ? (
            /* India → Razorpay (INR) */
            <button
              onClick={() => onCheckoutInr(plan.id, interval)}
              disabled={loading}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 ${c.btn} text-white active:scale-[0.98]`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {planCta}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          ) : (
            /* International → Lemon Squeezy primary + PayPal secondary */
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => onCheckout(plan.id, interval)}
                disabled={loading}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 ${c.btn} text-white active:scale-[0.98]`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {planCta}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onCheckoutPayPal(plan.id, interval)}
                disabled={loading}
                className={`w-full py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${isPro ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/></svg>
                Pay with PayPal instead
              </button>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className={`border-t my-6 ${isPro ? 'border-white/10' : 'border-slate-100'}`} />

      {/* Features */}
      <ul className="space-y-3.5 flex-1">
        {plan.featureKeys.map((f, i) => (
          <li key={i} className={`flex items-start gap-3 ${f.included === false ? 'opacity-40' : ''}`}>
            {f.included === true && (
              <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${isPro ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <Check className="w-3 h-3 text-green-500" strokeWidth={3} />
              </span>
            )}
            {f.included === false && (
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                <X className="w-3 h-3 text-slate-400" strokeWidth={3} />
              </span>
            )}
            {f.included === 'warn' && (
              <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${isPro ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                <Minus className="w-3 h-3 text-amber-500" strokeWidth={3} />
              </span>
            )}
            <span className={`text-sm leading-snug ${isPro ? 'text-slate-300' : 'text-slate-600'}`}>
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
    <div className="inline-flex items-center gap-1 bg-slate-100 rounded-full p-1 ring-1 ring-slate-200/60">
      <button
        onClick={() => onChange('monthly')}
        className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
          interval === 'monthly'
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {t('pricing.billing.monthly')}
      </button>
      <button
        onClick={() => onChange('yearly')}
        className={`relative px-5 py-2 rounded-full text-sm font-semibold transition-all ${
          interval === 'yearly'
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {t('pricing.billing.yearly')}
        <span className="ml-2 inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shadow-green-500/30 animate-pulse">
          {t('pricing.billing.monthsFree')}
        </span>
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const router     = useRouter()
  const { user }   = useAuth()
  const { startCheckout, startLemonSqueezyCheckout, startPayPalCheckout, loading, error } = useSubscription()
  const [cancelled, setCancelled] = useState(false)
  const [interval,  setInterval]  = useState('monthly')
  const [isIndia,   setIsIndia]   = useState(false)
  const [isIndonesia, setIsIndonesia] = useState(false)
  // Region detection runs in an effect, and it decides WHICH gateway to open —
  // so auto-resume has to wait for it, otherwise an Indian user coming back
  // from signup would be sent to Lemon Squeezy instead of Razorpay.
  const [regionReady, setRegionReady] = useState(false)
  const autoStarted = useRef(false)
  const { t } = useTranslations()

  // Detect India via timezone (IST = Asia/Kolkata, only used in India)
  // Detect Indonesia the same way (WIB/WITA/WIT) — used only to show a small
  // "≈ Rp" reference under the USD price; checkout still runs in USD.
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setIsIndia(['Asia/Kolkata', 'Asia/Calcutta'].includes(tz))
      setIsIndonesia(['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura'].includes(tz))
    } catch { /* keep false */ }
    setRegionReady(true)
  }, [])

  // ── Resume checkout after signup/login ──────────────────────────────────────
  // A guest who clicks "Get Pro" is sent to /auth/signup?plan=pro&… — auth then
  // sends them back here with autostart=1 so checkout opens straight away.
  // Without this they land back on a plain pricing page and have to find the
  // plan and click it a second time, which is where most of them dropped off.
  useEffect(() => {
    if (autoStarted.current || !regionReady || !user || !router.isReady) return
    const { autostart, plan } = router.query
    if (!autostart || !plan || !['starter', 'pro', 'agency'].includes(plan)) return

    autoStarted.current = true
    const resumeInterval = router.query.interval === 'yearly' ? 'yearly' : 'monthly'
    setInterval(resumeInterval)
    if (isIndia) startCheckout(plan, resumeInterval)
    else startLemonSqueezyCheckout(plan, resumeInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionReady, user, isIndia, router.isReady, router.query])

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
    description: 'Affordable PDF tool plans. Starter $9/mo, Pro $19/mo. Cancel anytime. Cards, PayPal, UPI accepted.',
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
    ],
  }

  return (
    <Layout title={t('pricing.pageTitle')}>
      <SEOHead
        title={t('pricing.pageTitle')}
        description={t('pricing.metaDescription')}
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
        <section className="relative max-w-4xl mx-auto px-4 pt-20 pb-8 text-center overflow-hidden">
          {/* soft background accents */}
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-72 w-[36rem] max-w-full rounded-full bg-red-100/40 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white border border-red-100 shadow-sm rounded-full px-4 py-1.5 text-sm text-red-600 font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              {t('pricing.badge')}
            </div>
            <h1 className="text-4xl md:text-[3.25rem] font-extrabold text-slate-900 tracking-tight leading-[1.1]">
              {t('pricing.hero.title')}
            </h1>
            <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
              {t('pricing.hero.subtitle')}
            </p>

            {/* Social proof row */}
            <div className="mt-7 flex flex-wrap justify-center items-center gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Shield className="w-4 h-4 text-green-500" /> 14-day money-back guarantee</span>
              <span className="hidden sm:block h-4 w-px bg-slate-200" />
              <span className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> Cancel anytime</span>
              <span className="hidden sm:block h-4 w-px bg-slate-200" />
              <span>No hidden fees</span>
            </div>

            {/* Stats strip */}
            <div className="mt-9 inline-flex flex-wrap justify-center divide-x divide-slate-200 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur px-2 shadow-sm">
              {[
                { value: '27',   label: 'PDF & Image Tools' },
                { value: '8',    label: 'Languages' },
                { value: '1h',   label: 'File Auto-Delete' },
                { value: '256-bit', label: 'Encrypted Transfers' },
              ].map(({ value, label }) => (
                <div key={label} className="px-5 sm:px-7 py-3 text-center">
                  <p className="text-2xl font-extrabold text-slate-900">{value}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Billing interval toggle */}
            <div className="mt-9 flex justify-center">
              <BillingToggle interval={interval} onChange={setInterval} t={t} />
            </div>

            {interval === 'yearly' && (
              <div className="mt-4 flex justify-center">
                <span className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-full px-4 py-2 text-sm text-emerald-700 font-bold shadow-sm">
                  {t('pricing.billing.saveAnnually')}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Plan cards — Free · Starter · Pro */}
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                interval={interval}
                // A logged-out visitor isn't "on" the Free plan yet — showing them a
                // greyed-out "Current Plan" button is a dead end. Guests get the
                // sign-up CTA instead (the non-current branch in PlanCard).
                isCurrentPlan={plan.id === 'free' ? (!!user && (!user.plan || user.plan === 'free')) : user?.plan === plan.id}
                onCheckout={startLemonSqueezyCheckout}
                onCheckoutPayPal={startPayPalCheckout}
                onCheckoutInr={startCheckout}
                loading={loading}
                isIndia={isIndia}
                isIndonesia={isIndonesia}
                t={t}
              />
            ))}
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 mt-6">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
              🔒 Secure checkout
            </span>
            {isIndia ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
                💳 UPI · Debit/Credit Card · Net Banking
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
                💳 Card · Apple Pay · Google Pay · PayPal
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
              ↩ 14-day money-back guarantee
            </span>
          </div>
        </section>

        {/* Trust badges */}
        <section className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-y border-gray-100 py-10">
          <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: '🔒', key: 'ssl',        color: 'bg-blue-50 text-blue-600'   },
              { icon: '🗑️', key: 'autoDelete', color: 'bg-orange-50 text-orange-600' },
              { icon: '⚡', key: 'fast',       color: 'bg-yellow-50 text-yellow-600' },
              { icon: '✨', key: 'noFees',     color: 'bg-green-50 text-green-600'  },
            ].map(({ icon, key, color }) => (
              <div key={key} className="flex flex-col items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${color}`}>
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{t(`pricing.trustBadges.${key}.title`)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t(`pricing.trustBadges.${key}.subtitle`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What you get — replaces fake testimonials */}
        <section className="max-w-5xl mx-auto px-4 py-14">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl border border-gray-100 p-8 md:p-10 text-center">
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">The same tools. Just without the limits.</h2>
            <p className="text-sm text-gray-500 mb-8 max-w-lg mx-auto">Free plan already gives you access to all 27 tools. Premium removes the friction — bigger files, batch processing, no ads, priority processing.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {[
                { icon: '📁', title: 'Bigger files', desc: 'Up to 200 MB, depending on the tool, on Starter — unlimited on Pro. Stop getting blocked mid-workflow.' },
                { icon: '⚡', title: 'Batch processing', desc: 'Convert or compress multiple files at once. Not one by one.' },
                { icon: '🚫', title: 'No ads', desc: 'Clean interface with zero interruptions. Just the tool, nothing else.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="bg-white rounded-xl p-5 border border-gray-100">
                  <div className="text-2xl mb-3">{icon}</div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Full comparison table */}
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              {t('pricing.compareTable.title')}
            </h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="py-4 px-6 text-left text-sm font-bold text-slate-500 w-2/5">
                    {t('pricing.compareTable.featureCol')}
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-slate-500">{t('pricing.plans.free.name')}</th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-blue-600">{t('pricing.plans.starter.name')}</th>
                  <th className="py-4 px-4 text-center text-sm font-bold text-red-600 relative">
                    <span className="absolute inset-x-2 top-0 h-1 rounded-b bg-gradient-to-r from-red-500 to-orange-500" />
                    {t('pricing.plans.pro.name')}
                  </th>
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
                        <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 w-[20%]">
                          <div>{t('pricing.plans.free.name')}</div>
                          <div className="font-normal text-gray-400 normal-case">{t('pricing.toolLimits.colSize')}</div>
                        </th>
                        <th className="py-3 px-4 text-center text-xs font-bold text-blue-600 w-[20%]">
                          <div>{t('pricing.plans.starter.name')}</div>
                          <div className="font-normal text-blue-400 normal-case">{t('pricing.toolLimits.colSize')}</div>
                        </th>
                        <th className="py-3 px-4 text-center text-xs font-bold text-red-600 w-[20%]">
                          <div>{t('pricing.plans.pro.name')}</div>
                          <div className="font-normal text-red-400 normal-case">{t('pricing.toolLimits.colSize')}</div>
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
        <section className="relative overflow-hidden bg-gray-900 py-20 px-4 text-center text-white">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-full px-4 py-1.5 text-sm text-red-400 font-semibold mb-5">
              <Crown className="w-3.5 h-3.5" />
              {t('pricing.plans.pro.badge')}
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">{t('pricing.bottomCta.title')}</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto text-lg">
              {t('pricing.bottomCta.subtitle')}
            </p>
            {interval === 'yearly' && (
              <div className="flex justify-center mb-6 -mt-4">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                  Annual billing selected — 17% off, applied at checkout
                </span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => isIndia ? startCheckout('pro', interval) : startLemonSqueezyCheckout('pro', interval)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white font-bold px-8 py-4 rounded-xl transition-all text-sm shadow-xl shadow-red-500/25 disabled:opacity-70 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isIndia
                  ? (interval === 'yearly' ? 'Get Pro — ₹7,990/yr' : 'Get Pro — ₹799/mo')
                  : (interval === 'yearly' ? 'Get Pro — $190/yr'   : 'Get Pro — $19/mo')}
              </button>
              <button
                onClick={() => isIndia ? startCheckout('starter', interval) : startLemonSqueezyCheckout('starter', interval)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-all text-sm"
              >
                {isIndia
                  ? (interval === 'yearly' ? 'Get Starter — ₹3,990/yr' : 'Get Starter — ₹399/mo')
                  : (interval === 'yearly' ? 'Get Starter — $90/yr'    : 'Get Starter — $9/mo')}
              </button>
            </div>
            <p className="mt-5 text-xs text-gray-500">
              🔒 14-day money-back guarantee · No hidden fees · Cancel anytime
              {isIndia ? ' · Powered by Razorpay' : ' · Powered by Lemon Squeezy'}
            </p>
          </div>
        </section>

      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["pricing"]) },
    revalidate: 86400,
  }
}
