import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Tab = 'home' | 'devices' | 'schedule' | 'goals' | 'weather' | 'display' | 'settings'
export type Theme = 'dark' | 'light'
export type TempUnit = 'C' | 'F'
export type TimeFormat = '12' | '24'

interface UiState {
  activeTab: Tab
  theme: Theme
  tempUnit: TempUnit
  timeFormat: TimeFormat
  isEditingWidgets: boolean
  setTab: (tab: Tab) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setTempUnit: (unit: TempUnit) => void
  toggleTempUnit: () => void
  setTimeFormat: (fmt: TimeFormat) => void
  setEditingWidgets: (v: boolean) => void
}

function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      activeTab: 'home',
      theme: getSystemTheme(),
      tempUnit: 'F' as TempUnit,
      timeFormat: '12' as TimeFormat,
      isEditingWidgets: false,
      setTab: (tab) => set({ activeTab: tab }),
      setTempUnit: (unit) => set({ tempUnit: unit }),
      toggleTempUnit: () => set((s) => ({ tempUnit: s.tempUnit === 'C' ? 'F' : 'C' })),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.className = theme
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        document.documentElement.className = next
      },
      setEditingWidgets: (v) => set({ isEditingWidgets: v }),
    }),
    {
      name: 'luna-ui',
      partialize: (s) => ({ theme: s.theme, tempUnit: s.tempUnit, timeFormat: s.timeFormat }),
      onRehydrateStorage: () => (state) => {
        if (state) document.documentElement.className = state.theme
      },
    }
  )
)
