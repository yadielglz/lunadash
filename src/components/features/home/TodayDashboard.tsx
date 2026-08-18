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
  RotateCcw,
  Settings2,
  Sparkles,
  Trophy,
  RadioTower,
  Users,
  Wifi,
} from 'lucide-react'
import { Card } from '../../ui/Card'
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
  { id: 'brief', label: 'Smart Brief' },
  { id: 'pulse', label: 'Performance Pulse' },
  { id: 'attention', label: 'Needs Attention' },
  { id: 'wins', label: 'District Wins' },
  { id: 'coverage', label: 'Coverage' },
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

function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode
  title: string
  detail: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-3)] text-[var(--accent)]">{icon}</div>
      <div className="mt-3 text-sm font-semibold text-[var(--text)]">{title}</div>
      <div className="mx-auto mt-1 max-w-xs text-xs text-[var(--text-secondary)]">{detail}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
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

function metricTone(percent: number) {
  if (percent >= 100) return '#1f8a4c'
  if (percent >= 80) return '#c98408'
  return '#c94040'
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

function ConnectivityTile({
  label,
  status,
  detail,
  tone,
}: {
  label: string
  status: string
  detail: string
  tone: string
}) {
  return (
    <div className="rounded-lg border px-3 py-3" style={{ borderColor: `${tone}55`, background: `${tone}16` }}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone, boxShadow: `0 0 0.75rem ${tone}` }} />
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-[var(--text)]">{status}</div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</div>
    </div>
  )
}

function selectedPerformanceRow(data: PerformanceData | undefined, identifiers: string[], isMain: boolean) {
  if (!data) return null
  if (isMain) return data.total

  const candidates = new Set(identifiers.map(normalizeStoreCode).filter(Boolean))
  return data.rows.find((row) => candidates.has(normalizeStoreCode(row.storeCode))) ?? null
}

