import { useEffect } from 'react'
import { useUiStore } from '../store/uiStore'

export function useTheme() {
  const { theme, toggleTheme, setTheme } = useUiStore()

  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  useEffect(() => {
    const stored = localStorage.getItem('luna-ui')
    if (stored) return // user has a preference stored
    setTheme('mac')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { theme, toggleTheme, isDark: theme === 'dark' }
}
