import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  BadgeDollarSign,
  Bell,
  Calendar,
  CalendarPlus,
  CheckSquare,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
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

const NAV_ITEMS: { id: Tab; icon: React.ReactNode; label: string; helper: string; group: NavGroup }[] = [
  { id: 'home', icon: <LayoutDashboard size={17} />, label: 'Today', helper: 'Daily operations brief', group: 'Overview' },
  { id: 'district', icon: <Radar size={17} />, label: 'District', helper: 'Rank and outlook', group: 'Overview' },
  { id: 'schedule', icon: <Calendar size={17} />, label: 'Schedule', helper: 'Coverage and shifts', group: 'Operations' },
  { id: 'appointments', icon: <CalendarPlus size={17} />, label: 'Appointments', helper: 'Customer pipeline', group: 'Operations' },
  { id: 'tasks', icon: <CheckSquare size={17} />, label: 'Checklist', helper: 'Open and close duties', group: 'Operations' },
  { id: 'devices', icon: <Smartphone size={17} />, label: 'Demos', helper: 'Activate and verify', group: 'Operations' },
  { id: 'employees', icon: <Users size={17} />, label: 'Team', helper: 'People and preferences', group: 'Operations' },
  { id: 'goals', icon: <BarChart3 size={17} />, label: 'Goals', helper: 'Targets and pace', group: 'Performance' },
  { id: 'commission', icon: <BadgeDollarSign size={17} />, label: 'Commissions', helper: 'Earnings snapshot', group: 'Performance' },
  { id: 'reports', icon: <FileText size={17} />, label: 'Reports', helper: 'Preview and print', group: 'Performance' },
  { id: 'updates', icon: <UploadCloud size={17} />, label: 'Data Updates', helper: 'Submit tracker data', group: 'Performance' },
  { id: 'display', icon: <Monitor size={17} />, label: 'Store Display', helper: 'Customer-facing screen', group: 'Workspace' },
  { id: 'settings', icon: <Settings size={17} />, label: 'Settings', helper: 'Workspace controls', group: 'Workspace' },
]

const NAV_GROUPS: NavGroup[] = ['Overview', 'Operations', 'Performance', 'Workspace']

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

