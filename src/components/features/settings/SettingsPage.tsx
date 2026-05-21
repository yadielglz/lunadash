import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Store, Target, Megaphone, Calendar,
  Check, ChevronRight, Trash2, Plus, Edit2, Info, RefreshCw
} from 'lucide-react'
import { useUiStore } from '../../../store/uiStore'

import { useDisplayStore } from '../../../store/displayStore'
import { useGoalsStore, Goal } from '../../../store/goalsStore'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useScheduleBlocksStore, ScheduleBlock } from '../../../store/scheduleBlocksStore'
import { useSchedulePreferencesStore, WEEKDAY_OPTIONS, WeekStartDay } from '../../../store/schedulePreferencesStore'
import { dbGetStores, dbUpdateSettings, StoreSummary } from '../../../lib/supabase'
import { Input, Select, Textarea } from '../../ui/Input'
import { Button } from '../../ui/Button'

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--border)]">
        <span className="text-[var(--accent)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Row with label + control ─────────────────────────────────────────────────
function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
      <div>
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        {description && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// ── Segmented control ────────────────────────────────────────────────────────
function Segment<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${value === o.value ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── General section ──────────────────────────────────────────────────────────
function GeneralSection() {
  const { timeFormat, setTimeFormat, tempUnit, toggleTempUnit } = useUiStore()
  return (
    <Section icon={<Clock size={14} />} title="General">
      <Row label="Time Format" description="How time is displayed across the app">
        <Segment
          options={[{ value: '12', label: '12h' }, { value: '24', label: '24h' }]}
          value={timeFormat}
          onChange={setTimeFormat}
        />
      </Row>
      <Row label="Temperature Unit" description="Used in weather and display slides">
        <Segment
          options={[{ value: 'F', label: '°F' }, { value: 'C', label: '°C' }]}
          value={tempUnit}
          onChange={(v) => { if (v !== tempUnit) toggleTempUnit() }}
        />
      </Row>
    </Section>
  )
}

// ── Store details ────────────────────────────────────────────────────────────
function StoreSection() {
  const { companyName, storeNumber, slideInterval, setCompanyName, setStoreNumber, setSlideInterval } = useDisplayStore()
  const { storeId, setStoreId } = useUiStore()
  const [name, setName]       = useState(companyName)
  const [num, setNum]         = useState(storeNumber)
  const [newStoreId, setNewStoreId] = useState('')
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [storesError, setStoresError] = useState('')
  const [sidSaved, setSidSaved] = useState(false)

  const loadStores = async () => {
    setStoresLoading(true)
    setStoresError('')
    try {
      const rows = await dbGetStores()
      const hasDefault = rows.some((store) => store.store_id === 'default')
      setStores(hasDefault ? rows : [
        { store_id: 'default', company_name: 'Luna Store', store_number: '', slide_interval: 8 },
        ...rows,
      ])
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : 'Could not load stores')
      setStores([{ store_id: 'default', company_name: 'Luna Store', store_number: '', slide_interval: 8 }])
    } finally {
      setStoresLoading(false)
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  useEffect(() => {
    setName(companyName)
    setNum(storeNumber)
  }, [companyName, storeNumber])

  const saveDetails = () => {
    setCompanyName(name.trim() || companyName)
    setStoreNumber(num.trim())
    loadStores()
  }

  const switchStore = (nextStoreId: string) => {
    setStoreId(nextStoreId || 'default')
    setSidSaved(true)
    setTimeout(() => setSidSaved(false), 2000)
  }

  const addStore = async () => {
    const id = newStoreId.trim() || 'default'
    await dbUpdateSettings(id, {
      company_name: id === storeId ? companyName : 'Luna Store',
      store_number: id === storeId ? storeNumber : '',
      slide_interval: id === storeId ? slideInterval : 8,
    })
    setNewStoreId('')
    await loadStores()
    switchStore(id)
  }

  return (
    <Section icon={<Store size={14} />} title="Store Details">
      {/* Store selector */}
      <div className="px-4 py-4 rounded-xl bg-[var(--surface-2)] border border-[var(--accent)]/20 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Store Selection</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Select a store already configured in Supabase, or add one by Store Data ID.
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={loadStores} loading={storesLoading}>
            Refresh
          </Button>
        </div>

        <Select
          label="Known Stores"
          value={storeId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => switchStore(e.target.value)}
        >
          <option value="main">Main Dashboard - All Stores</option>
          {stores.map((store) => (
            <option key={store.store_id} value={store.store_id}>
              {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
            </option>
          ))}
          {storeId !== 'main' && !stores.some((store) => store.store_id === storeId) && (
            <option value={storeId}>{storeId} (current)</option>
          )}
        </Select>

        <div className="flex gap-2">
          <Input
            value={newStoreId}
            onChange={(e) => setNewStoreId(e.target.value)}
            placeholder="New store ID, e.g. 693D"
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') addStore() }}
          />
          <Button size="sm" onClick={addStore} icon={<Plus size={12} />}>
            Add / Use
          </Button>
        </div>

        <p className="text-[10px] text-[var(--text-tertiary)]">
          Current: <span className="font-mono text-[var(--accent)]">{storeId || 'default'}</span>
          {sidSaved && <span className="ml-2 text-[var(--accent)]">Applied</span>}
        </p>
        {storesError && <p className="text-xs text-red-400">{storesError}</p>}
      </div>

      {/* Display info */}
      <div className="px-4 py-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Company Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Luna Store" />
          <Input label="Store Number" value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 1234" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveDetails} icon={<Check size={12} />}>Save</Button>
        </div>
      </div>

      <Row label="Display Slide Interval" description={`Each slide shows for ${slideInterval}s`}>
        <div className="flex items-center gap-2">
          <input
            type="range" min={4} max={30} step={2} value={slideInterval}
            onChange={(e) => setSlideInterval(Number(e.target.value))}
            className="w-24 accent-[var(--accent)]"
          />
          <span className="text-xs text-[var(--text-secondary)] w-8 text-right">{slideInterval}s</span>
        </div>
      </Row>
    </Section>
  )
}

// ── Goals section ─────────────────────────────────────────────────────────────
const GOAL_COLORS = ['#0078d4','#7c5ff5','#16c60c','#f7630c','#e74856','#00b7c3','#e3008c']

function GoalEditor({ editingGoal, onDone }: { editingGoal: Goal | null; onDone: () => void }) {
  const { addGoal, updateGoal, categories } = useGoalsStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(categories[0] ?? 'General')
  const [unit, setUnit] = useState('')
  const [dailyTarget, setDailyTarget] = useState('1')
  const [target, setTarget] = useState('100')
  const [current, setCurrent] = useState('0')
  const [deadline, setDeadline] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
  const [color, setColor] = useState(GOAL_COLORS[0])

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title)
      setDescription(editingGoal.description)
      setCategory(editingGoal.category)
      setUnit(editingGoal.unit)
      setDailyTarget(String(editingGoal.dailyTarget ?? 1))
      setTarget(String(editingGoal.target))
      setCurrent(String(editingGoal.current))
      setDeadline(editingGoal.deadline ? editingGoal.deadline.split('T')[0] : new Date().toISOString().split('T')[0])
      setColor(editingGoal.color)
      return
    }

    setTitle('')
    setDescription('')
    setCategory(categories[0] ?? 'General')
    setUnit('')
    setDailyTarget('1')
    setTarget('100')
    setCurrent('0')
    setDeadline(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
    setColor(GOAL_COLORS[0])
  }, [editingGoal, categories])

  const save = () => {
    if (!title.trim()) return
    const data = {
      title: title.trim(),
      description: description.trim(),
      category,
      unit: unit.trim(),
      dailyTarget: Number(dailyTarget) || 1,
      target: Number(target) || 0,
      current: Number(current) || 0,
      deadline: new Date(deadline).toISOString(),
      color,
      milestones: editingGoal?.milestones ?? [],
    }

    if (editingGoal) updateGoal(editingGoal.id, data)
    else addGoal(data)
    onDone()
  }

  return (
    <div className="px-4 py-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
      <p className="text-xs font-semibold text-[var(--text)]">{editingGoal ? 'Edit Goal' : 'Create Goal'}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input label="Goal Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Voice Lines" />
        <Select label="Category" value={category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>
      <Textarea label="Description" value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} placeholder="Optional goal context" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="lines" />
        <Input label="Daily Target" type="number" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} />
        <Input label="Monthly Target" type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
        <Input label="Monthly Current" type="number" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label="Month End" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Color</label>
        <div className="flex flex-wrap gap-2">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {editingGoal && <Button variant="ghost" size="sm" onClick={onDone}>Cancel</Button>}
        <Button size="sm" onClick={save} disabled={!title.trim()} icon={<Check size={12} />}>
          {editingGoal ? 'Update Goal' : 'Save Goal'}
        </Button>
      </div>
    </div>
  )
}

