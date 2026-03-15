import { useState, useEffect, memo, useRef } from "react"
import Link from "next/link" 
import Layout from "../components/Layout"
import SEOHead from "../components/SEOHead"
import { useTranslations } from "../lib/i18n"
import { getLocalizedRoute } from "../lib/route-translations"
import {
  FileText, Merge, Scissors, Gauge, FileImage, ArrowRight, Check, Upload,
  Download, Lock, Zap, ChevronRight, Shield, Clock, Users, ChevronDown,
  Star, Presentation, Table, Sparkles, Crown, Award, ScanText
} from "lucide-react"

function L(locale, map) { return map[locale] ?? map.en ?? '' }

function useInView() {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold: 0.08 })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return [ref, inView]
}

const Reveal = memo(({ children, className = "", delay = 0 }) => {
  const [ref, inView] = useInView()
  return (
    <div ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
})
Reveal.displayName = 'Reveal'

const ToolCard = memo(({ tool, index, locale }) => {
  const localizedSlug = ['ja','de','fr','es','it','id','pt'].includes(locale) ? getLocalizedRoute(tool.href.replace(/^\//, ''), locale) : tool.href.replace(/^\//, '')
  const fullHref = locale && locale !== 'en' ? `/${locale}/${localizedSlug}` : (localizedSlug ? `/${localizedSlug}` : '/')
  return (
    <Link href={fullHref} locale={false}
      className="group relative rounded-2xl p-4 transition-all duration-500 hover:-translate-y-1 border border-gray-100/80 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-gray-200"
      style={{ animationDelay: `${index * 30}ms`, animation: 'cardIn 0.5s ease-out forwards', opacity: 0 }}>
      <div className="flex items-center gap-3.5">
        <div className={`flex-shrink-0 w-11 h-11 bg-gradient-to-br ${tool.gradient} rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-500`}>
          <tool.Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate tracking-tight">{tool.name}</h3>
          <p className="text-[11px] text-gray-500 truncate mt-0.5">{tool.shortDesc}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </div>
    </Link>
  )
})
ToolCard.displayName = 'ToolCard'

const FAQItem = memo(({ question, answer, isOpen, onToggle }) => (
  <div className={`rounded-2xl border transition-all duration-300 ${isOpen ? 'bg-white border-gray-200 shadow-sm' : 'bg-white/60 border-gray-100 hover:border-gray-200'}`}>
    <button onClick={onToggle} className="w-full flex items-center justify-between p-5 text-left" aria-expanded={isOpen}>
      <span className="text-[15px] font-semibold text-gray-900 pr-4 leading-snug">{question}</span>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-gray-900 rotate-180' : 'bg-gray-100'}`}>
        <ChevronDown className={`w-3.5 h-3.5 ${isOpen ? 'text-white' : 'text-gray-500'}`} />
      </div>
    </button>
    <div className={`transition-all duration-400 ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
      <div className="px-5 pb-5"><p className="text-sm text-gray-600 leading-relaxed">{answer}</p></div>
    </div>
  </div>
))
FAQItem.displayName = 'FAQItem'

// Styles moved to globals.css — no dynamic injection needed

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [openFAQ, setOpenFAQ] = useState(0)
  const { t, locale } = useTranslations()

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleFAQ = (i) => setOpenFAQ(openFAQ === i ? -1 : i)

  const tools = [
    { name: t('nav.mergePdf'), shortDesc: L(locale, { ja: '複数のPDFを結合', de: 'Mehrere PDFs zusammenführen', fr: 'Combiner plusieurs PDF', es: 'Combinar varios PDF', en: 'Combine multiple PDFs', it: 'Combina più PDF', id: 'Gabungkan beberapa PDF', pt: 'Combinar vários PDFs' }), href: "/merge-pdf", Icon: Merge, gradient: "from-blue-500 to-sky-500" },
    { name: t('nav.splitPdf'), shortDesc: L(locale, { ja: 'PDFからページを抽出', de: 'Seiten aus PDF extrahieren', fr: 'Extraire des pages du PDF', es: 'Extraer páginas de PDF', en: 'Extract pages from PDF', it: 'Estrai pagine dal PDF', id: 'Ekstrak halaman dari PDF', pt: 'Extrair páginas do PDF' }), href: "/split-pdf", Icon: Scissors, gradient: "from-cyan-500 to-teal-500" },
    { name: t('nav.compressPdf'), shortDesc: L(locale, { ja: 'ファイルサイズを削減', de: 'Dateigröße reduzieren', fr: 'Réduire la taille du fichier', es: 'Reducir el tamaño del archivo', en: 'Reduce file size', it: 'Riduci la dimensione del file', id: 'Kurangi ukuran file', pt: 'Reduzir o tamanho do arquivo' }), href: "/compress-pdf", Icon: Gauge, gradient: "from-emerald-500 to-green-500" },
    { name: t('nav.pdfToWord'), shortDesc: L(locale, { ja: 'DOCXに変換', de: 'In DOCX konvertieren', fr: 'Convertir en DOCX', es: 'Convertir a DOCX', en: 'Convert to DOCX', it: 'Converti in DOCX', id: 'Konversi ke DOCX', pt: 'Converter para DOCX' }), href: "/pdf-to-word", Icon: FileText, gradient: "from-blue-500 to-cyan-500" },
    { name: t('nav.wordToPdf'), shortDesc: L(locale, { ja: 'DOCXからPDF', de: 'DOCX in PDF umwandeln', fr: 'Convertir DOCX en PDF', es: 'Convertir DOCX a PDF', en: 'Convert DOCX to PDF', it: 'Converti DOCX in PDF', id: 'Konversi DOCX ke PDF', pt: 'Converter DOCX para PDF' }), href: "/word-to-pdf", Icon: FileText, gradient: "from-indigo-500 to-blue-500" },
    { name: t('nav.pdfToExcel'), shortDesc: L(locale, { ja: 'XLSXに表を抽出', de: 'Tabellen in XLSX extrahieren', fr: 'Extraire des tableaux en XLSX', es: 'Extraer tablas a XLSX', en: 'Extract tables to XLSX', it: 'Estrai tabelle in XLSX', id: 'Ekstrak tabel ke XLSX', pt: 'Extrair tabelas para XLSX' }), href: "/pdf-to-excel", Icon: Table, gradient: "from-green-500 to-emerald-500" },
    { name: t('nav.excelToPdf'), shortDesc: L(locale, { ja: 'XLSXからPDF', de: 'XLSX in PDF umwandeln', fr: 'Convertir XLSX en PDF', es: 'Convertir XLSX a PDF', en: 'Convert XLSX to PDF', it: 'Converti XLSX in PDF', id: 'Konversi XLSX ke PDF', pt: 'Converter XLSX para PDF' }), href: "/excel-to-pdf", Icon: Table, gradient: "from-teal-500 to-green-500" },
    { name: t('nav.pdfToPpt'), shortDesc: L(locale, { ja: 'PowerPointに変換', de: 'In PowerPoint konvertieren', fr: 'Convertir en PowerPoint', es: 'Convertir a PowerPoint', en: 'Convert to PowerPoint', it: 'Converti in PowerPoint', id: 'Konversi ke PowerPoint', pt: 'Converter para PowerPoint' }), href: "/pdf-to-ppt", Icon: Presentation, gradient: "from-blue-500 to-cyan-500" },
    { name: t('nav.pptToPdf'), shortDesc: L(locale, { ja: 'PowerPointからPDF', de: 'PowerPoint in PDF', fr: 'PowerPoint en PDF', es: 'PowerPoint a PDF', en: 'PowerPoint to PDF', it: 'PowerPoint in PDF', id: 'PowerPoint ke PDF', pt: 'PowerPoint para PDF' }), href: "/ppt-to-pdf", Icon: Presentation, gradient: "from-cyan-500 to-blue-500" },
    { name: t('nav.pdfToJpg'), shortDesc: L(locale, { ja: '画像を抽出', de: 'Bilder extrahieren', fr: 'Extraire des images', es: 'Extraer imágenes', en: 'Extract images', it: 'Estrai immagini', id: 'Ekstrak gambar', pt: 'Extrair imagens' }), href: "/pdf-to-jpg", Icon: FileImage, gradient: "from-yellow-500 to-cyan-500" },
    { name: t('nav.jpgToPdf'), shortDesc: L(locale, { ja: '画像からPDF', de: 'Bilder in PDF', fr: 'Images en PDF', es: 'Imágenes a PDF', en: 'Images to PDF', it: 'Immagini in PDF', id: 'Gambar ke PDF', pt: 'Imagens para PDF' }), href: "/jpg-to-pdf", Icon: FileImage, gradient: "from-pink-500 to-sky-500" },
    { name: t('nav.pngToPdf'), shortDesc: L(locale, { ja: 'PNGをPDF形式に', de: 'PNG in PDF-Format', fr: 'PNG au format PDF', es: 'PNG a formato PDF', en: 'PNG to PDF format', it: 'PNG in formato PDF', id: 'PNG ke format PDF', pt: 'PNG para formato PDF' }), href: "/png-to-pdf", Icon: FileImage, gradient: "from-cyan-500 to-teal-500" },
    { name: t('nav.pdfToPng'), shortDesc: L(locale, { ja: 'PNGとしてエクスポート', de: 'Als PNG exportieren', fr: 'Exporter en PNG', es: 'Exportar como PNG', en: 'Export as PNG', it: 'Esporta come PNG', id: 'Ekspor sebagai PNG', pt: 'Exportar como PNG' }), href: "/pdf-to-png", Icon: FileImage, gradient: "from-violet-500 to-purple-500" },
    { name: t('nav.compressImage'), shortDesc: L(locale, { ja: '画像を最適化', de: 'Bilder optimieren', fr: 'Optimiser les images', es: 'Optimizar imágenes', en: 'Optimize images', it: 'Ottimizza immagini', id: 'Optimalkan gambar', pt: 'Otimizar imagens' }), href: "/compress-image", Icon: FileImage, gradient: "from-fuchsia-500 to-sky-500" },
    { name: t('nav.webpToPng'), shortDesc: L(locale, { ja: 'WebP変換', de: 'WebP-Konvertierung', fr: 'Conversion WebP', es: 'Conversión WebP', en: 'WebP conversion', it: 'Conversione WebP', id: 'Konversi WebP', pt: 'Conversão WebP' }), href: "/webp-to-png", Icon: FileImage, gradient: "from-teal-500 to-emerald-500" },
    { name: t('nav.pngToWebp'), shortDesc: L(locale, { ja: 'WebPに変換', de: 'In WebP konvertieren', fr: 'Convertir en WebP', es: 'Convertir a WebP', en: 'Convert to WebP', it: 'Converti in WebP', id: 'Konversi ke WebP', pt: 'Converter para WebP' }), href: "/png-to-webp", Icon: FileImage, gradient: "from-lime-500 to-green-500" },
    { name: t('nav.unlockPdf'), shortDesc: L(locale, { ja: 'パスワード保護を解除', de: 'Passwortschutz entfernen', fr: 'Supprimer la protection', es: 'Eliminar protección', en: 'Remove password protection', it: 'Rimuovi protezione password', id: 'Hapus proteksi kata sandi', pt: 'Remover proteção por senha' }), href: "/unlock-pdf", Icon: Lock, gradient: "from-amber-500 to-orange-500" },
    { name: "OCR PDF", shortDesc: L(locale, { ja: 'PDFからテキストを抽出', de: 'Text aus PDF extrahieren', fr: 'Extraire le texte du PDF', es: 'Extraer texto del PDF', en: 'Extract text from PDF', it: 'Estrai testo dal PDF', id: 'Ekstrak teks dari PDF', pt: 'Extrair texto do PDF' }), href: "/ocr-pdf", Icon: ScanText, gradient: "from-violet-500 to-purple-500" },
  ]

  // FAQs - Dynamic based on locale
  const faqs = locale === 'ja' ? [
    {
      question: "このウェブサイトは本当に無料ですか？",
      answer: "はい、完全無料です！試用期間や有料プラン、隠れた費用は一切ありません。PDFツールは誰でもアクセスできるべきだと考えています。そのため、無制限にファイルの結合、分割、圧縮、変換が可能です。最小限の広告でサービスを維持していますが、作業を妨げるポップアップは表示されません。"
    },
    {
      question: "アップロードしたファイルのセキュリティは？",
      answer: "プライバシーを真剣に考えています。ファイルをアップロードすると、転送中に業界標準の256ビットSSL暗号化で即座に保護されます。つまり、処理中にドキュメントを誰も傍受したり覗いたりすることはできません。変換や編集が完了すると、ダウンロードできる時間だけサーバーに保存されます。最大2時間後に完全に削除されます。コピーは保管せず、コンテンツを分析せず、第三者と共有することも一切ありません。"
    },
    {
      question: "どのファイル形式をサポートしていますか？",
      answer: "ほぼすべての必要な形式に対応しています！ドキュメント側では、PDF、Word（DOCおよびDOCX）、Excelスプレッドシート（XLS、XLSX）、PowerPointプレゼンテーション（PPT、PPTX）を扱えます。画像については、JPG、JPEG、PNG、WebP、GIFなどを扱います。スキャンしたレシートを検索可能なPDFに変換したり、メールで送信できるように大きなファイルを圧縮したり、複数のドキュメントをまとめたり、プレゼンテーションから画像を抽出したりする場合でも、ここにそのためのツールがあります。"
    },
    {
      question: "アカウントを作成する必要がありますか？",
      answer: "いいえ、全く必要ありません。登録、ログイン画面、パスワードリセット、受信トレイを埋める確認メールは一切ありません。できるだけシンプルに構築しました。サイトにアクセスし、ツールを選択し、ファイルをドロップすれば完了です。メールアドレス、電話番号、その他の個人情報は一切求めません。面倒な手続きやフォームへの入力なしに、すべての機能にフルアクセスできます。"
    },
    {
      question: "スマートフォンやタブレットで使用できますか？",
      answer: "もちろんです！サイト全体がどのデバイスでもシームレスに動作します。iPhone、Androidスマートフォン、iPad、Surfaceタブレット、MacBook、Windowsデスクトップのいずれでも、同じ高速でスムーズな体験が得られます。すべてがタッチスクリーンでも完璧に動作するように設計されているため、モバイルデバイスでボタンをタップしたりファイルをドラッグしたりするのが自然に感じられます。ダウンロードやインストールする別のアプリはありません。"
    }
  ] : locale === 'de' ? [
    {
      question: "Ist diese Website wirklich kostenlos?",
      answer: "Absolut! Alles hier ist für immer kostenlos. Es gibt keine Testphasen, keine Premium-Pläne und keine versteckten Gebühren. Wir sind der Meinung, dass PDF-Tools für jeden zugänglich sein sollten. Deshalb können Sie so viele Dateien zusammenführen, aufteilen, komprimieren und konvertieren, wie Sie möchten, ohne je einen Cent zu bezahlen. Wir finanzieren uns durch minimale Werbung, die Ihre Arbeit nicht unterbricht."
    },
    {
      question: "Wie sicher sind meine Dateien beim Hochladen?",
      answer: "Wir nehmen Ihre Privatsphäre sehr ernst. Wenn Sie eine Datei hochladen, wird sie sofort mit dem branchenüblichen 256-Bit-SSL-Schutz während der Übertragung verschlüsselt. Das bedeutet, dass niemand Ihre Dokumente abfangen oder einsehen kann, während sie verarbeitet werden. Sobald wir Ihre Datei konvertiert oder bearbeitet haben, verbleibt sie nur so lange auf unserem Server, bis Sie sie heruntergeladen haben. Nach maximal zwei Stunden wird sie dauerhaft gelöscht. Wir speichern keine Kopien, analysieren keine Inhalte und teilen nichts mit Dritten."
    },
    {
      question: "Welche Dateiformate werden unterstützt?",
      answer: "Wir haben für nahezu alles eine Lösung! Auf der Dokumentenseite können Sie mit PDFs, Word-Dateien (DOC und DOCX), Excel-Tabellen (XLS, XLSX) und PowerPoint-Präsentationen (PPT, PPTX) arbeiten. Für Bilder unterstützen wir JPG, JPEG, PNG, WebP, GIF und mehr. Ob Sie einen gescannten Beleg in ein durchsuchbares PDF umwandeln, eine große Datei für den E-Mail-Versand komprimieren oder mehrere Dokumente zusammenführen möchten – hier finden Sie das passende Tool."
    },
    {
      question: "Muss ich ein Konto erstellen?",
      answer: "Nein, überhaupt nicht. Keine Registrierung, keine Anmeldebildschirme, keine Passwort-Resets, keine Bestätigungs-E-Mails. Wir haben das so einfach wie möglich gestaltet: Sie besuchen die Seite, wählen ein Tool, laden Ihre Datei hoch – fertig. Wir fragen weder nach Ihrer E-Mail-Adresse noch nach Ihrer Telefonnummer oder anderen persönlichen Daten. Sie erhalten vollen Zugang zu allen Funktionen ohne lästige Formulare."
    },
    {
      question: "Kann ich die Website auf meinem Smartphone oder Tablet nutzen?",
      answer: "Natürlich! Die gesamte Website funktioniert nahtlos auf jedem Gerät. Ob iPhone, Android-Smartphone, iPad, Surface-Tablet, MacBook oder Windows-Desktop – Sie erhalten überall das gleiche schnelle und flüssige Erlebnis. Alles wurde für Touchscreens optimiert, sodass das Tippen auf Schaltflächen und das Ziehen von Dateien auf Mobilgeräten ganz natürlich wirkt. Es gibt keine separate App zum Herunterladen oder Installieren."
    }
  ] : locale === 'fr' ? [
    {
      question: "Ce site est-il vraiment gratuit ?",
      answer: "Absolument ! Tout ici est gratuit pour toujours. Pas de périodes d'essai, pas de plans premium, pas de frais cachés. Nous pensons que les outils PDF devraient être accessibles à tous. C'est pourquoi vous pouvez fusionner, diviser, compresser et convertir autant de fichiers que vous voulez sans jamais sortir votre portefeuille. Nous maintenons le service avec quelques publicités minimales qui n'interrompront pas votre travail."
    },
    {
      question: "Mes fichiers sont-ils sécurisés lors du téléchargement ?",
      answer: "Nous prenons votre vie privée très au sérieux. Lorsque vous téléchargez un fichier, il est immédiatement crypté avec une protection SSL 256 bits standard lors du transfert. Cela signifie que personne ne peut intercepter ou consulter vos documents pendant leur traitement. Une fois que nous avons terminé la conversion ou l'édition de votre fichier, il reste sur notre serveur juste le temps que vous le téléchargiez. Après deux heures maximum, il est définitivement supprimé."
    },
    {
      question: "Quels formats de fichiers sont pris en charge ?",
      answer: "Nous avons tout prévu ! Pour les documents, vous pouvez travailler avec des PDF, des fichiers Word (DOC et DOCX), des feuilles de calcul Excel (XLS, XLSX) et des présentations PowerPoint (PPT, PPTX). Pour les images, nous gérons JPG, JPEG, PNG, WebP, GIF et plus encore."
    },
    {
      question: "Dois-je créer un compte ?",
      answer: "Non, pas du tout. Pas d'inscription, pas d'écrans de connexion, pas de réinitialisations de mot de passe, pas d'e-mails de vérification. Nous avons construit cela pour être aussi simple que possible : vous arrivez, choisissez un outil, déposez votre fichier, et c'est parti. Nous ne demandons ni votre e-mail, ni votre numéro de téléphone, ni aucune autre information personnelle."
    },
    {
      question: "Puis-je l'utiliser sur mon téléphone ou ma tablette ?",
      answer: "Bien sûr ! L'ensemble du site fonctionne parfaitement sur n'importe quel appareil. Que vous soyez sur un iPhone, un téléphone Android, un iPad, une tablette Surface, un MacBook ou un bureau Windows, vous bénéficierez de la même expérience rapide et fluide. Tout est conçu pour fonctionner parfaitement avec les écrans tactiles."
    }
  ] : locale === 'es' ? [
    {
      question: "¿Es realmente gratuito este sitio?",
      answer: "¡Absolutamente! Todo aquí es gratuito para siempre. No hay períodos de prueba, planes premium ni cargos ocultos. Creemos que las herramientas PDF deben ser accesibles para todos. Por eso puedes fusionar, dividir, comprimir y convertir tantos archivos como quieras sin nunca llegar a tu cartera. Nos mantenemos con algunos anuncios mínimos que no interrumpirán tu trabajo."
    },
    {
      question: "¿Son seguros mis archivos cuando los subo?",
      answer: "Nos tomamos tu privacidad muy en serio. Cuando subes un archivo, se cifra inmediatamente con protección SSL de 256 bits estándar de la industria durante la transferencia. Una vez que terminamos de convertir o editar tu archivo, permanece en nuestro servidor solo el tiempo suficiente para que lo descargues. Después de dos horas como máximo, se elimina permanentemente."
    },
    {
      question: "¿Qué formatos de archivo son compatibles?",
      answer: "¡Te tenemos cubierto para casi todo lo que necesites! En el lado de los documentos, puedes trabajar con PDF, archivos Word (DOC y DOCX), hojas de cálculo Excel (XLS, XLSX) y presentaciones de PowerPoint (PPT, PPTX). Para imágenes, manejamos JPG, JPEG, PNG, WebP, GIF y más."
    },
    {
      question: "¿Necesito crear una cuenta?",
      answer: "No, para nada. Sin registro, sin pantallas de inicio de sesión, sin restablecimiento de contraseñas, sin correos de verificación. Lo construimos para ser lo más simple posible: llegas, eliges una herramienta, sueltas tu archivo y listo. No pedimos tu correo electrónico, número de teléfono ni ningún otro dato personal."
    },
    {
      question: "¿Puedo usarlo en mi teléfono o tableta?",
      answer: "¡Por supuesto! Todo el sitio funciona perfectamente en cualquier dispositivo. Ya sea un iPhone, teléfono Android, iPad, tableta Surface, MacBook o escritorio Windows, tendrás la misma experiencia rápida y fluida. Todo está diseñado para funcionar perfectamente con pantallas táctiles también."
    }
  ] : locale === 'it' ? [
    {
      question: "Il vostro sito è davvero gratuito?",
      answer: "Assolutamente sì! Tutto qui è gratuito per sempre. Non ci sono periodi di prova, piani premium o addebiti a sorpresa. Crediamo che gli strumenti PDF debbano essere accessibili a tutti. Ecco perché puoi unire, dividere, comprimere e convertire quanti file vuoi senza mai mettere mano al portafoglio. Manteniamo il sito attivo con qualche inserzione minimale, ma non interromperanno il tuo lavoro né ti bombarderanno di pop-up."
    },
    {
      question: "I miei file sono sicuri quando li carico?",
      answer: "Prendiamo la tua privacy molto sul serio. Quando carichi un file, viene immediatamente crittografato con la protezione SSL a 256 bit standard del settore durante il trasferimento. Ciò significa che nessuno può intercettare o spiare i tuoi documenti mentre vengono elaborati. Una volta completata la conversione, il file rimane sul nostro server solo il tempo necessario per scaricarlo. Dopo un massimo di due ore, viene eliminato definitivamente. Non conserviamo copie, non analizziamo il contenuto e non condividiamo nulla con terze parti."
    },
    {
      question: "Quali formati di file sono supportati?",
      answer: "Abbiamo tutto ciò di cui avrai bisogno! Sul lato documenti, puoi lavorare con PDF, file Word (DOC e DOCX), fogli di calcolo Excel (XLS, XLSX) e presentazioni PowerPoint (PPT, PPTX). Per le immagini, gestiamo JPG, JPEG, PNG, WebP, GIF e altro. Che tu voglia trasformare una ricevuta scansionata in un PDF ricercabile, comprimere un file enorme per inviarlo via e-mail, unire più documenti o estrarre immagini da una presentazione, c'è uno strumento qui che farà il lavoro."
    },
    {
      question: "Devo creare un account?",
      answer: "No, assolutamente no. Nessuna registrazione, nessuna schermata di accesso, nessun reset della password, nessuna e-mail di verifica che intasa la posta. Abbiamo costruito tutto per essere il più semplice possibile: arrivi, scegli uno strumento, trascini il file e sei pronto. Non chiederemo la tua e-mail, il numero di telefono o qualsiasi altro dato personale. Hai accesso completo a ogni singola funzione senza dover saltare ostacoli o compilare moduli."
    },
    {
      question: "Posso usarlo sul telefono o sul tablet?",
      answer: "Certo che sì! L'intero sito funziona perfettamente su qualsiasi dispositivo. Che tu abbia un iPhone, un telefono Android, un iPad, un tablet Surface, un MacBook o un desktop Windows, avrai la stessa esperienza veloce e fluida. Tutto è stato progettato per funzionare perfettamente anche con i touchscreen, quindi toccare pulsanti e trascinare file risulta naturale sui dispositivi mobili. Non c'è nessuna app separata da scaricare o installare."
    }
  ] : locale === 'id' ? [
    {
      question: "Apakah situs ini benar-benar gratis?",
      answer: "Tentu saja! Semua di sini gratis selamanya. Tidak ada masa percobaan, tidak ada paket premium, dan tidak ada biaya tersembunyi. Kami percaya bahwa alat PDF harus dapat diakses oleh semua orang. Itulah mengapa Anda dapat menggabungkan, memisahkan, mengompres, dan mengkonversi file sebanyak yang Anda inginkan tanpa harus mengeluarkan dompet. Kami mempertahankan layanan dengan beberapa iklan minimal yang tidak akan mengganggu pekerjaan Anda."
    },
    {
      question: "Apakah file saya aman saat diunggah?",
      answer: "Kami sangat serius soal privasi Anda. Saat Anda mengunggah file, file tersebut langsung dienkripsi dengan perlindungan SSL 256-bit standar industri selama transfer. Artinya tidak ada yang bisa mencegat atau mengintip dokumen Anda saat sedang diproses. Setelah kami selesai mengkonversi atau mengedit file Anda, file tersebut hanya ada di server kami selama cukup untuk Anda unduh. Setelah maksimal dua jam, file tersebut dihapus secara permanen. Kami tidak menyimpan salinan, tidak menganalisis konten, dan tidak membagikan apapun kepada pihak ketiga."
    },
    {
      question: "Format file apa yang didukung?",
      answer: "Kami siap untuk hampir semua yang Anda butuhkan! Untuk dokumen, Anda bisa bekerja dengan PDF, file Word (DOC dan DOCX), spreadsheet Excel (XLS, XLSX), dan presentasi PowerPoint (PPT, PPTX). Untuk gambar, kami menangani JPG, JPEG, PNG, WebP, GIF, dan lainnya. Baik Anda ingin mengubah struk scan menjadi PDF yang dapat dicari, mengompres file besar agar bisa dikirim lewat email, menggabungkan beberapa dokumen, atau mengekstrak gambar dari presentasi, ada alat di sini yang bisa melakukan pekerjaan itu."
    },
    {
      question: "Apakah saya perlu membuat akun?",
      answer: "Tidak, sama sekali tidak perlu. Tidak ada pendaftaran, tidak ada layar login, tidak ada reset kata sandi, tidak ada email verifikasi yang memenuhi kotak masuk. Kami membangun ini agar sesederhana mungkin: Anda datang, pilih alat, jatuhkan file Anda, dan selesai. Kami tidak akan meminta email, nomor telepon, atau informasi pribadi lainnya. Anda mendapatkan akses penuh ke setiap fitur tanpa harus melewati rintangan atau mengisi formulir."
    },
    {
      question: "Bisakah saya menggunakannya di ponsel atau tablet?",
      answer: "Tentu saja! Seluruh situs bekerja dengan mulus di perangkat apa pun. Baik Anda menggunakan iPhone, ponsel Android, iPad, tablet Surface, MacBook, atau desktop Windows, Anda akan mendapatkan pengalaman yang sama cepatnya. Semuanya dirancang untuk bekerja sempurna dengan layar sentuh juga, jadi mengetuk tombol dan menyeret file terasa alami di perangkat mobile. Tidak ada aplikasi terpisah yang perlu diunduh atau diinstal."
    }
  ] : locale === 'pt' ? [
    {
      question: "Este site é realmente gratuito?",
      answer: "Com certeza! Tudo aqui é gratuito para sempre. Sem períodos de teste, sem planos premium, sem cobranças surpresa. Acreditamos que ferramentas PDF devem ser acessíveis a todos. Por isso, você pode mesclar, dividir, comprimir e converter quantos arquivos quiser sem nunca precisar pagar nada. Nos mantemos com alguns anúncios mínimos que não vão interromper seu trabalho."
    },
    {
      question: "Meus arquivos ficam seguros quando os envio?",
      answer: "Levamos sua privacidade muito a sério. Quando você faz upload de um arquivo, ele é imediatamente criptografado com proteção SSL de 256 bits padrão do setor durante a transferência. Isso significa que ninguém pode interceptar ou espiar seus documentos enquanto eles estão sendo processados. Após concluirmos a conversão ou edição do seu arquivo, ele fica em nosso servidor apenas pelo tempo suficiente para você baixá-lo. Após no máximo duas horas, ele é excluído permanentemente. Não guardamos cópias, não analisamos o conteúdo e não compartilhamos nada com terceiros."
    },
    {
      question: "Quais formatos de arquivo são suportados?",
      answer: "Temos tudo que você vai precisar! Para documentos, você pode trabalhar com PDFs, arquivos Word (DOC e DOCX), planilhas Excel (XLS, XLSX) e apresentações PowerPoint (PPT, PPTX). Para imagens, trabalhamos com JPG, JPEG, PNG, WebP, GIF e mais. Seja para transformar um recibo digitalizado em um PDF pesquisável, comprimir um arquivo enorme para enviar por e-mail, unir vários documentos ou extrair imagens de uma apresentação, há uma ferramenta aqui que fará o trabalho."
    },
    {
      question: "Preciso criar uma conta?",
      answer: "Não, de jeito nenhum. Sem cadastro, sem telas de login, sem redefinição de senha, sem e-mails de verificação lotando sua caixa de entrada. Construímos isso para ser o mais simples possível: você chega, escolhe uma ferramenta, joga o arquivo lá e pronto. Não pedimos seu e-mail, número de telefone ou qualquer outro dado pessoal. Você tem acesso total a todos os recursos sem precisar pular obstáculos ou preencher formulários."
    },
    {
      question: "Posso usar no meu celular ou tablet?",
      answer: "Claro que sim! O site inteiro funciona perfeitamente em qualquer dispositivo. Seja no iPhone, Android, iPad, tablet Surface, MacBook ou computador Windows, você terá a mesma experiência rápida e fluida. Tudo foi projetado para funcionar perfeitamente com telas touch também, então tocar nos botões e arrastar arquivos parece natural em dispositivos móveis. Não há nenhum aplicativo separado para baixar ou instalar."
    }
  ] : [
    {
      question: "Is your website really free to use?",
      answer: "Absolutely! Everything here is free forever. There are no trial periods, premium plans, or surprise charges lurking around the corner. We believe PDF tools should be accessible to everyone. That's why you can merge, split, compress, and convert as many files as you want without ever reaching for your wallet. We keep the lights on with some minimal ads, but they won't interrupt your work or bombard you with pop-ups."
    },
    {
      question: "How secure are my files when I upload them?",
      answer: "We take your privacy seriously. When you upload a file, it's immediately encrypted with industry-standard 256-bit SSL protection during transfer. This means nobody can intercept or peek at your documents while they're being processed. Once we finish converting or editing your file, it sits on our server just long enough for you to download it. After two hours maximum, it's permanently deleted. We don't keep copies, we don't analyze content, and we definitely don't share anything with third parties. Your files are yours alone."
    },
    {
      question: "What file formats does this support?",
      answer: "We've got you covered for pretty much everything you'll need! On the document side, you can work with PDFs, Word files (both DOC and DOCX), Excel spreadsheets (XLS, XLSX), and PowerPoint presentations (PPT, PPTX). For images, we handle JPG, JPEG, PNG, WebP, GIF, and more. Whether you're trying to turn a scanned receipt into a searchable PDF, compress a massive file so you can email it, stitch together multiple documents, or pull images out of a presentation, there's a tool here that'll do the job."
    },
    {
      question: "Do I need to create an account?",
      answer: "Nope, not at all. No registration, no login screens, no password resets, no verification emails cluttering your inbox. We built this to be as simple as possible: you show up, pick a tool, drop in your file, and you're off to the races. We won't ask for your email, phone number, or any other personal details. You get full access to every single feature without jumping through hoops or filling out forms. It's honestly the way web tools should work."
    },
    {
      question: "Can I use this on my phone or tablet?",
      answer: "You bet! The entire site works seamlessly on any device you throw at it. Whether you're on an iPhone, Android phone, iPad, Surface tablet, MacBook, or Windows desktop, you'll get the same fast, smooth experience. Everything's been designed to work perfectly with touchscreens too, so tapping buttons and dragging files feels natural on mobile devices. There's no separate app to download or install. Just open your browser, visit the site, and start working. It's that straightforward."
    }
  ]

  const premFeatures = locale === 'ja' ? ["無制限のファイルサイズとバッチ処理","スキャンしたドキュメント用の高度なOCR","デスクトップおよびモバイルアプリが含まれます"] : locale === 'de' ? ["Unbegrenzte Dateigröße und Stapelverarbeitung","Erweitertes OCR für gescannte Dokumente","Desktop- und Mobile-Apps inklusive"] : locale === 'fr' ? ["Taille illimitée et traitement par lots","OCR avancé pour documents numérisés","Applications bureau et mobile incluses"] : locale === 'es' ? ["Tamaño ilimitado y procesamiento por lotes","OCR avanzado para documentos escaneados","Apps de escritorio y móvil incluidas"] : locale === 'it' ? ["Dimensione illimitata ed elaborazione batch","OCR avanzato per documenti scansionati","App desktop e mobile incluse"] : locale === 'id' ? ["Ukuran file tak terbatas dan pemrosesan batch","OCR canggih untuk dokumen yang dipindai","Aplikasi desktop dan mobile termasuk"] : locale === 'pt' ? ["Tamanho ilimitado e processamento em lote","OCR avançado para documentos digitalizados","Apps para desktop e mobile incluídos"] : ["Unlimited file size and batch processing","Advanced OCR for scanned documents","Desktop and mobile apps included"]

  const premIncludes = locale === 'ja' ? ["無制限の変換","ファイルサイズ制限なし","バッチ処理","広告なしの体験","優先サポート"] : locale === 'de' ? ["Unbegrenzte Konvertierungen","Keine Dateigrößenbeschränkungen","Stapelverarbeitung","Werbefreies Erlebnis","Vorrangiger Support"] : locale === 'fr' ? ["Conversions illimitées","Aucune limite de taille","Traitement par lots","Sans publicité","Support prioritaire"] : locale === 'es' ? ["Conversiones ilimitadas","Sin límites de tamaño","Procesamiento por lotes","Sin anuncios","Soporte prioritario"] : locale === 'it' ? ["Conversioni illimitate","Nessun limite dimensione","Elaborazione batch","Senza pubblicità","Supporto prioritario"] : locale === 'id' ? ["Konversi tak terbatas","Tanpa batasan ukuran","Pemrosesan batch","Bebas iklan","Dukungan prioritas"] : locale === 'pt' ? ["Conversões ilimitadas","Sem limites de tamanho","Processamento em lote","Sem anúncios","Suporte prioritário"] : ["Unlimited conversions","No file size limits","Batch processing","Ad-free experience","Priority support"]

  return (
    <>
      <SEOHead title={t('seo.home.title')} description={t('seo.home.description')} keywords={t('seo.home.keywords')} />
      <Layout>
        {/* ══ HERO ══ */}
        <section className="relative overflow-hidden" style={{ fontFamily: "'Sora','Instrument Sans',system-ui,sans-serif" }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="orb1 absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-100/60 via-cyan-50/40 to-transparent blur-3xl" />
            <div className="orb2 absolute top-20 -right-20 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-sky-100/50 via-indigo-50/30 to-transparent blur-3xl" />
            <div className="orb3 absolute -bottom-20 left-1/3 w-[350px] h-[350px] rounded-full bg-gradient-to-br from-teal-50/40 via-emerald-50/20 to-transparent blur-3xl" />
          </div>
          <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage:'radial-gradient(circle at 1px 1px,#000 1px,transparent 0)', backgroundSize:'32px 32px' }} />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-12 md:pt-20 md:pb-16">
            <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-10 lg:gap-16 items-center">
              <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6 bg-gray-950 text-white shadow-lg">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[11px] font-semibold tracking-wide">{L(locale, { ja: '世界中で1億人以上の満足したユーザー', de: '50M+ Nutzer weltweit', fr: '50M+ utilisateurs dans le monde', es: '50M+ usuarios en todo el mundo', en: '50M+ Happy Users Worldwide', it: '50M+ utenti nel mondo', id: '100 Juta+ Pengguna di Dunia', pt: '50M+ Usuários no Mundo' })}</span>
                </div>
                <h1 className="text-[2.5rem] sm:text-5xl md:text-[3.5rem] font-extrabold text-gray-950 mb-5 leading-[1.08] tracking-tight">
                  {L(locale, { ja: 'プロフェッショナルなPDFツール', de: 'Professionelle PDF-Tools', fr: 'Outils PDF professionnels', es: 'Herramientas PDF profesionales', en: 'Professional PDF tools', it: 'Strumenti PDF professionali', id: 'Alat PDF profesional', pt: 'Ferramentas PDF profissionais' })}
                  <span className="block mt-1 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
                    {L(locale, { ja: '永久に100%無料', de: '100% kostenlos für immer', fr: '100% gratuit pour toujours', es: '100% gratis para siempre', en: '100% free forever', it: '100% gratuiti per sempre', id: '100% gratis selamanya', pt: '100% gratuito para sempre' })}
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-gray-600 mb-5 leading-relaxed max-w-lg" style={{ fontFamily:"'Instrument Sans',system-ui,sans-serif" }}>
                  {L(locale, { ja: 'PDFを数秒で変換、圧縮、結合、編集。', de: 'PDFs in Sekunden konvertieren, komprimieren, zusammenführen & bearbeiten.', fr: 'Convertissez, compressez, fusionnez et modifiez vos PDF en secondes.', es: 'Convierte, comprime, combina y edita tus PDF en segundos.', en: 'Convert, compress, merge & edit PDFs in seconds.', it: 'Converti, comprimi, unisci e modifica i tuoi PDF in pochi secondi.', id: 'Konversi, kompres, gabung & edit PDF dalam hitungan detik.', pt: 'Converta, comprima, mescle e edite PDFs em segundos.' })}
                  <span className="block mt-1.5 text-gray-900 font-semibold">
                    {L(locale, { ja: '登録不要。制限なし。', de: 'Keine Anmeldung. Keine Limits.', fr: 'Sans inscription. Sans limites.', es: 'Sin registro. Sin límites.', en: 'No signup. No limits.', it: 'Senza registrazione. Senza limiti.', id: 'Tanpa daftar. Tanpa batas.', pt: 'Sem cadastro. Sem limites.' })}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {[
                    { icon: Shield, text: L(locale, { ja: '銀行レベルの暗号化', de: 'Banktaugliche Verschlüsselung', fr: 'Cryptage bancaire', es: 'Cifrado bancario', en: 'Bank-grade encryption', it: 'Crittografia bancaria', id: 'Enkripsi level bank', pt: 'Criptografia bancária' }) },
                    { icon: Zap, text: L(locale, { ja: '超高速', de: 'Blitzschnell', fr: 'Ultra rapide', es: 'Ultra rápido', en: 'Lightning fast', it: 'Velocissimo', id: 'Sangat cepat', pt: 'Extremamente rápido' }) },
                    { icon: Clock, text: L(locale, { ja: '2時間で自動削除', de: 'Auto-Löschung 2 Std.', fr: 'Suppression auto 2h', es: 'Eliminación auto 2h', en: 'Auto-delete in 2hrs', it: 'Eliminazione auto 2h', id: 'Hapus otomatis 2 jam', pt: 'Exclusão auto 2h' }) }
                  ].map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-gray-200/60 text-xs font-medium text-gray-700">
                      <p.icon className="w-3.5 h-3.5 text-gray-500" /><span>{p.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <Link href="#tools" className="group inline-flex items-center gap-2 bg-gray-950 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-gray-800 transition-all text-sm shadow-lg shadow-gray-950/20">
                    <span>{L(locale, { ja: '無料で始める', de: 'Kostenlos starten', fr: 'Commencer gratuitement', es: 'Empezar gratis', en: 'Start For Free', it: 'Inizia gratis', id: 'Mulai Gratis', pt: 'Comece Grátis' })}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <Link href="#tools" className="inline-flex items-center gap-2 text-gray-700 font-semibold px-5 py-3.5 rounded-xl hover:bg-gray-100 transition-all text-sm group">
                    <span>{L(locale, { ja: 'すべてのツール', de: 'Alle Tools', fr: 'Tous les outils', es: 'Todas las herramientas', en: 'View All Tools', it: 'Tutti gli strumenti', id: 'Semua Alat', pt: 'Todas as Ferramentas' })}</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
                <div className="flex items-center gap-8 pt-6 border-t border-gray-200/60">
                  {[
                    { value:"30M+", label: L(locale, { ja:'ファイル', de:'Dateien', fr:'Fichiers', es:'Archivos', en:'Files', it:'File', id:'File', pt:'Arquivos' }) },
                    { value:"50M+", label: L(locale, { ja:'ユーザー', de:'Nutzer', fr:'Utilisateurs', es:'Usuarios', en:'Users', it:'Utenti', id:'Pengguna', pt:'Usuários' }) },
                    { value:"4.6", label: L(locale, { ja:'評価', de:'Bewertung', fr:'Évaluation', es:'Calificación', en:'Rating', it:'Valutazione', id:'Penilaian', pt:'Avaliação' }) }
                  ].map((s,i)=>(
                    <div key={i}><div className="text-xl font-extrabold text-gray-950 leading-none tracking-tight">{s.value}</div><div className="text-[10px] font-medium text-gray-500 mt-1 uppercase tracking-wider">{s.label}</div></div>
                  ))}
                </div>
              </div>

              {/* Hero Visual */}
              <div className={`hidden lg:flex items-center justify-center transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                <div className="relative w-full max-w-md">
                  <div className="relative bg-white rounded-3xl shadow-2xl shadow-gray-200/60 border border-gray-100 p-7 mx-auto" style={{ animation:'float 6s ease-in-out infinite' }}>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" />
                      <div className="flex-1" /><div className="px-3 py-1 rounded-md bg-gray-50 text-[10px] font-semibold text-gray-500">smallpdf.us</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-sky-400 rounded-2xl p-5 mb-4 relative overflow-hidden">
                      <div className="absolute top-3 right-3 px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold text-white">PDF</div>
                      <div className="space-y-2.5">
                        <div className="h-3 bg-white/90 rounded-full w-3/4" /><div className="h-2 bg-white/60 rounded-full w-full" /><div className="h-2 bg-white/60 rounded-full w-5/6" /><div className="h-2 bg-white/60 rounded-full w-4/6" /><div className="mt-4 h-20 bg-white/25 rounded-xl" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {[{l:L(locale,{ja:'変換',de:'Konvertieren',fr:'Convertir',es:'Convertir',en:'Convert',it:'Converti',id:'Konversi',pt:'Converter'}),c:'bg-blue-500'},{l:L(locale,{ja:'圧縮',de:'Komprimieren',fr:'Compresser',es:'Comprimir',en:'Compress',it:'Comprimi',id:'Kompres',pt:'Comprimir'}),c:'bg-cyan-500'},{l:L(locale,{ja:'結合',de:'Zusammenführen',fr:'Fusionner',es:'Combinar',en:'Merge',it:'Unisci',id:'Gabung',pt:'Mesclar'}),c:'bg-emerald-500'}].map((a,i)=>(
                        <div key={i} className={`flex-1 ${a.c} rounded-lg py-2 text-center text-[11px] font-semibold text-white shadow-sm`}>{a.l}</div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-2" style={{ animation:'float 4s ease-in-out infinite',animationDelay:'1s' }}>
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div>
                    <span className="text-xs font-semibold text-gray-800">{L(locale,{ja:'変換完了',de:'Konvertiert',fr:'Converti',es:'Convertido',en:'Converted',it:'Convertito',id:'Terkonversi',pt:'Convertido'})}</span>
                  </div>
                  <div className="absolute -bottom-3 -left-6 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-2" style={{ animation:'float 5s ease-in-out infinite',animationDelay:'2s' }}>
                    <Shield className="w-4 h-4 text-green-600" /><span className="text-xs font-semibold text-gray-800">SSL 256-bit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ TOOLS ══ */}
        <section id="tools" className="relative py-14 md:py-16 px-4">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-50/80 to-white" /><div className="absolute inset-0 dot-grid opacity-30" />
          <div className="relative max-w-6xl mx-auto">
            <Reveal><div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mb-2 tracking-tight">{L(locale, { ja:'すべてのPDFツール', de:'Alle PDF-Tools', fr:'Tous les outils PDF', es:'Todas las herramientas PDF', en:'All PDF Tools', it:'Tutti gli strumenti PDF', id:'Semua Alat PDF', pt:'Todas as Ferramentas PDF' })}</h2>
              <p className="text-sm sm:text-base text-gray-500 max-w-lg mx-auto">{L(locale, { ja:'PDFファイルの作業に必要なすべて', de:'Alles für die Arbeit mit PDFs', fr:'Tout pour vos PDF, entièrement gratuit', es:'Todo para trabajar con PDF, gratis', en:'Everything you need to work with PDF files, completely free forever', it:'Tutto per lavorare con i PDF, gratis per sempre', id:'Semua untuk bekerja dengan file PDF, gratis', pt:'Tudo para trabalhar com PDFs, gratuito para sempre' })}</p>
            </div></Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {tools.map((tool, i) => <ToolCard key={tool.name} tool={tool} index={i} locale={locale} />)}
            </div>
          </div>
        </section>

        <div className="section-line max-w-5xl mx-auto" />

        {/* ══ FILE FORMATS ══ */}
        <section className="relative py-14 md:py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <Reveal><div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mb-2 tracking-tight">{L(locale, { ja:'あらゆるファイル形式に対応', de:'Mit jedem Format arbeiten', fr:'Tous les formats', es:'Cualquier formato', en:'Work With Any File Format', it:'Qualsiasi formato', id:'Format File Apa Pun', pt:'Qualquer Formato' })}</h2>
              <p className="text-sm sm:text-base text-gray-500 max-w-lg mx-auto">{L(locale, { ja:'主要な形式間でシームレスに変換', de:'Nahtlos konvertieren', fr:'Convertissez entre tous les formats', es:'Convierte entre todos los formatos', en:'Seamlessly convert between all major document and image formats', it:'Converti tra tutti i formati', id:'Konversi mulus antar format', pt:'Converta entre todos os formatos' })}</p>
            </div></Reveal>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { name:"PDF", formats:"PDF, PDF/A", icon:FileText, color:"from-red-500 to-rose-600" },
                { name:"Word", formats:"DOC, DOCX", icon:FileText, color:"from-blue-500 to-blue-600" },
                { name:"Excel", formats:"XLS, XLSX", icon:Table, color:"from-green-500 to-green-600" },
                { name:"PowerPoint", formats:"PPT, PPTX", icon:Presentation, color:"from-orange-500 to-amber-600" },
                { name:L(locale,{ja:'画像',de:'Bilder',fr:'Images',es:'Imágenes',en:'Images',it:'Immagini',id:'Gambar',pt:'Imagens'}), formats:"JPG, PNG, WebP", icon:FileImage, color:"from-purple-500 to-violet-600" },
                { name:L(locale,{ja:'その他',de:'Weitere',fr:'Autres',es:'Más',en:'More',it:'Altri',id:'Lainnya',pt:'Mais'}), formats:"GIF, BMP, TIFF", icon:FileImage, color:"from-gray-500 to-gray-600" }
              ].map((f, i) => (
                <Reveal key={i} delay={i*60}><div className="bg-white rounded-2xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group text-center">
                  <div className={`w-11 h-11 mx-auto bg-gradient-to-br ${f.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm`}><f.icon className="w-5 h-5 text-white" /></div>
                  <h3 className="font-semibold text-sm text-gray-900 mb-0.5">{f.name}</h3><p className="text-[11px] text-gray-500">{f.formats}</p>
                </div></Reveal>
              ))}
            </div>
          </div>
        </section>

        <div className="section-line max-w-5xl mx-auto" />

        {/* ══ HOW IT WORKS ══ */}
        <section className="relative py-14 md:py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <Reveal><div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mb-2 tracking-tight">{L(locale, { ja:'シンプルな3ステップ', de:'Einfach wie 1-2-3', fr:'Simple comme 1-2-3', es:'Simple como 1-2-3', en:'Simple as 1-2-3', it:'Semplice come 1-2-3', id:'Semudah 1-2-3', pt:'Simples como 1-2-3' })}</h2>
              <p className="text-sm sm:text-base text-gray-500">{L(locale, { ja: '複雑な手順は不要。アップロード、処理、ダウンロード。', de: 'Keine komplizierten Schritte. Einfach hochladen, verarbeiten und herunterladen.', fr: "Pas d\'étapes compliquées. Téléchargez, traitez et téléchargez.", es: 'Sin pasos complicados. Solo sube, procesa y descarga.', en: 'No complicated steps. Just upload, process, and download.', it: 'Nessun passaggio complicato. Carica, elabora e scarica.', id: 'Tidak ada langkah rumit. Cukup unggah, proses, dan unduh.', pt: 'Sem passos complicados. Basta enviar, processar e baixar.' })}</p>
            </div></Reveal>
            <div className="relative">
              <div className="hidden md:block absolute top-7 left-[16.66%] right-[16.66%] h-[2px] bg-gradient-to-r from-blue-200 via-cyan-200 to-emerald-200 z-0" />
              <div className="grid md:grid-cols-3 gap-5">
              {[
                { num: "01", Icon: Upload, title: L(locale, { ja: 'ファイルをアップロード', de: 'Datei hochladen', fr: 'Télécharger votre fichier', es: 'Subir tu archivo', en: 'Upload Your File', it: 'Carica il tuo file', id: 'Unggah File Anda', pt: 'Envie Seu Arquivo' }), desc: L(locale, { ja: 'デバイスから任意のドキュメントを選択', de: 'Beliebiges Dokument von Ihrem Gerät auswählen', fr: "Sélectionnez n'importe quel document depuis votre appareil", es: 'Selecciona cualquier documento desde tu dispositivo', en: 'Select any document from your device', it: 'Seleziona qualsiasi documento dal tuo dispositivo', id: 'Pilih dokumen apa pun dari perangkat Anda', pt: 'Selecione qualquer documento do seu dispositivo' }), color: "text-blue-500", gradient: "from-blue-500 to-cyan-500" },
                { num: "02", Icon: Zap, title: L(locale, { ja: '即座に処理', de: 'Sofortige Verarbeitung', fr: 'Traitement instantané', es: 'Procesamiento instantáneo', en: 'Instant Processing', it: 'Elaborazione istantanea', id: 'Pemrosesan Instan', pt: 'Processamento Instantâneo' }), desc: L(locale, { ja: 'サーバーが魔法をかけます', de: 'Unsere Server erledigen die Arbeit', fr: 'Nos serveurs font leur magie', es: 'Nuestros servidores hacen su magia', en: 'Our servers work their magic', it: 'I nostri server fanno la loro magia', id: 'Server kami bekerja dengan cepat', pt: 'Nossos servidores fazem a mágica' }), color: "text-cyan-500", gradient: "from-cyan-500 to-blue-500" },
                { num: "03", Icon: Download, title: L(locale, { ja: '結果をダウンロード', de: 'Ergebnis herunterladen', fr: 'Télécharger le résultat', es: 'Descargar el resultado', en: 'Download Result', it: 'Scarica il risultato', id: 'Unduh Hasil', pt: 'Baixar Resultado' }), desc: L(locale, { ja: '変換されたファイルをすぐに取得', de: 'Konvertierte Datei sofort erhalten', fr: 'Obtenez votre fichier converti immédiatement', es: 'Obtén tu archivo convertido inmediatamente', en: 'Get your converted file immediately', it: 'Ottieni il tuo file convertito immediatamente', id: 'Dapatkan file yang dikonversi segera', pt: 'Obtenha seu arquivo convertido imediatamente' }), color: "text-emerald-500", gradient: "from-green-500 to-emerald-500" },
              ].map((step,i)=>(
                <Reveal key={i} delay={i*100}>
                  <div className="group text-center relative z-10">
                    <div className={`w-14 h-14 mx-auto mb-5 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300 relative ring-4 ring-white`}>
                      <step.Icon className="w-7 h-7 text-white" />
                      <div className={`absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br ${step.gradient} rounded-full flex items-center justify-center text-white font-extrabold text-xs shadow-md border-2 border-white`}>{step.num}</div>
                    </div>
                    <h3 className="text-base font-bold text-gray-950 mb-1.5">{step.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
              </div>
            </div>
          </div>
        </section>

        <div className="section-line max-w-5xl mx-auto" />

        {/* ══ WHY SMALLPDF ══ */}
        <section className="relative py-14 md:py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <Reveal><div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mb-2 tracking-tight">{L(locale, { ja: 'なぜSmallPDF.us？', de: 'Warum SmallPDF.us?', fr: 'Pourquoi SmallPDF.us ?', es: '¿Por qué SmallPDF.us?', en: 'Why SmallPDF.us?', it: 'Perché SmallPDF.us?', id: 'Mengapa SmallPDF.us?', pt: 'Por que SmallPDF.us?' })}</h2>
              <p className="text-sm sm:text-base text-gray-500">{L(locale, { ja: 'エンタープライズ機能、完全無料。妥協なし。', de: 'Enterprise-Funktionen, komplett kostenlos. Keine Kompromisse.', fr: 'Fonctionnalités entreprise, entièrement gratuit. Aucun compromis.', es: 'Funciones empresariales, completamente gratis. Sin compromisos.', en: 'Enterprise features, completely free. No compromises.', it: 'Funzionalità enterprise, completamente gratuito. Nessun compromesso.', id: 'Fitur enterprise, sepenuhnya gratis. Tanpa kompromi.', pt: 'Recursos empresariais, completamente gratuito. Sem compromissos.' })}</p>
            </div></Reveal>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: Shield, title: L(locale, { ja: '銀行レベルのセキュリティ', de: 'Banktaugliche Sicherheit', fr: 'Sécurité niveau bancaire', es: 'Seguridad de nivel bancario', en: 'Bank-Level Security', it: 'Sicurezza di livello bancario', id: 'Keamanan Level Bank', pt: 'Segurança de Nível Bancário' }), desc: L(locale, { ja: '256ビット暗号化。ファイルは処理後に自動削除。', de: '256-Bit-Verschlüsselung. Dateien werden nach der Verarbeitung automatisch gelöscht.', fr: 'Cryptage 256 bits. Fichiers supprimés automatiquement après traitement.', es: 'Cifrado de 256 bits. Los archivos se eliminan automáticamente después del procesamiento.', en: '256-bit encryption. Files auto-delete after processing.', it: "Crittografia a 256 bit. I file vengono eliminati automaticamente dopo l'elaborazione.", id: 'Enkripsi 256-bit. File dihapus otomatis setelah diproses.', pt: 'Criptografia de 256 bits. Os arquivos são excluídos automaticamente após o processamento.' }), gradient: "from-emerald-500 to-green-600", bg: "from-emerald-50 to-green-50" },
                { icon: Zap, title: L(locale, { ja: '超高速', de: 'Blitzschnell', fr: 'Ultra rapide', es: 'Ultra rápido', en: 'Lightning Fast', it: 'Velocissimo', id: 'Sangat Cepat', pt: 'Extremamente Rápido' }), desc: L(locale, { ja: '最適化されたサーバーで数秒でファイルを処理。', de: 'Dateien in Sekunden mit optimierten Servern verarbeiten.', fr: 'Traitement des fichiers en quelques secondes avec des serveurs optimisés.', es: 'Procesa archivos en segundos con servidores optimizados.', en: 'Process files in seconds with optimized servers.', it: 'Elabora i file in pochi secondi con server ottimizzati.', id: 'Proses file dalam hitungan detik dengan server yang dioptimalkan.', pt: 'Processe arquivos em segundos com servidores otimizados.' }), gradient: "from-amber-500 to-orange-500", bg: "from-amber-50 to-yellow-50" },
                { icon: Award, title: L(locale, { ja: '常に無料', de: 'Immer kostenlos', fr: 'Toujours gratuit', es: 'Siempre gratis', en: 'Always Free', it: 'Sempre gratuito', id: 'Selalu Gratis', pt: 'Sempre Gratuito' }), desc: L(locale, { ja: '隠れた費用なし。登録不要。制限なし。', de: 'Keine versteckten Kosten. Keine Anmeldung. Keine Limits.', fr: 'Aucuns frais cachés. Sans inscription. Sans limites.', es: 'Sin tarifas ocultas. Sin registro. Sin límites.', en: 'No hidden fees. No signup. No limits.', it: 'Nessun costo nascosto. Senza registrazione. Senza limiti.', id: 'Tidak ada biaya tersembunyi. Tanpa daftar. Tanpa batas.', pt: 'Sem taxas ocultas. Sem cadastro. Sem limites.' }), gradient: "from-blue-500 to-sky-500", bg: "from-blue-50 to-sky-50" },
              ].map((f, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div className={`group bg-gradient-to-br ${f.bg} rounded-2xl p-6 border border-gray-100/60 hover:shadow-lg hover:border-gray-200 transition-all duration-300 h-full`}>
                    <div className={`w-12 h-12 bg-gradient-to-br ${f.gradient} rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all`}>
                      <f.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-base font-bold text-gray-950 mb-2">{f.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <div className="section-line max-w-5xl mx-auto" />

        {/* ══ SECURITY ══ */}
        <section className="relative py-14 md:py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <Reveal><div className="bg-gradient-to-br from-emerald-50 via-green-50/80 to-teal-50/50 rounded-3xl p-10 flex items-center justify-center border border-emerald-100/50 relative overflow-hidden min-h-[320px]">
                <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'radial-gradient(circle at 1px 1px,#059669 1px,transparent 0)',backgroundSize:'20px 20px'}} />
                <div className="relative">
                  <div className="w-44 h-44 mx-auto relative">
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-200/60 animate-ping opacity-20" />
                    <div className="absolute inset-4 rounded-full border-2 border-emerald-300/50 animate-ping opacity-15" style={{animationDelay:'0.5s'}} />
                    <div className="absolute inset-8 rounded-full border border-emerald-200/30 animate-ping opacity-10" style={{animationDelay:'1s'}} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl rotate-45 flex items-center justify-center shadow-xl shadow-emerald-500/25">
                        <Lock className="w-10 h-10 text-white -rotate-45" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-6 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-1.5" style={{animation:'float 4s ease-in-out infinite'}}>
                    <Shield className="w-3.5 h-3.5 text-emerald-600" /><span className="text-[11px] font-bold text-gray-700">SSL 256-bit</span>
                  </div>
                  <div className="absolute -bottom-1 -left-4 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-1.5" style={{animation:'float 5s ease-in-out infinite',animationDelay:'1s'}}>
                    <Check className="w-3.5 h-3.5 text-emerald-600" /><span className="text-[11px] font-bold text-gray-700">GDPR</span>
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 -right-10 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 flex items-center gap-1.5" style={{animation:'float 6s ease-in-out infinite',animationDelay:'2s'}}>
                    <Clock className="w-3.5 h-3.5 text-blue-500" /><span className="text-[11px] font-bold text-gray-700">2H</span>
                  </div>
                </div>
              </div></Reveal>
              <Reveal delay={120}><div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mb-3 tracking-tight">{L(locale, { ja: 'プライバシーは私たちの最優先事項', de: 'Ihre Privatsphäre hat oberste Priorität', fr: 'Votre confidentialité est notre priorité', es: 'Tu privacidad es nuestra prioridad', en: 'Your Privacy is Our Priority', it: 'La tua privacy è la nostra priorità', id: 'Privasi Anda adalah Prioritas Kami', pt: 'Sua Privacidade é Nossa Prioridade' })}</h2>
                <p className="text-sm sm:text-base text-gray-500 mb-6 leading-relaxed">{L(locale, { ja: 'セキュリティを真剣に考えています。すべてのファイルは、アップロードから削除まで、エンタープライズグレードの暗号化で保護されます。', de: 'Wir nehmen Sicherheit ernst. Jede Datei wird mit unternehmenstauglicher Verschlüsselung vom Upload bis zur Löschung geschützt.', fr: 'Nous prenons la sécurité au sérieux. Chaque fichier est protégé par un cryptage de niveau entreprise du téléchargement à la suppression.', es: 'Nos tomamos la seguridad en serio. Cada archivo está protegido con cifrado de nivel empresarial desde la carga hasta la eliminación.', en: 'We take security seriously. Every file is protected with enterprise-grade encryption from upload to deletion.', it: "Prendiamo la sicurezza sul serio. Ogni file è protetto con crittografia di livello enterprise dal caricamento all'eliminazione.", id: 'Kami serius soal keamanan. Setiap file dilindungi dengan enkripsi tingkat enterprise dari unggahan hingga penghapusan.', pt: 'Levamos a segurança a sério. Cada arquivo é protegido com criptografia de nível empresarial do upload à exclusão.' })}</p>
                <div className="space-y-3">
                  {[
                    { icon: Shield, title: L(locale, { ja: '256ビットSSL暗号化', de: '256-Bit-SSL-Verschlüsselung', fr: 'Chiffrement SSL 256 bits', es: 'Cifrado SSL de 256 bits', en: '256-bit SSL Encryption', it: 'Crittografia SSL a 256 bit', id: 'Enkripsi SSL 256-bit', pt: 'Criptografia SSL de 256 bits' }), desc: L(locale, { ja: '軍事レベルの暗号化が転送中のファイルを保護', de: 'Militärtaugliche Verschlüsselung schützt Ihre Dateien bei der Übertragung', fr: 'Le chiffrement de niveau militaire protège vos fichiers pendant le transfert', es: 'El cifrado de nivel militar protege sus archivos durante la transferencia', en: 'Military-grade encryption protects your files during transfer', it: 'La crittografia di livello militare protegge i tuoi file durante il trasferimento', id: 'Enkripsi tingkat militer melindungi file Anda saat transfer', pt: 'Criptografia de nível militar protege seus arquivos durante a transferência' }), color: 'from-green-500 to-emerald-600' },
                    { icon: Clock, title: L(locale, { ja: '2時間で自動削除', de: 'Auto-Löschung nach 2 Stunden', fr: 'Suppression automatique en 2 heures', es: 'Eliminación automática en 2 horas', en: 'Auto-Delete in 2 Hours', it: 'Eliminazione automatica in 2 ore', id: 'Hapus Otomatis dalam 2 Jam', pt: 'Exclusão Automática em 2 Horas' }), desc: L(locale, { ja: 'ファイルはサーバーから自動的に完全に削除されます', de: 'Dateien werden automatisch dauerhaft von unseren Servern gelöscht', fr: 'Les fichiers sont définitivement supprimés de nos serveurs automatiquement', es: 'Los archivos se eliminan permanentemente de nuestros servidores automáticamente', en: 'Files are permanently removed from our servers automatically', it: 'I file vengono rimossi definitivamente dai nostri server automaticamente', id: 'File dihapus secara permanen dari server kami secara otomatis', pt: 'Os arquivos são removidos permanentemente de nossos servidores automaticamente' }), color: 'from-blue-500 to-sky-600' },
                    { icon: Lock, title: L(locale, { ja: 'データ収集ゼロ', de: 'Keine Datenerhebung', fr: 'Zéro collecte de données', es: 'Cero recopilación de datos', en: 'Zero Data Collection', it: 'Zero raccolta dati', id: 'Nol Pengumpulan Data', pt: 'Zero Coleta de Dados' }), desc: L(locale, { ja: 'ドキュメントを保存、分析、共有することは一切ありません', de: 'Wir speichern, analysieren oder teilen Ihre Dokumente nicht', fr: "Nous ne stockons, n'analysons ni ne partageons vos documents avec personne", es: 'No almacenamos, analizamos ni compartimos sus documentos con nadie', en: "We don't store, analyze, or share your documents with anyone", it: 'Non archiviamo, analizziamo né condividiamo i tuoi documenti con nessuno', id: 'Kami tidak menyimpan, menganalisis, atau membagikan dokumen Anda kepada siapa pun', pt: 'Não armazenamos, analisamos nem compartilhamos seus documentos com ninguém' }), color: 'from-blue-500 to-cyan-600' },
                    { icon: Users, title: L(locale, { ja: 'GDPR準拠', de: 'DSGVO-konform', fr: 'Conforme RGPD', es: 'Cumplimiento GDPR', en: 'GDPR Compliant', it: 'Conforme al GDPR', id: 'Patuh GDPR', pt: 'Conforme com o GDPR' }), desc: L(locale, { ja: '国際的なプライバシー規制に完全準拠', de: 'Vollständige Einhaltung internationaler Datenschutzvorschriften', fr: 'Conformité totale aux réglementations internationales', es: 'Pleno cumplimiento de las regulaciones internacionales de privacidad', en: 'Full compliance with international privacy regulations', it: 'Piena conformità alle normative internazionali sulla privacy', id: 'Kepatuhan penuh terhadap peraturan privasi internasional', pt: 'Total conformidade com as regulamentações internacionais de privacidade' }), color: 'from-purple-500 to-violet-600' }
                  ].map((item,i)=>(
                    <div key={i} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group">
                      <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform`}><item.icon className="w-5 h-5 text-white" /></div>
                      <div><h3 className="font-semibold text-sm text-gray-900 mb-0.5">{item.title}</h3><p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div></Reveal>
            </div>
          </div>
        </section>

        <div className="section-line max-w-5xl mx-auto" />

        {/* ══ WHY WE BUILT THIS ══ */}
        <section className="relative py-14 md:py-16 px-4">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-white" />
          <div className="relative max-w-4xl mx-auto">
            <Reveal><div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mb-2 tracking-tight">{L(locale, { ja: 'なぜこれを作ったのか', de: 'Warum wir das gebaut haben', fr: 'Pourquoi nous avons construit cela', es: 'Por qué lo construimos', en: 'Why We Built This', it: "Perché l\'abbiamo costruito", id: 'Mengapa Kami Membangun Ini', pt: 'Por Que Construímos Isso' })}</h2>
            </div></Reveal>
            <Reveal delay={80}>
              <div className="relative bg-white rounded-2xl p-7 md:p-10 border border-gray-100 shadow-sm overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 via-cyan-500 to-emerald-500 rounded-full" />
                <div className="space-y-5 text-sm sm:text-[15px] text-gray-600 leading-[1.8]" style={{fontFamily:"'Instrument Sans',system-ui,sans-serif"}}>
                  {locale === 'ja' ? (
                    <>
                      <p>
                        PDFの扱いは本当にイライラすることがあります。締め切りが迫る中で必死に複数のファイルを結合しようとしたり、メールで送信できるように巨大なドキュメントを小さくしようと苦労したり、フォーマットが完全に崩れずにPDFをWordに変換したいと切望したり。身に覚えがありますか？
                      </p>
                      <p>
                        そのフラストレーションこそが、このサイトを作った理由です。何か違うもの、期待通りに機能するものを作りたかったのです。3クリック先に埋もれた複雑なメニューも、必要なときにポップアップする驚きの有料プランもなく、画像のサイズ変更や2つのファイルの結合のためだけに、また別のアカウントを作ることを強制されることもありません。
                      </p>
                      <p>
                        真夜中に研究論文をまとめている学生でも、契約書や請求書を扱う専門家でも、ドキュメントに署名して送信する必要がある人でも、これらのツールは時間を節約し、頭痛を和らげるために設計されています。実際のユーザーフィードバックに基づいてすべての機能を改良してきました。あなたの時間が何よりも大切だからこそ、改善を続けています。
                      </p>
                    </>
                  ) : locale === 'de' ? (
                    <>
                      <p>
                        PDFs können unglaublich frustrierend sein. Wir kennen das alle: verzweifelt versuchen, mehrere Dateien zusammenzuführen, während eine Deadline näher rückt; ein riesiges Dokument verkleinern, damit es per E-Mail versandt werden kann; oder ein PDF in Word konvertieren, ohne dass die Formatierung völlig durcheinander gerät. Kommt Ihnen das bekannt vor?
                      </p>
                      <p>
                        Genau diese Frustration hat uns dazu bewogen, diese Website zu erstellen. Wir wollten etwas Anderes bauen – etwas, das so funktioniert, wie man es erwartet. Keine verwirrenden Menüs drei Klicks tief vergraben, keine überraschenden Bezahlschranken genau dann, wenn man etwas braucht, und absolut kein Zwang, noch ein weiteres Konto zu erstellen, nur um ein Bild zu verkleinern oder zwei Dateien zusammenzuführen.
                      </p>
                      <p>
                        Ob Student, der mitten in der Nacht Forschungsarbeiten zusammenstellt, ein Profi, der Verträge und Rechnungen bearbeitet, oder jemand, der schnell ein Dokument unterschreiben und versenden muss – diese Tools sind darauf ausgelegt, Zeit zu sparen und Kopfschmerzen zu ersparen. Wir haben jede Funktion auf Basis echten Nutzerfeedbacks verfeinert und verbessern uns weiter, weil Ihre Zeit das Wichtigste ist.
                      </p>
                    </>
                  ) : locale === 'fr' ? (
                    <>
                      <p>
                        Les PDF peuvent être incroyablement frustrants. Nous sommes tous passés par là : tenter désespérément de fusionner plusieurs fichiers alors qu'une échéance approche, lutter pour réduire un document volumineux afin de pouvoir l'envoyer par e-mail, ou vouloir convertir un PDF en Word sans que la mise en forme ne parte dans tous les sens. Ça vous parle ?
                      </p>
                      <p>
                        C'est exactement cette frustration qui nous a poussés à créer ce site. Nous voulions construire quelque chose de différent, quelque chose qui fonctionne vraiment comme vous l'attendez. Pas de menus déroutants enfouis à trois clics de profondeur, pas de paywalls surprises qui surgissent au mauvais moment, et absolument aucune obligation de créer encore un compte juste pour redimensionner une image ou fusionner deux fichiers.
                      </p>
                      <p>
                        Que vous soyez étudiant assemblant des travaux de recherche à minuit, un professionnel gérant des contrats et des factures, ou simplement quelqu'un qui doit signer et envoyer rapidement un document, ces outils sont conçus pour vous faire gagner du temps. Nous affinons chaque fonctionnalité en fonction des retours réels des utilisateurs.
                      </p>
                    </>
                  ) : locale === 'es' ? (
                    <>
                      <p>
                        Los PDF pueden ser increíblemente frustrantes. Todos hemos estado ahí: intentando desesperadamente combinar varios archivos mientras se acerca una fecha límite, luchando por reducir un documento enorme para poder enviarlo por correo, o queriendo convertir un PDF a Word sin que el formato se convierta en un caos total. ¿Te suena familiar?
                      </p>
                      <p>
                        Esa frustración es exactamente por qué creamos este sitio. Queríamos construir algo diferente, algo que realmente funcione como esperarías. Sin menús confusos enterrados a tres clics de profundidad, sin sorpresas de pago justo cuando más lo necesitas, y absolutamente sin obligarte a crear otra cuenta más solo para redimensionar una imagen o combinar dos archivos.
                      </p>
                      <p>
                        Ya seas un estudiante reuniendo trabajos de investigación a medianoche, un profesional manejando contratos y facturas, o simplemente alguien que necesita firmar y enviar un documento rápidamente, estas herramientas están diseñadas para ahorrarte tiempo. Hemos perfeccionado cada función basándonos en comentarios reales de usuarios.
                      </p>
                    </>
                  ) : locale === 'id' ? (
    <>
      <p>
        PDF bisa sangat membuat frustrasi. Kita semua pernah mengalaminya: mencoba menggabungkan beberapa file saat tenggat waktu semakin dekat, berjuang mengecilkan dokumen besar agar bisa dikirim lewat email, atau ingin mengkonversi PDF ke Word tanpa format berantakan. Kedengarannya familiar?
      </p>
      <p>
        Frustrasi itulah yang mendorong kami membuat situs ini. Kami ingin membangun sesuatu yang berbeda — sesuatu yang benar-benar bekerja sesuai harapan. Tidak ada menu membingungkan yang tersembunyi tiga klik lebih dalam, tidak ada paywall mengejutkan yang muncul tepat saat Anda membutuhkan sesuatu, dan sama sekali tidak memaksa Anda membuat akun lagi hanya untuk mengubah ukuran gambar atau menggabungkan dua file.
      </p>
      <p>
        Baik Anda seorang pelajar yang mengumpulkan makalah penelitian tengah malam, seorang profesional yang menangani kontrak dan faktur, atau hanya seseorang yang perlu menandatangani dan mengirim dokumen dengan cepat, alat-alat ini dirancang untuk menghemat waktu Anda. Kami terus meningkatkan karena waktu Anda yang paling penting.
      </p>
    </>
  ) : locale === 'it' ? (
                    <>
                      <p>
                        I PDF possono essere incredibilmente frustranti. Ci siamo passati tutti: cercare disperatamente di combinare più file mentre si avvicina una scadenza, lottare per ridurre un documento enorme in modo da poterlo inviare via e-mail, o voler convertire un PDF in Word senza che la formattazione diventi un caos totale. Ti suona familiare?
                      </p>
                      <p>
                        Quella frustrazione è esattamente il motivo per cui abbiamo creato questo sito. Volevamo costruire qualcosa di diverso, qualcosa che funzionasse davvero come ci si aspetta. Nessun menu confuso sepolto a tre clic di profondità, nessun paywall a sorpresa che compare proprio quando ne hai bisogno, e assolutamente nessun obbligo di creare un altro account solo per ridimensionare un'immagine o unire due file.
                      </p>
                      <p>
                        Che tu sia uno studente che assembla documenti di ricerca a mezzanotte, un professionista che gestisce contratti e fatture, o semplicemente qualcuno che ha bisogno di firmare e inviare rapidamente un documento, questi strumenti sono progettati per farti risparmiare tempo. Abbiamo perfezionato ogni funzione basandoci sul feedback reale degli utenti, e continuiamo a migliorare perché il tuo tempo è la cosa più importante.
                      </p>
                    </>
                  ) : locale === 'id' ? (
                    <>
                      <p>
                        PDF bisa sangat menjengkelkan untuk ditangani. Kita semua pernah mengalaminya: mencoba menggabungkan beberapa file saat deadline mendekat, berjuang memperkecil dokumen besar agar bisa dikirim lewat email, atau ingin mengonversi PDF ke Word tanpa format yang berantakan. Terdengar familiar?
                      </p>
                      <p>
                        Itulah mengapa kami membuat situs ini. Kami ingin membangun sesuatu yang berbeda, sesuatu yang benar-benar berfungsi sesuai harapan. Tidak ada menu membingungkan yang terkubur tiga klik lebih dalam, tidak ada paywall kejutan yang muncul tepat saat Anda membutuhkannya, dan tidak ada paksaan untuk membuat akun lain hanya untuk mengubah ukuran gambar atau menggabungkan dua file.
                      </p>
                      <p>
                        Baik Anda mahasiswa yang menyusun makalah penelitian tengah malam, profesional yang menangani kontrak dan faktur, atau seseorang yang perlu menandatangani dan mengirim dokumen dengan cepat — alat-alat ini dirancang untuk menghemat waktu Anda. Kami terus menyempurnakan setiap fitur berdasarkan masukan pengguna nyata, karena waktu Anda adalah hal yang paling berharga.
                      </p>
                    </>
  ) : locale === 'pt' ? (
                    <>
                      <p>
                        PDFs podem ser incrivelmente frustrantes. Já passamos por isso: desesperadamente tentando combinar vários arquivos enquanto um prazo se aproxima, lutando para reduzir um documento enorme para poder enviá-lo por e-mail, ou querendo converter um PDF para Word sem que a formatação vire um caos total. Parece familiar?
                      </p>
                      <p>
                        Essa frustração é exatamente o motivo pelo qual criamos este site. Queríamos construir algo diferente, algo que realmente funcione do jeito que você espera. Sem menus confusos enterrados três cliques de profundidade, sem paywall surpresa aparecendo exatamente quando você mais precisa, e absolutamente sem forçar você a criar mais uma conta só para redimensionar uma imagem ou mesclar dois arquivos.
                      </p>
                      <p>
                        Seja você um estudante reunindo trabalhos de pesquisa à meia-noite, um profissional lidando com contratos e faturas, ou simplesmente alguém que precisa assinar e enviar um documento rapidamente, essas ferramentas foram projetadas para economizar seu tempo. Refinamos cada recurso com base no feedback real dos usuários, e continuamos melhorando porque seu tempo é o que mais importa.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        Look, PDFs can be incredibly frustrating to deal with. We've all been there: frantically trying to combine multiple files while a deadline looms overhead, struggling to shrink a massive document so it'll actually send through email, or desperately wanting to convert a PDF to Word without the formatting turning into absolute chaos. Sound familiar?
                      </p>
                      <p>
                        That frustration is exactly why we created this site. We wanted to build something different, something that actually works the way you'd expect it to. No confusing menus buried three clicks deep, no surprise paywalls popping up right when you need something, and absolutely no forcing you to create yet another account just to resize an image or merge two files.
                      </p>
                      <p>
                        Whether you're a student pulling together research papers at midnight, a professional handling contracts and invoices, or just someone who needs to quickly sign and send a document, these tools are designed to save you time and spare you the headache. We've refined every feature based on real user feedback, and we keep improving because your time matters more than anything else.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="section-line max-w-5xl mx-auto" />

        
        <div className="section-line max-w-5xl mx-auto" />

        {/* ══ FAQ ══ */}
        <section className="relative py-14 md:py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <Reveal><div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mb-2 tracking-tight">{L(locale,{ja:'よくある質問',de:'Häufig gestellte Fragen',fr:'Questions fréquentes',es:'Preguntas frecuentes',en:'Frequently Asked Questions',it:'Domande frequenti',id:'Pertanyaan yang Sering Diajukan',pt:'Perguntas Frequentes'})}</h2>
              <p className="text-sm sm:text-base text-gray-500">{L(locale,{ja:'知っておくべきすべて',de:'Alles, was Sie wissen müssen',fr:'Tout ce que vous devez savoir',es:'Todo lo que necesitas saber',en:'Everything you need to know',it:'Tutto quello che devi sapere',id:'Semua yang perlu Anda ketahui',pt:'Tudo que você precisa saber'})}</p>
            </div></Reveal>
            <div className="space-y-2.5">{faqs.map((faq,i)=><FAQItem key={i} question={faq.question} answer={faq.answer} isOpen={openFAQ===i} onToggle={()=>toggleFAQ(i)} />)}</div>
          </div>
        </section>

        <div className="section-line max-w-5xl mx-auto" />

        {/* ══ PREMIUM CTA ══ */}
        <section className="relative py-14 md:py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <Reveal><div className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 rounded-3xl p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 rounded-full blur-3xl" />
              <div className="relative grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 mb-5 border border-white/10">
                    <Crown className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-[11px] font-semibold text-white/90">{L(locale,{ja:'プレミアム機能',de:'Premium-Funktionen',fr:'Fonctionnalités Premium',es:'Funciones Premium',en:'Premium Features',it:'Funzioni Premium',id:'Fitur Premium',pt:'Recursos Premium'})}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-5 tracking-tight leading-tight">{L(locale,{ja:'PDFツールの全機能を解放',de:'Volle Leistung freischalten',fr:'Débloquez toute la puissance',es:'Desbloquea todo el poder',en:'Unlock the full power of PDF tools',it:'Sblocca tutta la potenza',id:'Buka kekuatan penuh',pt:'Libere todo o poder'})}</h2>
                  <div className="space-y-3 mb-6">
                    {premFeatures.map((f,i)=>(
                      <div key={i} className="flex items-center gap-2.5"><div className="w-5 h-5 bg-emerald-500 rounded-md flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-white" /></div><p className="font-medium text-sm text-white/80">{f}</p></div>
                    ))}
                  </div>
                  <Link href="/pricing" className="group bg-white text-gray-950 font-semibold px-6 py-3 rounded-xl hover:bg-gray-100 transition-all text-sm inline-flex items-center gap-2 shadow-lg">
                    <Crown className="w-4 h-4" /><span>{L(locale,{ja:'プレミアムを取得',de:'Premium holen',fr:'Obtenir Premium',es:'Obtener Premium',en:'Get Premium Now',it:'Ottieni Premium',id:'Dapatkan Premium',pt:'Obtenha Premium'})}</span><ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                  <h3 className="font-bold text-base mb-4 text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-sky-400" />{L(locale,{ja:'含まれる内容',de:'Was enthalten ist',fr:'Ce qui est inclus',es:'Qué incluye',en:'What is Included',it:'Cosa è incluso',id:'Yang Termasuk',pt:'O Que Inclui'})}</h3>
                  <div className="space-y-2">
                    {premIncludes.map((f,i)=>(
                      <div key={i} className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"><div className="w-1.5 h-1.5 bg-sky-400 rounded-full flex-shrink-0" /><span className="font-medium text-xs text-white/70">{f}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </div></Reveal>
          </div>
        </section>
      </Layout>
    </>
  )
}