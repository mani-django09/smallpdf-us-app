// lib/analytics.js
// Google Analytics utility functions

// Track page views
export const pageview = (url) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-603K8BH9MK', {
      page_path: url,
    })
  }
}

// Track custom events
export const event = ({ action, category, label, value }) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

// Track specific tool usage
export const trackToolUsage = (toolName) => {
  event({
    action: 'tool_used',
    category: 'Tools',
    label: toolName,
  })
}

// Track file conversions
export const trackConversion = (fromFormat, toFormat, fileSize) => {
  event({
    action: 'file_converted',
    category: 'Conversions',
    label: `${fromFormat} to ${toFormat}`,
    value: Math.round(fileSize / 1024), // Size in KB
  })
}

// Track downloads
export const trackDownload = (fileName) => {
  event({
    action: 'file_downloaded',
    category: 'Downloads',
    label: fileName,
  })
}

// Track errors
export const trackError = (errorMessage, page) => {
  event({
    action: 'error_occurred',
    category: 'Errors',
    label: `${page}: ${errorMessage}`,
  })
}