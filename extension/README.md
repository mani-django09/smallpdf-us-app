# SmallPDF.us Chrome Extension

A thin client for smallpdf.us. It does **not** process files — every action opens
the matching tool page on the site. One backend, one set of plan limits, and ad
impressions stay where they are.

## Load it locally

1. Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select this `extension/` folder
4. Pin the icon to the toolbar

## What it does

- **Popup** — all 27 tools as an icon grid, with search and category filters
  (All / PDF / From PDF / To PDF / Image / Secure). Recently-used tools pin to
  the top of the unfiltered list.
- **Detected on this page** — if the active tab is a PDF or image, the popup
  leads with the 3 most likely actions for that file type. The ordering is
  intent-based, not alphabetical: an open PDF offers Compress / PDF-to-Word /
  Split, and deliberately *not* Merge, which needs a second file.
- **Right-click** — on a link, an image, or the page itself → SmallPDF.us →
  quick tools.
- **Keyboard** — arrow keys move through the grid, <kbd>Enter</kbd> opens,
  <kbd>Esc</kbd> clears the search. The search box is focused on open, so the
  common path is: click icon → type → Enter.
- **Dark mode** — follows the OS setting, so the popup doesn't flash white over
  a dark browser.

Icons are inline SVG (`icons.js`). Extensions can't load an icon font or CDN
sprite under the default CSP, so the markup ships with the popup.

## Tracking

Every link the extension opens carries UTM parameters:

```
?utm_source=chrome_extension&utm_medium=popup|context_menu|current_tab|install|popup_footer
```

So extension traffic is separable from organic search in Analytics — which
matters, because measuring whether the extension actually drives repeat usage
is the entire point of building it.

## Not wired up yet: passing the file through

The extension already appends `&src=<file-url>` when the user acted on a
specific file. **The site ignores it today.** To close the loop, a tool page
would need to read `src` and fetch that file into its uploader instead of
asking the user to pick it again:

```js
// pages/<tool>/index.js — sketch, not implemented
const { src } = router.query
// fetch(src) → File → feed into the existing upload handler
```

Two caveats before building that:

- The fetch has to happen **server-side** or through a proxy — the browser will
  block a cross-origin fetch of most PDFs from the page itself.
- Only accept `http(s)` URLs, and treat the fetched file exactly like an
  uploaded one (same size limits, same validation, same virus scan). A URL from
  a right-click is user-supplied input, not trusted.

Until then the extension is a fast launcher: it gets people to the right tool
in one click, but they still choose the file on the page.

## Before publishing to the Chrome Web Store

- `description` and screenshots are required; the store listing is its own
  discovery surface (people search "PDF" there), so treat the copy as SEO.
- A privacy policy URL is required. The extension stores only the recently-used
  tool slugs in `chrome.storage.local`, reads the active tab's URL when the
  popup is open, and sends nothing anywhere — say exactly that.
- **AdSense cannot run inside extension UI** (Google policy). This extension
  shows no ads and doesn't need to — it opens the site, where the ads already are.
