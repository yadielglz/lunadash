import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeAccessCode, normalizeStoreId } from '../lib/storeIds'
import { isInstalledPwa } from '../lib/pwa'

export type Tab = 'home' | 'devices' | 'employees' | 'schedule' | 'appointments' | 'district' | 'goals' | 'commission' | 'reports' | 'updates' | 'mrc-calculator' | 'nr-tracking' | 'weather' | 'display' | 'tasks' | 'settings'
export type Theme = 'dark' | 'light' | 'vista' | 'mac' | 'carbon' | 'mint' | 'coral' | 'iris' | 'graphite' | 'aurora' | 'tide' | 'citrus' | 'rosewood' | 'highland'
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
const PWA_ACCESS_SESSION_KEY = 'lunadash-pwa-access-session'
const SESSION_TIMEOUT_MS: Record<Exclude<SessionTimeout, 'never'>, number> = {
  '2m': 2 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
}
const THEME_CLASSES: Theme[] = ['dark', 'light', 'vista', 'mac', 'carbon', 'mint', 'coral', 'iris', 'graphite', 'aurora', 'tide', 'citrus', 'rosewood', 'highland']
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
  void brand
  document.documentElement.style.removeProperty('--accent')
  document.documentElement.style.removeProperty('--accent-hover')
  document.documentElement.style.removeProperty('--accent-light')
  document.documentElement.style.removeProperty('--accent-glow')
}

function sessionExpiresAtFor(timeout: SessionTimeout) {
  return timeout === 'never' ? null : Date.now() + SESSION_TIMEOUT_MS[timeout]
}

type PersistedPwaSession = Pick<
  UiState,
  'storeId' | 'accessMode' | 'accessRole' | 'accessId' | 'dealerCode' | 'accessLabel' | 'needsOnboarding'
>

function readPwaAccessSession(): PersistedPwaSession | null {
  if (!isInstalledPwa()) return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PWA_ACCESS_SESSION_KEY) || 'null') as Partial<PersistedPwaSession> | null
    if (!parsed?.storeId || !parsed.accessRole || !parsed.accessId) return null
    return {
      storeId: normalizeStoreId(parsed.storeId),
      accessMode: parsed.accessMode === 'display' || parsed.accessMode === 'admin' ? parsed.accessMode : 'manager',
      accessRole: parsed.accessRole,
      accessId: parsed.accessId,
      dealerCode: normalizeAccessCode(parsed.dealerCode || ''),
      accessLabel: parsed.accessLabel || '',
      needsOnboarding: Boolean(parsed.needsOnboarding),
    }
  } catch {
    window.localStorage.removeItem(PWA_ACCESS_SESSION_KEY)
    return null
  }
}

function writePwaAccessSession(state: UiState) {
  if (!isInstalledPwa() || !state.storeId || !state.accessRole || !state.accessId) return
  const session: PersistedPwaSession = {
    storeId: state.storeId,
    accessMode: state.accessMode,
    accessRole: state.accessRole,
    accessId: state.accessId,
    dealerCode: state.dealerCode,
    accessLabel: state.accessLabel,
    needsOnboarding: state.needsOnboarding,
  }
  window.localStorage.setItem(PWA_ACCESS_SESSION_KEY, JSON.stringify(session))
}

function removePwaAccessSession() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(PWA_ACCESS_SESSION_KEY)
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
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function canonicalTheme(theme: Theme | undefined): Theme {
  if (theme === 'dark' || theme === 'carbon' || theme === 'graphite' || theme === 'aurora' || theme === 'rosewood') return 'dark'
  return 'light'
}

function persistedPreferences(persisted: unknown) {
  const state = persisted as Partial<UiState> | undefined
  return {
    activeTab: state?.activeTab ?? 'home',
    theme: state?.theme && THEME_CLASSES.includes(state.theme) ? canonicalTheme(state.theme) : getSystemTheme(),
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
        sessionExpiresAt: s.storeId && !isInstalledPwa() ? sessionExpiresAtFor(DEFAULT_SESSION_TIMEOUT) : null,
      })),
      setStoreId: (id) => {
        const storeId = normalizeStoreId(id)
        set({ storeId, sessionExpiresAt: storeId && !isInstalledPwa() ? sessionExpiresAtFor(get().sessionTimeout) : null })
        writePwaAccessSession(get())
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
          sessionExpiresAt: isInstalledPwa() ? null : sessionExpiresAtFor(get().sessionTimeout),
          activeTab: accessMode === 'display' ? 'display' : 'home',
        })
        writePwaAccessSession(get())
      },
      setAccessOnboarded: () => {
        set({ needsOnboarding: false })
        writePwaAccessSession(get())
      },
      clearStoreSession: () => {
        removePwaAccessSession()
        set({ storeId: '', accessMode: 'manager', accessRole: null, accessId: '', dealerCode: '', accessLabel: '', needsOnboarding: false, sessionExpiresAt: null, activeTab: 'home' })
      },
      extendStoreSession: () => set((s) => s.storeId && !isInstalledPwa() ? { sessionExpiresAt: sessionExpiresAtFor(s.sessionTimeout) } : s),
      setTheme: (theme) => {
        set({ theme, brand: 'default' })
        applyThemeClass(theme)
        applyBrandAccent('default')
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
      version: 3,
      partialize: (s) => ({ theme: s.theme, brand: s.brand, tempUnit: s.tempUnit, timeFormat: s.timeFormat, uiScale: s.uiScale, activeTab: s.activeTab, settingsSection: s.settingsSection }),
      migrate: (persisted) => persistedPreferences(persisted),
      merge: (persisted, current) => {
        const pwaSession = readPwaAccessSession()
        return {
          ...current,
          ...persistedPreferences(persisted),
          storeId: pwaSession?.storeId ?? '',
          accessMode: pwaSession?.accessMode ?? 'manager',
          accessRole: pwaSession?.accessRole ?? null,
          accessId: pwaSession?.accessId ?? '',
          dealerCode: pwaSession?.dealerCode ?? '',
          accessLabel: pwaSession?.accessLabel ?? '',
          needsOnboarding: pwaSession?.needsOnboarding ?? false,
          sessionExpiresAt: null,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeClass(state.theme)
          applyBrandAccent(state.brand)
        }
      },
    }
  )
)
