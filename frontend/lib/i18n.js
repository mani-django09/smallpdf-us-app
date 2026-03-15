import { useRouter } from 'next/router'

// ── Shared / Layout Translations 
import enCommon from '../messages/en/common.json'
import jaCommon from '../messages/ja/common.json'
import deCommon from '../messages/de/common.json'
import frCommon from '../messages/fr/common.json'
import esCommon from '../messages/es/common.json'
import itCommon from '../messages/it/common.json'
import idCommon from '../messages/id/common.json'
import ptCommon from '../messages/pt/common.json'

// ── Page-level Translations 

// pdf-to-jpg
import enPdfToJpg from '../messages/en/pdf-to-jpg.json'
import jaPdfToJpg from '../messages/ja/pdf-to-jpg.json'
import dePdfToJpg from '../messages/de/pdf-to-jpg.json'
import frPdfToJpg from '../messages/fr/pdf-to-jpg.json'
import esPdfToJpg from '../messages/es/pdf-to-jpg.json'
import itPdfToJpg from '../messages/it/pdf-to-jpg.json'
import idPdfToJpg from '../messages/id/pdf-to-jpg.json'
import ptPdfToJpg from '../messages/pt/pdf-to-jpg.json'

// jpg-to-pdf
import enJpgToPdf from '../messages/en/jpg-to-pdf.json'
import jaJpgToPdf from '../messages/ja/jpg-to-pdf.json'
import deJpgToPdf from '../messages/de/jpg-to-pdf.json'
import frJpgToPdf from '../messages/fr/jpg-to-pdf.json'
import esJpgToPdf from '../messages/es/jpg-to-pdf.json'
import itJpgToPdf from '../messages/it/jpg-to-pdf.json'
import idJpgToPdf from '../messages/id/jpg-to-pdf.json'
import ptJpgToPdf from '../messages/pt/jpg-to-pdf.json'

// pdf-to-word
import enPdfToWord from '../messages/en/pdf-to-word.json'
import jaPdfToWord from '../messages/ja/pdf-to-word.json'
import dePdfToWord from '../messages/de/pdf-to-word.json'
import frPdfToWord from '../messages/fr/pdf-to-word.json'
import esPdfToWord from '../messages/es/pdf-to-word.json'
import itPdfToWord from '../messages/it/pdf-to-word.json'
import idPdfToWord from '../messages/id/pdf-to-word.json'
import ptPdfToWord from '../messages/pt/pdf-to-word.json'

// word-to-pdf
import enWordToPdf from '../messages/en/word-to-pdf.json'
import jaWordToPdf from '../messages/ja/word-to-pdf.json'
import deWordToPdf from '../messages/de/word-to-pdf.json'
import frWordToPdf from '../messages/fr/word-to-pdf.json'
import esWordToPdf from '../messages/es/word-to-pdf.json'
import itWordToPdf from '../messages/it/word-to-pdf.json'
import idWordToPdf from '../messages/id/word-to-pdf.json'
import ptWordToPdf from '../messages/pt/word-to-pdf.json'

// compress-pdf
import enCompressPdf from '../messages/en/compress-pdf.json'
import jaCompressPdf from '../messages/ja/compress-pdf.json'
import deCompressPdf from '../messages/de/compress-pdf.json'
import frCompressPdf from '../messages/fr/compress-pdf.json'
import esCompressPdf from '../messages/es/compress-pdf.json'
import itCompressPdf from '../messages/it/compress-pdf.json'
import idCompressPdf from '../messages/id/compress-pdf.json'
import ptCompressPdf from '../messages/pt/compress-pdf.json'

// merge-pdf
import enMergePdf from '../messages/en/merge-pdf.json'
import jaMergePdf from '../messages/ja/merge-pdf.json'
import deMergePdf from '../messages/de/merge-pdf.json'
import frMergePdf from '../messages/fr/merge-pdf.json'
import esMergePdf from '../messages/es/merge-pdf.json'
import itMergePdf from '../messages/it/merge-pdf.json'
import idMergePdf from '../messages/id/merge-pdf.json'
import ptMergePdf from '../messages/pt/merge-pdf.json'

