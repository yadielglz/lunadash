import { useEffect } from 'react'
import { type Theme, useUiStore } from '../store/uiStore'

const DARK_THEMES: Theme[] = ['dark', 'carbon', 'graphite', 'aurora', 'rosewood', 'console']

export function useTheme() {
  const { theme, toggleTheme, setTheme } = useUiStore()

  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  useEffect(() => {
    const stored = localStorage.getItem('luna-ui')
    if (stored) return // user has a preference stored
    setTheme('console')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { theme, toggleTheme, isDark: DARK_THEMES.includes(theme) }
}
