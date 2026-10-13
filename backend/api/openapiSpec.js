// api/openapiSpec.js
// Builds an OpenAPI 3.0 spec for the public PDF API. Served at
// GET /api/v1/openapi.json — import this URL into RapidAPI (or any API
// gateway / Postman) to publish the endpoints.

const SERVER_URL = process.env.PUBLIC_API_URL || 'https://smallpdf.us/api/v1'

// Compact endpoint catalogue. file/files → binary multipart fields.
const EPS = [
  { id: 'merge', tag: 'Organize', summary: 'Merge PDFs', desc: 'Combine two or more PDFs into one document.', multi: 'files', returns: 'application/pdf' },
  { id: 'split', tag: 'Organize', summary: 'Split PDF', desc: 'Split a PDF into pages (ZIP) or extract a page range (PDF).', file: true, fields: { pages: { type: 'string', desc: 'Optional range e.g. "1,3,5-7". Omit to split every page.' } }, returns: 'application/zip' },
  { id: 'rotate', tag: 'Organize', summary: 'Rotate PDF', desc: 'Rotate every page by 90, 180 or 270 degrees.', file: true, fields: { angle: { type: 'string', desc: '90, 180 or 270. Default 90.' } }, returns: 'application/pdf' },
  { id: 'compress', tag: 'Optimize', summary: 'Compress PDF', desc: 'Reduce PDF file size (lossless).', file: true, returns: 'application/pdf' },
  { id: 'protect', tag: 'Secure', summary: 'Protect PDF', desc: 'Encrypt a PDF with AES-256 password protection.', file: true, fields: { password: { type: 'string', required: true, desc: 'Password required to open the file.' } }, returns: 'application/pdf' },
  { id: 'pdf-to-word', tag: 'Convert', summary: 'PDF to Word', desc: 'Convert a PDF to an editable Word (.docx) document.', file: true, returns: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'word-to-pdf', tag: 'Convert', summary: 'Word to PDF', desc: 'Convert a Word document to PDF.', file: true, returns: 'application/pdf' },
  { id: 'pdf-to-jpg', tag: 'Convert', summary: 'PDF to JPG', desc: 'Render each PDF page to a JPG image (ZIP).', file: true, fields: { quality: { type: 'string', desc: 'standard | high | maximum' } }, returns: 'application/zip' },
  { id: 'pdf-to-png', tag: 'Convert', summary: 'PDF to PNG', desc: 'Render each PDF page to a PNG image (ZIP).', file: true, fields: { quality: { type: 'string', desc: 'standard | high | maximum' } }, returns: 'application/zip' },
  { id: 'jpg-to-pdf', tag: 'Convert', summary: 'JPG to PDF', desc: 'Combine JPG images into a single PDF.', multi: 'files', returns: 'application/pdf' },
  { id: 'png-to-pdf', tag: 'Convert', summary: 'PNG to PDF', desc: 'Combine PNG images into a single PDF.', multi: 'files', returns: 'application/pdf' },
]

function errorResponse(desc) {
  return {
    description: desc,
    content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' }, code: { type: 'string' } } } } },
  }
}

function buildSpec() {
  const paths = {}
  for (const e of EPS) {
    const props = {}
    const required = []

    if (e.multi) {
      props[e.multi] = { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Two or more files.' }
      required.push(e.multi)
    }
    if (e.file) {
      props.file = { type: 'string', format: 'binary', description: 'The input file.' }
      required.push('file')
    }
    for (const [k, v] of Object.entries(e.fields || {})) {
      props[k] = { type: v.type || 'string', description: v.desc || '' }
      if (v.required) required.push(k)
    }

    paths['/' + e.id] = {
      post: {
        tags: [e.tag],
        summary: e.summary,
        description: e.desc,
        operationId: e.id.replace(/-/g, '_'),
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: props, required } } },
        },
        responses: {
          200: { description: 'Success — the processed file.', content: { [e.returns]: { schema: { type: 'string', format: 'binary' } } } },
          400: errorResponse('Invalid input.'),
          401: errorResponse('Missing or invalid API key.'),
          429: errorResponse('Monthly quota exceeded.'),
          500: errorResponse('Processing error.'),
        },
      },
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'SmallPDF.us PDF API',
      version: '1.0.0',
      description: 'Merge, split, rotate, compress, password-protect and convert PDF, Word and image files via a simple REST API. Authenticate with the X-API-Key header.',
      contact: { name: 'SmallPDF.us', url: 'https://smallpdf.us/developers' },
    },
    servers: [{ url: SERVER_URL }],
    tags: [
      { name: 'Organize', description: 'Merge, split and rotate' },
      { name: 'Convert', description: 'PDF ⇄ Word, JPG, PNG' },
      { name: 'Optimize', description: 'Compress' },
      { name: 'Secure', description: 'Password protection' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths,
  }
}

module.exports = { buildSpec }
