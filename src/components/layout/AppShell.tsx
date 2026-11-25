import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  BadgeDollarSign,
  Bell,
  Calendar,
  CalendarPlus,
  CheckSquare,
  ChevronDown,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  Radar,
  Search,
  Settings,
  Smartphone,
  Sun,
  UploadCloud,
  Users,
  X,
} from 'lucide-react'
import { accessRoleLabel, Tab, useUiStore } from '../../store/uiStore'
import { useClock } from '../../hooks/useClock'
import { useTheme } from '../../hooks/useTheme'
import { useWeather } from '../../hooks/useWeather'
import { useTempDisplay } from '../../hooks/useTempDisplay'
import { getWeatherInfo } from '../../lib/openMeteo'
import { canAccessTab } from '../../lib/accessControl'
import { cn } from '../../lib/utils'
import { LunaWirelessLogo } from '../brand/LunaWirelessLogo'
import { StorePickerButton } from '../shared/StorePickerButton'
import { isAnnouncementActive, useDisplayStore } from '../../store/displayStore'
import { useSyncStore } from '../../store/syncStore'
import { useTasksStore } from '../../store/tasksStore'
import { CarrierTransferModal } from '../features/transfers/CarrierTransferModal'

type NavGroup = 'Overview' | 'Operations' | 'Performance' | 'Workspace'

const NAV_ITEMS: { id: Tab; icon: React.ReactNode; label: string; helper: string; group: NavGroup; primary?: boolean }[] = [
  { id: 'home', icon: <LayoutDashboard size={15} />, label: 'Today', helper: 'Daily operations brief', group: 'Overview', primary: true },
  { id: 'district', icon: <Radar size={15} />, label: 'District', helper: 'Rank and outlook', group: 'Overview', primary: true },
  { id: 'schedule', icon: <Calendar size={15} />, label: 'Schedule', helper: 'Coverage and shifts', group: 'Operations', primary: true },
  { id: 'appointments', icon: <CalendarPlus size={15} />, label: 'Appointments', helper: 'Customer pipeline', group: 'Operations', primary: true },
  { id: 'tasks', icon: <CheckSquare size={15} />, label: 'Checklist', helper: 'Open and close duties', group: 'Operations', primary: true },
  { id: 'devices', icon: <Smartphone size={15} />, label: 'Demos', helper: 'Activate and verify', group: 'Operations', primary: true },
  { id: 'goals', icon: <BarChart3 size={15} />, label: 'Goals', helper: 'Targets and pace', group: 'Performance', primary: true },
  { id: 'employees', icon: <Users size={15} />, label: 'Team', helper: 'People and preferences', group: 'Operations', primary: true },
  { id: 'commission', icon: <BadgeDollarSign size={15} />, label: 'Commissions', helper: 'Earnings snapshot', group: 'Performance' },
  { id: 'reports', icon: <FileText size={15} />, label: 'Reports', helper: 'Preview and print', group: 'Performance' },
  { id: 'updates', icon: <UploadCloud size={15} />, label: 'Data Updates', helper: 'Submit tracker data', group: 'Performance' },
  { id: 'display', icon: <Monitor size={15} />, label: 'Store Display', helper: 'Customer-facing screen', group: 'Workspace' },
  { id: 'settings', icon: <Settings size={15} />, label: 'Settings', helper: 'Workspace controls', group: 'Workspace' },
]

const MOBILE_NAV_LABELS: Partial<Record<Tab, string>> = {
  home: 'Today',
  district: 'District',
  schedule: 'Schedule',
  appointments: 'Appts',
  tasks: 'Tasks',
  protect: 'Protect',
  devices: 'Demos',
  goals: 'Goals',
  commission: 'Earnings',
  reports: 'Reports',
  employees: 'Team',
  updates: 'Updates',
  display: 'Display',
  settings: 'Settings',
}