function WeatherChip() {
  const { data, isLoading, isError } = useWeather(undefined, { useGeolocation: false })
  const { fmt, unit } = useTempDisplay()
  const setSettingsSection = useUiStore((s) => s.setSettingsSection)
  const setTab = useUiStore((s) => s.setTab)

  const openWeather = () => {
    setSettingsSection('weather')
    setTab('settings')
  }

  if (isLoading) {
    return (
      <span className="hidden lg:inline-flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs text-[var(--text-tertiary)]">
        Weather
      </span>
    )
  }

  if (isError || !data) {
    return (
      <button
        type="button"
        onClick={openWeather}
        className="hidden lg:inline-flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
      >
        Set weather
      </button>
    )
  }

  const current = data.current_weather
  const weather = getWeatherInfo(current.weathercode, current.is_day)

  return (
    <button
      type="button"
      onClick={openWeather}
      title={weather.label}
      className="hidden lg:inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
    >
      <span>{weather.icon}</span>
      <span className="font-semibold tabular-nums text-[var(--text)]">{fmt(current.temperature)}{unit}</span>
      <span className="hidden xl:inline max-w-[6.5rem] truncate">{weather.label}</span>
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
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/50 backdrop-blur-[2px] px-3 pt-[min(12vh,5rem)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-modal)]"
            role="dialog"
            aria-modal="true"
            aria-label="Quick search"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-3">
              <Search size={16} className="text-[var(--text-tertiary)] shrink-0" />
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
                placeholder="Jump to page, tool, or setting..."
              />
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)]">
                Esc
              </kbd>
            </div>
            <div className="max-h-[24rem] overflow-y-auto p-1.5">
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
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                      isSelected ? 'bg-[var(--accent-light)] text-[var(--text)]' : 'hover:bg-[var(--reveal-bg)]'
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                      isSelected
                        ? 'border-[var(--accent)]/30 bg-[var(--surface)] text-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                    )}>
                      {action.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text)]">{action.label}</span>
                      <span className="block truncate text-xs text-[var(--text-secondary)]">{action.helper}</span>
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
      detail: 'Open checklist to keep today on track',
      tone: 'var(--accent)',
      run: () => setTab('tasks'),
    }] : []),
  ]

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open notifications"
        aria-expanded={open}
        title="Notifications"
      >
        <Bell size={15} />
        {notices.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold leading-none text-white">
            {notices.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+0.5rem)] z-[90] w-[min(21rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-2 shadow-[var(--shadow-modal)]"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Notifications
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-1 space-y-1">
              {notices.length === 0 ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-5 text-center text-xs text-[var(--text-secondary)]">
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
                  className="flex w-full items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
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

function TopCommandBar({
  onOpenCommandMenu,
  onOpenTransferGuide,
}: {
  onOpenCommandMenu: () => void
  onOpenTransferGuide: () => void
}) {
  const now = useClock()
  const { toggleTheme, isDark } = useTheme()
  const accessRole = useUiStore((s) => s.accessRole)
  const activeTab = useUiStore((s) => s.activeTab)
  const clearStoreSession = useUiStore((s) => s.clearStoreSession)
  const setTab = useUiStore((s) => s.setTab)
  const storeId = useUiStore((s) => s.storeId)
  const timeFormat = useUiStore((s) => s.timeFormat)

  const activeLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'LunaDash'
  const mobileActiveLabel = MOBILE_NAV_LABELS[activeTab] ?? activeLabel
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: timeFormat !== '24' })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <header className="app-top-bar sticky top-0 z-40 flex min-h-[3.5rem] w-full items-center justify-between border-b border-[var(--border)] bg-[var(--command-bg)] px-3 sm:px-5 backdrop-blur-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => setTab('home')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 md:hidden"
          aria-label="Open Today"
        >
          <LunaWirelessLogo className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <div className="truncate text-sm sm:text-base font-bold text-[var(--text)] tracking-tight leading-tight">
            <span className="hidden sm:inline">{activeLabel}</span>
            <span className="sm:hidden">{mobileActiveLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] truncate">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--status-good)] shrink-0" />
            <span className="truncate">{storeId === 'main' ? 'All District Stores' : `Store ${storeId}`}</span>
            <span className="hidden xs:inline">·</span>
            <span className="hidden sm:inline font-medium text-[var(--text-secondary)]">{accessRoleLabel(accessRole)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
          onClick={() => setTab('schedule')}
          title={date}
        >
          <span className="hidden lg:inline">{date}</span>
          <span className="font-mono font-semibold tabular-nums text-[var(--text)]">{time}</span>
        </button>

        <WeatherChip />

        <button
          type="button"
          className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          onClick={onOpenTransferGuide}
          title="Carrier account number and transfer PIN guide"
          aria-label="Open carrier transfer guide"
        >
          <KeyRound size={14} className="text-[var(--accent)]" />
          <span className="hidden xl:inline">Port Guide</span>
        </button>

        <button
          type="button"
          className="flex h-8 w-8 lg:w-auto items-center justify-center lg:gap-2 lg:px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
          onClick={onOpenCommandMenu}
          aria-label="Quick search"
          title="Quick search (⌘K)"
        >
          <Search size={14} className="text-[var(--text-tertiary)]" />
          <span className="hidden lg:inline">Search</span>
          <kbd className="hidden lg:inline rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)] border border-[var(--border)]">
            ⌘K
          </kbd>
        </button>

        <NotificationCenter />

        <StorePickerButton className="hidden md:inline-flex" />

        <div className="hidden md:block h-4 w-px bg-[var(--border)] mx-0.5" />

        <button
          type="button"
          onClick={toggleTheme}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button
          type="button"
          onClick={clearStoreSession}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--status-danger-text)] hover:border-[var(--status-danger-border)] hover:bg-[var(--status-danger-bg)] transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  )
}

