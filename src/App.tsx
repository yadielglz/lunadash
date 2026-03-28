import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { DataProvider } from './components/DataProvider'
import { WidgetGrid } from './components/widgets/WidgetGrid'
import { DevicesPage } from './components/features/devices/DevicesPage'
import { SchedulePage } from './components/features/scheduling/SchedulePage'
import { GoalsPage } from './components/features/goals/GoalsPage'
import { WeatherPage } from './components/features/weather/WeatherPage'
import { DisplayPage } from './components/features/screendisplay/DisplayPage'
import { SettingsPage } from './components/features/settings/SettingsPage'
import { LockScreen } from './components/LockScreen'
import { useUiStore } from './store/uiStore'
import { useLockStore } from './store/lockStore'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const { activeTab } = useUiStore()
  const { pinHash, isLocked } = useLockStore()
  useTheme()

  const { theme } = useUiStore()
  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  // Show lock screen if a PIN is set and app is locked
  if (pinHash && isLocked) {
    return <LockScreen />
  }

  if (activeTab === 'display') {
    return <DisplayPage />
  }

  const pages: Record<string, React.ReactNode> = {
    home:     <WidgetGrid />,
    devices:  <DevicesPage />,
    schedule: <SchedulePage />,
    goals:    <GoalsPage />,
    weather:  <WeatherPage />,
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
