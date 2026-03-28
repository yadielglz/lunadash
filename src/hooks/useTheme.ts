import { useEffect } from 'react'
import { useUiStore } from '../store/uiStore'

export function useTheme() {
  const { theme, toggleTheme, setTheme } = useUiStore()

  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const stored = localStorage.getItem('luna-ui')
    if (stored) return // user has a preference stored
    setTheme(mq.matches ? 'dark' : 'light')
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { theme, toggleTheme, isDark: theme === 'dark' }
}