function HeroMetric({ label, value, percent, helper }: { label: string; value: string; percent?: number; helper: string }) {
  const tone = percent === undefined ? 'var(--accent)' : metricTone(percent)
  const isAhead = percent !== undefined && percent >= 100

  return (
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5 shadow-sm transition-all hover:border-[var(--border-strong)] hover:shadow-md backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
        {percent !== undefined && (
          <Badge
            tone={isAhead ? 'success' : percent >= 80 ? 'warning' : 'danger'}
            size="xs"
            dot
          >
            {formatPercent(percent)}
          </Badge>
        )}
      </div>
      <div className="mt-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-[var(--text)] tracking-tight">
        {value}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(Math.max(percent ?? 100, 0), 100)}%`, background: tone }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span>{helper}</span>
        {isAhead && <span className="font-semibold text-emerald-400">Target Hit!</span>}
      </div>
    </div>
  )
}

function ActionRow({
  icon,
  label,
  detail,
  tone = 'var(--accent)',
  onClick,
}: {
  icon: ReactNode
  label: string
  detail: string
  tone?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/80 p-3.5 text-left transition-all duration-200 hover:border-[var(--accent)]/40 hover:bg-[var(--surface-3)] hover:shadow-sm active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105" style={{ background: `${tone}18`, color: tone }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">{label}</span>
        <span className="block truncate text-xs text-[var(--text-secondary)] mt-0.5">{detail}</span>
      </span>
      <ArrowRight size={16} className="text-[var(--text-tertiary)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--text)]" />
    </button>
  )
}

function StorePulse({ row }: { row: PerformanceRow | null }) {
  if (!row) {
    return (
      <Card variant="glass" className="p-6">
        <div className="flex items-center gap-2.5 text-base font-bold text-[var(--text)]">
          <BarChart3 size={18} className="text-[var(--accent)]" />
          Performance Pulse
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Live performance data is not mapped for this store yet.</p>
      </Card>
    )
  }

  const overall = (row.netRevenuePct + row.accessoryPct + row.ppPct) / 3
  const weakest = [
    { label: 'Net Revenue', value: row.netRevenuePct },
    { label: 'Accessories', value: row.accessoryPct },
    { label: 'PP Volume', value: row.ppPct },
  ].sort((a, b) => a.value - b.value)[0]

  return (
    <Card noPadding variant="glass" className="overflow-hidden border border-[var(--border)] shadow-md">
      <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)] tracking-tight">Daily Store Performance Pulse</h2>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Live store telemetry reconciled from Source data</p>
          </div>
          <Badge
            tone={overall >= 100 ? 'success' : overall >= 80 ? 'warning' : 'danger'}
            variant="glass"
            size="md"
            dot
          >
            {formatPercent(overall)} Composite Pace
          </Badge>
        </div>
      </div>

      <div className="grid gap-3.5 p-5 md:grid-cols-3">
        <HeroMetric label="Net Revenue" value={formatMoney(row.netRevenue)} percent={row.netRevenuePct} helper={`${formatMoney(Math.max(row.netRevenueGoal - row.netRevenue, 0))} to quota`} />
        <HeroMetric label="Accessories" value={formatMoney(row.accessoryRevenue)} percent={row.accessoryPct} helper={`${formatMoney(Math.max(row.accessoryGoal - row.accessoryRevenue, 0))} to quota`} />
        <HeroMetric label="Total PP Units" value={formatNumber(row.totalPp)} percent={row.ppPct} helper={`${formatNumber(Math.max(row.dortGoal - row.totalPp, 0))} to quota`} />
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/30 px-5 py-3 text-xs text-[var(--text-secondary)] flex items-center justify-between">
        <span>Strategic Focus Area: <strong className="text-[var(--text)]">{weakest.label}</strong> is currently at {formatPercent(weakest.value)} pace.</span>
      </div>
    </Card>
  )
}

function SmartBriefCard({
  brief,
  onOpenDistrict,
}: {
  brief: ReturnType<typeof smartDailyBrief>
  onOpenDistrict: () => void
}) {
  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-r from-[var(--accent)]/15 via-[var(--surface-2)] to-[var(--surface)] p-4 sm:p-5 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              <Sparkles size={15} />
              Smart Daily Brief
            </span>
            <Badge tone="accent" size="xs">{brief.focusLabel}</Badge>
          </div>
          <p className="mt-1.5 text-sm sm:text-base font-semibold text-[var(--text)] leading-snug">{brief.headline}</p>
        </div>
        <Button size="sm" variant="primary" onClick={onOpenDistrict} icon={<BarChart3 size={14} />}>
          View Ranks
        </Button>
      </div>
    </div>
  )
}

function DistrictWinsCard({
  wins,
  onOpenDistrict,
}: {
  wins: ReturnType<typeof districtWins>
  onOpenDistrict: () => void
}) {
  return (
    <Card noPadding variant="glass" className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
            <Trophy size={16} className="text-amber-400" />
            District Leaderboard Wins
          </h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Top-ranking categories from latest updates</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onOpenDistrict}>Full Board</Button>
      </div>
      <div className="space-y-2 p-4">
        {wins.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-2 text-center">No district wins posted yet.</p>
        ) : (
          wins.map((win) => (
            <button
              type="button"
              key={win.id}
              onClick={onOpenDistrict}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-left transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)] active:scale-[0.99]"
            >
              <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: win.tone }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--text)]">{win.label}</span>
                <span className="block truncate text-xs text-[var(--text-secondary)] mt-0.5">{win.detail}</span>
              </span>
              <ArrowRight size={14} className="text-[var(--text-tertiary)]" />
            </button>
          ))
        )}
      </div>
    </Card>
  )
}

export function TodayDashboard() {
  const { dealerCode, setTab, storeId, accessRole } = useUiStore()
  const { companyName, storeNumber, announcements } = useDisplayStore()
  const { employees, shifts } = useScheduleStore()
  const { tasks } = useTasksStore()
  const syncEntries = useSyncStore((s) => s.entries)
  const [customizing, setCustomizing] = useState(false)
  const [sectionPrefs, setSectionPrefs] = useState<DashboardSectionPrefs>(() => loadDashboardPrefs())
  const today = todayKey()
  const isMain = normalizeStoreId(storeId) === 'main'
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
  const googleStatus = performanceQuery.isError ? 'Issue' : performanceQuery.data ? 'Live' : 'Online'
  const googleTone = performanceQuery.isError ? '#c94040' : performanceQuery.data ? '#1f8a4c' : '#0876c9'
  const supabaseStatus = syncProblems.length ? 'Issue' : savingAreas.length ? 'Syncing' : 'Live'
  const supabaseTone = syncProblems.length ? '#c94040' : savingAreas.length ? '#c98408' : '#1f8a4c'

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(sectionPrefs))
  }, [sectionPrefs])

  const toggleSection = (sectionId: DashboardSectionId) => {
    setSectionPrefs((current) => ({ ...current, [sectionId]: !current[sectionId] }))
  }

  const resetSections = () => setSectionPrefs({ ...DEFAULT_DASHBOARD_PREFS })

  return (
    <div className="today-page page-frame page-frame-wide space-y-6 pb-12">
      {/* Hero Welcome Card */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface-2)] to-[var(--surface)] p-6 sm:p-8 shadow-xl backdrop-blur-2xl">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--accent)]/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-[#E20074]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent" variant="glass" size="sm">{dateLabel}</Badge>
              <Badge tone="success" variant="glass" size="sm" dot>Store Live</Badge>
              {accessRole && <Badge tone="tmobile" variant="glass" size="sm">{accessRole.replace('_', ' ')}</Badge>}
            </div>

            <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--text)]">
              {isMain ? 'District Operations Center' : companyName || `Store ${storeId}`}
            </h1>

            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              Real-time telemetry on sales targets, floor coverage, checklist compliance, and customer pipeline.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button
                size="sm"
                variant={customizing ? 'accent' : 'secondary'}
                icon={<Settings2 size={14} />}
                onClick={() => setCustomizing((v) => !v)}
              >
                Customize Layout
              </Button>
              {customizing && (
                <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={resetSections}>
                  Reset Defaults
                </Button>
              )}
            </div>
          </div>

          {/* Hero Quick Stat Ring Widgets */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/90 p-4 text-center backdrop-blur-md">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Floor Staff</div>
              <div className="mt-1 text-2xl font-extrabold text-[var(--text)]">{todayShifts.length}</div>
              <div className="mt-0.5 text-[11px] text-emerald-400 font-medium">On Shift Today</div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/90 p-4 text-center backdrop-blur-md">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Checklist</div>
              <div className="mt-1 text-2xl font-extrabold text-[var(--accent)]">{hasTasks ? `${taskPct}%` : '—'}</div>
              <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{doneTasks}/{tasks.length} Completed</div>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/90 p-4 text-center backdrop-blur-md">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Appointments</div>
              <div className="mt-1 text-2xl font-extrabold text-[#E20074]">{appointmentRows}</div>
              <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Pipeline Booked</div>
            </div>
          </div>
        </div>
      </section>

      {/* Customizer Panel */}
      {customizing && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 shadow-md backdrop-blur-xl animate-scale-in">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
            <Settings2 size={16} className="text-[var(--accent)]" />
            Active Dashboard Sections
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {DASHBOARD_SECTIONS.map((section) => {
              const enabled = sectionPrefs[section.id]
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-left text-xs font-semibold transition-all ${
                    enabled
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                      : 'border-[var(--border)] bg-[var(--surface-3)] text-[var(--text-tertiary)]'
                  }`}
                >
                  <span className="truncate">{section.label}</span>
                  {!enabled && <EyeOff size={14} />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {sectionPrefs.brief && <SmartBriefCard brief={brief} onOpenDistrict={() => setTab('district')} />}

          {sectionPrefs.pulse && <StorePulse row={performanceRow} />}

          {sectionPrefs.attention && (
            <Card noPadding variant="glass" className="overflow-hidden">
              <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-5 py-4">
                <h2 className="text-base font-bold text-[var(--text)]">Action Priorities & Needs Attention</h2>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Recommended focus items for the current shift</p>
              </div>
              <div className="space-y-2.5 p-5">
                <ActionRow
                  icon={<CheckSquare size={18} />}
                  label={tasks.length ? `${tasks.length - doneTasks} checklist tasks remaining` : 'Build floor checklist'}
                  detail={tasks.length ? `${doneTasks} of ${tasks.length} tasks marked complete today` : 'Set up opening and closing store duties'}
                  tone={taskPct === 100 ? '#10b981' : '#f59e0b'}
                  onClick={() => setTab('tasks')}
                />
                <ActionRow
                  icon={<Users size={18} />}
                  label={todayShifts.length ? `${todayShifts.length} team members scheduled` : 'No shifts on schedule'}
                  detail={todayShifts.slice(0, 3).map((s) => s.employee.name).join(', ') || 'Review schedule before doors open'}
                  tone="#0ea5e9"
                  onClick={() => setTab('schedule')}
                />
                <ActionRow
                  icon={<CalendarPlus size={18} />}
                  label={appointmentsQuery.isError ? 'Review Appointment Configuration' : `${appointmentRows} customer appointments active`}
                  detail={appointmentsQuery.isLoading ? 'Checking tracker…' : appointmentsQuery.isError ? 'Click to inspect store sheet mapping' : 'Manage customer follow-ups and scheduled visits'}
                  tone={appointmentsQuery.isError ? '#ef4444' : '#E20074'}
                  onClick={() => setTab('appointments')}
                />
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {sectionPrefs.wins && <DistrictWinsCard wins={wins} onOpenDistrict={() => setTab('district')} />}

          {sectionPrefs.coverage && (
            <Card noPadding variant="glass" className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text)]">Today’s Floor Coverage</h2>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{todayShifts.length} active scheduled shifts</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setTab('schedule')} icon={<Calendar size={13} />}>
                  Schedule
                </Button>
              </div>
              <div className="max-h-[22rem] space-y-2 overflow-y-auto p-4">
                {todayShifts.length === 0 ? (
                  <EmptyState
                    icon={<Users size={20} />}
                    title="No Coverage Scheduled"
                    detail="Add shifts to give visibility into opening and closing staffing."
                    action={<Button size="sm" variant="secondary" onClick={() => setTab('schedule')}>Open Schedule</Button>}
                  />
                ) : (
                  todayShifts.map((shift) => (
                    <div key={shift.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                      <span className="h-8 w-1.5 rounded-full" style={{ background: shift.employee.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--text)]">{shift.employee.name}</div>
                        <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] mt-0.5">
                          <Clock size={12} className="text-[var(--text-tertiary)]" />
                          <span>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</span>
                        </div>
                      </div>
                      <Badge size="xs" variant="outline">{shift.type || 'Shift'}</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {sectionPrefs.checklist && (
            <Card noPadding variant="glass" className="overflow-hidden">
              <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-5 py-4">
                <h2 className="text-sm font-bold text-[var(--text)]">Checklist Status</h2>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Daily store operations compliance</p>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-3xl font-extrabold tabular-nums text-[var(--text)] tracking-tight">
                      {hasTasks ? `${taskPct}%` : 'No Tasks'}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      {hasTasks ? `${doneTasks} of ${tasks.length} items verified` : 'No active checklist loaded'}
                    </div>
                  </div>
                  <CheckCircle2 size={36} className={hasTasks && taskPct === 100 ? 'text-emerald-400' : 'text-[var(--text-tertiary)]'} />
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-emerald-400 transition-all duration-500"
                    style={{ width: hasTasks ? `${taskPct}%` : '0%' }}
                  />
                </div>
                <div className="mt-4">
                  <Button size="sm" variant="secondary" className="w-full justify-center" onClick={() => setTab('tasks')} icon={<CheckSquare size={14} />}>
                    Open Floor Checklist
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {sectionPrefs.announcements && (
            <Card noPadding variant="glass" className="overflow-hidden">
              <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-5 py-4">
                <h2 className="text-sm font-bold text-[var(--text)]">Store Announcements</h2>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{activeAnnouncements.length} active broadcast messages</p>
              </div>
              <div className="space-y-2 p-4">
                {activeAnnouncements.length === 0 ? (
                  <EmptyState
                    icon={<RadioTower size={18} />}
                    title="No Active Messages"
                    detail="Store announcements will appear here when posted."
                    action={<Button size="sm" variant="ghost" onClick={() => setTab('settings')}>Manage Messages</Button>}
                  />
                ) : (
                  activeAnnouncements.slice(0, 3).map((announcement) => (
                    <div key={announcement.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                      <div className="text-sm font-medium text-[var(--text)]">{announcement.text}</div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                        <span>{announcement.priority}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {sectionPrefs.connectivity && (
            <Card variant="glass" className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
                    <Wifi size={16} className="text-[var(--accent)]" />
                    Cloud Sync & Connectivity
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Reconciliation telemetry with cloud engines</p>
                </div>
                <Badge
                  tone={syncProblems.length || performanceQuery.isError ? 'danger' : 'success'}
                  dot
                  size="xs"
                >
                  {syncProblems.length || performanceQuery.isError ? 'Check Required' : 'Synchronized'}
                </Badge>
              </div>
              <div className="mt-3.5 space-y-2">
                <ConnectivityTile
                  label="Google Performance Source"
                  status={googleStatus}
                  tone={googleTone}
                  detail={performanceQuery.isError ? 'Service unavailable' : performanceQuery.data ? 'Live feed connected' : 'Querying feed…'}
                />
                <ConnectivityTile
                  label="Supabase Core Database"
                  status={supabaseStatus}
                  tone={supabaseTone}
                  detail={`Last synced ${formatUpdatedAt(supabaseUpdatedAt)}`}
                />
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
