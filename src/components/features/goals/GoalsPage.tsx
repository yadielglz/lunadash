import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, BarChart3, CalendarDays, DollarSign, Package, Smartphone, Target, TrendingUp, Users } from 'lucide-react'
import { Card } from '../../ui/Card'
import { Badge } from '../../ui/Badge'
import { useDisplayStore } from '../../../store/displayStore'
import { useGoalsStore, type Goal } from '../../../store/goalsStore'
import { useUiStore } from '../../../store/uiStore'
import { fetchPerformanceData, type PerformanceData, type PerformanceRow } from '../../../lib/performanceSheet'

const SNAPSHOT_CATEGORY = 'Performance Snapshot'
const SNAPSHOT_PREFIX = 'source-snapshot:'
const dateKey = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')
const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
const todayKey = () => dateKey()

type SnapshotKind = 'money' | 'number' | 'percent'
type SnapshotMetric = {
  key: string
  label: string
  value: number
  goal: number
  kind: SnapshotKind
  color: string
  icon: React.ReactNode
}

function normalizeStoreCode(value: string) {
  return value.replace(/\D/g, '').trim()
}

function sourceRowForSelectedStore(data: PerformanceData | undefined, identifiers: string[], useTotal: boolean) {
  if (!data) return null
  if (useTotal) return data.total

  const candidates = new Set(
    identifiers
      .map(normalizeStoreCode)
      .filter(Boolean)
  )
  if (candidates.size === 0) return null

  return data.rows.find((row) => candidates.has(normalizeStoreCode(row.storeCode))) ?? null
}

function snapshotDescription(key: string) {
  return `${SNAPSHOT_PREFIX}${key}`
}

function snapshotGoalForMetric(goals: Goal[], key: string) {
  return goals.find((goal) => goal.category === SNAPSHOT_CATEGORY && goal.description === snapshotDescription(key))
}

function mtdFromDailyLog(log: Record<string, number>, key: string, excludeToday = false) {
  const month = key.slice(0, 7)
  return Object.entries(log).reduce((sum, [day, value]) => {
    if (!day.startsWith(month)) return sum
    if (excludeToday && day === key) return sum
    return sum + (Number(value) || 0)
  }, 0)
}

function formatMetric(value: number, kind: SnapshotKind) {
  const rounded = Math.round(value)
  if (kind === 'money') {
    return rounded.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
  }
  if (kind === 'percent') {
    return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
  }
  return rounded.toLocaleString('en-US')
}

function metricsFromRow(row: PerformanceRow): SnapshotMetric[] {
  return [
    { key: 'netRevenue', label: 'Net Revenue', value: row.netRevenue, goal: row.netRevenueGoal, kind: 'money', color: '#16c60c', icon: <DollarSign size={16} /> },
    { key: 'accessoryRevenue', label: 'Accessories', value: row.accessoryRevenue, goal: row.accessoryGoal, kind: 'money', color: '#00b7c3', icon: <Package size={16} /> },
    { key: 'totalPp', label: 'Total PP', value: row.totalPp, goal: row.dortGoal, kind: 'number', color: '#7c5ff5', icon: <Target size={16} /> },
    { key: 'traffic', label: 'Traffic', value: row.traffic, goal: 0, kind: 'number', color: '#f7b731', icon: <Users size={16} /> },
    { key: 'vl', label: 'Voice Lines', value: row.vl, goal: row.dortGoal * 0.5, kind: 'number', color: '#0f7ad8', icon: <Smartphone size={16} /> },
    { key: 'bts', label: 'BTS', value: row.bts, goal: row.dortGoal * 0.4, kind: 'number', color: '#f7630c', icon: <Activity size={16} /> },
    { key: 'hsi', label: 'HSI', value: row.hsi, goal: row.dortGoal * 0.1, kind: 'number', color: '#e3008c', icon: <TrendingUp size={16} /> },
    { key: 'visa', label: 'VISA', value: row.visa, goal: 0, kind: 'number', color: '#e74856', icon: <BarChart3 size={16} /> },
  ]
}

