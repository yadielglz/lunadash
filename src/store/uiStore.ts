import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeAccessCode, normalizeStoreId } from '../lib/storeIds'

export type Tab = 'home' | 'devices' | 'employees' | 'schedule' | 'appointments' | 'district' | 'goals' | 'updates' | 'weather' | 'display' | 'tasks' | 'settings'
export type Theme = 'dark' | 'light' | 'vista' | 'mac'
export type Brand = 'default' | 'tmobile' | 'green' | 'black' | 'yellow'
export type TempUnit = 'C' | 'F'
export type TimeFormat = '12' | '24'
export type UiScale = '100' | '120'
export type SessionTimeout = '2m' | '15m' | '1h' | '4h' | 'never'
export type AccessMode = 'manager' | 'display' | 'admin'
export type AccessRole = 'admin' | 'district_manager' | 'manager' | 'employee' | 'display'

export function accessRoleLabel(role: AccessRole | null) {
  if (role === 'employee' || role === 'display') return 'Store Access'
  if (role === 'district_manager') return 'District Manager'
  if (role === 'manager') return 'Manager'
  if (role === 'admin') return 'Admin'
  return 'None'
}

const DEFAULT_SESSION_TIMEOUT: SessionTimeout = '15m'
const SESSION_TIMEOUT_MS: Record<Exclude<SessionTimeout, 'never'>, number> = {
  '2m': 2 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
}
const THEME_CLASSES: Theme[] = ['dark', 'light', 'vista', 'mac']
const BRAND_ACCENTS: Record<Exclude<Brand, 'default'>, {
  accent: string
  hover: string
  light: string
  glow: string
}> = {
  tmobile: { accent: '#E20074', hover: '#B5005D', light: '#ffe0f0', glow: 'rgba(226, 0, 116, 0.18)' },
  green:   { accent: '#16a34a', hover: '#15803d', light: '#dcfce7', glow: 'rgba(22, 163, 74, 0.18)' },
  black:   { accent: '#111827', hover: '#030712', light: '#e5e7eb', glow: 'rgba(17, 24, 39, 0.22)' },
  yellow:  { accent: '#a16207', hover: '#854d0e', light: '#fef3c7', glow: 'rgba(161, 98, 7, 0.22)' },
}

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.remove(...THEME_CLASSES)
  document.documentElement.classList.add(theme)
}

function applyBrandAccent(brand: Brand) {
  const accent = brand === 'default' ? null : BRAND_ACCENTS[brand]
  if (!accent) {
    document.documentElement.style.removeProperty('--accent')
    document.documentElement.style.removeProperty('--accent-hover')
    document.documentElement.style.removeProperty('--accent-light')
    document.documentElement.style.removeProperty('--accent-glow')
    return
  }
  document.documentElement.style.setProperty('--accent', accent.accent)
  document.documentElement.style.setProperty('--accent-hover', accent.hover)
  document.documentElement.style.setProperty('--accent-light', accent.light)
  document.documentElement.style.setProperty('--accent-glow', accent.glow)
}

function sessionExpiresAtFor(timeout: SessionTimeout) {
  return timeout === 'never' ? null : Date.now() + SESSION_TIMEOUT_MS[timeout]
}

interface UiState {
  activeTab: Tab
  theme: Theme
  brand: Brand
  tempUnit: TempUnit
  timeFormat: TimeFormat
  uiScale: UiScale
  sessionTimeout: SessionTimeout
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
  setUiScale: (scale: UiScale) => void
  setSessionTimeout: (timeout: SessionTimeout) => void
  setStoreId: (id: string) => void
  setAccessMode: (mode: AccessMode) => void
  setAccessSession: (access: { id: string; storeId: string; role: AccessRole; dealerCode: string; label?: string | null; mode?: AccessMode; onboardedAt?: string | null }) => void
  setAccessOnboarded: () => void
  clearStoreSession: () => void
  extendStoreSession: () => void
  setEditingWidgets: (v: boolean) => void
}

function getSystemTheme(): Theme {
  return 'mac'
}

function persistedPreferences(persisted: unknown) {
  const state = persisted as Partial<UiState> | undefined
  return {
    activeTab: state?.activeTab ?? 'home',
    theme: state?.theme && THEME_CLASSES.includes(state.theme) ? state.theme : getSystemTheme(),
    brand: state?.brand && (state.brand === 'default' || state.brand in BRAND_ACCENTS) ? state.brand : 'default',
    tempUnit: state?.tempUnit ?? 'F',
    timeFormat: state?.timeFormat ?? '12',
    uiScale: state?.uiScale === '120' ? '120' : '100',
    sessionTimeout: DEFAULT_SESSION_TIMEOUT,
    settingsSection: state?.settingsSection ?? 'general',
  } satisfies Partial<UiState>
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      activeTab: 'home',
      theme: getSystemTheme(),
      brand: 'default',
      tempUnit: 'F' as TempUnit,
      timeFormat: '12' as TimeFormat,
      uiScale: '100' as UiScale,
      sessionTimeout: DEFAULT_SESSION_TIMEOUT,
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
      setUiScale: (scale) => set({ uiScale: scale }),
      setSessionTimeout: () => set((s) => ({
        sessionTimeout: DEFAULT_SESSION_TIMEOUT,
        sessionExpiresAt: s.storeId ? sessionExpiresAtFor(DEFAULT_SESSION_TIMEOUT) : null,
      })),
      setStoreId: (id) => {
        const storeId = normalizeStoreId(id)
        set({ storeId, sessionExpiresAt: storeId ? sessionExpiresAtFor(get().sessionTimeout) : null })
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
          sessionExpiresAt: sessionExpiresAtFor(get().sessionTimeout),
          activeTab: accessMode === 'display' ? 'display' : 'home',
        })
      },
      setAccessOnboarded: () => set({ needsOnboarding: false }),
      clearStoreSession: () => set({ storeId: '', accessMode: 'manager', accessRole: null, accessId: '', dealerCode: '', accessLabel: '', needsOnboarding: false, sessionExpiresAt: null, activeTab: 'home' }),
      extendStoreSession: () => set((s) => s.storeId ? { sessionExpiresAt: sessionExpiresAtFor(s.sessionTimeout) } : s),
      setTheme: (theme) => {
        set({ theme })
        applyThemeClass(theme)
      },
      setBrand: (brand) => {
        set({ brand })
        applyBrandAccent(brand)
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        applyThemeClass(next)
      },
      setEditingWidgets: (v) => set({ isEditingWidgets: v }),
    }),
    {
      name: 'luna-ui',
      version: 2,
      partialize: (s) => ({ theme: s.theme, brand: s.brand, tempUnit: s.tempUnit, timeFormat: s.timeFormat, uiScale: s.uiScale, activeTab: s.activeTab, settingsSection: s.settingsSection }),
      migrate: (persisted) => persistedPreferences(persisted),
      merge: (persisted, current) => ({
        ...current,
        ...persistedPreferences(persisted),
        storeId: '',
        accessMode: 'manager',
        accessRole: null,
        accessId: '',
        dealerCode: '',
        accessLabel: '',
        needsOnboarding: false,
        sessionExpiresAt: null,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeClass(state.theme)
          applyBrandAccent(state.brand)
        }
      },
    }
  )
)
