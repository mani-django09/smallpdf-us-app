// Classifies where a visitor came from: (referrer host, utm params) → { source, medium }.
//   medium: direct | organic (search engines) | social | ai (chatbots) | referral (any other site) | campaign (utm)
//   source: google, bing, facebook, chatgpt, … or the referring host for generic referrals.
// Shared by the live beacon endpoint (visitTracking.js) and the one-off nginx-log backfill.

const OWN_HOSTS = /(^|\.)smallpdf\.us$|^localhost$|^127\.0\.0\.1$/i

// [regex on host, source, medium]
const RULES = [
  [/(^|\.)google\.[a-z.]+$/, 'google', 'organic'],
  [/(^|\.)bing\.com$/, 'bing', 'organic'],
  [/(^|\.)(yahoo\.com|search\.yahoo\.com|yahoo\.co\.jp)$/, 'yahoo', 'organic'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo', 'organic'],
  [/(^|\.)baidu\.com$/, 'baidu', 'organic'],
  [/(^|\.)yandex\.[a-z.]+$/, 'yandex', 'organic'],
  [/(^|\.)ecosia\.org$/, 'ecosia', 'organic'],
  [/(^|\.)search\.brave\.com$/, 'brave search', 'organic'],
  [/(^|\.)startpage\.com$/, 'startpage', 'organic'],
  [/(^|\.)naver\.com$/, 'naver', 'organic'],
  [/(^|\.)seznam\.cz$/, 'seznam', 'organic'],
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, 'chatgpt', 'ai'],
  [/(^|\.)perplexity\.ai$/, 'perplexity', 'ai'],
  [/(^|\.)(copilot\.microsoft\.com|copilot\.com)$/, 'copilot', 'ai'],
  [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/, 'gemini', 'ai'],
  [/(^|\.)claude\.ai$/, 'claude', 'ai'],
  [/(^|\.)(facebook\.com|fb\.com|l\.facebook\.com|lm\.facebook\.com|m\.facebook\.com)$/, 'facebook', 'social'],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, 'instagram', 'social'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x / twitter', 'social'],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, 'pinterest', 'social'],
  [/(^|\.)reddit\.com$/, 'reddit', 'social'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube', 'social'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'linkedin', 'social'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp', 'social'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'telegram', 'social'],
  [/(^|\.)quora\.com$/, 'quora', 'social'],
  [/(^|\.)(vk\.com|ok\.ru)$/, 'vk', 'social'],
]

const clean = (s, n = 80) => String(s || '').trim().toLowerCase().slice(0, n)

function hostOf(ref) {
  try { return new URL(ref).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

// utm: { source, medium, campaign } (already lower-cased or not — we normalise)
function classify(referrer, utm = {}) {
  const host = hostOf(referrer)
  const us = clean(utm.source), um = clean(utm.medium)
  if (us) {
    // Campaign links: keep the utm source as the source. Map known mediums, else "campaign".
    const medium = /^(organic|social|ai|referral|direct)$/.test(um) ? um : um || 'campaign'
    return { source: us, medium: medium === 'cpc' || medium === 'paid' ? 'paid' : medium, refHost: host && !OWN_HOSTS.test(host) ? host : '' }
  }
  if (!host || OWN_HOSTS.test(host)) return { source: 'direct', medium: 'direct', refHost: '' }
  for (const [re, source, medium] of RULES) if (re.test(host)) return { source, medium, refHost: host }
  // Android in-app referrers, e.g. android-app://com.google.android.gm
  return { source: host, medium: 'referral', refHost: host }
}

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|mediapartners|google-|lighthouse|headless|python|curl|wget|go-http|axios|node-fetch|sitescan|ptst|bytespider|gptbot|claudebot|amazonbot|applebot|yandex|baidu|duckduck|semrush|ahrefs|mj12|dotbot|petalbot|ev-crawler|ias-va|saashub|monitor|uptime|scanner/i

module.exports = { classify, hostOf, BOT_UA, OWN_HOSTS }
