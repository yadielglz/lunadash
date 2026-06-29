import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { addDays, format, startOfWeek } from 'date-fns'
import { AlertTriangle, ArrowDown, ArrowUp, Calendar, Camera, ChevronLeft, ChevronRight, Clock, GripVertical, LayoutGrid, Users, Trash2, Edit2, Save, Store, SlidersHorizontal } from 'lucide-react'
import { toPng } from 'html-to-image'
import { WeeklyGrid } from './WeeklyGrid'
import { MonthlyCalendar } from './MonthlyCalendar'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Input'
import { Toggle } from '../../ui/Toggle'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useScheduleBlocksStore } from '../../../store/scheduleBlocksStore'
import { useSchedulePreferencesStore } from '../../../store/schedulePreferencesStore'
import { dbSaveScheduleSnapshot } from '../../../lib/supabase'
import { currentStoreId } from '../../../store/currentStoreId'
import { useUiStore } from '../../../store/uiStore'
import { useDisplayStore } from '../../../store/displayStore'
import { WEEKDAY_KEYS, WEEKDAY_LABELS, type StoreHours } from '../../../lib/storeHours'
import { useScheduleExceptionsStore, type ScheduleExceptionType } from '../../../store/scheduleExceptionsStore'
import { StorePickerButton } from '../../shared/StorePickerButton'
import { formatShiftTime, hexToRgba, timeToMinutes } from '../../../lib/utils'

const COLORS = ['#0078d4','#7c5ff5','#e74856','#16c60c','#f7630c','#00b7c3','#e3008c','#8764b8','#10893e']
const DESKTOP_SCHEDULE_CAPTURE_WIDTH = 980
const EXCEPTION_LABELS: Record<ScheduleExceptionType, string> = {
  call_out: 'Call Out',
  no_show: 'No Show',
  pto: 'PTO',
  sick: 'Sick',
  holiday: 'Holiday',
  blackout: 'Blackout',
}

function datesInRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [startDate]
  const dates: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) {
    dates.push(format(day, 'yyyy-MM-dd'))
  }
  return dates
}

type ExceptionGroup = {
  key: string
  type: ScheduleExceptionType
  employeeId?: string | null
  startDate: string
  endDate: string
  startTime?: string | null
  endTime?: string | null
  note?: string
  ids: string[]
  count: number
  createdAt: string
}

function groupScheduleExceptions(exceptions: ReturnType<typeof useScheduleExceptionsStore.getState>['exceptions']): ExceptionGroup[] {
  const sorted = [...exceptions].sort((a, b) => (
    a.type.localeCompare(b.type)
    || (a.employeeId ?? '').localeCompare(b.employeeId ?? '')
    || (a.note ?? '').localeCompare(b.note ?? '')
    || (a.startTime ?? '').localeCompare(b.startTime ?? '')
    || (a.endTime ?? '').localeCompare(b.endTime ?? '')
    || a.date.localeCompare(b.date)
  ))
  const groups: ExceptionGroup[] = []

  sorted.forEach((exception) => {
    const signature = [
      exception.type,
      exception.employeeId ?? '',
      exception.note ?? '',
      exception.startTime ?? '',
      exception.endTime ?? '',
    ].join('|')
    const previous = groups[groups.length - 1]
    const expectedNextDate = previous ? format(addDays(new Date(`${previous.endDate}T12:00:00`), 1), 'yyyy-MM-dd') : ''

    if (previous && previous.key === signature && expectedNextDate === exception.date) {
      previous.endDate = exception.date
      previous.ids.push(exception.id)
      previous.count += 1
      if (exception.createdAt > previous.createdAt) previous.createdAt = exception.createdAt
      return
    }

    groups.push({
      key: signature,
      type: exception.type,
      employeeId: exception.employeeId,
      startDate: exception.date,
      endDate: exception.date,
      startTime: exception.startTime,
      endTime: exception.endTime,
      note: exception.note,
      ids: [exception.id],
      count: 1,
      createdAt: exception.createdAt,
    })
  })

  return groups.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt))
}

