import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarPlus, CheckCircle2, RefreshCw, Send } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select, Textarea } from '../../ui/Input'
import { useUiStore } from '../../../store/uiStore'
import { getDealerInfo } from '../../../lib/dealers'
import { normalizeStoreId } from '../../../lib/storeIds'
import {
  APPOINTMENT_BUCKETS,
  APPOINTMENT_COLUMNS,
  appointmentFilledRows,
  appointmentPostpaidTotal,
  appointmentSheetForStore,
  fetchAppointmentTrackerData,
  updateAppointmentSheet,
  type AppointmentBucket,
  type AppointmentTrackerData,
} from '../../../lib/appointments'

const DEFAULT_TOTAL = '1'

function cleanWholeNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 3)
}

function cleanPhone(value: string) {
  return value.replace(/[^\d()+\-\s.]/g, '').slice(0, 24)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function AppointmentsPage() {
  const { accessId, accessRole, accessLabel, storeId } = useUiStore()
  const [week, setWeek] = useState<AppointmentBucket>('Week 1')
  const [employeeName, setEmployeeName] = useState(accessLabel || '')
  const [appointmentDate, setAppointmentDate] = useState(todayKey())
  const [totalPostpaidActivations, setTotalPostpaidActivations] = useState(DEFAULT_TOTAL)
  const [customerNumber, setCustomerNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [selling, setSelling] = useState('')
  const [outcome, setOutcome] = useState('')
  const [tracker, setTracker] = useState<AppointmentTrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const normalizedStore = normalizeStoreId(storeId)
  const sheetTitle = appointmentSheetForStore(normalizedStore)
  const dealer = getDealerInfo(normalizedStore)
  const parsedTotal = Number(totalPostpaidActivations)
  const weekRows = useMemo(() => appointmentFilledRows(tracker, week), [tracker, week])
  const weekTotal = useMemo(() => appointmentPostpaidTotal(tracker, week), [tracker, week])

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
      })
      setMessage(result.message || `Added appointment to ${sheetTitle}.`)
      setCustomerNumber('')
      setCustomerName('')
      setSelling('')
      setOutcome('')
      setTotalPostpaidActivations(DEFAULT_TOTAL)
      await loadTracker()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the appointment sheet.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text)]">
              <CalendarPlus size={18} className="text-[var(--accent)]" />
              Appointments
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Add appointments to the current store tab through Google Cloud Services.
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={loadTracker} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <div className="mb-4">
              <div className="text-sm font-semibold text-[var(--text)]">Appointment Row</div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                Sheet tab: {sheetTitle || 'not mapped'} · Columns A-H
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Week #" value={week} onChange={(event) => setWeek(event.target.value as AppointmentBucket)}>
                {APPOINTMENT_BUCKETS.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Input label="Employee Name" value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Employee name" />
              <Input label="Appointment Date" type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} />
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

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                Add to Sheet
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">Current Store</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text)]">{dealer?.nickname || normalizedStore || 'Store'}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{sheetTitle || 'No appointment tab mapped'}</div>
            </Card>

            <Card>
              <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">Selected Week</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums text-[var(--text)]">{loading ? '...' : weekTotal}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{weekRows.length} filled appointment rows · {week}</div>
            </Card>

            <Card noPadding className="overflow-hidden">
              <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text)]">Sheet Columns</div>
              <div className="divide-y divide-[var(--border)]">
                {APPOINTMENT_COLUMNS.map((column, index) => (
                  <div key={column} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-[var(--text-secondary)]">{column}</span>
                    <span className="font-semibold text-[var(--text-tertiary)]">{String.fromCharCode(65 + index)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card noPadding className="overflow-hidden xl:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <div className="text-xs font-semibold text-[var(--text)]">Recent Rows</div>
              <div className="text-[10px] uppercase text-[var(--text-tertiary)]">{tracker?.sheetTitle || sheetTitle || 'Appointment sheet'}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                  <tr>
                    {APPOINTMENT_COLUMNS.map((column) => (
                      <th key={column} className="px-3 py-2 font-semibold">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {weekRows.slice(0, 12).map((row, index) => (
                    <tr key={`${row.week}-${row.employeeName}-${row.customerNumber}-${index}`} className="text-[var(--text-secondary)]">
                      <td className="px-3 py-2 text-[var(--text)]">{row.week}</td>
                      <td className="px-3 py-2">{row.employeeName}</td>
                      <td className="px-3 py-2">{row.appointmentDate}</td>
                      <td className="px-3 py-2 tabular-nums">{row.totalPostpaidActivations}</td>
                      <td className="px-3 py-2 tabular-nums">{row.customerNumber}</td>
                      <td className="px-3 py-2">{row.customerName}</td>
                      <td className="px-3 py-2">{row.selling}</td>
                      <td className="px-3 py-2">{row.outcome}</td>
                    </tr>
                  ))}
                  {!loading && weekRows.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-[var(--text-tertiary)]" colSpan={APPOINTMENT_COLUMNS.length}>
                        No filled rows for {week}.
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td className="px-3 py-6 text-center text-[var(--text-tertiary)]" colSpan={APPOINTMENT_COLUMNS.length}>
                        Loading appointment rows...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
