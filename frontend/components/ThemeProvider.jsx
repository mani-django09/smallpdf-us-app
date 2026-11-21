import { useEffect } from 'react'

// The site is designed for a light theme only. Pages and components have no
// dark styles, so turning on html.dark (from the OS setting) left dark text on
// dark boxes: unreadable H1s, upload boxes and homepage badges. Always light.
export default function ThemeProvider({ children }) {
  useEffect(() => {
    try {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
      // Older visits saved 'dark' here; clear it so it never comes back.
      if (localStorage.getItem('theme') === 'dark') localStorage.setItem('theme', 'light')
    } catch (e) {
      // localStorage can be blocked; the class removal above is what matters
    }
  }, [])

  return <>{children}</>
}
