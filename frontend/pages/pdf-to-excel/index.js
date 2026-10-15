import { useState, useRef, useCallback } from "react"
import { useLocalizedRouter } from "../../lib/useLocalizedRouter"
import Layout from "../../components/Layout"
import { getPageMessages } from "../../lib/i18nLoader"
import RelatedTools from '../../components/RelatedTools'
import AdSenseUnit from "../../components/AdSenseUnit"
import SEOHead from "../../components/SEOHead"
import { useFileSizeGuard } from "../../hooks/useFileSizeGuard"
import { useBatchGuard } from "../../hooks/useBatchGuard"
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  Shield,
  Zap,
  Clock,
  Star,
  ArrowRight,
  FileText,
  Table,
  ChevronDown,
  ChevronUp,
  Grid3X3,
  BarChart3,
  FileCheck,
  Lock,
  Sparkles,
  AlertCircle,
  Trash2,
} from "lucide-react"

// i18n translations 
const translations = {
  en: {
    pageTitle: "PDF to Excel Converter - Free Online PDF to XLSX | SmallPDF.us",
    pageDescription:
      "Convert PDF to Excel for free. Extract tables and data from PDFs into editable XLSX files. Fast, accurate and secure, with OCR support.",
    heroTitle: "PDF to Excel",
    heroTitleHighlight: "Converter Free",
    heroSubtitle:
      "Extract tables and data from PDF files to editable Excel spreadsheets. Fast, accurate, and easy to use.",
    uploadDragText: "Select PDF to Convert",
    uploadDragActive: "Drop Your PDF Here!",
    uploadSubtext: "Drag and drop your PDF or click to browse",
    uploadButton: "Choose PDF",
    uploadLimit: "Maximum {maxSize} per file • Up to {maxFiles} files",
    errorInvalidType: "Only PDF files are allowed",
    errorMaxSize: "File size exceeds the 5MB free-plan limit",
    errorMaxFiles: "Maximum {maxFiles} files allowed",
    convertButton: "Convert to Excel",
    secureLabel: "Secure",
    instantLabel: "Instant",
    pdfFormatLabel: "PDF Format",
    filesSelected: "{count} file{plural} selected",
    totalLabel: "total",
    removeAllFiles: "Remove all files",
    howItWorksTitle: "How to Convert PDF to Excel",
    howItWorksSubtitle:
      "Transform your PDF documents into editable Excel spreadsheets in three simple steps",
    step1Title: "Upload PDF",
    step1Desc: "Drag and drop your PDF file or click to browse. Supports multiple file upload.",
    step2Title: "Extract Tables",
    step2Desc: "Our AI automatically detects and extracts tables with high accuracy.",
    step3Title: "Download Excel",
    step3Desc: "Get your editable Excel file with all data and formatting preserved.",
    featuresTitle: "Powerful PDF to Excel Features",
    featuresSubtitle: "Advanced technology to convert your PDF files with perfect accuracy",
    feature1Title: "Smart Table Detection",
    feature1Desc: "AI-powered algorithm automatically identifies and extracts tables from your PDFs.",
    feature2Title: "Preserve Formatting",
    feature2Desc: "Keep cell borders, colors, fonts, and number formats intact after conversion.",
    feature3Title: "OCR Support",
    feature3Desc: "Convert scanned PDFs and images to editable Excel using advanced OCR technology.",
    feature4Title: "Fast Processing",
    feature4Desc: "Convert large PDF files in seconds with our optimized processing engine.",
    feature5Title: "Bank-Level Security",
    feature5Desc:
      "256-bit SSL encryption and automatic file deletion ensure your data stays private.",
    feature6Title: "Multiple Sheets",
    feature6Desc: "Multi-page PDFs are converted with each page as a separate Excel sheet.",
    convertAnyTitle: "Convert Any PDF to Excel",
    convertAnySubtitle:
      "Our converter handles all types of PDF documents and extracts data with exceptional accuracy.",
    convertAnyList1: "Native PDF documents with selectable text",
    convertAnyList2: "Scanned PDFs using OCR technology",
    convertAnyList3: "Complex tables with merged cells",
    convertAnyList4: "Multi-column layouts and forms",
    convertAnyList5: "Financial statements and invoices",
    convertAnyList6: "Data reports and spreadsheets",
    outputFormatsTitle: "Output Formats",
    outputFormatsSubtitle: "Your converted file will be in XLSX format",
    inputFormatLabel: "Input Format",
    outputFormatLabel: "Output Format",
    compatNote:
      "Compatible with Microsoft Excel, Google Sheets, LibreOffice Calc, and more",
    diveTitle: "What to know before you convert",
    diveSubtitle: "The details that actually affect your result — not generic tips.",
    dive1Title: "Best for invoices",
    dive1Desc: "Invoices are one of the most common PDF-to-Excel conversions. Line items, quantities, unit prices, and totals usually sit in a clean grid, which our table detector reads reliably — so you can pull vendor invoices straight into a spreadsheet for bookkeeping without retyping numbers.",
    dive2Title: "Digital tables vs. scanned PDFs",
    dive2Desc: "A PDF generated digitally (from Excel, accounting software, or a website) has selectable text and a defined table structure, so conversion is fast and exact. A scanned or photographed PDF has no text layer at all — just an image — so it needs OCR first.",
    dive3Title: "How table extraction actually works",
    dive3Desc: "Our converter looks for consistent column alignment, cell borders, and spacing patterns across each page to identify where a table starts and ends. Once it maps the grid, each cell's content is placed into the matching Excel cell — preserving rows and columns instead of dumping everything into one block of text.",
    dive4Title: "Formatting limitations to expect",
    dive4Desc: "Simple grids convert cleanly, but a few things can trip up any PDF-to-Excel tool: cells merged across multiple rows, tables that wrap across a page break, and sub-tables nested inside a single cell. These usually still convert, but may need a manual tweak afterward.",
    dive5Title: "PDFs with multiple tables",
    dive5Desc: "If your PDF has more than one table — across different pages, or several on one page — each is detected separately and kept distinct in the output, so they don't get merged into a single garbled table.",
    dive6Title: "Scanned PDF → OCR → Excel",
    dive6Desc: "For scanned or photographed documents, our tool runs Optical Character Recognition first to read the text and numbers off the image, then applies the same table-detection logic to the OCR output. Accuracy depends on scan quality — a clear 300 DPI scan converts far better than a blurry phone photo.",
    faqTitle: "Frequently Asked Questions",
    faqSubtitle: "Everything you need to know about PDF to Excel conversion",
    faq1Question: "How accurate is the PDF to Excel conversion?",
    faq1Answer:
      "Our converter uses advanced table detection algorithms to accurately extract tabular data from PDFs. It preserves cell structure, formatting, and data types. For scanned PDFs, OCR technology is used to recognize text and convert it to editable Excel format.",
    faq2Question: "Can I convert scanned PDF documents to Excel?",
    faq2Answer:
      "Yes! Our tool supports OCR (Optical Character Recognition) technology that can extract text and tables from scanned PDF documents and convert them into editable Excel spreadsheets.",
    faq3Question: "Will my data formatting be preserved?",
    faq3Answer:
      "We strive to preserve as much formatting as possible, including cell borders, text alignment, number formats, and merged cells. Complex layouts may require minor adjustments after conversion.",
    faq4Question: "Is there a limit to the file size I can convert?",
    faq4Answer:
      "On the free plan you can convert PDF files up to 5MB (20MB on Starter). For larger files, we recommend splitting them into smaller parts before conversion.",
    faq5Question: "How secure is my data during conversion?",
    faq5Answer:
      "Your security is our priority. All files are encrypted during transfer using 256-bit SSL encryption. Files are automatically deleted from our servers within 1 hour after conversion, and we never share your data with third parties.",
    faq6Question: "Can I convert multiple PDF files at once?",
    faq6Answer:
      "Yes! You can upload and convert up to 10 PDF files simultaneously. Each file will be converted to a separate Excel spreadsheet.",
    ctaTitle: "Ready to Convert Your PDF?",
    ctaSubtitle:
      "Free for 1 file at a time, up to 5MB. Files are deleted after an hour.",
    ctaButton: "Upload PDF Now",
    ctaNote: "Fast • Secure • Private",
    relatedToolsTitle: "Related PDF Tools",
    relatedToolsSubtitle: "Explore more tools to work with your PDF files",
    tool1: "Excel to PDF",
    tool2: "PDF to Word",
    tool3: "Word to PDF",
    tool4: "Merge PDF",
    tool5: "Compress PDF",
    tool6: "Split PDF",
  },
  ja: {
    pageTitle: "PDFをExcelに変換 - 無料オンラインPDF→XLSX変換 | SmallPDF.us",
    pageDescription:
      "PDFを無料でExcelスプレッドシートに変換。PDFから表やデータを抽出して編集可能なXLSX形式に。OCR対応の高速・高精度・安全なオンライン変換ツール。",
    heroTitle: "PDFをExcelに変換",
    heroTitleHighlight: "無料オンラインツール",
    heroSubtitle:
      "PDFファイルから表やデータを抽出して編集可能なExcelスプレッドシートに変換。高速・高精度で、使い方も簡単です。",
    uploadDragText: "変換するPDFを選択",
    uploadDragActive: "ここにPDFをドロップ！",
    uploadSubtext: "PDFをドラッグ＆ドロップするか、クリックして参照",
    uploadButton: "PDFを選択",
    uploadLimit: "1ファイル最大{maxSize} • 最大{maxFiles}ファイルまで",
    errorInvalidType: "PDFファイルのみアップロードできます",
    errorMaxSize: "ファイルサイズが無料プランの上限5MBを超えています",
    errorMaxFiles: "最大{maxFiles}ファイルまでです",
    convertButton: "Excelに変換",
    secureLabel: "安全",
    instantLabel: "即時",
    pdfFormatLabel: "PDF形式",
    filesSelected: "{count}件のファイルを選択中",
    totalLabel: "合計",
    removeAllFiles: "すべてのファイルを削除",
    howItWorksTitle: "PDFをExcelに変換する方法",
    howItWorksSubtitle:
      "3つの簡単なステップでPDFを編集可能なExcelスプレッドシートに変換",
    step1Title: "PDFをアップロード",
    step1Desc:
      "PDFファイルをドラッグ＆ドロップするか、クリックして参照。複数ファイルの同時アップロードに対応。",
    step2Title: "表を抽出",
    step2Desc: "AIが自動的に表を検出し、高精度で抽出します。",
    step3Title: "Excelをダウンロード",
    step3Desc: "すべてのデータと書式を保持した編集可能なExcelファイルを取得。",
    featuresTitle: "強力なPDF→Excel変換機能",
    featuresSubtitle: "完璧な精度でPDFを変換する先進技術",
    feature1Title: "スマート表検出",
    feature1Desc: "AIアルゴリズムがPDFから表を自動識別・抽出します。",
    feature2Title: "書式を保持",
    feature2Desc: "変換後もセルの罫線・色・フォント・数値形式をそのまま保持。",
    feature3Title: "OCR対応",
    feature3Desc: "スキャンしたPDFや画像を高度なOCR技術で編集可能なExcelに変換。",
    feature4Title: "超高速変換",
    feature4Desc: "最適化されたエンジンで大容量PDFも数秒で変換。",
    feature5Title: "銀行レベルのセキュリティ",
    feature5Desc: "256ビットSSL暗号化と自動ファイル削除でデータを完全保護。",
    feature6Title: "複数シート対応",
    feature6Desc:
      "複数ページのPDFは各ページが別々のExcelシートとして変換されます。",
    convertAnyTitle: "あらゆるPDFをExcelに変換",
    convertAnySubtitle:
      "あらゆる種類のPDFドキュメントを処理し、卓越した精度でデータを抽出します。",
    convertAnyList1: "テキスト選択可能なネイティブPDF",
    convertAnyList2: "OCR技術を使ったスキャンPDF",
    convertAnyList3: "結合セルを含む複雑な表",
    convertAnyList4: "複数列レイアウトとフォーム",
    convertAnyList5: "財務諸表と請求書",
    convertAnyList6: "データレポートとスプレッドシート",
    outputFormatsTitle: "出力形式",
    outputFormatsSubtitle: "変換後のファイルはXLSX形式になります",
    inputFormatLabel: "入力形式",
    outputFormatLabel: "出力形式",
    compatNote:
      "Microsoft Excel、Google スプレッドシート、LibreOffice Calcなどに対応",
    diveTitle: "変換前に知っておきたいこと",
    diveSubtitle: "結果に実際に影響する詳細 — ありきたりなヒントではありません。",
    dive1Title: "請求書の変換に最適",
    dive1Desc: "請求書はPDFからExcelへの変換で最も多いケースの一つです。品目、数量、単価、合計は通常きれいな表形式になっているため、当社の表検出機能が確実に読み取れます。数値を手入力し直すことなく、取引先の請求書をそのままスプレッドシートに取り込めます。",
    dive2Title: "デジタル表とスキャンPDFの違い",
    dive2Desc: "Excelや会計ソフト、Webサイトなどからデジタル生成されたPDFにはテキストが選択可能で、表構造も明確に定義されているため、変換は高速かつ正確です。一方、スキャンや写真で作成されたPDFにはテキストレイヤーが一切なく単なる画像のため、先にOCR処理が必要です。",
    dive3Title: "表抽出の実際の仕組み",
    dive3Desc: "当社のコンバーターは各ページで列の配置、セルの罫線、間隔のパターンを検出し、表の開始と終了位置を特定します。グリッドをマッピングした後、各セルの内容が対応するExcelセルに配置されます — すべてを1つのテキストブロックにまとめるのではなく、行と列を保持します。",
    dive4Title: "想定される書式の制限",
    dive4Desc: "シンプルな表は問題なく変換されますが、どのPDF→Excel変換ツールでもつまずきやすい点がいくつかあります：複数行にまたがる結合セル、ページをまたぐ表、1つのセル内にネストされた小さな表などです。これらは通常変換されますが、後で手動での微調整が必要になる場合があります。",
    dive5Title: "複数の表を含むPDF",
    dive5Desc: "PDFに複数の表がある場合（複数ページにわたる、または1ページに複数ある場合）、それぞれが個別に検出され、出力で区別されたまま保持されるため、1つの表にごちゃ混ぜになることはありません。",
    dive6Title: "スキャンPDF → OCR → Excel",
    dive6Desc: "スキャンや写真で作成されたドキュメントの場合、まず光学文字認識（OCR）で画像からテキストと数値を読み取り、そのOCR結果に対して同じ表検出ロジックを適用します。精度はスキャン品質に左右されます — 鮮明な300 DPIのスキャンは、ぼやけたスマートフォン写真よりもはるかに良く変換されます。",
    faqTitle: "よくある質問",
    faqSubtitle: "PDF→Excel変換について知っておくべきすべてのこと",
    faq1Question: "PDF→Excel変換の精度はどのくらいですか？",
    faq1Answer:
      "当社のコンバーターは高度な表検出アルゴリズムを使用してPDFから表形式データを正確に抽出します。セル構造、書式、データ型を保持します。スキャンPDFにはOCR技術を使用してテキストを認識し、編集可能なExcel形式に変換します。",
    faq2Question: "スキャンしたPDFをExcelに変換できますか？",
    faq2Answer:
      "はい！当ツールはOCR（光学文字認識）技術に対応しており、スキャンしたPDFドキュメントからテキストと表を抽出して編集可能なExcelスプレッドシートに変換できます。",
    faq3Question: "データの書式は保持されますか？",
    faq3Answer:
      "セルの罫線、テキストの配置、数値形式、結合セルなど、できる限り多くの書式を保持するよう努めています。複雑なレイアウトは変換後に若干の調整が必要な場合があります。",
    faq4Question: "変換できるファイルサイズに制限はありますか？",
    faq4Answer:
      "無料プランでは最大5MB（Starterでは20MB）のPDFファイルを変換できます。より大きなファイルの場合は、変換前に小さな部分に分割することをお勧めします。",
    faq5Question: "変換中のデータはどの程度安全ですか？",
    faq5Answer:
      "セキュリティを最優先しています。すべてのファイルは256ビットSSL暗号化で転送中に保護されます。ファイルは変換後1時間以内にサーバーから自動削除され、データを第三者と共有することは一切ありません。",
    faq6Question: "複数のPDFファイルを一度に変換できますか？",
    faq6Answer:
      "はい！最大10個のPDFファイルを同時にアップロードして変換できます。各ファイルは別々のExcelスプレッドシートに変換されます。",
    ctaTitle: "PDFの変換を始めましょう！",
    ctaSubtitle:
      "世界中のユーザーが、正確なPDF→Excel変換にSmallPDF.usを利用しています。",
    ctaButton: "今すぐPDFをアップロード",
    ctaNote: "高速 • 安全 • プライベート",
    relatedToolsTitle: "関連PDFツール",
    relatedToolsSubtitle: "PDFファイルを操作するためのその他のツールを探索",
    tool1: "ExcelをPDFに変換",
    tool2: "PDFをWordに変換",
    tool3: "WordをPDFに変換",
    tool4: "PDFを結合",
    tool5: "PDFを圧縮",
    tool6: "PDFを分割",
  },
  fr: {
    pageTitle: "Convertir PDF en Excel – gratuit en ligne | SmallPDF.us",
    pageDescription:
      "Convertissez des PDF en tableaux Excel gratuitement. Extrayez tableaux et données vers un XLSX modifiable. Rapide, précis et sécurisé, avec OCR.",
    heroTitle: "PDF en Excel",
    heroTitleHighlight: "Convertisseur Gratuit",
    heroSubtitle:
      "Extrayez tableaux et données de vos PDF vers des feuilles Excel modifiables. Rapide, précis et simple à utiliser.",
    uploadDragText: "S\u00e9lectionner un PDF \u00e0 convertir",
    uploadDragActive: "D\u00e9posez votre PDF ici !",
    uploadSubtext: "Glissez-d\u00e9posez votre PDF ou cliquez pour parcourir",
    uploadButton: "Choisir un PDF",
    uploadLimit: "Maximum {maxSize} par fichier \u2022 Jusqu\u2019\u00e0 {maxFiles} fichiers",
    errorInvalidType: "Seuls les fichiers PDF sont autoris\u00e9s",
    errorMaxSize: "La taille du fichier d\u00e9passe la limite gratuite de 5 Mo",
    errorMaxFiles: "Maximum {maxFiles} fichiers autoris\u00e9s",
    convertButton: "Convertir en Excel",
    secureLabel: "S\u00e9curis\u00e9",
    instantLabel: "Instantan\u00e9",
    pdfFormatLabel: "Format PDF",
    filesSelected: "{count} fichier{plural} s\u00e9lectionn\u00e9{plural}",
    totalLabel: "total",
    removeAllFiles: "Supprimer tous les fichiers",
    howItWorksTitle: "Comment convertir un PDF en Excel",
    howItWorksSubtitle:
      "Transformez vos documents PDF en feuilles de calcul Excel modifiables en trois \u00e9tapes simples",
    step1Title: "Importer le PDF",
    step1Desc: "Glissez-d\u00e9posez votre fichier PDF ou cliquez pour parcourir. Supporte l\u2019importation de plusieurs fichiers.",
    step2Title: "Extraire les tableaux",
    step2Desc: "Notre IA d\u00e9tecte et extrait automatiquement les tableaux avec une haute pr\u00e9cision.",
    step3Title: "T\u00e9l\u00e9charger Excel",
    step3Desc: "Obtenez votre fichier Excel modifiable avec toutes les donn\u00e9es et la mise en forme pr\u00e9serv\u00e9es.",
    featuresTitle: "Fonctionnalit\u00e9s puissantes PDF vers Excel",
    featuresSubtitle: "Technologie avanc\u00e9e pour convertir vos PDF avec une pr\u00e9cision parfaite",
    feature1Title: "D\u00e9tection intelligente des tableaux",
    feature1Desc: "Un algorithme IA identifie et extrait automatiquement les tableaux de vos PDF.",
    feature2Title: "Mise en forme pr\u00e9serv\u00e9e",
    feature2Desc: "Bordures de cellules, couleurs, polices et formats num\u00e9riques conserv\u00e9s apr\u00e8s conversion.",
    feature3Title: "Support OCR",
    feature3Desc: "Convertissez des PDF scann\u00e9s et des images en Excel modifiable gr\u00e2ce \u00e0 l\u2019OCR avanc\u00e9e.",
    feature4Title: "Ultra-rapide",
    feature4Desc: "Convertissez de gros fichiers PDF en quelques secondes avec notre moteur optimis\u00e9.",
    feature5Title: "S\u00e9curit\u00e9 niveau bancaire",
    feature5Desc:
      "Chiffrement SSL 256 bits et suppression automatique des fichiers pour prot\u00e9ger vos donn\u00e9es.",
    feature6Title: "Plusieurs feuilles",
    feature6Desc: "Les PDF multipage sont convertis avec chaque page en feuille Excel distincte.",
    convertAnyTitle: "Convertissez n\u2019importe quel PDF en Excel",
    convertAnySubtitle:
      "Notre convertisseur traite tous types de documents PDF et extrait les donn\u00e9es avec une pr\u00e9cision exceptionnelle.",
    convertAnyList1: "Documents PDF natifs avec texte s\u00e9lectionnable",
    convertAnyList2: "PDF scann\u00e9s via technologie OCR",
    convertAnyList3: "Tableaux complexes avec cellules fusionn\u00e9es",
    convertAnyList4: "Mises en page multicolonnes et formulaires",
    convertAnyList5: "\u00c9tats financiers et factures",
    convertAnyList6: "Rapports de donn\u00e9es et feuilles de calcul",
    outputFormatsTitle: "Formats de sortie",
    outputFormatsSubtitle: "Votre fichier converti sera au format XLSX",
    inputFormatLabel: "Format d\u2019entr\u00e9e",
    outputFormatLabel: "Format de sortie",
    compatNote:
      "Compatible avec Microsoft Excel, Google Sheets, LibreOffice Calc et plus encore",
    diveTitle: "Ce qu'il faut savoir avant de convertir",
    diveSubtitle: "Les détails qui influencent vraiment votre résultat — pas des conseils génériques.",
    dive1Title: "Idéal pour les factures",
    dive1Desc: "Les factures font partie des conversions PDF vers Excel les plus courantes. Les lignes d'articles, quantités, prix unitaires et totaux se trouvent généralement dans une grille bien structurée, que notre détecteur de tableaux lit de manière fiable — vous pouvez ainsi importer les factures fournisseurs directement dans une feuille de calcul sans ressaisir les chiffres.",
    dive2Title: "Tableaux numériques vs PDF scannés",
    dive2Desc: "Un PDF généré numériquement (depuis Excel, un logiciel comptable ou un site web) a un texte sélectionnable et une structure de tableau définie, donc la conversion est rapide et précise. Un PDF scanné ou photographié n'a aucune couche de texte — juste une image — il a donc besoin d'une OCR au préalable.",
    dive3Title: "Comment fonctionne réellement l'extraction de tableaux",
    dive3Desc: "Notre convertisseur recherche l'alignement des colonnes, les bordures de cellules et les motifs d'espacement sur chaque page pour identifier où un tableau commence et se termine. Une fois la grille cartographiée, le contenu de chaque cellule est placé dans la cellule Excel correspondante — préservant les lignes et colonnes au lieu de tout regrouper dans un seul bloc de texte.",
    dive4Title: "Limitations de mise en forme à prévoir",
    dive4Desc: "Les grilles simples se convertissent proprement, mais certains éléments peuvent poser problème à n'importe quel outil PDF vers Excel : cellules fusionnées sur plusieurs lignes, tableaux qui s'étendent sur un saut de page, et sous-tableaux imbriqués dans une seule cellule. Ceux-ci se convertissent généralement quand même, mais peuvent nécessiter un ajustement manuel ensuite.",
    dive5Title: "PDF avec plusieurs tableaux",
    dive5Desc: "Si votre PDF contient plusieurs tableaux — sur différentes pages, ou plusieurs sur une même page — chacun est détecté séparément et reste distinct dans le résultat, pour éviter qu'ils ne se retrouvent fusionnés en un seul tableau confus.",
    dive6Title: "PDF scanné → OCR → Excel",
    dive6Desc: "Pour les documents scannés ou photographiés, notre outil applique d'abord la reconnaissance optique de caractères (OCR) pour lire le texte et les chiffres de l'image, puis applique la même logique de détection de tableaux au résultat de l'OCR. La précision dépend de la qualité du scan — un scan net à 300 DPI se convertit bien mieux qu'une photo de téléphone floue.",
    faqTitle: "Questions fr\u00e9quemment pos\u00e9es",
    faqSubtitle: "Tout ce que vous devez savoir sur la conversion PDF en Excel",
    faq1Question: "Quelle est la pr\u00e9cision de la conversion PDF en Excel ?",
    faq1Answer:
      "Notre convertisseur utilise des algorithmes avanc\u00e9s de d\u00e9tection de tableaux pour extraire avec pr\u00e9cision les donn\u00e9es tabulaires des PDF. Il pr\u00e9serve la structure des cellules, la mise en forme et les types de donn\u00e9es. Pour les PDF scann\u00e9s, la technologie OCR est utilis\u00e9e pour reconna\u00eetre le texte et le convertir en format Excel modifiable.",
    faq2Question: "Puis-je convertir des PDF scann\u00e9s en Excel ?",
    faq2Answer:
      "Oui\u00a0! Notre outil prend en charge la technologie OCR qui peut extraire du texte et des tableaux de documents PDF scann\u00e9s et les convertir en feuilles de calcul Excel modifiables.",
    faq3Question: "La mise en forme de mes donn\u00e9es sera-t-elle pr\u00e9serv\u00e9e ?",
    faq3Answer:
      "Nous nous effor\u00e7ons de pr\u00e9server autant de mise en forme que possible, notamment les bordures de cellules, l\u2019alignement du texte, les formats num\u00e9riques et les cellules fusionn\u00e9es. Les mises en page complexes peuvent n\u00e9cessiter des ajustements mineurs apr\u00e8s conversion.",
    faq4Question: "Y a-t-il une limite de taille de fichier ?",
    faq4Answer:
      "Sur le plan gratuit, vous pouvez convertir des fichiers PDF jusqu\u2019\u00e0 5 Mo (20 Mo avec Starter). Pour les fichiers plus volumineux, nous recommandons de les diviser en parties plus petites avant la conversion.",
    faq5Question: "Mes donn\u00e9es sont-elles s\u00e9curis\u00e9es pendant la conversion ?",
    faq5Answer:
      "Votre s\u00e9curit\u00e9 est notre priorit\u00e9. Tous les fichiers sont chiffr\u00e9s pendant le transfert avec SSL 256 bits. Les fichiers sont automatiquement supprim\u00e9s de nos serveurs dans l\u2019heure suivant la conversion, et nous ne partageons jamais vos donn\u00e9es avec des tiers.",
    faq6Question: "Puis-je convertir plusieurs fichiers PDF \u00e0 la fois ?",
    faq6Answer:
      "Oui\u00a0! Vous pouvez importer et convertir jusqu\u2019\u00e0 10 fichiers PDF simultan\u00e9ment. Chaque fichier sera converti en une feuille de calcul Excel distincte.",
    ctaTitle: "Pr\u00eat \u00e0 convertir votre PDF ?",
    ctaSubtitle:
      "Rejoignez les utilisateurs du monde entier qui utilisent SmallPDF.us pour des conversions PDF en Excel rapides et pr\u00e9cises.",
    ctaButton: "Importer un PDF maintenant",
    ctaNote: "Rapide • Sécurisé • Confidentiel",
    relatedToolsTitle: "Outils PDF associ\u00e9s",
    relatedToolsSubtitle: "D\u00e9couvrez d\u2019autres outils pour travailler avec vos PDF",
    tool1: "Excel en PDF",
    tool2: "PDF en Word",
    tool3: "Word en PDF",
    tool4: "Fusionner PDF",
    tool5: "Compresser PDF",
    tool6: "Diviser PDF",
  },
  es: {
    pageTitle: "Convertir PDF a Excel \u2013 Gratis en l\u00ednea PDF a XLSX | SmallPDF.us",
    pageDescription:
      "Convierte PDF a hojas de c\u00e1lculo Excel gratis. Extrae tablas y datos de archivos PDF a formato XLSX editable. R\u00e1pido, preciso y seguro con soporte OCR.",
    heroTitle: "PDF a Excel",
    heroTitleHighlight: "Convertidor Gratis",
    heroSubtitle:
      "Extrae tablas y datos de archivos PDF a hojas de Excel editables. Rápido, preciso y fácil de usar.",
    uploadDragText: "Selecciona un PDF para convertir",
    uploadDragActive: "\u00a1Suelta tu PDF aqu\u00ed!",
    uploadSubtext: "Arrastra y suelta tu PDF o haz clic para explorar",
    uploadButton: "Elegir PDF",
    uploadLimit: "M\u00e1ximo {maxSize} por archivo \u2022 Hasta {maxFiles} archivos",
    errorInvalidType: "Solo se permiten archivos PDF",
    errorMaxSize: "El tama\u00f1o del archivo supera el l\u00edmite gratuito de 5 MB",
    errorMaxFiles: "M\u00e1ximo {maxFiles} archivos permitidos",
    convertButton: "Convertir a Excel",
    secureLabel: "Seguro",
    instantLabel: "Instant\u00e1neo",
    pdfFormatLabel: "Formato PDF",
    filesSelected: "{count} archivo{plural} seleccionado{plural}",
    totalLabel: "total",
    removeAllFiles: "Eliminar todos los archivos",
    howItWorksTitle: "C\u00f3mo convertir PDF a Excel",
    howItWorksSubtitle:
      "Transforma tus documentos PDF en hojas de c\u00e1lculo Excel editables en tres sencillos pasos",
    step1Title: "Subir PDF",
    step1Desc: "Arrastra y suelta tu archivo PDF o haz clic para explorar. Admite la subida de varios archivos.",
    step2Title: "Extraer tablas",
    step2Desc: "Nuestra IA detecta y extrae autom\u00e1ticamente las tablas con alta precisi\u00f3n.",
    step3Title: "Descargar Excel",
    step3Desc: "Obt\u00e9n tu archivo Excel editable con todos los datos y el formato preservados.",
    featuresTitle: "Potentes funciones de PDF a Excel",
    featuresSubtitle: "Tecnolog\u00eda avanzada para convertir tus PDF con precisi\u00f3n perfecta",
    feature1Title: "Detecci\u00f3n inteligente de tablas",
    feature1Desc: "Un algoritmo IA identifica y extrae autom\u00e1ticamente las tablas de tus PDF.",
    feature2Title: "Formato preservado",
    feature2Desc: "Bordes de celda, colores, fuentes y formatos num\u00e9ricos conservados tras la conversi\u00f3n.",
    feature3Title: "Soporte OCR",
    feature3Desc: "Convierte PDF escaneados e im\u00e1genes a Excel editable con tecnolog\u00eda OCR avanzada.",
    feature4Title: "Ultrarr\u00e1pido",
    feature4Desc: "Convierte archivos PDF grandes en segundos con nuestro motor de procesamiento optimizado.",
    feature5Title: "Seguridad de nivel bancario",
    feature5Desc:
      "Cifrado SSL de 256 bits y eliminaci\u00f3n autom\u00e1tica de archivos para mantener tus datos privados.",
    feature6Title: "M\u00faltiples hojas",
    feature6Desc: "Los PDF de varias p\u00e1ginas se convierten con cada p\u00e1gina como hoja Excel separada.",
    convertAnyTitle: "Convierte cualquier PDF a Excel",
    convertAnySubtitle:
      "Nuestro convertidor procesa todo tipo de documentos PDF y extrae datos con precisi\u00f3n excepcional.",
    convertAnyList1: "Documentos PDF nativos con texto seleccionable",
    convertAnyList2: "PDF escaneados mediante tecnolog\u00eda OCR",
    convertAnyList3: "Tablas complejas con celdas combinadas",
    convertAnyList4: "Dise\u00f1os multicolumna y formularios",
    convertAnyList5: "Estados financieros y facturas",
    convertAnyList6: "Informes de datos y hojas de c\u00e1lculo",
    outputFormatsTitle: "Formatos de salida",
    outputFormatsSubtitle: "Tu archivo convertido estar\u00e1 en formato XLSX",
    inputFormatLabel: "Formato de entrada",
    outputFormatLabel: "Formato de salida",
    compatNote:
      "Compatible con Microsoft Excel, Google Sheets, LibreOffice Calc y m\u00e1s",
    diveTitle: "Lo que debes saber antes de convertir",
    diveSubtitle: "Los detalles que realmente afectan tu resultado — no consejos genéricos.",
    dive1Title: "Ideal para facturas",
    dive1Desc: "Las facturas son una de las conversiones de PDF a Excel más comunes. Las líneas de artículos, cantidades, precios unitarios y totales suelen estar en una cuadrícula ordenada, que nuestro detector de tablas lee de forma fiable — así puedes importar facturas de proveedores directamente a una hoja de cálculo sin volver a escribir los números.",
    dive2Title: "Tablas digitales vs. PDF escaneados",
    dive2Desc: "Un PDF generado digitalmente (desde Excel, software de contabilidad o un sitio web) tiene texto seleccionable y una estructura de tabla definida, por lo que la conversión es rápida y exacta. Un PDF escaneado o fotografiado no tiene ninguna capa de texto — solo una imagen — por lo que primero necesita OCR.",
    dive3Title: "Cómo funciona realmente la extracción de tablas",
    dive3Desc: "Nuestro convertidor busca la alineación de columnas, los bordes de celda y los patrones de espaciado en cada página para identificar dónde empieza y termina una tabla. Una vez mapeada la cuadrícula, el contenido de cada celda se coloca en la celda de Excel correspondiente — conservando filas y columnas en lugar de volcar todo en un solo bloque de texto.",
    dive4Title: "Limitaciones de formato a tener en cuenta",
    dive4Desc: "Las cuadrículas simples se convierten sin problemas, pero hay cosas que pueden complicar a cualquier herramienta de PDF a Excel: celdas combinadas en varias filas, tablas que continúan tras un salto de página y subtablas anidadas dentro de una sola celda. Normalmente aún se convierten, pero pueden necesitar un ajuste manual después.",
    dive5Title: "PDF con varias tablas",
    dive5Desc: "Si tu PDF tiene más de una tabla — en distintas páginas, o varias en una misma página — cada una se detecta por separado y se mantiene distinta en el resultado, para que no acaben fusionadas en una sola tabla confusa.",
    dive6Title: "PDF escaneado → OCR → Excel",
    dive6Desc: "Para documentos escaneados o fotografiados, nuestra herramienta ejecuta primero el reconocimiento óptico de caracteres (OCR) para leer el texto y los números de la imagen, y luego aplica la misma lógica de detección de tablas al resultado del OCR. La precisión depende de la calidad del escaneo — un escaneo nítido a 300 DPI se convierte mucho mejor que una foto de móvil borrosa.",
    faqTitle: "Preguntas frecuentes",
    faqSubtitle: "Todo lo que necesitas saber sobre la conversi\u00f3n de PDF a Excel",
    faq1Question: "\u00bfQu\u00e9 tan precisa es la conversi\u00f3n de PDF a Excel?",
    faq1Answer:
      "Nuestro convertidor utiliza algoritmos avanzados de detecci\u00f3n de tablas para extraer con precisi\u00f3n los datos tabulares de los PDF. Preserva la estructura de las celdas, el formato y los tipos de datos. Para los PDF escaneados, se utiliza tecnolog\u00eda OCR para reconocer el texto y convertirlo al formato Excel editable.",
    faq2Question: "\u00bfPuedo convertir documentos PDF escaneados a Excel?",
    faq2Answer:
      "\u00a1S\u00ed! Nuestra herramienta admite tecnolog\u00eda OCR que puede extraer texto y tablas de documentos PDF escaneados y convertirlos en hojas de c\u00e1lculo Excel editables.",
    faq3Question: "\u00bfSe preservar\u00e1 el formato de mis datos?",
    faq3Answer:
      "Nos esforzamos por preservar el mayor formato posible, incluyendo bordes de celdas, alineaci\u00f3n de texto, formatos num\u00e9ricos y celdas combinadas. Los dise\u00f1os complejos pueden requerir ajustes menores despu\u00e9s de la conversi\u00f3n.",
    faq4Question: "\u00bfHay un l\u00edmite de tama\u00f1o de archivo para convertir?",
    faq4Answer:
      "En el plan gratuito puedes convertir archivos PDF de hasta 5 MB (20 MB con Starter). Para archivos m\u00e1s grandes, recomendamos dividirlos en partes m\u00e1s peque\u00f1as antes de la conversi\u00f3n.",
    faq5Question: "\u00bfQu\u00e9 tan seguros est\u00e1n mis datos durante la conversi\u00f3n?",
    faq5Answer:
      "Tu seguridad es nuestra prioridad. Todos los archivos se cifran durante la transferencia con SSL de 256 bits. Los archivos se eliminan autom\u00e1ticamente de nuestros servidores en la hora siguiente a la conversi\u00f3n, y nunca compartimos tus datos con terceros.",
    faq6Question: "\u00bfPuedo convertir varios archivos PDF a la vez?",
    faq6Answer:
      "\u00a1S\u00ed! Puedes subir y convertir hasta 10 archivos PDF simult\u00e1neamente. Cada archivo se convertir\u00e1 en una hoja de c\u00e1lculo Excel independiente.",
    ctaTitle: "\u00bfListo para convertir tu PDF?",
    ctaSubtitle:
      "\u00danete a usuarios de todo el mundo que utilizan SmallPDF.us para conversiones de PDF a Excel r\u00e1pidas y precisas.",
    ctaButton: "Subir PDF ahora",
    ctaNote: "Rápido • Seguro • Privado",
    relatedToolsTitle: "Herramientas PDF relacionadas",
    relatedToolsSubtitle: "Explora m\u00e1s herramientas para trabajar con tus archivos PDF",
    tool1: "Excel a PDF",
    tool2: "PDF a Word",
    tool3: "Word a PDF",
    tool4: "Combinar PDF",
    tool5: "Comprimir PDF",
    tool6: "Dividir PDF",
  },
  de: {
    pageTitle: "PDF in Excel umwandeln – kostenlos online | SmallPDF.us",
    pageDescription:
      "PDF kostenlos in Excel-Tabellen umwandeln. Tabellen und Daten aus PDFs in bearbeitbares XLSX-Format extrahieren. Schnell, präzise und sicher mit OCR-Unterstützung.",
    heroTitle: "PDF in Excel",
    heroTitleHighlight: "kostenlos umwandeln",
    heroSubtitle:
      "Tabellen und Daten aus PDF-Dateien in bearbeitbare Excel-Tabellen extrahieren. Schnell, präzise und einfach zu bedienen.",
    uploadDragText: "PDF zum Konvertieren auswählen",
    uploadDragActive: "PDF hier ablegen!",
    uploadSubtext: "PDF per Drag & Drop ziehen oder klicken zum Durchsuchen",
    uploadButton: "PDF auswählen",
    uploadLimit: "Maximal {maxSize} pro Datei • Bis zu {maxFiles} Dateien",
    errorInvalidType: "Nur PDF-Dateien sind erlaubt",
    errorMaxSize: "Dateigröße überschreitet das kostenlose 5-MB-Limit",
    errorMaxFiles: "Maximal {maxFiles} Dateien erlaubt",
    convertButton: "In Excel umwandeln",
    secureLabel: "Sicher",
    instantLabel: "Sofort",
    pdfFormatLabel: "PDF-Format",
    filesSelected: "{count} Datei(en) ausgewählt",
    totalLabel: "Gesamt",
    removeAllFiles: "Alle Dateien entfernen",
    howItWorksTitle: "So konvertieren Sie PDF in Excel",
    howItWorksSubtitle:
      "Wandeln Sie Ihre PDF-Dokumente in drei einfachen Schritten in bearbeitbare Excel-Tabellen um",
    step1Title: "PDF hochladen",
    step1Desc: "PDF-Datei per Drag & Drop ziehen oder klicken zum Durchsuchen. Mehrere Dateien werden unterstützt.",
    step2Title: "Tabellen extrahieren",
    step2Desc: "Unsere KI erkennt und extrahiert Tabellen automatisch mit hoher Genauigkeit.",
    step3Title: "Excel herunterladen",
    step3Desc: "Bearbeitbare Excel-Datei mit vollständig erhaltenen Daten und Formatierungen erhalten.",
    featuresTitle: "Leistungsstarke PDF-zu-Excel-Funktionen",
    featuresSubtitle: "Modernste Technologie für eine präzise Konvertierung Ihrer PDF-Dateien",
    feature1Title: "Intelligente Tabellenerkennung",
    feature1Desc: "KI-gestützter Algorithmus erkennt und extrahiert Tabellen automatisch aus Ihren PDFs.",
    feature2Title: "Formatierung erhalten",
    feature2Desc: "Zellrahmen, Farben, Schriftarten und Zahlenformate bleiben nach der Konvertierung erhalten.",
    feature3Title: "OCR-Unterstützung",
    feature3Desc: "Gescannte PDFs und Bilder mit fortschrittlicher OCR-Technologie in bearbeitbares Excel umwandeln.",
    feature4Title: "Blitzschnell",
    feature4Desc: "Große PDF-Dateien in Sekunden mit unserem optimierten Verarbeitungsmodul konvertieren.",
    feature5Title: "Banksicherheit",
    feature5Desc:
      "256-Bit-SSL-Verschlüsselung und automatische Dateilöschung stellen sicher, dass Ihre Daten privat bleiben.",
    feature6Title: "Mehrere Tabellenblätter",
    feature6Desc: "Mehrseitige PDFs werden konvertiert, wobei jede Seite als separates Excel-Tabellenblatt erscheint.",
    convertAnyTitle: "Jedes PDF in Excel umwandeln",
    convertAnySubtitle:
      "Unser Konverter verarbeitet alle Arten von PDF-Dokumenten und extrahiert Daten mit außergewöhnlicher Genauigkeit.",
    convertAnyList1: "Native PDF-Dokumente mit auswählbarem Text",
    convertAnyList2: "Gescannte PDFs mit OCR-Technologie",
    convertAnyList3: "Komplexe Tabellen mit verbundenen Zellen",
    convertAnyList4: "Mehrspaltige Layouts und Formulare",
    convertAnyList5: "Finanzberichte und Rechnungen",
    convertAnyList6: "Datenberichte und Tabellenkalkulationen",
    outputFormatsTitle: "Ausgabeformate",
    outputFormatsSubtitle: "Ihre konvertierte Datei wird im XLSX-Format ausgegeben",
    inputFormatLabel: "Eingabeformat",
    outputFormatLabel: "Ausgabeformat",
    compatNote:
      "Kompatibel mit Microsoft Excel, Google Tabellen, LibreOffice Calc und mehr",
    diveTitle: "Was Sie vor der Konvertierung wissen sollten",
    diveSubtitle: "Die Details, die Ihr Ergebnis tatsächlich beeinflussen — keine allgemeinen Tipps.",
    dive1Title: "Ideal für Rechnungen",
    dive1Desc: "Rechnungen gehören zu den häufigsten PDF-zu-Excel-Konvertierungen. Positionen, Mengen, Einzelpreise und Summen stehen meist in einem sauberen Raster, das unsere Tabellenerkennung zuverlässig liest — so übernehmen Sie Lieferantenrechnungen direkt in eine Tabelle, ohne Zahlen erneut einzutippen.",
    dive2Title: "Digitale Tabellen vs. gescannte PDFs",
    dive2Desc: "Ein digital erzeugtes PDF (aus Excel, Buchhaltungssoftware oder einer Website) hat auswählbaren Text und eine definierte Tabellenstruktur, daher ist die Konvertierung schnell und exakt. Ein gescanntes oder fotografiertes PDF hat gar keine Textebene — nur ein Bild — und benötigt daher zuerst OCR.",
    dive3Title: "Wie die Tabellenerkennung tatsächlich funktioniert",
    dive3Desc: "Unser Konverter sucht auf jeder Seite nach konsistenter Spaltenausrichtung, Zellrändern und Abstandsmustern, um zu erkennen, wo eine Tabelle beginnt und endet. Sobald das Raster erfasst ist, wird der Inhalt jeder Zelle in die passende Excel-Zelle eingefügt — Zeilen und Spalten bleiben erhalten, statt alles in einem Textblock zusammenzufassen.",
    dive4Title: "Zu erwartende Formatierungsgrenzen",
    dive4Desc: "Einfache Raster werden sauber konvertiert, aber einige Dinge können jedes PDF-zu-Excel-Tool ins Straucheln bringen: über mehrere Zeilen verbundene Zellen, Tabellen, die über einen Seitenumbruch reichen, und verschachtelte Untertabellen in einer einzelnen Zelle. Diese werden meist trotzdem konvertiert, benötigen danach aber eventuell eine manuelle Anpassung.",
    dive5Title: "PDFs mit mehreren Tabellen",
    dive5Desc: "Wenn Ihr PDF mehr als eine Tabelle enthält — auf verschiedenen Seiten oder mehrere auf einer Seite — wird jede separat erkannt und im Ergebnis eigenständig gehalten, damit sie nicht zu einer einzigen unübersichtlichen Tabelle verschmelzen.",
    dive6Title: "Gescanntes PDF → OCR → Excel",
    dive6Desc: "Bei gescannten oder fotografierten Dokumenten führt unser Tool zuerst eine optische Zeichenerkennung (OCR) durch, um Text und Zahlen aus dem Bild zu lesen, und wendet dann dieselbe Tabellenerkennungslogik auf das OCR-Ergebnis an. Die Genauigkeit hängt von der Scan-Qualität ab — ein klarer 300-DPI-Scan konvertiert deutlich besser als ein unscharfes Handyfoto.",
    faqTitle: "Häufig gestellte Fragen",
    faqSubtitle: "Alles, was Sie über die PDF-zu-Excel-Konvertierung wissen müssen",
    faq1Question: "Wie genau ist die PDF-zu-Excel-Konvertierung?",
    faq1Answer:
      "Unser Konverter verwendet fortschrittliche Tabellenerkennungsalgorithmen, um tabellarische Daten aus PDFs präzise zu extrahieren. Er behält Zellstruktur, Formatierungen und Datentypen bei. Für gescannte PDFs wird OCR-Technologie eingesetzt, um Text zu erkennen und in bearbeitbares Excel-Format umzuwandeln.",
    faq2Question: "Kann ich gescannte PDF-Dokumente in Excel umwandeln?",
    faq2Answer:
      "Ja! Unser Tool unterstützt OCR (optische Zeichenerkennung), mit der Text und Tabellen aus gescannten PDF-Dokumenten extrahiert und in bearbeitbare Excel-Tabellen umgewandelt werden können.",
    faq3Question: "Bleibt meine Datenformatierung erhalten?",
    faq3Answer:
      "Wir bemühen uns, so viel Formatierung wie möglich zu erhalten, einschließlich Zellrahmen, Textausrichtung, Zahlenformate und verbundene Zellen. Komplexe Layouts erfordern nach der Konvertierung möglicherweise geringfügige Anpassungen.",
    faq4Question: "Gibt es eine Größenbeschränkung für die Konvertierung?",
    faq4Answer:
      "Im kostenlosen Plan können Sie PDF-Dateien bis zu 5 MB konvertieren (20 MB mit Starter). Bei größeren Dateien empfehlen wir, diese vor der Konvertierung in kleinere Teile aufzuteilen.",
    faq5Question: "Wie sicher sind meine Daten während der Konvertierung?",
    faq5Answer:
      "Ihre Sicherheit hat für uns höchste Priorität. Alle Dateien werden während der Übertragung mit 256-Bit-SSL-Verschlüsselung geschützt. Dateien werden innerhalb von 1 Stunde nach der Konvertierung automatisch von unseren Servern gelöscht, und wir geben Ihre Daten niemals an Dritte weiter.",
    faq6Question: "Kann ich mehrere PDF-Dateien gleichzeitig konvertieren?",
    faq6Answer:
      "Ja! Sie können bis zu 10 PDF-Dateien gleichzeitig hochladen und konvertieren. Jede Datei wird in eine separate Excel-Tabelle konvertiert.",
    ctaTitle: "Bereit, Ihr PDF zu konvertieren?",
    ctaSubtitle:
      "Schließen Sie sich Nutzern weltweit an, die SmallPDF.us für schnelle, präzise PDF-zu-Excel-Konvertierungen verwenden.",
    ctaButton: "Jetzt PDF hochladen",
    ctaNote: "Schnell • Sicher • Privat",
    relatedToolsTitle: "Verwandte PDF-Tools",
    relatedToolsSubtitle: "Entdecken Sie weitere Tools für Ihre PDF-Dateien",
    tool1: "Excel in PDF",
    tool2: "PDF in Word",
    tool3: "Word in PDF",
    tool4: "PDF zusammenführen",
    tool5: "PDF komprimieren",
    tool6: "PDF aufteilen",
  },
  it: {
    pageTitle: "Converti PDF in Excel \u2013 Gratuito online XLSX | SmallPDF.us",
    pageDescription:
      "Converti PDF in fogli Excel gratuitamente. Estrai tabelle e dati in file XLSX modificabili. Veloce, preciso e sicuro, con supporto OCR.",
    heroTitle: "PDF in Excel",
    heroTitleHighlight: "Converter Gratuito",
    heroSubtitle:
      "Estrai tabelle e dati dai file PDF in fogli Excel modificabili. Veloce, preciso e facile da usare.",
    uploadDragText: "Seleziona PDF da convertire",
    uploadDragActive: "Lascia il tuo PDF qui!",
    uploadSubtext: "Trascina il PDF o clicca per sfogliare",
    uploadButton: "Scegli PDF",
    uploadLimit: "Massimo {maxSize} per file \u2022 Fino a {maxFiles} file",
    errorInvalidType: "Sono ammessi solo file PDF",
    errorMaxSize: "La dimensione del file supera il limite gratuito di 5 MB",
    errorMaxFiles: "Massimo {maxFiles} file consentiti",
    convertButton: "Converti in Excel",
    secureLabel: "Sicuro",
    instantLabel: "Istantaneo",
    pdfFormatLabel: "Formato PDF",
    filesSelected: "{count} file selezionato{plural}",
    totalLabel: "totale",
    removeAllFiles: "Rimuovi tutti i file",
    howItWorksTitle: "Come convertire PDF in Excel",
    howItWorksSubtitle:
      "Trasforma i tuoi documenti PDF in fogli di calcolo Excel modificabili in tre semplici passi",
    step1Title: "Carica il PDF",
    step1Desc: "Trascina il tuo file PDF o clicca per sfogliare. Supporta il caricamento di pi\u00f9 file.",
    step2Title: "Estrai le tabelle",
    step2Desc: "La nostra IA rileva e estrae automaticamente le tabelle con alta precisione.",
    step3Title: "Scarica l'Excel",
    step3Desc: "Ottieni il tuo file Excel modificabile con tutti i dati e la formattazione preservati.",
    featuresTitle: "Funzionalit\u00e0 avanzate PDF in Excel",
    featuresSubtitle: "Tecnologia avanzata per convertire i tuoi PDF con precisione perfetta",
    feature1Title: "Rilevamento tabelle intelligente",
    feature1Desc: "L'algoritmo basato su IA identifica ed estrae automaticamente le tabelle dai tuoi PDF.",
    feature2Title: "Formattazione preservata",
    feature2Desc: "Mantieni bordi delle celle, colori, font e formati numerici intatti dopo la conversione.",
    feature3Title: "Supporto OCR",
    feature3Desc: "Converti PDF scansionati e immagini in Excel modificabile usando tecnologia OCR avanzata.",
    feature4Title: "Velocissimo",
    feature4Desc: "Converti file PDF di grandi dimensioni in pochi secondi con il nostro motore ottimizzato.",
    feature5Title: "Sicurezza di livello bancario",
    feature5Desc:
      "Crittografia SSL a 256 bit e cancellazione automatica dei file garantiscono la privacy dei tuoi dati.",
    feature6Title: "Fogli multipli",
    feature6Desc: "I PDF multipagina vengono convertiti con ogni pagina come foglio Excel separato.",
    convertAnyTitle: "Converti qualsiasi PDF in Excel",
    convertAnySubtitle:
      "Il nostro convertitore gestisce tutti i tipi di documenti PDF ed estrae i dati con precisione eccezionale.",
    convertAnyList1: "Documenti PDF nativi con testo selezionabile",
    convertAnyList2: "PDF scansionati con tecnologia OCR",
    convertAnyList3: "Tabelle complesse con celle unite",
    convertAnyList4: "Layout a pi\u00f9 colonne e moduli",
    convertAnyList5: "Estratti conto e fatture",
    convertAnyList6: "Report di dati e fogli di calcolo",
    outputFormatsTitle: "Formati di output",
    outputFormatsSubtitle: "Il tuo file convertito sar\u00e0 in formato XLSX",
    inputFormatLabel: "Formato di input",
    outputFormatLabel: "Formato di output",
    compatNote: "Compatibile con Microsoft Excel, Google Sheets, LibreOffice Calc e altri",
    diveTitle: "Cosa sapere prima di convertire",
    diveSubtitle: "I dettagli che influenzano davvero il risultato — non consigli generici.",
    dive1Title: "Ideale per le fatture",
    dive1Desc: "Le fatture sono una delle conversioni PDF in Excel più comuni. Voci, quantità, prezzi unitari e totali si trovano solitamente in una griglia ordinata, che il nostro rilevatore di tabelle legge in modo affidabile — così puoi importare le fatture dei fornitori direttamente in un foglio di calcolo senza riscrivere i numeri.",
    dive2Title: "Tabelle digitali vs. PDF scansionati",
    dive2Desc: "Un PDF generato digitalmente (da Excel, software contabile o un sito web) ha testo selezionabile e una struttura di tabella definita, quindi la conversione è rapida e precisa. Un PDF scansionato o fotografato non ha alcun livello di testo — solo un'immagine — quindi necessita prima dell'OCR.",
    dive3Title: "Come funziona davvero l'estrazione delle tabelle",
    dive3Desc: "Il nostro convertitore cerca l'allineamento delle colonne, i bordi delle celle e i pattern di spaziatura su ogni pagina per identificare dove inizia e finisce una tabella. Una volta mappata la griglia, il contenuto di ogni cella viene inserito nella cella Excel corrispondente — preservando righe e colonne invece di riversare tutto in un unico blocco di testo.",
    dive4Title: "Limitazioni di formattazione da aspettarsi",
    dive4Desc: "Le griglie semplici si convertono senza problemi, ma alcune cose possono mettere in difficoltà qualsiasi strumento PDF in Excel: celle unite su più righe, tabelle che proseguono oltre un'interruzione di pagina e sotto-tabelle annidate in una singola cella. Di solito si convertono comunque, ma potrebbero richiedere una modifica manuale in seguito.",
    dive5Title: "PDF con più tabelle",
    dive5Desc: "Se il tuo PDF contiene più di una tabella — su pagine diverse, o più tabelle nella stessa pagina — ognuna viene rilevata separatamente e mantenuta distinta nel risultato, così non finiscono unite in un'unica tabella confusa.",
    dive6Title: "PDF scansionato → OCR → Excel",
    dive6Desc: "Per i documenti scansionati o fotografati, il nostro strumento esegue prima il riconoscimento ottico dei caratteri (OCR) per leggere testo e numeri dall'immagine, poi applica la stessa logica di rilevamento tabelle al risultato dell'OCR. La precisione dipende dalla qualità della scansione — una scansione nitida a 300 DPI si converte molto meglio di una foto sfocata dal telefono.",
    faqTitle: "Domande frequenti",
    faqSubtitle: "Tutto quello che devi sapere sulla conversione PDF in Excel",
    faq1Question: "Quanto \u00e8 precisa la conversione PDF in Excel?",
    faq1Answer:
      "Il nostro convertitore utilizza algoritmi avanzati di rilevamento tabelle per estrarre con precisione i dati tabulari dai PDF. Preserva la struttura delle celle, la formattazione e i tipi di dati. Per i PDF scansionati, viene utilizzata la tecnologia OCR per riconoscere il testo e convertirlo in formato Excel modificabile.",
    faq2Question: "Posso convertire documenti PDF scansionati in Excel?",
    faq2Answer:
      "S\u00ec! Il nostro strumento supporta la tecnologia OCR (riconoscimento ottico dei caratteri) che pu\u00f2 estrarre testo e tabelle da documenti PDF scansionati e convertirli in fogli di calcolo Excel modificabili.",
    faq3Question: "La formattazione dei dati verr\u00e0 preservata?",
    faq3Answer:
      "Cerchiamo di preservare il pi\u00f9 possibile la formattazione, inclusi bordi delle celle, allineamento del testo, formati numerici e celle unite. Layout complessi potrebbero richiedere piccole modifiche dopo la conversione.",
    faq4Question: "C'\u00e8 un limite alla dimensione del file che posso convertire?",
    faq4Answer:
      "Nel piano gratuito puoi convertire file PDF fino a 5 MB (20 MB con Starter). Per file pi\u00f9 grandi, consigliamo di dividerli in parti pi\u00f9 piccole prima della conversione.",
    faq5Question: "Quanto sono sicuri i miei dati durante la conversione?",
    faq5Answer:
      "La tua sicurezza \u00e8 la nostra priorit\u00e0. Tutti i file sono crittografati durante il trasferimento con SSL a 256 bit. I file vengono cancellati automaticamente dai nostri server entro 1 ora dalla conversione e non condividiamo mai i tuoi dati con terze parti.",
    faq6Question: "Posso convertire pi\u00f9 file PDF contemporaneamente?",
    faq6Answer:
      "S\u00ec! Puoi caricare e convertire fino a 10 file PDF contemporaneamente. Ogni file verr\u00e0 convertito in un foglio di calcolo Excel separato.",
    ctaTitle: "Pronto a convertire il tuo PDF?",
    ctaSubtitle:
      "Unisciti a utenti di tutto il mondo che usano SmallPDF.us per conversioni PDF in Excel rapide e precise.",
    ctaButton: "Carica PDF ora",
    ctaNote: "Veloce • Sicuro • Privato",
    relatedToolsTitle: "Strumenti PDF correlati",
    relatedToolsSubtitle: "Esplora altri strumenti per lavorare con i tuoi file PDF",
    tool1: "Excel in PDF",
    tool2: "PDF in Word",
    tool3: "Word in PDF",
    tool4: "Unisci PDF",
    tool5: "Comprimi PDF",
    tool6: "Dividi PDF",
  },
  id: {
    pageTitle: "Konversi PDF ke Excel Gratis Online \u2013 PDF ke XLSX | SmallPDF.us",
    pageDescription:
      "Konversi PDF ke spreadsheet Excel secara gratis. Ekstrak tabel dan data ke XLSX yang dapat diedit. Cepat, akurat, aman, dengan dukungan OCR.",
    heroTitle: "PDF ke Excel",
    heroTitleHighlight: "Konverter Gratis",
    heroSubtitle:
      "Ekstrak tabel dan data dari file PDF ke spreadsheet Excel yang dapat diedit. Cepat, akurat, dan mudah digunakan.",
    uploadDragText: "Pilih PDF untuk Dikonversi",
    uploadDragActive: "Lepaskan PDF Anda di Sini!",
    uploadSubtext: "Seret & lepas PDF Anda atau klik untuk mencari file",
    uploadButton: "Pilih PDF",
    uploadLimit: "Maksimum {maxSize} per file \u2022 Hingga {maxFiles} file",
    errorInvalidType: "Hanya file PDF yang diizinkan",
    errorMaxSize: "Ukuran file melebihi batas gratis 5MB",
    errorMaxFiles: "Maksimum {maxFiles} file yang diizinkan",
    convertButton: "Konversi ke Excel",
    secureLabel: "Aman",
    instantLabel: "Instan",
    pdfFormatLabel: "Format PDF",
    filesSelected: "{count} file dipilih",
    totalLabel: "total",
    removeAllFiles: "Hapus semua file",
    howItWorksTitle: "Cara Mengonversi PDF ke Excel",
    howItWorksSubtitle:
      "Ubah dokumen PDF Anda menjadi spreadsheet Excel yang dapat diedit dalam tiga langkah mudah",
    step1Title: "Unggah PDF",
    step1Desc: "Seret & lepas file PDF Anda atau klik untuk mencari. Mendukung unggahan beberapa file sekaligus.",
    step2Title: "Ekstrak Tabel",
    step2Desc: "AI kami secara otomatis mendeteksi dan mengekstrak tabel dengan akurasi tinggi.",
    step3Title: "Unduh Excel",
    step3Desc: "Dapatkan file Excel yang dapat diedit dengan semua data dan format terjaga.",
    featuresTitle: "Fitur PDF ke Excel yang Canggih",
    featuresSubtitle: "Teknologi terdepan untuk mengonversi file PDF Anda dengan akurasi sempurna",
    feature1Title: "Deteksi Tabel Cerdas",
    feature1Desc: "Algoritma berbasis AI secara otomatis mengidentifikasi dan mengekstrak tabel dari PDF Anda.",
    feature2Title: "Format Terjaga",
    feature2Desc: "Batas sel, warna, font, dan format angka tetap dipertahankan setelah konversi.",
    feature3Title: "Dukungan OCR",
    feature3Desc: "Konversi PDF hasil pindaian dan gambar menjadi Excel yang dapat diedit menggunakan teknologi OCR canggih.",
    feature4Title: "Sangat Cepat",
    feature4Desc: "Konversi file PDF berukuran besar dalam hitungan detik dengan mesin pemrosesan yang dioptimalkan.",
    feature5Title: "Keamanan Tingkat Bank",
    feature5Desc:
      "Enkripsi SSL 256-bit dan penghapusan file otomatis memastikan data Anda tetap privat.",
    feature6Title: "Banyak Lembar Kerja",
    feature6Desc: "PDF multi-halaman dikonversi dengan setiap halaman sebagai lembar Excel terpisah.",
    convertAnyTitle: "Konversi PDF Apa Pun ke Excel",
    convertAnySubtitle:
      "Konverter kami menangani semua jenis dokumen PDF dan mengekstrak data dengan akurasi luar biasa.",
    convertAnyList1: "Dokumen PDF asli dengan teks yang dapat dipilih",
    convertAnyList2: "PDF hasil pindaian menggunakan teknologi OCR",
    convertAnyList3: "Tabel kompleks dengan sel yang digabungkan",
    convertAnyList4: "Tata letak multi-kolom dan formulir",
    convertAnyList5: "Laporan keuangan dan faktur",
    convertAnyList6: "Laporan data dan spreadsheet",
    outputFormatsTitle: "Format Output",
    outputFormatsSubtitle: "File hasil konversi Anda akan berformat XLSX",
    inputFormatLabel: "Format Input",
    outputFormatLabel: "Format Output",
    compatNote: "Kompatibel dengan Microsoft Excel, Google Sheets, LibreOffice Calc, dan lainnya",
    diveTitle: "Yang perlu diketahui sebelum mengonversi",
    diveSubtitle: "Detail yang benar-benar memengaruhi hasil Anda — bukan tips umum.",
    dive1Title: "Paling cocok untuk faktur",
    dive1Desc: "Faktur adalah salah satu konversi PDF ke Excel yang paling umum. Item baris, kuantitas, harga satuan, dan total biasanya berada dalam grid yang rapi, yang dapat dibaca dengan andal oleh pendeteksi tabel kami — jadi Anda bisa langsung memasukkan faktur vendor ke spreadsheet tanpa mengetik ulang angka.",
    dive2Title: "Tabel digital vs. PDF hasil pindai",
    dive2Desc: "PDF yang dibuat secara digital (dari Excel, software akuntansi, atau situs web) memiliki teks yang dapat dipilih dan struktur tabel yang jelas, sehingga konversinya cepat dan akurat. PDF hasil pindai atau foto sama sekali tidak memiliki lapisan teks — hanya gambar — sehingga perlu OCR terlebih dahulu.",
    dive3Title: "Bagaimana ekstraksi tabel sebenarnya bekerja",
    dive3Desc: "Konverter kami mencari perataan kolom, batas sel, dan pola spasi yang konsisten di setiap halaman untuk mengidentifikasi awal dan akhir tabel. Setelah grid dipetakan, konten setiap sel ditempatkan ke sel Excel yang sesuai — mempertahankan baris dan kolom alih-alih menggabungkan semuanya menjadi satu blok teks.",
    dive4Title: "Keterbatasan format yang perlu diperhatikan",
    dive4Desc: "Grid sederhana dikonversi dengan bersih, tetapi beberapa hal dapat menyulitkan alat PDF ke Excel mana pun: sel yang digabung di beberapa baris, tabel yang berlanjut melewati pemisah halaman, dan sub-tabel yang bersarang di dalam satu sel. Biasanya tetap dikonversi, tetapi mungkin memerlukan penyesuaian manual setelahnya.",
    dive5Title: "PDF dengan beberapa tabel",
    dive5Desc: "Jika PDF Anda memiliki lebih dari satu tabel — di halaman berbeda, atau beberapa dalam satu halaman — masing-masing dideteksi secara terpisah dan tetap berbeda dalam hasilnya, sehingga tidak tergabung menjadi satu tabel yang berantakan.",
    dive6Title: "PDF hasil pindai → OCR → Excel",
    dive6Desc: "Untuk dokumen hasil pindai atau foto, alat kami menjalankan Pengenalan Karakter Optik (OCR) terlebih dahulu untuk membaca teks dan angka dari gambar, lalu menerapkan logika deteksi tabel yang sama pada hasil OCR. Akurasi bergantung pada kualitas pindaian — pindaian 300 DPI yang jelas dikonversi jauh lebih baik daripada foto ponsel yang buram.",
    faqTitle: "Pertanyaan yang Sering Diajukan",
    faqSubtitle: "Semua yang perlu Anda ketahui tentang konversi PDF ke Excel",
    faq1Question: "Seberapa akurat konversi PDF ke Excel?",
    faq1Answer:
      "Konverter kami menggunakan algoritma deteksi tabel canggih untuk mengekstrak data tabel dari PDF secara akurat. Struktur sel, format, dan tipe data dipertahankan. Untuk PDF hasil pindaian, teknologi OCR digunakan untuk mengenali teks dan mengonversinya ke format Excel yang dapat diedit.",
    faq2Question: "Bisakah saya mengonversi dokumen PDF yang dipindai ke Excel?",
    faq2Answer:
      "Ya! Alat kami mendukung teknologi OCR (Optical Character Recognition) yang dapat mengekstrak teks dan tabel dari dokumen PDF yang dipindai dan mengonversinya menjadi spreadsheet Excel yang dapat diedit.",
    faq3Question: "Apakah format data saya akan dipertahankan?",
    faq3Answer:
      "Kami berusaha mempertahankan format sebanyak mungkin, termasuk batas sel, perataan teks, format angka, dan sel yang digabungkan. Tata letak yang kompleks mungkin memerlukan penyesuaian kecil setelah konversi.",
    faq4Question: "Apakah ada batasan ukuran file yang dapat dikonversi?",
    faq4Answer:
      "Pada paket gratis Anda dapat mengonversi file PDF hingga 5MB (20MB dengan Starter). Untuk file yang lebih besar, kami menyarankan untuk membaginya menjadi beberapa bagian kecil sebelum konversi.",
    faq5Question: "Seberapa aman data saya selama konversi?",
    faq5Answer:
      "Keamanan Anda adalah prioritas kami. Semua file dienkripsi selama transfer menggunakan enkripsi SSL 256-bit. File dihapus otomatis dari server kami dalam 1 jam setelah konversi, dan kami tidak pernah membagikan data Anda kepada pihak ketiga.",
    faq6Question: "Bisakah saya mengonversi beberapa file PDF sekaligus?",
    faq6Answer:
      "Ya! Anda dapat mengunggah dan mengonversi hingga 10 file PDF secara bersamaan. Setiap file akan dikonversi menjadi spreadsheet Excel terpisah.",
    ctaTitle: "Siap Mengonversi PDF Anda?",
    ctaSubtitle:
      "Bergabunglah dengan pengguna di seluruh dunia yang menggunakan SmallPDF.us untuk konversi PDF ke Excel yang cepat dan akurat.",
    ctaButton: "Unggah PDF Sekarang",
    ctaNote: "Cepat • Aman • Privat",
    relatedToolsTitle: "Alat PDF Terkait",
    relatedToolsSubtitle: "Jelajahi lebih banyak alat untuk bekerja dengan file PDF Anda",
    tool1: "Excel ke PDF",
    tool2: "PDF ke Word",
    tool3: "Word ke PDF",
    tool4: "Gabung PDF",
    tool5: "Kompres PDF",
    tool6: "Pisah PDF",
  },
  pt: {
    pageTitle: "Converter PDF para Excel grátis online | SmallPDF.us",
    pageDescription:
      "Converta PDF em planilhas Excel gratuitamente. Extraia tabelas e dados para XLSX editável. Rápido, preciso e seguro, com suporte a OCR.",
    heroTitle: "PDF para Excel",
    heroTitleHighlight: "Conversor Gratuito",
    heroSubtitle:
      "Extraia tabelas e dados de arquivos PDF para planilhas Excel editáveis. Rápido, preciso e fácil de usar.",
    uploadDragText: "Selecione o PDF para Converter",
    uploadDragActive: "Solte seu PDF aqui!",
    uploadSubtext: "Arraste e solte seu PDF ou clique para procurar",
    uploadButton: "Escolher PDF",
    uploadLimit: "Máximo de {maxSize} por arquivo • Até {maxFiles} arquivos",
    errorInvalidType: "Apenas arquivos PDF são permitidos",
    errorMaxSize: "O tamanho do arquivo excede o limite gratuito de 5 MB",
    errorMaxFiles: "Máximo de {maxFiles} arquivos permitidos",
    convertButton: "Converter para Excel",
    secureLabel: "Seguro",
    instantLabel: "Instantâneo",
    pdfFormatLabel: "Formato PDF",
    filesSelected: "{count} arquivo{plural} selecionado{plural}",
    totalLabel: "total",
    removeAllFiles: "Remover todos os arquivos",
    howItWorksTitle: "Como Converter PDF para Excel",
    howItWorksSubtitle:
      "Transforme seus documentos PDF em planilhas Excel editáveis em três passos simples",
    step1Title: "Enviar PDF",
    step1Desc: "Arraste e solte seu arquivo PDF ou clique para procurar. Suporta envio de múltiplos arquivos.",
    step2Title: "Extrair Tabelas",
    step2Desc: "Nossa IA detecta e extrai tabelas automaticamente com alta precisão.",
    step3Title: "Baixar Excel",
    step3Desc: "Obtenha seu arquivo Excel editável com todos os dados e a formatação preservados.",
    featuresTitle: "Recursos Poderosos de PDF para Excel",
    featuresSubtitle: "Tecnologia avançada para converter seus arquivos PDF com precisão perfeita",
    feature1Title: "Detecção Inteligente de Tabelas",
    feature1Desc: "Algoritmo baseado em IA identifica e extrai automaticamente tabelas dos seus PDFs.",
    feature2Title: "Formatação Preservada",
    feature2Desc: "Bordas de células, cores, fontes e formatos numéricos são mantidos após a conversão.",
    feature3Title: "Suporte a OCR",
    feature3Desc: "Converta PDFs digitalizados e imagens em Excel editável usando tecnologia OCR avançada.",
    feature4Title: "Extremamente Rápido",
    feature4Desc: "Converta arquivos PDF grandes em segundos com nosso mecanismo de processamento otimizado.",
    feature5Title: "Segurança de Nível Bancário",
    feature5Desc:
      "Criptografia SSL de 256 bits e exclusão automática de arquivos garantem a privacidade dos seus dados.",
    feature6Title: "Múltiplas Planilhas",
    feature6Desc: "PDFs de várias páginas são convertidos com cada página em uma planilha Excel separada.",
    convertAnyTitle: "Converta Qualquer PDF para Excel",
    convertAnySubtitle:
      "Nosso conversor processa todos os tipos de documentos PDF e extrai dados com precisão excepcional.",
    convertAnyList1: "Documentos PDF nativos com texto selecionável",
    convertAnyList2: "PDFs digitalizados usando tecnologia OCR",
    convertAnyList3: "Tabelas complexas com células mescladas",
    convertAnyList4: "Layouts de múltiplas colunas e formulários",
    convertAnyList5: "Demonstrativos financeiros e faturas",
    convertAnyList6: "Relatórios de dados e planilhas",
    outputFormatsTitle: "Formatos de Saída",
    outputFormatsSubtitle: "Seu arquivo convertido estará no formato XLSX",
    inputFormatLabel: "Formato de Entrada",
    outputFormatLabel: "Formato de Saída",
    compatNote:
      "Compatível com Microsoft Excel, Google Planilhas, LibreOffice Calc e muito mais",
    diveTitle: "O que saber antes de converter",
    diveSubtitle: "Os detalhes que realmente afetam o resultado — não dicas genéricas.",
    dive1Title: "Ideal para faturas",
    dive1Desc: "Faturas são uma das conversões de PDF para Excel mais comuns. Itens, quantidades, preços unitários e totais geralmente ficam em uma grade organizada, que nosso detector de tabelas lê com confiabilidade — assim você pode importar faturas de fornecedores diretamente para uma planilha sem digitar os números novamente.",
    dive2Title: "Tabelas digitais vs. PDFs escaneados",
    dive2Desc: "Um PDF gerado digitalmente (do Excel, software contábil ou um site) tem texto selecionável e uma estrutura de tabela definida, então a conversão é rápida e exata. Um PDF escaneado ou fotografado não tem nenhuma camada de texto — apenas uma imagem — então precisa de OCR primeiro.",
    dive3Title: "Como a extração de tabelas realmente funciona",
    dive3Desc: "Nosso conversor procura alinhamento de colunas, bordas de células e padrões de espaçamento em cada página para identificar onde uma tabela começa e termina. Depois de mapear a grade, o conteúdo de cada célula é colocado na célula correspondente do Excel — preservando linhas e colunas em vez de despejar tudo em um único bloco de texto.",
    dive4Title: "Limitações de formatação a esperar",
    dive4Desc: "Grades simples convertem bem, mas algumas coisas podem atrapalhar qualquer ferramenta de PDF para Excel: células mescladas em várias linhas, tabelas que continuam após uma quebra de página e subtabelas aninhadas dentro de uma única célula. Geralmente ainda são convertidas, mas podem precisar de um ajuste manual depois.",
    dive5Title: "PDFs com várias tabelas",
    dive5Desc: "Se o seu PDF tiver mais de uma tabela — em páginas diferentes, ou várias em uma mesma página — cada uma é detectada separadamente e mantida distinta no resultado, para que não fiquem mescladas em uma única tabela confusa.",
    dive6Title: "PDF escaneado → OCR → Excel",
    dive6Desc: "Para documentos escaneados ou fotografados, nossa ferramenta executa primeiro o Reconhecimento Óptico de Caracteres (OCR) para ler o texto e os números da imagem, e então aplica a mesma lógica de detecção de tabelas ao resultado do OCR. A precisão depende da qualidade do escaneamento — uma digitalização nítida em 300 DPI converte muito melhor do que uma foto de celular borrada.",
    faqTitle: "Perguntas Frequentes",
    faqSubtitle: "Tudo o que você precisa saber sobre a conversão de PDF para Excel",
    faq1Question: "Qual é a precisão da conversão de PDF para Excel?",
    faq1Answer:
      "Nosso conversor usa algoritmos avançados de detecção de tabelas para extrair dados tabulares de PDFs com precisão. Ele preserva a estrutura das células, a formatação e os tipos de dados. Para PDFs digitalizados, a tecnologia OCR é usada para reconhecer o texto e convertê-lo para o formato Excel editável.",
    faq2Question: "Posso converter documentos PDF digitalizados para Excel?",
    faq2Answer:
      "Sim! Nossa ferramenta suporta tecnologia OCR (Reconhecimento Óptico de Caracteres) que pode extrair texto e tabelas de documentos PDF digitalizados e convertê-los em planilhas Excel editáveis.",
    faq3Question: "A formatação dos meus dados será preservada?",
    faq3Answer:
      "Nos esforçamos para preservar o máximo de formatação possível, incluindo bordas de células, alinhamento de texto, formatos numéricos e células mescladas. Layouts complexos podem exigir pequenos ajustes após a conversão.",
    faq4Question: "Existe um limite de tamanho de arquivo que posso converter?",
    faq4Answer:
      "No plano gratuito você pode converter arquivos PDF de até 5 MB (20 MB com Starter). Para arquivos maiores, recomendamos dividi-los em partes menores antes da conversão.",
    faq5Question: "Quão seguros são meus dados durante a conversão?",
    faq5Answer:
      "Sua segurança é nossa prioridade. Todos os arquivos são criptografados durante a transferência usando criptografia SSL de 256 bits. Os arquivos são excluídos automaticamente de nossos servidores dentro de 1 hora após a conversão, e nunca compartilhamos seus dados com terceiros.",
    faq6Question: "Posso converter vários arquivos PDF de uma vez?",
    faq6Answer:
      "Sim! Você pode enviar e converter até 10 arquivos PDF simultaneamente. Cada arquivo será convertido em uma planilha Excel separada.",
    ctaTitle: "Pronto para Converter seu PDF?",
    ctaSubtitle:
      "Junte-se a usuários do mundo todo que usam o SmallPDF.us para conversões rápidas e precisas de PDF para Excel.",
    ctaButton: "Enviar PDF Agora",
    ctaNote: "Rápido • Seguro • Privado",
    relatedToolsTitle: "Ferramentas PDF Relacionadas",
    relatedToolsSubtitle: "Explore mais ferramentas para trabalhar com seus arquivos PDF",
    tool1: "Excel para PDF",
    tool2: "PDF para Word",
    tool3: "Word para PDF",
    tool4: "Unir PDF",
    tool5: "Comprimir PDF",
    tool6: "Dividir PDF",
  },
}


