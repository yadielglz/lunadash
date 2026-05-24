import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Store, Megaphone, Calendar,
  Check, ChevronRight, Trash2, Plus, Edit2, Info, RefreshCw, Moon, Sun, Cloud, KeyRound, Power, Tv2
} from 'lucide-react'
import { Theme, useUiStore } from '../../../store/uiStore'

import { useDisplayStore } from '../../../store/displayStore'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useScheduleBlocksStore, ScheduleBlock } from '../../../store/scheduleBlocksStore'
import { useSchedulePreferencesStore, WEEKDAY_OPTIONS, WeekStartDay } from '../../../store/schedulePreferencesStore'
import { dbCheckSchemaHealth, dbCreateAccessCode, dbGetAccessCodes, dbGetStores, dbResetAccessOnboarding, dbUpdateAccessCode, dbUpdateSettings, StoreAccessCode, StoreSummary } from '../../../lib/supabase'
import { Input, Select } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { APP_META } from '../../../config/appMeta'
import { SyncArea, useSyncStore } from '../../../store/syncStore'
import { AccessRole } from '../../../store/uiStore'
import { hashPin } from '../../../store/lockStore'

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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        {description && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</div>}
      </div>
      <div className="sm:flex-shrink-0">{children}</div>
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

function ThemePicker({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  const choices: { value: Theme; label: string; icon: React.ReactNode; preview: string }[] = [
    { value: 'dark', label: 'Dark', icon: <Moon size={14} />, preview: 'bg-[#111318]' },
    { value: 'light', label: 'Light', icon: <Sun size={14} />, preview: 'bg-[#f4f6f8]' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 w-full sm:w-72 max-w-full">
      {choices.map((choice) => {
        const selected = value === choice.value
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => onChange(choice.value)}
            className={`group rounded-lg border p-2 text-left transition-colors ${
              selected
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className={`h-12 rounded-md border border-[var(--border)] ${choice.preview} overflow-hidden`}>
              <div className="h-3 border-b border-white/10 bg-white/10" />
              <div className="p-1.5 space-y-1">
                <div className="h-2 w-10 rounded bg-[var(--accent)]" />
                <div className="h-1.5 w-14 rounded bg-slate-400/45" />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text)]">
                {choice.icon}
                {choice.label}
              </span>
              {selected && <Check size={13} className="text-[var(--accent)]" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── General section ──────────────────────────────────────────────────────────
function GeneralSection() {
  const { theme, setTheme, timeFormat, setTimeFormat, tempUnit, toggleTempUnit } = useUiStore()
  return (
    <Section icon={<Clock size={14} />} title="General">
      <Row label="Theme" description="Choose the dashboard appearance">
        <ThemePicker value={theme} onChange={setTheme} />
      </Row>
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
  const { storeId, setStoreId, accessRole, setTab } = useUiStore()
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
          value={storeId === 'main' ? '' : storeId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => switchStore(e.target.value)}
        >
          <option value="" disabled>{storeId === 'main' ? 'Main Dashboard active' : 'Select a store'}</option>
          {stores.map((store) => (
            <option key={store.store_id} value={store.store_id}>
              {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
            </option>
          ))}
          {storeId !== 'main' && !stores.some((store) => store.store_id === storeId) && (
            <option value={storeId}>{storeId} (current)</option>
          )}
        </Select>

        {accessRole === 'admin' && (
          <Button size="sm" variant={storeId === 'main' ? 'accent' : 'ghost'} onClick={() => switchStore('main')}>
            {storeId === 'main' ? 'Main Dashboard active' : 'Use Main Dashboard'}
          </Button>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
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

      <Row label="Display Mode" description="Launch the passive store display from Settings">
        <Button size="sm" variant="ghost" icon={<Tv2 size={13} />} onClick={() => setTab('display')}>
          Open Display
        </Button>
      </Row>
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
  const { storeId, setStoreId, accessRole } = useUiStore()
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
        {accessRole === 'admin' && (
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
        )}

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
  const { setTab, sessionExpiresAt, extendStoreSession } = useUiStore()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil(((sessionExpiresAt ?? now) - now) / 1000))
  const remainingLabel = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`

  return (
    <Section icon={<Info size={14} />} title="About">
      <div className="px-4 py-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">LunaDash</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">ver {APP_META.version} | Build {APP_META.build}</p>
        </div>
        <div className="text-sm text-[var(--text-secondary)] space-y-1">
          <p>{APP_META.copyright}</p>
          <p>
            Any Issues? email:{' '}
            <a className="text-[var(--accent)] hover:underline" href={`mailto:${APP_META.supportEmail}`}>
              {APP_META.supportEmail}
            </a>
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-xs font-medium text-[var(--text)]">Update Notes</p>
          <ul className="mt-2 list-disc pl-4 text-xs text-[var(--text-secondary)] space-y-1">
            {APP_META.updateNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--text)]">Store Session</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Timer resets with activity. Display and Performance stay open.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[var(--accent)]">{remainingLabel}</span>
              <Button size="sm" variant="ghost" onClick={extendStoreSession}>Extend</Button>
            </div>
          </div>
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

function SyncStatusSection() {
  const entries = useSyncStore((s) => s.entries)
  const [schema, setSchema] = useState<{ table: string; ok: boolean; message: string }[]>([])
  const [checking, setChecking] = useState(false)
  const [schemaError, setSchemaError] = useState('')
  const rows: { area: SyncArea; label: string }[] = [
    { area: 'settings', label: 'Settings' },
    { area: 'schedule', label: 'Schedule' },
    { area: 'goals', label: 'Performance Snapshots' },
    { area: 'announcements', label: 'Announcements' },
  ]

  const colorFor = (state: string) => (
    state === 'synced' ? 'text-emerald-400'
    : state === 'saving' ? 'text-[var(--accent)]'
    : state === 'error' ? 'text-red-400'
    : 'text-[var(--text-tertiary)]'
  )

  const checkSchema = async () => {
    setChecking(true)
    setSchemaError('')
    try {
      setSchema(await dbCheckSchemaHealth())
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : 'Could not check Supabase schema')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Section icon={<Cloud size={14} />} title="Sync Status">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} loading={checking} onClick={checkSchema}>
            Check Schema
          </Button>
        </div>
        {rows.map(({ area, label }) => {
          const entry = entries[area]
          return (
            <div key={area} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{label}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{entry.message}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold uppercase ${colorFor(entry.state)}`}>{entry.state}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                  {entry.updatedAt ? new Date(entry.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Pending'}
                </p>
              </div>
            </div>
          )
        })}
        {schema.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)] overflow-hidden">
            {schema.map((row) => (
              <div key={row.table} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium text-[var(--text)]">{row.table}</span>
                <span className={`text-xs font-semibold ${row.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.ok ? 'Ready' : row.message}
                </span>
              </div>
            ))}
          </div>
        )}
        {schemaError && <p className="text-xs text-red-400">{schemaError}</p>}
      </div>
    </Section>
  )
}

function AccessSection() {
  const { accessRole, storeId, dealerCode, accessLabel } = useUiStore()
  const [codes, setCodes] = useState<StoreAccessCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dealer, setDealer] = useState('')
  const [pin, setPin] = useState('')
  const [newStoreId, setNewStoreId] = useState(storeId === 'main' ? '' : storeId)
  const [role, setRole] = useState<AccessRole>('employee')
  const [label, setLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editStoreId, setEditStoreId] = useState('')
  const [editRole, setEditRole] = useState<AccessRole>('employee')

  const canManageAccess = accessRole === 'admin' || accessRole === 'manager'
  const visibleCodes = accessRole === 'admin'
    ? codes
    : codes.filter((code) => code.store_id === storeId)

  const loadCodes = async () => {
    setLoading(true)
    setError('')
    try {
      setCodes(await dbGetAccessCodes())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load access codes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canManageAccess) loadCodes()
  }, [canManageAccess])

  const createCode = async () => {
    const cleanDealer = dealer.trim()
    const cleanPin = pin.trim()
    const targetStore = accessRole === 'admin' ? newStoreId.trim() : storeId
    if (!/^\d{7}$/.test(cleanDealer)) {
      setError('Dealer code must be 7 digits.')
      return
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('PIN must be 4 digits.')
      return
    }
    if (!targetStore) {
      setError('Store ID / SAP is required.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await dbCreateAccessCode({
        dealer_code: cleanDealer,
        store_id: targetStore,
        pin_hash: await hashPin(cleanPin),
        role,
        label: label.trim() || `${role} access`,
      })
      setDealer('')
      setPin('')
      setLabel('')
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create access code')
    } finally {
      setLoading(false)
    }
  }

  const toggleCode = async (code: StoreAccessCode) => {
    setLoading(true)
    setError('')
    try {
      await dbUpdateAccessCode(code.id, { is_active: !code.is_active })
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update access code')
    } finally {
      setLoading(false)
    }
  }

  const resetOnboarding = async (code: StoreAccessCode) => {
    setLoading(true)
    setError('')
    try {
      const saved = await dbResetAccessOnboarding(code.id)
      if (!saved) {
        setError('Run the latest schema.sql to enable first-login onboarding sync.')
      }
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset onboarding')
    } finally {
      setLoading(false)
    }
  }

  const startEditCode = (code: StoreAccessCode) => {
    setEditingId(code.id)
    setEditLabel(code.label ?? '')
    setEditStoreId(code.store_id)
    setEditRole(code.role)
    setError('')
  }

  const cancelEditCode = () => {
    setEditingId(null)
    setEditLabel('')
    setEditStoreId('')
    setEditRole('employee')
  }

  const saveEditCode = async (code: StoreAccessCode) => {
    const targetStore = accessRole === 'admin' ? editStoreId.trim() : storeId
    if (!editLabel.trim()) {
      setError('Name / label is required.')
      return
    }
    if (!targetStore) {
      setError('Store ID / SAP is required.')
      return
    }
    if (accessRole !== 'admin' && code.store_id !== storeId) {
      setError('Managers can only edit access for their current store.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await dbUpdateAccessCode(code.id, {
        label: editLabel.trim(),
        store_id: targetStore,
        role: accessRole === 'admin' ? editRole : editRole === 'admin' ? 'manager' : editRole,
      })
      cancelEditCode()
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update access code')
    } finally {
      setLoading(false)
    }
  }

  if (!canManageAccess) {
    return (
      <Section icon={<KeyRound size={14} />} title="Access">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-5 text-sm text-[var(--text-secondary)]">
          Access management is available to admin and manager sessions.
        </div>
      </Section>
    )
  }

  return (
    <Section icon={<KeyRound size={14} />} title="Access">
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--text)]">Current Session</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {accessLabel || 'Access user'} · Dealer {dealerCode || 'n/a'} · Role {accessRole ?? 'none'} · Store {storeId || 'none'}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
            Employee: Dashboard and Schedule · Manager: store operations · Admin: all stores and access management · Display: display-only
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 space-y-3">
          <p className="text-xs font-semibold text-[var(--text)]">Create Access Code</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input label="Dealer Code" inputMode="numeric" maxLength={7} value={dealer} onChange={(e) => setDealer(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="7 digits" />
            <Input label="PIN" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 digits" />
            <Input label="Store ID / SAP" value={accessRole === 'admin' ? newStoreId : storeId} onChange={(e) => setNewStoreId(e.target.value)} disabled={accessRole !== 'admin'} placeholder="697D or main" />
            <Select label="Role" value={role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as AccessRole)}>
              {accessRole === 'admin' && <option value="admin">Admin</option>}
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
              <option value="display">Display</option>
            </Select>
            <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Manager name" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" icon={<Plus size={12} />} loading={loading} onClick={createCode}>
              Add Access
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)] overflow-hidden">
          {visibleCodes.map((code) => {
            const isEditing = editingId === code.id
            return (
              <div key={code.id} className="px-4 py-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="Name" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="User name" />
                      <Input label="Store ID / SAP" value={accessRole === 'admin' ? editStoreId : storeId} onChange={(e) => setEditStoreId(e.target.value)} disabled={accessRole !== 'admin'} placeholder="697D or main" />
                      <Select label="Role" value={editRole} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditRole(e.target.value as AccessRole)}>
                        {accessRole === 'admin' && <option value="admin">Admin</option>}
                        <option value="manager">Manager</option>
                        <option value="employee">Employee</option>
                        <option value="display">Display</option>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelEditCode}>Cancel</Button>
                      <Button size="sm" icon={<Check size={12} />} loading={loading} onClick={() => saveEditCode(code)}>Save User</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{code.label || 'Access code'}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Dealer {code.dealer_code} · {code.store_id} · {code.role}
                        {code.last_used_at ? ` · Last used ${new Date(code.last_used_at).toLocaleDateString()}` : ''}
                        {code.onboarded_at ? ` · Intro completed ${new Date(code.onboarded_at).toLocaleDateString()}` : ' · Intro pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {code.onboarded_at && (
                        <Button size="sm" variant="ghost" onClick={() => resetOnboarding(code)}>
                          Reset Intro
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" icon={<Edit2 size={12} />} onClick={() => startEditCode(code)}>
                        Edit
                      </Button>
                      <Button size="sm" variant={code.is_active ? 'ghost' : 'accent'} icon={<Power size={12} />} onClick={() => toggleCode(code)}>
                        {code.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {visibleCodes.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-[var(--text-tertiary)]">No access codes found.</p>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </Section>
  )
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'general',       label: 'General',       icon: <Clock size={14} /> },
  { id: 'store',         label: 'Store Details',  icon: <Store size={14} /> },
  { id: 'configuredStores', label: 'Configured Stores', icon: <Store size={14} /> },
  { id: 'announcements', label: 'Announcements',  icon: <Megaphone size={14} /> },
  { id: 'scheduling',    label: 'Scheduling',     icon: <Calendar size={14} /> },
  { id: 'scheduleBlocks', label: 'Schedule Blocks', icon: <Calendar size={14} /> },
  { id: 'access',        label: 'Access',         icon: <KeyRound size={14} /> },
  { id: 'sync',          label: 'Sync Status',    icon: <Cloud size={14} /> },
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
    announcements: <AnnouncementsSection />,
    scheduling:    <SchedulingSection />,
    scheduleBlocks: <ScheduleBlocksSection />,
    access:        <AccessSection />,
    sync:          <SyncStatusSection />,
    about:         <AboutSection />,
  }

  return (
    <div className="flex flex-col sm:flex-row h-full overflow-hidden">
      {/* Sidebar */}
      <div className="sm:w-48 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--border)] flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto px-3 py-2 sm:px-0 sm:py-3">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex items-center gap-2.5 sm:mx-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left whitespace-nowrap ${
              active === s.id
                ? 'bg-[var(--accent)]/12 text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
            }`}
          >
            {s.icon}
            {s.label}
            {active === s.id && <ChevronRight size={12} className="ml-auto opacity-60 hidden sm:block" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
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