// split-pdf
import enSplitPdf from '../messages/en/split-pdf.json'
import jaSplitPdf from '../messages/ja/split-pdf.json'
import deSplitPdf from '../messages/de/split-pdf.json'
import frSplitPdf from '../messages/fr/split-pdf.json'
import esSplitPdf from '../messages/es/split-pdf.json'
import itSplitPdf from '../messages/it/split-pdf.json'
import idSplitPdf from '../messages/id/split-pdf.json'
import ptSplitPdf from '../messages/pt/split-pdf.json'

// pdf-to-excel
import enPdfToExcel from '../messages/en/pdf-to-excel.json'
import jaPdfToExcel from '../messages/ja/pdf-to-excel.json'
import dePdfToExcel from '../messages/de/pdf-to-excel.json'
import frPdfToExcel from '../messages/fr/pdf-to-excel.json'
import esPdfToExcel from '../messages/es/pdf-to-excel.json'
import itPdfToExcel from '../messages/it/pdf-to-excel.json'
import idPdfToExcel from '../messages/id/pdf-to-excel.json'
import ptPdfToExcel from '../messages/pt/pdf-to-excel.json'

// excel-to-pdf
import enExcelToPdf from '../messages/en/excel-to-pdf.json'
import jaExcelToPdf from '../messages/ja/excel-to-pdf.json'
import deExcelToPdf from '../messages/de/excel-to-pdf.json'
import frExcelToPdf from '../messages/fr/excel-to-pdf.json'
import esExcelToPdf from '../messages/es/excel-to-pdf.json'
import itExcelToPdf from '../messages/it/excel-to-pdf.json'
import idExcelToPdf from '../messages/id/excel-to-pdf.json'
import ptExcelToPdf from '../messages/pt/excel-to-pdf.json'

// png-to-pdf
import enPngToPdf from '../messages/en/png-to-pdf.json'
import jaPngToPdf from '../messages/ja/png-to-pdf.json'
import dePngToPdf from '../messages/de/png-to-pdf.json'
import frPngToPdf from '../messages/fr/png-to-pdf.json'
import esPngToPdf from '../messages/es/png-to-pdf.json'
import itPngToPdf from '../messages/it/png-to-pdf.json'
import idPngToPdf from '../messages/id/png-to-pdf.json'
import ptPngToPdf from '../messages/pt/png-to-pdf.json'

// pdf-to-png
import enPdfToPng from '../messages/en/pdf-to-png.json'
import jaPdfToPng from '../messages/ja/pdf-to-png.json'
import dePdfToPng from '../messages/de/pdf-to-png.json'
import frPdfToPng from '../messages/fr/pdf-to-png.json'
import esPdfToPng from '../messages/es/pdf-to-png.json'
import itPdfToPng from '../messages/it/pdf-to-png.json'
import idPdfToPng from '../messages/id/pdf-to-png.json'
import ptPdfToPng from '../messages/pt/pdf-to-png.json'

// pdf-to-ppt
import enPdfToPpt from '../messages/en/pdf-to-ppt.json'
import jaPdfToPpt from '../messages/ja/pdf-to-ppt.json'
import dePdfToPpt from '../messages/de/pdf-to-ppt.json'
import frPdfToPpt from '../messages/fr/pdf-to-ppt.json'
import esPdfToPpt from '../messages/es/pdf-to-ppt.json'
import itPdfToPpt from '../messages/it/pdf-to-ppt.json'
import idPdfToPpt from '../messages/id/pdf-to-ppt.json'
import ptPdfToPpt from '../messages/pt/pdf-to-ppt.json'

// ppt-to-pdf
import enPptToPdf from '../messages/en/ppt-to-pdf.json'
import jaPptToPdf from '../messages/ja/ppt-to-pdf.json'
import dePptToPdf from '../messages/de/ppt-to-pdf.json'
import frPptToPdf from '../messages/fr/ppt-to-pdf.json'
import esPptToPdf from '../messages/es/ppt-to-pdf.json'
import itPptToPdf from '../messages/it/ppt-to-pdf.json'
import idPptToPdf from '../messages/id/ppt-to-pdf.json'
import ptPptToPdf from '../messages/pt/ppt-to-pdf.json'

