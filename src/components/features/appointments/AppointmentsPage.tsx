import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock3, RefreshCw, Send, UserRound } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select, Textarea } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { EmptyState, ModuleHeader, ModuleSkeleton } from '../../ui/ModulePrimitives'
import { useUiStore } from '../../../store/uiStore'
import { getDealerInfo } from '../../../lib/dealers'
import { normalizeStoreId } from '../../../lib/storeIds'
import { cn } from '../../../lib/utils'
import {
  APPOINTMENT_BUCKETS,
  appointmentFilledRows,
  appointmentPostpaidTotal,
  appointmentSheetForStore,
  fetchAppointmentTrackerData,
  updateAppointmentSheet,
  type AppointmentBucket,
  type AppointmentRow,
  type AppointmentTrackerData,
} from '../../../lib/appointments'

const DEFAULT_TOTAL = '1'
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function cleanWholeNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 3)
}

function cleanPhone(value: string) {
  return value.replace(/[^\d()+\-\s.]/g, '').slice(0, 24)
}

function dateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function todayKey() {
  return dateKey(new Date())
}

function monthLabel(date: Date) {
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function shortDateLabel(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function weekForDate(key: string): AppointmentBucket {
  const day = Number(key.slice(8, 10)) || 1
  const index = Math.min(4, Math.max(0, Math.ceil(day / 7) - 1))
  return APPOINTMENT_BUCKETS[index]
}

function monthDays(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function parseAppointmentDate(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slash) {
    const month = Number(slash[1])
    const day = Number(slash[2])
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
    return dateKey(new Date(year, month - 1, day))
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? '' : dateKey(parsed)
}

function appointmentTime(row: AppointmentRow) {
  const text = [row.selling, row.outcome].join(' ')
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (!match) return 'Time TBD'
  return `${match[1]}${match[2] ? `:${match[2]}` : ''}${match[3].toUpperCase()}`
}

export function AppointmentsPage() {
  const { accessId, accessRole, accessLabel, storeId } = useUiStore()
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [week, setWeek] = useState<AppointmentBucket>(weekForDate(todayKey()))
  const [employeeName, setEmployeeName] = useState(accessLabel || '')
  const [appointmentDate, setAppointmentDate] = useState(todayKey())
  const [totalPostpaidActivations, setTotalPostpaidActivations] = useState(DEFAULT_TOTAL)
  const [customerNumber, setCustomerNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [selling, setSelling] = useState('')
  const [outcome, setOutcome] = useState('')
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<AppointmentRow | null>(null)
  const [tracker, setTracker] = useState<AppointmentTrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const normalizedStore = normalizeStoreId(storeId)
  const sheetTitle = appointmentSheetForStore(normalizedStore)
  const dealer = getDealerInfo(normalizedStore)
  const selectedWeek = weekForDate(selectedDate)

  const rowsWithDates = useMemo(() => (
    (tracker?.rows ?? [])
      .map((row) => ({ row, key: parseAppointmentDate(row.appointmentDate) }))
      .filter((item) => item.key)
  ), [tracker])

  const appointmentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    rowsWithDates.forEach(({ key }) => counts.set(key, (counts.get(key) ?? 0) + 1))
    return counts
  }, [rowsWithDates])

  const selectedDateRows = useMemo(() => (
    rowsWithDates
      .filter(({ key }) => key === selectedDate)
      .map(({ row }) => row)
  ), [rowsWithDates, selectedDate])

  const selectedWeekRows = useMemo(() => appointmentFilledRows(tracker, selectedWeek), [selectedWeek, tracker])
  const selectedWeekTotal = useMemo(() => appointmentPostpaidTotal(tracker, selectedWeek), [selectedWeek, tracker])
  const availableRows = useMemo(() => {
    const datedSelectedRows = rowsWithDates
      .filter(({ key }) => key === selectedDate)
      .map((item) => item)

    if (datedSelectedRows.length > 0) return datedSelectedRows

    const weekRowsWithKeys = selectedWeekRows.map((row) => ({
      row,
      key: parseAppointmentDate(row.appointmentDate),
    }))
    const datedWeekRows = weekRowsWithKeys
      .filter((item) => item.key)
      .sort((a, b) => a.key.localeCompare(b.key))
    const undatedWeekRows = weekRowsWithKeys.filter((item) => !item.key)

    return [...datedWeekRows, ...undatedWeekRows].slice(0, 10)
  }, [rowsWithDates, selectedDate, selectedWeekRows])

  const parsedTotal = Number(totalPostpaidActivations)

  const loadTracker = async () => {
    setLoading(true)
    setError('')
    try {
      setTracker(await fetchAppointmentTrackerData(normalizedStore))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load appointment tracker.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTracker()
    // Load the current store sheet on page entry; manual refresh handles later reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedStore])

  const openAppointmentFlyout = (key: string) => {
    setSelectedDate(key)
    setAppointmentDate(key)
    setWeek(weekForDate(key))
    setEditingRow(null)
    resetForm()
    setMessage('')
    setError('')
    setFlyoutOpen(true)
  }

  const openEditFlyout = (row: AppointmentRow, key: string) => {
    const nextDate = key || parseAppointmentDate(row.appointmentDate) || selectedDate
    setSelectedDate(nextDate)
    setAppointmentDate(nextDate)
    setWeek((APPOINTMENT_BUCKETS.includes(row.week as AppointmentBucket) ? row.week : weekForDate(nextDate)) as AppointmentBucket)
    setEmployeeName(row.employeeName || accessLabel || '')
    setTotalPostpaidActivations(cleanWholeNumber(row.totalPostpaidActivations) || DEFAULT_TOTAL)
    setCustomerNumber(cleanPhone(row.customerNumber))
    setCustomerName(row.customerName)
    setSelling(row.selling)
    setOutcome(row.outcome)
    setEditingRow(row)
    setMessage('')
    setError('')
    setFlyoutOpen(true)
  }

  const moveMonth = (direction: -1 | 1) => {
    setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + direction, 1))
  }

  const resetForm = () => {
    setCustomerNumber('')
    setCustomerName('')
    setSelling('')
    setOutcome('')
    setTotalPostpaidActivations(DEFAULT_TOTAL)
  }

  const save = async () => {
    if (!accessRole || accessRole === 'display') {
      setError('Appointment updates require a store access session.')
      return
    }
    if (!sheetTitle) {
      setError(`Store ${normalizedStore || 'unknown'} is not mapped to an appointment sheet tab.`)
      return
    }
    if (!employeeName.trim()) {
      setError('Employee Name is required.')
      return
    }
    if (!appointmentDate) {
      setError('Appointment Date is required.')
      return
    }
    if (!Number.isInteger(parsedTotal) || parsedTotal < 0) {
      setError('Total Postpaid Activations must be a whole number.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await updateAppointmentSheet({
        accessId,
        accessRole,
        storeCode: normalizedStore,
        week,
        employeeName: employeeName.trim(),
        appointmentDate,
        totalPostpaidActivations: parsedTotal,
        customerNumber: customerNumber.trim(),
        customerName: customerName.trim(),
        selling: selling.trim(),
        outcome: outcome.trim(),
        rowNumber: editingRow?.rowNumber,
      })
      setMessage(result.message || `${editingRow ? 'Updated' : 'Added'} appointment to ${sheetTitle}.`)
      resetForm()
      setEditingRow(null)
      setFlyoutOpen(false)
      await loadTracker()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the appointment sheet.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="operations-page appointments-page flex h-full flex-col overflow-hidden">
      <ModuleHeader
        icon={<CalendarPlus size={18} />}
        eyebrow="Customer pipeline"
        title="Appointments"
        description="Plan customer visits, review weekly activation expectations, and keep follow-ups moving."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<CalendarPlus size={13} />} onClick={() => openAppointmentFlyout(selectedDate)}>
              New Appointment
            </Button>
            <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={loadTracker} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="operations-content flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card noPadding className="appointment-calendar overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-[var(--text)]">{monthLabel(calendarMonth)}</div>
                <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {dealer?.nickname || normalizedStore || 'Store'} · {sheetTitle || 'No appointment tab mapped'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="secondary" onClick={() => moveMonth(-1)} aria-label="Previous month">
                  <ChevronLeft size={15} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  const today = new Date()
                  setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                  setSelectedDate(todayKey())
                }}>
                  Today
                </Button>
                <Button size="icon" variant="secondary" onClick={() => moveMonth(1)} aria-label="Next month">
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
              {WEEKDAY_LABELS.map((day) => (
                <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays(calendarMonth).map((day) => {
                const key = dateKey(day)
                const inMonth = day.getMonth() === calendarMonth.getMonth()
                const active = key === selectedDate
                const count = appointmentCounts.get(key) ?? 0
                const isToday = key === todayKey()
                const cellWeek = weekForDate(key)
                const inSelectedWeek = cellWeek === selectedWeek && inMonth

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openAppointmentFlyout(key)}
                    className={cn(
                      'appointment-day min-h-[92px] border-b border-r border-[var(--border)] p-2 text-left transition-colors hover:bg-[var(--reveal-bg)]',
                      !inMonth && 'bg-[var(--surface-2)]/35 text-[var(--text-tertiary)]',
                      inSelectedWeek && !active && 'bg-[var(--accent)]/[0.045]',
                      active && 'bg-[var(--accent)]/10',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold',
                        isToday ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)]',
                        !inMonth && !isToday && 'text-[var(--text-tertiary)]'
                      )}>
                        {day.getDate()}
                      </span>
                      {count > 0 && (
                        <span className="rounded-md bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                          {count}
                        </span>
                      )}
                    </div>
                    {inMonth && day.getDate() % 7 === 1 && (
                      <div className="mt-2 inline-flex rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">
                        {cellWeek}
                      </div>
                    )}
                    {count > 0 && (
                      <div className="mt-3 space-y-1">
                        {rowsWithDates.filter((item) => item.key === key).slice(0, 2).map(({ row }, index) => (
                          <div key={`${row.customerNumber}-${index}`} className="truncate rounded-md bg-[var(--surface-2)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
                            {row.customerName || row.employeeName || 'Appointment'}
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          <aside className="appointment-sidebar space-y-4">
            <Card>
              <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">Selected Date</div>
              <div className="mt-1 text-xl font-semibold text-[var(--text)]">{shortDateLabel(selectedDate)}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{selectedDateRows.length} appointment{selectedDateRows.length === 1 ? '' : 's'} · {selectedWeek}</div>
              <Button className="mt-3 w-full" size="sm" variant="primary" icon={<CalendarPlus size={13} />} onClick={() => openAppointmentFlyout(selectedDate)}>
                Add Appointment
              </Button>
            </Card>

            <Card>
              <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">Selected Week</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{selectedWeek}</div>
              <div className="mt-2 text-sm font-semibold tabular-nums text-[var(--text)]">
                {loading ? '...' : selectedWeekTotal} expected activations
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{selectedWeekRows.length} filled appointment rows</div>
            </Card>

            <Card noPadding className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <div className="text-xs font-semibold text-[var(--text)]">Available Updates</div>
                <div className="text-[10px] uppercase text-[var(--text-tertiary)]">{selectedDateRows.length ? shortDateLabel(selectedDate) : selectedWeek}</div>
              </div>
              <div className="max-h-[28rem] divide-y divide-[var(--border)] overflow-y-auto">
                {availableRows.map(({ row, key }, index) => (
                  <button
                    key={`${key || row.week}-${row.customerNumber}-${index}`}
                    type="button"
                    onClick={() => openEditFlyout(row, key)}
                    className="block w-full px-3 py-3 text-left transition-colors hover:bg-[var(--reveal-bg)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text)]">{row.customerName || 'Customer TBD'}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase text-[var(--text-tertiary)]">
                          <span className="inline-flex items-center gap-1"><Clock3 size={11} />{key ? shortDateLabel(key) : row.appointmentDate || 'Date TBD'} · {appointmentTime(row)}</span>
                          <span className="inline-flex items-center gap-1"><UserRound size={11} />{row.employeeName || 'No rep'}</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                        {row.totalPostpaidActivations || 0} act
                      </span>
                    </div>
                  </button>
                ))}
                {!loading && availableRows.length === 0 && (
                  <EmptyState
                    compact
                    className="m-3"
                    icon={<CalendarPlus size={20} />}
                    title="No appointment updates this week"
                    description={`New or changed appointment rows for ${selectedWeek} will appear here.`}
                    action={<Button size="sm" variant="ghost" onClick={() => openAppointmentFlyout(selectedDate)}>Add appointment</Button>}
                  />
                )}
                {loading && (
                  <ModuleSkeleton rows={2} className="m-3" />
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <Modal open={flyoutOpen} onClose={() => {
        setFlyoutOpen(false)
        setEditingRow(null)
      }} title={editingRow ? 'Edit Appointment' : 'New Appointment'} size="lg">
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            {editingRow ? 'Editing' : 'Adding'} appointment for <span className="font-semibold text-[var(--text)]">{shortDateLabel(appointmentDate)}</span> {editingRow?.rowNumber ? `on row ${editingRow.rowNumber}` : ''} in {sheetTitle || 'unmapped sheet'}.
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Week #" value={week} onChange={(event) => setWeek(event.target.value as AppointmentBucket)}>
              {APPOINTMENT_BUCKETS.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Input label="Employee Name" value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Employee name" />
            <Input label="Appointment Date" type="date" value={appointmentDate} onChange={(event) => {
              const nextDate = event.target.value || todayKey()
              setAppointmentDate(nextDate)
              setSelectedDate(nextDate)
              setWeek(weekForDate(nextDate))
            }} />
            <Input label="Total Postpaid Activations" inputMode="numeric" value={totalPostpaidActivations} onChange={(event) => setTotalPostpaidActivations(cleanWholeNumber(event.target.value))} />
            <Input label="Customer Number" inputMode="tel" value={customerNumber} onChange={(event) => setCustomerNumber(cleanPhone(event.target.value))} />
            <Input label="Customer Name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            <div className="sm:col-span-2">
              <Textarea label="What are we selling?" rows={2} value={selling} onChange={(event) => setSelling(event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Textarea label="Outcome?" rows={2} value={outcome} onChange={(event) => setOutcome(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5">
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle size={13} />
                  {error}
                </p>
              )}
              {message && (
                <p className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 size={13} />
                  {message}
                </p>
              )}
            </div>
            <Button icon={<Send size={13} />} loading={saving} disabled={!sheetTitle || !employeeName.trim() || !appointmentDate} onClick={save}>
              {editingRow ? 'Update Row' : 'Add to Sheet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
