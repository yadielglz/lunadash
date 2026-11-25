import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeAccessCode, normalizeStoreId } from '../lib/storeIds'
import { isInstalledPwa } from '../lib/pwa'

export type Tab = 'home' | 'protect' | 'devices' | 'employees' | 'schedule' | 'appointments' | 'district' | 'goals' | 'commission' | 'reports' | 'updates' | 'mrc-calculator' | 'nr-tracking' | 'weather' | 'display' | 'tasks' | 'settings'
export type Theme = 'obsidian' | 'daylight' | 'magenta' | 'slate'
export type TempUnit = 'C' | 'F'
export type TimeFormat = '12' | '24'
export type UiScale = '100' | '120'
export type SessionTimeout = '2m' | '15m' | '1h' | '4h' | 'never'
export type AccessMode = 'manager' | 'display' | 'admin'
export type AccessRole = 'admin' | 'district_manager' | 'manager' | 'employee' | 'display'

export const DARK_THEMES: Theme[] = ['obsidian', 'magenta']
export const ALL_THEMES: Theme[] = ['obsidian', 'daylight', 'magenta', 'slate']

export function isDarkTheme(theme: Theme): boolean {
  return DARK_THEMES.includes(theme)
}

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

const LEGACY_THEME_MAP: Record<string, Theme> = {
  obsidian: 'obsidian',
  daylight: 'daylight',
  magenta: 'magenta',
  slate: 'slate',
  console: 'obsidian',
  dark: 'obsidian',
  carbon: 'obsidian',
  graphite: 'obsidian',
  aurora: 'obsidian',
  rosewood: 'magenta',
  light: 'daylight',
  mac: 'daylight',
  vista: 'daylight',
  mint: 'daylight',
  coral: 'daylight',
  iris: 'daylight',
  tide: 'daylight',
  citrus: 'daylight',
  highland: 'daylight',
  'console-light': 'slate',
}

export function canonicalTheme(theme: string | undefined): Theme {
  if (!theme) return 'daylight'
  return LEGACY_THEME_MAP[theme] ?? 'daylight'
}

export function applyThemeToDocument(theme: Theme, uiScale: UiScale = '100') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove(...ALL_THEMES, 'dark', 'ui-scale-120')
  root.classList.add(theme)
  if (isDarkTheme(theme)) {
    root.classList.add('dark')
  }
  if (uiScale === '120') {
    root.classList.add('ui-scale-120')
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    metaTheme.setAttribute('content', isDarkTheme(theme) ? '#09090b' : '#fafafa')
  }
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
  tempUnit: TempUnit
  timeFormat: TimeFormat
  uiScale: UiScale
  sessionTimeout: SessionTimeout
  storeId: string
  accessMode: AccessMode
  accessRole: AccessRole | null
  accessId: string
  dealerCode: string
  accessLabel: string
  needsOnboarding: boolean
  sessionExpiresAt: number | null
  settingsSection: string
  setTab: (tab: Tab) => void
  setSettingsSection: (section: string) => void
  setTheme: (theme: Theme) => void
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
}

function persistedPreferences(persisted: unknown) {
  const state = persisted as Partial<UiState> & { theme?: string } | undefined
  return {
    activeTab: state?.activeTab ?? 'home',
    theme: canonicalTheme(state?.theme),
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
      theme: 'daylight',
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
      settingsSection: 'general',
      setTab: (tab) => set({ activeTab: tab }),
      setSettingsSection: (section) => set({ settingsSection: section }),
      setTempUnit: (unit) => set({ tempUnit: unit }),
      toggleTempUnit: () => set((s) => ({ tempUnit: s.tempUnit === 'C' ? 'F' : 'C' })),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
      setUiScale: (scale) => {
        set({ uiScale: scale })
        applyThemeToDocument(get().theme, scale)
      },
      setSessionTimeout: (timeout) => set((s) => ({
        sessionTimeout: timeout,
        sessionExpiresAt: s.storeId && !isInstalledPwa() ? sessionExpiresAtFor(timeout) : null,
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
        const next = canonicalTheme(theme)
        set({ theme: next })
        applyThemeToDocument(next, get().uiScale)
      },
      toggleTheme: () => {
        const next: Theme = isDarkTheme(get().theme) ? 'daylight' : 'obsidian'
        set({ theme: next })
        applyThemeToDocument(next, get().uiScale)
      },
    }),
    {
      name: 'luna-ui',
      version: 6,
      partialize: (s) => ({
        theme: s.theme,
        tempUnit: s.tempUnit,
        timeFormat: s.timeFormat,
        uiScale: s.uiScale,
        activeTab: s.activeTab,
        settingsSection: s.settingsSection,
      }),
      migrate: (persisted, version) => {
        const prefs = persistedPreferences(persisted)
        return version < 6 ? { ...prefs, theme: 'daylight' as Theme } : prefs
      },
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
          applyThemeToDocument(state.theme, state.uiScale)
        }
      },
    }
  )
)