const SETTINGS_COMMANDS = [
  { id: 'settings-general', section: 'general', label: 'General Settings', helper: 'Theme, zoom, time, and temperature', keywords: 'theme zoom time temperature' },
  { id: 'settings-weather', section: 'weather', label: 'Weather Settings', helper: 'Location and forecast setup', keywords: 'forecast location temperature' },
  { id: 'settings-display', section: 'display', label: 'Display Settings', helper: 'Screen display timing and layout', keywords: 'screen kiosk display' },
  { id: 'settings-remote', section: 'remote', label: 'Remote Settings', helper: 'Kiosk approvals and commands', keywords: 'remote kiosk approve' },
  { id: 'settings-access', section: 'access', label: 'Access Settings', helper: 'PINs and roles', keywords: 'login access roles pin' },
  { id: 'settings-sync', section: 'sync', label: 'Sync Status', helper: 'Database and sheet sync state', keywords: 'supabase database sync status' },
  { id: 'settings-about', section: 'about', label: 'About LunaDash', helper: 'Version, support, and update notes', keywords: 'version build support update' },
] as const

function localDateKey() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

interface AppShellProps {
  children: ReactNode
  activeKey: string
}

function WeatherPill() {
  const { data, isLoading, isError } = useWeather(undefined, { useGeolocation: false })
  const { fmt, unit } = useTempDisplay()
  const setSettingsSection = useUiStore((s) => s.setSettingsSection)
  const setTab = useUiStore((s) => s.setTab)

  const openWeather = () => {
    setSettingsSection('weather')
    setTab('settings')
  }

  if (isLoading || isError || !data) return null

  const current = data.current_weather
  const weather = getWeatherInfo(current.weathercode, current.is_day)

  return (
    <button
      type="button"
      onClick={openWeather}
      title={weather.label}
      className="hidden xl:inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/60 px-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
    >
      <span>{weather.icon}</span>
      <span className="font-medium tabular-nums text-[var(--text)]">{fmt(current.temperature)}{unit}</span>
    </button>
  )
}

type CommandAction = {
  id: string
  label: string
  helper: string
  icon: React.ReactNode
  keywords: string
  run: () => void
}