function SnapshotCard({ metric, goal, today }: { metric: SnapshotMetric; goal?: Goal; today: string }) {
  const log = goal?.dailyLog ?? {}
  const priorMtd = mtdFromDailyLog(log, today, true)
  const savedToday = log[today]
  const liveDelta = Math.max(0, metric.value - priorMtd)
  const todayGoal = Math.max(0, metric.goal)

  const yesterdayKey = dateKey(addDays(new Date(), -1))
  const savedYesterday = log[yesterdayKey]

  let displayValue = 0
  let snapshotState = 'Live Today'

  if (savedToday !== undefined) {
    displayValue = savedToday
    snapshotState = 'Saved Today'
  } else if (liveDelta > 0) {
    displayValue = liveDelta
    snapshotState = 'Live Today'
  } else if (savedYesterday !== undefined) {
    displayValue = savedYesterday
    snapshotState = 'Yesterday'
  } else {
    displayValue = 0
    snapshotState = 'Live Today'
  }
  const goalGap = todayGoal > 0 ? displayValue - todayGoal : null
  const goalGapLabel = goalGap === null
    ? '-'
    : `${goalGap >= 0 ? '+' : '-'}${formatMetric(Math.abs(goalGap), metric.kind)}`

  return (
    <Card className="flex min-h-[218px] flex-col justify-between !p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: `${metric.color}18`, color: metric.color }}>
              {metric.icon}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[var(--text)]">{metric.label}</h2>
              <p className="text-[10px] font-medium uppercase text-[var(--text-tertiary)]">Store-gated Source</p>
            </div>
          </div>
        </div>
        <Badge size="sm" color={metric.color} variant="soft">{snapshotState}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">MTD Since 1st</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{formatMetric(metric.value, metric.kind)}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Today Trend</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{formatMetric(displayValue, metric.kind)}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Today Goal</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{todayGoal > 0 ? formatMetric(todayGoal, metric.kind) : '-'}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Gap</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${goalGap === null ? 'text-[var(--text-tertiary)]' : goalGap >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {goalGapLabel}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function GoalsPage() {
  const { goals, addGoal, updateGoal, isLoaded } = useGoalsStore()
  const { storeId, dealerCode } = useUiStore()
  const { storeNumber } = useDisplayStore()
  const today = todayKey()

  const sourceQuery = useQuery({
    queryKey: ['performance-snapshot-source'],
    queryFn: fetchPerformanceData,
    staleTime: 55_000,
    refetchInterval: 60_000,
  })

  const sourceRow = useMemo(() => (
    sourceRowForSelectedStore(sourceQuery.data, [dealerCode, storeNumber, storeId], storeId === 'main')
  ), [dealerCode, sourceQuery.data, storeId, storeNumber])

  const metrics = useMemo(() => sourceRow ? metricsFromRow(sourceRow) : [], [sourceRow])

  const pastEoDRows = useMemo(() => {
    const allDates = new Set<string>()
    const snapshotGoals = goals.filter((g) => g.category === SNAPSHOT_CATEGORY)
    snapshotGoals.forEach((g) => {
      Object.keys(g.dailyLog ?? {}).forEach((date) => {
        if (date !== today) allDates.add(date)
      })
    })

    const sortedDates = Array.from(allDates).sort().reverse()

    return sortedDates.map((date) => {
      const row: Record<string, any> = { date }
      metrics.forEach((m) => {
        const goal = snapshotGoalForMetric(goals, m.key)
        row[m.key] = goal?.dailyLog?.[date] ?? 0
      })

      const nrGoalObj = snapshotGoalForMetric(goals, 'netRevenue')
      const accGoalObj = snapshotGoalForMetric(goals, 'accessoryRevenue')
      const dortGoalObj = snapshotGoalForMetric(goals, 'totalPp')

      row.nrGoal = nrGoalObj?.dailyTarget
      row.accGoal = accGoalObj?.dailyTarget
      row.dortGoal = dortGoalObj?.dailyTarget
      row.postConversion = row.traffic ? Number(((row.totalPp / row.traffic) * 100).toFixed(1)) : 0

      return row
    })
  }, [goals, metrics, today])

  useEffect(() => {
    if (!isLoaded || metrics.length === 0) return
    metrics.forEach((metric) => {
      const existingGoal = snapshotGoalForMetric(goals, metric.key)
      if (existingGoal) {
        const updates: Partial<Goal> = {}
        if (existingGoal.current !== metric.value) updates.current = metric.value
        if (existingGoal.dailyTarget !== metric.goal) updates.dailyTarget = metric.goal
        if (Object.keys(updates).length > 0) updateGoal(existingGoal.id, updates)
        return
      }
      addGoal({
        title: metric.label,
        description: snapshotDescription(metric.key),
        category: SNAPSHOT_CATEGORY,
        target: 0,
        current: metric.value,
        unit: metric.kind === 'money' ? '$' : metric.kind === 'percent' ? '%' : '',
        deadline: new Date().toISOString(),
        color: metric.color,
        milestones: [],
        dailyTarget: metric.goal,
      })
    })
  }, [addGoal, goals, isLoaded, metrics, updateGoal])

  const sourceUpdated = sourceQuery.data?.updatedAt
    ? new Date(sourceQuery.data.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''
  const storeLabel = sourceRow
    ? storeId === 'main'
      ? 'All Stores'
      : `${sourceRow.teamName || sourceRow.store} #${sourceRow.storeCode}`
    : 'No Source row matched'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--app-bg)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-[var(--accent)]" />
              <h1 className="text-xl font-semibold text-[var(--text)]">Performance Snapshot</h1>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Store-gated Source snapshot with current MTD, today's trend, daily goal, and gap.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <CalendarDays size={14} />
            <span>{new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            <span>·</span>
            <span>{storeLabel}</span>
            {sourceUpdated && (
              <>
                <span>·</span>
                <span>Source {sourceUpdated}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sourceQuery.isLoading && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="shimmer h-[158px] rounded-lg" />
            ))}
          </div>
        )}

        {!sourceQuery.isLoading && !sourceRow && (
          <Card className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
            <BarChart3 size={42} className="text-[var(--text-tertiary)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">No selected-store Source row found</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Check the store number or dealer code for this session.</p>
            </div>
          </Card>
        )}

        {sourceRow && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <SnapshotCard
                key={metric.key}
                metric={metric}
                goal={snapshotGoalForMetric(goals, metric.key)}
                today={today}
              />
            ))}
          </div>
        )}

        {pastEoDRows.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">
              Past End of Day
            </h2>
            <div className="overflow-hidden overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-3)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Net Rev</th>
                    <th className="px-4 py-3 text-right font-medium">NR Goal</th>
                    <th className="px-4 py-3 text-right font-medium">Acc</th>
                    <th className="px-4 py-3 text-right font-medium">Acc Goal</th>
                    <th className="px-4 py-3 text-right font-medium">Total PP</th>
                    <th className="px-4 py-3 text-right font-medium">Traffic</th>
                    <th className="px-4 py-3 text-right font-medium">Post Conv</th>
                    <th className="px-4 py-3 text-right font-medium">DORT Goal</th>
                    <th className="px-4 py-3 text-right font-medium">VL</th>
                    <th className="px-4 py-3 text-right font-medium">BTS</th>
                    <th className="px-4 py-3 text-right font-medium">HSI</th>
                    <th className="px-4 py-3 text-right font-medium">VISA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
                  {pastEoDRows.map((row) => (
                    <tr key={row.date} className="transition-colors hover:bg-[var(--reveal-bg)]">
                      <td className="px-4 py-3 font-medium">{new Date(row.date + 'T12:00:00Z').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(row.netRevenue || 0, 'money')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-tertiary)]">{row.nrGoal ? formatMetric(row.nrGoal, 'money') : '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(row.accessoryRevenue || 0, 'money')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-tertiary)]">{row.accGoal ? formatMetric(row.accGoal, 'money') : '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(row.totalPp || 0, 'number')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(row.traffic || 0, 'number')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-tertiary)]">{row.postConversion ? `${row.postConversion}%` : '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-tertiary)]">{row.dortGoal ? formatMetric(row.dortGoal, 'number') : '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(row.vl || 0, 'number')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(row.bts || 0, 'number')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(row.hsi || 0, 'number')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(row.visa || 0, 'number')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
