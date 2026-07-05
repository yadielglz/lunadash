import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, CalendarDays, CheckCircle2, Printer, Save, Store, Target, Trash2, TrendingUp, UserRound, Users } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select } from '../../ui/Input'
import { useScheduleStore, type Employee } from '../../../store/scheduleStore'
import { useScheduleBlocksStore } from '../../../store/scheduleBlocksStore'
import {
  useEmployeeInsightsStore,
  type EmployeeSchedulePreference,
} from '../../../store/employeeInsightsStore'
import { useCommissionSnapshotStore, type CommissionSnapshot } from '../../../store/commissionSnapshotStore'
import { dbGetStores, type StoreSummary } from '../../../lib/supabase'
import { normalizeStoreId } from '../../../lib/storeIds'
import { useUiStore } from '../../../store/uiStore'
import { formatMoney } from '../../../lib/performanceSheet'

const COLORS = ['#0078d4', '#7c5ff5', '#e74856', '#16c60c', '#f7630c', '#00b7c3', '#e3008c', '#8764b8', '#10893e']

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

function num(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function toggleNumber(values: number[], value: number) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort()
}

function toggleString(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort()
}

function emptyPreference(employee: Employee): EmployeeSchedulePreference {
  return {
    employeeId: employee.id,
    storeId: employee.storeId,
    preferredDays: [],
    unavailableDays: [],
    preferredBlocks: [],
    maxHoursPerWeek: null,
    notes: '',
    updatedAt: new Date().toISOString(),
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums text-[var(--text)]">{value}</div>
    </div>
  )
}

function goalPercent(actual: number, goal: number) {
  if (!goal) return null
  return (actual / goal) * 100
}

function formatPercent(value: number | null) {
  if (value === null) return '-'
  return `${value.toFixed(0)}%`
}

function formatReportDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatReportDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function capturePercent(actual: number, opportunity: number) {
  if (!opportunity) return null
  return (actual / opportunity) * 100
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function MetricHero({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
          <div className="mt-1 truncate text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
          <div className="mt-1 truncate text-xs text-[var(--text-secondary)]">{helper}</div>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
          {icon}
        </span>
      </div>
    </div>
  )
}

function snapshotsForEmployee(snapshots: CommissionSnapshot[], employee: Employee | undefined, storeId: string) {
  if (!employee) return []
  const employeeName = employee.name.trim().toLowerCase()
  return snapshots
    .filter((snapshot) => (
      normalizeStoreId(snapshot.storeId ?? '') === normalizeStoreId(employee.storeId ?? storeId)
      && snapshot.employeeName.trim().toLowerCase() === employeeName
    ))
    .sort((a, b) => {
      if (a.snapshotDate !== b.snapshotDate) return b.snapshotDate.localeCompare(a.snapshotDate)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
}

function buildEmployeeCommissionReportHtml(params: {
  employee: Employee
  snapshots: CommissionSnapshot[]
  storeId: string
}) {
  const latest = params.snapshots[0]
  const generatedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  const assignedStore = normalizeStoreId(params.employee.storeId ?? params.storeId)
  const goalStats = latest
    ? [
      goalPercent(latest.accessories, latest.accessoryGoal),
      goalPercent(latest.revenue, latest.revenueGoal),
      goalPercent(latest.vaf, latest.vafGoal),
      goalPercent(latest.voiceLines, latest.voiceLinesGoal),
      goalPercent(latest.bts, latest.btsGoal),
    ].filter((percent): percent is number => percent !== null)
    : []
  const goalsHit = goalStats.filter((percent) => percent >= 100).length
  const rows = params.snapshots.map((snapshot) => {
    const open = Math.max(snapshot.commissionOpportunity - snapshot.commission, 0)
    return `<tr>
      <td>${escapeHtml(formatReportDate(snapshot.snapshotDate))}</td>
      <td>${escapeHtml(formatMoney(snapshot.commission))}</td>
      <td>${escapeHtml(formatMoney(snapshot.commissionOpportunity))}</td>
      <td>${escapeHtml(formatPercent(capturePercent(snapshot.commission, snapshot.commissionOpportunity)))}</td>
      <td>${escapeHtml(formatMoney(open))}</td>
      <td>${escapeHtml(formatMoney(snapshot.accessories))}</td>
      <td>${escapeHtml(formatMoney(snapshot.revenue))}</td>
      <td>${escapeHtml(formatMoney(snapshot.vaf))}</td>
      <td>${escapeHtml(String(Math.round(snapshot.voiceLines)))}</td>
      <td>${escapeHtml(String(Math.round(snapshot.bts)))}</td>
    </tr>`
  }).join('')

  return `<!doctype html><html><head><title>${escapeHtml(params.employee.name)} Commission Report</title><style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", system-ui, sans-serif; background: #eef2f7; }
    main { width: 8.5in; min-height: 11in; margin: 0 auto; padding: 0.55in; background: white; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
    h1 { margin: 0; font-size: 25px; letter-spacing: 0; }
    h2 { margin: 24px 0 0; font-size: 15px; }
    .subtle { color: #64748b; font-size: 12px; }
    .meta { text-align: right; line-height: 1.5; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
    .tile { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; min-height: 82px; }
    .label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .value { margin-top: 8px; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { text-align: left; color: #64748b; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding: 8px 6px; }
    td { border-bottom: 1px solid #e5e7eb; padding: 9px 6px; font-size: 11px; }
    td:not(:first-child), th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
    footer { margin-top: 22px; color: #64748b; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print {
      body { background: white; }
      main { width: auto; min-height: auto; margin: 0; padding: 0.45in; }
    }
  </style></head><body><main>
    <header>
      <div>
        <h1>${escapeHtml(params.employee.name)}</h1>
        <div class="subtle">Employee Commission Report</div>
      </div>
      <div class="meta subtle">
        <div>${escapeHtml(params.employee.role || 'Associate')}</div>
        <div>Store ID: ${escapeHtml(assignedStore || 'DEFAULT')}</div>
        <div>Generated ${escapeHtml(generatedAt)}</div>
      </div>
    </header>
    <section class="summary">
      <div class="tile"><div class="label">Latest Paid</div><div class="value">${escapeHtml(latest ? formatMoney(latest.commission) : '-')}</div></div>
      <div class="tile"><div class="label">Opportunity</div><div class="value">${escapeHtml(latest ? formatMoney(latest.commissionOpportunity) : '-')}</div></div>
      <div class="tile"><div class="label">Capture</div><div class="value">${escapeHtml(latest ? formatPercent(capturePercent(latest.commission, latest.commissionOpportunity)) : '-')}</div></div>
      <div class="tile"><div class="label">Goals Hit</div><div class="value">${escapeHtml(latest ? `${goalsHit}/${goalStats.length || 5}` : '-')}</div></div>
    </section>
    <h2>Commission History</h2>
    <table><thead><tr><th>Date</th><th>Paid</th><th>Opp</th><th>Capture</th><th>Open</th><th>Accessories</th><th>Revenue</th><th>VAF</th><th>Voice</th><th>BTS</th></tr></thead><tbody>${rows}</tbody></table>
    <footer>${escapeHtml(latest?.updatedAt ? `Latest snapshot updated ${formatReportDateTime(latest.updatedAt)}` : 'No commission snapshots saved.')}</footer>
  </main></body></html>`
}

export function EmployeesPage() {
  const { employees, updateEmployee } = useScheduleStore()
  const blocks = useScheduleBlocksStore((s) => s.blocks)
  const { accessRole, storeId, setTab } = useUiStore()
  const canChooseStore = accessRole === 'admin' || accessRole === 'district_manager'
  const [selectedId, setSelectedId] = useState(employees[0]?.id ?? '')
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftStoreId, setDraftStoreId] = useState('')
  const [draftRole, setDraftRole] = useState('')
  const [draftColor, setDraftColor] = useState(COLORS[0])
  const [draftPreference, setDraftPreference] = useState<EmployeeSchedulePreference | null>(null)
  const preferences = useEmployeeInsightsStore((s) => s.preferences)
  const sales = useEmployeeInsightsStore((s) => s.sales)
  const loadInsights = useEmployeeInsightsStore((s) => s.loadInsights)
  const savePreference = useEmployeeInsightsStore((s) => s.savePreference)
  const removeSale = useEmployeeInsightsStore((s) => s.removeSale)
  const commissionSnapshots = useCommissionSnapshotStore((s) => s.snapshots)

  const selectedEmployee = employees.find((employee) => employee.id === selectedId) ?? employees[0]
  const employeeSales = useMemo(() => (
    selectedEmployee
      ? sales
        .filter((sale) => sale.employeeId === selectedEmployee.id)
        .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || b.createdAt.localeCompare(a.createdAt))
      : []
  ), [sales, selectedEmployee])
  const monthKey = format(new Date(), 'yyyy-MM')
  const monthNr = employeeSales
    .filter((sale) => sale.saleDate.startsWith(monthKey))
    .reduce((sum, sale) => sum + sale.estimatedNetRevenue, 0)
  const employeeCommissionSnapshots = useMemo(() => (
    snapshotsForEmployee(commissionSnapshots, selectedEmployee, storeId)
  ), [commissionSnapshots, selectedEmployee, storeId])
  const latestSnapshot = employeeCommissionSnapshots[0]
  const snapshotGoalCount = latestSnapshot
    ? [
      goalPercent(latestSnapshot.accessories, latestSnapshot.accessoryGoal),
      goalPercent(latestSnapshot.revenue, latestSnapshot.revenueGoal),
      goalPercent(latestSnapshot.vaf, latestSnapshot.vafGoal),
      goalPercent(latestSnapshot.voiceLines, latestSnapshot.voiceLinesGoal),
      goalPercent(latestSnapshot.bts, latestSnapshot.btsGoal),
    ].filter((percent): percent is number => percent !== null)
    : []
  const snapshotGoalsHit = snapshotGoalCount.filter((percent) => percent >= 100).length

  useEffect(() => {
    loadInsights()
  }, [loadInsights, storeId])

  useEffect(() => {
    if (!selectedEmployee) return
    setDraftName(selectedEmployee.name)
    setDraftStoreId(normalizeStoreId(selectedEmployee.storeId ?? storeId))
    setDraftRole(selectedEmployee.role)
    setDraftColor(selectedEmployee.color || COLORS[0])
    setDraftPreference(preferences.find((preference) => preference.employeeId === selectedEmployee.id) ?? emptyPreference(selectedEmployee))
  }, [preferences, selectedEmployee, storeId])

  useEffect(() => {
    if (!canChooseStore) return
    setStoresLoading(true)
    dbGetStores()
      .then((nextStores) => setStores(nextStores.filter((store) => normalizeStoreId(store.store_id) !== 'MAIN')))
      .finally(() => setStoresLoading(false))
  }, [canChooseStore])

  const saveProfile = () => {
    if (!selectedEmployee) return
    const name = draftName.trim()
    if (!name) {
      setMessage('Employee name is required.')
      return
    }
    updateEmployee(selectedEmployee.id, {
      name,
      role: draftRole.trim() || 'Associate',
      color: draftColor,
      ...(canChooseStore && draftStoreId ? { storeId: normalizeStoreId(draftStoreId) } : {}),
    })
    setMessage('Employee profile updated.')
  }

  const saveSchedulePreference = async () => {
    if (!draftPreference || !selectedEmployee) return
    await savePreference({
      ...draftPreference,
      employeeId: selectedEmployee.id,
      storeId: normalizeStoreId(selectedEmployee.storeId ?? storeId),
    })
    setMessage('Schedule preferences saved.')
  }

  const printCommissionReport = () => {
    if (!selectedEmployee || employeeCommissionSnapshots.length === 0) {
      setMessage('No commission snapshot is available to print.')
      return
    }
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setMessage('Pop-up blocked. Allow pop-ups to print this report.')
      return
    }
    printWindow.document.write(buildEmployeeCommissionReportHtml({
      employee: selectedEmployee,
      snapshots: employeeCommissionSnapshots,
      storeId,
    }))
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => {
      printWindow.print()
    }, 150)
  }

  if (employees.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center">
        <div>
          <UserRound size={28} className="mx-auto text-[var(--accent)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--text)]">No employees yet</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">Add employees from Schedule, then manage profiles here.</p>
          <Button className="mt-4" size="sm" variant="primary" icon={<CalendarDays size={13} />} onClick={() => setTab('schedule')}>
            Open Schedule
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text)]">
              <UserRound size={18} className="text-[var(--accent)]" />
              Employees
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Profiles, schedule preferences, and sales NR tracking.</p>
          </div>
          {message && <div className="text-xs font-medium text-[var(--accent)]">{message}</div>}
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[var(--border)] p-3 lg:border-b-0 lg:border-r">
          <div className="space-y-1.5">
            {employees.map((employee) => {
              const active = selectedEmployee?.id === employee.id
              const employeeTotal = sales
                .filter((sale) => sale.employeeId === employee.id && sale.saleDate.startsWith(monthKey))
                .reduce((sum, sale) => sum + sale.estimatedNetRevenue, 0)
              return (
                <button
                  key={employee.id}
                  onClick={() => setSelectedId(employee.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--reveal-bg)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: employee.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">{employee.name}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)]">
                    <span className="truncate">{employee.role}</span>
                    <span>{formatMoney(employeeTotal)} MTD</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {selectedEmployee && draftPreference && (
          <main className="overflow-auto p-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
              <div className="space-y-4">
                <Card className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Store size={16} className="text-[var(--accent)]" />
                    <h2 className="text-sm font-semibold text-[var(--text)]">Profile</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input label="Name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                    <Input label="Role" value={draftRole} onChange={(e) => setDraftRole(e.target.value)} />
                    <Select
                      label="Assigned Store"
                      value={draftStoreId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDraftStoreId(e.target.value)}
                      disabled={!canChooseStore || storesLoading}
                    >
                      <option value={normalizeStoreId(selectedEmployee.storeId ?? storeId)}>{normalizeStoreId(selectedEmployee.storeId ?? storeId)}</option>
                      {stores.map((store) => (
                        <option key={store.store_id} value={store.store_id}>
                          {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
                        </option>
                      ))}
                    </Select>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Color</label>
                      <div className="flex flex-wrap gap-2">
                        {COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setDraftColor(color)}
                            aria-label={`Set employee color ${color}`}
                            className={`h-8 w-8 rounded-lg border transition-transform ${draftColor === color ? 'scale-105 border-white/40 ring-2 ring-[var(--accent)]/30' : 'border-[var(--border)] hover:scale-105'}`}
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="primary" icon={<Save size={13} />} onClick={saveProfile}>
                      Save Profile
                    </Button>
                  </div>
                </Card>

                <Card className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-[var(--accent)]" />
                    <h2 className="text-sm font-semibold text-[var(--text)]">Schedule Preferences</h2>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Preferred Days</div>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => setDraftPreference((pref) => pref ? { ...pref, preferredDays: toggleNumber(pref.preferredDays, day.value) } : pref)}
                          className={`rounded-md border px-2.5 py-1 text-xs ${
                            draftPreference.preferredDays.includes(day.value)
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Unavailable Days</div>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => setDraftPreference((pref) => pref ? { ...pref, unavailableDays: toggleNumber(pref.unavailableDays, day.value) } : pref)}
                          className={`rounded-md border px-2.5 py-1 text-xs ${
                            draftPreference.unavailableDays.includes(day.value)
                              ? 'border-red-400/40 bg-red-500/10 text-red-300'
                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Preferred Blocks</div>
                    <div className="flex flex-wrap gap-1.5">
                      {blocks.length === 0 ? (
                        <span className="text-xs text-[var(--text-tertiary)]">Create schedule blocks in Settings to assign preferences.</span>
                      ) : blocks.map((block) => (
                        <button
                          key={block.id}
                          onClick={() => setDraftPreference((pref) => pref ? { ...pref, preferredBlocks: toggleString(pref.preferredBlocks, block.name) } : pref)}
                          className={`rounded-md border px-2.5 py-1 text-xs ${
                            draftPreference.preferredBlocks.includes(block.name)
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                          }`}
                        >
                          {block.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <Input
                      label="Max Hours"
                      type="number"
                      value={draftPreference.maxHoursPerWeek ?? ''}
                      onChange={(e) => setDraftPreference((pref) => pref ? { ...pref, maxHoursPerWeek: e.target.value ? num(e.target.value) : null } : pref)}
                    />
                    <Input
                      label="Notes"
                      value={draftPreference.notes}
                      onChange={(e) => setDraftPreference((pref) => pref ? { ...pref, notes: e.target.value } : pref)}
                      placeholder="Availability notes"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="primary" icon={<Save size={13} />} onClick={saveSchedulePreference}>
                      Save Preferences
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="space-y-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <BadgeDollarSign size={16} className="text-[var(--accent)]" />
                      <h2 className="text-sm font-semibold text-[var(--text)]">Latest Commission Snapshot</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {latestSnapshot ? latestSnapshot.snapshotDate : 'No snapshot yet'}
                      </span>
                      <Button size="sm" variant="secondary" icon={<Printer size={13} />} disabled={!latestSnapshot} onClick={printCommissionReport}>
                        Print Report
                      </Button>
                    </div>
                  </div>

                  {latestSnapshot ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <MetricHero
                          icon={<BadgeDollarSign size={17} />}
                          label="Commission"
                          value={formatMoney(latestSnapshot.commission)}
                          helper={`Opp ${latestSnapshot.commissionOpportunity ? formatMoney(latestSnapshot.commissionOpportunity) : '-'}`}
                        />
                        <MetricHero
                          icon={<TrendingUp size={17} />}
                          label="Revenue"
                          value={formatMoney(latestSnapshot.revenue)}
                          helper={`${formatPercent(goalPercent(latestSnapshot.revenue, latestSnapshot.revenueGoal))} to goal`}
                        />
                        <MetricHero
                          icon={<Target size={17} />}
                          label="Accessory"
                          value={formatMoney(latestSnapshot.accessories)}
                          helper={`${formatPercent(goalPercent(latestSnapshot.accessories, latestSnapshot.accessoryGoal))} to goal`}
                        />
                        <MetricHero
                          icon={<Users size={17} />}
                          label="Voice Lines"
                          value={String(latestSnapshot.voiceLines)}
                          helper={`${formatPercent(goalPercent(latestSnapshot.voiceLines, latestSnapshot.voiceLinesGoal))} to goal`}
                        />
                        <MetricHero
                          icon={<Target size={17} />}
                          label="VAF"
                          value={formatMoney(latestSnapshot.vaf)}
                          helper={`${formatPercent(goalPercent(latestSnapshot.vaf, latestSnapshot.vafGoal))} to goal`}
                        />
                        <MetricHero
                          icon={<CheckCircle2 size={17} />}
                          label="Goals Hit"
                          value={`${snapshotGoalsHit}/${snapshotGoalCount.length || 5}`}
                          helper={latestSnapshot.notes ? latestSnapshot.notes : 'No snapshot notes'}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
                      No commission snapshot has been saved for this employee yet.
                    </div>
                  )}
                </Card>

                <Card className="space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-sm font-semibold text-[var(--text)]">Recent Sales</h2>
                    <div className="flex gap-2">
                      <Stat label="MTD Est. NR" value={formatMoney(monthNr)} />
                      <Stat label="Posted Sales" value={String(employeeSales.length)} />
                    </div>
                  </div>
                  {employeeSales.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[var(--text-tertiary)]">No posted Performance Update sales for this employee yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {employeeSales.slice(0, 12).map((sale) => (
                        <div key={sale.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[var(--text)]">{formatMoney(sale.estimatedNetRevenue)}</div>
                            <div className="text-[10px] uppercase text-[var(--text-tertiary)]">
                              {sale.saleDate} · {sale.category} · Posted Update{sale.note ? ` · ${sale.note}` : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => removeSale(sale.id)}
                            className="rounded-md p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-red-400"
                            title="Delete sale"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
