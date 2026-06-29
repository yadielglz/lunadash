import { useEffect, useState } from 'react'
import { format, addDays, startOfWeek, isToday } from 'date-fns'
import { AlertTriangle, CalendarCheck, ChevronLeft, ChevronRight, Copy, GripVertical, Plus, Printer, Save, Upload, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScheduleStore, Shift, type Employee } from '../../../store/scheduleStore'
import { ShiftModal } from './ShiftModal'
import { formatShiftTime, hexToRgba } from '../../../lib/utils'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Input'
import { useScheduleBlocksStore, type ScheduleBlock } from '../../../store/scheduleBlocksStore'
import { useSchedulePreferencesStore } from '../../../store/schedulePreferencesStore'
import { shiftsToTemplateShifts, useScheduleTemplatesStore, type TemplateShift } from '../../../store/scheduleTemplatesStore'
import { useUiStore } from '../../../store/uiStore'
import { PrintableScheduleModal } from './PrintableScheduleModal'
import { useDisplayStore } from '../../../store/displayStore'
import { weekdayKeyForDate, type StoreHours } from '../../../lib/storeHours'
import { useScheduleExceptionsStore, type ScheduleException, type ScheduleExceptionType } from '../../../store/scheduleExceptionsStore'
import { scheduleBlockCountsTowardCoverage } from '../../../lib/scheduleCoverage'

const SCHEDULE_GRID_COLUMNS = '220px repeat(7, minmax(118px, 1fr))'
const UNAVAILABLE_EXCEPTION_TYPES: ScheduleExceptionType[] = ['call_out', 'no_show', 'pto', 'sick']
const EXCEPTION_LABELS: Record<ScheduleExceptionType, string> = {
  call_out: 'Call Out',
  no_show: 'No Show',
  pto: 'PTO',
  sick: 'Sick',
  holiday: 'Holiday',
  blackout: 'Blackout',
}

function weekDates(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'))
}

function templateShiftsToShifts(templateShifts: TemplateShift[], weekStart: Date): Omit<Shift, 'id'>[] {
  return templateShifts.map((shift) => ({
    employeeId: shift.employeeId,
    date: format(addDays(weekStart, shift.dayOffset), 'yyyy-MM-dd'),
    startTime: shift.startTime,
    endTime: shift.endTime,
    type: shift.type,
    note: shift.note,
  }))
}

