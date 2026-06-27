import { ReactNode, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  BadgeDollarSign,
  Calendar,
  CalendarPlus,
  CarFront,
  CheckSquare,
  ChevronLeft,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftOpen,
  Radar,
  Settings,
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

const NAV_ITEMS: { id: Tab; icon: React.ReactNode; label: string; helper: string }[] = [
  { id: 'home', icon: <LayoutDashboard size={18} />, label: 'Today', helper: 'Store Home' },
  { id: 'district', icon: <Radar size={18} />, label: 'District Outlook', helper: 'Region Rank' },
  { id: 'schedule', icon: <Calendar size={18} />, label: 'Schedule', helper: 'Store Coverage' },
  { id: 'appointments', icon: <CalendarPlus size={18} />, label: 'Appointments', helper: 'Customer Intake / CAD' },
  { id: 'tasks', icon: <CheckSquare size={18} />, label: 'Checklist', helper: 'Open and close' },
  { id: 'goals', icon: <BarChart3 size={18} />, label: 'Goals', helper: 'Currently Around Region' },
  { id: 'commission', icon: <BadgeDollarSign size={18} />, label: 'Commissions', helper: 'Most Recent Earnings Report' },
  { id: 'reports', icon: <FileText size={18} />, label: 'Reports', helper: 'Preview and print' },
  { id: 'employees', icon: <Users size={18} />, label: 'Employees', helper: 'Your Team Info' },
  { id: 'updates', icon: <UploadCloud size={18} />, label: 'Updates', helper: 'Update Tracker Here!' },
  { id: 'display', icon: <Monitor size={18} />, label: 'Display', helper: 'Store screen' },
  { id: 'settings', icon: <Settings size={18} />, label: 'Settings', helper: 'Options and More' },
]

const MOBILE_NAV_LABELS: Partial<Record<Tab, string>> = {
  home: 'Today',
  district: 'District',
  schedule: 'Schedule',
  appointments: 'Appts',
  tasks: 'Tasks',
  goals: 'Goals',
  commission: 'Earnings',
  reports: 'Reports',
  employees: 'Team',
  updates: 'Update',
  display: 'Display',
  settings: 'Settings',
}

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

function TrafficChip() {
  const { setSettingsSection, setTab } = useUiStore()

  const openTraffic = () => {
    setSettingsSection('traffic')
    setTab('settings')
  }

  return (
    <button className="command-chip command-traffic-chip hidden lg:inline-flex" onClick={openTraffic} title="Open traffic">
      <CarFront size={14} className="text-[var(--accent)]" />
      <span>Traffic</span>
    </button>
  )
}

function TopCommandBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
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
        <TrafficChip />
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

      <div className="command-nav-list space-y-1">
        {visibleItems.map((item) => {
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={cn('command-nav-item', active && 'command-nav-item-active')}
              title={collapsed && !mobile ? item.label : undefined}
              aria-label={item.label}
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
  const { activeTab, uiScale } = useUiStore()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try {
      return localStorage.getItem('luna-left-rail-collapsed') === 'true'
    } catch {
      return false
    }
  })
  const zoom = uiScale === '120' ? 1.2 : 1

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
          <TopCommandBar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="relative min-h-0 flex-1 overflow-hidden">
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
    </div>
  )
}