function formatExceptionDateRange(group: ExceptionGroup) {
  if (group.startDate === group.endDate) return group.startDate
  return `${group.startDate} to ${group.endDate}`
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
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('21:00')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setEmployeeId(employees[0]?.id ?? '')
    const today = new Date().toISOString().split('T')[0]
    setDate(today)
    setEndDate(today)
    setAllDay(true)
    setStartTime('10:00')
    setEndTime('21:00')
    setNote('')
  }, [employees, open])

  const save = () => {
    const isStoreLevel = type === 'holiday' || type === 'blackout'
    if (!isStoreLevel && !employeeId) return
    const useDateRange = type === 'pto' || type === 'sick' || type === 'blackout'
    const exceptionDates = useDateRange ? datesInRange(date, endDate) : [date]
    if ((type === 'pto' || type === 'sick') && exceptions.some((exception) => exception.type === 'blackout' && exceptionDates.includes(exception.date))) {
      const confirmed = window.confirm('This time-off range overlaps a blackout date. Add it anyway?')
      if (!confirmed) return
    }
    if (type === 'holiday') {
      const confirmed = allDay
        ? window.confirm('Treat this holiday as closed all day? The schedule verifier will not require coverage for this date.')
        : window.confirm(`Use ${startTime}-${endTime} as holiday hours? The schedule verifier will require coverage only during those hours.`)
      if (!confirmed) return
    }
    exceptionDates.forEach((exceptionDate) => {
      addException({
        type,
        employeeId: isStoreLevel ? null : employeeId,
        date: exceptionDate,
        startTime: allDay ? null : startTime,
        endTime: allDay ? null : endTime,
        note: note.trim(),
      })
    })
    setNote('')
  }

  const exceptionGroups = groupScheduleExceptions(exceptions)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule Exceptions"
      size="full"
      className="sm:h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-2rem)] sm:max-w-none sm:w-[min(1180px,calc(100vw-2rem))]"
    >
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 lg:sticky lg:top-0 lg:self-start">
          <div className="mb-3">
            <p className="text-sm font-semibold text-[var(--text)]">New Exception</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Add time off, sick leave, holidays, or hidden blackout ranges.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Type" value={type} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setType(event.target.value as ScheduleExceptionType)}>
              {(Object.keys(EXCEPTION_LABELS) as ScheduleExceptionType[]).map((key) => (
                <option key={key} value={key}>{EXCEPTION_LABELS[key]}</option>
              ))}
            </Select>
            <Input
              label={type === 'pto' || type === 'sick' || type === 'blackout' ? 'Start Date' : 'Date'}
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                if (endDate < event.target.value) setEndDate(event.target.value)
              }}
            />
          </div>
          {(type === 'pto' || type === 'sick' || type === 'blackout') && (
            <div className="mt-3">
              <Input label="End Date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Saves one {EXCEPTION_LABELS[type]} entry for each date in the range.
              </p>
            </div>
          )}
          {type !== 'holiday' && type !== 'blackout' && (
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
          {type === 'holiday' && (
            <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
              All-day holidays are treated as closed for coverage. Holiday entries with times become special store hours for that date.
            </p>
          )}
          {!allDay && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Input label="Start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              <Input label="End" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </div>
          )}
          <div className="mt-3">
            <Input
              label="Reason"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={type === 'pto' ? 'Vacation, personal request, appointment...' : type === 'sick' ? 'Sick, medical, family care...' : type === 'blackout' ? 'Holiday blackout, inventory, district event...' : 'Optional note'}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="primary" icon={<AlertTriangle size={12} />} onClick={save} disabled={(type !== 'holiday' && type !== 'blackout' && !employeeId) || ((type === 'pto' || type === 'sick' || type === 'blackout') && endDate < date)}>
              Add Exception
            </Button>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Exception Log</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {exceptionGroups.length} grouped item{exceptionGroups.length === 1 ? '' : 's'} from {exceptions.length} entr{exceptions.length === 1 ? 'y' : 'ies'}.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {exceptionGroups.map((group) => {
              const employee = employees.find((item) => item.id === group.employeeId)
              const isRange = group.startDate !== group.endDate
              return (
                <div key={`${group.key}-${group.startDate}-${group.endDate}`} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-secondary)]">
                        {EXCEPTION_LABELS[group.type]}
                      </span>
                      {isRange && (
                        <span className="rounded-md border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent)]">
                          {group.count} days
                        </span>
                      )}
                      <span className="text-xs font-medium text-[var(--text)]">{formatExceptionDateRange(group)}</span>
                      {employee && <span className="text-xs text-[var(--text-secondary)]">{employee.name}</span>}
                      {!group.startTime || !group.endTime ? (
                        <span className="text-[10px] text-[var(--text-tertiary)]">All day</span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-tertiary)]">{group.startTime}-{group.endTime}</span>
                      )}
                    </div>
                    {group.note && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{group.note}</p>}
                  </div>
                  <button
                    onClick={() => {
                      const message = group.ids.length > 1
                        ? `Remove all ${group.ids.length} entries in this grouped range?`
                        : 'Remove this exception?'
                      if (!window.confirm(message)) return
                      group.ids.forEach(removeException)
                    }}
                    className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-red-400"
                    aria-label="Remove exception group"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
            {exceptionGroups.length === 0 && (
              <p className="rounded-lg border border-dashed border-[var(--border)] py-8 text-center text-xs text-[var(--text-tertiary)]">No call outs, no shows, PTO, sick time, holidays, or blackout dates logged yet.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function todayKey() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function shiftHours(shift: { startTime: string; endTime: string }) {
  const start = timeToMinutes(shift.startTime)
  const end = timeToMinutes(shift.endTime)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const minutes = end >= start ? end - start : (24 * 60 - start) + end
  if (minutes <= 0 || minutes > 14 * 60) return null
  return minutes / 60
}

function formatHours(hours: number) {
  return hours.toFixed(hours % 1 === 0 ? 0 : 1)
}

function MobileScheduleWeek({ canChooseScheduleStore }: { canChooseScheduleStore: boolean }) {
  const desktopCaptureRef = useRef<HTMLDivElement>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [captureMessage, setCaptureMessage] = useState('')
  const { employees, shifts } = useScheduleStore()
  const blocks = useScheduleBlocksStore((s) => s.blocks)
  const exceptions = useScheduleExceptionsStore((s) => s.exceptions)
  const storeId = useUiStore((s) => s.storeId)
  const { companyName, storeNumber } = useDisplayStore()
  const weekStartsOn = useSchedulePreferencesStore((s) => s.weekStartsOn)
  const showShiftNames = useSchedulePreferencesStore((s) => s.showShiftNames)
  const showShiftNotes = useSchedulePreferencesStore((s) => s.showShiftNotes)
  const showEmployeeRoles = useSchedulePreferencesStore((s) => s.showEmployeeRoles)
  const compactSchedule = useSchedulePreferencesStore((s) => s.compactSchedule)
  const today = todayKey()
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const weekStart = addDays(startOfWeek(new Date(), { weekStartsOn }), weekOffset * 7)
  const weekEnd = addDays(weekStart, 6)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const dates = days.map(dayKey)
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  const weekShifts = shifts
    .filter((shift) => dates.includes(shift.date))
    .filter((shift) => employeeById.has(shift.employeeId))
  const weekExceptions = exceptions.filter((exception) => dates.includes(exception.date))
  const blockColors = new Map(blocks.map((block) => [block.name, block.color]))
  const scheduledEmployees = employees.filter((employee) =>
    weekShifts.some((shift) => shift.employeeId === employee.id)
  )
  const displayedEmployees = scheduledEmployees.length > 0 ? scheduledEmployees : employees
  const shiftHourValues = weekShifts.map(shiftHours)
  const canShowHours = shiftHourValues.every((hours) => hours !== null)
  const totalHours = canShowHours ? shiftHourValues.reduce((sum, hours) => sum + (hours ?? 0), 0) : null
  const captureTitle = `${companyName || 'Luna Store'} Schedule ${format(weekStart, 'MMM d')}-${format(weekEnd, 'MMM d, yyyy')}`
  const fileName = `${captureTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`

  const captureSchedule = async () => {
    const captureNode = desktopCaptureRef.current
    if (!captureNode || capturing) return

    setCapturing(true)
    setCaptureMessage('')
    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      await new Promise((resolve) => window.requestAnimationFrame(resolve))

      const dataUrl = await toPng(captureNode, {
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.captureExclude === 'true'),
        width: DESKTOP_SCHEDULE_CAPTURE_WIDTH,
        height: captureNode.scrollHeight,
        pixelRatio: Math.min(window.devicePixelRatio || 2, 3),
        backgroundColor: '#ffffff',
      })
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: captureTitle,
          text: `${captureTitle} captured from LunaDash.`,
        })
        setCaptureMessage('Schedule image shared.')
        return
      }

      const link = document.createElement('a')
      link.href = dataUrl
      link.download = fileName
      link.click()
      setCaptureMessage('Schedule image saved.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setCaptureMessage('Schedule image could not be captured.')
    } finally {
      setCapturing(false)
      window.setTimeout(() => setCaptureMessage(''), 2400)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--bg)] sm:hidden">
      <div className="bg-[var(--bg)]">
        <div className="border-b border-[var(--border)] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text)]">
                <Calendar size={18} className="text-[var(--accent)]" />
                Schedule
              </h1>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {storeNumber ? `Store ${storeNumber} · ` : ''}
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </p>
            </div>
            {storeId !== 'main' && (
              <Button
                className="flex-shrink-0"
                size="sm"
                variant="secondary"
                icon={<Camera size={13} />}
                loading={capturing}
                onClick={captureSchedule}
                data-capture-exclude="true"
              >
                Capture
              </Button>
            )}
          </div>
          {captureMessage && (
            <p className={`mt-2 text-xs ${captureMessage.includes('could not') ? 'text-red-400' : 'text-[var(--accent)]'}`}>
              {captureMessage}
            </p>
          )}
          {storeId !== 'main' && (
            <div className="mt-3 flex items-center gap-2" data-capture-exclude="true">
              <button
                onClick={() => setWeekOffset((current) => current - 1)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]"
                aria-label="Previous week"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className={`h-8 flex-1 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                  weekOffset === 0
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setWeekOffset(1)}
                className={`h-8 flex-1 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                  weekOffset === 1
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                }`}
              >
                Next Week
              </button>
              <button
                onClick={() => setWeekOffset((current) => current + 1)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]"
                aria-label="Next week"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {storeId !== 'main' && (
          <div
            aria-hidden="true"
            className="fixed top-0 z-0 bg-white text-slate-950"
            data-capture-exclude="true"
            style={{ left: -10000, width: DESKTOP_SCHEDULE_CAPTURE_WIDTH, pointerEvents: 'none' }}
          >
            <div ref={desktopCaptureRef} className="bg-white p-6" style={{ width: DESKTOP_SCHEDULE_CAPTURE_WIDTH }}>
              <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Weekly Schedule</div>
                  <h1 className="mt-1 text-2xl font-bold text-slate-950">{companyName || 'Luna Store'}</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {storeNumber ? `Store ${storeNumber} · ` : ''}
                    {format(weekStart, 'MMMM d')} - {format(weekEnd, 'MMMM d, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-950">{weekShifts.length} shifts</div>
                  {canShowHours && totalHours !== null && <div className="text-sm text-slate-500">{formatHours(totalHours)} scheduled hours</div>}
                  <div className="mt-2 text-[11px] text-slate-400">Printed {format(new Date(), 'MMM d, yyyy h:mm a')}</div>
                </div>
              </div>

              <div className="mt-4 grid border border-slate-200" style={{ gridTemplateColumns: '210px repeat(7, minmax(110px, 1fr))' }}>
                <div className="bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">Team</div>
                {days.map((day) => (
                  <div key={day.toISOString()} className="border-l border-slate-200 bg-slate-100 px-3 py-2 text-center">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-600">{format(day, 'EEE')}</div>
                    <div className="text-lg font-bold leading-tight text-slate-950">{format(day, 'd')}</div>
                  </div>
                ))}

                {displayedEmployees.map((employee) => {
                  const employeeShifts = weekShifts.filter((shift) => shift.employeeId === employee.id)
                  const employeeHours = canShowHours ? employeeShifts.reduce((sum, shift) => sum + (shiftHours(shift) ?? 0), 0) : null

                  return (
                    <div key={employee.id} className="contents">
                      <div className="border-t border-slate-200 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: employee.color }} />
                          <div className="min-w-0">
                            <div className="break-words text-sm font-bold leading-snug text-slate-950">{employee.name}</div>
                            {showEmployeeRoles && <div className="break-words text-[11px] leading-snug text-slate-500">{employee.role}</div>}
                          </div>
                        </div>
                        {employeeHours !== null && (
                          <div className="mt-2 text-[11px] font-semibold text-slate-500">
                            {formatHours(employeeHours)} hrs
                          </div>
                        )}
                      </div>

                      {days.map((day) => {
                        const date = dayKey(day)
                        const dayShifts = employeeShifts.filter((shift) => shift.date === date)

                        return (
                          <div key={`${employee.id}-${date}`} className={`${compactSchedule ? 'min-h-[64px] p-1.5' : 'min-h-[86px] p-2'} border-l border-t border-slate-200`}>
                            {dayShifts.length === 0 ? (
                              <div className="flex h-full items-center justify-center text-xs font-medium text-slate-300">Off</div>
                            ) : (
                              <div className="space-y-1.5">
                                {dayShifts.map((shift) => {
                                  const color = blockColors.get(shift.type) ?? employee.color
                                  return (
                                    <div
                                      key={shift.id}
                                      className="rounded-md border px-2 py-1.5"
                                      style={{ background: hexToRgba(color, 0.1), borderColor: hexToRgba(color, 0.28) }}
                                    >
                                      {showShiftNames && <div className="text-xs font-bold" style={{ color }}>{shift.type}</div>}
                                      <div className="text-[11px] font-semibold text-slate-700">{formatShiftTime(shift.startTime, shift.endTime)}</div>
                                      {showShiftNotes && shift.note && <div className="mt-0.5 text-[10px] text-slate-500">{shift.note}</div>}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {displayedEmployees.length === 0 && (
                <div className="mt-10 rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  No employees or shifts are scheduled for this week.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3" data-capture-exclude="true">
            <div className="flex items-start gap-3">
              <Clock size={16} className="mt-0.5 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Schedule editing is desktop only.</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  Mobile shows who is working today. Add shifts, edit employees, hours, and exceptions from the desktop version.
                </p>
              </div>
            </div>
          </div>

          {storeId === 'main' && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text)]">Choose a store</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {canChooseScheduleStore ? 'Use the store button in the top bar to view one location.' : 'A single store is required for mobile schedule coverage.'}
              </p>
            </div>
          )}

          {storeId !== 'main' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Week Coverage</div>
                <div className="text-xs tabular-nums text-[var(--text-secondary)]">{weekShifts.length} shift{weekShifts.length === 1 ? '' : 's'}</div>
              </div>

              {days.map((day) => {
                const date = dayKey(day)
                const dayShifts = weekShifts
                  .filter((shift) => shift.date === date)
                  .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                const dayExceptions = weekExceptions.filter((exception) => exception.date === date && exception.type !== 'blackout')
                const isCurrentDay = date === today

                return (
                  <section key={date} className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                      <div>
                        <h2 className="text-sm font-semibold text-[var(--text)]">{format(day, 'EEEE')}</h2>
                        <p className="text-xs text-[var(--text-tertiary)]">{format(day, 'MMM d')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrentDay && (
                          <span className="rounded-md border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-semibold uppercase text-[var(--accent)]">
                            Today
                          </span>
                        )}
                        <span className="text-xs tabular-nums text-[var(--text-secondary)]">{dayShifts.length}</span>
                      </div>
                    </div>

                    <div className="space-y-2 px-4 py-3">
                      {dayShifts.map((shift) => {
                        const employee = employeeById.get(shift.employeeId)
                        const start = timeToMinutes(shift.startTime)
                        const end = timeToMinutes(shift.endTime)
                        const onNow = isCurrentDay && Number.isFinite(start) && Number.isFinite(end) && nowMinutes >= start && nowMinutes < end

                        return (
                          <div key={shift.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: employee?.color ?? 'var(--accent)' }} />
                                  <p className="truncate text-sm font-semibold text-[var(--text)]">{employee?.name ?? 'Open shift'}</p>
                                </div>
                                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{employee?.role ?? shift.type}</p>
                              </div>
                              {onNow && (
                                <span className="rounded-md border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-semibold uppercase text-[var(--accent)]">
                                  On now
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                              <Clock size={14} className="text-[var(--text-tertiary)]" />
                              {formatShiftTime(shift.startTime, shift.endTime)}
                            </div>
                            {shift.note && <p className="mt-2 text-xs text-[var(--text-secondary)]">{shift.note}</p>}
                          </div>
                        )
                      })}

                      {dayShifts.length === 0 && (
                        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-4 text-center">
                          <p className="text-xs font-medium text-[var(--text-tertiary)]">No shifts scheduled</p>
                        </div>
                      )}

                      {dayExceptions.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {dayExceptions.map((exception) => {
                            const employee = exception.employeeId ? employeeById.get(exception.employeeId) : null
                            return (
                              <div key={exception.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-[var(--text)]">{EXCEPTION_LABELS[exception.type]}</span>
                                  <span className="text-xs text-[var(--text-tertiary)]">{employee?.name ?? 'Store'}</span>
                                </div>
                                {exception.note && <p className="mt-1 text-xs text-[var(--text-secondary)]">{exception.note}</p>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}

              {weekShifts.length === 0 && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-8 text-center">
                  <Users size={22} className="mx-auto text-[var(--text-tertiary)]" />
                  <p className="mt-3 text-sm font-semibold text-[var(--text)]">No one is scheduled this week.</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">Open LunaDash on desktop to add coverage.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
  const canChooseScheduleStore = accessRole === 'admin' || accessRole === 'district_manager'
  const canEditSchedule = accessRole === 'admin' || accessRole === 'district_manager' || accessRole === 'manager'
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false)

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
      setSaveMessage('Schedule confirmed in Supabase Database Sync.')
    } catch (err) {
      setSaveState('error')
      setSaveMessage(err instanceof Error ? err.message : 'Schedule save could not be confirmed.')
    }
  }

  return (
    <>
    <MobileScheduleWeek canChooseScheduleStore={canChooseScheduleStore} />
    <div className="hidden h-full flex-col sm:flex">
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
          {canChooseScheduleStore && <StorePickerButton className="flex-shrink-0" autoOpen requireSelection />}
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
    </>
  )
}
