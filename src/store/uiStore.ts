import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeAccessCode, normalizeStoreId } from '../lib/storeIds'

export type Tab = 'home' | 'devices' | 'schedule' | 'goals' | 'updates' | 'weather' | 'display' | 'tasks' | 'settings'
export type Theme = 'dark' | 'light' | 'vista'
export type Brand = 'default' | 'tmobile'
export type TempUnit = 'C' | 'F'
export type TimeFormat = '12' | '24'
export type AccessMode = 'manager' | 'display' | 'admin'
export type AccessRole = 'admin' | 'district_manager' | 'manager' | 'employee' | 'display'

export function accessRoleLabel(role: AccessRole | null) {
  if (role === 'employee' || role === 'display') return 'Store Access'
  if (role === 'district_manager') return 'District Manager'
  if (role === 'manager') return 'Manager'
  if (role === 'admin') return 'Admin'
  return 'None'
}

const SESSION_MS = 2 * 60 * 1000

interface UiState {
  activeTab: Tab
  theme: Theme
  brand: Brand
  tempUnit: TempUnit
  timeFormat: TimeFormat
  storeId: string          // unique per-store key, shared across all devices in that store
  accessMode: AccessMode
  accessRole: AccessRole | null
  accessId: string
  dealerCode: string
  accessLabel: string
  needsOnboarding: boolean
  sessionExpiresAt: number | null
  isEditingWidgets: boolean
  settingsSection: string
  setTab: (tab: Tab) => void
  setSettingsSection: (section: string) => void
  setTheme: (theme: Theme) => void
  setBrand: (brand: Brand) => void
  toggleTheme: () => void
  setTempUnit: (unit: TempUnit) => void
  toggleTempUnit: () => void
  setTimeFormat: (fmt: TimeFormat) => void
  setStoreId: (id: string) => void
  setAccessMode: (mode: AccessMode) => void
  setAccessSession: (access: { id: string; storeId: string; role: AccessRole; dealerCode: string; label?: string | null; mode?: AccessMode; onboardedAt?: string | null }) => void
  setAccessOnboarded: () => void
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
      brand: 'default',
      tempUnit: 'F' as TempUnit,
      timeFormat: '12' as TimeFormat,
      storeId: '',
      accessMode: 'manager',
      accessRole: null,
      accessId: '',
      dealerCode: '',
      accessLabel: '',
      needsOnboarding: false,
      sessionExpiresAt: null,
      isEditingWidgets: false,
      settingsSection: 'general',
      setTab: (tab) => set({ activeTab: tab }),
      setSettingsSection: (section) => set({ settingsSection: section }),
      setTempUnit: (unit) => set({ tempUnit: unit }),
      toggleTempUnit: () => set((s) => ({ tempUnit: s.tempUnit === 'C' ? 'F' : 'C' })),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
      setStoreId: (id) => {
        const storeId = normalizeStoreId(id)
        set({ storeId, sessionExpiresAt: storeId ? Date.now() + SESSION_MS : null })
      },
      setAccessMode: (mode) => set({ accessMode: mode, activeTab: mode === 'display' ? 'display' : get().activeTab }),
      setAccessSession: ({ id, storeId, role, dealerCode, label, mode, onboardedAt }) => {
        const accessMode = mode ?? (role === 'admin' ? 'admin' : 'manager')
        set({
          storeId: normalizeStoreId(storeId),
          accessRole: role,
          accessId: id,
          accessMode,
          dealerCode: normalizeAccessCode(dealerCode),
          accessLabel: label ?? '',
          needsOnboarding: role !== 'display' && !onboardedAt,
          sessionExpiresAt: Date.now() + SESSION_MS,
          activeTab: accessMode === 'display' ? 'display' : 'home',
        })
      },
      setAccessOnboarded: () => set({ needsOnboarding: false }),
      clearStoreSession: () => set({ storeId: '', accessMode: 'manager', accessRole: null, accessId: '', dealerCode: '', accessLabel: '', needsOnboarding: false, sessionExpiresAt: null, activeTab: 'home' }),
      extendStoreSession: () => set((s) => s.storeId ? { sessionExpiresAt: Date.now() + SESSION_MS } : s),
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.classList.remove('dark', 'light', 'vista')
        document.documentElement.classList.add(theme)
      },
      setBrand: (brand) => {
        set({ brand })
        if (brand === 'tmobile') {
          document.documentElement.style.setProperty('--accent', '#E20074')
          document.documentElement.style.setProperty('--accent-hover', '#B5005D')
        } else {
          document.documentElement.style.removeProperty('--accent')
          document.documentElement.style.removeProperty('--accent-hover')
        }
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        document.documentElement.classList.remove('dark', 'light', 'vista')
        document.documentElement.classList.add(next)
      },
      setEditingWidgets: (v) => set({ isEditingWidgets: v }),
    }),
    {
      name: 'luna-ui',
      version: 2,
      partialize: (s) => ({ theme: s.theme, brand: s.brand, tempUnit: s.tempUnit, timeFormat: s.timeFormat, activeTab: s.activeTab }),
      migrate: (persisted) => {
        const state = persisted as Partial<UiState> | undefined
        return {
          activeTab: state?.activeTab ?? 'home',
          theme: state?.theme ?? getSystemTheme(),
          brand: state?.brand ?? 'default',
          tempUnit: state?.tempUnit ?? 'F',
          timeFormat: state?.timeFormat ?? '12',
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.classList.remove('dark', 'light', 'vista')
          document.documentElement.classList.add(state.theme)
          if (state.brand === 'tmobile') {
            document.documentElement.style.setProperty('--accent', '#E20074')
            document.documentElement.style.setProperty('--accent-hover', '#B5005D')
          } else {
            document.documentElement.style.removeProperty('--accent')
            document.documentElement.style.removeProperty('--accent-hover')
          }
        }
      },
    }
  )
)
