// components/ToolPage.js
import { useState, useCallback } from 'react';
import SEOHead from './SEOHead';
import Link from 'next/link';
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  Loader,
  Shield,
  Zap,
  Lock,
  X,
  AlertCircle
} from 'lucide-react';

export default function ToolPage({
  title,
  description,
  apiEndpoint,
  acceptedFormats,
  multiple = false,
  icon: Icon = FileText,
  seoTitle,
  seoDescription,
  canonicalUrl,
  keywords = "",
  howToSteps = [],
  whyUsePoints = [],
  features = [],
  faqs = [],
  relatedTools = [],
  additionalContent = null,
  tips = []
}) {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return acceptedFormats.includes(ext);
    });
    if (validFiles.length !== selectedFiles.length) {
      setError(`Please select only ${acceptedFormats} files`);
      return;
    }
    if (multiple) setFiles(validFiles);
    else setFile(validFiles[0]);
    setError(null);
    setResult(null);
  }, [multiple, acceptedFormats]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return acceptedFormats.includes(ext);
    });
    if (validFiles.length === 0) {
      setError(`Please drop only ${acceptedFormats} files`);
      return;
    }
    if (multiple) setFiles(validFiles);
    else setFile(validFiles[0]);
    setError(null);
    setResult(null);
  }, [multiple, acceptedFormats]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragActive(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setDragActive(false); }, []);

  const removeFile = useCallback((index) => {
    if (multiple) setFiles(files.filter((_, idx) => idx !== index));
    else setFile(null);
  }, [files, multiple]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && files.length === 0) { setError('Please select a file'); return; }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      if (multiple) files.forEach(f => formData.append('files', f));
      else formData.append('file', file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}${apiEndpoint}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) setResult(data);
      else setError(data.error || 'An error occurred during processing');
    } catch (err) {
      setError('Failed to process file. Please check your connection and try again.');
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setFiles([]);
    setResult(null);
    setError(null);
  };

  // Structured data — aggregateRating intentionally omitted.
  // It must reflect real verified user reviews. Add it back once you have
  // a genuine review collection mechanism (e.g. a verified reviews widget).
  const toolStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": title,
        "applicationCategory": "UtilityApplication",
        "operatingSystem": "Web Browser",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "description": description,
      },
      ...(howToSteps.length > 0 ? [{
        "@type": "HowTo",
        "name": `How to ${title}`,
        "description": description,
        "step": howToSteps.map((step, idx) => ({
          "@type": "HowToStep",
          "position": idx + 1,
          "name": step.title,
          "text": step.description
        }))
      }] : []),
      ...(faqs.length > 0 ? [{
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      }] : [])
    ]
  };

  return (
    <>
      <SEOHead
        title={seoTitle || `${title} - Free Online Tool | SmallPDF.us`}
        description={seoDescription || description}
        canonical={canonicalUrl}
        keywords={keywords}
        structuredData={toolStructuredData}
      />

      <div className="text-center mb-8 sm:mb-12">
        <div className="bg-gradient-to-r from-red-600 to-orange-500 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
          <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
          {title}
        </h1>
        <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload form */}
          {!result && (
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <form onSubmit={handleSubmit}>
                {/* Drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
                    dragActive
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 hover:border-red-400 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept={acceptedFormats.join(',')}
                    multiple={multiple}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label={`Upload ${acceptedFormats.join(', ')} file${multiple ? 's' : ''}`}
                  />
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
                  <p className="text-lg font-semibold text-gray-700 mb-1">
                    Drop your file{multiple ? 's' : ''} here
                  </p>
                  <p className="text-sm text-gray-500">
                    or click to browse — {acceptedFormats.join(', ')} supported
                  </p>
                </div>

                {/* File list */}
                {(file || files.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {(multiple ? files : [file]).map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-red-500 flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm font-medium text-gray-800 truncate max-w-xs">{f.name}</span>
                          <span className="text-xs text-gray-500">
                            {(f.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          aria-label={`Remove ${f.name}`}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3" role="alert">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (!file && files.length === 0)}
                  className="mt-6 w-full bg-gradient-to-r from-red-600 to-orange-500 text-white py-4 rounded-xl font-bold text-base hover:shadow-xl hover:shadow-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {loading ? (
                    <><Loader className="w-5 h-5 animate-spin" aria-hidden="true" /><span>Processing…</span></>
                  ) : (
                    <><Zap className="w-5 h-5" aria-hidden="true" /><span>Convert Now — Free</span></>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Done!</h2>
                <p className="text-gray-500 mt-1">Your file is ready to download.</p>
              </div>

              {result.originalSize && result.compressedSize && (
                <div className="bg-gray-50 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 text-center gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Original Size</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {(result.originalSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Saved</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                      {(((result.originalSize - result.compressedSize) / result.originalSize) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">New Size</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {(result.compressedSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || ''}${result.downloadUrl}`}
                  download
                  className="flex-1 bg-gradient-to-r from-red-600 to-orange-500 text-white py-4 rounded-xl font-bold hover:shadow-xl hover:shadow-red-500/20 transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" aria-hidden="true" />
                  <span>Download File</span>
                </a>
                <button
                  onClick={resetForm}
                  className="flex-1 bg-white text-gray-900 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98]"
                >
                  Convert Another File
                </button>
              </div>
            </div>
          )}

          {howToSteps.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                How to {title}
              </h2>
              <ol className="space-y-5">
                {howToSteps.map((step, idx) => (
                  <li key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-red-600 to-orange-500 rounded-full flex items-center justify-center text-white font-bold shadow-md" aria-hidden="true">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-2 text-lg">{step.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {whyUsePoints.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                Why Use Our {title} Tool?
              </h2>
              <div className="space-y-4">
                {whyUsePoints.map((point, idx) => (
                  <div key={idx} className="flex gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-gray-700 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tips.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Zap className="w-6 h-6 text-blue-600" aria-hidden="true" />
                Pro Tips
              </h2>
              <ul className="space-y-3">
                {tips.map((tip, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-700">
                    <span className="text-blue-600 font-bold" aria-hidden="true">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {additionalContent && (
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              {additionalContent}
            </div>
          )}

          {faqs.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
                    <h3 className="font-bold text-gray-900 mb-2 text-lg">{faq.question}</h3>
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:sticky lg:top-24">
            <h3 className="font-bold text-gray-900 mb-5 text-lg">Key Features</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-green-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">100% Secure</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    256-bit SSL encryption. Files auto-deleted after 2 hours.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-yellow-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">Lightning Fast</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Process files in seconds with optimized servers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">No Registration</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Completely free forever. No signup required.
                  </p>
                </div>
              </div>

              {features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-10 h-10 ${feature.bgColor || 'bg-gray-100'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <feature.icon className={`w-5 h-5 ${feature.iconColor || 'text-gray-600'}`} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">{feature.title}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {relatedTools.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Related Tools</h3>
              <div className="space-y-2">
                {relatedTools.map((tool, idx) => (
                  <Link
                    key={idx}
                    href={tool.href}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                  >
                    <p className="font-semibold text-sm text-gray-900 mb-1">{tool.name}</p>
                    <p className="text-xs text-gray-500">{tool.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Stats — removed fabricated "4.8/5 average rating" and "100M+ users" claims */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-100">
            <h4 className="font-bold text-gray-900 mb-4 text-sm">Why SmallPDF.us</h4>
            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" aria-hidden="true" />
                <span>No file limits or paywalls</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" aria-hidden="true" />
                <span>Files deleted after 2 hours</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" aria-hidden="true" />
                <span>No account required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" aria-hidden="true" />
                <span>GDPR compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}