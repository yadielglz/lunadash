import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Store, Shield, Target, Megaphone, Calendar,
  Check, ChevronRight, Trash2, Plus, Edit2, Lock, Unlock, Eye, EyeOff
} from 'lucide-react'
import { useUiStore } from '../../../store/uiStore'
import { useDisplayStore } from '../../../store/displayStore'
import { useGoalsStore, Goal } from '../../../store/goalsStore'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useLockStore, hashPin } from '../../../store/lockStore'
import { Modal } from '../../ui/Modal'
import { Input } from '../../ui/Input'
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
  const [name, setName] = useState(companyName)
  const [num, setNum] = useState(storeNumber)

  const save = () => {
    setCompanyName(name.trim() || companyName)
    setStoreNumber(num.trim())
  }

  return (
    <Section icon={<Store size={14} />} title="Store Details">
      <div className="px-4 py-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Company Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Luna Store" />
          <Input label="Store Number" value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 1234" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} icon={<Check size={12} />}>Save</Button>
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

// ── PIN security ─────────────────────────────────────────────────────────────
function SecuritySection() {
  const { pinHash, setPinHash, lock } = useLockStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<'set' | 'change' | 'remove'>('set')
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [err, setErr] = useState('')

  const openModal = (m: typeof mode) => { setMode(m); setPin(''); setConfirm(''); setCurrent(''); setErr(''); setModalOpen(true) }

  const submit = async () => {
    setErr('')
    if (mode === 'change' || mode === 'remove') {
      const h = await hashPin(current)
      if (h !== pinHash) { setErr('Current PIN is incorrect'); return }
    }
    if (mode === 'remove') {
      setPinHash(null); setModalOpen(false); return
    }
    if (pin.length < 4) { setErr('PIN must be at least 4 digits'); return }
    if (pin !== confirm) { setErr('PINs do not match'); return }
    const h = await hashPin(pin)
    setPinHash(h)
    setModalOpen(false)
  }

  return (
    <Section icon={<Shield size={14} />} title="App Security">
      <Row
        label={pinHash ? 'PIN Lock Enabled' : 'PIN Lock'}
        description={pinHash ? 'App requires a PIN on next load' : 'Protect the app with a numeric PIN'}
      >
        <div className="flex items-center gap-2">
          {pinHash ? (
            <>
              <Button size="sm" variant="ghost" icon={<Edit2 size={12} />} onClick={() => openModal('change')}>Change</Button>
              <Button size="sm" variant="ghost" icon={<Lock size={12} />} onClick={lock}>Lock Now</Button>
              <Button size="sm" variant="danger" icon={<Unlock size={12} />} onClick={() => openModal('remove')}>Remove</Button>
            </>
          ) : (
            <Button size="sm" icon={<Shield size={12} />} onClick={() => openModal('set')}>Set PIN</Button>
          )}
        </div>
      </Row>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === 'set' ? 'Set PIN' : mode === 'change' ? 'Change PIN' : 'Remove PIN'} size="sm">
        <div className="space-y-3">
          {(mode === 'change' || mode === 'remove') && (
            <Input
              label="Current PIN"
              type={showPin ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Current PIN"
              suffix={
                <button onClick={() => setShowPin((s) => !s)} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
          )}
          {mode !== 'remove' && (
            <>
              <Input
                label="New PIN (4–6 digits)"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                suffix={
                  <button onClick={() => setShowPin((s) => !s)} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <Input
                label="Confirm PIN"
                type={showPin ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
              />
            </>
          )}
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant={mode === 'remove' ? 'danger' : 'primary'} onClick={submit}>
              {mode === 'remove' ? 'Remove PIN' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </Section>
  )
}

// ── Goals section ─────────────────────────────────────────────────────────────
function GoalRow({ g }: { g: Goal }) {
  const { updateGoal, removeGoal } = useGoalsStore()
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState(String(g.current))

  const save = () => {
    const val = parseFloat(current)
    if (!isNaN(val)) updateGoal(g.id, { current: val })
    setEditing(false)
  }

  const pct = Math.min(Math.round((g.current / g.target) * 100), 100)

  return (
    <motion.div layout className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] group">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text)] truncate">{g.title}</span>
          <span className="text-[10px] text-[var(--text-tertiary)]">{g.category}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-[var(--border)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
          </div>
          <span className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{pct}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-16 text-xs px-2 py-1 rounded-md bg-[var(--input-bg)] border border-[var(--accent)]/50 text-[var(--text)] focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
              autoFocus
            />
            <span className="text-[var(--text-tertiary)]">/ {g.target}{g.unit}</span>
            <button onClick={save} className="p-1 text-[var(--accent)]"><Check size={12} /></button>
          </div>
        ) : (
          <>
            <button
              onClick={() => { setCurrent(String(g.current)); setEditing(true) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-all"
            >
              <Edit2 size={12} />
            </button>
            <span className="whitespace-nowrap">{g.current}{g.unit} / {g.target}{g.unit}</span>
          </>
        )}
      </div>
      <button
        onClick={() => removeGoal(g.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-red-400 transition-all flex-shrink-0"
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  )
}

function GoalsSection() {
  const { goals, categories } = useGoalsStore()
  const [filter, setFilter] = useState('All')
  const shown = filter === 'All' ? goals : goals.filter((g) => g.category === filter)

  return (
    <Section icon={<Target size={14} />} title="Goals">
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
          {shown.map((g) => <GoalRow key={g.id} g={g} />)}
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

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'general',       label: 'General',       icon: <Clock size={14} /> },
  { id: 'store',         label: 'Store Details',  icon: <Store size={14} /> },
  { id: 'security',      label: 'Security',       icon: <Shield size={14} /> },
  { id: 'goals',         label: 'Goals',          icon: <Target size={14} /> },
  { id: 'announcements', label: 'Announcements',  icon: <Megaphone size={14} /> },
  { id: 'scheduling',    label: 'Scheduling',     icon: <Calendar size={14} /> },
] as const

type SectionId = typeof SECTIONS[number]['id']

// ── Main page ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const [active, setActive] = useState<SectionId>('general')

  const content: Record<SectionId, React.ReactNode> = {
    general:       <GeneralSection />,
    store:         <StoreSection />,
    security:      <SecuritySection />,
    goals:         <GoalsSection />,
    announcements: <AnnouncementsSection />,
    scheduling:    <SchedulingSection />,
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
