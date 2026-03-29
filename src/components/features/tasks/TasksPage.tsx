import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Plus, Check, Trash2 } from 'lucide-react'
import { useTasksStore } from '../../../store/tasksStore'
import type { Task, TaskCategory } from '../../../store/tasksStore'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { Input, Select } from '../../ui/Input'

const today = () => new Date().toISOString().split('T')[0]

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  opening: '#16c60c',
  closing: '#f7630c',
  general: '#0078d4',
}

const CATEGORY_ORDER: TaskCategory[] = ['opening', 'closing', 'general']

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task }: { task: Task }) {
  const { toggleTask, removeTask } = useTasksStore()
  const isDone = task.completedDate === today()

  return (
    <motion.div
      layout
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--reveal-bg)] transition-colors group"
    >
      <button
        onClick={() => toggleTask(task.id)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isDone
            ? 'bg-[var(--accent)] border-[var(--accent)]'
            : 'border-[var(--border)] hover:border-[var(--accent)]'
        }`}
      >
        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <Check size={11} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <span className={`flex-1 text-sm transition-colors ${
        isDone ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text)]'
      }`}>
        {task.title}
      </span>

      <button
        onClick={() => removeTask(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-red-400 transition-all flex-shrink-0"
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  )
}

// ── Add task modal ────────────────────────────────────────────────────────────
function AddTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTask, tasks } = useTasksStore()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<TaskCategory>('general')

  useEffect(() => {
    if (open) { setTitle(''); setCategory('general') }
  }, [open])

  const save = () => {
    if (!title.trim()) return
    const sortOrder = tasks.filter((t) => t.category === category).length
    addTask({ title: title.trim(), category, sortOrder })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="New Task" size="sm">
      <div className="space-y-4">
        <Input
          label="Task Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Open registers"
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') save() }}
          autoFocus
        />
        <Select
          label="Category"
          value={category}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value as TaskCategory)}
        >
          <option value="opening">Opening</option>
          <option value="closing">Closing</option>
          <option value="general">General</option>
        </Select>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!title.trim()}>Add Task</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TasksPage() {
  const { tasks } = useTasksStore()
  const [filter, setFilter] = useState<'all' | TaskCategory>('all')
  const [addOpen, setAddOpen] = useState(false)

  const todayStr = today()
  const done = tasks.filter((t) => t.completedDate === todayStr).length
  const pct  = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const visibleTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.category === filter)

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    tasks: visibleTasks.filter((t) => t.category === cat),
  })).filter((g) => g.tasks.length > 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[var(--border)] space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare size={18} className="text-[var(--accent)]" />
              <h1 className="text-lg font-semibold text-[var(--text)]">Daily Checklist</h1>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{dateLabel} · {done}/{tasks.length} complete</p>
          </div>
          <Button size="sm" icon={<Plus size={12} />} onClick={() => setAddOpen(true)}>New Task</Button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', ...CATEGORY_ORDER] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                filter === f
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl">✅</span>
            <p className="text-sm text-[var(--text-secondary)]">No tasks yet — add your first one!</p>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>New Task</Button>
          </div>
        ) : visibleTasks.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-10">No tasks in this category</p>
        ) : filter === 'all' ? (
          <div className="space-y-5">
            {grouped.map(({ cat, tasks: catTasks }) => {
              const catDone = catTasks.filter((t) => t.completedDate === todayStr).length
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2 px-3">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: CATEGORY_COLORS[cat] }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${CATEGORY_COLORS[cat]}20`, color: CATEGORY_COLORS[cat] }}
                    >
                      {catDone}/{catTasks.length}
                    </span>
                  </div>
                  <AnimatePresence>
                    {catTasks.map((t) => <TaskRow key={t.id} task={t} />)}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        ) : (
          <AnimatePresence>
            {visibleTasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </AnimatePresence>
        )}
      </div>

      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
