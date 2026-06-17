import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  Clock,
  Sparkles,
  Trophy,
  RadioTower,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Card } from '../../ui/Card'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { useUiStore } from '../../../store/uiStore'
import { isAnnouncementActive, useDisplayStore } from '../../../store/displayStore'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useTasksStore } from '../../../store/tasksStore'
import { useSyncStore } from '../../../store/syncStore'
import { fetchPerformanceData, formatMoney, formatNumber, formatPercent, type PerformanceRow } from '../../../lib/performanceSheet'
import { districtWins, smartDailyBrief } from '../../../lib/districtInsights'
import { appointmentFilledRows, fetchAppointmentTrackerData } from '../../../lib/appointments'
import { normalizeStoreId } from '../../../lib/storeIds'

const todayKey = () => {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
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

function selectedPerformanceRow(data: Awaited<ReturnType<typeof fetchPerformanceData>> | undefined, identifiers: string[], isMain: boolean) {
  if (!data) return null
  if (isMain) return data.total

  const candidates = new Set(identifiers.map(normalizeStoreCode).filter(Boolean))
  return data.rows.find((row) => candidates.has(normalizeStoreCode(row.storeCode))) ?? null
}

function HeroMetric({ label, value, percent, helper }: { label: string; value: string; percent?: number; helper: string }) {
  const tone = percent === undefined ? 'var(--accent)' : metricTone(percent)

  return (
    <div className="today-metric">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">{label}</span>
        {percent !== undefined && <Badge size="sm" color={tone}>{formatPercent(percent)}</Badge>}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(Math.max(percent ?? 100, 0), 100)}%`, background: tone }}
        />
      </div>
      <div className="mt-2 text-xs text-[var(--text-secondary)]">{helper}</div>
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
      className="group flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md" style={{ background: `${tone}18`, color: tone }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--text)]">{label}</span>
        <span className="block truncate text-xs text-[var(--text-secondary)]">{detail}</span>
      </span>
      <ArrowRight size={15} className="text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
    </button>
  )
}

function StorePulse({ row }: { row: PerformanceRow | null }) {
  if (!row) {
    return (
      <Card className="today-panel">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <BarChart3 size={17} className="text-[var(--accent)]" />
          Performance Pulse
        </div>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Live performance data is not mapped for this store yet.</p>
      </Card>
    )
  }

  const overall = (row.netRevenuePct + row.accessoryPct + row.ppPct) / 3
  const weakest = [
    { label: 'Net revenue', value: row.netRevenuePct },
    { label: 'Accessories', value: row.accessoryPct },
    { label: 'PP', value: row.ppPct },
  ].sort((a, b) => a.value - b.value)[0]

  return (
    <Card className="today-panel" noPadding>
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Performance Pulse</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Live sales sheet snapshot</p>
          </div>
          <Badge color={metricTone(overall)}>{formatPercent(overall)} overall</Badge>
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        <HeroMetric label="Net Revenue" value={formatMoney(row.netRevenue)} percent={row.netRevenuePct} helper={`${formatMoney(Math.max(row.netRevenueGoal - row.netRevenue, 0))} left`} />
        <HeroMetric label="Accessories" value={formatMoney(row.accessoryRevenue)} percent={row.accessoryPct} helper={`${formatMoney(Math.max(row.accessoryGoal - row.accessoryRevenue, 0))} left`} />
        <HeroMetric label="Total PP" value={formatNumber(row.totalPp)} percent={row.ppPct} helper={`${formatNumber(Math.max(row.dortGoal - row.totalPp, 0))} left`} />
      </div>
      <div className="border-t border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        Focus area: <span className="font-semibold text-[var(--text)]">{weakest.label}</span> is at {formatPercent(weakest.value)}.
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
  const tone = metricTone(brief.focusValue)

  return (
    <Card className="today-panel" noPadding>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <Sparkles size={16} className="text-[var(--accent)]" />
            Smart Daily Brief
          </div>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{brief.headline}</p>
        </div>
        <Badge color={tone}>{brief.focusLabel}</Badge>
      </div>
      <div className="space-y-2 p-4">
        {brief.lines.map((line) => (
          <div key={line} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            {line}
          </div>
        ))}
        <Button size="sm" variant="accent" onClick={onOpenDistrict} icon={<BarChart3 size={13} />}>
          Open District Outlook
        </Button>
      </div>
    </Card>
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
    <Card className="today-panel" noPadding>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <Trophy size={16} className="text-[var(--accent)]" />
            District Wins
          </h2>
          <p className="text-xs text-[var(--text-tertiary)]">Leaderboard moments from Source</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onOpenDistrict}>Open</Button>
      </div>
      <div className="space-y-2 p-4">
        {wins.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No district wins are available yet.</p>
        ) : wins.map((win) => (
          <button
            type="button"
            key={win.id}
            onClick={onOpenDistrict}
            className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: win.tone }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--text)]">{win.label}</span>
              <span className="block truncate text-xs text-[var(--text-secondary)]">{win.detail}</span>
            </span>
            <ArrowRight size={14} className="text-[var(--text-tertiary)]" />
          </button>
        ))}
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
  const today = todayKey()
  const isMain = normalizeStoreId(storeId) === 'main'
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const performanceQuery = useQuery({
    queryKey: ['today-performance'],
    queryFn: fetchPerformanceData,
    staleTime: 55_000,
    refetchInterval: 60_000,
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
  const urgentAnnouncements = activeAnnouncements.filter((announcement) => announcement.priority === 'urgent').length
  const appointmentRows = appointmentFilledRows(appointmentsQuery.data ?? null, 'Week 1').length
  const openTaskCount = Math.max(tasks.length - doneTasks, 0)
  const brief = smartDailyBrief({
    data: performanceQuery.data,
    row: performanceRow,
    identifiers: [dealerCode, storeNumber, storeId],
    shiftCount: todayShifts.length,
    openTaskCount,
    appointmentRows,
  })
  const wins = districtWins(performanceQuery.data)
  const syncProblems = Object.entries(syncEntries).filter(([, entry]) => entry.state === 'error')
  const savingAreas = Object.entries(syncEntries).filter(([, entry]) => entry.state === 'saving')
  const dashboardTitle = isMain
    ? 'District overview: All stores'
    : `Today at ${companyName || 'Luna Store'}`

  return (
    <div className="today-page">
      <section className="today-hero">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{dateLabel}</Badge>
            {accessRole && <Badge color="var(--accent)">{accessRole.replace('_', ' ')}</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-[var(--text)] sm:text-4xl">
            {dashboardTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            A live read on sales, coverage, checklist progress, appointments, and store messages.
          </p>
        </div>
        <div className="today-hero-card">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[var(--accent)]/12 text-[var(--accent)]">
              <RadioTower size={21} />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">Store Signal</div>
              <div className="text-lg font-semibold text-[var(--text)]">{isMain ? 'All stores' : `Store ${storeId}`}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-[var(--surface-2)] p-2">
              <div className="text-[10px] uppercase text-[var(--text-tertiary)]">Team</div>
              <div className="font-semibold tabular-nums text-[var(--text)]">{employees.length}</div>
            </div>
            <div className="rounded-md bg-[var(--surface-2)] p-2">
              <div className="text-[10px] uppercase text-[var(--text-tertiary)]">Tasks</div>
              <div className="font-semibold tabular-nums text-[var(--text)]">{hasTasks ? `${taskPct}%` : 'No tasks'}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="today-grid">
        <div className="space-y-4">
          <SmartBriefCard brief={brief} onOpenDistrict={() => setTab('district')} />

          <StorePulse row={performanceRow} />

          <Card className="today-panel" noPadding>
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--text)]">Needs Attention</h2>
              <p className="text-xs text-[var(--text-tertiary)]">The fastest next moves for this store.</p>
            </div>
            <div className="space-y-2 p-4">
              <ActionRow
                icon={<CheckSquare size={17} />}
                label={tasks.length ? `${tasks.length - doneTasks} checklist items open` : 'Build today’s checklist'}
                detail={tasks.length ? `${doneTasks} of ${tasks.length} complete` : 'Add opening, closing, and general tasks'}
                tone={taskPct === 100 ? '#1f8a4c' : '#c98408'}
                onClick={() => setTab('tasks')}
              />
              <ActionRow
                icon={<Users size={17} />}
                label={todayShifts.length ? `${todayShifts.length} shifts scheduled today` : 'No shifts scheduled today'}
                detail={todayShifts.slice(0, 2).map((shift) => shift.employee.name).join(', ') || 'Check staff coverage before opening'}
                onClick={() => setTab('schedule')}
              />
              <ActionRow
                icon={<CalendarPlus size={17} />}
                label={appointmentsQuery.isError ? 'Appointment tracker needs setup' : `${appointmentRows} appointment rows this week`}
                detail={appointmentsQuery.isLoading ? 'Loading tracker' : appointmentsQuery.isError ? 'Open appointments to review sheet mapping' : 'Review customer follow-ups and outcomes'}
                tone={appointmentsQuery.isError ? '#c94040' : 'var(--accent)'}
                onClick={() => setTab('appointments')}
              />
              {(urgentAnnouncements > 0 || syncProblems.length > 0 || savingAreas.length > 0) && (
                <ActionRow
                  icon={<AlertTriangle size={17} />}
                  label={syncProblems.length ? `${syncProblems.length} sync issue${syncProblems.length === 1 ? '' : 's'}` : urgentAnnouncements ? `${urgentAnnouncements} urgent announcement${urgentAnnouncements === 1 ? '' : 's'}` : 'Saving changes'}
                  detail={syncProblems[0]?.[1].message ?? savingAreas[0]?.[1].message ?? 'Review active display messages'}
                  tone={syncProblems.length ? '#c94040' : '#c98408'}
                  onClick={() => setTab(syncProblems.length ? 'settings' : 'display')}
                />
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <DistrictWinsCard wins={wins} onOpenDistrict={() => setTab('district')} />

          <Card className="today-panel" noPadding>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">Today’s Coverage</h2>
                <p className="text-xs text-[var(--text-tertiary)]">{todayShifts.length} scheduled shifts</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setTab('schedule')} icon={<Calendar size={13} />}>Open</Button>
            </div>
            <div className="max-h-[19rem] space-y-2 overflow-y-auto p-4">
              {todayShifts.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No coverage has been added for today.</p>
              ) : todayShifts.map((shift) => (
                <div key={shift.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <span className="h-8 w-1 rounded-full" style={{ background: shift.employee.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[var(--text)]">{shift.employee.name}</div>
                    <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                      <Clock size={12} />
                      {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    </div>
                  </div>
                  <Badge size="sm" variant="outline">{shift.type || 'Shift'}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="today-panel" noPadding>
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--text)]">Checklist</h2>
              <p className="text-xs text-[var(--text-tertiary)]">Daily completion progress</p>
            </div>
            <div className="p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-3xl font-semibold tabular-nums text-[var(--text)]">{hasTasks ? `${taskPct}%` : 'No tasks'}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{hasTasks ? `${doneTasks} of ${tasks.length} complete` : 'Checklist is empty'}</div>
                </div>
                <CheckCircle2 size={34} className={hasTasks && taskPct === 100 ? 'text-[var(--status-good)]' : 'text-[var(--text-tertiary)]'} />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: hasTasks ? `${taskPct}%` : '0%' }} />
              </div>
            </div>
          </Card>

          <Card className="today-panel" noPadding>
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--text)]">Announcements</h2>
              <p className="text-xs text-[var(--text-tertiary)]">{activeAnnouncements.length} active messages</p>
            </div>
            <div className="space-y-2 p-4">
              {activeAnnouncements.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No active store messages right now.</p>
              ) : activeAnnouncements.slice(0, 3).map((announcement) => (
                <div key={announcement.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <div className="text-sm text-[var(--text)]">{announcement.text}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{announcement.priority}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="today-panel">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
              <TrendingUp size={17} className="text-[var(--accent)]" />
              Live Data
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {Object.entries(syncEntries).map(([area, entry]) => (
                <div key={area} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-2">
                  <div className="font-semibold capitalize text-[var(--text)]">{area}</div>
                  <div className="mt-0.5 truncate text-[var(--text-tertiary)]">{entry.state}</div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