function CommandMenu({
  open,
  onClose,
  actions,
}: {
  open: boolean
  onClose: () => void
  actions: CommandAction[]
}) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return actions
    return actions.filter((action) => (
      `${action.label} ${action.helper} ${action.keywords}`.toLowerCase().includes(normalized)
    ))
  }, [actions, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const runAction = (action: CommandAction) => {
    action.run()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/45 backdrop-blur-[2px] px-3 pt-[min(12vh,5rem)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-modal)]"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-3">
              <Search size={15} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    onClose()
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setSelectedIndex((i) => filteredActions.length ? (i + 1) % filteredActions.length : 0)
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setSelectedIndex((i) => filteredActions.length ? (i - 1 + filteredActions.length) % filteredActions.length : 0)
                  } else if (event.key === 'Enter' && filteredActions[selectedIndex]) {
                    event.preventDefault()
                    runAction(filteredActions[selectedIndex])
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)]"
                placeholder="Type a page, tool, or setting..."
              />
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)]">
                ESC
              </kbd>
            </div>
            <div className="max-h-[22rem] overflow-y-auto p-1.5">
              {filteredActions.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-[var(--text-secondary)]">
                  No matching commands.
                </div>
              ) : filteredActions.map((action, idx) => {
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={action.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => runAction(action)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                      isSelected ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                    )}
                  >
                    <span className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                      isSelected
                        ? 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
                    )}>
                      {action.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text)]">{action.label}</span>
                      <span className="block truncate text-xs text-[var(--text-tertiary)]">{action.helper}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const setTab = useUiStore((state) => state.setTab)
  const setSettingsSection = useUiStore((state) => state.setSettingsSection)
  const tasks = useTasksStore((state) => state.tasks)
  const announcements = useDisplayStore((state) => state.announcements)
  const syncEntries = useSyncStore((state) => state.entries)
  const today = localDateKey()

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const openTasks = tasks.filter((task) => task.completedDate !== today).length
  const activeAnnouncements = announcements.filter((announcement) => isAnnouncementActive(announcement))
  const urgentAnnouncements = activeAnnouncements.filter((announcement) => announcement.priority === 'urgent').length
  const syncProblems = Object.entries(syncEntries).filter(([, entry]) => entry.state === 'error')
  const savingAreas = Object.entries(syncEntries).filter(([, entry]) => entry.state === 'saving')

  const notices = [
    ...(syncProblems.length ? [{
      id: 'sync-errors',
      label: `${syncProblems.length} sync issue${syncProblems.length === 1 ? '' : 's'}`,
      detail: syncProblems[0]?.[1].message ?? 'Review sync status',
      tone: 'var(--status-danger)',
      run: () => {
        setSettingsSection('sync')
        setTab('settings')
      },
    }] : []),
    ...(savingAreas.length ? [{
      id: 'sync-saving',
      label: 'Syncing changes',
      detail: savingAreas[0]?.[1].message ?? 'Database sync is active',
      tone: 'var(--status-warn)',
      run: () => {
        setSettingsSection('sync')
        setTab('settings')
      },
    }] : []),
    ...(urgentAnnouncements ? [{
      id: 'urgent-announcements',
      label: `${urgentAnnouncements} urgent announcement${urgentAnnouncements === 1 ? '' : 's'}`,
      detail: 'Review active store messages',
      tone: 'var(--status-warn)',
      run: () => {
        const isSmallScreen = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
        if (isSmallScreen) {
          setSettingsSection('display')
          setTab('settings')
        } else {
          setTab('display')
        }
      },
    }] : []),
    ...(openTasks ? [{
      id: 'open-tasks',
      label: `${openTasks} checklist item${openTasks === 1 ? '' : 's'} open`,
      detail: 'Open checklist to stay on track',
      tone: 'var(--accent)',
      run: () => setTab('tasks'),
    }] : []),
  ]

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open notifications"
        aria-expanded={open}
        title="Notifications"
      >
        <Bell size={14} />
        {notices.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--btn-primary-bg)] px-1 text-[9px] font-bold leading-none text-[var(--btn-primary-text)]">
            {notices.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+0.5rem)] z-[90] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-2 shadow-[var(--shadow-modal)]"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Notifications
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X size={13} />
              </button>
            </div>
            <div className="mt-1 space-y-1">
              {notices.length === 0 ? (
                <div className="rounded-lg bg-[var(--surface-2)] px-3 py-5 text-center text-xs text-[var(--text-secondary)]">
                  All clear — nothing needs attention.
                </div>
              ) : notices.map((notice) => (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() => {
                    notice.run()
                    setOpen(false)
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: notice.tone }} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-[var(--text)]">{notice.label}</span>
                    <span className="block text-[11px] text-[var(--text-secondary)] mt-0.5">{notice.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DesktopWorkspaceBar({
  onOpenCommandMenu,
  onOpenTransferGuide,
}: {
  onOpenCommandMenu: () => void
  onOpenTransferGuide: () => void
}) {
  const now = useClock()
  const { toggleTheme, isDark } = useTheme()
  const { accessRole, activeTab, clearStoreSession, setTab, storeId, timeFormat } = useUiStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessTab(accessRole, item.id)),
    [accessRole]
  )
  const primaryItems = visibleItems.filter((item) => item.primary)
  const secondaryItems = visibleItems.filter((item) => !item.primary)
  const activeSecondary = secondaryItems.find((item) => item.id === activeTab)

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: timeFormat !== '24' })
  const activeLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'LunaDash'

  useEffect(() => {
    if (!moreOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [moreOpen])

  return (
    <div className="app-top-bar sticky top-0 z-40 w-full bg-[var(--command-bg)] backdrop-blur-md border-b border-[var(--border)]">
      {/* Row 1: Utility & Command Bar */}
      <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5">
        {/* Left: Swiss Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setTab('home')}
            className="flex items-center gap-2 rounded-lg py-1 pr-1.5 text-left hover:opacity-80 transition-opacity"
            aria-label="Go to Today"
          >
            <LunaWirelessLogo className="h-6 w-6 shrink-0" />
            <span className="hidden sm:inline text-sm font-bold tracking-tight text-[var(--text)]">LunaDash</span>
          </button>

          <span className="text-[var(--border-strong)] select-none">/</span>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-xs sm:text-sm font-medium text-[var(--text)]">
              <span className="md:hidden">{MOBILE_NAV_LABELS[activeTab] ?? activeLabel}</span>
              <span className="hidden md:inline">{storeId === 'main' ? 'All Stores' : `Store ${storeId}`}</span>
            </span>
            <span className="hidden lg:inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
              {accessRoleLabel(accessRole)}
            </span>
          </div>

          <StorePickerButton className="hidden md:inline-flex ml-1" />
        </div>

        {/* Center: Prominent ⌘K Command Launcher (Desktop) */}
        <button
          type="button"
          onClick={onOpenCommandMenu}
          className="hidden md:flex h-8 w-full max-w-xs lg:max-w-sm items-center justify-between gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/70 px-3.5 text-xs text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <Search size={13} className="shrink-0" />
            <span className="truncate">Search pages, tools, settings…</span>
          </span>
          <kbd className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)] border border-[var(--border)] shrink-0">
            ⌘K
          </kbd>
        </button>

        {/* Right: Utilities */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('schedule')}
            className="hidden lg:inline-flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)]/60 px-2.5 font-mono text-xs font-medium tabular-nums text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
            title="Open Schedule"
          >
            {time}
          </button>

          <WeatherPill />

          <button
            type="button"
            onClick={onOpenTransferGuide}
            className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
            title="Carrier Port Guide"
          >
            <KeyRound size={13} />
            <span className="hidden xl:inline">Port Guide</span>
          </button>

          <button
            type="button"
            onClick={onOpenCommandMenu}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
            aria-label="Quick search"
          >
            <Search size={14} />
          </button>

          <NotificationCenter />

          <button
            type="button"
            onClick={toggleTheme}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
            title={isDark ? 'Switch to Daylight' : 'Switch to Obsidian Dark'}
            aria-label={isDark ? 'Switch to Daylight' : 'Switch to Obsidian Dark'}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            type="button"
            onClick={clearStoreSession}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--status-danger-border)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-text)] transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Row 2: Horizontal Workspace Tab Strip (Desktop & Tablet) */}
      <nav
        aria-label="Workspaces"
        className="hidden md:flex mx-auto max-w-[1600px] items-center justify-between px-3 sm:px-5"
      >
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {primaryItems.map((item) => {
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-medium transition-colors',
                  active ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                )}
              >
                <span className={active ? 'text-[var(--text)]' : 'text-[var(--text-tertiary)]'}>{item.icon}</span>
                <span>{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="workspace-tab-indicator"
                    className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--text)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
              </button>
            )
          })}

          {secondaryItems.length > 0 && (
            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className={cn(
                  'relative flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-medium transition-colors',
                  activeSecondary ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                )}
              >
                <span>{activeSecondary ? activeSecondary.label : 'More'}</span>
                <ChevronDown size={13} className={cn('transition-transform duration-150', moreOpen && 'rotate-180')} />
                {activeSecondary && (
                  <motion.span
                    layoutId="workspace-tab-indicator"
                    className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--text)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
              </button>

              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 top-[calc(100%+4px)] z-[85] w-56 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-modal)]"
                  >
                    {secondaryItems.map((item) => {
                      const active = activeTab === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setTab(item.id)
                            setMoreOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                            active
                              ? 'bg-[var(--surface-2)] font-semibold text-[var(--text)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
                          )}
                        >
                          <span className={active ? 'text-[var(--text)]' : 'text-[var(--text-tertiary)]'}>{item.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{item.label}</span>
                            <span className="block truncate text-[10px] text-[var(--text-tertiary)] font-normal">{item.helper}</span>
                          </span>
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}

function MobileFloatingDock({ onOpenMore }: { onOpenMore: () => void }) {
  const { accessRole, activeTab, setTab } = useUiStore()
  const primaryTabs = NAV_ITEMS.filter((item) => (
    ['home', 'schedule', 'tasks', 'goals'].includes(item.id) && canAccessTab(accessRole, item.id)
  ))
  const moreActive = !primaryTabs.some((item) => item.id === activeTab)

  return (
    <nav
      aria-label="Primary navigation"
      className="mobile-floating-dock fixed inset-x-3 z-50 mx-auto max-w-sm rounded-full border border-[var(--border-strong)] bg-[var(--surface)]/95 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl md:hidden"
    >
      <div
        className="grid items-center gap-1"
        style={{ gridTemplateColumns: `repeat(${primaryTabs.length + 1}, minmax(0, 1fr))` }}
      >
        {primaryTabs.map((item) => {
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[10px] font-medium transition-colors',
                active
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-semibold'
                  : 'text-[var(--text-secondary)] active:bg-[var(--surface-2)]'
              )}
            >
              {item.icon}
              <span className="leading-none">{MOBILE_NAV_LABELS[item.id] ?? item.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onOpenMore}
          aria-label="Open all workspaces"
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[10px] font-medium transition-colors',
            moreActive
              ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-semibold'
              : 'text-[var(--text-secondary)] active:bg-[var(--surface-2)]'
          )}
        >
          <MoreHorizontal size={15} />
          <span className="leading-none">More</span>
        </button>
      </div>
    </nav>
  )
}

function MobileWorkspaceSheet({
  open,
  onClose,
  onOpenTransferGuide,
}: {
  open: boolean
  onClose: () => void
  onOpenTransferGuide: () => void
}) {
  const { accessRole, activeTab, clearStoreSession, setTab, storeId } = useUiStore()
  const { toggleTheme, isDark } = useTheme()
  const visibleItems = NAV_ITEMS.filter((item) => canAccessTab(accessRole, item.id))

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end bg-black/50 backdrop-blur-[2px] md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[85dvh] min-h-0 w-full flex-col rounded-t-2xl border-t border-[var(--border-strong)] bg-[var(--surface)] px-4 pt-3 pb-[max(1.25rem,var(--safe-area-bottom))] shadow-[var(--shadow-modal)]"
            role="dialog"
            aria-modal="true"
            aria-label="All workspaces"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-[var(--text)]">Workspaces</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">
                  {storeId === 'main' ? 'All District Stores' : `Store ${storeId}`} · {accessRoleLabel(accessRole)}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 overflow-y-auto py-1">
              {visibleItems.map((item) => {
                const active = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id)
                      onClose()
                    }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-[var(--text)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)]/60 text-[var(--text)]'
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate text-xs font-semibold">{item.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenTransferGuide()
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text)]"
                >
                  <KeyRound size={14} />
                  <span>Port Guide</span>
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text)]"
                >
                  {isDark ? <Sun size={14} /> : <Moon size={14} />}
                  <span>{isDark ? 'Daylight' : 'Obsidian'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <StorePickerButton className="flex-1 justify-center h-10 border border-[var(--border)] bg-[var(--surface-2)]" />
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    clearStoreSession()
                  }}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-xs font-medium text-[var(--status-danger-text)]"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AppShell({ children, activeKey }: AppShellProps) {
  const { accessRole, activeTab, setSettingsSection, setTab } = useUiStore()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [transferGuideOpen, setTransferGuideOpen] = useState(false)

  const commandActions = useMemo<CommandAction[]>(() => {
    const pageActions = NAV_ITEMS
      .filter((item) => canAccessTab(accessRole, item.id))
      .map((item) => ({
        id: `tab-${item.id}`,
        label: item.label,
        helper: item.helper,
        icon: item.icon,
        keywords: `${item.id} ${item.label} ${item.helper}`,
        run: () => setTab(item.id),
      }))
    const settingsActions = SETTINGS_COMMANDS
      .filter(() => canAccessTab(accessRole, 'settings'))
      .map((item) => ({
        id: item.id,
        label: item.label,
        helper: item.helper,
        icon: <Settings size={15} />,
        keywords: item.keywords,
        run: () => {
          setSettingsSection(item.section)
          setTab('settings')
        },
      }))

    const utilityActions: CommandAction[] = [{
      id: 'carrier-transfer-guide',
      label: 'Carrier Transfer Guide',
      helper: 'Account numbers, transfer PINs, and port notes',
      icon: <KeyRound size={15} />,
      keywords: 'carrier port transfer pin account number att verizon xfinity spectrum metro cricket',
      run: () => setTransferGuideOpen(true),
    }]

    return [...utilityActions, ...pageActions, ...settingsActions]
  }, [accessRole, setSettingsSection, setTab])

  useEffect(() => {
    const openCommandMenu = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandMenuOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', openCommandMenu)
    return () => window.removeEventListener('keydown', openCommandMenu)
  }, [])

  if (activeTab === 'display') {
    return <>{children}</>
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <DesktopWorkspaceBar
        onOpenCommandMenu={() => setCommandMenuOpen(true)}
        onOpenTransferGuide={() => setTransferGuideOpen(true)}
      />

      <main id="main-content" className="relative min-h-0 flex-1 overflow-hidden" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeKey}
            className="app-page-viewport absolute inset-0 overflow-y-auto overflow-x-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileFloatingDock onOpenMore={() => setMobileNavOpen(true)} />

      <MobileWorkspaceSheet
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onOpenTransferGuide={() => setTransferGuideOpen(true)}
      />
      <CommandMenu open={commandMenuOpen} onClose={() => setCommandMenuOpen(false)} actions={commandActions} />
      <CarrierTransferModal open={transferGuideOpen} onClose={() => setTransferGuideOpen(false)} />
    </div>
  )
}
