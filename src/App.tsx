import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { DataProvider } from './components/DataProvider'
import { WidgetGrid } from './components/widgets/WidgetGrid'
import { DevicesPage } from './components/features/devices/DevicesPage'
import { SchedulePage } from './components/features/scheduling/SchedulePage'
import { GoalsPage } from './components/features/goals/GoalsPage'
import { WeatherPage } from './components/features/weather/WeatherPage'
import { DisplayPage } from './components/features/screendisplay/DisplayPage'
import { SettingsPage } from './components/features/settings/SettingsPage'
import { TasksPage } from './components/features/tasks/TasksPage'
import { LockScreen } from './components/LockScreen'
import { StoreLaunchScreen } from './components/StoreLaunchScreen'
import { useUiStore } from './store/uiStore'
import { useLockStore, hashPin } from './store/lockStore'
import { useTheme } from './hooks/useTheme'
import { canAccessTab, defaultTabForRole } from './lib/accessControl'

const DEFAULT_PIN = '6974'

export default function App() {
  const { activeTab } = useUiStore()
  const storeId = useUiStore((s) => s.storeId)
  const accessMode = useUiStore((s) => s.accessMode)
  const accessRole = useUiStore((s) => s.accessRole)
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

  if (activeTab === 'display') {
    return (
      <DataProvider>
        <DisplayPage />
      </DataProvider>
    )
  }

  const devicesContent = pinHash && !devicesUnlocked
    ? <LockScreen inline onUnlock={() => setDevicesUnlocked(true)} />
    : <DevicesPage />

  const pages: Record<string, React.ReactNode> = {
    home:     <WidgetGrid />,
    devices:  devicesContent,
    schedule: <SchedulePage />,
    goals:    <GoalsPage />,
    weather:  <WeatherPage />,
    tasks:    <TasksPage />,
    settings: <SettingsPage />,
  }

  return (
    <DataProvider>
      <AppShell activeKey={activeTab}>
        {pages[activeTab]}
      </AppShell>
    </DataProvider>
  )
}
