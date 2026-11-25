import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  Clock,
  EyeOff,
  RadioTower,
  RotateCcw,
  Settings2,
  Trophy,
  Users,
  Wifi,
} from 'lucide-react'
import { Card } from '../../ui/Card'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { PageFrame } from '../../ui/ModulePrimitives'
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

function SectionPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: ReactNode
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card noPadding>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text)] tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  )
}

function KpiTile({
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
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left shadow-[var(--shadow-card)] transition-colors',
        onClick && 'hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]/50 cursor-pointer'
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </span>
      <span
        className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-[var(--text)]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      <span className="mt-1 text-xs text-[var(--text-secondary)] truncate">{meta}</span>
    </Tag>
  )
}

function PulseMetric({
  label,
  value,
  percent,
  helper,
}: {
  label: string
  value: string
  percent: number
  helper: string
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <Badge tone={metricStatusTone(percent)} size="xs">
          {formatPercent(percent)}
        </Badge>
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums text-[var(--text)] tracking-tight">
        {value}
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(Math.max(percent, 0), 100)}%`,
            background: metricBarColor(percent),
          }}
        />
      </div>
      <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">{helper}</div>
    </div>
  )
}

function StorePulse({ row }: { row: PerformanceRow | null }) {
  if (!row) {
    return (
      <SectionPanel title="Performance Pulse" subtitle="Live store metrics">
        <div className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
          Live performance data is not mapped for this store yet.
        </div>
      </SectionPanel>
    )
  }

  const overall = (row.netRevenuePct + row.accessoryPct + row.ppPct) / 3
  const weakest = [
    { label: 'Net Revenue', value: row.netRevenuePct },
    { label: 'Accessories', value: row.accessoryPct },
    { label: 'PP Volume', value: row.ppPct },
  ].sort((a, b) => a.value - b.value)[0]

  return (
    <SectionPanel
      title="Performance Pulse"
      subtitle="Live store metrics vs. quota"
      action={
        <Badge tone={metricStatusTone(overall)} size="sm" dot>
          {formatPercent(overall)} Pace
        </Badge>
      }
    >
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <PulseMetric
          label="Net Revenue"
          value={formatMoney(row.netRevenue)}
          percent={row.netRevenuePct}
          helper={row.netRevenue >= row.netRevenueGoal ? 'Quota reached' : `${formatMoney(row.netRevenueGoal - row.netRevenue)} to quota`}
        />
        <PulseMetric
          label="Accessories"
          value={formatMoney(row.accessoryRevenue)}
          percent={row.accessoryPct}
          helper={row.accessoryRevenue >= row.accessoryGoal ? 'Quota reached' : `${formatMoney(row.accessoryGoal - row.accessoryRevenue)} to quota`}
        />
        <PulseMetric
          label="Total PP Units"
          value={formatNumber(row.totalPp)}
          percent={row.ppPct}
          helper={row.totalPp >= row.dortGoal ? 'Quota reached' : `${formatNumber(row.dortGoal - row.totalPp)} to quota`}
        />
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-2.5 text-xs text-[var(--text-secondary)]">
        Primary focus: <strong className="text-[var(--text)]">{weakest.label}</strong> at {formatPercent(weakest.value)} pace.
      </div>
    </SectionPanel>
  )
}

function ActionRow({
  icon,
  label,
  detail,
  toneColor,
  onClick,
}: {
  icon: ReactNode
  label: string
  detail: string
  toneColor: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface)] border border-[var(--border)]"
        style={{ color: toneColor }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--text)]">{label}</span>
        <span className="block truncate text-xs text-[var(--text-secondary)]">{detail}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
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
    month: 'short',
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
    <PageFrame width="wide" className="space-y-5 pb-10">
      {/* Compact Page Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <span>{dateLabel}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5 text-[var(--status-good-text)] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-good)]" />
              Live
            </span>
          </div>
          <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] truncate">
            {isMain ? 'District Operations' : storeProfile?.location || `Store ${storeId}`}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant={customizing ? 'accent' : 'secondary'}
            icon={<Settings2 size={14} />}
            onClick={() => setCustomizing((v) => !v)}
          >
            Customize
          </Button>
          {customizing && (
            <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={resetSections}>
              Reset
            </Button>
          )}
        </div>
      </header>

      {/* Section Visibility Customizer */}
      {customizing && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Visible Sections
          </div>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
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
                      ? 'border-[var(--accent)]/40 bg-[var(--accent-light)] text-[var(--text)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
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

      {/* Top KPI Strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Floor Staff"
          value={String(todayShifts.length)}
          meta={todayShifts.length === 1 ? '1 shift scheduled' : `${todayShifts.length} shifts today`}
          onClick={() => setTab('schedule')}
        />
        <KpiTile
          label="Checklist"
          value={hasTasks ? `${taskPct}%` : '—'}
          meta={hasTasks ? `${doneTasks} of ${tasks.length} complete` : 'No tasks loaded'}
          accent={hasTasks && taskPct === 100 ? 'var(--status-good-text)' : undefined}
          onClick={() => setTab('tasks')}
        />
        <KpiTile
          label="Appointments"
          value={String(appointmentRows)}
          meta={appointmentsQuery.isError ? 'Check tracker setup' : 'Booked in pipeline'}
          onClick={() => setTab('appointments')}
        />
        <KpiTile
          label="Composite Pace"
          value={overallPace !== null ? formatPercent(overallPace) : '—'}
          meta={performanceRow ? `${formatMoney(performanceRow.netRevenue)} net rev` : 'Awaiting feed'}
          accent={overallPace !== null ? metricBarColor(overallPace) : undefined}
          onClick={() => setTab('district')}
        />
      </section>

      {/* Main Two-Column Grid */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,1fr)]">
        {/* Left Primary Column */}
        <div className="space-y-5 min-w-0">
          {sectionPrefs.brief && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-card)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Daily Brief
                  </span>
                  {brief.focusLabel && <Badge tone="accent" size="xs">{brief.focusLabel}</Badge>}
                </div>
                <p className="mt-1 text-sm font-medium text-[var(--text)] leading-snug">
                  {brief.headline}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setTab('district')} icon={<BarChart3 size={14} />} className="shrink-0">
                District Board
              </Button>
            </div>
          )}

          {sectionPrefs.pulse && <StorePulse row={performanceRow} />}

          {sectionPrefs.attention && (
            <SectionPanel title="Action Priorities" subtitle="Focus items for the current shift">
              <div className="space-y-2 p-4">
                <ActionRow
                  icon={<CheckSquare size={16} />}
                  label={tasks.length ? `${tasks.length - doneTasks} checklist item${tasks.length - doneTasks === 1 ? '' : 's'} remaining` : 'Build floor checklist'}
                  detail={tasks.length ? `${doneTasks} of ${tasks.length} completed today` : 'Set up opening and closing duties'}
                  toneColor={taskPct === 100 ? 'var(--status-good)' : 'var(--status-warn)'}
                  onClick={() => setTab('tasks')}
                />
                <ActionRow
                  icon={<Users size={16} />}
                  label={todayShifts.length ? `${todayShifts.length} team member${todayShifts.length === 1 ? '' : 's'} on schedule` : 'No shifts scheduled today'}
                  detail={todayShifts.slice(0, 3).map((s) => s.employee.name).join(', ') || 'Review schedule coverage'}
                  toneColor="var(--accent)"
                  onClick={() => setTab('schedule')}
                />
                <ActionRow
                  icon={<CalendarPlus size={16} />}
                  label={appointmentsQuery.isError ? 'Review appointment tracker' : `${appointmentRows} customer appointment${appointmentRows === 1 ? '' : 's'} active`}
                  detail={appointmentsQuery.isLoading ? 'Checking tracker…' : appointmentsQuery.isError ? 'Inspect store sheet mapping' : 'Manage scheduled visits and follow-ups'}
                  toneColor={appointmentsQuery.isError ? 'var(--status-danger)' : '#E20074'}
                  onClick={() => setTab('appointments')}
                />
              </div>
            </SectionPanel>
          )}
        </div>

        {/* Right Secondary Column */}
        <aside className="space-y-5 min-w-0">
          {sectionPrefs.wins && (
            <SectionPanel
              title={
                <span className="inline-flex items-center gap-1.5">
                  <Trophy size={14} className="text-[var(--status-warn-text)]" />
                  District Wins
                </span>
              }
              subtitle="Top categories from latest update"
              action={<Button size="xs" variant="ghost" onClick={() => setTab('district')}>Board</Button>}
            >
              <div className="space-y-1.5 p-3">
                {wins.length === 0 ? (
                  <div className="py-5 text-center text-xs text-[var(--text-tertiary)]">
                    No activity recorded yet.
                  </div>
                ) : wins.map((win) => (
                  <button
                    key={win.id}
                    type="button"
                    onClick={() => setTab('district')}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: win.tone }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--text)]">{win.label}</span>
                      <span className="block truncate text-[11px] text-[var(--text-secondary)]">{win.detail}</span>
                    </span>
                    <ArrowRight size={13} className="text-[var(--text-tertiary)] shrink-0" />
                  </button>
                ))}
              </div>
            </SectionPanel>
          )}

          {sectionPrefs.coverage && (
            <SectionPanel
              title="Floor Coverage"
              subtitle={`${todayShifts.length} scheduled shift${todayShifts.length === 1 ? '' : 's'}`}
              action={<Button size="xs" variant="ghost" onClick={() => setTab('schedule')} icon={<Calendar size={12} />}>Schedule</Button>}
            >
              <div className="max-h-72 space-y-1.5 overflow-y-auto p-3">
                {todayShifts.length === 0 ? (
                  <div className="py-5 text-center text-xs text-[var(--text-secondary)]">
                    No shifts scheduled for today.
                  </div>
                ) : todayShifts.map((shift) => (
                  <div key={shift.id} className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: shift.employee.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[var(--text)]">{shift.employee.name}</div>
                      <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] mt-0.5 tabular-nums">
                        <Clock size={11} className="text-[var(--text-tertiary)]" />
                        <span>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</span>
                      </div>
                    </div>
                    <Badge size="xs" tone="neutral">{shift.type || 'Shift'}</Badge>
                  </div>
                ))}
              </div>
            </SectionPanel>
          )}

          {sectionPrefs.checklist && (
            <SectionPanel title="Checklist Status" subtitle="Daily store compliance">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-[var(--text)]">
                      {hasTasks ? `${taskPct}%` : 'No Tasks'}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {hasTasks ? `${doneTasks} of ${tasks.length} verified` : 'No active checklist loaded'}
                    </div>
                  </div>
                  <CheckCircle2
                    size={28}
                    className={hasTasks && taskPct === 100 ? 'text-[var(--status-good)]' : 'text-[var(--text-tertiary)]'}
                  />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: hasTasks ? `${taskPct}%` : '0%' }}
                  />
                </div>
                <Button size="sm" variant="secondary" className="mt-3.5 w-full" onClick={() => setTab('tasks')} icon={<CheckSquare size={14} />}>
                  Open Checklist
                </Button>
              </div>
            </SectionPanel>
          )}

          {sectionPrefs.announcements && (
            <SectionPanel
              title="Store Announcements"
              subtitle={`${activeAnnouncements.length} active`}
              action={<Button size="xs" variant="ghost" onClick={() => setTab('settings')}>Manage</Button>}
            >
              <div className="space-y-1.5 p-3">
                {activeAnnouncements.length === 0 ? (
                  <div className="flex flex-col items-center py-5 text-center text-xs text-[var(--text-tertiary)]">
                    <RadioTower size={16} className="mb-1.5" />
                    No active announcements.
                  </div>
                ) : activeAnnouncements.slice(0, 3).map((announcement) => (
                  <div key={announcement.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                    <div className="text-xs font-medium text-[var(--text)] leading-relaxed">{announcement.text}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {announcement.priority}
                    </div>
                  </div>
                ))}
              </div>
            </SectionPanel>
          )}

          {sectionPrefs.connectivity && (
            <SectionPanel
              title={
                <span className="inline-flex items-center gap-1.5">
                  <Wifi size={14} className="text-[var(--accent)]" />
                  Connectivity
                </span>
              }
              action={
                <Badge tone={syncProblems.length || performanceQuery.isError ? 'danger' : 'success'} size="xs" dot>
                  {syncProblems.length || performanceQuery.isError ? 'Check' : 'Synced'}
                </Badge>
              }
            >
              <div className="divide-y divide-[var(--border)] px-4">
                <div className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <div className="font-medium text-[var(--text)]">Performance Feed</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                      {performanceQuery.isError ? 'Unavailable' : performanceQuery.data ? 'Connected' : 'Loading…'}
                    </div>
                  </div>
                  <Badge tone={performanceQuery.isError ? 'danger' : 'success'} size="xs">
                    {performanceQuery.isError ? 'Issue' : 'Live'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <div className="font-medium text-[var(--text)]">Supabase Sync</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                      Updated {formatUpdatedAt(supabaseUpdatedAt)}
                    </div>
                  </div>
                  <Badge tone={syncProblems.length ? 'danger' : savingAreas.length ? 'warning' : 'success'} size="xs">
                    {syncProblems.length ? 'Issue' : savingAreas.length ? 'Syncing' : 'Live'}
                  </Badge>
                </div>
              </div>
            </SectionPanel>
          )}
        </aside>
      </div>
    </PageFrame>
  )
}
