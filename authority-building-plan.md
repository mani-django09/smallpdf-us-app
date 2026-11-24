# SmallPDF.us — Authority + Indexing Action Plan

Goal: get Google to trust the domain enough to index all tool pages, not just the homepage.
Your tech setup is already clean — this plan is about **trust signals** and **content depth**.

---

## Phase 0 — Do this week (forces Google to re-crawl)

1. **Paste the new unique content** (`unique-content-6-tools.html`) into the 6 priority pages.
   Replace the generic "Why use / 3 steps / FAQ" boilerplate. Fill the blank FAQ answers.
2. **Google Search Console → URL Inspection** for each of the 6 pages → **Request Indexing**.
   (Limit is ~10–12/day, so 6 is fine in one sitting.)
3. **Resubmit sitemap** in GSC → Sitemaps. Confirm status shows "Success" and the URL count
   matches your real page count. Your sitemap is served gzipped — verify Google reads it.
4. **Check the Pages report** in GSC. Note how many URLs sit under
   "Crawled – currently not indexed" / "Discovered – currently not indexed".
   That's your baseline number to watch shrink over the next 4–8 weeks.

---

## Phase 1 — Content depth (biggest lever, weeks 1–3)

Google withholds indexing on thin/templated pages. Make each page earn its spot.

- Roll the unique blocks out to **all** tool pages, not just 6, over time.
- Every tool page should have **300–600 words of genuinely page-specific text** — different
  use-cases, examples and FAQ answers per tool. No sentence repeated across pages.
- Add **FAQPage JSON-LD schema** (sample is at the bottom of the HTML file) to each page.
- Build **2–3 real blog posts** that link down to the tools, e.g.
  "How to shrink a PDF under 2 MB for a visa application", "PDF to Word: keep your tables intact".
  Helpful, specific, 800–1,200 words. These become your link targets and internal-link hubs.

---

## Phase 2 — Off-site authority / backlinks (weeks 2–8)

A brand-new domain with near-zero backlinks gets gated. You need a handful of real,
relevant links so Google sees the site as a legitimate destination.

**Easy wins (do first):**
- Submit to free tool directories: AlternativeTo, SaaSHub, Product Hunt, Capterra/G2 (free listing),
  ToolFinder-type sites, "free online tools" roundup lists.
- Create and complete profiles that allow a website link: Crunchbase, LinkedIn company page,
  a Reddit account that's genuinely active in r/pdf, r/productivity (don't spam — answer questions).
- Quora / forum answers where "how do I merge/compress a PDF for free" comes up — answer
  helpfully and link when it's actually relevant.

**Medium effort:**
- Guest post or tool mention on small productivity / student / freelancer blogs.
- Get listed in "best free PDF tools" comparison articles (email the authors with a short pitch).
- If you have a Google Play app (you do — the badge links to one), cross-link app ↔ site and
  make sure the Play listing points to smallpdf.us.

**Avoid:** bought link packages, PBNs, mass spammy directories. On a new domain these can do
more harm than good and risk a manual action.

---

## Phase 3 — Trust + brand signals (ongoing)

- **The name is a risk.** `smallpdf.us` closely mirrors the established `smallpdf.com` brand
  (registered 2013). Google may distrust it as a clone. You can't easily change the domain now,
  so compensate hard with original content, a real About page with a real story, a working
  Contact page, and visible Privacy/Terms — you already have these; keep them genuine and unique.
- Set up **Google Search Console + Bing Webmaster Tools** properly (you clearly have GSC).
- Add **Organization schema** (logo, name, sameAs links to your social profiles) on the homepage.
- Keep the site fast and stable — Core Web Vitals feed into Google's willingness to crawl deeper.
- Earn a few **genuine reviews / mentions** (Trustpilot, Reddit threads) — brand search volume
  for "smallpdf.us" specifically is a strong trust signal over time.

---

## What to expect

- Bing already indexes everything because its bar is low — nothing to fix there.
- Google will index pages **gradually** as content depth + backlinks accumulate. On a new domain,
  realistic timeline is **4–8 weeks** after the Phase 0/1 work, not days.
- Watch the GSC Pages report weekly: success = the "Crawled – currently not indexed" bucket
  shrinking and "Indexed" climbing.

---

## Quick checklist

- [ ] Paste unique content into 6 priority pages + fill blank FAQ answers
- [ ] Add FAQPage JSON-LD to each
- [ ] Request Indexing for the 6 pages in GSC
- [ ] Resubmit sitemap; confirm "Success" + correct URL count
- [ ] Publish 2–3 helpful blog posts linking to tools
- [ ] Submit to 5–10 legit directories / profiles
- [ ] Add Organization schema + sameAs on homepage
- [ ] Re-check GSC Pages report in 2, 4 and 8 weeks
