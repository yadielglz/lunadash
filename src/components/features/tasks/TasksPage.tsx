import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown, ArrowUp, CheckSquare, Edit2, Plus, Check, Trash2, X, Save, Cloud } from 'lucide-react'
import { useTasksStore } from '../../../store/tasksStore'
import type { Task, TaskCategory } from '../../../store/tasksStore'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { Input, Select } from '../../ui/Input'
import { dbSaveTasksSnapshot } from '../../../lib/supabase'
import { currentStoreId } from '../../../store/currentStoreId'
import { useUiStore } from '../../../store/uiStore'
import { useSyncStore } from '../../../store/syncStore'

const today = () => new Date().toISOString().split('T')[0]

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  opening: '#16c60c',
  closing: '#f7630c',
  general: '#0078d4',
}

const CATEGORY_ORDER: TaskCategory[] = ['opening', 'closing', 'general']

function categoryLabel(category: TaskCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, canMoveUp, canMoveDown }: { task: Task; canMoveUp: boolean; canMoveDown: boolean }) {
  const { tasks, toggleTask, removeTask, updateTask, moveTask } = useTasksStore()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [category, setCategory] = useState<TaskCategory>(task.category)
  const isDone = task.completedDate === today()

  useEffect(() => {
    if (!editing) {
      setTitle(task.title)
      setCategory(task.category)
    }
  }, [editing, task.category, task.title])

  const save = () => {
    if (!title.trim()) return
    updateTask(task.id, {
      title: title.trim(),
      category,
      sortOrder: category === task.category
        ? task.sortOrder
        : tasks.filter((t) => t.category === category).length,
    })
    setEditing(false)
  }

  return (
    <motion.div
      layout
      className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--border)] hover:bg-[var(--reveal-bg)]"
    >
      <button
        onClick={() => toggleTask(task.id)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isDone
            ? 'bg-[var(--status-good)] border-[var(--status-good)]'
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

      {editing ? (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_130px_auto] gap-2 items-center">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
            autoFocus
          />
          <Select
            value={category}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value as TaskCategory)}
          >
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>{categoryLabel(cat)}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-1">
            <button
              onClick={save}
              disabled={!title.trim()}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-40"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <span className={`flex-1 text-sm transition-colors ${
          isDone ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text)]'
        }`}>
          {task.title}
        </span>
      )}

      {!editing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => moveTask(task.id, 'up')}
            disabled={!canMoveUp}
            className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:text-[var(--text-tertiary)]"
          >
            <ArrowUp size={12} />
          </button>
          <button
            onClick={() => moveTask(task.id, 'down')}
            disabled={!canMoveDown}
            className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:text-[var(--text-tertiary)]"
          >
            <ArrowDown size={12} />
          </button>
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)]"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={() => removeTask(task.id)}
            className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
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
  const storeId = useUiStore((s) => s.storeId)
  const syncEntry = useSyncStore((s) => s.entries.tasks)
  const [filter, setFilter] = useState<'all' | TaskCategory>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')

  const todayStr = today()
  const done = tasks.filter((t) => t.completedDate === todayStr).length
  const pct  = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const visibleTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.category === filter)
  const sortedVisibleTasks = [...visibleTasks].sort((a, b) => (
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    || a.sortOrder - b.sortOrder
    || a.createdAt.localeCompare(b.createdAt)
  ))

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    tasks: sortedVisibleTasks.filter((t) => t.category === cat),
  })).filter((g) => g.tasks.length > 0)

  const saveTasks = async () => {
    if (storeId === 'main') {
      setSaveState('error')
      setSaveMessage('Select a single store before saving tasks.')
      return
    }

    setSaveState('saving')
    setSaveMessage('')
    try {
      await dbSaveTasksSnapshot(currentStoreId(), tasks)
      setSaveState('saved')
      setSaveMessage('Tasks confirmed in Supabase Database Sync.')
    } catch (err) {
      setSaveState('error')
      setSaveMessage(err instanceof Error ? err.message : 'Task save could not be confirmed.')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="module-legacy-header border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-6 sm:py-5">
        <div className="ops-strip rounded-lg px-3 py-3 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="status-dot" />
              <span className="ops-kicker text-[10px] font-semibold">Store Operations</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <CheckSquare size={18} className="text-[var(--accent)]" />
              <h1 className="text-lg font-semibold text-[var(--text)]">Daily Checklist</h1>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{dateLabel} · {done}/{tasks.length} complete</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[10px] font-semibold uppercase ${
              syncEntry.state === 'error'
                ? 'border-red-400/25 bg-red-400/10 text-red-300'
                : syncEntry.state === 'saving'
                  ? 'border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]'
                  : syncEntry.state === 'synced'
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)]'
            }`}>
              <Cloud size={11} />
              {syncEntry.state}
            </span>
            {saveMessage && (
              <span className={`hidden md:inline text-xs ${saveState === 'error' ? 'text-red-400' : 'text-[var(--accent)]'}`}>
                {saveMessage}
              </span>
            )}
            <Button
              size="sm"
              variant={saveState === 'saved' ? 'accent' : 'secondary'}
              icon={<Save size={12} />}
              loading={saveState === 'saving'}
              onClick={saveTasks}
              disabled={storeId === 'main'}
            >
              Save
            </Button>
            <Button size="sm" icon={<Plus size={12} />} onClick={() => setAddOpen(true)}>New Task</Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: pct === 100 ? 'var(--status-good)' : 'var(--accent)' }}
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
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`relative h-7 rounded-md border px-3 text-xs font-medium transition-all capitalize ${
                filter === f
                  ? 'border-[var(--accent)]/35 text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
              }`}
            >
              {filter === f && (
                <motion.div
                  layoutId="activeTaskFilter"
                  className="absolute inset-0 rounded-md bg-[var(--accent)]/10"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </span>
            </button>
          ))}
        </div>
        </div>
      </header>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {tasks.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center shadow-[var(--shadow-card)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]"><CheckSquare size={23} /></span>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Your checklist is ready to build</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Add opening, closing, or general tasks for the team.</p>
            </div>
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
                      {categoryLabel(cat)}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${CATEGORY_COLORS[cat]}20`, color: CATEGORY_COLORS[cat] }}
                    >
                      {catDone}/{catTasks.length}
                    </span>
                  </div>
                  <AnimatePresence>
                    {catTasks.map((t, index) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        canMoveUp={index > 0}
                        canMoveDown={index < catTasks.length - 1}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        ) : (
          <AnimatePresence>
            {sortedVisibleTasks.map((t, index) => (
              <TaskRow
                key={t.id}
                task={t}
                canMoveUp={index > 0}
                canMoveDown={index < sortedVisibleTasks.length - 1}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
