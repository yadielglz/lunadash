import { Suspense, lazy, useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { DataProvider } from './components/DataProvider'
import { FirstLoginOnboarding } from './components/FirstLoginOnboarding'
import { LockScreen } from './components/LockScreen'
import { StoreLaunchScreen } from './components/StoreLaunchScreen'
import { useUiStore } from './store/uiStore'
import { useLockStore, hashPin } from './store/lockStore'
import { useTheme } from './hooks/useTheme'
import { canAccessTab, defaultTabForRole } from './lib/accessControl'

const DEFAULT_PIN = '6974'
const SalesHomeDashboard = lazy(() => import('./components/features/performance/SalesHomeDashboard').then((m) => ({ default: m.SalesHomeDashboard })))
const DevicesPage = lazy(() => import('./components/features/devices/DevicesPage').then((m) => ({ default: m.DevicesPage })))
const SchedulePage = lazy(() => import('./components/features/scheduling/SchedulePage').then((m) => ({ default: m.SchedulePage })))
const GoalsPage = lazy(() => import('./components/features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const DisplayPage = lazy(() => import('./components/features/screendisplay/DisplayPage').then((m) => ({ default: m.DisplayPage })))
const SettingsPage = lazy(() => import('./components/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function PageFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-[var(--text-tertiary)]">
      Loading LunaDash...
    </div>
  )
}

export default function App() {
  const { activeTab } = useUiStore()
  const storeId = useUiStore((s) => s.storeId)
  const accessMode = useUiStore((s) => s.accessMode)
  const accessRole = useUiStore((s) => s.accessRole)
  const needsOnboarding = useUiStore((s) => s.needsOnboarding)
  const sessionExpiresAt = useUiStore((s) => s.sessionExpiresAt)
  const clearStoreSession = useUiStore((s) => s.clearStoreSession)
  const extendStoreSession = useUiStore((s) => s.extendStoreSession)
  const { pinHash } = useLockStore()
  const [devicesUnlocked, setDevicesUnlocked] = useState(false)
  useTheme()

  const { theme } = useUiStore()
  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  // Seed default PIN on first load if none is set
  useEffect(() => {
    const { pinHash, setPinHash } = useLockStore.getState()
    if (!pinHash) {
      hashPin(DEFAULT_PIN).then((h) => setPinHash(h))
    }
  }, [])

  // Re-lock devices whenever user leaves the tab
  useEffect(() => {
    if (activeTab !== 'devices') setDevicesUnlocked(false)
  }, [activeTab])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)')
    const leaveDisplayOnMobile = () => {
      if (media.matches && useUiStore.getState().activeTab === 'display' && useUiStore.getState().accessMode !== 'display') {
        useUiStore.getState().setTab('home')
      }
    }
    leaveDisplayOnMobile()
    media.addEventListener('change', leaveDisplayOnMobile)
    return () => media.removeEventListener('change', leaveDisplayOnMobile)
  }, [])

  useEffect(() => {
    if (accessMode === 'display' && activeTab !== 'display') {
      useUiStore.getState().setTab('display')
    }
  }, [accessMode, activeTab])

  useEffect(() => {
    if (!storeId || !accessRole) return
    if (!canAccessTab(accessRole, activeTab, accessMode)) {
      useUiStore.getState().setTab(defaultTabForRole(accessRole, accessMode))
    }
  }, [accessMode, accessRole, activeTab, storeId])

  // Close the selected-store session after 2 minutes of inactivity unless a passive display is active.
  useEffect(() => {
    if (!storeId || !sessionExpiresAt) return
    if (activeTab === 'display' || activeTab === 'goals') return

    const remaining = sessionExpiresAt - Date.now()
    if (remaining <= 0) {
      clearStoreSession()
      return
    }

    const id = window.setTimeout(() => clearStoreSession(), remaining)
    return () => window.clearTimeout(id)
  }, [activeTab, clearStoreSession, sessionExpiresAt, storeId])

  useEffect(() => {
    if (!storeId) return
    if (activeTab === 'display' || activeTab === 'goals') return

    let lastExtended = 0
    const refreshSession = () => {
      const now = Date.now()
      if (now - lastExtended < 10_000) return
      lastExtended = now
      extendStoreSession()
    }
    const options: AddEventListenerOptions = { capture: true, passive: true }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll']

    events.forEach((eventName) => window.addEventListener(eventName, refreshSession, options))
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, refreshSession, options))
    }
  }, [activeTab, extendStoreSession, storeId])

  if (!storeId) {
    return <StoreLaunchScreen />
  }

  if (needsOnboarding && accessRole !== 'display') {
    return <FirstLoginOnboarding />
  }

  if (activeTab === 'display') {
    return (
      <DataProvider>
        <Suspense fallback={<PageFallback />}>
          <DisplayPage />
        </Suspense>
      </DataProvider>
    )
  }

  const devicesContent = pinHash && !devicesUnlocked
    ? <LockScreen inline onUnlock={() => setDevicesUnlocked(true)} />
    : <DevicesPage />

  const pages: Record<string, React.ReactNode> = {
    home:     <SalesHomeDashboard />,
    devices:  devicesContent,
    schedule: <SchedulePage />,
    goals:    <GoalsPage />,
    settings: <SettingsPage />,
  }

  return (
    <DataProvider>
      <AppShell activeKey={activeTab}>
        <Suspense fallback={<PageFallback />}>
          {pages[activeTab]}
        </Suspense>
      </AppShell>
    </DataProvider>
  )
}
