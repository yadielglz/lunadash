import { ReactNode, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  BadgeDollarSign,
  Bell,
  Calendar,
  CalendarPlus,
  CheckSquare,
  ChevronLeft,
  Command,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
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

type NavGroup = 'Overview' | 'Operations' | 'Performance' | 'Workspace'

const NAV_ITEMS: { id: Tab; icon: React.ReactNode; label: string; helper: string; group: NavGroup }[] = [
  { id: 'home', icon: <LayoutDashboard size={18} />, label: 'Today', helper: 'Daily brief', group: 'Overview' },
  { id: 'district', icon: <Radar size={18} />, label: 'District', helper: 'Rank and outlook', group: 'Overview' },
  { id: 'schedule', icon: <Calendar size={18} />, label: 'Schedule', helper: 'Coverage and shifts', group: 'Operations' },
  { id: 'appointments', icon: <CalendarPlus size={18} />, label: 'Appointments', helper: 'Customer pipeline', group: 'Operations' },
  { id: 'tasks', icon: <CheckSquare size={18} />, label: 'Checklist', helper: 'Open and close', group: 'Operations' },
  { id: 'devices', icon: <Smartphone size={18} />, label: 'Demo Management', helper: 'Activate and verify', group: 'Operations' },
  { id: 'employees', icon: <Users size={18} />, label: 'Team', helper: 'People and preferences', group: 'Operations' },
  { id: 'goals', icon: <BarChart3 size={18} />, label: 'Goals', helper: 'Targets and pace', group: 'Performance' },
  { id: 'commission', icon: <BadgeDollarSign size={18} />, label: 'Commissions', helper: 'Earnings snapshot', group: 'Performance' },
  { id: 'reports', icon: <FileText size={18} />, label: 'Reports', helper: 'Preview and print', group: 'Performance' },
  { id: 'updates', icon: <UploadCloud size={18} />, label: 'Data updates', helper: 'Submit tracker data', group: 'Performance' },
  { id: 'display', icon: <Monitor size={18} />, label: 'Store display', helper: 'Customer-facing screen', group: 'Workspace' },
  { id: 'settings', icon: <Settings size={18} />, label: 'Settings', helper: 'Workspace controls', group: 'Workspace' },
]

const NAV_GROUPS: NavGroup[] = ['Overview', 'Operations', 'Performance', 'Workspace']

const MOBILE_NAV_LABELS: Partial<Record<Tab, string>> = {
  home: 'Today',
  district: 'District',
  schedule: 'Schedule',
  appointments: 'Appts',
  tasks: 'Tasks',
  devices: 'Demos',
  goals: 'Goals',
  commission: 'Earnings',
  reports: 'Reports',
  employees: 'Team',
  updates: 'Update',
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

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

interface AppShellProps {
  children: ReactNode
  activeKey: string
}

function WeatherChip() {
  const { data, isLoading, isError } = useWeather(undefined, { useGeolocation: false })
  const { fmt, unit } = useTempDisplay()
  const { setSettingsSection, setTab } = useUiStore()

  const openWeather = () => {
    setSettingsSection('weather')
    setTab('settings')
  }

  if (isLoading) {
    return <span className="command-chip hidden md:inline-flex">Weather</span>
  }

  if (isError || !data) {
    return (
      <button className="command-chip hidden md:inline-flex" onClick={openWeather}>
        Set weather
      </button>
    )
  }

  const current = data.current_weather
  const weather = getWeatherInfo(current.weathercode, current.is_day)

  return (
    <button className="command-chip hidden md:inline-flex" onClick={openWeather} title={weather.label}>
      <span>{weather.icon}</span>
      <span className="tabular-nums text-[var(--text)]">{fmt(current.temperature)}{unit}</span>
      <span className="max-w-[7rem] truncate">{weather.label}</span>
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

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return actions
    return actions.filter((action) => (
      `${action.label} ${action.helper} ${action.keywords}`.toLowerCase().includes(normalized)
    ))
  }, [actions, query])

  const runAction = (action: CommandAction) => {
    action.run()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/45 px-3 pt-[min(12vh,5rem)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="command-menu-panel w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-modal)]"
            role="dialog"
            aria-modal="true"
            aria-label="Search pages and settings"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <Search size={18} className="text-[var(--text-tertiary)]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') onClose()
                  if (event.key === 'Enter' && filteredActions[0]) runAction(filteredActions[0])
                }}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)]"
                placeholder="Search pages and settings"
              />
              <kbd className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">Esc</kbd>
            </div>
            <div className="max-h-[26rem] overflow-y-auto p-2">
              {filteredActions.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-[var(--text-secondary)]">No matching command.</div>
              ) : filteredActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runAction(action)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--reveal-bg)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--accent)]">{action.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--text)]">{action.label}</span>
                    <span className="block truncate text-xs text-[var(--text-secondary)]">{action.helper}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const setTab = useUiStore((state) => state.setTab)
  const setSettingsSection = useUiStore((state) => state.setSettingsSection)
  const tasks = useTasksStore((state) => state.tasks)
  const announcements = useDisplayStore((state) => state.announcements)
  const syncEntries = useSyncStore((state) => state.entries)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
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
      tone: '#c94040',
      run: () => {
        setSettingsSection('sync')
        setTab('settings')
      },
    }] : []),
    ...(savingAreas.length ? [{
      id: 'sync-saving',
      label: 'Changes are syncing',
      detail: savingAreas[0]?.[1].message ?? 'Database sync is active',
      tone: '#c98408',
      run: () => {
        setSettingsSection('sync')
        setTab('settings')
      },
    }] : []),
    ...(urgentAnnouncements ? [{
      id: 'urgent-announcements',
      label: `${urgentAnnouncements} urgent announcement${urgentAnnouncements === 1 ? '' : 's'}`,
      detail: 'Review active store display messages',
      tone: '#c98408',
      run: () => setTab('display'),
    }] : []),
    ...(openTasks ? [{
      id: 'open-tasks',
      label: `${openTasks} checklist item${openTasks === 1 ? '' : 's'} open`,
      detail: 'Open the checklist to keep today moving',
      tone: 'var(--accent)',
      run: () => setTab('tasks'),
    }] : []),
  ]

  return (
    <div className="relative">
      <button
        type="button"
        className="command-icon-button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open notifications"
        title="Notifications"
      >
        <Bell size={16} />
        {notices.length > 0 && <span className="command-notification-dot">{notices.length}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="command-popover absolute right-0 top-[calc(100%+0.5rem)] z-[90] w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-modal)]"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="text-sm font-semibold text-[var(--text)]">Notifications</div>
              <button className="rounded-md p-1 text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)]" onClick={() => setOpen(false)} aria-label="Close notifications">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {notices.length === 0 ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-5 text-center text-sm text-[var(--text-secondary)]">
                  Everything looks quiet.
                </div>
              ) : notices.map((notice) => (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() => {
                    notice.run()
                    setOpen(false)
                  }}
                  className="flex w-full items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
                >
                  <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: notice.tone }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">{notice.label}</span>
                    <span className="block text-xs text-[var(--text-secondary)]">{notice.detail}</span>
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

function TopCommandBar({ onOpenMobileNav, onOpenCommandMenu }: { onOpenMobileNav: () => void; onOpenCommandMenu: () => void }) {
  const now = useClock()
  const { toggleTheme, isDark } = useTheme()
  const {
    accessLabel,
    accessRole,
    activeTab,
    clearStoreSession,
    setTab,
    storeId,
  } = useUiStore()
  const activeLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'LunaDash'
  const mobileActiveLabel = MOBILE_NAV_LABELS[activeTab] ?? activeLabel
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <header className="command-bar">
      <div className="command-bar-title">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="command-icon-button lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={19} />
        </button>
        <button
          type="button"
          onClick={() => setTab('home')}
          className="luna-logo-badge hidden h-10 w-10 items-center justify-center lg:flex"
          aria-label="Open Today"
        >
          <LunaWirelessLogo className="h-8 w-8" />
        </button>
        <div className="command-page-title min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--text)]">
            <span className="hidden sm:inline">{activeLabel}</span>
            <span className="sm:hidden">{mobileActiveLabel}</span>
          </div>
          <div className="command-page-subtitle truncate text-xs text-[var(--text-tertiary)]">
            {storeId === 'main' ? 'All stores' : `Store ${storeId}`} · {accessRoleLabel(accessRole)}
          </div>
        </div>
      </div>

      <div className="command-bar-actions">
        <button className="command-chip command-chip-time" onClick={() => setTab('schedule')} title={date}>
          <span className="hidden sm:inline">{date}</span>
          <span className="tabular-nums text-[var(--text)]">{time}</span>
        </button>
        <WeatherChip />
        <button type="button" className="command-chip hidden md:inline-flex" onClick={onOpenCommandMenu}>
          <Command size={14} />
          <span>Search</span>
          <kbd className="text-[10px] text-[var(--text-tertiary)]">⌘K</kbd>
        </button>
        <NotificationCenter />
        <StorePickerButton className="hidden sm:inline-flex" />
        {accessRole && (
          <div className="hidden min-w-0 flex-col items-end leading-tight xl:flex">
            <span className="text-[10px] font-semibold uppercase text-[var(--accent)]">{accessRoleLabel(accessRole)}</span>
            <span className="max-w-[10rem] truncate text-[10px] text-[var(--text-tertiary)]">{accessLabel || 'Access session'}</span>
          </div>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className="command-icon-button command-theme-button"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          onClick={clearStoreSession}
          className="command-icon-button command-logout-button hidden sm:inline-flex"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut size={16} />
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
}: {
  collapsed?: boolean
  mobile?: boolean
  onNavigate?: () => void
  onToggleCollapse?: () => void
}) {
  const { accessRole, activeTab, setTab } = useUiStore()
  const visibleItems = NAV_ITEMS.filter((item) => canAccessTab(accessRole, item.id))

  const navigate = (tab: Tab) => {
    setTab(tab)
    onNavigate?.()
  }

  return (
    <nav className={cn('command-nav', collapsed && !mobile && 'command-nav-collapsed', mobile && 'command-nav-mobile')}>
      <div className={cn('mb-5 flex items-center gap-3 px-2', collapsed && !mobile && 'justify-center px-0')}>
        <div className="luna-logo-badge flex h-12 w-12 items-center justify-center">
          <LunaWirelessLogo className="h-9 w-9" />
        </div>
        <div className={cn('min-w-0', collapsed && !mobile && 'hidden')}>
          <div className="text-sm font-semibold text-[var(--text)]">LunaDash</div>
          <div className="text-xs text-[var(--text-tertiary)]">Store operations</div>
        </div>
      </div>
      {onToggleCollapse && !mobile && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn('command-nav-toggle mb-3', collapsed && 'mx-auto w-10 justify-center px-0')}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <Menu size={16} />}
          {!collapsed && <span>Navigation</span>}
        </button>
      )}

      <div className="command-nav-list no-scrollbar">
        {NAV_GROUPS.map((group) => {
          const items = visibleItems.filter((item) => item.group === group)
          if (items.length === 0) return null
          return (
            <div className="command-nav-group" key={group}>
              <div className={cn('command-nav-group-label', collapsed && !mobile && 'sr-only')}>{group}</div>
              <div className="space-y-1">
                {items.map((item) => {
                  const active = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.id)}
                      className={cn('command-nav-item', active && 'command-nav-item-active')}
                      title={collapsed && !mobile ? item.label : undefined}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="command-nav-icon">{item.icon}</span>
                      <span className={cn('min-w-0 flex-1 text-left', collapsed && !mobile && 'hidden')}>
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        <span className="block truncate text-[11px] text-[var(--text-tertiary)]">{item.helper}</span>
                      </span>
                      {active && !collapsed && <ChevronLeft size={14} className="hidden text-[var(--accent)] lg:block" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

function MobileNavOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] bg-black/50 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="command-mobile-drawer flex h-full min-h-0 w-[min(21rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)] px-3 shadow-[var(--shadow-modal)] backdrop-blur-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-3 flex justify-end">
              <button className="command-icon-button" onClick={onClose} aria-label="Close navigation">
                <X size={18} />
              </button>
            </div>
            <NavigationRail mobile onNavigate={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AppShell({ children, activeKey }: AppShellProps) {
  const { accessRole, activeTab, setSettingsSection, setTab, uiScale } = useUiStore()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try {
      return localStorage.getItem('luna-left-rail-collapsed') === 'true'
    } catch {
      return false
    }
  })
  const zoom = uiScale === '120' ? 1.2 : 1
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
        icon: <Settings size={17} />,
        keywords: item.keywords,
        run: () => {
          setSettingsSection(item.section)
          setTab('settings')
        },
      }))

    return [...pageActions, ...settingsActions]
  }, [accessRole, setSettingsSection, setTab])

  useEffect(() => {
    const openCommandMenu = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandMenuOpen(true)
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
    <div className="h-full w-full overflow-hidden bg-[var(--bg)]">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div
        className="app-command-shell"
        style={{
          width: `${100 / zoom}%`,
          height: `${100 / zoom}%`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        <aside className={cn(
          'chrome-bar hidden h-full min-h-0 flex-shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)] p-3 transition-[width] duration-200 lg:block',
          railCollapsed ? 'w-[5rem]' : 'w-[17rem]'
        )}>
          <NavigationRail collapsed={railCollapsed} onToggleCollapse={toggleRailCollapsed} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopCommandBar
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onOpenCommandMenu={() => setCommandMenuOpen(true)}
          />
          <main id="main-content" className="relative min-h-0 flex-1 overflow-hidden" tabIndex={-1}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeKey}
                className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <MobileNavOverlay open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <CommandMenu open={commandMenuOpen} onClose={() => setCommandMenuOpen(false)} actions={commandActions} />
    </div>
  )
}
