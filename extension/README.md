# SmallPDF.us Chrome Extension

A thin client for smallpdf.us. It does **not** process files — every action opens
the matching tool page on the site. One backend, one set of plan limits, and ad
impressions stay where they are.

**Since 1.1.0** it also *hands the file over*: if you act on a PDF or image you
are looking at, the extension downloads it and drops it into the tool page's own
upload box, so the tool starts with the file already loaded.

## Load it locally

1. Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select this `extension/` folder
4. Pin the icon to the toolbar

## What it does

- **Popup** — all 27 tools as an icon grid, with search and category filters
  (All / PDF / From PDF / To PDF / Image / Secure). Recently-used tools pin to
  the top of the unfiltered list.
- **Open in your tab · send it to** — if the active tab is a PDF or image, the
  popup leads with the 3 most likely actions for that file type, and clicking
  one sends the file along. The ordering is intent-based: an open PDF offers
  Compress / PDF-to-Word / Split, and deliberately *not* Merge, which needs a
  second file.
- **Right-click** — PDF tools on links to PDFs and on pages, image tools on
  images → SmallPDF.us → quick tools, with the clicked file.
- **Your language** — tools open in the browser's UI language when the site has
  it (ja, de, fr, es, it, id, pt, vi, hi), e.g. `/de/pdf-komprimieren/`. The site
  redirects the English slug to the localized one and keeps the query string.
- **Keyboard** — <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> opens the popup;
  arrow keys move through the grid, <kbd>Enter</kbd> opens, <kbd>Esc</kbd>
  clears the search. The search box is focused on open.
- **Look** — matches the site (ink, lime, blue, the 3×3 colour logo). Dark mode
  follows the OS.

Icons are inline SVG (`icons.js`). Extensions can't load an icon font or CDN
sprite under the default CSP, so the markup ships with the popup.

## File handoff (1.1)

1. Popup card button or right-click → `background.js` opens
   `/<tool>/?…&ext_handoff=1` and at the same time downloads the file (with the
   user's cookies, so files behind a login work).
2. `handoff.js` (content script, smallpdf.us only) sees `ext_handoff=1`, asks the
   worker for the file, builds a `File`, puts it into the page's
   `<input type="file">` and fires `change`. The page's normal upload path runs —
   same validation, limits and virus scan as a manual pick.
3. A small toast says "Loaded … from your tab", or, if the file couldn't be
   fetched, "Choose it below instead".

Permissions: the file of the **current tab** always works (`activeTab`). A PDF
link or image on another site needs host permission for that site. That is
optional — the popup footer switch "Files from links & images" requests it.
Without it, those clicks fall back to opening the tool empty.

Limits: up to 45 MB per handed-over file (Chrome caps a message at 64 MiB and
the file travels base64-encoded). `merge-pdf` is excluded — it needs two files,
so a single one would only show its "add at least 2 files" error.

Tested 2026-11-20 against production: compress-pdf, PDF→Word/Excel/JPG, split,
rotate, protect, OCR, compress-image (+50KB), JPG/PNG→PDF and PNG→WEBP all
start with the file loaded. German and Hindi browsers land on
`/de/pdf-komprimieren/vorschau/` and `/hi/compress-pdf/preview/`.

## Tracking

Every link the extension opens carries UTM parameters:

```
?utm_source=chrome_extension&utm_medium=popup|popup_keyboard|context_menu|current_tab|install|popup_header
```

So extension traffic is separable from organic search in Analytics — which
matters, because measuring whether the extension actually drives repeat usage
is the entire point of building it.

## Chrome Web Store

- Listing copy, permission justifications and "what's new" text:
  `STORE_LISTING.md`.
- Screenshots (1280×800): `store-screenshots/`. The 1.0 ones are kept in
  `store-screenshots/v1.0-old/`.
- Package: `smallpdf-extension-v1.1.0.zip` in the repo root (runtime files only).
- Privacy: the extension stores only the recently-used tool slugs in
  `chrome.storage.local`, reads the active tab's URL when the popup is open, and
  — only when the user picks a tool for a file — downloads that one file and
  passes it to the smallpdf.us page.
- **AdSense cannot run inside extension UI** (Google policy). This extension
  shows no ads and doesn't need to — it opens the site, where the ads already are.
