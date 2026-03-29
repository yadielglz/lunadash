import { motion } from 'framer-motion'
import {
  LayoutGrid, Monitor, Calendar, Target, CloudSun, Tv2, CheckSquare, Settings
} from 'lucide-react'
import { useUiStore, Tab } from '../../store/uiStore'
import { cn } from '../../lib/utils'

const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: 'home',     icon: <LayoutGrid size={18} />,  label: 'Home'     },
  { id: 'devices',  icon: <Monitor size={18} />,     label: 'Devices'  },
  { id: 'schedule', icon: <Calendar size={18} />,    label: 'Schedule' },
  { id: 'goals',    icon: <Target size={18} />,      label: 'Goals'    },
  { id: 'weather',  icon: <CloudSun size={18} />,    label: 'Weather'  },
  { id: 'display',  icon: <Tv2 size={18} />,         label: 'Display'  },
  { id: 'tasks',    icon: <CheckSquare size={18} />, label: 'Tasks'    },
  { id: 'settings', icon: <Settings size={18} />,    label: 'Settings' },
]

export function Taskbar() {
  const { activeTab, setTab } = useUiStore()

  return (
    <nav
      className="mica border-t border-[var(--border)] flex-shrink-0 z-50"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      {/* Desktop: centered icon bar */}
      <div className="hidden sm:flex items-center justify-center gap-1 px-4 h-14">
        {TABS.map(({ id, icon, label }) => {
          const active = activeTab === id
          return (
            <motion.button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors duration-150 min-w-[64px]',
                active
                  ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--reveal-bg)]'
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

      {/* Mobile: full-width tabs */}
      <div className="sm:hidden flex items-stretch h-16">
        {TABS.map(({ id, icon, label }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 relative',
                active
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-tertiary)]'
              )}
            >
              {active && (
                <motion.span
                  layoutId="taskbar-indicator-mobile"
                  className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-[var(--accent)]"
                />
              )}
              {icon}
              <span className="text-[9px] font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
