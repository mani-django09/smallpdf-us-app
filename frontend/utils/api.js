// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011'

export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes
}

// API Helper Functions
export const api = {
  // Compress PDF
  compressPDF: async (formData) => {
    const response = await fetch(`${API_BASE_URL}/api/compress-pdf-batch`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it automatically with boundary
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Compression failed')
    }
    
    return await response.json()
  },

  // Download compressed file
  downloadCompressed: async (jobId) => {
    return `${API_BASE_URL}/api/download-compressed/${jobId}`
  },

  // Health check
  healthCheck: async () => {
    const response = await fetch(`${API_BASE_URL}/api/health`)
    return await response.json()
  }
}

export default api