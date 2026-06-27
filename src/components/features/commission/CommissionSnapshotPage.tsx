import { useEffect, useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  StickyNote,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select, Textarea } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { useCommissionSnapshotStore, type CommissionSnapshot } from '../../../store/commissionSnapshotStore'
import { useUiStore } from '../../../store/uiStore'
import { useScheduleStore, type Employee } from '../../../store/scheduleStore'
import { normalizeStoreId } from '../../../lib/storeIds'
import { cn } from '../../../lib/utils'
import { dbGetCommissionSnapshots } from '../../../lib/supabase'

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
type SummaryMode = 'daily' | 'mtd' | 'need'
type StoreGoalField = 'accessoryGoal' | 'revenueGoal' | 'vafGoal' | 'voiceLinesGoal' | 'btsGoal'
type StoreGoalDefaults = Record<StoreGoalField, number>

const BOARD_METRICS: Array<{
  key: MetricKey
  goalKey: StoreGoalField
  label: string
  shortLabel: string
  money?: boolean
}> = [
  { key: 'accessories', goalKey: 'accessoryGoal', label: 'Accessory', shortLabel: 'Acc', money: true },
  { key: 'revenue', goalKey: 'revenueGoal', label: 'Revenue', shortLabel: 'Rev', money: true },
  { key: 'vaf', goalKey: 'vafGoal', label: 'VAF', shortLabel: 'VAF', money: true },
  { key: 'voiceLines', goalKey: 'voiceLinesGoal', label: 'Voice Lines', shortLabel: 'Voice' },
  { key: 'bts', goalKey: 'btsGoal', label: 'BTS', shortLabel: 'BTS' },
]

const STORE_GOAL_FIELDS = BOARD_METRICS.map((metric) => metric.goalKey)
const emptyStoreGoalDefaults: StoreGoalDefaults = {
  accessoryGoal: 0,
  revenueGoal: 0,
  vafGoal: 0,
  voiceLinesGoal: 0,
  btsGoal: 0,
}