function GoalSettingsRow({ g, onEdit }: { g: Goal; onEdit: (goal: Goal) => void }) {
  const { removeGoal } = useGoalsStore()
  const pct = g.target > 0 ? Math.min(Math.round((g.current / g.target) * 100), 100) : 0
  return (
    <motion.div layout className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] group">
      <div className="w-2.5 h-10 rounded-full flex-shrink-0" style={{ background: g.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text)] truncate">{g.title}</span>
          <span className="text-[10px] text-[var(--text-tertiary)]">{g.category}</span>
        </div>
        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
          Daily {g.dailyTarget ?? 1}{g.unit} · Monthly {g.current}{g.unit} / {g.target}{g.unit}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-[var(--border)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
          </div>
          <span className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{pct}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(g)}
          className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-all"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={() => removeGoal(g.id)}
          className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-red-400 transition-all flex-shrink-0"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  )
}

function GoalsSection() {
  const { goals, categories } = useGoalsStore()
  const [filter, setFilter] = useState('All')
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const shown = filter === 'All' ? goals : goals.filter((g) => g.category === filter)

  return (
    <Section icon={<Target size={14} />} title="Goals">
      <GoalEditor editingGoal={editingGoal} onDone={() => setEditingGoal(null)} />

      <div className="flex items-center gap-1.5 flex-wrap">
        {['All', ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filter === c ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <AnimatePresence>
          {shown.map((g) => <GoalSettingsRow key={g.id} g={g} onEdit={setEditingGoal} />)}
        </AnimatePresence>
      </div>
      {shown.length === 0 && (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No goals in this category</p>
      )}
    </Section>
  )
}

// ── Announcements section ────────────────────────────────────────────────────
function AnnouncementsSection() {
  const { announcements, addAnnouncement, removeAnnouncement } = useDisplayStore()
  const [draft, setDraft] = useState('')
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal')
  const PCOLS = { normal: '#0078d4', important: '#f7630c', urgent: '#e74856' }

  const add = () => {
    if (!draft.trim()) return
    addAnnouncement(draft.trim(), priority)
    setDraft('')
    setPriority('normal')
  }

  return (
    <Section icon={<Megaphone size={14} />} title="Announcements">
      {/* Add new */}
      <div className="px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New announcement…"
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') add() }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {(['normal', 'important', 'urgent'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors capitalize"
                style={priority === p
                  ? { background: PCOLS[p], borderColor: PCOLS[p], color: '#fff' }
                  : { background: `${PCOLS[p]}15`, borderColor: `${PCOLS[p]}30`, color: PCOLS[p] }}
              >
                {p}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={add} disabled={!draft.trim()} icon={<Plus size={12} />}>Add</Button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {announcements.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] group">
            <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: PCOLS[a.priority] }} />
            <p className="flex-1 text-sm text-[var(--text)]">{a.text}</p>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize"
              style={{ background: `${PCOLS[a.priority]}20`, color: PCOLS[a.priority] }}
            >
              {a.priority}
            </span>
            <button
              onClick={() => removeAnnouncement(a.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-tertiary)] hover:text-red-400 transition-all flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {announcements.length === 0 && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No announcements</p>
        )}
      </div>
    </Section>
  )
}