// png-to-webp
import enPngToWebp from '../messages/en/png-to-webp.json'
import jaPngToWebp from '../messages/ja/png-to-webp.json'
import dePngToWebp from '../messages/de/png-to-webp.json'
import frPngToWebp from '../messages/fr/png-to-webp.json'
import esPngToWebp from '../messages/es/png-to-webp.json'
import itPngToWebp from '../messages/it/png-to-webp.json'
import idPngToWebp from '../messages/id/png-to-webp.json'
import ptPngToWebp from '../messages/pt/png-to-webp.json'

// compress-image
import enCompressImage from '../messages/en/compress-image.json'
import jaCompressImage from '../messages/ja/compress-image.json'
import deCompressImage from '../messages/de/compress-image.json'
import frCompressImage from '../messages/fr/compress-image.json'
import esCompressImage from '../messages/es/compress-image.json'
import itCompressImage from '../messages/it/compress-image.json'
import idCompressImage from '../messages/id/compress-image.json'
import ptCompressImage from '../messages/pt/compress-image.json'

// webp-to-png
import enWebpToPng from '../messages/en/webp-to-png.json'
import jaWebpToPng from '../messages/ja/webp-to-png.json'
import deWebpToPng from '../messages/de/webp-to-png.json'
import frWebpToPng from '../messages/fr/webp-to-png.json'
import esWebpToPng from '../messages/es/webp-to-png.json'
import itWebpToPng from '../messages/it/webp-to-png.json'
import idWebpToPng from '../messages/id/webp-to-png.json'
import ptWebpToPng from '../messages/pt/webp-to-png.json'

// unlock-pdf
import enUnlockPdf from '../messages/en/unlock-pdf.json'
import jaUnlockPdf from '../messages/ja/unlock-pdf.json'
import deUnlockPdf from '../messages/de/unlock-pdf.json'
import frUnlockPdf from '../messages/fr/unlock-pdf.json'
import esUnlockPdf from '../messages/es/unlock-pdf.json'
import itUnlockPdf from '../messages/it/unlock-pdf.json'
import idUnlockPdf from '../messages/id/unlock-pdf.json'
import ptUnlockPdf from '../messages/pt/unlock-pdf.json'

// ocr-pdf
import enOcrPdf from '../messages/en/ocr-pdf.json'
import jaOcrPdf from '../messages/ja/ocr-pdf.json'
import deOcrPdf from '../messages/de/ocr-pdf.json'
import frOcrPdf from '../messages/fr/ocr-pdf.json'
import esOcrPdf from '../messages/es/ocr-pdf.json'
import itOcrPdf from '../messages/it/ocr-pdf.json'
import idOcrPdf from '../messages/id/ocr-pdf.json'
import ptOcrPdf from '../messages/pt/ocr-pdf.json'

// static pages
import enStaticPages from '../messages/en/static-pages.json'
import jaStaticPages from '../messages/ja/static-pages.json'
import deStaticPages from '../messages/de/static-pages.json'
import frStaticPages from '../messages/fr/static-pages.json'
import esStaticPages from '../messages/es/static-pages.json'
import itStaticPages from '../messages/it/static-pages.json'
import idStaticPages from '../messages/id/static-pages.json'
import ptStaticPages from '../messages/pt/static-pages.json'

// ── Pricing page ──────────────────────────────────────────────
import enPricing from '../messages/en/pricing.json'
import jaPricing from '../messages/ja/pricing.json'
import dePricing from '../messages/de/pricing.json'
import frPricing from '../messages/fr/pricing.json'
import esPricing from '../messages/es/pricing.json'
import itPricing from '../messages/it/pricing.json'
import idPricing from '../messages/id/pricing.json'
import ptPricing from '../messages/pt/pricing.json'

// ── Auth pages (login, signup, forgot/reset password, verify email, subscription, payment success) ──
import enAuth from '../messages/en/auth.json'
import jaAuth from '../messages/ja/auth.json'
import deAuth from '../messages/de/auth.json'
import frAuth from '../messages/fr/auth.json'
import esAuth from '../messages/es/auth.json'
import itAuth from '../messages/it/auth.json'
import idAuth from '../messages/id/auth.json'
import ptAuth from '../messages/pt/auth.json'

