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
import { useUiStore } from './store/uiStore'
import { useLockStore, hashPin } from './store/lockStore'
import { useTheme } from './hooks/useTheme'

const DEFAULT_PIN = '6974'

export default function App() {
  const { activeTab } = useUiStore()
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

  if (activeTab === 'display') {
    return <DisplayPage />
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