function NavigationRail({
  collapsed = false,
  mobile = false,
  onNavigate,
  onToggleCollapse,
  onOpenTransferGuide,
}: {
  collapsed?: boolean
  mobile?: boolean
  onNavigate?: () => void
  onToggleCollapse?: () => void
  onOpenTransferGuide?: () => void
}) {
  const { accessRole, activeTab, clearStoreSession, setTab } = useUiStore()
  const { toggleTheme, isDark } = useTheme()
  const visibleItems = NAV_ITEMS.filter((item) => canAccessTab(accessRole, item.id))

  const navigate = (tab: Tab) => {
    setTab(tab)
    onNavigate?.()
  }

  return (
    <nav className="flex h-full w-full flex-col select-none">
      {/* Brand Header */}
      {!mobile && (
        <div className={cn(
          'flex items-center justify-between gap-2 pb-3 mb-2 border-b border-[var(--border)]',
          collapsed && 'flex-col justify-center gap-2'
        )}>
          <button
            type="button"
            onClick={() => navigate('home')}
            className={cn('flex items-center gap-2.5 min-w-0 text-left', collapsed && 'justify-center')}
            title="LunaDash"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
              <LunaWirelessLogo className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-[var(--text)] leading-none">LunaDash</div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">Store Operations</div>
              </div>
            )}
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          )}
        </div>
      )}

      {/* Navigation Groups */}
      <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar py-1">
        {NAV_GROUPS.map((group) => {
          const items = visibleItems.filter((item) => item.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="space-y-0.5">
              <div className={cn(
                'px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]',
                collapsed && !mobile && 'sr-only'
              )}>
                {group}
              </div>
              {items.map((item) => {
                const active = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={cn(
                      'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      collapsed && !mobile && 'justify-center px-0',
                      active
                        ? 'bg-[var(--accent-light)] text-[var(--accent)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] font-medium'
                    )}
                    title={collapsed && !mobile ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center',
                      active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text)]'
                    )}>
                      {item.icon}
                    </span>
                    {(!collapsed || mobile) && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Mobile Drawer Quick Actions Footer */}
      {mobile && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {onOpenTransferGuide && (
              <button
                type="button"
                onClick={() => {
                  onNavigate?.()
                  onOpenTransferGuide()
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text)]"
              >
                <KeyRound size={14} className="text-[var(--accent)]" />
                <span>Port Guide</span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text)]"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <StorePickerButton className="flex-1 justify-center h-10 border border-[var(--border)] bg-[var(--surface-2)]" />
            <button
              type="button"
              onClick={() => {
                onNavigate?.()
                clearStoreSession()
              }}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-xs font-medium text-[var(--status-danger-text)]"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

function MobileBottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const { accessRole, activeTab, setTab } = useUiStore()
  const primaryTabs = NAV_ITEMS.filter((item) => (
    ['home', 'schedule', 'tasks', 'goals'].includes(item.id) && canAccessTab(accessRole, item.id)
  ))
  const moreActive = !primaryTabs.some((item) => item.id === activeTab)

  return (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 grid border-t border-[var(--border)] bg-[var(--command-bg)] px-1 pt-1.5 backdrop-blur-md md:hidden"
      style={{ gridTemplateColumns: `repeat(${primaryTabs.length + 1}, minmax(0, 1fr))` }}
      aria-label="Primary navigation"
    >
      {primaryTabs.map((item) => {
        const active = activeTab === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
              active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span className={cn(
              'flex h-7 w-11 items-center justify-center rounded-full transition-colors',
              active && 'bg-[var(--accent-light)]'
            )}>
              {item.icon}
            </span>
            <span className="leading-none">{MOBILE_NAV_LABELS[item.id] ?? item.label}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
          moreActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
        )}
        aria-label="Open all navigation"
      >
        <span className={cn(
          'flex h-7 w-11 items-center justify-center rounded-full transition-colors',
          moreActive && 'bg-[var(--accent-light)]'
        )}>
          <MoreHorizontal size={18} />
        </span>
        <span className="leading-none">More</span>
      </button>
    </nav>
  )
}

function MobileNavOverlay({
  open,
  onClose,
  onOpenTransferGuide,
}: {
  open: boolean
  onClose: () => void
  onOpenTransferGuide: () => void
}) {
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
          className="fixed inset-0 z-[80] flex items-end bg-black/55 backdrop-blur-[2px] md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[85dvh] min-h-0 w-full flex-col rounded-t-2xl border-t border-[var(--border-strong)] bg-[var(--surface)] px-4 pt-2.5 pb-[max(1rem,var(--safe-area-bottom))] shadow-[var(--shadow-modal)]"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LunaWirelessLogo className="h-5 w-5" />
                <span className="text-sm font-bold text-[var(--text)]">Navigation</span>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]"
                onClick={onClose}
                aria-label="Close navigation"
              >
                <X size={17} />
              </button>
            </div>
            <NavigationRail mobile onNavigate={onClose} onOpenTransferGuide={onOpenTransferGuide} />
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
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try {
      return localStorage.getItem('luna-left-rail-collapsed') === 'true'
    } catch {
      return false
    }
  })

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
        icon: <Settings size={16} />,
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
      icon: <KeyRound size={16} />,
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

  const toggleRailCollapsed = () => {
    setRailCollapsed((collapsed) => {
      const next = !collapsed
      try {
        localStorage.setItem('luna-left-rail-collapsed', String(next))
      } catch {
        // Non-critical preference cache.
      }
      return next
    })
  }

  if (activeTab === 'display') {
    return <>{children}</>
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      {/* Tablet Icon Rail (md to xl) */}
      <aside className="hidden h-full min-h-0 w-16 flex-shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)] p-2.5 md:block xl:hidden">
        <NavigationRail collapsed />
      </aside>

      {/* Desktop Collapsible Sidebar (xl+) */}
      <aside className={cn(
        'hidden h-full min-h-0 flex-shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)] p-3 transition-[width] duration-150 xl:block',
        railCollapsed ? 'w-16 px-2.5' : 'w-[232px]'
      )}>
        <NavigationRail collapsed={railCollapsed} onToggleCollapse={toggleRailCollapsed} />
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopCommandBar
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
        <MobileBottomNav onOpenMore={() => setMobileNavOpen(true)} />
      </div>

      <MobileNavOverlay
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onOpenTransferGuide={() => setTransferGuideOpen(true)}
      />
      <CommandMenu open={commandMenuOpen} onClose={() => setCommandMenuOpen(false)} actions={commandActions} />
      <CarrierTransferModal open={transferGuideOpen} onClose={() => setTransferGuideOpen(false)} />
    </div>
  )
}
