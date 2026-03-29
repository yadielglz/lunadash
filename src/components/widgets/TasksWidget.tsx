import { motion } from 'framer-motion'
import { Card } from '../ui/Card'
import { useTasksStore } from '../../store/tasksStore'
import type { TaskCategory } from '../../store/tasksStore'
import { useUiStore } from '../../store/uiStore'

const today = () => new Date().toISOString().split('T')[0]

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  opening: '#16c60c',
  closing: '#f7630c',
  general: '#0078d4',
}

const CATEGORY_ORDER: TaskCategory[] = ['opening', 'closing', 'general']

export function TasksWidget() {
  const { tasks } = useTasksStore()
  const { setTab } = useUiStore()

  const todayStr = today()
  const done = tasks.filter((t) => t.completedDate === todayStr).length
  const pct  = tasks.length > 0 ? (done / tasks.length) * 100 : 0

  return (
    <Card
      className="h-full flex flex-col gap-3 cursor-pointer group"
      interactive
      onClick={() => setTab('tasks')}
      style={{
        background: 'linear-gradient(135deg, rgba(22,198,12,0.07) 0%, rgba(0,120,212,0.05) 100%)',
        borderColor: 'rgba(22,198,12,0.18)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Daily Tasks</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)]">
          {done}/{tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[var(--text-tertiary)]">No tasks yet</p>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--accent)' }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Per-category breakdown */}
          <div className="space-y-1.5">
            {CATEGORY_ORDER.map((cat) => {
              const catTasks = tasks.filter((t) => t.category === cat)
              if (catTasks.length === 0) return null
              const catDone = catTasks.filter((t) => t.completedDate === todayStr).length
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[cat] }}
                  />
                  <span className="text-[11px] text-[var(--text-secondary)] capitalize flex-1">{cat}</span>
                  <span className="text-[11px] font-medium text-[var(--text)]">{catDone}/{catTasks.length}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
