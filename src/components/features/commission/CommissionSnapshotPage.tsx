import { useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  CalendarDays,
  DollarSign,
  LockKeyhole,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select } from '../../ui/Input'
import { useCommissionSnapshotStore, type CommissionSnapshot } from '../../../store/commissionSnapshotStore'
import { useUiStore } from '../../../store/uiStore'
import { useDisplayStore } from '../../../store/displayStore'
import { useScheduleStore, type Employee } from '../../../store/scheduleStore'
import { normalizeStoreId } from '../../../lib/storeIds'
import { getDealerInfo } from '../../../lib/dealers'

const todayKey = () => {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

const numberFields = [
  'commission',
  'commissionOpportunity',
  'accessories',
  'accessoryGoal',
  'revenue',
  'revenueGoal',
  'vaf',
  'vafGoal',
  'voiceLines',
  'voiceLinesGoal',
  'bts',
  'btsGoal',
] as const
type NumberField = typeof numberFields[number]
type MetricKey = 'accessories' | 'revenue' | 'vaf' | 'voiceLines' | 'bts'

const BOARD_METRICS: Array<{
  key: MetricKey
  goalKey: NumberField
  label: string
  money?: boolean
}> = [
  { key: 'accessories', goalKey: 'accessoryGoal', label: 'Accessory', money: true },
  { key: 'revenue', goalKey: 'revenueGoal', label: 'Revenue', money: true },
  { key: 'vaf', goalKey: 'vafGoal', label: 'VAF', money: true },
  { key: 'voiceLines', goalKey: 'voiceLinesGoal', label: 'Voice Lines' },
  { key: 'bts', goalKey: 'btsGoal', label: 'BTS' },
]

function formatMoney(value: number) {
  return Math.round(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function formatDecimal(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatMetricValue(value: number, money?: boolean) {
  return money ? formatMoney(value) : formatDecimal(value)
}

function gapPercent(actual: number, goal: number) {
  if (!goal) return null
  return ((actual - goal) / goal) * 100
}

function formatGap(value: number | null) {
  if (value === null) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(0)}%`
}

function parseMetric(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function storeLabel(storeId: string, fallbackName: string, fallbackNumber: string) {
  const dealer = getDealerInfo(storeId)
  if (dealer) return `${dealer.nickname} | ${dealer.location}`
  if (fallbackName && fallbackName !== 'Luna Store') return fallbackName
  if (fallbackNumber) return `Store ${fallbackNumber}`
  return storeId === 'main' ? 'All Stores' : `Store ${storeId}`
}

function MetricSummary({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode
  label: string
  value: string
  helper?: string
}) {
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
          {helper && <div className="mt-1 text-xs text-[var(--text-tertiary)]">{helper}</div>}
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
          {icon}
        </span>
      </div>
    </Card>
  )
}

function numericInputValue(snapshot: CommissionSnapshot, field: NumberField) {
  const value = snapshot[field]
  return value === 0 ? '' : String(value)
}

function MetricCell({
  snapshot,
  metric,
  canEdit,
  onUpdateNumber,
}: {
  snapshot: CommissionSnapshot
  metric: typeof BOARD_METRICS[number]
  canEdit: boolean
  onUpdateNumber: (snapshot: CommissionSnapshot, field: NumberField, value: string) => void
}) {
  const actual = snapshot[metric.key]
  const goal = snapshot[metric.goalKey]
  const gap = gapPercent(actual, goal)
  const gapTone = gap === null
    ? 'text-[var(--text-tertiary)]'
    : gap >= 0
      ? 'text-emerald-400'
      : 'text-red-400'

  return (
    <div className="relative min-h-[118px] rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className={`text-[11px] font-semibold tabular-nums ${gapTone}`}>{formatGap(gap)}</div>
        <div className="text-right text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
          Goal {goal ? formatMetricValue(goal, metric.money) : '-'}
        </div>
      </div>

      <div className="mt-3 text-center">
        <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{metric.label}</div>
        {canEdit ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              key={`${snapshot.id}-${metric.key}-${snapshot.updatedAt}`}
              aria-label={`${metric.label} actual`}
              inputMode="decimal"
              defaultValue={numericInputValue(snapshot, metric.key)}
              onBlur={(event) => onUpdateNumber(snapshot, metric.key, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              className="h-9 text-center tabular-nums"
              placeholder="Actual"
            />
            <Input
              key={`${snapshot.id}-${metric.goalKey}-${snapshot.updatedAt}`}
              aria-label={`${metric.label} goal`}
              inputMode="decimal"
              defaultValue={numericInputValue(snapshot, metric.goalKey)}
              onBlur={(event) => onUpdateNumber(snapshot, metric.goalKey, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              className="h-9 text-center tabular-nums"
              placeholder="Goal"
            />
          </div>
        ) : (
          <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {formatMetricValue(actual, metric.money)}
          </div>
        )}
      </div>
    </div>
  )
}

function isCommissionableEmployee(employee: Employee, storeId: string) {
  const employeeStoreId = normalizeStoreId(employee.storeId ?? storeId)
  const role = employee.role.trim().toLowerCase().replace(/\s+/g, ' ')
  return employeeStoreId === storeId && role !== 'store manager'
}

export function CommissionSnapshotPage() {
  const { snapshots, addSnapshot, updateSnapshot, removeSnapshot } = useCommissionSnapshotStore()
  const employees = useScheduleStore((s) => s.employees)
  const { accessLabel, accessRole, storeId } = useUiStore()
  const { companyName, storeNumber } = useDisplayStore()
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const canEdit = accessRole === 'admin' || accessRole === 'district_manager'
  const normalizedStoreId = normalizeStoreId(storeId)

  const commissionableEmployees = useMemo(() => (
    employees
      .filter((employee) => isCommissionableEmployee(employee, normalizedStoreId))
      .sort((a, b) => {
        const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER
        const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.name.localeCompare(b.name)
      })
  ), [employees, normalizedStoreId])

  const storeSnapshots = useMemo(() => (
    snapshots
      .filter((snapshot) => normalizeStoreId(snapshot.storeId ?? '') === normalizedStoreId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.employeeName.localeCompare(b.employeeName))
  ), [normalizedStoreId, snapshots])

  const dates = useMemo(() => {
    const uniqueDates = Array.from(new Set([todayKey(), ...storeSnapshots.map((snapshot) => snapshot.snapshotDate)]))
    return uniqueDates.sort((a, b) => b.localeCompare(a))
  }, [storeSnapshots])

  const visibleSnapshots = useMemo(() => (
    storeSnapshots.filter((snapshot) => snapshot.snapshotDate === selectedDate)
  ), [selectedDate, storeSnapshots])

  const totals = useMemo(() => {
    const totalCommission = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.commission, 0)
    const totalAccessories = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.accessories, 0)
    const totalVoiceLines = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.voiceLines, 0)
    const totalBts = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.bts, 0)
    const totalRevenue = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.revenue, 0)
    const totalVaf = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.vaf, 0)
    return { totalCommission, totalAccessories, totalVoiceLines, totalBts, totalRevenue, totalVaf }
  }, [visibleSnapshots])

  const addRow = () => {
    const assignedNames = new Set(visibleSnapshots.map((snapshot) => snapshot.employeeName.trim().toLowerCase()).filter(Boolean))
    const employee = commissionableEmployees.find((item) => !assignedNames.has(item.name.trim().toLowerCase())) ?? commissionableEmployees[0]
    if (!employee) return

    addSnapshot({
      storeId: normalizedStoreId,
      snapshotDate: selectedDate,
      employeeName: employee.name,
      commission: 0,
      commissionOpportunity: 0,
      accessories: 0,
      accessoryGoal: 0,
      revenue: 0,
      revenueGoal: 0,
      vaf: 0,
      vafGoal: 0,
      voiceLines: 0,
      voiceLinesGoal: 0,
      bts: 0,
      btsGoal: 0,
      notes: '',
      sortOrder: visibleSnapshots.length,
      updatedBy: accessLabel,
    })
  }

  const updateNumber = (snapshot: CommissionSnapshot, field: NumberField, value: string) => {
    updateSnapshot(snapshot.id, {
      [field]: parseMetric(value),
      storeId: snapshot.storeId,
      updatedBy: accessLabel,
    } as Partial<CommissionSnapshot>)
  }

  const storeDisplay = storeLabel(normalizedStoreId, companyName, storeNumber)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--app-bg)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BadgeDollarSign size={19} className="text-[var(--accent)]" />
              <h1 className="text-xl font-semibold text-[var(--text)]">Commission Snapshot</h1>
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                <LockKeyhole size={12} />
                Locked
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Manual store board for commissions and attach-rate metrics.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Snapshot Date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full sm:w-48"
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {new Date(`${date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </Select>
            {canEdit && (
              <Input
                label="Jump to Date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value || todayKey())}
                className="w-full sm:w-44"
              />
            )}
            {canEdit && (
              <Button variant="primary" icon={<Plus size={15} />} onClick={addRow} disabled={commissionableEmployees.length === 0}>
                Add Row
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricSummary icon={<DollarSign size={17} />} label="Commission" value={formatMoney(totals.totalCommission)} helper={storeDisplay} />
          <MetricSummary icon={<TrendingUp size={17} />} label="Revenue" value={formatMoney(totals.totalRevenue)} helper={`${formatMoney(totals.totalAccessories)} accessories`} />
          <MetricSummary icon={<Users size={17} />} label="Voice Lines" value={formatDecimal(totals.totalVoiceLines)} helper={`${formatDecimal(totals.totalBts)} BTS`} />
          <MetricSummary icon={<Target size={17} />} label="VAF" value={formatMoney(totals.totalVaf)} helper={`${visibleSnapshots.length} reps tracked`} />
        </div>

        {!canEdit && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <LockKeyhole size={14} className="text-[var(--accent)]" />
            Admin or District Manager updates this board. Your view is read-only.
          </div>
        )}

        {canEdit && commissionableEmployees.length === 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] px-3 py-2 text-xs text-[var(--status-warn-text)]">
            <Users size={14} />
            Add store employees first. Employees with the Store Manager role are excluded from commission snapshots.
          </div>
        )}

        <div className="space-y-3">
          {visibleSnapshots.map((snapshot) => (
            <div key={snapshot.id} className="overflow-hidden overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="grid min-w-[1080px] grid-cols-[220px_repeat(5,minmax(150px,1fr))_44px] gap-3">
                <div className="min-h-[118px] rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] p-3">
                  <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Rep</div>
                  <div className="mt-2">
                    {canEdit ? (
                      <Select
                        aria-label="Rep name"
                        value={snapshot.employeeName}
                        onChange={(event) => updateSnapshot(snapshot.id, { employeeName: event.target.value, storeId: snapshot.storeId, updatedBy: accessLabel })}
                        className="h-9"
                      >
                        {snapshot.employeeName && !commissionableEmployees.some((employee) => employee.name === snapshot.employeeName) && (
                          <option value={snapshot.employeeName}>{snapshot.employeeName}</option>
                        )}
                        {commissionableEmployees.map((employee) => (
                          <option key={employee.id} value={employee.name}>
                            {employee.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="font-semibold">{snapshot.employeeName || '-'}</span>
                    )}
                  </div>
                  <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-2">
                    <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Commission</div>
                    {canEdit ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Input
                          key={`${snapshot.id}-commission-${snapshot.updatedAt}`}
                          aria-label="Commission actual"
                          inputMode="decimal"
                          defaultValue={numericInputValue(snapshot, 'commission')}
                          onBlur={(event) => updateNumber(snapshot, 'commission', event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                          }}
                          className="h-9 text-center tabular-nums"
                          placeholder="Actual"
                        />
                        <Input
                          key={`${snapshot.id}-commissionOpportunity-${snapshot.updatedAt}`}
                          aria-label="Commission opportunity"
                          inputMode="decimal"
                          defaultValue={numericInputValue(snapshot, 'commissionOpportunity')}
                          onBlur={(event) => updateNumber(snapshot, 'commissionOpportunity', event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                          }}
                          className="h-9 text-center tabular-nums"
                          placeholder="Opp"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{formatMoney(snapshot.commission)}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Opp {snapshot.commissionOpportunity ? formatMoney(snapshot.commissionOpportunity) : '-'}</div>
                      </div>
                    )}
                  </div>
                </div>

                {BOARD_METRICS.map((metric) => (
                  <MetricCell
                    key={metric.key}
                    snapshot={snapshot}
                    metric={metric}
                    canEdit={canEdit}
                    onUpdateNumber={updateNumber}
                  />
                ))}

                <div className="flex items-start justify-end">
                  {canEdit && (
                    <Button size="icon" variant="danger" onClick={() => removeSnapshot(snapshot.id)} aria-label="Remove row">
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {visibleSnapshots.length === 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-16 text-center">
              <CalendarDays size={36} className="mx-auto text-[var(--text-tertiary)]" />
              <div className="mt-3 text-sm font-semibold text-[var(--text)]">No commission snapshot for this date</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {canEdit ? 'Add a row to start the board.' : 'Check back after Admin or District Manager enters the board.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