// ── Messages Object 
const messages = {
  en: {
    ...enCommon,
    pdfToJpg: enPdfToJpg,
    jpgToPdf: enJpgToPdf,
    pdfToWord: enPdfToWord,
    pdfToWordPreview: enPdfToWord.preview,
    pdfToWordDownload: enPdfToWord.download,
    wordToPdf: enWordToPdf,
    compressPdf: enCompressPdf,
    mergePdf: enMergePdf,
    splitPdf: enSplitPdf,
    pdfToExcel: enPdfToExcel,
    excelToPdf: enExcelToPdf,
    pngToPdf: enPngToPdf,
    pdfToPng: enPdfToPng,
    pdfToPpt: enPdfToPpt,
    pptToPdf: enPptToPdf,
    pptToPdfPreview: enPptToPdf.preview,
    pptToPdfDownload: enPptToPdf.download,
    pngToWebp: enPngToWebp,
    pngToWebpPreview: enPngToWebp.preview,
    pngToWebpDownload: enPngToWebp.download,
    compressImage: enCompressImage,
    webpToPng: enWebpToPng,
    unlockPdf: enUnlockPdf,
    ocrPdf: enOcrPdf,
    about: enStaticPages.about,
    contact: enStaticPages.contact,
    privacy: enStaticPages.privacy,
    terms: enStaticPages.terms,
    refund: enStaticPages.refund,
    pricing: enPricing,
    auth: enAuth,
  },

  ja: {
    ...jaCommon,
    pdfToJpg: jaPdfToJpg,
    jpgToPdf: jaJpgToPdf,
    pdfToWord: jaPdfToWord,
    pdfToWordPreview: jaPdfToWord.preview,
    pdfToWordDownload: jaPdfToWord.download,
    wordToPdf: jaWordToPdf,
    compressPdf: jaCompressPdf,
    mergePdf: jaMergePdf,
    splitPdf: jaSplitPdf,
    pdfToExcel: jaPdfToExcel,
    excelToPdf: jaExcelToPdf,
    pngToPdf: jaPngToPdf,
    pdfToPng: jaPdfToPng,
    pdfToPpt: jaPdfToPpt,
    pptToPdf: jaPptToPdf,
    pptToPdfPreview: jaPptToPdf.preview,
    pptToPdfDownload: jaPptToPdf.download,
    pngToWebp: jaPngToWebp,
    pngToWebpPreview: jaPngToWebp.preview,
    pngToWebpDownload: jaPngToWebp.download,
    compressImage: jaCompressImage,
    webpToPng: jaWebpToPng,
    unlockPdf: jaUnlockPdf,
    ocrPdf: jaOcrPdf,
    about: jaStaticPages.about,
    contact: jaStaticPages.contact,
    privacy: jaStaticPages.privacy,
    terms: jaStaticPages.terms,
    refund: jaStaticPages.refund,
    pricing: jaPricing,
    auth: jaAuth,
  },

  de: {
    ...deCommon,
    pdfToJpg: dePdfToJpg,
    jpgToPdf: deJpgToPdf,
    pdfToWord: dePdfToWord,
    pdfToWordPreview: dePdfToWord.preview,
    pdfToWordDownload: dePdfToWord.download,
    wordToPdf: deWordToPdf,
    compressPdf: deCompressPdf,
    mergePdf: deMergePdf,
    splitPdf: deSplitPdf,
    pdfToExcel: dePdfToExcel,
    excelToPdf: deExcelToPdf,
    pngToPdf: dePngToPdf,
    pdfToPng: dePdfToPng,
    pdfToPpt: dePdfToPpt,
    pptToPdf: dePptToPdf,
    pptToPdfPreview: dePptToPdf.preview,
    pptToPdfDownload: dePptToPdf.download,
    pngToWebp: dePngToWebp,
    pngToWebpPreview: dePngToWebp.preview,
    pngToWebpDownload: dePngToWebp.download,
    compressImage: deCompressImage,
    webpToPng: deWebpToPng,
    unlockPdf: deUnlockPdf,
    ocrPdf: deOcrPdf,
    about: deStaticPages.about,
    contact: deStaticPages.contact,
    privacy: deStaticPages.privacy,
    terms: deStaticPages.terms,
    refund: deStaticPages.refund,
    pricing: dePricing,
    auth: deAuth,
  },

  fr: {
    ...frCommon,
    pdfToJpg: frPdfToJpg,
    jpgToPdf: frJpgToPdf,
    pdfToWord: frPdfToWord,
    pdfToWordPreview: frPdfToWord.preview,
    pdfToWordDownload: frPdfToWord.download,
    wordToPdf: frWordToPdf,
    compressPdf: frCompressPdf,
    mergePdf: frMergePdf,
    splitPdf: frSplitPdf,
    pdfToExcel: frPdfToExcel,
    excelToPdf: frExcelToPdf,
    pngToPdf: frPngToPdf,
    pdfToPng: frPdfToPng,
    pdfToPpt: frPdfToPpt,
    pptToPdf: frPptToPdf,
    pptToPdfPreview: frPptToPdf.preview,
    pptToPdfDownload: frPptToPdf.download,
    pngToWebp: frPngToWebp,
    pngToWebpPreview: frPngToWebp.preview,
    pngToWebpDownload: frPngToWebp.download,
    compressImage: frCompressImage,
    webpToPng: frWebpToPng,
    unlockPdf: frUnlockPdf,
    ocrPdf: frOcrPdf,
    about: frStaticPages.about,
    contact: frStaticPages.contact,
    privacy: frStaticPages.privacy,
    terms: frStaticPages.terms,
    refund: frStaticPages.refund,
    pricing: frPricing,
    auth: frAuth,
  },

  es: {
    ...esCommon,
    pdfToJpg: esPdfToJpg,
    jpgToPdf: esJpgToPdf,
    pdfToWord: esPdfToWord,
    pdfToWordPreview: esPdfToWord.preview,
    pdfToWordDownload: esPdfToWord.download,
    wordToPdf: esWordToPdf,
    compressPdf: esCompressPdf,
    mergePdf: esMergePdf,
    splitPdf: esSplitPdf,
    pdfToExcel: esPdfToExcel,
    excelToPdf: esExcelToPdf,
    pngToPdf: esPngToPdf,
    pdfToPng: esPdfToPng,
    pdfToPpt: esPdfToPpt,
    pptToPdf: esPptToPdf,
    pptToPdfPreview: esPptToPdf.preview,
    pptToPdfDownload: esPptToPdf.download,
    pngToWebp: esPngToWebp,
    pngToWebpPreview: esPngToWebp.preview,
    pngToWebpDownload: esPngToWebp.download,
    compressImage: esCompressImage,
    webpToPng: esWebpToPng,
    unlockPdf: esUnlockPdf,
    ocrPdf: esOcrPdf,
    about: esStaticPages.about,
    contact: esStaticPages.contact,
    privacy: esStaticPages.privacy,
    terms: esStaticPages.terms,
    refund: esStaticPages.refund,
    pricing: esPricing,
    auth: esAuth,
  },

  it: {
    ...itCommon,
    pdfToJpg: itPdfToJpg,
    jpgToPdf: itJpgToPdf,
    pdfToWord: itPdfToWord,
    pdfToWordPreview: itPdfToWord.preview,
    pdfToWordDownload: itPdfToWord.download,
    wordToPdf: itWordToPdf,
    compressPdf: itCompressPdf,
    mergePdf: itMergePdf,
    splitPdf: itSplitPdf,
    pdfToExcel: itPdfToExcel,
    excelToPdf: itExcelToPdf,
    pngToPdf: itPngToPdf,
    pdfToPng: itPdfToPng,
    pdfToPpt: itPdfToPpt,
    pptToPdf: itPptToPdf,
    pptToPdfPreview: itPptToPdf.preview,
    pptToPdfDownload: itPptToPdf.download,
    pngToWebp: itPngToWebp,
    pngToWebpPreview: itPngToWebp.preview,
    pngToWebpDownload: itPngToWebp.download,
    compressImage: itCompressImage,
    webpToPng: itWebpToPng,
    unlockPdf: itUnlockPdf,
    ocrPdf: itOcrPdf,
    about: itStaticPages.about,
    contact: itStaticPages.contact,
    privacy: itStaticPages.privacy,
    terms: itStaticPages.terms,
    refund: itStaticPages.refund,
    pricing: itPricing,
    auth: itAuth,
  },

  id: {
    ...idCommon,
    pdfToJpg: idPdfToJpg,
    jpgToPdf: idJpgToPdf,
    pdfToWord: idPdfToWord,
    pdfToWordPreview: idPdfToWord.preview,
    pdfToWordDownload: idPdfToWord.download,
    wordToPdf: idWordToPdf,
    compressPdf: idCompressPdf,
    mergePdf: idMergePdf,
    splitPdf: idSplitPdf,
    pdfToExcel: idPdfToExcel,
    excelToPdf: idExcelToPdf,
    pngToPdf: idPngToPdf,
    pdfToPng: idPdfToPng,
    pdfToPpt: idPdfToPpt,
    pptToPdf: idPptToPdf,
    pptToPdfPreview: idPptToPdf.preview,
    pptToPdfDownload: idPptToPdf.download,
    pngToWebp: idPngToWebp,
    pngToWebpPreview: idPngToWebp.preview,
    pngToWebpDownload: idPngToWebp.download,
    compressImage: idCompressImage,
    webpToPng: idWebpToPng,
    unlockPdf: idUnlockPdf,
    ocrPdf: idOcrPdf,
    about: idStaticPages.about,
    contact: idStaticPages.contact,
    privacy: idStaticPages.privacy,
    terms: idStaticPages.terms,
    refund: idStaticPages.refund,
    pricing: idPricing,
    auth: idAuth,
  },

  // ── Brazilian Portuguese ──────────────────────────────────────
  pt: {
    ...ptCommon,
    pdfToJpg: ptPdfToJpg,
    jpgToPdf: ptJpgToPdf,
    pdfToWord: ptPdfToWord,
    pdfToWordPreview: ptPdfToWord.preview,
    pdfToWordDownload: ptPdfToWord.download,
    wordToPdf: ptWordToPdf,
    compressPdf: ptCompressPdf,
    mergePdf: ptMergePdf,
    splitPdf: ptSplitPdf,
    pdfToExcel: ptPdfToExcel,
    excelToPdf: ptExcelToPdf,
    pngToPdf: ptPngToPdf,
    pdfToPng: ptPdfToPng,
    pdfToPpt: ptPdfToPpt,
    pptToPdf: ptPptToPdf,
    pptToPdfPreview: ptPptToPdf.preview,
    pptToPdfDownload: ptPptToPdf.download,
    pngToWebp: ptPngToWebp,
    pngToWebpPreview: ptPngToWebp.preview,
    pngToWebpDownload: ptPngToWebp.download,
    compressImage: ptCompressImage,
    webpToPng: ptWebpToPng,
    unlockPdf: ptUnlockPdf,
    ocrPdf: ptOcrPdf,
    about: ptStaticPages.about,
    contact: ptStaticPages.contact,
    privacy: ptStaticPages.privacy,
    terms: ptStaticPages.terms,
    refund: ptStaticPages.refund,
    pricing: ptPricing,
    auth: ptAuth,
  },
}

// ── Hook 
export function useTranslations() {
  const router = useRouter()
  const { locale = 'en' } = router

  /**
   * Translate a dot-separated key, with optional interpolation.
   *
   * Usage:
   *   t("unlockPdf.downloadCardTitle")
   *   t("unlockPdf.downloadCardSubtitle", { count: 3, plural: "s" })
   *
   * All {placeholder} tokens in the resolved string are replaced with the
   * matching value from `params`. Uses replaceAll so a key like
   * "PDF{plural} desbloqueado{plural}" works correctly.
   */
  const t = (key, params) => {
    const keys = key.split('.')
    let value = messages[locale]

    for (const k of keys) {
      value = value?.[k]
    }

    if (value === undefined || value === null) return key
    if (typeof value !== 'string') return key

    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replaceAll(`{${k}}`, v ?? ''),
        value
      )
    }

    return value
  }

  return { t, locale }
}

// ── SSR Helpers 
export function getTranslations(locale) {
  return messages[locale] ?? messages.en
}

export function getPageTranslations(locale, namespace) {
  const localeMessages = messages[locale] ?? messages.en
  return localeMessages[namespace] ?? {}
}