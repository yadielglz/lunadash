import { Suspense, lazy, useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { DataProvider } from './components/DataProvider'
import { FirstLoginOnboarding } from './components/FirstLoginOnboarding'
import { LockScreen } from './components/LockScreen'
import { StoreLaunchScreen } from './components/StoreLaunchScreen'
import { DashboardLoader } from './components/ui/DashboardLoader'
import { useUiStore } from './store/uiStore'
import { useLockStore, hashPin } from './store/lockStore'
import { isAnnouncementActive, useDisplayStore } from './store/displayStore'
import { useTheme } from './hooks/useTheme'
import { useEodSnapshotScheduler } from './hooks/useEodSnapshotScheduler'
import { useControllerInput } from './hooks/useControllerInput'
import { canAccessTab, defaultTabForRole } from './lib/accessControl'
import { dbGetKioskEnrollmentByToken, dbTouchKioskEnrollment, dbUpdateKioskEnrollment } from './lib/supabase'

const DEFAULT_PIN = '6974'
const KIOSK_ENROLLMENT_KEY = 'luna-kiosk-enrollment-token'
const TodayDashboard = lazy(() => import('./components/features/home/TodayDashboard').then((m) => ({ default: m.TodayDashboard })))
const DevicesPage = lazy(() => import('./components/features/devices/DevicesPage').then((m) => ({ default: m.DevicesPage })))
const EmployeesPage = lazy(() => import('./components/features/employees/EmployeesPage').then((m) => ({ default: m.EmployeesPage })))
const SchedulePage = lazy(() => import('./components/features/scheduling/SchedulePage').then((m) => ({ default: m.SchedulePage })))
const AppointmentsPage = lazy(() => import('./components/features/appointments/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })))
const TasksPage = lazy(() => import('./components/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })))
const PerformancePage = lazy(() => import('./components/features/performance/PerformancePage').then((m) => ({ default: m.PerformancePage })))
const GoalsPage = lazy(() => import('./components/features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const CommissionSnapshotPage = lazy(() => import('./components/features/commission/CommissionSnapshotPage').then((m) => ({ default: m.CommissionSnapshotPage })))
const ReportsPage = lazy(() => import('./components/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const PerformanceUpdatePage = lazy(() => import('./components/features/performance/PerformanceUpdatePage').then((m) => ({ default: m.PerformanceUpdatePage })))
const DisplayPage = lazy(() => import('./components/features/screendisplay/DisplayPage').then((m) => ({ default: m.DisplayPage })))
const SettingsPage = lazy(() => import('./components/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function DisplayFallback() {
  return <DashboardLoader label="Opening dashboard" />
}

function PageFallback() {
  return (
    <div className="h-full w-full p-4">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
        <div className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
            <div className="h-64 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
          </div>
          <div className="hidden space-y-4 lg:block">
            <div className="h-40 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
            <div className="h-48 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AnnouncementPopup() {
  const storeId = useUiStore((s) => s.storeId)
  const accessId = useUiStore((s) => s.accessId)
  const accessMode = useUiStore((s) => s.accessMode)
  const announcements = useDisplayStore((s) => s.announcements)
  const activeAnnouncements = announcements.filter((announcement) => isAnnouncementActive(announcement))
  const storageKey = `luna-announcements-seen:${storeId}:${accessId || 'session'}:${activeAnnouncements.map((a) => a.id).join(',')}`
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined' || activeAnnouncements.length === 0) return true
    return sessionStorage.getItem(storageKey) === '1'
  })

  useEffect(() => {
    if (activeAnnouncements.length === 0 || accessMode === 'display') {
      setDismissed(true)
      return
    }
    setDismissed(sessionStorage.getItem(storageKey) === '1')
  }, [accessMode, activeAnnouncements.length, storageKey])

  if (accessMode === 'display' || dismissed || activeAnnouncements.length === 0) return null

  const close = () => {
    sessionStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Store Announcements</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Active messages for this store.</p>
          </div>
          <button className="rounded-md px-2 py-1 text-xs text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)]" onClick={close}>
            Close
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {activeAnnouncements.map((announcement) => (
            <div key={announcement.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
              <div className="text-sm text-[var(--text)]">{announcement.text}</div>
              <div className="mt-1 text-[10px] uppercase text-[var(--text-tertiary)]">{announcement.priority}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

async function runKioskCommand(command: 'refresh' | 'update') {
  if (command === 'update') {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.update()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  }
  window.location.reload()
}

export default function App() {
  const { activeTab } = useUiStore()
  const storeId = useUiStore((s) => s.storeId)
  const accessMode = useUiStore((s) => s.accessMode)
  const accessRole = useUiStore((s) => s.accessRole)
  const accessId = useUiStore((s) => s.accessId)
  const setAccessSession = useUiStore((s) => s.setAccessSession)
  const needsOnboarding = useUiStore((s) => s.needsOnboarding)
  const sessionExpiresAt = useUiStore((s) => s.sessionExpiresAt)
  const clearStoreSession = useUiStore((s) => s.clearStoreSession)
  const extendStoreSession = useUiStore((s) => s.extendStoreSession)
  const { pinHash } = useLockStore()
  const [devicesUnlocked, setDevicesUnlocked] = useState(false)
  useTheme()
  useControllerInput()
  useEodSnapshotScheduler(Boolean(storeId))

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
    if (accessMode !== 'display' || accessRole !== 'display') return
    const token = window.localStorage.getItem(KIOSK_ENROLLMENT_KEY)
    if (!token) return

    let cancelled = false
    const pollKioskRemote = async () => {
      try {
        await dbTouchKioskEnrollment(token)
        const enrollment = await dbGetKioskEnrollmentByToken(token)
        if (cancelled) return
        if (!enrollment || enrollment.status !== 'approved') {
          window.localStorage.removeItem(KIOSK_ENROLLMENT_KEY)
          clearStoreSession()
          return
        }
        if (enrollment.store_id && enrollment.store_id !== storeId) {
          setAccessSession({
            id: enrollment.id,
            storeId: enrollment.store_id,
            role: 'display',
            dealerCode: 'KIOSK',
            label: enrollment.display_name || 'Kiosk Display',
            onboardedAt: enrollment.approved_at ?? new Date().toISOString(),
            mode: 'display',
          })
          return
        }
        const hasPendingCommand = enrollment.command
          && enrollment.command_issued_at
          && enrollment.command_ack_at !== enrollment.command_issued_at
        if (!hasPendingCommand) return

        await dbUpdateKioskEnrollment(enrollment.id, { command_ack_at: enrollment.command_issued_at })
        if (!cancelled && (enrollment.command === 'refresh' || enrollment.command === 'update')) {
          await runKioskCommand(enrollment.command)
        }
      } catch (err) {
        console.warn('Kiosk remote command check failed', err)
      }
    }

    pollKioskRemote()
    const id = window.setInterval(pollKioskRemote, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [accessId, accessMode, accessRole, clearStoreSession, setAccessSession, storeId])

  useEffect(() => {
    if (!storeId || !accessRole) return
    if (!canAccessTab(accessRole, activeTab, accessMode)) {
      useUiStore.getState().setTab(defaultTabForRole(accessRole, accessMode))
    }
  }, [accessMode, accessRole, activeTab, storeId])

  // Close the selected-store session after the configured inactivity timeout.
  useEffect(() => {
    if (!storeId || !sessionExpiresAt) return

    const checkSession = () => {
      if (Date.now() >= sessionExpiresAt) clearStoreSession()
    }

    checkSession()
    const id = window.setInterval(checkSession, 1000)
    return () => window.clearInterval(id)
  }, [clearStoreSession, sessionExpiresAt, storeId])

  useEffect(() => {
    if (!storeId || !sessionExpiresAt) return

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
  }, [extendStoreSession, sessionExpiresAt, storeId])

  if (!storeId) {
    return <StoreLaunchScreen />
  }

  if (needsOnboarding && accessRole !== 'display') {
    return <FirstLoginOnboarding />
  }

  if (activeTab === 'display') {
    return (
      <DataProvider>
        <Suspense fallback={<DisplayFallback />}>
          <DisplayPage />
        </Suspense>
      </DataProvider>
    )
  }

  const devicesContent = pinHash && !devicesUnlocked
    ? <LockScreen inline onUnlock={() => setDevicesUnlocked(true)} />
    : <DevicesPage />

  const pages: Record<string, React.ReactNode> = {
    home:     <TodayDashboard />,
    devices:  devicesContent,
    employees: <EmployeesPage />,
    schedule: <SchedulePage />,
    appointments: <AppointmentsPage />,
    tasks:    <TasksPage />,
    district: <PerformancePage />,
    goals:    <GoalsPage />,
    commission: <CommissionSnapshotPage />,
    reports: <ReportsPage />,
    updates:  <PerformanceUpdatePage />,
    settings: <SettingsPage />,
  }

  return (
      <DataProvider>
      <AppShell activeKey={activeTab}>
        <Suspense fallback={<PageFallback />}>
          {pages[activeTab]}
        </Suspense>
        <AnnouncementPopup />
      </AppShell>
    </DataProvider>
  )
}
