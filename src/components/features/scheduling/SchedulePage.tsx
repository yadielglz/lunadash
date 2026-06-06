import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Calendar, GripVertical, LayoutGrid, Users, Trash2, Edit2, Save, Store, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { WeeklyGrid } from './WeeklyGrid'
import { MonthlyCalendar } from './MonthlyCalendar'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Input'
import { Toggle } from '../../ui/Toggle'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useSchedulePreferencesStore } from '../../../store/schedulePreferencesStore'
import { dbGetStores, dbSaveScheduleSnapshot, type StoreSummary } from '../../../lib/supabase'
import { currentStoreId } from '../../../store/currentStoreId'
import { useUiStore } from '../../../store/uiStore'
import { normalizeStoreId } from '../../../lib/storeIds'

const COLORS = ['#0078d4','#7c5ff5','#e74856','#16c60c','#f7630c','#00b7c3','#e3008c','#8764b8','#10893e']

function EmployeeManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees, addEmployee, removeEmployee, updateEmployee, reorderEmployees } = useScheduleStore()
  const [name, setName] = useState('')
  const [role, setRole] = useState('Associate')
  const [color, setColor] = useState(COLORS[0])
  const [editId, setEditId] = useState<string | null>(null)

  const startEdit = (id: string) => {
    const e = employees.find((e) => e.id === id)
    if (!e) return
    setEditId(id); setName(e.name); setRole(e.role); setColor(e.color)
  }

  const save = () => {
    if (!name.trim()) return
    if (editId) {
      updateEmployee(editId, { name: name.trim(), role, color })
      setEditId(null)
    } else {
      addEmployee({ name: name.trim(), role, color })
    }
    setName(''); setRole('Associate'); setColor(COLORS[0])
  }

  const moveEmployee = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= employees.length) return
    const ordered = [...employees]
    const [moved] = ordered.splice(index, 1)
    ordered.splice(nextIndex, 0, moved)
    reorderEmployees(ordered)
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Employees" size="md">
      <div className="space-y-4">
        {/* Add/Edit form */}
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
          <h4 className="text-xs font-semibold text-[var(--text)]">{editId ? 'Edit Employee' : 'Add Employee'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            <Input label="Role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Associate" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {editId && <Button variant="ghost" onClick={() => { setEditId(null); setName(''); }}>Cancel</Button>}
            <Button variant="primary" onClick={save} disabled={!name.trim()}>
              {editId ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>

        {/* Employee list */}
        <div className="space-y-1.5">
          {employees.map((emp, index) => (
            <div key={emp.id} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-[var(--reveal-bg)] group transition-colors">
              <GripVertical size={14} className="text-[var(--text-tertiary)]" />
              <div className="w-3 h-3 rounded-full" style={{ background: emp.color }} />
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--text)]">{emp.name}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{emp.role}</div>
              </div>
              <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveEmployee(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${emp.name} up`}
                  className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:text-[var(--text-tertiary)]"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => moveEmployee(index, 1)}
                  disabled={index === employees.length - 1}
                  aria-label={`Move ${emp.name} down`}
                  className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:text-[var(--text-tertiary)]"
                >
                  <ArrowDown size={12} />
                </button>
                <button onClick={() => startEdit(emp.id)} className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Edit2 size={12} /></button>
                <button onClick={() => removeEmployee(emp.id)} className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

export function SchedulePage() {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  const [empModalOpen, setEmpModalOpen] = useState(false)
  const { employees, shifts } = useScheduleStore()
  const showShiftNames = useSchedulePreferencesStore((s) => s.showShiftNames)
  const showShiftNotes = useSchedulePreferencesStore((s) => s.showShiftNotes)
  const showEmployeeRoles = useSchedulePreferencesStore((s) => s.showEmployeeRoles)
  const compactSchedule = useSchedulePreferencesStore((s) => s.compactSchedule)
  const setShowShiftNames = useSchedulePreferencesStore((s) => s.setShowShiftNames)
  const setShowShiftNotes = useSchedulePreferencesStore((s) => s.setShowShiftNotes)
  const setShowEmployeeRoles = useSchedulePreferencesStore((s) => s.setShowEmployeeRoles)
  const setCompactSchedule = useSchedulePreferencesStore((s) => s.setCompactSchedule)
  const storeId = useUiStore((s) => s.storeId)
  const accessRole = useUiStore((s) => s.accessRole)
  const setStoreId = useUiStore((s) => s.setStoreId)
  const canChooseScheduleStore = accessRole === 'admin' || accessRole === 'district_manager'
  const canEditSchedule = accessRole === 'admin' || accessRole === 'district_manager' || accessRole === 'manager'
  const [storePickerOpen, setStorePickerOpen] = useState(canChooseScheduleStore)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [storesError, setStoresError] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState(storeId === 'main' ? '' : storeId)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false)

  const loadStores = async () => {
    setStoresLoading(true)
    setStoresError('')
    try {
      setStores((await dbGetStores()).filter((store) => normalizeStoreId(store.store_id) !== 'MAIN'))
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : 'Could not load stores')
    } finally {
      setStoresLoading(false)
    }
  }

  useEffect(() => {
    if (!canChooseScheduleStore) return
    setStorePickerOpen(true)
    loadStores()
  }, [canChooseScheduleStore])

  useEffect(() => {
    if (storeId !== 'main') setSelectedStoreId(storeId)
  }, [storeId])

  const applyScheduleStore = () => {
    const nextStoreId = normalizeStoreId(selectedStoreId)
    if (!nextStoreId || nextStoreId === 'MAIN') return
    setStoreId(nextStoreId)
    setStorePickerOpen(false)
  }

  const saveSchedule = async () => {
    if (storeId === 'main') {
      setSaveState('error')
      setSaveMessage('Select a single store before saving schedules.')
      return
    }

    setSaveState('saving')
    setSaveMessage('')
    try {
      await dbSaveScheduleSnapshot(currentStoreId(), employees, shifts)
      setSaveState('saved')
      setSaveMessage('Schedule confirmed in Supabase.')
    } catch (err) {
      setSaveState('error')
      setSaveMessage(err instanceof Error ? err.message : 'Schedule save could not be confirmed.')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Modal
        open={storePickerOpen}
        onClose={() => {
          if (storeId !== 'main') setStorePickerOpen(false)
        }}
        title="Choose Schedule Store"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text)]">Which store schedule do you want to edit?</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Schedule opens one store at a time so district and admin sessions do not mix shifts from multiple locations.
            </p>
          </div>
          <Select
            label="Store"
            value={selectedStoreId}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedStoreId(event.target.value)}
          >
            <option value="" disabled>Select a store</option>
            {stores.map((store) => (
              <option key={store.store_id} value={store.store_id}>
                {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
              </option>
            ))}
            {storeId !== 'main' && !stores.some((store) => normalizeStoreId(store.store_id) === normalizeStoreId(storeId)) && (
              <option value={storeId}>{storeId} (current)</option>
            )}
          </Select>
          {storesError && <p className="text-xs text-red-400">{storesError}</p>}
          <div className="flex justify-between gap-2">
            <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={loadStores} loading={storesLoading}>
              Refresh
            </Button>
            <Button size="sm" variant="primary" icon={<Store size={12} />} onClick={applyScheduleStore} disabled={!selectedStoreId}>
              Open Schedule
            </Button>
          </div>
        </div>
      </Modal>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[var(--text)] flex items-center gap-2">
            <Calendar size={18} className="text-[var(--accent)]" />
            Schedule
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {storeId === 'main' ? 'Choose a store to edit schedules' : `${employees.length} employees · ${shifts.length} shifts total`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative flex-shrink-0">
            <Button
              className="flex-shrink-0"
              size="sm"
              variant="ghost"
              icon={<SlidersHorizontal size={13} />}
              onClick={() => setViewOptionsOpen((open) => !open)}
            >
              View
            </Button>
            {viewOptionsOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3 shadow-xl">
                <div className="space-y-3">
                  <Toggle checked={showShiftNames} onChange={setShowShiftNames} label="Shift names" size="sm" />
                  <Toggle checked={showShiftNotes} onChange={setShowShiftNotes} label="Shift notes" size="sm" />
                  <Toggle checked={showEmployeeRoles} onChange={setShowEmployeeRoles} label="Employee roles" size="sm" />
                  <Toggle checked={compactSchedule} onChange={setCompactSchedule} label="Compact mode" size="sm" />
                </div>
              </div>
            )}
          </div>
          {canChooseScheduleStore && (
            <Button className="flex-shrink-0" size="sm" variant="ghost" icon={<Store size={13} />} onClick={() => setStorePickerOpen(true)}>
              Store
            </Button>
          )}
          {saveMessage && (
            <span className={`hidden md:inline text-xs ${saveState === 'error' ? 'text-red-400' : 'text-[var(--accent)]'}`}>
              {saveMessage}
            </span>
          )}
          {canEditSchedule && (
            <>
              <Button
                className="flex-shrink-0"
                size="sm"
                variant={saveState === 'saved' ? 'accent' : 'secondary'}
                icon={<Save size={13} />}
                loading={saveState === 'saving'}
                onClick={saveSchedule}
                disabled={storeId === 'main'}
              >
                Save
              </Button>
              <Button className="flex-shrink-0" size="sm" variant="ghost" icon={<Users size={13} />} onClick={() => setEmpModalOpen(true)}>
                Employees
              </Button>
            </>
          )}
          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden flex-shrink-0">
            {(['weekly', 'monthly'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                }`}
              >
                {v === 'weekly' ? <><LayoutGrid size={12} /> Week</> : <><Calendar size={12} /> Month</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View */}
      <div className="flex-1 overflow-hidden">
        {storeId === 'main' ? (
          <div className="h-full flex items-center justify-center px-4 text-center">
            <div>
              <Store size={24} className="mx-auto text-[var(--accent)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">Choose a store to edit its schedule.</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">District and admin schedule views stay scoped to one location.</p>
            </div>
          </div>
        ) : (
          <motion.div
            key={view}
            className="h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {view === 'weekly' ? <WeeklyGrid canEdit={canEditSchedule} /> : <MonthlyCalendar canEdit={canEditSchedule} />}
          </motion.div>
        )}
      </div>

      {canEditSchedule && <EmployeeManagerModal open={empModalOpen} onClose={() => setEmpModalOpen(false)} />}
    </div>
  )
}
