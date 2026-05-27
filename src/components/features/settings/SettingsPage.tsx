import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Store, Megaphone, Calendar, Check, ChevronRight, Trash2, Plus, Edit2, Info, RefreshCw, Moon, Sun, Cloud, KeyRound, Tv2, FileText, Printer, Sparkles
} from 'lucide-react'
import { Theme, useUiStore } from '../../../store/uiStore'

import { isAnnouncementActive, useDisplayStore } from '../../../store/displayStore'
import { useGoalsStore, type Goal } from '../../../store/goalsStore'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useScheduleBlocksStore, ScheduleBlock } from '../../../store/scheduleBlocksStore'
import { useSchedulePreferencesStore, WEEKDAY_OPTIONS, WeekStartDay } from '../../../store/schedulePreferencesStore'
import { dbCheckSchemaHealth, dbDeleteSettings, dbForceEodSnapshot, dbGetGoals, dbGetStores, dbUpdateSettings, GLOBAL_ANNOUNCEMENT_STORE_ID, StoreSummary } from '../../../lib/supabase'
import { Input, Select } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { APP_META } from '../../../config/appMeta'
import { SyncArea, useSyncStore } from '../../../store/syncStore'
import { WeatherPage } from '../weather/WeatherPage'
import { getDealerInfo } from '../../../lib/dealers'
import { normalizeStoreId } from '../../../lib/storeIds'
import { Section, Row, Segment } from './SettingsLayout'
import { AccessSection } from './AccessSection'

