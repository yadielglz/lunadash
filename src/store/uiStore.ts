import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Tab = 'home' | 'devices' | 'schedule' | 'goals' | 'weather' | 'display' | 'tasks' | 'settings'
export type Theme = 'dark' | 'light'
export type TempUnit = 'C' | 'F'
export type TimeFormat = '12' | '24'

interface UiState {
  activeTab: Tab
  theme: Theme
  tempUnit: TempUnit
  timeFormat: TimeFormat
  storeId: string          // unique per-store key, shared across all devices in that store
  isEditingWidgets: boolean
  setTab: (tab: Tab) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setTempUnit: (unit: TempUnit) => void
  toggleTempUnit: () => void
  setTimeFormat: (fmt: TimeFormat) => void
  setStoreId: (id: string) => void
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
      storeId: 'default',
      isEditingWidgets: false,
      setTab: (tab) => set({ activeTab: tab }),
      setTempUnit: (unit) => set({ tempUnit: unit }),
      toggleTempUnit: () => set((s) => ({ tempUnit: s.tempUnit === 'C' ? 'F' : 'C' })),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
      setStoreId: (id) => set({ storeId: id || 'default' }),
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
      partialize: (s) => ({ theme: s.theme, tempUnit: s.tempUnit, timeFormat: s.timeFormat, storeId: s.storeId, activeTab: s.activeTab }),
      onRehydrateStorage: () => (state) => {
        if (state) document.documentElement.className = state.theme
      },
    }
  )
)
