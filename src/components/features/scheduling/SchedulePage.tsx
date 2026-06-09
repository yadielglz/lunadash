import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowDown, ArrowUp, Calendar, Clock, GripVertical, LayoutGrid, Users, Trash2, Edit2, Save, Store, RefreshCw, SlidersHorizontal } from 'lucide-react'
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
import { useDisplayStore } from '../../../store/displayStore'
import { WEEKDAY_KEYS, WEEKDAY_LABELS, type StoreHours } from '../../../lib/storeHours'
import { useScheduleExceptionsStore, type ScheduleExceptionType } from '../../../store/scheduleExceptionsStore'

const COLORS = ['#0078d4','#7c5ff5','#e74856','#16c60c','#f7630c','#00b7c3','#e3008c','#8764b8','#10893e']
const EXCEPTION_LABELS: Record<ScheduleExceptionType, string> = {
  call_out: 'Call Out',
  no_show: 'No Show',
  pto: 'PTO',
  holiday: 'Holiday',
}

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

function StoreHoursModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const storeHours = useDisplayStore((s) => s.storeHours)
  const setStoreHours = useDisplayStore((s) => s.setStoreHours)
  const [hours, setHours] = useState<StoreHours>(storeHours)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setHours(storeHours)
    setSaveState('idle')
    setMessage('')
  }, [open, storeHours])

  const updateDayHours = (day: keyof StoreHours, patch: Partial<StoreHours[keyof StoreHours]>) => {
    setHours((current) => ({
      ...current,
      [day]: { ...current[day], ...patch },
    }))
  }

  const save = async () => {
    setSaveState('saving')
    setMessage('')
    try {
      await setStoreHours(hours)
      setSaveState('saved')
      setMessage('Store hours saved.')
    } catch (err) {
      setSaveState('error')
      setMessage(err instanceof Error ? err.message : 'Store hours could not be saved.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Store Hours" size="md">
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
          <p className="text-sm font-semibold text-[var(--text)]">Schedule coverage uses these hours.</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Update exceptions here when a store opens late, closes early, or has different Sunday hours.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="divide-y divide-[var(--border)]">
            {WEEKDAY_KEYS.map((day) => (
              <div key={day} className="grid grid-cols-[minmax(74px,1fr)_auto] gap-2 px-3 py-2 sm:grid-cols-[110px_auto_1fr] sm:items-center">
                <div className="text-xs font-medium text-[var(--text)]">{WEEKDAY_LABELS[day]}</div>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={hours[day].open}
                    onChange={(event) => updateDayHours(day, { open: event.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  Open
                </label>
                <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1">
                  <Input
                    aria-label={`${WEEKDAY_LABELS[day]} open time`}
                    type="time"
                    value={hours[day].start}
                    onChange={(event) => updateDayHours(day, { start: event.target.value })}
                    disabled={!hours[day].open}
                  />
                  <Input
                    aria-label={`${WEEKDAY_LABELS[day]} close time`}
                    type="time"
                    value={hours[day].end}
                    onChange={(event) => updateDayHours(day, { end: event.target.value })}
                    disabled={!hours[day].open}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {message && (
            <span className={`text-xs ${saveState === 'error' ? 'text-red-400' : 'text-[var(--accent)]'}`}>
              {message}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          <Button size="sm" variant={saveState === 'saved' ? 'accent' : 'primary'} icon={<Save size={12} />} loading={saveState === 'saving'} onClick={save}>
            Save Hours
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ScheduleExceptionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees } = useScheduleStore()
  const { exceptions, addException, removeException } = useScheduleExceptionsStore()
  const [type, setType] = useState<ScheduleExceptionType>('call_out')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('21:00')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setEmployeeId(employees[0]?.id ?? '')
    setDate(new Date().toISOString().split('T')[0])
    setAllDay(true)
    setStartTime('10:00')
    setEndTime('21:00')
    setNote('')
  }, [employees, open])

  const save = () => {
    if (type !== 'holiday' && !employeeId) return
    addException({
      type,
      employeeId: type === 'holiday' ? null : employeeId,
      date,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      note: note.trim(),
    })
    setNote('')
  }

  const sortedExceptions = [...exceptions].sort((a, b) => (
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  ))

  return (
    <Modal open={open} onClose={onClose} title="Schedule Exceptions" size="md">
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Type" value={type} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setType(event.target.value as ScheduleExceptionType)}>
              {(Object.keys(EXCEPTION_LABELS) as ScheduleExceptionType[]).map((key) => (
                <option key={key} value={key}>{EXCEPTION_LABELS[key]}</option>
              ))}
            </Select>
            <Input label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          {type !== 'holiday' && (
            <div className="mt-3">
              <Select label="Employee" value={employeeId} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setEmployeeId(event.target.value)}>
                <option value="" disabled>Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </Select>
            </div>
          )}
          <label className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className="accent-[var(--accent)]" />
            All day
          </label>
          {!allDay && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Input label="Start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              <Input label="End" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </div>
          )}
          <div className="mt-3">
            <Input label="Note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="primary" icon={<AlertTriangle size={12} />} onClick={save} disabled={type !== 'holiday' && !employeeId}>
              Add Exception
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {sortedExceptions.map((exception) => {
            const employee = employees.find((item) => item.id === exception.employeeId)
            return (
              <div key={exception.id} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-secondary)]">
                      {EXCEPTION_LABELS[exception.type]}
                    </span>
                    <span className="text-xs font-medium text-[var(--text)]">{exception.date}</span>
                    {employee && <span className="text-xs text-[var(--text-secondary)]">{employee.name}</span>}
                    {!exception.startTime || !exception.endTime ? (
                      <span className="text-[10px] text-[var(--text-tertiary)]">All day</span>
                    ) : (
                      <span className="text-[10px] text-[var(--text-tertiary)]">{exception.startTime}-{exception.endTime}</span>
                    )}
                  </div>
                  {exception.note && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{exception.note}</p>}
                </div>
                <button
                  onClick={() => removeException(exception.id)}
                  className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-red-400"
                  aria-label="Remove exception"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
          {sortedExceptions.length === 0 && (
            <p className="py-5 text-center text-xs text-[var(--text-tertiary)]">No call outs, no shows, PTO, or holidays logged yet.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function SchedulePage() {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  const [empModalOpen, setEmpModalOpen] = useState(false)
  const [hoursModalOpen, setHoursModalOpen] = useState(false)
  const [exceptionsModalOpen, setExceptionsModalOpen] = useState(false)
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
          {storeId !== 'main' && canEditSchedule && (
            <Button className="flex-shrink-0" size="sm" variant="ghost" icon={<Clock size={13} />} onClick={() => setHoursModalOpen(true)}>
              Hours
            </Button>
          )}
          {storeId !== 'main' && canEditSchedule && (
            <Button className="flex-shrink-0" size="sm" variant="ghost" icon={<AlertTriangle size={13} />} onClick={() => setExceptionsModalOpen(true)}>
              Exceptions
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
      {canEditSchedule && <StoreHoursModal open={hoursModalOpen} onClose={() => setHoursModalOpen(false)} />}
      {canEditSchedule && <ScheduleExceptionsModal open={exceptionsModalOpen} onClose={() => setExceptionsModalOpen(false)} />}
    </div>
  )
}
