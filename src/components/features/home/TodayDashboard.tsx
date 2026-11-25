import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  Clock,
  EyeOff,
  RadioTower,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  Users,
  Wifi,
} from 'lucide-react'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { useUiStore } from '../../../store/uiStore'
import { isAnnouncementActive, useDisplayStore } from '../../../store/displayStore'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useTasksStore } from '../../../store/tasksStore'
import { useSyncStore } from '../../../store/syncStore'
import { formatMoney, formatNumber, formatPercent, type PerformanceData, type PerformanceRow } from '../../../lib/performanceSheet'
import { districtWins, smartDailyBrief } from '../../../lib/districtInsights'
import { appointmentFilledRows, fetchAppointmentTrackerData } from '../../../lib/appointments'
import { normalizeStoreId } from '../../../lib/storeIds'
import { fetchDashboardPerformanceData } from '../../../lib/dashboardSales'
import { getStoreProfile } from '../../../config/storeProfiles'
import { cn } from '../../../lib/utils'

const todayKey = () => {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const DASHBOARD_PREFS_KEY = 'luna-today-dashboard-sections'
const DASHBOARD_SECTIONS = [
  { id: 'brief', label: 'Daily Brief' },
  { id: 'pulse', label: 'Performance Pulse' },
  { id: 'attention', label: 'Priorities' },
  { id: 'wins', label: 'District Wins' },
  { id: 'coverage', label: 'Floor Coverage' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'connectivity', label: 'Connectivity' },
] as const

type DashboardSectionId = typeof DASHBOARD_SECTIONS[number]['id']
type DashboardSectionPrefs = Record<DashboardSectionId, boolean>

const DEFAULT_DASHBOARD_PREFS = DASHBOARD_SECTIONS.reduce((prefs, section) => {
  prefs[section.id] = true
  return prefs
}, {} as DashboardSectionPrefs)

function loadDashboardPrefs(): DashboardSectionPrefs {
  try {
    const raw = window.localStorage.getItem(DASHBOARD_PREFS_KEY)
    if (!raw) return { ...DEFAULT_DASHBOARD_PREFS }
    return { ...DEFAULT_DASHBOARD_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_DASHBOARD_PREFS }
  }
}

function normalizeStoreCode(value: string) {
  return value.replace(/\D/g, '').trim()
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  return new Date(2020, 0, 1, hours, minutes).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function metricStatusTone(percent: number): 'success' | 'warning' | 'danger' {
  if (percent >= 100) return 'success'
  if (percent >= 80) return 'warning'
  return 'danger'
}

function metricBarColor(percent: number): string {
  if (percent >= 100) return 'var(--status-good)'
  if (percent >= 80) return 'var(--status-warn)'
  return 'var(--status-danger)'
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return 'Not updated yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not updated yet'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function latestUpdatedAt(values: Array<string | null>) {
  return values.reduce<string | null>((latest, value) => {
    if (!value) return latest
    if (!latest) return value
    return new Date(value).getTime() > new Date(latest).getTime() ? value : latest
  }, null)
}

function selectedPerformanceRow(data: PerformanceData | undefined, identifiers: string[], isMain: boolean) {
  if (!data) return null
  if (isMain) return data.total
  const candidates = new Set(identifiers.map(normalizeStoreCode).filter(Boolean))
  return data.rows.find((row) => candidates.has(normalizeStoreCode(row.storeCode))) ?? null
}

function LedgerCell({
  label,
  value,
  meta,
  accent,
  onClick,
}: {
  label: string
  value: string
  meta: string
  accent?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col justify-between bg-[var(--surface)] px-5 py-4 text-left transition-colors hover:bg-[var(--surface-2)]/60"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {label}
        </span>
        <ArrowUpRight size={13} className="text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div
        className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums tracking-[-0.03em] text-[var(--text)]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-[var(--text-secondary)] truncate">{meta}</div>
    </button>
  )
}

function PulseRow({
  label,
  value,
  goal,
  percent,
  remaining,
}: {
  label: string
  value: string
  goal: string
  percent: number
  remaining: string
}) {
  return (
    <div className="py-4 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-sm font-semibold text-[var(--text)]">{label}</span>
          <span className="text-xs text-[var(--text-tertiary)] tabular-nums">Goal {goal}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-base font-bold tabular-nums text-[var(--text)]">{value}</span>
          <Badge tone={metricStatusTone(percent)} size="xs">
            {formatPercent(percent)}
          </Badge>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(Math.max(percent, 0), 100)}%`,
            background: metricBarColor(percent),
          }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">{remaining}</div>
    </div>
  )
}

function StorePulse({ row }: { row: PerformanceRow | null }) {
  if (!row) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Performance</div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Live performance data is not mapped for this store yet.</p>
      </section>
    )
  }

  const overall = (row.netRevenuePct + row.accessoryPct + row.ppPct) / 3
  const weakest = [
    { label: 'Net Revenue', value: row.netRevenuePct },
    { label: 'Accessories', value: row.accessoryPct },
    { label: 'PP Volume', value: row.ppPct },
  ].sort((a, b) => a.value - b.value)[0]

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)] tracking-tight">Performance Pulse</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Actuals reconciled against store quota</p>
        </div>
        <Badge tone={metricStatusTone(overall)} size="sm" dot>
          {formatPercent(overall)} Pace
        </Badge>
      </div>

      <div className="divide-y divide-[var(--border)] px-5 py-2">
        <PulseRow
          label="Net Revenue"
          value={formatMoney(row.netRevenue)}
          goal={formatMoney(row.netRevenueGoal)}
          percent={row.netRevenuePct}
          remaining={row.netRevenue >= row.netRevenueGoal ? 'Quota reached' : `${formatMoney(row.netRevenueGoal - row.netRevenue)} remaining to quota`}
        />
        <PulseRow
          label="Accessories"
          value={formatMoney(row.accessoryRevenue)}
          goal={formatMoney(row.accessoryGoal)}
          percent={row.accessoryPct}
          remaining={row.accessoryRevenue >= row.accessoryGoal ? 'Quota reached' : `${formatMoney(row.accessoryGoal - row.accessoryRevenue)} remaining to quota`}
        />
        <PulseRow
          label="Total PP Units"
          value={formatNumber(row.totalPp)}
          goal={formatNumber(row.dortGoal)}
          percent={row.ppPct}
          remaining={row.totalPp >= row.dortGoal ? 'Quota reached' : `${formatNumber(row.dortGoal - row.totalPp)} units remaining to quota`}
        />
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-5 py-2.5 text-xs text-[var(--text-secondary)]">
        Primary focus: <strong className="text-[var(--text)]">{weakest.label}</strong> ({formatPercent(weakest.value)} pace)
      </div>
    </section>
  )
}

function PriorityRow({
  icon,
  label,
  detail,
  badge,
  onClick,
}: {
  icon: ReactNode
  label: string
  detail: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)]/60"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--text)]">{label}</span>
        <span className="block truncate text-xs text-[var(--text-secondary)]">{detail}</span>
      </span>
      {badge && (
        <span className="hidden sm:inline-flex text-xs font-mono font-medium text-[var(--text-tertiary)]">
          {badge}
        </span>
      )}
      <ArrowUpRight size={15} className="shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--text)]" />
    </button>
  )
}

export function TodayDashboard() {
  const { dealerCode, setTab, storeId } = useUiStore()
  const { storeNumber, announcements } = useDisplayStore()
  const { employees, shifts } = useScheduleStore()
  const { tasks } = useTasksStore()
  const syncEntries = useSyncStore((s) => s.entries)
  const [customizing, setCustomizing] = useState(false)
  const [sectionPrefs, setSectionPrefs] = useState<DashboardSectionPrefs>(() => loadDashboardPrefs())

  const today = todayKey()
  const isMain = normalizeStoreId(storeId) === 'main'
  const storeProfile = getStoreProfile(storeId)
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const performanceQuery = useQuery({
    queryKey: ['dashboard-performance', storeId, dealerCode],
    queryFn: fetchDashboardPerformanceData,
    staleTime: 60_000,
  })

  const appointmentsQuery = useQuery({
    queryKey: ['today-appointments', dealerCode],
    queryFn: () => fetchAppointmentTrackerData(dealerCode),
    enabled: Boolean(dealerCode) && !isMain,
    staleTime: 5 * 60_000,
  })

  const performanceRow = useMemo(() => (
    selectedPerformanceRow(performanceQuery.data, [dealerCode, storeNumber, storeId], isMain)
  ), [dealerCode, isMain, performanceQuery.data, storeId, storeNumber])

  const activeAnnouncements = useMemo(() => (
    announcements.filter((announcement) => isAnnouncementActive(announcement))
  ), [announcements])

  const todayShifts = useMemo(() => {
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]))
    return shifts
      .filter((shift) => shift.date === today)
      .filter((shift) => employeesById.has(shift.employeeId))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((shift) => ({
        ...shift,
        employee: employeesById.get(shift.employeeId)!,
      }))
  }, [employees, shifts, today])

  const doneTasks = tasks.filter((task) => task.completedDate === today).length
  const taskPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0
  const hasTasks = tasks.length > 0
  const appointmentRows = appointmentFilledRows(appointmentsQuery.data ?? null, 'Week 1').length

  const brief = smartDailyBrief({
    data: performanceQuery.data,
    row: performanceRow,
    identifiers: [dealerCode, storeNumber, storeId],
    shiftCount: todayShifts.length,
    openTaskCount: Math.max(tasks.length - doneTasks, 0),
    appointmentRows,
  })
  const wins = districtWins(performanceQuery.data)
  const syncProblems = Object.entries(syncEntries).filter(([, entry]) => entry.state === 'error')
  const savingAreas = Object.entries(syncEntries).filter(([, entry]) => entry.state === 'saving')
  const supabaseUpdatedAt = latestUpdatedAt(Object.values(syncEntries).map((entry) => entry.updatedAt))

  const overallPace = performanceRow
    ? (performanceRow.netRevenuePct + performanceRow.accessoryPct + performanceRow.ppPct) / 3
    : null

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(sectionPrefs))
  }, [sectionPrefs])

  const toggleSection = (sectionId: DashboardSectionId) => {
    setSectionPrefs((current) => ({ ...current, [sectionId]: !current[sectionId] }))
  }

  const resetSections = () => setSectionPrefs({ ...DEFAULT_DASHBOARD_PREFS })

  return (
    <div className="min-h-full pb-12">
      {/* Open Swiss Editorial Header Band */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                <span>{dateLabel}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5 text-[var(--status-good-text)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-good)]" />
                  Live
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-[var(--text)] truncate">
                {isMain ? 'District Operations' : storeProfile?.location || `Store ${storeId}`}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant={customizing ? 'primary' : 'secondary'}
                icon={<SlidersHorizontal size={13} />}
                onClick={() => setCustomizing((v) => !v)}
              >
                Layout
              </Button>
              {customizing && (
                <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={resetSections}>
                  Reset
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={() => setTab('district')} icon={<ArrowUpRight size={14} />}>
                District Board
              </Button>
            </div>
          </div>

          {sectionPrefs.brief && (
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-2 border-[var(--text)] pl-3.5 py-0.5">
              <p className="text-sm text-[var(--text)] leading-snug">
                <span className="font-semibold mr-2">Brief:</span>
                <span className="text-[var(--text-secondary)]">{brief.headline}</span>
              </p>
              {brief.focusLabel && (
                <Badge tone="neutral" size="xs" className="self-start sm:self-auto shrink-0">
                  {brief.focusLabel}
                </Badge>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 space-y-6">
        {/* Section Customizer */}
        {customizing && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Toggle Dashboard Modules
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DASHBOARD_SECTIONS.map((section) => {
                const enabled = sectionPrefs[section.id]
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                      enabled
                        ? 'border-[var(--text)] bg-[var(--surface-2)] text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)]'
                    )}
                  >
                    <span className="truncate">{section.label}</span>
                    {!enabled && <EyeOff size={13} className="shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Unified Swiss KPI Ledger Strip */}
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] grid grid-cols-2 gap-px lg:grid-cols-4">
          <LedgerCell
            label="Composite Pace"
            value={overallPace !== null ? formatPercent(overallPace) : '—'}
            meta={performanceRow ? `${formatMoney(performanceRow.netRevenue)} net rev` : 'Awaiting feed'}
            accent={overallPace !== null ? metricBarColor(overallPace) : undefined}
            onClick={() => setTab('district')}
          />
          <LedgerCell
            label="Floor Staff"
            value={String(todayShifts.length)}
            meta={todayShifts.length === 1 ? '1 shift scheduled' : `${todayShifts.length} shifts today`}
            onClick={() => setTab('schedule')}
          />
          <LedgerCell
            label="Checklist"
            value={hasTasks ? `${taskPct}%` : '—'}
            meta={hasTasks ? `${doneTasks} of ${tasks.length} verified` : 'No tasks loaded'}
            accent={hasTasks && taskPct === 100 ? 'var(--status-good-text)' : undefined}
            onClick={() => setTab('tasks')}
          />
          <LedgerCell
            label="Appointments"
            value={String(appointmentRows)}
            meta={appointmentsQuery.isError ? 'Check tracker setup' : 'Booked in pipeline'}
            onClick={() => setTab('appointments')}
          />
        </section>

        {/* Main Asymmetric Operations Grid */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,1fr)]">
          {/* Primary Column */}
          <div className="space-y-6 min-w-0">
            {sectionPrefs.pulse && <StorePulse row={performanceRow} />}

            {sectionPrefs.attention && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="border-b border-[var(--border)] px-5 py-3.5">
                  <h2 className="text-sm font-semibold text-[var(--text)] tracking-tight">Shift Priorities</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Operational items requiring attention today</p>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  <PriorityRow
                    icon={<CheckSquare size={15} />}
                    label={tasks.length ? `${tasks.length - doneTasks} checklist item${tasks.length - doneTasks === 1 ? '' : 's'} remaining` : 'Build floor checklist'}
                    detail={tasks.length ? `${doneTasks} of ${tasks.length} completed today` : 'Set up opening and closing duties'}
                    badge={hasTasks ? `${taskPct}%` : undefined}
                    onClick={() => setTab('tasks')}
                  />
                  <PriorityRow
                    icon={<Users size={15} />}
                    label={todayShifts.length ? `${todayShifts.length} team member${todayShifts.length === 1 ? '' : 's'} scheduled` : 'No shifts scheduled today'}
                    detail={todayShifts.slice(0, 3).map((s) => s.employee.name).join(', ') || 'Review schedule coverage'}
                    badge={`${todayShifts.length} on`}
                    onClick={() => setTab('schedule')}
                  />
                  <PriorityRow
                    icon={<CalendarPlus size={15} />}
                    label={appointmentsQuery.isError ? 'Review appointment tracker' : `${appointmentRows} customer appointment${appointmentRows === 1 ? '' : 's'} active`}
                    detail={appointmentsQuery.isLoading ? 'Checking tracker…' : appointmentsQuery.isError ? 'Inspect store sheet mapping' : 'Manage scheduled visits and follow-ups'}
                    badge={`${appointmentRows}`}
                    onClick={() => setTab('appointments')}
                  />
                </div>
              </section>
            )}
          </div>

          {/* Secondary Column */}
          <aside className="space-y-6 min-w-0">
            {sectionPrefs.coverage && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text)]">Floor Coverage</h2>
                    <p className="text-xs text-[var(--text-tertiary)]">{todayShifts.length} shift{todayShifts.length === 1 ? '' : 's'} today</p>
                  </div>
                  <Button size="xs" variant="ghost" onClick={() => setTab('schedule')} icon={<Calendar size={12} />}>
                    Schedule
                  </Button>
                </div>
                <div className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto">
                  {todayShifts.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[var(--text-tertiary)]">
                      No shifts scheduled for today.
                    </div>
                  ) : todayShifts.map((shift) => (
                    <div key={shift.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: shift.employee.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-[var(--text)]">{shift.employee.name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] tabular-nums">
                          <Clock size={11} className="text-[var(--text-tertiary)]" />
                          <span>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</span>
                        </div>
                      </div>
                      <Badge size="xs" tone="neutral">{shift.type || 'Shift'}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {sectionPrefs.wins && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
                    <Trophy size={14} className="text-[var(--text-secondary)]" />
                    District Wins
                  </h2>
                  <Button size="xs" variant="ghost" onClick={() => setTab('district')}>Board</Button>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {wins.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[var(--text-tertiary)]">No activity recorded yet.</div>
                  ) : wins.map((win) => (
                    <button
                      key={win.id}
                      type="button"
                      onClick={() => setTab('district')}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]/60"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: win.tone }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-[var(--text)]">{win.label}</span>
                        <span className="block truncate text-[11px] text-[var(--text-secondary)]">{win.detail}</span>
                      </span>
                      <ArrowUpRight size={13} className="text-[var(--text-tertiary)] shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {sectionPrefs.checklist && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Checklist</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">
                      {hasTasks ? `${taskPct}%` : 'No Tasks'}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {hasTasks ? `${doneTasks} of ${tasks.length} verified` : 'No checklist loaded'}
                    </div>
                  </div>
                  <CheckCircle2
                    size={26}
                    className={hasTasks && taskPct === 100 ? 'text-[var(--status-good)]' : 'text-[var(--border-strong)]'}
                  />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-[var(--text)] transition-all duration-300"
                    style={{ width: hasTasks ? `${taskPct}%` : '0%' }}
                  />
                </div>
                <Button size="sm" variant="secondary" className="mt-3.5 w-full" onClick={() => setTab('tasks')}>
                  Open Checklist
                </Button>
              </section>
            )}

            {sectionPrefs.announcements && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <h2 className="text-sm font-semibold text-[var(--text)]">Announcements</h2>
                  <Button size="xs" variant="ghost" onClick={() => setTab('settings')}>Manage</Button>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {activeAnnouncements.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-5 text-xs text-[var(--text-tertiary)]">
                      <RadioTower size={14} />
                      No active announcements.
                    </div>
                  ) : activeAnnouncements.slice(0, 3).map((announcement) => (
                    <div key={announcement.id} className="px-4 py-3">
                      <div className="text-xs font-medium text-[var(--text)] leading-relaxed">{announcement.text}</div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        {announcement.priority}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {sectionPrefs.connectivity && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
                    <Wifi size={13} className="text-[var(--text-secondary)]" />
                    System Status
                  </h2>
                  <Badge tone={syncProblems.length || performanceQuery.isError ? 'danger' : 'success'} size="xs" dot>
                    {syncProblems.length || performanceQuery.isError ? 'Check' : 'Operational'}
                  </Badge>
                </div>
                <div className="divide-y divide-[var(--border)] px-4">
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-[var(--text-secondary)]">Performance Feed</span>
                    <span className="font-medium text-[var(--text)]">
                      {performanceQuery.isError ? 'Unavailable' : performanceQuery.data ? 'Live' : 'Connecting…'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-[var(--text-secondary)]">Supabase Sync</span>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {syncProblems.length ? 'Error' : savingAreas.length ? 'Syncing…' : formatUpdatedAt(supabaseUpdatedAt)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