// In-memory hand-off of the selected File objects to the preview page.
export const pdfToExcelStore = { files: [] }

export default function PdfToExcel() {
  const router = useLocalizedRouter()
  const { locale } = router
  const t = translations[locale] || translations.en

  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState([])
  const [error, setError] = useState("")
  const [openFaq, setOpenFaq] = useState(null)

  const { checkFiles, PremiumGateModal } = useFileSizeGuard('pdf-to-excel')
  const { checkBatch, BatchGateModal } = useBatchGuard('pdf-to-excel')

  const MAX_FILES = 10
  const ACCEPTED_TYPES = ["application/pdf"]
  const ACCEPTED_EXTENSIONS = [".pdf"]

  const validateFile = (file) => {
    const ext = "." + file.name.split(".").pop().toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
      return { valid: false, error: `${file.name}: ${t.errorInvalidType}` }
    }
    // Size is checked by checkFiles() against the user's actual plan (the
    // fixed 5 MB check here blocked Starter/Pro users too).
    return { valid: true }
  }

  const processFiles = useCallback(
    (newFiles) => {
      setError("")
      const fileArray = Array.from(newFiles)

      if (!checkFiles(fileArray)) return
      if (!checkBatch(fileArray)) return
      if (files.length + fileArray.length > MAX_FILES) {
        setError(t.errorMaxFiles.replace("{maxFiles}", MAX_FILES))
        return
      }

      const validFiles = []
      const errors = []

      fileArray.forEach((file) => {
        const validation = validateFile(file)
        if (validation.valid) {
          validFiles.push(file)
        } else {
          errors.push(validation.error)
        }
      })

      if (errors.length > 0) {
        setError(errors.join(". "))
      }

      if (validFiles.length > 0) {
        const filesWithIds = validFiles.map((file) => ({
          id: Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
        }))
        setFiles((prev) => [...prev, ...filesWithIds])
      }
    },
    [files.length, t],
  )

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles],
  )

  const handleFileSelect = useCallback(
    (e) => {
      if (e.target.files) {
        processFiles(e.target.files)
      }
    },
    [processFiles],
  )

  const handleConvert = () => {
    if (files.length === 0) return
    // Keep the File objects in memory. Base64 copies in sessionStorage hit the
    // ~5 MB quota for any PDF over ~3.7 MB, setItem threw, and the button
    // silently did nothing.
    pdfToExcelStore.files = files.map((f) => ({ id: f.id, name: f.name, size: f.size, type: f.type, file: f.file }))
    router.push("/pdf-to-excel/preview")
  }

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    }
    return (bytes / 1024).toFixed(1) + " KB"
  }

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const faqs = [
    { q: t.faq1Question, a: t.faq1Answer },
    { q: t.faq2Question, a: t.faq2Answer },
    { q: t.faq3Question, a: t.faq3Answer },
    { q: t.faq4Question, a: t.faq4Answer },
    { q: t.faq5Question, a: t.faq5Answer },
    { q: t.faq6Question, a: t.faq6Answer },
  ]

  // ── Structured Data (tool-specific; SEOHead adds the site-level graph) ──────
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smallpdf.us'
  const toolStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: t.heroTitle + " " + t.heroTitleHighlight,
        description: t.pageDescription,
        // Dynamic URL — correct for every locale
        url: locale === 'en'
          ? `${baseUrl}/pdf-to-excel/`
          : `${baseUrl}/${locale}/pdf-ke-excel/`,
        applicationCategory: "UtilityApplication",
        operatingSystem: "Any",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        // No aggregateRating — only add back when you have real verified reviews
        featureList: [
          t.feature1Title,
          t.feature2Title,
          t.feature3Title,
          t.feature4Title,
          t.feature5Title,
          t.feature6Title,
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
      {
        // HowTo is now fully localized via the t object
        "@type": "HowTo",
        name: t.howItWorksTitle,
        description: t.howItWorksSubtitle,
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: t.step1Title,
            text: t.step1Desc,
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: t.step2Title,
            text: t.step2Desc,
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: t.step3Title,
            text: t.step3Desc,
          },
        ],
      },
    ],
  }

  return (
    <Layout>
      {/* Header Ad */}
      <div className="bg-white px-4 pt-5">
        <div className="max-w-4xl mx-auto">
          <AdSenseUnit size="leaderboard" />
        </div>
      </div>

      {/*
        SEOHead handles: self-referencing canonical, all 8 hreflang tags,
        localized OG/Twitter meta, robots, site-level structured data.
        We pass the tool-specific structured data via the structuredData prop,
        which SEOHead merges into its @graph.
      */}
      <SEOHead
        title={t.pageTitle}
        description={t.pageDescription}
        keywords="pdf to excel, pdf to xlsx, convert pdf to excel, pdf to spreadsheet, extract tables from pdf, pdf table extractor, free pdf converter, online pdf to excel, pdf data extraction, ocr pdf to excel"
        ogImage="/og-pdf-to-excel.jpg"
        structuredData={toolStructuredData}
      />

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap");
        .font-display {
          font-family: "Plus Jakarta Sans", sans-serif;
        }
        .font-body {
          font-family: "DM Sans", sans-serif;
        }
        

        @keyframes bounce-slow {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-b border-blue-200">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            {t.heroTitle} <span className="text-blue-600">{t.heroTitleHighlight}</span>
          </h1>
          <p className="font-body text-base text-slate-600 max-w-2xl mx-auto mb-2">
            {t.heroSubtitle.replace("SmallPDF.us", "")}
            <strong>SmallPDF.us</strong>
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 py-8 px-4">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-8 right-20 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-blue-200 p-6">
            {files.length > 0 ? (
              <>
                {/* File Info */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-display text-lg font-semibold text-slate-900">
                        {t.filesSelected
                          .replace("{count}", files.length)
                          .replace("{plural}", files.length > 1 ? "s" : "")}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))} {t.totalLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFiles([])}
                    className="p-2.5 hover:bg-red-50 rounded-lg transition-colors"
                    title={t.removeAllFiles}
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>

                {/* Selected Files List */}
                <div className="max-h-64 overflow-y-auto space-y-2 mb-6">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-body text-sm font-medium text-slate-800 truncate">{file.name}</p>
                          <p className="font-body text-xs text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(file.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Convert Button */}
                <button
                  onClick={handleConvert}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform hover:scale-105"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>{t.convertButton}</span>
                </button>
              </>
            ) : (
              <>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative rounded-xl transition-all duration-300 ${
                    isDragging
                      ? "border-4 border-blue-500 bg-blue-50 scale-102 shadow-lg"
                      : "border-3 border-dashed border-blue-300 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
                  }`}
                  style={{ borderWidth: isDragging ? "4px" : "3px" }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                  />

                  <div className="p-6 sm:p-10 text-center">
                    <div className="mb-3">
                      <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl mb-2 sm:mb-3 shadow-xl transform hover:scale-110 transition-transform duration-300">
                        <FileSpreadsheet className="w-8 h-8 text-white animate-bounce-slow" />
                      </div>
                    </div>

                    <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                      {isDragging ? t.uploadDragActive : t.uploadDragText}
                    </h3>
                    <p className="font-body text-sm text-slate-500 mb-3 sm:mb-4">{t.uploadSubtext}</p>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <Upload className="w-5 h-5" />
                      <span>{t.uploadButton}</span>
                    </button>

                    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                        <span>{t.pdfFormatLabel}</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                      <div className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-slate-600" />
                        <span>{t.secureLabel}</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t.instantLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="font-body text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {files.length === 0 && (
              <p className="text-center font-body text-sm text-slate-600 mt-5">
                {t.uploadLimit
                  .replace("{maxSize}", "5MB")
                  .replace("{maxFiles}", "1")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t.howItWorksTitle}
            </h2>
            <p className="font-body text-lg text-slate-600 max-w-2xl mx-auto">
              {t.howItWorksSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Upload,
                title: t.step1Title,
                description: t.step1Desc,
                color: "from-blue-500 to-indigo-600",
              },
              {
                step: "02",
                icon: Grid3X3,
                title: t.step2Title,
                description: t.step2Desc,
                color: "from-indigo-500 to-purple-600",
              },
              {
                step: "03",
                icon: FileSpreadsheet,
                title: t.step3Title,
                description: t.step3Desc,
                color: "from-green-500 to-emerald-600",
              },
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="bg-slate-50 rounded-2xl p-8 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="absolute -top-4 left-8">
                    <span className="font-display text-6xl font-bold text-slate-100 group-hover:text-blue-100 transition-colors">
                      {item.step}
                    </span>
                  </div>
                  <div
                    className={`relative w-16 h-16 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}
                  >
                    <item.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="font-body text-slate-600">{item.description}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t.featuresTitle}
            </h2>
            <p className="font-body text-lg text-slate-600 max-w-2xl mx-auto">
              {t.featuresSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Grid3X3,    title: t.feature1Title, description: t.feature1Desc, color: "bg-blue-600" },
              { icon: BarChart3,  title: t.feature2Title, description: t.feature2Desc, color: "bg-indigo-600" },
              { icon: FileCheck,  title: t.feature3Title, description: t.feature3Desc, color: "bg-purple-600" },
              { icon: Zap,        title: t.feature4Title, description: t.feature4Desc, color: "bg-amber-500" },
              { icon: Shield,     title: t.feature5Title, description: t.feature5Desc, color: "bg-green-600" },
              { icon: Table,      title: t.feature6Title, description: t.feature6Desc, color: "bg-rose-600" },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100"
              >
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="font-body text-slate-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Formats */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                {t.convertAnyTitle}
              </h2>
              <p className="font-body text-lg text-slate-600 mb-8">{t.convertAnySubtitle}</p>

              <div className="space-y-4">
                {[
                  t.convertAnyList1,
                  t.convertAnyList2,
                  t.convertAnyList3,
                  t.convertAnyList4,
                  t.convertAnyList5,
                  t.convertAnyList6,
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="font-body text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8">
              <div className="text-center mb-6">
                <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{t.outputFormatsTitle}</h3>
                <p className="font-body text-slate-600 text-sm">{t.outputFormatsSubtitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
                  <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <span className="font-display font-bold text-slate-900">PDF</span>
                  <p className="font-body text-xs text-slate-500 mt-1">{t.inputFormatLabel}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <FileSpreadsheet className="w-8 h-8 text-white" />
                  </div>
                  <span className="font-display font-bold text-slate-900">XLSX</span>
                  <p className="font-body text-xs text-slate-500 mt-1">{t.outputFormatLabel}</p>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="font-body text-sm text-slate-600">{t.compatNote}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deep-dive Section — unique, tool-specific content (not shared boilerplate) */}
      <section className="py-16 sm:py-20 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              {t.diveTitle}
            </h2>
            <p className="font-body text-lg text-slate-600">{t.diveSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              [t.dive1Title, t.dive1Desc],
              [t.dive2Title, t.dive2Desc],
              [t.dive3Title, t.dive3Desc],
              [t.dive4Title, t.dive4Desc],
              [t.dive5Title, t.dive5Desc],
              [t.dive6Title, t.dive6Desc],
            ].map(([title, desc], i) => (
              <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="font-body text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              {t.faqTitle}
            </h2>
            <p className="font-body text-lg text-slate-600">{t.faqSubtitle}</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-display font-semibold text-slate-900 pr-4">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6">
                    <p className="font-body text-slate-600">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
            {t.ctaTitle}
          </h2>
          <p className="font-body text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            {t.ctaSubtitle}
          </p>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-3 bg-white text-blue-600 px-8 py-4 rounded-xl font-display font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <Upload className="w-6 h-6" />
            <span>{t.ctaButton}</span>
          </button>

          <p className="font-body text-sm text-blue-200 mt-6">{t.ctaNote}</p>
        </div>
      </section>

      {/* Related Tools */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">{t.relatedToolsTitle}</h2>
            <p className="font-body text-slate-600">{t.relatedToolsSubtitle}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: t.tool1, href: "/excel-to-pdf",   icon: FileSpreadsheet, color: "bg-green-600" },
              { name: t.tool2, href: "/pdf-to-word",    icon: FileText,        color: "bg-blue-600" },
              { name: t.tool3, href: "/word-to-pdf",    icon: FileText,        color: "bg-indigo-600" },
              { name: t.tool4, href: "/merge-pdf",      icon: FileCheck,       color: "bg-purple-600" },
              { name: t.tool5, href: "/compress-pdf",   icon: Zap,             color: "bg-amber-500" },
              { name: t.tool6, href: "/split-pdf",      icon: Grid3X3,         color: "bg-rose-600" },
            ].map((tool) => (
              // router.href() translates EN paths to the correct localized URL
              // e.g. /merge-pdf → /de/pdf-zusammenfuegen for German users
              <a
                key={tool.name}
                href={router.href(tool.href)}
                className="group p-4 bg-slate-50 rounded-xl hover:bg-white hover:shadow-lg transition-all duration-300 text-center"
              >
                <div
                  className={`w-12 h-12 ${tool.color} rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md group-hover:scale-110 transition-transform`}
                >
                  <tool.icon className="w-6 h-6 text-white" />
                </div>
                <span className="font-display text-sm font-semibold text-slate-900">{tool.name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <RelatedTools current="pdf-to-excel" />
      {PremiumGateModal}
      {BatchGateModal}
    </Layout>
  )
}

export async function getStaticProps({ locale }) {
  return {
    props: { messages: getPageMessages(locale, ["pdfToExcel"]) },
    revalidate: 86400,
  }
}
