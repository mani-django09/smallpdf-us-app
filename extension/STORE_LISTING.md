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
Compress, convert and edit PDFs & images. Open a PDF and send it straight to any of 27 free tools.
```
(98 chars)

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
• Click the toolbar icon (or press Alt+Shift+P) to see all 27 tools, searchable
• Open a PDF or image in your browser and send it straight to a tool — it arrives already loaded, no downloading and re-uploading
• Right-click a PDF link, an image, or a PDF page to open it in a tool
• Recently used tools are pinned to the top
• Tools open in your browser's language (English, Hindi, German, French, Spanish, Italian, Portuguese, Indonesian, Vietnamese, Japanese)
• Dark mode follows your system

TOOLS INCLUDED
PDF: Merge, Split, Compress, Rotate, Edit, OCR, Unlock, Protect, Redact
Convert from PDF: to Word, Excel, PowerPoint, JPG, PNG
Convert to PDF: from Word, Excel, PowerPoint, JPG, PNG
Images: Compress (incl. exact 20KB/50KB/100KB targets), HEIC to JPG/PNG, WEBP to PNG, PNG to WEBP

HOW IT WORKS
The extension opens the matching tool on smallpdf.us in a new tab. When you choose to send a file you are viewing, the extension downloads that one file and places it into the tool's upload box — exactly as if you had picked it yourself. Nothing is sent anywhere unless you choose a tool for it.

• No account required
• No file size limits enforced by the extension (smallpdf.us's own free-tier limits apply, same as using the site directly)
• Files are auto-deleted from our servers within 1 hour of processing

PRIVACY
The extension stores only the names of your last 4 used tools, locally in your browser. It reads your current tab's URL only when you open the popup, to suggest a relevant tool. A file is downloaded and passed to smallpdf.us only when you pick a tool for it. Nothing is tracked or sold; the links it opens carry a standard analytics tag. Full policy: https://smallpdf.us/extension-privacy

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
Used only after the user clicks the toolbar icon or a right-click entry: to read the current tab's URL and suggest a matching tool (e.g. "Compress PDF" when a .pdf is open), and, when the user picks a tool, to download that file so it can be passed to the tool page. Not used to read page content or track browsing.
```

**Content script on https://smallpdf.us/***
```
Runs only on smallpdf.us tool pages that the extension opened (marked with ext_handoff=1). It places the file the user chose into the page's own upload field. It does not run on any other website.
```

**Optional host permissions (http/https, requested at runtime)**
```
Off by default. Requested only when the user turns on "Files from links & images" in the popup. Lets a right-click on a PDF link or image on another website download that one file so it opens in the chosen tool. Never used without a user action.
```

**Host permission: https://smallpdf.us/***
```
Needed to open smallpdf.us tool pages when the user selects a tool. The extension does not read or modify content on smallpdf.us or any other site.
```

---

## Screenshots (1280×800 or 640×400, up to 5, at least 1 required)

Ready-made, 1280×800, in `store-screenshots/` (upload in this order):
1. `screenshot-2-send-open-pdf.png` — open PDF → send it to a tool (the 1.1 headline feature)
2. `screenshot-1-all-tools.png` — all 27 tools in the toolbar popup
3. `screenshot-3-right-click.png` — right-click a PDF link
4. `screenshot-4-search-dark.png` — keyword search + dark mode

## What's new in 1.1.0 (paste into the update notes)
```
• Send the PDF or image you're viewing straight to a tool — it opens already loaded
• Right-click a PDF link or image to open it in a tool
• Tools open in your language (10 languages)
• New look matching smallpdf.us, plus an Alt+Shift+P shortcut
```

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
