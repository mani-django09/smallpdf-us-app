# Chrome Web Store listing — copy-paste reference

Developer Console → Store listing tab. Field limits noted where they matter.

---

## Extension name (max 45 chars)
```
SmallPDF.us — Free PDF & Image Tools
```
(38 chars — under the limit)

## Summary (max 132 chars — shown under the name in search results)
```
Merge, split, compress and convert PDFs and images in one click. 27 free tools, right from your toolbar.
```
(107 chars)

## Category
**Productivity**

## Language
English (add more later if you localize the popup)

---

## Detailed description
Store search ranks on this text — front-load the terms people actually type
("compress pdf", "merge pdf", "pdf to word") rather than writing pure marketing copy.

```
Every tool from SmallPDF.us, one click away — no more searching "compress pdf online" every time you need it.

WHAT IT DOES
• Click the toolbar icon to see all 27 tools, searchable
• Open a PDF or image in your browser and the popup leads with the 3 tools you're most likely to want for that file
• Right-click any link, image, or page to jump straight to a tool
• Recently used tools are pinned to the top

TOOLS INCLUDED
PDF: Merge, Split, Compress, Rotate, Edit, OCR, Unlock, Protect, Redact
Convert from PDF: to Word, Excel, PowerPoint, JPG, PNG
Convert to PDF: from Word, Excel, PowerPoint, JPG, PNG
Images: Compress (incl. exact 20KB/50KB/100KB targets), HEIC to JPG/PNG, WEBP to PNG, PNG to WEBP

HOW IT WORKS
This extension is a launcher — it opens the matching tool on smallpdf.us in a new tab. Your files are never read, uploaded, or touched by the extension itself; everything happens on the page, the same as if you'd typed the URL in yourself.

• No account required
• No file size limits enforced by the extension (smallpdf.us's own free-tier limits apply, same as using the site directly)
• Files are auto-deleted from our servers within 1 hour of processing

PRIVACY
The extension stores only the names of your last 4 used tools, locally in your browser. It reads your current tab's URL only when you open the popup, to suggest a relevant tool. Nothing is tracked, sold, or sent anywhere except a standard analytics tag on the links it opens. Full policy: https://smallpdf.us/extension-privacy

Questions or feedback: support@smallpdf.us
```

---

## Privacy policy URL
```
https://smallpdf.us/extension-privacy
```

## Official website (optional but recommended)
```
https://smallpdf.us
```

## Support URL (optional)
```
https://smallpdf.us/contact
```

---

## Single purpose description (required — Google asks "what is the single purpose of this extension?")
```
Provide one-click access to smallpdf.us's PDF and image conversion tools directly from the browser toolbar and right-click menu.
```

## Permission justifications (required per-permission in the review form)

**contextMenus**
```
Used to add "SmallPDF.us" quick-tool entries to the right-click menu on links, images, and pages.
```

**storage**
```
Used to remember the names of the user's last 4 used tools locally, so the popup can show a "Recently used" shortcut. No data leaves the device.
```

**activeTab**
```
Used only while the popup is open, to read the current tab's URL and suggest a matching tool (e.g. offering "Compress PDF" when a .pdf file is open). Not used to read page content or track browsing.
```

**Host permission: https://smallpdf.us/***
```
Needed to open smallpdf.us tool pages when the user selects a tool. The extension does not read or modify content on smallpdf.us or any other site.
```

---

## Screenshots (1280×800 or 640×400, up to 5, at least 1 required)

Suggested shots, in priority order:
1. Popup open, showing the tool grid with icons and "Recently used"
2. The "Detected on this page" card with a PDF open in a tab behind it
3. Right-click context menu showing the SmallPDF.us submenu on a page
4. Search in the popup filtered to a query like "word"
5. Dark mode popup, for symmetry with light mode

## Promotional tile (optional, 440×280) — small badge shown in category browsing
Simple: logo + "27 Free PDF Tools" on the site's red (#DC2626) background.

---

## Pricing & distribution
- **Free**, no in-app purchases
- Visibility: **Public**
- Regions: All regions (the extension itself has no region logic; smallpdf.us handles currency/gateway routing)

## After first publish
Once the listing is live, copy its URL into
`frontend/components/InstallExtensionBanner.js` → `CHROME_WEBSTORE_URL`,
then redeploy the frontend. The install banner is hidden until that's set.
