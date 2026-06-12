import { motion } from 'framer-motion'
import {
  LayoutGrid, Calendar, Target, Settings, Monitor, UploadCloud, Users, CheckSquare
} from 'lucide-react'
import { useUiStore, Tab } from '../../store/uiStore'
import { cn } from '../../lib/utils'
import { canAccessTab } from '../../lib/accessControl'

const TABS: { id: Tab; icon: React.ReactNode; label: string; mobile?: boolean }[] = [
  { id: 'home',     icon: <LayoutGrid size={18} />,  label: 'Home'     },
  { id: 'employees', icon: <Users size={18} />,      label: 'Employees' },
  { id: 'schedule', icon: <Calendar size={18} />,    label: 'Schedule' },
  { id: 'tasks',    icon: <CheckSquare size={18} />, label: 'Checklist' },
  { id: 'goals',    icon: <Target size={18} />,      label: 'Performance' },
  { id: 'updates',  icon: <UploadCloud size={18} />, label: 'Update' },
  { id: 'display',  icon: <Monitor size={18} />,     label: 'Display' },
  { id: 'settings', icon: <Settings size={18} />,    label: 'Settings' },
]

export function Taskbar() {
  const { activeTab, accessRole, setTab } = useUiStore()
  const visibleTabs = TABS.filter((tab) => (
    canAccessTab(accessRole, tab.id)
    && (tab.id !== 'display' || accessRole === 'employee')
  ))

  return (
    <nav
      className="app-taskbar chrome-bar hidden bg-[var(--taskbar-bg)] border-t border-[var(--border)] flex-shrink-0 z-50 shadow-[0_-1px_0_rgba(255,255,255,0.04)] sm:block"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      {/* Desktop: centered icon bar */}
      <div className="hidden sm:flex items-center justify-center gap-1.5 px-4 h-14">
        {visibleTabs.map(({ id, icon, label }) => {
          const active = activeTab === id
          return (
            <motion.button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'taskbar-tab relative flex h-11 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-md border px-3 transition-colors duration-150',
                active
                  ? 'taskbar-tab-active border-[var(--accent)]/30 bg-[var(--accent)]/12 text-[var(--accent)] shadow-[inset_0_1px_rgba(255,255,255,0.06)]'
                  : 'taskbar-tab-idle border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
              )}
              whileTap={{ scale: 0.92 }}
            >
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <motion.span
                  layoutId="taskbar-indicator"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[var(--accent)]"
                />
              )}
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