function ScheduleTemplatesModal({
  open,
  onClose,
  weekStart,
}: {
  open: boolean
  onClose: () => void
  weekStart: Date
}) {
  const { employees, shifts, addShifts, removeShifts } = useScheduleStore()
  const templates = useScheduleTemplatesStore((s) => s.templates)
  const templatesLoaded = useScheduleTemplatesStore((s) => s.isLoaded)
  const loadTemplates = useScheduleTemplatesStore((s) => s.loadTemplates)
  const addTemplate = useScheduleTemplatesStore((s) => s.addTemplate)
  const removeTemplate = useScheduleTemplatesStore((s) => s.removeTemplate)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [busy, setBusy] = useState(false)

  const dates = weekDates(weekStart)
  const weekShifts = shifts.filter((shift) => dates.includes(shift.date))
  const selectedTemplate = templates.find((template) => template.id === selectedId)

  useEffect(() => {
    if (open) loadTemplates()
  }, [loadTemplates, open])

  useEffect(() => {
    if (templates.length > 0 && (!selectedId || !templates.some((template) => template.id === selectedId))) {
      setSelectedId(templates[0].id)
    }
  }, [selectedId, templates])

  const saveCurrentWeek = async () => {
    if (!name.trim() || weekShifts.length === 0) return
    setBusy(true)
    try {
      const template = await addTemplate({
        name: name.trim(),
        shifts: shiftsToTemplateShifts(weekShifts, dates),
      })
      setSelectedId(template.id)
      setName('')
    } finally {
      setBusy(false)
    }
  }

  const applyTemplate = () => {
    if (!selectedTemplate) return
    if (replaceExisting) removeShifts(weekShifts.map((shift) => shift.id))
    addShifts(templateShiftsToShifts(selectedTemplate.shifts, weekStart))
    onClose()
  }

  const deleteTemplate = async () => {
    if (!selectedTemplate) return
    setBusy(true)
    try {
      await removeTemplate(selectedTemplate.id)
      setSelectedId('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Templates" size="md">
      <div className="space-y-5">
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Save This Week</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Saves {weekShifts.length} shifts from {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentWeek() }}
            />
            <Button size="sm" icon={<Save size={12} />} onClick={saveCurrentWeek} disabled={!name.trim() || weekShifts.length === 0 || busy} loading={busy}>
              Save
            </Button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Apply Template</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Templates keep employees, days, times, shift types, and notes.
            </p>
          </div>

          {!templatesLoaded ? (
            <p className="text-xs text-[var(--text-tertiary)] py-2">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] py-2">No templates saved yet.</p>
          ) : (
            <>
              <Select value={selectedId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedId(e.target.value)}>
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.shifts.length} shifts)
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Replace shifts already scheduled in this week
              </label>
              <div className="flex items-center justify-between gap-2">
                <Button variant="danger" size="sm" onClick={deleteTemplate} disabled={!selectedTemplate || busy}>
                  Delete Template
                </Button>
                <Button variant="primary" size="sm" icon={<Upload size={12} />} onClick={applyTemplate} disabled={!selectedTemplate || employees.length === 0}>
                  Apply
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function shiftsOverlap(a: Shift, b: Shift) {
  return a.id !== b.id && a.startTime < b.endTime && b.startTime < a.endTime
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function shiftHours(shift: Shift) {
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

function exceptionOverlapsShift(exception: ScheduleException, shift: Shift) {
  if (!UNAVAILABLE_EXCEPTION_TYPES.includes(exception.type)) return false
  if (exception.employeeId !== shift.employeeId || exception.date !== shift.date) return false
  if (!exception.startTime || !exception.endTime) return true
  return exception.startTime < shift.endTime && shift.startTime < exception.endTime
}

function exceptionsForShift(shift: Shift, exceptions: ScheduleException[]) {
  return exceptions.filter((exception) => exceptionOverlapsShift(exception, shift))
}

function hasUnavailableException(shift: Shift, exceptions: ScheduleException[]) {
  return exceptionsForShift(shift, exceptions).length > 0
}

function absencesForEmployeeDate(exceptions: ScheduleException[], employeeId: string, date: string) {
  return exceptions.filter((exception) => (
    exception.employeeId === employeeId
    && exception.date === date
    && (exception.type === 'pto' || exception.type === 'sick')
  ))
}

function isStoreManagerEmployee(employee: Employee | undefined) {
  return /\bstore\s+manager\b/i.test(employee?.role ?? '')
}

function isKeyholderEmployee(employee: Employee | undefined) {
  const role = employee?.role ?? ''
  return /\b(store\s+manager|assistant\s+manager|manager|keyholder|key\s*holder|lead)\b/i.test(role)
}

type CoverageAlert = {
  id: string
  date: string
  title: string
  detail: string
  severity: 'warning' | 'danger'
}

function buildCoverageAlerts(shifts: Shift[], employees: Employee[], blocks: ScheduleBlock[], dates: string[], storeHours: StoreHours, exceptions: ScheduleException[]): CoverageAlert[] {
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]))
  const blocksByName = new Map(blocks.map((block) => [block.name, block]))
  const coverageShifts = shifts.filter((shift) => (
    !isStoreManagerEmployee(employeesById.get(shift.employeeId))
    && scheduleBlockCountsTowardCoverage(blocksByName.get(shift.type), shift.type)
  ))

  return dates.flatMap((date) => {
    const holiday = exceptions.find((exception) => exception.type === 'holiday' && exception.date === date)
    const baseDayHours = storeHours[weekdayKeyForDate(new Date(`${date}T12:00:00`))]
    const holidayHasHours = Boolean(holiday?.startTime && holiday.endTime)
    const dayHours = holidayHasHours
      ? { ...baseDayHours, open: true, start: holiday?.startTime ?? baseDayHours.start, end: holiday?.endTime ?? baseDayHours.end }
      : baseDayHours
    const dayShifts = coverageShifts
      .filter((shift) => shift.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    const availableDayShifts = dayShifts.filter((shift) => !hasUnavailableException(shift, exceptions))
    const availableKeyholderShifts = shifts
      .filter((shift) => (
        shift.date === date
        && scheduleBlockCountsTowardCoverage(blocksByName.get(shift.type), shift.type)
        && isKeyholderEmployee(employeesById.get(shift.employeeId))
        && !hasUnavailableException(shift, exceptions)
      ))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    const alerts: CoverageAlert[] = []

    if (holiday && !holidayHasHours) {
      if (dayShifts.length > 0) {
        alerts.push({
          id: `${date}-holiday-scheduled`,
          date,
          title: 'Holiday scheduled',
          detail: `This date is marked as a holiday${holiday.note ? `: ${holiday.note}` : '.'}`,
          severity: 'warning',
        })
      }
      return alerts
    }

    if (!dayHours.open) {
      if (dayShifts.length > 0) {
        alerts.push({
          id: `${date}-closed`,
          date,
          title: 'Closed day scheduled',
          detail: 'This store is marked closed, but shifts are scheduled.',
          severity: 'warning',
        })
      }
      return alerts
    }

    if (availableDayShifts.length === 0) {
      alerts.push({
        id: `${date}-empty`,
        date,
        title: 'No coverage',
        detail: `No shifts are scheduled during store hours ${dayHours.start}-${dayHours.end}.`,
        severity: 'danger',
      })
      return alerts
    }

    if (availableKeyholderShifts.length === 0) {
      alerts.push({
        id: `${date}-keyholder`,
        date,
        title: 'No keyholder',
        detail: 'No store manager, manager, assistant manager, keyholder, or lead is scheduled.',
        severity: 'warning',
      })
    }

    const openingMinutes = timeToMinutes(dayHours.start)
    const closingMinutes = timeToMinutes(dayHours.end)
    const coverageIntervals = availableDayShifts
      .map((shift) => ({
        start: Math.max(timeToMinutes(shift.startTime), openingMinutes),
        end: Math.min(timeToMinutes(shift.endTime), closingMinutes),
      }))
      .filter((interval) => interval.end > interval.start)
      .sort((a, b) => a.start - b.start)

    if (coverageIntervals.length === 0) {
      alerts.push({
        id: `${date}-empty-hours`,
        date,
        title: 'No coverage',
        detail: `No shifts cover store hours ${dayHours.start}-${dayHours.end}.`,
        severity: 'danger',
      })
      return alerts
    }

    const mergedIntervals = coverageIntervals.reduce((merged, interval) => {
      const current = merged[merged.length - 1]
      if (!current || interval.start > current.end) {
        merged.push({ ...interval })
        return merged
      }
      current.end = Math.max(current.end, interval.end)
      return merged
    }, [] as Array<{ start: number; end: number }>)

    const firstCoverage = mergedIntervals[0]
    const lastCoverage = mergedIntervals[mergedIntervals.length - 1]

    if (firstCoverage.start > openingMinutes) {
      alerts.push({
        id: `${date}-open`,
        date,
        title: 'Late opener',
        detail: `${formatShiftTime(minutesToTime(openingMinutes), minutesToTime(firstCoverage.start))} is uncovered.`,
        severity: 'warning',
      })
    }

    const openerHasKeyholder = availableKeyholderShifts.some((shift) => timeToMinutes(shift.startTime) <= openingMinutes && timeToMinutes(shift.endTime) > openingMinutes)
    if (availableKeyholderShifts.length > 0 && !openerHasKeyholder) {
      alerts.push({
        id: `${date}-keyholder-open`,
        date,
        title: 'No keyholder opener',
        detail: 'Opening coverage does not include a store manager, manager, assistant manager, keyholder, or lead.',
        severity: 'warning',
      })
    }

    mergedIntervals.forEach((interval, index) => {
      const next = mergedIntervals[index + 1]
      if (!next) return
      const gap = next.start - interval.end
      if (gap > 30) {
        alerts.push({
          id: `${date}-gap-${index}`,
          date,
          title: 'Coverage gap',
          detail: `${formatShiftTime(minutesToTime(interval.end), minutesToTime(next.start))} is uncovered.`,
          severity: 'warning',
        })
      }
    })

    if (lastCoverage.end < closingMinutes) {
      alerts.push({
        id: `${date}-close`,
        date,
        title: 'Early close',
        detail: `${formatShiftTime(minutesToTime(lastCoverage.end), minutesToTime(closingMinutes))} is uncovered.`,
        severity: 'warning',
      })
    }

    const closerHasKeyholder = availableKeyholderShifts.some((shift) => timeToMinutes(shift.startTime) < closingMinutes && timeToMinutes(shift.endTime) >= closingMinutes)
    if (availableKeyholderShifts.length > 0 && !closerHasKeyholder) {
      alerts.push({
        id: `${date}-keyholder-close`,
        date,
        title: 'No keyholder closer',
        detail: 'Closing coverage does not include a store manager, manager, assistant manager, keyholder, or lead.',
        severity: 'warning',
      })
    }

    if (availableDayShifts.length === 1) {
      alerts.push({
        id: `${date}-solo`,
        date,
        title: 'Single-person day',
        detail: 'Only one shift is scheduled.',
        severity: 'warning',
      })
    }

    return alerts
  })
}

function CoverageAlerts({ alerts }: { alerts: CoverageAlert[] }) {
  if (alerts.length === 0) return null
  const visibleAlerts = alerts.slice(0, 5)

  return (
    <div className="status-warning-surface mx-3 mb-2 rounded-lg border px-3 py-2 sm:mx-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-[var(--status-warn-text)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="ops-kicker text-[10px] font-semibold">Schedule Exceptions</span>
            <span className="status-warning-chip rounded border px-1.5 py-0.5 text-[10px] font-semibold">{alerts.length}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {visibleAlerts.map((alert) => (
              <span
                key={alert.id}
                title={alert.detail}
                className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                  alert.severity === 'danger'
                    ? 'status-danger-chip'
                    : 'status-warning-chip'
                }`}
              >
                {format(new Date(`${alert.date}T12:00:00`), 'EEE')}: {alert.title}
              </span>
            ))}
            {alerts.length > visibleAlerts.length && (
              <span className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--text-tertiary)]">
                +{alerts.length - visibleAlerts.length} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ShiftCard({
  shift,
  accentColor,
  hasConflict,
  canEdit,
  showShiftName,
  showShiftNote,
  compact,
  exceptionLabels,
  onClick,
  onDuplicate,
  onDragStart,
}: {
  shift: Shift
  accentColor: string
  hasConflict: boolean
  canEdit: boolean
  showShiftName: boolean
  showShiftNote: boolean
  compact: boolean
  exceptionLabels?: string[]
  onClick: () => void
  onDuplicate: () => void
  onDragStart: () => void
}) {
  return (
    <motion.button
      layout
      draggable={canEdit}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onDragStart={(e) => { e.stopPropagation(); onDragStart() }}
      className={`w-full text-left rounded-xl px-2.5 transition-all ${compact ? 'py-1.5' : 'py-2'}`}
      style={{
        background: hexToRgba(accentColor, 0.12),
        border: `1px solid ${hasConflict ? '#ef4444' : hexToRgba(accentColor, 0.25)}`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        {showShiftName ? (
          <div
            className="text-[11px] font-semibold leading-tight truncate"
            style={{ color: accentColor }}
          >
            {shift.type}
          </div>
        ) : (
          <div className="min-w-0 flex-1 text-[11px] font-semibold leading-tight text-[var(--text)] truncate">
            {formatShiftTime(shift.startTime, shift.endTime)}
          </div>
        )}
        <div className="flex items-center gap-1">
          {hasConflict && <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />}
          {exceptionLabels && exceptionLabels.length > 0 && <AlertTriangle size={11} className="text-[var(--status-warn-text)] flex-shrink-0" />}
          {canEdit && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onDuplicate() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDuplicate() } }}
              className="rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--reveal-bg)]"
              title="Duplicate shift"
            >
              <Copy size={10} />
            </span>
          )}
        </div>
      </div>
      {showShiftName && (
        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 truncate">
          {formatShiftTime(shift.startTime, shift.endTime)}
        </div>
      )}
      {showShiftNote && shift.note && (
        <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">
          {shift.note}
        </div>
      )}
      {exceptionLabels && exceptionLabels.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {exceptionLabels.map((label) => (
            <span key={label} className="status-warning-chip rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase">
              {label}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  )
}

function AbsenceCard({ exception, canEdit, onClick }: { exception: ScheduleException; canEdit?: boolean; onClick?: () => void }) {
  const label = exception.type === 'sick' ? 'Sick Leave' : 'Time Off'
  const reason = exception.note?.trim()
  const detail = reason || (!exception.startTime || !exception.endTime ? 'Full day' : formatShiftTime(exception.startTime, exception.endTime))
  const Wrapper = canEdit ? 'button' : 'div'
  return (
    <Wrapper
      type={canEdit ? 'button' : undefined}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      className={`relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-left shadow-sm ${canEdit ? 'transition-colors hover:border-[var(--accent)]/35 hover:bg-[var(--surface-2)]' : ''}`}
    >
      <div className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--accent)]" />
      <div className="flex items-center gap-1.5 pl-1.5">
        <CalendarCheck size={11} className="flex-shrink-0 text-[var(--accent)]" />
        <span className="text-[11px] font-semibold uppercase text-[var(--text)]">{label}</span>
      </div>
      <div className="mt-0.5 truncate pl-1.5 text-[10px] font-medium text-[var(--text-secondary)]">{detail}</div>
    </Wrapper>
  )
}

function AbsenceEditModal({
  exception,
  onClose,
}: {
  exception: ScheduleException | null
  onClose: () => void
}) {
  const updateException = useScheduleExceptionsStore((s) => s.updateException)
  const removeException = useScheduleExceptionsStore((s) => s.removeException)
  const [type, setType] = useState<'pto' | 'sick'>('pto')
  const [date, setDate] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!exception) return
    setType(exception.type === 'sick' ? 'sick' : 'pto')
    setDate(exception.date)
    setAllDay(!exception.startTime || !exception.endTime)
    setStartTime(exception.startTime ?? '09:00')
    setEndTime(exception.endTime ?? '17:00')
    setNote(exception.note ?? '')
  }, [exception])

  const save = () => {
    if (!exception) return
    updateException(exception.id, {
      type,
      date,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      note: note.trim(),
    })
    onClose()
  }

  const remove = () => {
    if (!exception) return
    removeException(exception.id)
    onClose()
  }

  return (
    <Modal open={Boolean(exception)} onClose={onClose} title="Edit Time Off" size="sm">
      <div className="space-y-4">
        <Select label="Type" value={type} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setType(event.target.value as 'pto' | 'sick')}>
          <option value="pto">Time Off</option>
          <option value="sick">Sick Leave</option>
        </Select>
        <Input label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className="accent-[var(--accent)]" />
          Full day
        </label>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            <Input label="End" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </div>
        )}
        <Input label="Reason" value={note} onChange={(event) => setNote(event.target.value)} placeholder={type === 'pto' ? 'Vacation, personal request, appointment...' : 'Sick, medical, family care...'} />
        <div className="flex justify-between pt-2">
          <Button variant="danger" size="sm" onClick={remove}>Delete</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={!date}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function MobileWeeklySchedule({
  days,
  employees,
  shifts,
  exceptions,
  blockColors,
  canEdit,
  showShiftNames,
  showShiftNotes,
  compactSchedule,
  openAdd,
  openEdit,
  openAbsence,
  duplicateShift,
}: {
  days: Date[]
  employees: Employee[]
  shifts: Shift[]
  exceptions: ScheduleException[]
  blockColors: Map<string, string>
  canEdit: boolean
  showShiftNames: boolean
  showShiftNotes: boolean
  compactSchedule: boolean
  openAdd: (date: string, employeeId: string) => void
  openEdit: (shift: Shift) => void
  openAbsence: (exception: ScheduleException) => void
  duplicateShift: (shift: Shift) => void
}) {
  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const dayShifts = shifts
          .filter((shift) => shift.date === dateStr)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
        const holiday = exceptions.find((exception) => exception.type === 'holiday' && exception.date === dateStr)
        const today = isToday(day)

        return (
          <section
            key={dateStr}
            className={`rounded-lg border bg-[var(--surface-2)] p-3 ${
              today ? 'border-[var(--accent)]/35' : 'border-[var(--border)]'
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{format(day, 'EEEE')}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{format(day, 'MMM d')}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {holiday && <span className="status-warning-chip rounded-md border px-2 py-1 text-[10px] font-semibold">Holiday</span>}
                {today && <span className="rounded-md bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">Today</span>}
              </div>
            </div>

            {employees.length === 0 ? (
              <p className="py-3 text-center text-xs text-[var(--text-tertiary)]">Add employees before scheduling shifts.</p>
            ) : (
              <div className="space-y-2">
                {employees.map((employee) => {
                  const employeeShifts = dayShifts.filter((shift) => shift.employeeId === employee.id)
                  const employeeAbsences = absencesForEmployeeDate(exceptions, employee.id, dateStr)
                  const conflictIds = new Set(employeeShifts.flatMap((shift) => (
                    employeeShifts.some((other) => shiftsOverlap(shift, other)) ? [shift.id] : []
                  )))

                  return (
                    <div key={employee.id} className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: employee.color }} />
                          <span className="truncate text-xs font-semibold text-[var(--text)]">{employee.name}</span>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => openAdd(dateStr, employee.id)}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[var(--accent)] hover:bg-[var(--accent)]/10"
                            aria-label={`Add shift for ${employee.name}`}
                          >
                            <Plus size={13} />
                          </button>
                        )}
                      </div>
                      {employeeAbsences.length > 0 ? (
                        <div className="space-y-1.5">
                          {employeeAbsences.map((exception) => (
                            <AbsenceCard key={exception.id} exception={exception} canEdit={canEdit} onClick={() => openAbsence(exception)} />
                          ))}
                        </div>
                      ) : employeeShifts.length > 0 ? (
                        <div className="space-y-1.5">
                          {employeeShifts.map((shift) => {
                            const shiftExceptions = exceptionsForShift(shift, exceptions)
                            return (
                              <ShiftCard
                                key={shift.id}
                                shift={shift}
                                accentColor={blockColors.get(shift.type) ?? employee.color}
                                hasConflict={conflictIds.has(shift.id)}
                                canEdit={canEdit}
                                showShiftName={showShiftNames}
                                showShiftNote={showShiftNotes}
                                compact={compactSchedule}
                                exceptionLabels={shiftExceptions.map((exception) => EXCEPTION_LABELS[exception.type])}
                                onClick={() => openEdit(shift)}
                                onDuplicate={() => duplicateShift(shift)}
                                onDragStart={() => {}}
                              />
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[var(--text-tertiary)]">No shift</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export function WeeklyGrid({ canEdit = false }: { canEdit?: boolean }) {
  const { employees, shifts, addShift, addShifts, updateShift, removeShifts, reorderEmployees } = useScheduleStore()
  const blocks = useScheduleBlocksStore((s) => s.blocks)
  const weekStartsOn = useSchedulePreferencesStore((s) => s.weekStartsOn)
  const showShiftNames = useSchedulePreferencesStore((s) => s.showShiftNames)
  const showShiftNotes = useSchedulePreferencesStore((s) => s.showShiftNotes)
  const showEmployeeRoles = useSchedulePreferencesStore((s) => s.showEmployeeRoles)
  const compactSchedule = useSchedulePreferencesStore((s) => s.compactSchedule)
  const isMainDashboard = useUiStore((s) => s.storeId === 'main')
  const storeHours = useDisplayStore((s) => s.storeHours)
  const exceptions = useScheduleExceptionsStore((s) => s.exceptions)
  const [weekOffset, setWeekOffset] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | undefined>()
  const [editAbsence, setEditAbsence] = useState<ScheduleException | null>(null)
  const [clickedDate, setClickedDate] = useState<string | undefined>()
  const [clickedEmployeeId, setClickedEmployeeId] = useState<string | undefined>()
  const [dragShiftId, setDragShiftId] = useState<string | null>(null)
  const [dragEmployeeId, setDragEmployeeId] = useState<string | null>(null)
  const [dragOverEmployeeId, setDragOverEmployeeId] = useState<string | null>(null)

  const weekStart = addDays(startOfWeek(new Date(), { weekStartsOn }), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const currentWeekDates = weekDates(weekStart)
  const previousWeekStart = addDays(weekStart, -7)
  const previousWeekDates = weekDates(previousWeekStart)
  const currentWeekShifts = shifts.filter((shift) => currentWeekDates.includes(shift.date))
  const previousWeekShifts = shifts.filter((shift) => previousWeekDates.includes(shift.date))
  const currentWeekExceptions = exceptions.filter((exception) => currentWeekDates.includes(exception.date))
  const blockColors = new Map(blocks.map((block) => [block.name, block.color]))
  const coverageAlerts = buildCoverageAlerts(currentWeekShifts, employees, blocks, currentWeekDates, storeHours, currentWeekExceptions)

  const openAdd = (date: string, employeeId: string) => {
    if (!canEdit) return
    setEditShift(undefined); setClickedDate(date); setClickedEmployeeId(employeeId); setModalOpen(true)
  }
  const openEdit = (shift: Shift) => {
    if (!canEdit) return
    setEditShift(shift); setClickedDate(undefined); setClickedEmployeeId(undefined); setModalOpen(true)
  }
  const openAbsence = (exception: ScheduleException) => {
    if (!canEdit) return
    setEditAbsence(exception)
  }

  const copyPreviousWeek = () => {
    if (!canEdit) return
    if (previousWeekShifts.length === 0) return
    const shouldReplace = currentWeekShifts.length === 0 || window.confirm('Replace shifts already scheduled in this week?')
    if (shouldReplace) removeShifts(currentWeekShifts.map((shift) => shift.id))
    addShifts(templateShiftsToShifts(shiftsToTemplateShifts(previousWeekShifts, previousWeekDates), weekStart))
  }

  const duplicateShift = (shift: Shift) => {
    if (!canEdit) return
    addShift({
      employeeId: shift.employeeId,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      type: shift.type,
      note: shift.note,
    })
  }

  const copyEmployeeWeek = (employeeId: string) => {
    if (!canEdit) return
    const employeeShifts = currentWeekShifts.filter((shift) => shift.employeeId === employeeId)
    if (employeeShifts.length === 0) return
    addShifts(employeeShifts.map((shift) => ({
      employeeId,
      date: format(addDays(new Date(`${shift.date}T12:00:00`), 7), 'yyyy-MM-dd'),
      startTime: shift.startTime,
      endTime: shift.endTime,
      type: shift.type,
      note: shift.note,
    })))
    setWeekOffset((w) => w + 1)
  }

  const dropShift = (date: string, employeeId: string) => {
    if (!canEdit) return
    if (!dragShiftId) return
    updateShift(dragShiftId, { date, employeeId })
    setDragShiftId(null)
  }

  const moveEmployee = (targetEmployeeId: string) => {
    if (!canEdit) return
    if (!dragEmployeeId || dragEmployeeId === targetEmployeeId) return
    const fromIndex = employees.findIndex((employee) => employee.id === dragEmployeeId)
    const toIndex = employees.findIndex((employee) => employee.id === targetEmployeeId)
    if (fromIndex < 0 || toIndex < 0) return
    const ordered = [...employees]
    const [moved] = ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, moved)
    reorderEmployees(ordered)
    setDragEmployeeId(null)
    setDragOverEmployeeId(null)
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Week navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--reveal-bg)] text-[var(--text-secondary)] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[var(--text)] min-w-[150px] text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--reveal-bg)] text-[var(--text-secondary)] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {canEdit && (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy size={12} />}
                onClick={copyPreviousWeek}
                disabled={previousWeekShifts.length === 0 || employees.length === 0}
              >
                Copy Previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Save size={12} />}
                onClick={() => setTemplatesOpen(true)}
              >
                Templates
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Printer size={12} />}
            onClick={() => setPrintOpen(true)}
          >
            Print
          </Button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Today
          </button>
        </div>
      </div>

      <CoverageAlerts alerts={coverageAlerts} />

      {/* Main grid */}
      <div className="flex-1 overflow-auto px-3 sm:px-4 pb-4">
        <div className="lg:hidden">
          <MobileWeeklySchedule
            days={days}
            employees={employees}
            shifts={shifts}
            exceptions={currentWeekExceptions}
            blockColors={blockColors}
            canEdit={canEdit}
            showShiftNames={showShiftNames}
            showShiftNotes={showShiftNotes}
            compactSchedule={compactSchedule}
            openAdd={openAdd}
            openEdit={openEdit}
            openAbsence={openAbsence}
            duplicateShift={duplicateShift}
          />
        </div>
        <div className="hidden min-w-[1060px] lg:block">
          {/* Day headers */}
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: SCHEDULE_GRID_COLUMNS }}>
            <div className="sticky left-0 z-20 flex min-h-[58px] items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2-solid)] px-3 py-2 shadow-[4px_0_10px_rgba(0,0,0,0.08)]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]">
                  <Users size={13} />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Team</div>
                  <div className="truncate text-xs font-semibold text-[var(--text)]">{employees.length} employee{employees.length === 1 ? '' : 's'}</div>
                </div>
              </div>
            </div>
            {days.map((d) => {
              const today = isToday(d)
              const dateStr = format(d, 'yyyy-MM-dd')
              const holiday = currentWeekExceptions.find((exception) => exception.type === 'holiday' && exception.date === dateStr)
              return (
                <div
                  key={d.toISOString()}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors ${today ? 'bg-[var(--accent)]/10' : ''}`}
                >
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${today ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    {format(d, 'EEE')}
                  </span>
                  <span
                    className={`text-lg font-bold leading-none ${today ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}
                  >
                    {format(d, 'd')}
                  </span>
                  {today && (
                    <span className="text-[9px] text-[var(--accent)] font-semibold">Today</span>
                  )}
                  {holiday && (
                    <span className="status-warning-chip rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase">Holiday</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Employee rows */}
          <div className="space-y-2">
            {employees.map((emp) => {
              const employeeWeekHours = currentWeekShifts
                .filter((shift) => shift.employeeId === emp.id)
                .filter((shift) => !isStoreManagerEmployee(emp) && scheduleBlockCountsTowardCoverage(blocks.find((block) => block.name === shift.type), shift.type))
                .reduce((sum, shift) => sum + (shiftHours(shift) ?? 0), 0)
              return (
                <motion.div
                key={emp.id}
                layout
                className="grid gap-2 items-start"
                style={{ gridTemplateColumns: SCHEDULE_GRID_COLUMNS }}
              >
                {/* Employee label */}
                <div
                  draggable={canEdit}
                  onDragStart={(e) => {
                    if (!canEdit) return
                    setDragEmployeeId(emp.id)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/luna-employee-id', emp.id)
                  }}
                  onDragOver={(e) => {
                    if (!canEdit) return
                    if (!dragEmployeeId || dragEmployeeId === emp.id) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverEmployeeId(emp.id)
                  }}
                  onDragLeave={() => {
                    if (dragOverEmployeeId === emp.id) setDragOverEmployeeId(null)
                  }}
                  onDrop={(e) => {
                    if (!canEdit) return
                    e.preventDefault()
                    moveEmployee(emp.id)
                  }}
                  onDragEnd={() => {
                    setDragEmployeeId(null)
                    setDragOverEmployeeId(null)
                  }}
                  className={`sticky left-0 z-10 flex items-center gap-2.5 px-2.5 sm:px-3 py-2 rounded-lg bg-[var(--surface-2-solid)] border h-full shadow-[4px_0_10px_rgba(0,0,0,0.08)] group/emp transition-colors ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''} ${
                    dragOverEmployeeId === emp.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)]'
                  }`}
                  title={canEdit ? 'Drag to reorder employees' : undefined}
                >
                  {canEdit && <GripVertical size={13} className="hidden sm:block flex-shrink-0 text-[var(--text-tertiary)]" />}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: emp.color }}
                  >
                    {emp.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold leading-snug text-[var(--text)] break-words">{emp.name}</div>
                    {showEmployeeRoles && (
                      <div className="text-[10px] leading-snug text-[var(--text-tertiary)] break-words">
                        {isMainDashboard && emp.storeId ? `${emp.storeId} · ` : ''}{emp.role}
                      </div>
                    )}
                    {employeeWeekHours > 0 && (
                      <div className="mt-1 text-[10px] font-medium leading-snug text-[var(--text-tertiary)]">
                        {formatHours(employeeWeekHours)} hrs
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        copyEmployeeWeek(emp.id)
                      }}
                      className="ml-auto hidden sm:flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--reveal-bg)] opacity-0 group-hover/emp:opacity-100 transition-opacity"
                      title="Copy employee week to next week"
                    >
                      <Copy size={11} />
                    </button>
                  )}
                </div>

                {/* Day cells */}
                {days.map((d) => {
                  const dateStr = format(d, 'yyyy-MM-dd')
                  const dayShifts = shifts.filter((s) => s.employeeId === emp.id && s.date === dateStr)
                  const dayAbsences = absencesForEmployeeDate(currentWeekExceptions, emp.id, dateStr)
                  const today = isToday(d)
                  const conflictIds = new Set(dayShifts.flatMap((shift) => (
                    dayShifts.some((other) => shiftsOverlap(shift, other)) ? [shift.id] : []
                  )))

                  return (
                    <div
                      key={dateStr}
                      onClick={() => openAdd(dateStr, emp.id)}
                      onDragOver={(e) => { if (canEdit) e.preventDefault() }}
                      onDrop={(e) => { if (!canEdit) return; e.preventDefault(); dropShift(dateStr, emp.id) }}
                      className={`group relative flex flex-col gap-1 p-1.5 rounded-lg ${compactSchedule ? 'min-h-[50px]' : 'min-h-[68px]'} transition-colors border ${canEdit ? 'cursor-pointer' : ''} ${
                        today
                          ? 'bg-[var(--accent)]/5 border-[var(--accent)]/20'
                          : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)]/30 hover:bg-[var(--reveal-bg)]'
                      }`}
                    >
                      <AnimatePresence>
                        {dayAbsences.length > 0 ? dayAbsences.map((exception) => (
                          <AbsenceCard key={exception.id} exception={exception} canEdit={canEdit} onClick={() => openAbsence(exception)} />
                        )) : dayShifts.map((shift) => {
                          const shiftExceptions = exceptionsForShift(shift, currentWeekExceptions)
                          return (
                            <ShiftCard
                              key={shift.id}
                              shift={shift}
                              accentColor={blockColors.get(shift.type) ?? emp.color}
                              hasConflict={conflictIds.has(shift.id)}
                              canEdit={canEdit}
                              showShiftName={showShiftNames}
                              showShiftNote={showShiftNotes}
                              compact={compactSchedule}
                              exceptionLabels={shiftExceptions.map((exception) => EXCEPTION_LABELS[exception.type])}
                              onClick={() => openEdit(shift)}
                              onDuplicate={() => duplicateShift(shift)}
                              onDragStart={() => { if (canEdit) setDragShiftId(shift.id) }}
                            />
                          )
                        })}
                      </AnimatePresence>

                      {canEdit && dayShifts.length === 0 && dayAbsences.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                            <Plus size={12} className="text-[var(--accent)]" />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                </motion.div>
              )
            })}
          </div>

          {employees.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-tertiary)]">
              <span className="text-4xl">👥</span>
              <p className="text-sm">No employees yet — add one in Employees</p>
            </div>
          )}
        </div>
      </div>

      <ShiftModal
        open={canEdit && modalOpen}
        onClose={() => setModalOpen(false)}
        initialDate={clickedDate}
        initialEmployeeId={clickedEmployeeId}
        editShift={editShift}
      />
      <ScheduleTemplatesModal
        open={canEdit && templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        weekStart={weekStart}
      />
      <AbsenceEditModal exception={canEdit ? editAbsence : null} onClose={() => setEditAbsence(null)} />
      <PrintableScheduleModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        weekStart={weekStart}
      />
    </div>
  )
}