function formatMoney(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDecimal(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatMetricValue(value: number, money?: boolean) {
  return money ? formatMoney(value) : formatDecimal(value)
}

function goalPercent(actual: number, goal: number) {
  if (!goal) return null
  return (actual / goal) * 100
}

function capturePercent(actual: number, opportunity: number) {
  if (!opportunity) return null
  return (actual / opportunity) * 100
}

function formatGoalPercent(value: number | null) {
  if (value === null) return '-'
  return `${value.toFixed(0)}%`
}

function progressTone(value: number | null) {
  if (value === null) return {
    text: 'text-[var(--text-tertiary)]',
    bar: 'bg-[var(--surface-3)]',
  }
  if (value >= 100) return {
    text: 'text-emerald-500',
    bar: 'bg-emerald-500',
  }
  if (value >= 80) return {
    text: 'text-amber-500',
    bar: 'bg-amber-500',
  }
  return {
    text: 'text-red-500',
    bar: 'bg-red-500',
  }
}

function daysInSelectedMonth(dateKey: string) {
  const [year, month] = dateKey.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

function selectedDayOfMonth(dateKey: string) {
  return Number(dateKey.slice(8, 10)) || 1
}

function monthKey(dateKey: string) {
  return dateKey.slice(0, 7)
}

function eomDailyNeed(mtdActual: number, monthGoal: number, dateKey: string) {
  const daysLeft = Math.max(1, daysInSelectedMonth(dateKey) - selectedDayOfMonth(dateKey))
  return Math.max(0, monthGoal - mtdActual) / daysLeft
}

function parseMetric(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function storeGoalDefaultsKey(storeId: string) {
  return `luna-commission-goal-defaults:${normalizeStoreId(storeId)}`
}

function normalizeStoreGoalDefaults(value: unknown): StoreGoalDefaults {
  if (!value || typeof value !== 'object') return { ...emptyStoreGoalDefaults }
  const record = value as Partial<Record<StoreGoalField, unknown>>
  return STORE_GOAL_FIELDS.reduce((defaults, field) => {
    const numberValue = Number(record[field])
    defaults[field] = Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0
    return defaults
  }, { ...emptyStoreGoalDefaults })
}

function readStoreGoalDefaults(storeId: string): StoreGoalDefaults {
  try {
    const raw = window.localStorage.getItem(storeGoalDefaultsKey(storeId))
    return normalizeStoreGoalDefaults(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...emptyStoreGoalDefaults }
  }
}

function saveStoreGoalDefaults(storeId: string, defaults: StoreGoalDefaults) {
  window.localStorage.setItem(storeGoalDefaultsKey(storeId), JSON.stringify(defaults))
}

function sortCommissionSnapshots(snapshots: CommissionSnapshot[]) {
  return [...snapshots].sort((a, b) => {
    if (a.snapshotDate !== b.snapshotDate) return b.snapshotDate.localeCompare(a.snapshotDate)
    return a.sortOrder - b.sortOrder || a.employeeName.localeCompare(b.employeeName)
  })
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDateLabel(dateKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], options ?? { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimeLabel(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '--'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function numericInputValue(snapshot: CommissionSnapshot, field: NumberField) {
  const value = snapshot[field]
  return value === 0 ? '' : String(value)
}

function ProgressBar({ value }: { value: number | null }) {
  const tone = progressTone(value)
  const width = value === null ? 0 : Math.min(100, Math.max(0, value))

  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
      <div className={cn('h-full rounded-full transition-all duration-300', tone.bar)} style={{ width: `${width}%` }} />
    </div>
  )
}

function StatusPill({ value, label }: { value: number | null; label: string }) {
  const tone = progressTone(value)

  return (
    <span className={cn(
      'inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold tabular-nums',
      value === null
        ? 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
        : value >= 100
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
          : value >= 80
            ? 'border-amber-500/20 bg-amber-500/10 text-amber-500'
            : 'border-red-500/20 bg-red-500/10 text-red-500'
    )}>
      <span className={tone.text}>{formatGoalPercent(value)}</span>
      <span className="ml-1 text-[var(--text-tertiary)]">{label}</span>
    </span>
  )
}

function MetricCardFrame({
  children,
  status,
  featured = false,
}: {
  children: React.ReactNode
  status: number | null
  featured?: boolean
}) {
  const tone = progressTone(status)

  return (
    <div className={cn(
      'relative flex min-h-[128px] flex-col justify-between overflow-hidden rounded-lg border bg-[var(--surface-solid)] p-3 shadow-[inset_0_1px_rgba(255,255,255,0.08)] transition-colors',
      featured ? 'border-[var(--accent)]/25' : 'border-[var(--border)]'
    )}>
      <div className={cn('absolute inset-x-0 top-0 h-0.5', tone.bar)} />
      {children}
    </div>
  )
}

function MetricSummary({
  icon,
  label,
  value,
  detail,
  status,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  status: number | null
}) {
  const tone = progressTone(status)

  return (
    <Card className="!rounded-lg !p-3 shadow-[inset_0_1px_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
          <div className="mt-0.5 truncate text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className={`font-semibold tabular-nums ${tone.text}`}>{formatGoalPercent(status)}</span>
            <span className="text-[var(--text-tertiary)]">{detail}</span>
          </div>
          <ProgressBar value={status} />
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
          {icon}
        </span>
      </div>
    </Card>
  )
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
  const percentToGoal = goalPercent(actual, goal)

  return (
    <MetricCardFrame status={percentToGoal}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{metric.label}</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--text)]">
              {formatMetricValue(actual, metric.money)}
            </div>
          </div>
          <StatusPill value={percentToGoal} label="goal" />
        </div>
        <ProgressBar value={percentToGoal} />
      </div>

      <div className="mt-3">
        {canEdit ? (
          <div>
            <div className="mb-1.5 grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
              <span>Actual</span>
              <span>Goal</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
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
                placeholder="0"
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
                placeholder="0"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-2)] px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Goal</span>
            <span className="truncate text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
              {goal ? formatMetricValue(goal, metric.money) : '-'}
            </span>
          </div>
        )}
      </div>
    </MetricCardFrame>
  )
}

function CommissionCell({
  snapshot,
  canEdit,
  onUpdateNumber,
}: {
  snapshot: CommissionSnapshot
  canEdit: boolean
  onUpdateNumber: (snapshot: CommissionSnapshot, field: NumberField, value: string) => void
}) {
  const capture = capturePercent(snapshot.commission, snapshot.commissionOpportunity)
  const missed = Math.max(0, snapshot.commissionOpportunity - snapshot.commission)

  return (
    <MetricCardFrame status={capture} featured>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase text-[var(--accent)]">Commission</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--text)]">{formatMoney(snapshot.commission)}</div>
          </div>
          <StatusPill value={capture} label="capture" />
        </div>
        <ProgressBar value={capture} />
      </div>

      <div className="mt-3">
        {canEdit ? (
          <div>
            <div className="mb-1.5 grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
              <span>Paid</span>
              <span>Opp</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                key={`${snapshot.id}-commission-${snapshot.updatedAt}`}
                aria-label="Commission actual"
                inputMode="decimal"
                defaultValue={numericInputValue(snapshot, 'commission')}
                onBlur={(event) => onUpdateNumber(snapshot, 'commission', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                className="h-9 text-center tabular-nums"
                placeholder="$0"
              />
              <Input
                key={`${snapshot.id}-commissionOpportunity-${snapshot.updatedAt}`}
                aria-label="Commission opportunity"
                inputMode="decimal"
                defaultValue={numericInputValue(snapshot, 'commissionOpportunity')}
                onBlur={(event) => onUpdateNumber(snapshot, 'commissionOpportunity', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                className="h-9 text-center tabular-nums"
                placeholder="$0"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[var(--surface-2)] px-2 py-1.5">
              <span className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Open</span>
              <span className="truncate text-xs font-semibold tabular-nums text-[var(--text-secondary)]">{missed ? formatMoney(missed) : '-'}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-[var(--surface-2)] px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Opp</div>
              <div className="truncate text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                {snapshot.commissionOpportunity ? formatMoney(snapshot.commissionOpportunity) : '-'}
              </div>
            </div>
            <div className="rounded-md bg-[var(--surface-2)] px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Open</div>
              <div className="truncate text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                {missed ? formatMoney(missed) : '-'}
              </div>
            </div>
          </div>
        )}
      </div>
    </MetricCardFrame>
  )
}

function RepCoachStrip({ snapshot }: { snapshot: CommissionSnapshot }) {
  const goals = BOARD_METRICS.map((metric) => ({
    label: metric.shortLabel,
    percent: goalPercent(snapshot[metric.key], snapshot[metric.goalKey]),
  })).filter((item) => item.percent !== null)
  const hitCount = goals.filter((item) => (item.percent ?? 0) >= 100).length
  const topGap = goals
    .filter((item) => (item.percent ?? 0) < 100)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0]
  const capture = capturePercent(snapshot.commission, snapshot.commissionOpportunity)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 font-semibold">
        <CheckCircle2 size={12} className={hitCount === goals.length && goals.length > 0 ? 'text-emerald-500' : 'text-[var(--text-tertiary)]'} />
        {hitCount}/{goals.length || BOARD_METRICS.length} goals
      </span>
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 font-semibold">
        <Zap size={12} className="text-[var(--accent)]" />
        Capture {formatGoalPercent(capture)}
      </span>
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 font-semibold">
        <Target size={12} className="text-amber-500" />
        {topGap ? `Coach ${topGap.label}` : 'On pace'}
      </span>
    </div>
  )
}

function RepHeader({
  snapshot,
  canEdit,
  commissionableEmployees,
  onUpdate,
  onRemove,
  compact = false,
}: {
  snapshot: CommissionSnapshot
  canEdit: boolean
  commissionableEmployees: Employee[]
  onUpdate: (updates: Partial<CommissionSnapshot>) => void
  onRemove: () => void
  compact?: boolean
}) {
  return (
    <div className={cn(
      'rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] shadow-[inset_0_1px_rgba(255,255,255,0.08)]',
      compact ? 'p-3' : 'p-2.5'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-sm font-semibold text-[var(--accent)]">
            {initialsForName(snapshot.employeeName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Rep</div>
            {canEdit ? (
              <Select
                aria-label="Rep name"
                value={snapshot.employeeName}
                onChange={(event) => onUpdate({ employeeName: event.target.value })}
                className="mt-1 h-9"
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
              <div className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">{snapshot.employeeName || '-'}</div>
            )}
          </div>
        </div>
        {canEdit && (
          <Button size="icon" variant="danger" onClick={onRemove} aria-label="Remove row" className="h-9 w-9">
            <Trash2 size={15} />
          </Button>
        )}
      </div>
      <RepCoachStrip snapshot={snapshot} />
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
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('daily')
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [storeGoalDefaults, setStoreGoalDefaults] = useState(() => readStoreGoalDefaults(storeId))
  const [goalDraft, setGoalDraft] = useState<StoreGoalDefaults>(() => readStoreGoalDefaults(storeId))
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const canEdit = accessRole === 'admin' || accessRole === 'district_manager'
  const normalizedStoreId = normalizeStoreId(storeId)

  useEffect(() => {
    const defaults = readStoreGoalDefaults(normalizedStoreId)
    setStoreGoalDefaults(defaults)
    setGoalDraft(defaults)
  }, [normalizedStoreId])

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
    const uniqueDates = Array.from(new Set([todayKey(), selectedDate, ...storeSnapshots.map((snapshot) => snapshot.snapshotDate)]))
    return uniqueDates.sort((a, b) => b.localeCompare(a))
  }, [selectedDate, storeSnapshots])

  const visibleSnapshots = useMemo(() => (
    storeSnapshots.filter((snapshot) => snapshot.snapshotDate === selectedDate)
  ), [selectedDate, storeSnapshots])

  const totals = useMemo(() => {
    const totalCommission = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.commission, 0)
    const totalCommissionOpportunity = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.commissionOpportunity, 0)
    const totalAccessories = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.accessories, 0)
    const totalAccessoryGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.accessoryGoal, 0)
    const totalVoiceLines = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.voiceLines, 0)
    const totalVoiceLinesGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.voiceLinesGoal, 0)
    const totalBts = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.bts, 0)
    const totalBtsGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.btsGoal, 0)
    const totalRevenue = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.revenue, 0)
    const totalRevenueGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.revenueGoal, 0)
    const averageRevenue = visibleSnapshots.length ? totalRevenue / visibleSnapshots.length : 0
    const totalVaf = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.vaf, 0)
    const totalVafGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.vafGoal, 0)
    const averageVaf = visibleSnapshots.length ? totalVaf / visibleSnapshots.length : 0
    return {
      totalCommission,
      totalCommissionOpportunity,
      totalAccessories,
      totalAccessoryGoal,
      totalVoiceLines,
      totalVoiceLinesGoal,
      totalBts,
      totalBtsGoal,
      totalRevenue,
      totalRevenueGoal,
      averageRevenue,
      totalVaf,
      totalVafGoal,
      averageVaf,
    }
  }, [visibleSnapshots])

  const mtdTotals = useMemo(() => {
    const month = monthKey(selectedDate)
    const monthSnapshots = storeSnapshots.filter((snapshot) => (
      snapshot.snapshotDate.startsWith(month)
      && snapshot.snapshotDate <= selectedDate
    ))
    return {
      commission: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.commission, 0),
      commissionOpportunity: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.commissionOpportunity, 0),
      accessories: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.accessories, 0),
      revenue: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.revenue, 0),
      vaf: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.vaf, 0),
      voiceLines: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.voiceLines, 0),
      bts: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.bts, 0),
    }
  }, [selectedDate, storeSnapshots])

  const summaryCards = useMemo(() => {
    const details = summaryMode === 'daily'
      ? 'selected day'
      : summaryMode === 'mtd'
        ? 'month to date'
        : 'needed daily'
    const valueFor = (daily: number, mtd: number, need: number, money?: boolean) => {
      const value = summaryMode === 'daily' ? daily : summaryMode === 'mtd' ? mtd : need
      return formatMetricValue(value, money)
    }

    return [
      {
        icon: <BadgeDollarSign size={17} />,
        label: 'Commission Capture',
        value: summaryMode === 'need'
          ? formatMoney(Math.max(0, totals.totalCommissionOpportunity - totals.totalCommission))
          : formatGoalPercent(capturePercent(
            summaryMode === 'daily' ? totals.totalCommission : mtdTotals.commission,
            summaryMode === 'daily' ? totals.totalCommissionOpportunity : mtdTotals.commissionOpportunity
          )),
        detail: summaryMode === 'need' ? 'open opportunity' : details,
        status: capturePercent(
          summaryMode === 'daily' ? totals.totalCommission : mtdTotals.commission,
          summaryMode === 'daily' ? totals.totalCommissionOpportunity : mtdTotals.commissionOpportunity
        ),
      },
      {
        icon: <TrendingUp size={17} />,
        label: 'Accessory',
        value: valueFor(totals.totalAccessories, mtdTotals.accessories, eomDailyNeed(mtdTotals.accessories, totals.totalAccessoryGoal, selectedDate), true),
        detail: details,
        status: goalPercent(totals.totalAccessories, totals.totalAccessoryGoal),
      },
      {
        icon: <DollarSign size={17} />,
        label: 'Revenue Avg',
        value: valueFor(totals.averageRevenue, mtdTotals.revenue, eomDailyNeed(mtdTotals.revenue, totals.totalRevenueGoal, selectedDate), true),
        detail: details,
        status: goalPercent(totals.totalRevenue, totals.totalRevenueGoal),
      },
      {
        icon: <Users size={17} />,
        label: 'Voice Lines',
        value: valueFor(totals.totalVoiceLines, mtdTotals.voiceLines, eomDailyNeed(mtdTotals.voiceLines, totals.totalVoiceLinesGoal, selectedDate)),
        detail: details,
        status: goalPercent(totals.totalVoiceLines, totals.totalVoiceLinesGoal),
      },
      {
        icon: <Target size={17} />,
        label: 'VAF Avg',
        value: valueFor(totals.averageVaf, mtdTotals.vaf, eomDailyNeed(mtdTotals.vaf, totals.totalVafGoal, selectedDate), true),
        detail: details,
        status: goalPercent(totals.totalVaf, totals.totalVafGoal),
      },
      {
        icon: <Target size={17} />,
        label: 'BTS',
        value: valueFor(totals.totalBts, mtdTotals.bts, eomDailyNeed(mtdTotals.bts, totals.totalBtsGoal, selectedDate)),
        detail: details,
        status: goalPercent(totals.totalBts, totals.totalBtsGoal),
      },
    ]
  }, [mtdTotals, selectedDate, summaryMode, totals])

  const addSnapshotForEmployee = (employee: Employee, sortOrder: number) => {
    addSnapshot({
      storeId: normalizedStoreId,
      snapshotDate: selectedDate,
      employeeName: employee.name,
      commission: 0,
      commissionOpportunity: 0,
      accessories: 0,
      accessoryGoal: storeGoalDefaults.accessoryGoal,
      revenue: 0,
      revenueGoal: storeGoalDefaults.revenueGoal,
      vaf: 0,
      vafGoal: storeGoalDefaults.vafGoal,
      voiceLines: 0,
      voiceLinesGoal: storeGoalDefaults.voiceLinesGoal,
      bts: 0,
      btsGoal: storeGoalDefaults.btsGoal,
      notes: '',
      sortOrder,
      updatedBy: accessLabel,
    })
    setLastSavedAt(new Date().toISOString())
  }

  const addRow = () => {
    const assignedNames = new Set(visibleSnapshots.map((snapshot) => snapshot.employeeName.trim().toLowerCase()).filter(Boolean))
    const employee = commissionableEmployees.find((item) => !assignedNames.has(item.name.trim().toLowerCase())) ?? commissionableEmployees[0]
    if (!employee) return
    addSnapshotForEmployee(employee, visibleSnapshots.length)
  }

  const addMissingRows = () => {
    const assignedNames = new Set(visibleSnapshots.map((snapshot) => snapshot.employeeName.trim().toLowerCase()).filter(Boolean))
    const missingEmployees = commissionableEmployees.filter((employee) => !assignedNames.has(employee.name.trim().toLowerCase()))
    missingEmployees.forEach((employee, index) => addSnapshotForEmployee(employee, visibleSnapshots.length + index))
  }

  const updateRow = (snapshot: CommissionSnapshot, updates: Partial<CommissionSnapshot>) => {
    updateSnapshot(snapshot.id, {
      ...updates,
      storeId: snapshot.storeId,
      updatedBy: accessLabel,
    })
    setLastSavedAt(new Date().toISOString())
  }

  const updateNumber = (snapshot: CommissionSnapshot, field: NumberField, value: string) => {
    updateRow(snapshot, { [field]: parseMetric(value) } as Partial<CommissionSnapshot>)
  }

  const refreshSnapshots = async () => {
    setRefreshing(true)
    try {
      const freshSnapshots = await dbGetCommissionSnapshots(normalizedStoreId)
      useCommissionSnapshotStore.setState((state) => ({
        snapshots: sortCommissionSnapshots([
          ...state.snapshots.filter((snapshot) => normalizeStoreId(snapshot.storeId ?? '') !== normalizedStoreId),
          ...freshSnapshots,
        ]),
      }))
      setLastSavedAt(new Date().toISOString())
    } finally {
      setRefreshing(false)
    }
  }

  const openGoalModal = () => {
    const defaults = readStoreGoalDefaults(normalizedStoreId)
    setStoreGoalDefaults(defaults)
    setGoalDraft(defaults)
    setGoalModalOpen(true)
  }

  const saveStoreGoals = () => {
    const previousDefaults = storeGoalDefaults
    const nextDefaults = normalizeStoreGoalDefaults(goalDraft)
    saveStoreGoalDefaults(normalizedStoreId, nextDefaults)
    setStoreGoalDefaults(nextDefaults)
    visibleSnapshots.forEach((snapshot) => {
      const updates = STORE_GOAL_FIELDS.reduce((patch, field) => {
        const currentValue = snapshot[field]
        if (currentValue === 0 || currentValue === previousDefaults[field]) {
          patch[field] = nextDefaults[field]
        }
        return patch
      }, {} as Partial<Pick<CommissionSnapshot, StoreGoalField>>)
      if (Object.keys(updates).length > 0) updateRow(snapshot, updates)
    })
    setGoalModalOpen(false)
    setLastSavedAt(new Date().toISOString())
  }

  const missingEmployeeCount = commissionableEmployees.length - new Set(
    visibleSnapshots.map((snapshot) => snapshot.employeeName.trim().toLowerCase()).filter(Boolean)
  ).size

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--app-bg)] px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <BadgeDollarSign size={19} className="text-[var(--accent)]" />
              <h1 className="text-xl font-semibold text-[var(--text)]">Commission Snapshot</h1>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase',
                canEdit
                  ? 'border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
              )}>
                {canEdit ? <Pencil size={12} /> : <LockKeyhole size={12} />}
                {canEdit ? 'Editable' : 'Read-only'}
              </span>
              {(lastSavedAt || visibleSnapshots[0]?.updatedAt) && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                  <Clock3 size={12} />
                  Updated {formatTimeLabel(lastSavedAt || visibleSnapshots[0]?.updatedAt)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Daily commission capture, attach-rate goals, and coaching notes for the store board.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex items-end gap-2">
              <Button size="icon" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label="Previous day">
                <ChevronLeft size={15} />
              </Button>
              <Input
                label="Snapshot Date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value || todayKey())}
                className="w-full md:w-44"
              />
              <Button size="icon" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label="Next day">
                <ChevronRight size={15} />
              </Button>
            </div>
            <Select
              label="Saved Dates"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full md:w-48"
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {formatDateLabel(date)}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<RefreshCw size={15} />} loading={refreshing} onClick={refreshSnapshots}>
                Refresh
              </Button>
              {canEdit && (
                <>
                <Button variant="accent" icon={<Target size={15} />} onClick={openGoalModal}>
                  Store Goals
                </Button>
                <Button variant="secondary" icon={<Users size={15} />} onClick={addMissingRows} disabled={missingEmployeeCount <= 0}>
                  Add Team
                </Button>
                <Button variant="primary" icon={<Plus size={15} />} onClick={addRow} disabled={commissionableEmployees.length === 0}>
                  Add Row
                </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">
            {formatDateLabel(selectedDate, { weekday: 'long', month: 'short', day: 'numeric' })} board
          </div>
          <div className="inline-grid grid-cols-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
            {([
              ['daily', 'Today'],
              ['mtd', 'MTD'],
              ['need', 'Need/day'],
            ] as Array<[SummaryMode, string]>).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSummaryMode(mode)}
                className={cn(
                  'h-8 rounded-md px-3 text-xs font-semibold transition-colors',
                  summaryMode === mode
                    ? 'bg-[var(--accent)] text-white shadow-[0_8px_20px_var(--accent-glow)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {summaryCards.map((card) => (
            <MetricSummary
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              detail={card.detail}
              status={card.status}
            />
          ))}
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
            <div key={snapshot.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.06)]">
              <div className="md:hidden">
                <RepHeader
                  snapshot={snapshot}
                  canEdit={canEdit}
                  commissionableEmployees={commissionableEmployees}
                  onUpdate={(updates) => updateRow(snapshot, updates)}
                  onRemove={() => removeSnapshot(snapshot.id)}
                  compact
                />

                <div className="mt-2 grid grid-cols-1 gap-2">
                  <CommissionCell snapshot={snapshot} canEdit={canEdit} onUpdateNumber={updateNumber} />
                  {BOARD_METRICS.map((metric) => (
                    <MetricCell
                      key={metric.key}
                      snapshot={snapshot}
                      metric={metric}
                      canEdit={canEdit}
                      onUpdateNumber={updateNumber}
                    />
                  ))}
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <div className="grid min-w-[1160px] grid-cols-[236px_172px_repeat(5,minmax(144px,1fr))] gap-2">
                  <div className="sticky left-0 z-10">
                    <RepHeader
                      snapshot={snapshot}
                      canEdit={canEdit}
                      commissionableEmployees={commissionableEmployees}
                      onUpdate={(updates) => updateRow(snapshot, updates)}
                      onRemove={() => removeSnapshot(snapshot.id)}
                    />
                  </div>

                  <CommissionCell snapshot={snapshot} canEdit={canEdit} onUpdateNumber={updateNumber} />

                  {BOARD_METRICS.map((metric) => (
                    <MetricCell
                      key={metric.key}
                      snapshot={snapshot}
                      metric={metric}
                      canEdit={canEdit}
                      onUpdateNumber={updateNumber}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-solid)]/80 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                  <StickyNote size={12} />
                  Notes
                </div>
                {canEdit ? (
                  <Textarea
                    key={`${snapshot.id}-notes-${snapshot.updatedAt}`}
                    aria-label={`${snapshot.employeeName || 'Rep'} notes`}
                    defaultValue={snapshot.notes}
                    rows={2}
                    onBlur={(event) => updateRow(snapshot, { notes: event.target.value })}
                    placeholder="Add coaching context, promo notes, traffic, or follow-up..."
                    className="min-h-[58px]"
                  />
                ) : (
                  <div className="min-h-[38px] whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                    {snapshot.notes || 'No notes.'}
                  </div>
                )}
              </div>
            </div>
          ))}

          {visibleSnapshots.length === 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-16 text-center">
              <CalendarDays size={36} className="mx-auto text-[var(--text-tertiary)]" />
              <div className="mt-3 text-sm font-semibold text-[var(--text)]">No commission snapshot for this date</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {canEdit ? 'Add one rep or create rows for the full team.' : 'Check back after Admin or District Manager enters the board.'}
              </div>
              {canEdit && commissionableEmployees.length > 0 && (
                <div className="mt-4 flex justify-center gap-2">
                  <Button variant="accent" icon={<Target size={15} />} onClick={openGoalModal}>
                    Store Goals
                  </Button>
                  <Button variant="secondary" icon={<Users size={15} />} onClick={addMissingRows}>
                    Add Team
                  </Button>
                  <Button variant="primary" icon={<Plus size={15} />} onClick={addRow}>
                    Add Row
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} title="Store Commission Goals" size="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            These goals apply to this store's new rows and update existing rows only when that rep goal is blank or still matches the previous store default.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BOARD_METRICS.map((metric) => (
              <Input
                key={metric.goalKey}
                label={`${metric.label} Goal`}
                inputMode="decimal"
                value={goalDraft[metric.goalKey] || ''}
                onChange={(event) => setGoalDraft((draft) => ({
                  ...draft,
                  [metric.goalKey]: parseMetric(event.target.value),
                }))}
                className="tabular-nums"
                placeholder={metric.money ? '$0' : '0'}
              />
            ))}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            Rep-specific edited goals are preserved. To make a rep follow the store default again, clear that rep's goal back to 0 before saving store goals.
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setGoalModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={<Target size={15} />} onClick={saveStoreGoals}>
              Save Goals
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
