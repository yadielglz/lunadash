import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Tab = 'home' | 'devices' | 'schedule' | 'goals' | 'weather' | 'display' | 'tasks' | 'settings'
export type Theme = 'dark' | 'light'
export type TempUnit = 'C' | 'F'
export type TimeFormat = '12' | '24'
export type AccessMode = 'manager' | 'display' | 'admin'
export type AccessRole = 'admin' | 'manager' | 'employee' | 'display'

const SESSION_MS = 2 * 60 * 1000

interface UiState {
  activeTab: Tab
  theme: Theme
  tempUnit: TempUnit
  timeFormat: TimeFormat
  storeId: string          // unique per-store key, shared across all devices in that store
  accessMode: AccessMode
  accessRole: AccessRole | null
  dealerCode: string
  accessLabel: string
  sessionExpiresAt: number | null
  isEditingWidgets: boolean
  setTab: (tab: Tab) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setTempUnit: (unit: TempUnit) => void
  toggleTempUnit: () => void
  setTimeFormat: (fmt: TimeFormat) => void
  setStoreId: (id: string) => void
  setAccessMode: (mode: AccessMode) => void
  setAccessSession: (access: { storeId: string; role: AccessRole; dealerCode: string; label?: string | null; mode?: AccessMode }) => void
  clearStoreSession: () => void
  extendStoreSession: () => void
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
      storeId: '',
      accessMode: 'manager',
      accessRole: null,
      dealerCode: '',
      accessLabel: '',
      sessionExpiresAt: null,
      isEditingWidgets: false,
      setTab: (tab) => set({ activeTab: tab }),
      setTempUnit: (unit) => set({ tempUnit: unit }),
      toggleTempUnit: () => set((s) => ({ tempUnit: s.tempUnit === 'C' ? 'F' : 'C' })),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
      setStoreId: (id) => set({ storeId: id, sessionExpiresAt: id ? Date.now() + SESSION_MS : null }),
      setAccessMode: (mode) => set({ accessMode: mode, activeTab: mode === 'display' ? 'display' : get().activeTab }),
      setAccessSession: ({ storeId, role, dealerCode, label, mode }) => {
        const accessMode = mode ?? (role === 'admin' ? 'admin' : role === 'display' ? 'display' : 'manager')
        set({
          storeId,
          accessRole: role,
          accessMode,
          dealerCode,
          accessLabel: label ?? '',
          sessionExpiresAt: Date.now() + SESSION_MS,
          activeTab: accessMode === 'display' ? 'display' : 'home',
        })
      },
      clearStoreSession: () => set({ storeId: '', accessMode: 'manager', accessRole: null, dealerCode: '', accessLabel: '', sessionExpiresAt: null, activeTab: 'home' }),
      extendStoreSession: () => set((s) => s.storeId ? { sessionExpiresAt: Date.now() + SESSION_MS } : s),
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
      version: 2,
      partialize: (s) => ({ theme: s.theme, tempUnit: s.tempUnit, timeFormat: s.timeFormat, activeTab: s.activeTab }),
      migrate: (persisted) => {
        const state = persisted as Partial<UiState> | undefined
        return {
          activeTab: state?.activeTab ?? 'home',
          theme: state?.theme ?? getSystemTheme(),
          tempUnit: state?.tempUnit ?? 'F',
          timeFormat: state?.timeFormat ?? '12',
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) document.documentElement.className = state.theme
      },
    }
  )
)
