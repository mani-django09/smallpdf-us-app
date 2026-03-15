"use client"
import { useEffect } from 'react'


export default function ThemeProvider({ children }) {
  useEffect(() => {
    // Only runs on client after hydration is complete
    try {
      const savedTheme = localStorage.getItem('theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const theme = savedTheme || (prefersDark ? 'dark' : 'light')
      
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
        document.body.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
        document.body.classList.remove('dark')
      }
      
      // Save the determined theme
      if (!savedTheme) {
        localStorage.setItem('theme', theme)
      }
    } catch (e) {
      // localStorage might be blocked in some browsers
      console.error('Theme initialization error:', e)
    }
  }, [])
  
  return <>{children}</>
}