// ── Scheduling section ────────────────────────────────────────────────────────
function SchedulingSection() {
  const { employees, addEmployee, updateEmployee, removeEmployee } = useScheduleStore()
  const { weekStartsOn, setWeekStartsOn } = useSchedulePreferencesStore()
  const [name, setName] = useState('')
  const [role, setRole] = useState('Associate')
  const [color, setColor] = useState('#0078d4')
  const [editId, setEditId] = useState<string | null>(null)
  const COLORS = ['#0078d4','#7c5ff5','#e74856','#16c60c','#f7630c','#00b7c3','#e3008c','#8764b8','#10893e']

  const startEdit = (id: string) => {
    const e = employees.find((e) => e.id === id)
    if (!e) return
    setEditId(id); setName(e.name); setRole(e.role); setColor(e.color)
  }

  const save = () => {
    if (!name.trim()) return
    if (editId) { updateEmployee(editId, { name: name.trim(), role, color }); setEditId(null) }
    else addEmployee({ name: name.trim(), role, color })
    setName(''); setRole('Associate'); setColor(COLORS[0])
  }

  return (
    <Section icon={<Calendar size={14} />} title="Scheduling">
      <Row label="Week Starts On" description={`Weekly schedules run ${WEEKDAY_OPTIONS.find((d) => d.value === weekStartsOn)?.label} through ${WEEKDAY_OPTIONS.find((d) => d.value === ((weekStartsOn + 6) % 7))?.label}`}>
        <Select
          value={weekStartsOn}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWeekStartsOn(Number(e.target.value) as WeekStartDay)}
          className="w-36"
        >
          {WEEKDAY_OPTIONS.map((day) => (
            <option key={day.value} value={day.value}>{day.label}</option>
          ))}
        </Select>
      </Row>

      {/* Add / Edit employee */}
      <div className="px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <p className="text-xs font-semibold text-[var(--text)]">{editId ? 'Edit Employee' : 'Add Employee'}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <Input label="Role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Associate" />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {editId && <Button variant="ghost" size="sm" onClick={() => { setEditId(null); setName('') }}>Cancel</Button>}
          <Button size="sm" onClick={save} disabled={!name.trim()}>{editId ? 'Update' : 'Add'}</Button>
        </div>
      </div>

      {/* Employee list */}
      <div className="space-y-1.5">
        {employees.map((emp) => (
          <div key={emp.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] group">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: emp.color }}
            >
              {emp.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-[var(--text)]">{emp.name}</div>
              <div className="text-xs text-[var(--text-tertiary)]">{emp.role}</div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(emp.id)} className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Edit2 size={12} /></button>
              <button onClick={() => removeEmployee(emp.id)} className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── Schedule blocks section ──────────────────────────────────────────────────
const BLOCK_COLORS = ['#0078d4','#7c5ff5','#e74856','#16c60c','#f7630c','#00b7c3','#e3008c','#8764b8','#10893e']

function ScheduleBlocksSection() {
  const { blocks, addBlock, updateBlock, removeBlock } = useScheduleBlocksStore()
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [note, setNote] = useState('')
  const [color, setColor] = useState(BLOCK_COLORS[0])

  const reset = () => {
    setEditId(null)
    setName('')
    setStartTime('09:00')
    setEndTime('17:00')
    setNote('')
    setColor(BLOCK_COLORS[0])
  }

  const startEdit = (block: ScheduleBlock) => {
    setEditId(block.id)
    setName(block.name)
    setStartTime(block.startTime)
    setEndTime(block.endTime)
    setNote(block.note)
    setColor(block.color)
  }

  const save = () => {
    if (!name.trim()) return
    const data = {
      name: name.trim(),
      startTime,
      endTime,
      note: note.trim(),
      color,
    }
    if (editId) updateBlock(editId, data)
    else addBlock(data)
    reset()
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  return (
    <Section icon={<Calendar size={14} />} title="Schedule Blocks">
      <div className="px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <p className="text-xs font-semibold text-[var(--text)]">{editId ? 'Edit Schedule Block' : 'Create Schedule Block'}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Block Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mid 10-7" />
          <Input label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <Input label="Default Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for this block" />
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Color</label>
          <div className="flex flex-wrap gap-2">
            {BLOCK_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {editId && <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>}
          <Button size="sm" onClick={save} disabled={!name.trim()} icon={<Check size={12} />}>
            {editId ? 'Update Block' : 'Save Block'}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {sortedBlocks.map((block) => (
          <div key={block.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] group">
            <div className="w-2.5 h-9 rounded-full flex-shrink-0" style={{ background: block.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--text)] truncate">{block.name}</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                {block.startTime} - {block.endTime}{block.note ? ` · ${block.note}` : ''}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(block)} className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Edit2 size={12} /></button>
              <button onClick={() => removeBlock(block.id)} className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {sortedBlocks.length === 0 && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No schedule blocks yet</p>
        )}
      </div>
    </Section>
  )
}

// ── Configured stores section ────────────────────────────────────────────────
function ConfiguredStoresSection() {
  const { storeId, setStoreId } = useUiStore()
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadStores = async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await dbGetStores()
      setStores(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  return (
    <Section icon={<Store size={14} />} title="Configured Stores">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={loadStores} loading={loading}>
          Refresh
        </Button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text)] truncate">Main Dashboard</span>
              {storeId === 'main' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">Current</span>
              )}
            </div>
            <div className="text-xs text-[var(--text-tertiary)] mt-0.5">All configured stores</div>
          </div>
          <Button size="sm" variant={storeId === 'main' ? 'accent' : 'ghost'} onClick={() => setStoreId('main')}>
            {storeId === 'main' ? 'Selected' : 'Use'}
          </Button>
        </div>

        {stores.map((store) => (
          <div key={store.store_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text)] truncate">{store.company_name || 'Luna Store'}</span>
                {store.store_id === storeId && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">Current</span>
                )}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                ID: <span className="font-mono">{store.store_id}</span>
                {store.store_number ? ` · Store #${store.store_number}` : ''}
                {` · Slides ${store.slide_interval}s`}
              </div>
            </div>
            <Button size="sm" variant={store.store_id === storeId ? 'accent' : 'ghost'} onClick={() => setStoreId(store.store_id)}>
              {store.store_id === storeId ? 'Selected' : 'Use'}
            </Button>
          </div>
        ))}

        {stores.length === 0 && !loading && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No configured stores found in Supabase.</p>
        )}
        {error && <p className="text-xs text-red-400 text-center py-2">{error}</p>}
      </div>
    </Section>
  )
}

// ── About section ─────────────────────────────────────────────────────────────
function AboutSection() {
  const { setTab } = useUiStore()

  return (
    <Section icon={<Info size={14} />} title="About">
      <div className="px-4 py-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">LunaDash</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">ver 3.31 | Build 52126.1344</p>
        </div>
        <div className="text-sm text-[var(--text-secondary)] space-y-1">
          <p>© 2026 Glz Technical Services | Glz Tech</p>
          <p>
            Any Issues? email:{' '}
            <a className="text-[var(--accent)] hover:underline" href="mailto:service@glztech.com">
              service@glztech.com
            </a>
          </p>
        </div>
        <div className="pt-2 border-t border-[var(--border)]">
          <button
            onClick={() => setTab('devices')}
            className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Internal reference
          </button>
        </div>
      </div>
    </Section>
  )
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'general',       label: 'General',       icon: <Clock size={14} /> },
  { id: 'store',         label: 'Store Details',  icon: <Store size={14} /> },
  { id: 'configuredStores', label: 'Configured Stores', icon: <Store size={14} /> },
  { id: 'goals',         label: 'Goals',          icon: <Target size={14} /> },
  { id: 'announcements', label: 'Announcements',  icon: <Megaphone size={14} /> },
  { id: 'scheduling',    label: 'Scheduling',     icon: <Calendar size={14} /> },
  { id: 'scheduleBlocks', label: 'Schedule Blocks', icon: <Calendar size={14} /> },
  { id: 'about',         label: 'About',          icon: <Info size={14} /> },
] as const

type SectionId = typeof SECTIONS[number]['id']

// ── Main page ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const [active, setActive] = useState<SectionId>('general')

  const content: Record<SectionId, React.ReactNode> = {
    general:       <GeneralSection />,
    store:         <StoreSection />,
    configuredStores: <ConfiguredStoresSection />,
    goals:         <GoalsSection />,
    announcements: <AnnouncementsSection />,
    scheduling:    <SchedulingSection />,
    scheduleBlocks: <ScheduleBlocksSection />,
    about:         <AboutSection />,
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-[var(--border)] flex flex-col py-3 gap-0.5 overflow-y-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex items-center gap-2.5 mx-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              active === s.id
                ? 'bg-[var(--accent)]/12 text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
            }`}
          >
            {s.icon}
            {s.label}
            {active === s.id && <ChevronRight size={12} className="ml-auto opacity-60" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {content[active]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