function ThemePicker({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  const choices: { value: Theme; label: string; icon: React.ReactNode; preview: string }[] = [
    { value: 'dark', label: 'Dark', icon: <Moon size={14} />, preview: 'bg-[#111318]' },
    { value: 'light', label: 'Light', icon: <Sun size={14} />, preview: 'bg-[#f4f6f8]' },
    { value: 'vista', label: 'Vista', icon: <Sparkles size={14} />, preview: 'bg-[linear-gradient(135deg,#162b4d,#5c7fb5_55%,#d8ecff)]' },
    { value: 'mac', label: 'Mac', icon: <Sparkles size={14} />, preview: 'bg-[linear-gradient(135deg,#f8fafc,#dbeafe_45%,#f5d0fe)]' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-[36rem] max-w-full">
      {choices.map((choice) => {
        const selected = value === choice.value
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => onChange(choice.value as Theme)}
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
  const { theme, setTheme, brand, setBrand, timeFormat, setTimeFormat, tempUnit, toggleTempUnit, uiScale, setUiScale } = useUiStore()
  return (
    <Section icon={<Clock size={14} />} title="General">
      <Row label="Theme" description="Choose the dashboard appearance">
        <ThemePicker value={theme} onChange={setTheme} />
      </Row>
      <Row label="Accent Color" description="Match the dashboard to your brand">
        <Segment
          options={[
            { value: 'default', label: 'Luna Blue' },
            { value: 'tmobile', label: 'T-Mobile' },
            { value: 'green', label: 'Green' },
            { value: 'black', label: 'Black' },
            { value: 'yellow', label: 'Yellow' },
          ]}
          value={brand}
          onChange={setBrand}
        />
      </Row>
      <Row label="App Zoom" description="Increase dashboard size on larger displays">
        <Segment
          options={[{ value: '100', label: '100%' }, { value: '120', label: '120%' }]}
          value={uiScale}
          onChange={setUiScale}
        />
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
  const { companyName, storeNumber, slideInterval, setCompanyName, setStoreNumber } = useDisplayStore()
  const { storeId, setStoreId, accessRole } = useUiStore()
  const canSwitchStores = accessRole === 'admin'
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
      const hasDefault = rows.some((store) => normalizeStoreId(store.store_id) === 'DEFAULT')
      setStores(hasDefault ? rows : [
        { store_id: 'DEFAULT', company_name: 'Luna Store', store_number: '', slide_interval: 8 },
        ...rows,
      ])
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : 'Could not load stores')
      setStores([{ store_id: 'DEFAULT', company_name: 'Luna Store', store_number: '', slide_interval: 8 }])
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
    setStoreId(normalizeStoreId(nextStoreId) || 'DEFAULT')
    setSidSaved(true)
    setTimeout(() => setSidSaved(false), 2000)
  }

  const addStore = async () => {
    const id = normalizeStoreId(newStoreId) || 'DEFAULT'
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
      {canSwitchStores && (
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
          {storeId !== 'main' && !stores.some((store) => normalizeStoreId(store.store_id) === normalizeStoreId(storeId)) && (
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
            onChange={(e) => setNewStoreId(normalizeStoreId(e.target.value))}
            placeholder="New store ID, e.g. 693D"
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') addStore() }}
          />
          <Button size="sm" onClick={addStore} icon={<Plus size={12} />}>
            Add / Use
          </Button>
        </div>

        <p className="text-[10px] text-[var(--text-tertiary)]">
          Current: <span className="font-mono text-[var(--accent)]">{storeId || 'DEFAULT'}</span>
          {sidSaved && <span className="ml-2 text-[var(--accent)]">Applied</span>}
        </p>
        {storesError && <p className="text-xs text-red-400">{storesError}</p>}
      </div>
      )}

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

    </Section>
  )
}

function DisplaySettingsSection() {
  const { slideInterval, setSlideInterval } = useDisplayStore()
  const { setTab } = useUiStore()

  return (
    <Section icon={<Tv2 size={14} />} title="Display">
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
      <Row label="Display Mode" description="Launch the passive store display">
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
  const { accessRole, storeId } = useUiStore()
  const [draft, setDraft] = useState('')
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal')
  const [startAt, setStartAt] = useState(new Date().toISOString().split('T')[0])
  const [endAt, setEndAt] = useState('')
  const [targetStoreId, setTargetStoreId] = useState(GLOBAL_ANNOUNCEMENT_STORE_ID)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const PCOLS = { normal: '#0078d4', important: '#f7630c', urgent: '#e74856' }
  const canChooseTarget = accessRole === 'admin' || accessRole === 'district_manager'

  useEffect(() => {
    if (!canChooseTarget) return
    dbGetStores()
      .then((rows) => setStores(rows.filter((store) => normalizeStoreId(store.store_id) !== 'main')))
      .catch(() => setStores([]))
  }, [canChooseTarget])

  const add = () => {
    if (!draft.trim()) return
    const target = canChooseTarget ? targetStoreId : normalizeStoreId(storeId)
    addAnnouncement(draft.trim(), priority, { startAt: startAt || undefined, endAt: endAt || undefined }, target)
    setDraft('')
    setPriority('normal')
    setStartAt(new Date().toISOString().split('T')[0])
    setEndAt('')
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Starts" type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          <Input label="Ends" type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
        {canChooseTarget && (
          <Select
            label="Send To"
            value={targetStoreId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetStoreId(e.target.value)}
          >
            <option value={GLOBAL_ANNOUNCEMENT_STORE_ID}>All Stores</option>
            {stores.map((store) => (
              <option key={store.store_id} value={normalizeStoreId(store.store_id)}>
                {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
              </option>
            ))}
          </Select>
        )}
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
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {a.storeId === GLOBAL_ANNOUNCEMENT_STORE_ID ? 'All Stores' : a.storeId || storeId} · {a.startAt || 'Now'} - {a.endAt || 'No end'}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize"
              style={{ background: `${PCOLS[a.priority]}20`, color: PCOLS[a.priority] }}
            >
              {isAnnouncementActive(a) ? a.priority : 'scheduled'}
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
  const canEditStoreLabels = accessRole === 'admin' || accessRole === 'district_manager'
  const canRemoveStores = accessRole === 'admin'
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNumber, setEditNumber] = useState('')
  const [editInterval, setEditInterval] = useState(8)
  const [editNickname, setEditNickname] = useState('')
  const [editLocation, setEditLocation] = useState('')

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

  const startEditStore = (store: StoreSummary) => {
    const dealer = getDealerInfo(store.store_id)
    setEditingStoreId(store.store_id)
    setEditName(store.company_name || '')
    setEditNumber(store.store_number || '')
    setEditInterval(store.slide_interval || 8)
    setEditNickname(store.dealer_nickname || dealer?.nickname || '')
    setEditLocation(store.dealer_location || dealer?.location || '')
    setError('')
  }

  const cancelEditStore = () => {
    setEditingStoreId(null)
    setEditName('')
    setEditNumber('')
    setEditInterval(8)
    setEditNickname('')
    setEditLocation('')
  }

  const saveStore = async (store: StoreSummary) => {
    setLoading(true)
    setError('')
    try {
      await dbUpdateSettings(store.store_id, {
        company_name: editName.trim() || 'Luna Store',
        store_number: editNumber.trim(),
        slide_interval: editInterval,
        dealer_nickname: editNickname.trim(),
        dealer_location: editLocation.trim(),
      })
      cancelEditStore()
      await loadStores()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update store')
    } finally {
      setLoading(false)
    }
  }

  const removeStore = async (store: StoreSummary) => {
    if (normalizeStoreId(store.store_id) === normalizeStoreId(storeId)) {
      setError('Switch to another store before removing the current store.')
      return
    }
    if (!window.confirm(`Remove ${store.company_name || store.store_id} from configured stores?`)) return
    setLoading(true)
    setError('')
    try {
      await dbDeleteSettings(store.store_id)
      await loadStores()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove store')
    } finally {
      setLoading(false)
    }
  }

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

        {stores.map((store) => {
          const isEditing = editingStoreId === store.store_id
          const dealer = getDealerInfo(store.store_id)
          const nickname = store.dealer_nickname || dealer?.nickname || ''
          const location = store.dealer_location || dealer?.location || ''
          return (
            <div key={store.store_id} className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input label="Store Name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Luna Store" />
                    <Input label="Store #" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} placeholder="1234" />
                    <Input label="Nickname" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder="Top Guns" />
                    <Input label="Location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Clermont S" />
                    <Input label="Slide Seconds" type="number" min={4} max={30} value={editInterval} onChange={(e) => setEditInterval(Number(e.target.value) || 8)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={cancelEditStore}>Cancel</Button>
                    <Button size="sm" icon={<Check size={12} />} loading={loading} onClick={() => saveStore(store)}>Save Store</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text)] truncate">{store.company_name || 'Luna Store'}</span>
                      {normalizeStoreId(store.store_id) === normalizeStoreId(storeId) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">Current</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      ID: <span className="font-mono">{store.store_id}</span>
                      {store.store_number ? ` · Store #${store.store_number}` : ''}
                      {` · Slides ${store.slide_interval}s`}
                    </div>
                    {(nickname || location) && (
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {nickname || 'No nickname'}{location ? ` | ${location}` : ''}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant={normalizeStoreId(store.store_id) === normalizeStoreId(storeId) ? 'accent' : 'ghost'} onClick={() => setStoreId(normalizeStoreId(store.store_id))}>
                    {normalizeStoreId(store.store_id) === normalizeStoreId(storeId) ? 'Selected' : 'Use'}
                  </Button>
                  {canEditStoreLabels && (
                    <>
                      <Button size="sm" variant="ghost" icon={<Edit2 size={12} />} onClick={() => startEditStore(store)}>Edit</Button>
                    </>
                  )}
                  {canRemoveStores && (
                    <>
                      <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => removeStore(store)}>Remove</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {stores.length === 0 && !loading && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No configured stores found in Supabase.</p>
        )}
        {error && <p className="text-xs text-red-400 text-center py-2">{error}</p>}
      </div>
    </Section>
  )
}

// ── Reports section ──────────────────────────────────────────────────────────
const SNAPSHOT_CATEGORY = 'Performance Snapshot'
const SNAPSHOT_PREFIX = 'source-snapshot:'
const REPORT_METRICS: Record<string, { label: string; kind: 'money' | 'number' | 'percent' }> = {
  netRevenue: { label: 'Net Revenue', kind: 'money' },
  accessoryRevenue: { label: 'Accessories', kind: 'money' },
  totalPp: { label: 'Total PP', kind: 'number' },
  traffic: { label: 'Traffic', kind: 'number' },
  vl: { label: 'Voice Lines', kind: 'number' },
  bts: { label: 'BTS', kind: 'number' },
  hsi: { label: 'HSI', kind: 'number' },
  visa: { label: 'VISA', kind: 'number' },
}

function snapshotKey(goal: Goal) {
  return goal.description.startsWith(SNAPSHOT_PREFIX)
    ? goal.description.slice(SNAPSHOT_PREFIX.length)
    : ''
}

function monthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function formatReportValue(value: number, kind: 'money' | 'number' | 'percent') {
  if (kind === 'money') {
    return Math.round(value).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
  }
  if (kind === 'percent') return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
  return Math.round(value).toLocaleString('en-US')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function ReportSection() {
  const { goals, _init: goalsInit } = useGoalsStore()
  const { companyName, storeNumber } = useDisplayStore()
  const { storeId } = useUiStore()
  const [snapshotRunning, setSnapshotRunning] = useState(false)
  const [snapshotMessage, setSnapshotMessage] = useState('')
  const [snapshotError, setSnapshotError] = useState('')
  const snapshotGoals = goals.filter((goal) => goal.category === SNAPSHOT_CATEGORY && snapshotKey(goal))
  const months = Array.from(new Set(
    snapshotGoals.flatMap((goal) => Object.keys(goal.dailyLog ?? {}).map((day) => day.slice(0, 7)))
  ))
    .sort()
    .reverse()
  const [selectedMonth, setSelectedMonth] = useState(months[0] ?? '')

  useEffect(() => {
    if (!selectedMonth && months[0]) setSelectedMonth(months[0])
    if (selectedMonth && months.length > 0 && !months.includes(selectedMonth)) setSelectedMonth(months[0])
  }, [months, selectedMonth])

  const printReport = () => {
    if (!selectedMonth) return

    const rows = Object.entries(REPORT_METRICS).map(([key, meta]) => {
      const goal = snapshotGoals.find((item) => snapshotKey(item) === key)
      const total = Object.entries(goal?.dailyLog ?? {}).reduce((sum, [day, value]) => (
        day.startsWith(selectedMonth) ? sum + (Number(value) || 0) : sum
      ), 0)
      return { ...meta, total }
    })
    const metricKeys = Object.keys(REPORT_METRICS)
    const dailyDates = Array.from(new Set(
      snapshotGoals.flatMap((goal) => Object.keys(goal.dailyLog ?? {}).filter((day) => day.startsWith(selectedMonth)))
    )).sort()
    const dailyRows = dailyDates.map((date) => {
      const values = Object.fromEntries(metricKeys.map((key) => {
        const goal = snapshotGoals.find((item) => snapshotKey(item) === key)
        return [key, goal?.dailyLog?.[date] ?? 0]
      }))
      return { date, values }
    })

    const generatedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    const storeLabel = `${companyName || 'Luna Store'}${storeNumber ? ` #${storeNumber}` : ''}`
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(monthLabel(selectedMonth))} Performance Snapshot</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: "Google Sans", GoogleSans, "Google Sans Text", "Google Sans Flex", "Product Sans", "Segoe UI", system-ui, sans-serif; background: #f7f8fb; }
            main { width: 8.5in; min-height: 11in; margin: 0 auto; padding: 0.55in; background: white; }
            header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 18px; }
            h1 { margin: 0; font-size: 26px; letter-spacing: 0; }
            .subtle { color: #64748b; font-size: 12px; }
            .meta { text-align: right; line-height: 1.5; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
            .tile { border: 1px solid #d8dee8; border-radius: 8px; padding: 14px; min-height: 92px; }
            .label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .value { margin-top: 10px; font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { text-align: left; color: #64748b; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding: 10px 8px; }
            td { border-bottom: 1px solid #e5e7eb; padding: 12px 8px; font-size: 13px; }
            td:last-child, th:last-child { text-align: right; font-variant-numeric: tabular-nums; }
            footer { margin-top: 28px; color: #64748b; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
            @media print {
              body { background: white; }
              main { width: auto; min-height: auto; margin: 0; padding: 0.45in; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <main>
            <header>
              <div>
                <h1>Performance Snapshot</h1>
                <div class="subtle">${escapeHtml(monthLabel(selectedMonth))}</div>
              </div>
              <div class="meta subtle">
                <div>${escapeHtml(storeLabel)}</div>
                <div>Store ID: ${escapeHtml(storeId || 'DEFAULT')}</div>
                <div>Generated ${escapeHtml(generatedAt)}</div>
              </div>
            </header>
            <section class="summary">
              ${rows.slice(0, 4).map((row) => `
                <div class="tile">
                  <div class="label">${escapeHtml(row.label)}</div>
                  <div class="value">${escapeHtml(formatReportValue(row.total, row.kind))}</div>
                </div>
              `).join('')}
            </section>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>MTD Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.label)}</td>
                    <td>${escapeHtml(formatReportValue(row.total, row.kind))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <h2>Daily Records</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  ${metricKeys.map((key) => `<th>${escapeHtml(REPORT_METRICS[key].label)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${dailyRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(new Date(row.date + 'T12:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}</td>
                    ${metricKeys.map((key) => `<td>${escapeHtml(formatReportValue(Number(row.values[key]) || 0, REPORT_METRICS[key].kind))}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <footer>
              MTD totals and daily records are calculated from saved daily snapshots.
            </footer>
          </main>
          <script>
            window.addEventListener('load', () => {
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>
    `

    const reportWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!reportWindow) return
    reportWindow.document.write(html)
    reportWindow.document.close()
  }

  const forceSnapshot = async () => {
    setSnapshotRunning(true)
    setSnapshotMessage('')
    setSnapshotError('')
    try {
      const result = await dbForceEodSnapshot()
      const refreshedGoals = storeId === 'main'
        ? (await Promise.all([
            dbGetGoals('main'),
            ...(await dbGetStores()).map((store) => dbGetGoals(store.store_id)),
          ])).flat()
        : await dbGetGoals(storeId || 'DEFAULT')
      goalsInit(refreshedGoals)
      setSnapshotMessage(`${result.message}${result.updated ? ` (${result.updated} metrics)` : ''}`)
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Could not run EOD snapshot')
    } finally {
      setSnapshotRunning(false)
    }
  }

  return (
    <Section icon={<FileText size={14} />} title="Reports">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Performance Snapshot Report</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Select a month and open a print-ready report with MTD totals and daily records.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Select
            label="Month"
            value={selectedMonth}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(event.target.value)}
            disabled={months.length === 0}
          >
            {months.length === 0 ? (
              <option value="">No historical snapshots yet</option>
            ) : months.map((month) => (
              <option key={month} value={month}>{monthLabel(month)}</option>
            ))}
          </Select>
          <Button size="sm" icon={<Printer size={13} />} disabled={!selectedMonth} onClick={printReport}>
            Print / PDF
          </Button>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Reports open in a print window so the Settings tab stays clean.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">End of Day Snapshot</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Pull current Source numbers now and save them into today&apos;s MTD history.
            </p>
          </div>
          <Button size="sm" icon={<RefreshCw size={13} />} loading={snapshotRunning} onClick={forceSnapshot}>
            Force Snapshot
          </Button>
        </div>
        {snapshotMessage && <p className="text-xs text-[var(--accent)]">{snapshotMessage}</p>}
        {snapshotError && <p className="text-xs text-red-400">{snapshotError}</p>}
      </div>
    </Section>
  )
}

// ── About section ─────────────────────────────────────────────────────────────
function AboutSection() {
  const { setTab, sessionExpiresAt, extendStoreSession, accessRole } = useUiStore()
  const [now, setNow] = useState(Date.now())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil(((sessionExpiresAt ?? now) - now) / 1000))
  const remainingLabel = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`

  const forceUpdateRestart = async () => {
    setRefreshing(true)
    setRefreshError('')
    try {
      if (window.lunadashDesktop?.forceUpdateRestart) {
        await window.lunadashDesktop.forceUpdateRestart()
        return
      }

      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
      document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0]?.trim()
        if (!name) return
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      })
      window.location.reload()
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Could not clear cache and restart')
      setRefreshing(false)
    }
  }

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text)]">Force Update & Restart</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Clears app cache and cookies, then reloads LunaDash fresh.</p>
            </div>
            <Button size="sm" variant="accent" icon={<RefreshCw size={13} />} loading={refreshing} onClick={forceUpdateRestart}>
              Update & Restart
            </Button>
          </div>
          {refreshError && <p className="mt-2 text-xs text-red-400">{refreshError}</p>}
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
        {accessRole === 'admin' && (
          <div className="pt-2 border-t border-[var(--border)]">
            <button
              onClick={() => setTab('devices')}
              className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Internal reference
            </button>
          </div>
        )}
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

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'general',       label: 'General',       icon: <Clock size={14} /> },
  { id: 'weather',       label: 'Weather',       icon: <Cloud size={14} /> },
  { id: 'display',       label: 'Display',       icon: <Tv2 size={14} /> },
  { id: 'store',         label: 'Store Details',  icon: <Store size={14} /> },
  { id: 'configuredStores', label: 'Configured Stores', icon: <Store size={14} /> },
  { id: 'reports',       label: 'Reports',        icon: <FileText size={14} /> },
  { id: 'announcements', label: 'Announcements',  icon: <Megaphone size={14} /> },
  { id: 'scheduling',    label: 'Scheduling',     icon: <Calendar size={14} /> },
  { id: 'scheduleBlocks', label: 'Schedule Blocks', icon: <Calendar size={14} /> },
  { id: 'access',        label: 'Access',         icon: <KeyRound size={14} /> },
  { id: 'sync',          label: 'Sync Status',    icon: <Cloud size={14} /> },
  { id: 'about',         label: 'About',          icon: <Info size={14} /> },
] as const

type SectionId = typeof SECTIONS[number]['id']
const LIMITED_SETTINGS_SECTIONS: SectionId[] = ['weather']
const MANAGER_HIDDEN_SECTIONS: SectionId[] = ['store', 'configuredStores']
const DISTRICT_HIDDEN_SECTIONS: SectionId[] = ['store']

function isSectionId(value: string): value is SectionId {
  return SECTIONS.some((section) => section.id === value)
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const accessRole = useUiStore((state) => state.accessRole)
  const requestedSection = useUiStore((state) => state.settingsSection)
  const setSettingsSection = useUiStore((state) => state.setSettingsSection)
  const visibleSections = useMemo(() => (
    accessRole === 'employee'
      ? SECTIONS.filter((section) => LIMITED_SETTINGS_SECTIONS.includes(section.id))
      : accessRole === 'manager'
        ? SECTIONS.filter((section) => !MANAGER_HIDDEN_SECTIONS.includes(section.id))
        : accessRole === 'district_manager'
          ? SECTIONS.filter((section) => !DISTRICT_HIDDEN_SECTIONS.includes(section.id))
      : SECTIONS
  ), [accessRole])
  const fallbackSection = visibleSections[0]?.id ?? 'weather'
  const [active, setActive] = useState<SectionId>(
    isSectionId(requestedSection) && visibleSections.some((section) => section.id === requestedSection)
      ? requestedSection
      : fallbackSection
  )

  useEffect(() => {
    if (isSectionId(requestedSection) && visibleSections.some((section) => section.id === requestedSection)) {
      setActive(requestedSection)
      return
    }
    if (!visibleSections.some((section) => section.id === active)) setActive(fallbackSection)
  }, [active, fallbackSection, requestedSection, visibleSections])

  const activeSection = visibleSections.some((section) => section.id === active) ? active : fallbackSection

  const content: Record<SectionId, React.ReactNode> = {
    general:       <GeneralSection />,
    weather:       <WeatherPage />,
    display:       <DisplaySettingsSection />,
    store:         <StoreSection />,
    configuredStores: <ConfiguredStoresSection />,
    reports:       <ReportSection />,
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
        {visibleSections.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setActive(s.id)
              setSettingsSection(s.id)
            }}
            className={`relative flex items-center gap-2.5 sm:mx-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left whitespace-nowrap ${
              activeSection === s.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
            }`}
          >
            {activeSection === s.id && (
              <motion.div
                layoutId="activeSettingsTab"
                className="absolute inset-0 rounded-xl bg-[var(--accent)]/12"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2.5 flex-1">
              {s.icon}
              {s.label}
            </span>
            {active === s.id && <ChevronRight size={12} className="relative z-10 ml-auto opacity-60 hidden sm:block" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {content[activeSection]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
