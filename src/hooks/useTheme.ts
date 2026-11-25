import { useEffect } from 'react'
import { applyThemeToDocument, isDarkTheme, useUiStore } from '../store/uiStore'

export function useTheme() {
  const theme = useUiStore((s) => s.theme)
  const uiScale = useUiStore((s) => s.uiScale)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const setTheme = useUiStore((s) => s.setTheme)

  useEffect(() => {
    applyThemeToDocument(theme, uiScale)
  }, [theme, uiScale])

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: isDarkTheme(theme),
  }
}
