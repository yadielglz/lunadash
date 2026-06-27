import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BadgeDollarSign, ChevronLeft, ChevronRight, LogOut, Maximize, Minimize, Pause, Play, Target, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays } from 'date-fns'
import { useFullscreen } from '../../../hooks/useFullscreen'
import { useWeather } from '../../../hooks/useWeather'
import { useTempDisplay } from '../../../hooks/useTempDisplay'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useCommissionSnapshotStore, type CommissionSnapshot } from '../../../store/commissionSnapshotStore'
import { isAnnouncementActive, useDisplayStore } from '../../../store/displayStore'
import { useUiStore } from '../../../store/uiStore'
import { getWeatherInfo, getWindDirection } from '../../../lib/openMeteo'
import { formatShiftTime, hexToRgba } from '../../../lib/utils'
import { fetchPerformanceData, type PerformanceRow } from '../../../lib/performanceSheet'
import { dealerInfoForRow } from '../../../lib/dealers'
import { weekdayKeyForDate, type StoreHours } from '../../../lib/storeHours'
import { normalizeStoreId } from '../../../lib/storeIds'
import {
  RADAR_BASEMAP_ZOOM,
  RADAR_RADIUS_MILES,
  RADAR_TILE_SIZE,
  RADAR_VIEW_SCALE,
  fetchRainViewerMaps,
  latToTileY,
  lonToTileX,
  radarTileUrl,
  radarVisibleTiles,
  wrapTileX,
  clampTileY,
  type RadarFrame,
} from '../../../lib/radar'

const MG  = '#007AFF'
const MG2 = '#5AC8FA'
const CYAN = '#64D2FF'
const GREEN = '#30D158'
const GOLD = '#FFD60A'
const PANEL = 'rgba(255,255,255,0.085)'
const PANEL_STRONG = 'rgba(255,255,255,0.16)'
const LINE = 'rgba(255,255,255,0.16)'
const STORE_LOGOS: Record<string, { url: string; alt: string; label?: string }> = {}

type SlideAvailability = {
  hasTodaySchedule: boolean
  hasScheduleOutlook: boolean
  hasAnnouncements: boolean
  hasCommissionSnapshot: boolean
}

type DisplaySlideConfig = {
  key: string
  label: string
  component: () => JSX.Element
  shouldShow?: (availability: SlideAvailability) => boolean
}

function formatMoney(value: number) {
  return Math.round(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString('en-US')
}

function formatPercent(value: number) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}

function ratioPercent(value: number, goal: number) {
  if (!goal) return 0
  return (value / goal) * 100
}

function latestCommissionRows(snapshots: CommissionSnapshot[], storeId: string) {
  const normalizedStoreId = normalizeStoreId(storeId)
  const storeRows = snapshots.filter((snapshot) => normalizeStoreId(snapshot.storeId ?? '') === normalizedStoreId)
  const latestDate = storeRows
    .map((snapshot) => snapshot.snapshotDate)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0]

  if (!latestDate) return []
  return storeRows
    .filter((snapshot) => snapshot.snapshotDate === latestDate)
    .sort((a, b) => b.commission - a.commission || a.sortOrder - b.sortOrder || a.employeeName.localeCompare(b.employeeName))
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0)
}

function shiftProgressPercent(now: Date, start: string, end: string) {
  const startMinutes = minutesFromTime(start)
  let endMinutes = minutesFromTime(end)
  let currentMinutes = now.getHours() * 60 + now.getMinutes()

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60
    if (currentMinutes < startMinutes) currentMinutes += 24 * 60
  }

  if (currentMinutes <= startMinutes) return 0
  if (currentMinutes >= endMinutes) return 100
  return ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100
}

function formatStoreTime(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return format(date, 'h:mm a')
}

function nextOpeningLabel(now: Date, hours: StoreHours) {
  const todayMinutes = now.getHours() * 60 + now.getMinutes()

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(now, offset)
    const dayHours = hours[weekdayKeyForDate(date)]
    if (!dayHours.open) continue

    const startMinutes = minutesFromTime(dayHours.start)
    if (offset === 0 && todayMinutes < startMinutes) {
      return `Opens ${formatStoreTime(dayHours.start)}`
    }
    if (offset > 0) {
      const dayLabel = offset === 1 ? 'tomorrow' : format(date, 'EEEE')
      return `Opens ${dayLabel} ${formatStoreTime(dayHours.start)}`
    }
  }

  return 'No open hours set'
}

function storeStatusFor(now: Date, hours: StoreHours) {
  const today = hours[weekdayKeyForDate(now)]
  if (!today.open) return { label: 'Closed', detail: nextOpeningLabel(now, hours), accent: 'rgba(255,255,255,0.5)' }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = minutesFromTime(today.start)
  const endMinutes = minutesFromTime(today.end)
  const isOpen = endMinutes >= startMinutes
    ? currentMinutes >= startMinutes && currentMinutes < endMinutes
    : currentMinutes >= startMinutes || currentMinutes < endMinutes

  return isOpen
    ? { label: 'Open', detail: `Closes ${formatStoreTime(today.end)}`, accent: GREEN }
    : { label: 'Closed', detail: nextOpeningLabel(now, hours), accent: MG }
}

function overallScore(row: PerformanceRow) {
  return (row.netRevenuePct + row.accessoryPct + row.ppPct) / 3
}

function performanceRows(rows: PerformanceRow[]) {
  return rows.filter((row) => row.store.toLowerCase() !== 'total')
}

function normalizeStoreCode(value: string) {
  return value.replace(/\D/g, '').trim()
}

function selectedPerformanceRow(data: Awaited<ReturnType<typeof fetchPerformanceData>> | undefined, identifiers: string[], isMain: boolean) {
  if (!data) return null
  if (isMain) return data.total

  const candidates = new Set(identifiers.map(normalizeStoreCode).filter(Boolean))
  return data.rows.find((row) => candidates.has(normalizeStoreCode(row.storeCode))) ?? null
}

function apparentTemperatureC(tempC: number, windMph: number) {
  const tempF = (tempC * 9 / 5) + 32
  let feelsF = tempF

  if (tempF <= 50 && windMph > 3) {
    feelsF = 35.74 + (0.6215 * tempF) - (35.75 * windMph ** 0.16) + (0.4275 * tempF * windMph ** 0.16)
  } else if (tempF >= 82) {
    feelsF = tempF + (tempF >= 92 ? 4 : 2)
  }

  return (feelsF - 32) * 5 / 9
}

function goalState(progress?: number) {
  if (progress === undefined) return null
  if (progress >= 100) return { label: 'Goal met', color: GREEN }
  if (progress >= 80) return { label: `${Math.round(progress)}% to goal`, color: GOLD }
  return { label: `${Math.round(progress)}% to goal`, color: 'rgba(255,255,255,0.48)' }
}

function SlideHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="flex w-full flex-shrink-0 items-end justify-between gap-[2vw]">
      <div className="min-w-0">
        <div className="mb-[0.7vh] text-[0.9vw] font-bold uppercase tracking-[0.16em]" style={{ color: CYAN }}>
          {eyebrow}
        </div>
        <h2 className="truncate text-[3vw] font-black leading-none text-white drop-shadow-[0_1.2vh_2.5vh_rgba(0,0,0,0.28)]">{title}</h2>
      </div>
      {detail && (
        <div className="rounded-full border px-[1vw] py-[0.55vh] text-[0.95vw] font-semibold text-white/[0.70] shadow-[inset_0_1px_rgba(255,255,255,0.14)] backdrop-blur-2xl" style={{ borderColor: LINE, background: 'rgba(255,255,255,0.08)' }}>
          {detail}
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, accent = CYAN }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-[1vw] border px-[1.1vw] py-[1vh] shadow-[inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl" style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}>
      <div className="text-[0.78vw] font-bold uppercase tracking-[0.14em] text-white/[0.40]">{label}</div>
      <div className="mt-[0.35vh] text-[1.45vw] font-black tabular-nums text-white" style={{ color: accent }}>{value}</div>
    </div>
  )
}

function ProgressBar({ value, accent }: { value: number; accent: string }) {
  return (
    <div className="h-[0.62vh] overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: accent }}
      />
    </div>
  )
}

// ── Slide: Store Pulse ────────────────────────────────────────────────────────
function StorePulseSlide() {
  const { companyName, storeNumber, storeHours, announcements } = useDisplayStore()
  const { getShiftsForDate, employees } = useScheduleStore()
  const { data: weatherData } = useWeather()
  const { fmt, unit } = useTempDisplay()
  const { dealerCode, storeId } = useUiStore()
  const [now, setNow] = useState(new Date())
  const todayStr = format(now, 'yyyy-MM-dd')
  const shifts = [...getShiftsForDate(todayStr)].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const activeAnnouncements = announcements.filter((announcement) => isAnnouncementActive(announcement))
  const storeStatus = storeStatusFor(now, storeHours)
  const currentWeather = weatherData?.current_weather
  const weather = currentWeather ? getWeatherInfo(currentWeather.weathercode, currentWeather.is_day) : null
  const apparentTemp = currentWeather ? apparentTemperatureC(currentWeather.temperature, currentWeather.windspeed) : null
  const todayPrecip = weatherData?.daily.precipitation_probability_max[0]
  const todayHigh = weatherData?.daily.temperature_2m_max[0]
  const todayLow = weatherData?.daily.temperature_2m_min[0]
  const performanceQuery = useQuery({
    queryKey: ['display-pulse-performance'],
    queryFn: fetchPerformanceData,
    staleTime: 55_000,
    refetchInterval: 60_000,
  })
  const performanceRow = selectedPerformanceRow(performanceQuery.data, [dealerCode, storeNumber, storeId], normalizeStoreCode(storeId) === 'main')

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const coverage = shifts
    .map((shift) => ({ shift, employee: employees.find((employee) => employee.id === shift.employeeId) }))
    .filter((entry): entry is { shift: typeof shifts[number]; employee: typeof employees[number] } => Boolean(entry.employee))
  const metricCards = performanceRow ? [
    {
      label: 'NR',
      current: formatMoney(performanceRow.netRevenue),
      goal: formatMoney(performanceRow.netRevenueGoal),
      gap: formatMoney(Math.max(performanceRow.netRevenueGoal - performanceRow.netRevenue, 0)),
      progress: performanceRow.netRevenuePct,
      accent: MG,
    },
    {
      label: 'Accessories',
      current: formatMoney(performanceRow.accessoryRevenue),
      goal: formatMoney(performanceRow.accessoryGoal),
      gap: formatMoney(Math.max(performanceRow.accessoryGoal - performanceRow.accessoryRevenue, 0)),
      progress: performanceRow.accessoryPct,
      accent: GOLD,
    },
    {
      label: 'PPs',
      current: formatNumber(performanceRow.totalPp),
      goal: formatNumber(performanceRow.dortGoal),
      gap: formatNumber(Math.max(performanceRow.dortGoal - performanceRow.totalPp, 0)),
      progress: performanceRow.ppPct,
      accent: GREEN,
    },
  ] : []

  return (
    <div className="flex h-full flex-col px-[5vw] pb-[4vh] pt-[5vh] gap-[2.6vh] select-none">
      <SlideHeader eyebrow="Store pulse" title={companyName || 'Luna Store'} detail={storeNumber ? `Store #${storeNumber}` : format(now, 'EEEE, MMM d')} />

      <div className="grid flex-1 grid-cols-[1.05fr_0.95fr] gap-[2vw] overflow-hidden">
        <div className="relative flex min-w-0 flex-col overflow-hidden rounded-[1.8vw] border p-[2.25vw] shadow-[0_3vh_8vh_rgba(0,0,0,0.26)] backdrop-blur-2xl" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055))', borderColor: LINE }}>
          <div className="absolute right-[-5vw] top-[-8vh] h-[28vw] w-[28vw] rounded-full opacity-30 blur-[5vw]" style={{ background: MG }} />
          <div className="relative flex flex-col items-center text-center">
            <div className="text-[9.8vw] font-black leading-none tabular-nums text-white">
              {format(now, 'h:mm')}
              <span className="ml-[0.8vw] text-[2.2vw] text-white/[0.40]">{format(now, 'a')}</span>
            </div>
            <div className="mt-[1.3vh] flex items-center gap-[0.8vw] rounded-full border px-[1.1vw] py-[0.8vh] shadow-[inset_0_1px_rgba(255,255,255,0.12)]" style={{ background: `${storeStatus.accent}16`, borderColor: `${storeStatus.accent}45` }}>
              <span className="h-[0.7vw] w-[0.7vw] rounded-full" style={{ background: storeStatus.accent, boxShadow: `0 0 1.1vw ${storeStatus.accent}` }} />
              <span className="text-[1.2vw] font-black uppercase tracking-[0.12em]" style={{ color: storeStatus.accent }}>{storeStatus.label}</span>
              <span className="text-[1.1vw] font-semibold text-white/[0.55]">{storeStatus.detail}</span>
            </div>
          </div>

          <div className="relative mt-[2.4vh]">
            <div className="mb-[1vh] flex items-center justify-between">
              <div className="text-[0.85vw] font-bold uppercase tracking-[0.14em] text-white/[0.42]">Current store stat</div>
              <div className="text-[0.8vw] font-semibold text-white/[0.34]">{performanceQuery.isFetching ? 'Updating' : performanceRow ? 'Source live' : 'No Source row'}</div>
            </div>
            <div className="grid grid-cols-3 gap-[0.9vw]">
              {metricCards.length > 0 ? metricCards.map((metric) => (
                <div key={metric.label} className="rounded-[1.1vw] border p-[1vw] shadow-[inset_0_1px_rgba(255,255,255,0.12)]" style={{ background: 'rgba(0,0,0,0.18)', borderColor: `${metric.accent}38` }}>
                  <div className="flex items-center justify-between gap-[0.5vw]">
                    <div className="text-[0.82vw] font-black uppercase tracking-[0.12em]" style={{ color: metric.accent }}>{metric.label}</div>
                    <div className="text-[0.82vw] font-black tabular-nums text-white/[0.55]">{formatPercent(metric.progress)}</div>
                  </div>
                  <div className="mt-[0.75vh] space-y-[0.45vh] text-[0.82vw] font-semibold text-white/[0.48]">
                    <div className="flex justify-between gap-[0.5vw]"><span>Current</span><span className="text-white">{metric.current}</span></div>
                    <div className="flex justify-between gap-[0.5vw]"><span>Goal</span><span className="text-white/[0.72]">{metric.goal}</span></div>
                    <div className="flex justify-between gap-[0.5vw]"><span>Gap</span><span style={{ color: metric.accent }}>{metric.gap}</span></div>
                  </div>
                  <div className="mt-[0.9vh]">
                    <ProgressBar value={metric.progress} accent={metric.accent} />
                  </div>
                </div>
              )) : (
                <div className="col-span-3 rounded-[1.1vw] border p-[1.2vw] text-[1.1vw] font-semibold text-white/[0.42]" style={{ background: 'rgba(0,0,0,0.18)', borderColor: LINE }}>
                  Performance stats are not mapped for this store yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-rows-3 gap-[1.2vh]">
          <div className="rounded-[1.4vw] border p-[1.5vw] shadow-[inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl" style={{ background: PANEL, borderColor: LINE }}>
            <div className="flex items-center justify-between gap-[1vw]">
              <div>
                <div className="text-[0.85vw] font-bold uppercase tracking-[0.14em] text-white/[0.40]">Weather now</div>
                <div className="mt-[0.6vh] text-[2vw] font-black text-white">{weather?.label ?? 'Weather loading'}</div>
              </div>
              <div className="flex items-center gap-[0.8vw]">
                <span className="text-[4vw] leading-none">{weather?.icon ?? '•'}</span>
                <span className="text-[3.4vw] font-black tabular-nums text-white">
                  {currentWeather ? `${fmt(currentWeather.temperature)}${unit}` : '--'}
                </span>
              </div>
            </div>
            <div className="mt-[1.2vh] grid grid-cols-4 gap-[0.7vw]">
              <StatTile label="Feels like" value={apparentTemp !== null ? `${fmt(apparentTemp)}${unit}` : '--'} accent={MG2} />
              <StatTile label="Wind" value={currentWeather ? `${Math.round(currentWeather.windspeed)} mph` : '--'} accent={CYAN} />
              <StatTile label="Direction" value={currentWeather ? getWindDirection(currentWeather.winddirection) : '--'} accent={GREEN} />
              <StatTile label="Rain" value={todayPrecip !== undefined ? `${todayPrecip}%` : '--'} accent={GOLD} />
            </div>
            <div className="mt-[0.9vh] grid grid-cols-2 gap-[0.7vw]">
              <StatTile label="High" value={todayHigh !== undefined ? `${fmt(todayHigh)}${unit}` : '--'} accent="#FF453A" />
              <StatTile label="Low" value={todayLow !== undefined ? `${fmt(todayLow)}${unit}` : '--'} accent={CYAN} />
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.4vw] border p-[1.5vw] shadow-[inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl" style={{ background: PANEL, borderColor: LINE }}>
            <div className="flex items-center justify-between gap-[1vw]">
              <div className="text-[0.85vw] font-bold uppercase tracking-[0.14em] text-white/[0.40]">Current coverage</div>
              <div className="text-[0.9vw] font-semibold text-white/[0.36]">{coverage.length} scheduled</div>
            </div>
            {coverage.length > 0 ? (
              <div className="mt-[0.9vh] grid max-h-[24vh] gap-[0.65vh] overflow-hidden">
                {coverage.slice(0, 5).map(({ shift, employee }) => {
                  const initials = employee.name.split(' ').map((part) => part[0]).join('').slice(0, 2)
                  return (
                    <div key={shift.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.75vw] rounded-[0.9vw] border px-[0.75vw] py-[0.55vh]" style={{ background: hexToRgba(employee.color, 0.10), borderColor: hexToRgba(employee.color, 0.22) }}>
                      <div className="flex h-[2.2vw] w-[2.2vw] items-center justify-center rounded-[0.65vw] text-[0.72vw] font-black text-white" style={{ background: employee.color }}>{initials}</div>
                      <div className="min-w-0">
                        <div className="truncate text-[1.05vw] font-black text-white">{employee.name}</div>
                        <div className="truncate text-[0.72vw] font-semibold text-white/[0.42]">{employee.role} | {shift.type}</div>
                      </div>
                      <div className="text-right text-[0.85vw] font-black tabular-nums text-white">{formatShiftTime(shift.startTime, shift.endTime)}</div>
                    </div>
                  )
                })}
                {coverage.length > 5 && <div className="text-[0.78vw] font-semibold text-white/[0.36]">+{coverage.length - 5} more on schedule</div>}
              </div>
            ) : (
              <div className="mt-[1vh] text-[1.6vw] font-semibold text-white/[0.45]">No shifts scheduled today</div>
            )}
          </div>

          <div className="rounded-[1.4vw] border p-[1.5vw] shadow-[inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl" style={{ background: PANEL, borderColor: LINE }}>
            <div className="flex items-center justify-between gap-[1vw]">
              <div className="text-[0.85vw] font-bold uppercase tracking-[0.14em] text-white/[0.40]">Priority note</div>
              <div className="text-[0.9vw] font-semibold text-white/[0.36]">{activeAnnouncements.length} active</div>
            </div>
            <div className="mt-[0.8vh] line-clamp-3 text-[1.45vw] font-semibold leading-tight text-white">
              {activeAnnouncements[0]?.text ?? 'No active announcements right now.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Slide: Clock ─────────────────────────────────────────────────────────────
function ClockSlide() {
  const [now, setNow] = useState(new Date())
  const { companyName, storeNumber, storeHours } = useDisplayStore()
  const { timeFormat, storeId } = useUiStore()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hours   = timeFormat === '12'
    ? (now.getHours() % 12 || 12).toString().padStart(2, '0')
    : now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const ampm    = timeFormat === '12' ? format(now, 'a') : null
  const storeStatus = storeStatusFor(now, storeHours)
  const storeLogo = STORE_LOGOS[storeId]

  return (
    <div className="flex h-full flex-col px-[6vw] pb-[9vh] pt-[5.5vh] select-none">
      <header className="flex flex-shrink-0 flex-col items-center text-center">
        <div className="text-[0.9vw] font-bold uppercase tracking-[0.32em]" style={{ color: CYAN }}>Live store display</div>
        <h1 className="mt-[0.9vh] max-w-[72vw] text-[3.2vw] font-black leading-none text-white">
          {companyName}
        </h1>
        {storeNumber && <div className="mt-[0.8vh] text-[1.05vw] font-semibold text-white/[0.50]">Store #{storeNumber}</div>}
      </header>

      <div className={`mt-[3vh] grid flex-1 items-center gap-[4.2vw] overflow-hidden ${storeLogo ? 'grid-cols-[0.9fr_1.1fr]' : 'place-items-center'}`}>
        {storeLogo && (
          <div className="min-w-0">
            <div
              className="flex h-[53vh] w-full max-w-[34vw] items-center justify-center"
            >
              <img
                src={storeLogo.url}
                alt={storeLogo.alt}
                className="h-full w-full object-contain drop-shadow-[0_2vw_3vw_rgba(0,0,0,0.45)]"
                draggable={false}
              />
            </div>
          </div>
        )}

        <div className={`min-w-0 ${storeLogo ? '' : 'w-full max-w-[70vw]'}`}>
          <div className="w-full rounded-[1.8vw] border p-[2.4vw]" style={{ background: 'linear-gradient(135deg, rgba(226,0,116,0.15), rgba(54,209,220,0.08), rgba(255,255,255,0.035))', borderColor: LINE }}>
          <div className="flex items-start justify-between gap-[2vw]">
            <div
              className="rounded-full px-[1vw] py-[0.55vh] text-[0.95vw] font-black uppercase tracking-[0.22em]"
              style={{ background: `${CYAN}20`, color: CYAN }}
            >
              {storeLogo?.label ?? 'Store Clock'}
            </div>
            {ampm && <div className="rounded-md px-[0.8vw] py-[0.4vh] text-[1.05vw] font-black tracking-[0.18em]" style={{ background: `${MG}24`, color: MG }}>{ampm}</div>}
          </div>

          <div className={`mt-[4vh] flex items-end gap-[1vw] tabular-nums leading-none ${storeLogo ? 'justify-end' : 'justify-center'}`}>
            <span className="text-[12.8vw] font-black text-white">{hours}:{minutes}</span>
            <span className="pb-[1.35vw] text-[2.8vw] font-semibold text-white/[0.40]">:{seconds}</span>
          </div>
          <div className="mt-[1.4vh] h-[0.7vh] overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${MG}, ${CYAN})` }}
              animate={{ width: `${(now.getSeconds() / 59) * 100}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <div className="mt-[2.2vh] grid grid-cols-2 gap-[1vw]">
            <StatTile label={storeStatus.detail} value={storeStatus.label} accent={storeStatus.accent} />
            <StatTile label={format(now, 'EEEE')} value={format(now, 'MMM d')} accent={GOLD} />
          </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      {/* Magenta glow ring behind clock */}
      <div className="relative flex flex-col items-center gap-3">
        <div className="absolute inset-0 rounded-full blur-[80px] opacity-20" style={{ background: MG }} />

        {/* Time */}
        <div className="relative flex items-end gap-2 tabular-nums leading-none">
          <span className="text-[17vw] font-black text-white tracking-tight">
            {hours}:{minutes}
          </span>
          <div className="flex flex-col items-start pb-[2.5vw] gap-1">
            <span className="text-[3.5vw] font-thin text-white/[0.40]">:{seconds}</span>
            {ampm && (
              <span
                className="text-[2vw] font-bold tracking-widest uppercase px-2 py-0.5 rounded-md"
                style={{ background: `${MG}25`, color: MG }}
              >
                {ampm}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Date */}
      <div className="text-[2.8vw] font-light text-white/[0.60] tracking-wide">
        {format(now, 'EEEE, MMMM d, yyyy')}
      </div>

      {/* Store info */}
      <div
        className="flex items-center gap-3 text-[1.6vw] px-6 py-2 rounded-full mt-4"
        style={{ background: `${MG}15`, border: `1px solid ${MG}30` }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: MG, boxShadow: `0 0 8px ${MG}` }}
        />
        <span className="text-white/[0.70]">{companyName}</span>
        {storeNumber && (
          <>
            <span className="text-white/[0.20]">·</span>
            <span className="text-white/[0.50]">Store #{storeNumber}</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Slide: Weather ────────────────────────────────────────────────────────────
function WeatherSlide() {
  const { data, isLoading } = useWeather()
  const { fmt, unit } = useTempDisplay()

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-white/[0.30]">
          <div className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          <span className="text-xl">Loading weather…</span>
        </div>
      </div>
    )
  }

  const weatherData = data
  const cw = weatherData.current_weather
  const weather = getWeatherInfo(cw.weathercode, cw.is_day)
  const dailyHigh = weatherData.daily.temperature_2m_max[0]
  const dailyLow  = weatherData.daily.temperature_2m_min[0]

  return (
    <div className="flex h-full flex-col px-[5vw] pb-[4vh] pt-[5vh] gap-[3vh] select-none">
      <SlideHeader eyebrow="Local conditions" title="Weather Board" detail={format(new Date(), 'EEEE, MMM d')} />

      <div className="grid flex-1 grid-cols-[1.05fr_0.95fr] gap-[2vw] overflow-hidden">
        <div className="flex min-w-0 flex-col justify-between rounded-[1.3vw] border p-[2vw]" style={{ background: 'linear-gradient(135deg, rgba(54,209,220,0.18), rgba(255,255,255,0.045))', borderColor: `${CYAN}55` }}>
          <div className="flex items-start justify-between gap-[2vw]">
            <div>
              <div className="text-[1vw] font-bold uppercase tracking-[0.24em] text-white/[0.50]">Now</div>
              <div className="mt-[1vh] text-[2.4vw] font-black text-white">{weather.label}</div>
            </div>
            <span className="text-[7vw] leading-none">{weather.icon}</span>
          </div>

          <div>
            <div className="text-[10vw] font-black leading-none tabular-nums text-white">
              {fmt(cw.temperature)}<span className="text-[4vw] text-white/[0.50]">{unit}</span>
            </div>
            <div className="mt-[2vh] grid grid-cols-2 gap-[1vw]">
              <StatTile label="High" value={`${fmt(dailyHigh)}${unit}`} accent={MG2} />
              <StatTile label="Low" value={`${fmt(dailyLow)}${unit}`} accent={CYAN} />
            </div>
          </div>
        </div>

        <div className="grid grid-rows-5 gap-[1vh]">
          {weatherData.daily.time.slice(0, 5).map((d, i) => {
            const isToday = i === 0
            return (
              <div
                key={d}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[1vw] rounded-xl border px-[1.2vw]"
                style={{
                  background: isToday ? `${MG}18` : PANEL,
                  borderColor: isToday ? `${MG}55` : LINE,
                }}
              >
                <div className="text-[2.5vw] leading-none">{getWeatherInfo(weatherData.daily.weathercode[i]).icon}</div>
                <div className="min-w-0">
                  <div className="truncate text-[1.35vw] font-black text-white">{isToday ? 'Today' : format(new Date(d + 'T12:00'), 'EEEE')}</div>
                  <div className="text-[0.9vw] font-semibold text-white/[0.40]">{format(new Date(d + 'T12:00'), 'MMM d')}</div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-[1.35vw] font-black text-white">{fmt(weatherData.daily.temperature_2m_max[i])}{unit}</div>
                  <div className="text-[0.9vw] font-semibold text-white/[0.40]">{fmt(weatherData.daily.temperature_2m_min[i])}{unit}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-[6vw] select-none">
      {/* Current conditions */}
      <div className="flex items-center gap-[4vw]">
        <span className="text-[14vw] leading-none drop-shadow-2xl">{weather.icon}</span>
        <div className="flex flex-col gap-1">
          <div className="text-[10vw] font-black text-white leading-none tabular-nums">
            {fmt(cw.temperature)}<span className="text-[5vw] text-white/[0.50]">{unit}</span>
          </div>
          <div className="text-[2.2vw] font-medium text-white/[0.60]">{weather.label}</div>
          <div className="flex items-center gap-4 text-[1.5vw] mt-1">
            <span style={{ color: MG2 }}>↑ {fmt(dailyHigh)}{unit}</span>
            <span className="text-white/[0.40]">↓ {fmt(dailyLow)}{unit}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full max-w-4xl h-px" style={{ background: `linear-gradient(90deg, transparent, ${MG}40, transparent)` }} />

      {/* 5-day forecast */}
      <div className="flex items-center gap-6 w-full max-w-4xl justify-center">
        {weatherData.daily.time.slice(0, 5).map((d, i) => {
          const isToday = i === 0
          return (
            <div
              key={d}
              className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl flex-1"
              style={{
                background: isToday ? `${MG}18` : 'rgba(255,255,255,0.04)',
                border: isToday ? `1px solid ${MG}40` : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span className={`text-[1.3vw] font-semibold ${isToday ? '' : 'text-white/[0.50]'}`} style={isToday ? { color: MG } : {}}>
                {isToday ? 'Today' : format(new Date(d + 'T12:00'), 'EEE')}
              </span>
              <span className="text-[2.5vw] leading-none">{getWeatherInfo(weatherData.daily.weathercode[i]).icon}</span>
              <span className="text-[1.4vw] text-white font-medium">
                {fmt(weatherData.daily.temperature_2m_max[i])}{unit}
              </span>
              <span className="text-[1vw] text-white/[0.40]">
                {fmt(weatherData.daily.temperature_2m_min[i])}{unit}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Slide: Radar ──────────────────────────────────────────────────────────────
function RadarTileGrid({ lat, lon, frame, host, transitionMs }: { lat: number; lon: number; frame: RadarFrame; host: string; transitionMs: number }) {
  const baseCenterX = lonToTileX(lon, RADAR_BASEMAP_ZOOM)
  const baseCenterY = latToTileY(lat, RADAR_BASEMAP_ZOOM)
  const baseTileX = Math.floor(baseCenterX)
  const baseTileY = Math.floor(baseCenterY)
  const baseCols = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
  const baseRows = [-3, -2, -1, 0, 1, 2, 3]
  const baseTiles = baseRows.flatMap((dy) => baseCols.map((dx) => {
    const rawX = baseTileX + dx
    const rawY = baseTileY + dy
    const x = wrapTileX(rawX, RADAR_BASEMAP_ZOOM)
    const y = clampTileY(rawY, RADAR_BASEMAP_ZOOM)
    return {
      key: `${rawX}:${rawY}`,
      x,
      y,
      left: (rawX - baseCenterX) * RADAR_TILE_SIZE,
      top: (rawY - baseCenterY) * RADAR_TILE_SIZE,
    }
  }))
  const radarTiles = radarVisibleTiles(lat, lon)

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#09111a]" />
      {baseTiles.map((tile) => (
        <img
          key={`base:${tile.key}`}
          alt=""
          src={`https://a.basemaps.cartocdn.com/dark_all/${RADAR_BASEMAP_ZOOM}/${tile.x}/${tile.y}.png`}
          className="absolute max-w-none select-none"
          draggable={false}
          style={{
            left: `calc(50% + ${tile.left}px)`,
            top: `calc(50% + ${tile.top}px)`,
            width: RADAR_TILE_SIZE,
            height: RADAR_TILE_SIZE,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(7,9,15,0.08)_42%,rgba(7,9,15,0.48)_100%)]" />
      <AnimatePresence initial={false}>
        <motion.div
          key={frame.time}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.74 }}
          exit={{ opacity: 0 }}
          transition={{ duration: transitionMs / 1000, ease: 'linear' }}
          style={{ transform: `scale(${RADAR_VIEW_SCALE})`, transformOrigin: 'center', mixBlendMode: 'screen' }}
        >
          {radarTiles.map((tile) => (
            <img
              key={`radar:${frame.time}:${tile.key}`}
              alt=""
              src={radarTileUrl(host, frame.path, tile.x, tile.y)}
              className="absolute max-w-none select-none"
              draggable={false}
              style={{
                left: `calc(50% + ${tile.left}px)`,
                top: `calc(50% + ${tile.top}px)`,
                width: RADAR_TILE_SIZE,
                height: RADAR_TILE_SIZE,
              }}
            />
          ))}
        </motion.div>
      </AnimatePresence>
      <div className="absolute left-1/2 top-1/2 h-[1.2vw] w-[1.2vw] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.22vw] border-white bg-[var(--accent)] shadow-[0_0_0_0.45vw_rgba(226,0,116,0.22),0_0_2vw_rgba(226,0,116,0.85)]" />
      <div className="absolute left-1/2 top-1/2 h-[5vw] w-[5vw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
      <div className="absolute bottom-3 right-4 rounded-md bg-black/40 px-2 py-1 text-[0.62vw] font-semibold text-white/[0.50]">
        Radar: RainViewer | Map: CARTO
      </div>
    </div>
  )
}

function RadarSlide() {
  const { location } = useWeather()
  const { companyName, slideInterval } = useDisplayStore()
  const { timeFormat } = useUiStore()
  const [frameIndex, setFrameIndex] = useState(0)
  const [now, setNow] = useState(new Date())
  const { data, isLoading, isError } = useQuery({
    queryKey: ['rainviewer-maps'],
    queryFn: fetchRainViewerMaps,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })
  const frames = data?.radar?.past ?? []
  const frame = frames[frameIndex] ?? frames[frames.length - 1]
  const frameDelay = frames.length > 1
    ? Math.max(100, Math.floor((slideInterval * 1000) / (frames.length * 2)))
    : 800
  const frameTransitionMs = Math.min(700, Math.max(180, Math.floor(frameDelay * 0.85)))

  useEffect(() => {
    if (frames.length === 0) return
    setFrameIndex(frames.length - 1)
  }, [frames.length])

  useEffect(() => {
    if (frames.length <= 1) return
    const id = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length)
    }, frameDelay)
    return () => window.clearInterval(id)
  }, [frameDelay, frames.length])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!data?.host || frames.length <= 1) return
    const tiles = radarVisibleTiles(location.lat, location.lon)
    const nextFrames = [1, 2]
      .map((offset) => frames[(frameIndex + offset) % frames.length])
      .filter(Boolean)
    nextFrames.forEach((nextFrame) => {
      tiles.forEach((tile) => {
        const image = new Image()
        image.src = radarTileUrl(data.host, nextFrame.path, tile.x, tile.y)
      })
    })
  }, [data?.host, frameIndex, frames, location.lat, location.lon])

  const frameDate = frame ? new Date(frame.time * 1000) : null
  const clockFormat = timeFormat === '24' ? 'HH:mm' : 'h:mm a'

  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[4vh] pt-[5vh] gap-[2.5vh] select-none">
      <SlideHeader
        eyebrow="Live radar"
        title="Storm Tracker"
        detail={frameDate ? `${format(frameDate, 'h:mm a')} | ${RADAR_RADIUS_MILES} mi radius` : `${RADAR_RADIUS_MILES} mi radius`}
      />

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_21vw] gap-[2vw] overflow-hidden">
        <div className="relative min-w-0 overflow-hidden rounded-[1.4vw] border" style={{ background: 'rgba(0,0,0,0.24)', borderColor: `${CYAN}45` }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-[1.4vw] font-semibold text-white/[0.40]">Loading radar...</div>
          ) : isError || !data?.host || !frame ? (
            <div className="flex h-full flex-col items-center justify-center gap-[1vh] text-center">
              <div className="text-[1.6vw] font-black text-white/[0.75]">Radar unavailable</div>
              <div className="max-w-[34vw] text-[1vw] font-semibold text-white/[0.40]">RainViewer map data could not be loaded right now.</div>
            </div>
          ) : (
            <RadarTileGrid lat={location.lat} lon={location.lon} frame={frame} host={data.host} transitionMs={frameTransitionMs} />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-[1vh]">
          <div className="rounded-[1.1vw] border p-[1.35vw]" style={{ background: `linear-gradient(135deg, ${MG}18, rgba(255,255,255,0.045))`, borderColor: `${MG}4d` }}>
            <div className="text-[0.78vw] font-bold uppercase tracking-[0.22em] text-white/[0.40]">Centered on</div>
            <div className="mt-[0.8vh] text-[1.65vw] font-black leading-tight text-white">{companyName}</div>
            <div className="mt-[0.5vh] text-[0.9vw] font-semibold text-white/[0.50]">{location.name}</div>
          </div>
          <StatTile label="Current Date" value={format(now, 'MMM d')} accent={CYAN} />
          <StatTile label="Time Clock" value={format(now, clockFormat)} accent={GOLD} />
          <StatTile label="Local View" value="Central Florida" accent={MG2} />
          <div className="mt-auto rounded-[1.1vw] border p-[1.1vw] text-[0.85vw] font-semibold leading-relaxed text-white/[0.40]" style={{ background: PANEL, borderColor: LINE }}>
            Shows recent RainViewer radar imagery around the store area. The store marker stays fixed at center while the radar timeline loops.
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── Slide: Schedule ───────────────────────────────────────────────────────────
function ScheduleSlide() {
  const { employees, getShiftsForDate } = useScheduleStore()
  const [now, setNow] = useState(new Date())
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const shifts   = getShiftsForDate(todayStr)
  const sorted   = [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime))

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Font scale: fewer shifts = bigger text
  const scale = sorted.length <= 4 ? 1 : sorted.length <= 6 ? 0.85 : 0.72

  return (
    <div className="flex h-full flex-col px-[5vw] pb-[4vh] pt-[5vh] gap-[2.5vh] select-none">
      <SlideHeader eyebrow="Team coverage" title="Today's Schedule" detail={format(new Date(), 'EEEE, MMMM d')} />

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-[1.2vw] border text-[2vw] font-semibold text-white/[0.40]" style={{ borderColor: LINE, background: PANEL }}>
          No shifts scheduled today
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-[0.35fr_0.65fr] gap-[2vw] overflow-hidden">
          <div className="flex flex-col justify-between rounded-[1.2vw] border p-[1.5vw]" style={{ background: 'linear-gradient(135deg, rgba(226,0,116,0.16), rgba(255,255,255,0.045))', borderColor: `${MG}45` }}>
            <div>
              <div className="text-[0.9vw] font-bold uppercase tracking-[0.24em] text-white/[0.40]">Coverage</div>
              <div className="mt-[1vh] text-[6vw] font-black leading-none tabular-nums text-white">{sorted.length}</div>
              <div className="mt-[0.6vh] text-[1.2vw] font-semibold text-white/[0.50]">scheduled shifts</div>
            </div>
            <div className="grid gap-[1vh]">
              <StatTile label="First in" value={sorted[0]?.startTime ?? '--'} accent={GREEN} />
              <StatTile label="Last out" value={sorted[sorted.length - 1]?.endTime ?? '--'} accent={CYAN} />
            </div>
          </div>

          <div className="grid auto-rows-fr gap-[1vh] overflow-hidden">
            {sorted.map((s, index) => {
              const emp = employees.find((e) => e.id === s.employeeId)
              if (!emp) return null
              const initials = emp.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_15vw] items-center gap-[1.1vw] rounded-xl border px-[1.2vw]"
                  style={{
                    background: index === 0 ? hexToRgba(emp.color, 0.16) : PANEL,
                    borderColor: index === 0 ? hexToRgba(emp.color, 0.48) : LINE,
                  }}
                >
                  <div
                    className="flex h-[3.4vw] w-[3.4vw] items-center justify-center rounded-lg text-[1.1vw] font-black text-white"
                    style={{ background: emp.color }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[1.55vw] font-black text-white">{emp.name}</div>
                    <div className="mt-[0.2vh] flex items-center gap-[0.7vw] text-[0.9vw] font-semibold text-white/[0.50]">
                      <span>{emp.role}</span>
                      <span className="text-white/[0.20]">|</span>
                      <span>{s.type}</span>
                    </div>
                  </div>
                  <div className="w-[15vw] justify-self-end text-right">
                    <div className="whitespace-nowrap text-[1.55vw] font-black tabular-nums text-white">{formatShiftTime(s.startTime, s.endTime)}</div>
                    <div className="mt-[0.4vh] h-[0.45vh] w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${shiftProgressPercent(now, s.startTime, s.endTime)}%`, background: emp.color }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col items-center h-full pt-[4vh] pb-[3vh] px-[6vw] gap-4 select-none">
      {/* Header */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <h2
          className="font-black text-white tracking-tight leading-none"
          style={{ fontSize: `${scale * 3}vw` }}
        >
          Today's Schedule
        </h2>
        <p style={{ fontSize: `${scale * 1.3}vw`, color: MG }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/[0.30]">
          <span style={{ fontSize: '6vw' }}>📅</span>
          <span style={{ fontSize: '2vw' }}>No shifts scheduled today</span>
        </div>
      ) : (
        <div className="flex-1 w-full max-w-4xl flex flex-col gap-[1.2vh] overflow-hidden">
          {sorted.map((s) => {
            const emp = employees.find((e) => e.id === s.employeeId)
            if (!emp) return null
            const initials = emp.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

            return (
              <div
                key={s.id}
                className="flex items-center w-full rounded-2xl"
                style={{
                  padding: `${scale * 1.4}vh ${scale * 1.8}vw`,
                  background: hexToRgba(emp.color, 0.10),
                  border: `1px solid ${hexToRgba(emp.color, 0.25)}`,
                  borderLeft: `4px solid ${emp.color}`,
                  gap: `${scale * 1.2}vw`,
                }}
              >
                {/* Avatar */}
                <div
                  className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{
                    width: `${scale * 3.8}vw`,
                    height: `${scale * 3.8}vw`,
                    fontSize: `${scale * 1.3}vw`,
                    background: emp.color,
                    boxShadow: `0 0 ${scale * 12}px ${hexToRgba(emp.color, 0.45)}`,
                  }}
                >
                  {initials}
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold text-white whitespace-nowrap"
                    style={{ fontSize: `${scale * 1.8}vw` }}
                  >
                    {emp.name}
                  </div>
                  <div
                    className="text-white/[0.50] whitespace-nowrap"
                    style={{ fontSize: `${scale * 1.1}vw` }}
                  >
                    {emp.role}
                  </div>
                </div>

                {/* Time + type */}
                <div className="flex items-center gap-[0.8vw] flex-shrink-0">
                  <span
                    className="px-[0.8vw] py-[0.3vw] rounded-full font-semibold"
                    style={{
                      fontSize: `${scale * 0.95}vw`,
                      background: hexToRgba(emp.color, 0.2),
                      color: emp.color,
                    }}
                  >
                    {s.type}
                  </span>
                  <span
                    className="font-bold text-white tabular-nums whitespace-nowrap"
                    style={{ fontSize: `${scale * 1.8}vw` }}
                  >
                    {formatShiftTime(s.startTime, s.endTime)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Slide: Schedule Outlook ───────────────────────────────────────────────────
function ScheduleOutlookSlide() {
  const { employees, getShiftsForDate } = useScheduleStore()
  const { data: weatherData } = useWeather()
  const { fmt, unit } = useTempDisplay()

  const days = [1, 2, 3, 4].map((offset) => {
    const date    = addDays(new Date(), offset)
    const dateStr = format(date, 'yyyy-MM-dd')
    const shifts  = [...getShiftsForDate(dateStr)].sort((a, b) => a.startTime.localeCompare(b.startTime))
    const forecastIndex = weatherData?.daily.time.findIndex((day) => day === dateStr) ?? -1
    const forecast = weatherData && forecastIndex >= 0
      ? {
          icon: getWeatherInfo(weatherData.daily.weathercode[forecastIndex]).icon,
          high: fmt(weatherData.daily.temperature_2m_max[forecastIndex]),
        }
      : null
    return {
      label:    offset === 1 ? 'Tomorrow' : format(date, 'EEEE'),
      sublabel: format(date, 'MMM d'),
      forecast,
      shifts,
    }
  })

  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[3.5vh] pt-[5vh] gap-[2.2vh] select-none">
      <SlideHeader eyebrow="Staffing outlook" title="Schedule Outlook" detail="Next 4 days" />

      {/* 4-column grid */}
      <div className="flex-1 grid grid-cols-4 gap-[1.5vw] overflow-hidden">
        {days.map(({ label, sublabel, forecast, shifts }, i) => (
          <div
            key={i}
            className="flex flex-col gap-[1vh] rounded-[1.4vw] p-[1.2vw] shadow-[inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
            style={{
              background: i === 0 ? `linear-gradient(180deg, ${MG}18, rgba(255,255,255,0.07))` : PANEL,
              border: `1px solid ${i === 0 ? `${MG}45` : LINE}`,
            }}
          >
            {/* Day header */}
            <div
              className="flex-shrink-0 border-b pb-[0.8vh]"
              style={{ borderColor: i === 0 ? `${MG}30` : 'rgba(255,255,255,0.08)' }}
            >
              <div className="font-black text-[1.6vw]" style={{ color: i === 0 ? CYAN : 'white' }}>
                {label}
              </div>
              <div className="flex items-center gap-[0.45vw] text-[1vw] text-white/[0.40]">
                <span>{sublabel}</span>
                {forecast && (
                  <>
                    <span className="text-white/[0.20]">·</span>
                    <span className="text-[1.05vw] leading-none">{forecast.icon}</span>
                    <span className="tabular-nums">{forecast.high}{unit}</span>
                  </>
                )}
              </div>
            </div>

            {/* Shifts */}
            {shifts.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[1.1vw] text-white/[0.25]">No shifts</span>
              </div>
            ) : (
              <div className="flex flex-col gap-[0.6vh] overflow-hidden flex-1">
                {shifts.map((s) => {
                  const emp = employees.find((e) => e.id === s.employeeId)
                  if (!emp) return null
                  const initials = emp.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-[0.6vw] rounded-[0.9vw] px-[0.8vw] py-[0.5vh]"
                      style={{
                        background: hexToRgba(emp.color, 0.10),
                        border: `1px solid ${hexToRgba(emp.color, 0.18)}`,
                        borderLeft: `3px solid ${emp.color}`,
                      }}
                    >
                      <div
                        className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{
                          width: '2vw', height: '2vw', fontSize: '0.75vw',
                          background: emp.color,
                          boxShadow: `0 0 8px ${hexToRgba(emp.color, 0.4)}`,
                        }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold truncate" style={{ fontSize: '0.95vw' }}>
                          {emp.name}
                        </div>
                        <div className="text-white/[0.40] tabular-nums" style={{ fontSize: '0.8vw' }}>
                          {formatShiftTime(s.startTime, s.endTime)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slide: District Outlook ───────────────────────────────────────────────────
function DistrictOutlookSlide() {
  const { data, isLoading } = useQuery({
    queryKey: ['display-performance-source'],
    queryFn: fetchPerformanceData,
    staleTime: 55_000,
    refetchInterval: 60_000,
  })
  const rows = performanceRows(data?.rows ?? [])
    .sort((a, b) => b.netRevenue - a.netRevenue)
    .slice(0, 5)

  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[3vh] pt-[5vh] gap-[2.2vh] select-none">
      <SlideHeader eyebrow="Source live" title="District Outlook" detail="Top 5 by Net Revenue" />

      <div className="flex-1 w-full max-w-6xl overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-[1.5vw] text-white/[0.30]">Loading outlook…</div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[1.5vw] text-white/[0.30]">No Source rows available</div>
        ) : (
          <div className="grid h-full grid-rows-5 gap-[1vh]">
            {rows.map((row, index) => {
              const dealer = dealerInfoForRow(row)

              return (
                <div
                  key={row.store}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-[1.2vw] rounded-xl px-[1.4vw] py-[1vh]"
                  style={{
                    background: index === 0 ? `linear-gradient(90deg, ${MG}24, ${PANEL})` : PANEL,
                    border: `1px solid ${index === 0 ? `${MG}55` : LINE}`,
                  }}
                >
                  <div
                    className="flex h-[3.2vw] w-[3.2vw] items-center justify-center rounded-lg text-[1.4vw] font-black text-white"
                    style={{ background: index === 0 ? MG : PANEL_STRONG }}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[1.55vw] font-black text-white">{dealer.nickname}</div>
                    <div className="text-[0.95vw] text-white/[0.40]">{dealer.location} | {dealer.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[1.5vw] font-black text-white tabular-nums">{formatMoney(row.netRevenue)}</div>
                    <div className="text-[0.85vw]" style={{ color: row.netRevenuePct >= 100 ? GREEN : 'rgba(255,255,255,0.45)' }}>
                      {row.netRevenuePct >= 100 ? 'Goal Met' : `${Math.round(row.netRevenuePct)}% to goal`}
                    </div>
                  </div>
                  <div className="grid min-w-[14vw] grid-cols-3 gap-[0.5vw] text-center">
                    <div className="rounded-md px-[0.6vw] py-[0.45vh]" style={{ background: 'rgba(0,0,0,0.22)' }}>
                      <div className="text-[0.7vw] uppercase text-white/[0.30]">ACC</div>
                      <div className="text-[0.95vw] font-bold text-white">{formatMoney(row.accessoryRevenue)}</div>
                    </div>
                    <div className="rounded-md px-[0.6vw] py-[0.45vh]" style={{ background: 'rgba(0,0,0,0.22)' }}>
                      <div className="text-[0.7vw] uppercase text-white/[0.30]">PP</div>
                      <div className="text-[0.95vw] font-bold text-white">{formatNumber(row.totalPp)}</div>
                    </div>
                    <div className="rounded-md px-[0.6vw] py-[0.45vh]" style={{ background: 'rgba(0,0,0,0.22)' }}>
                      <div className="text-[0.7vw] uppercase text-white/[0.30]">Traffic</div>
                      <div className="text-[0.95vw] font-bold text-white">{formatNumber(row.traffic)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Slide: Announcements ──────────────────────────────────────────────────────
type LeaderboardMetric = {
  title: string
  subtitle: string
  metricLabel: string
  eyebrow?: string
  accent?: string
  value: (row: PerformanceRow) => number
  goalValue?: (row: PerformanceRow) => number
  progress?: (row: PerformanceRow) => number
  detail?: (row: PerformanceRow) => string
  formatValue: (value: number) => string
}

function PerformanceLeaderboardSlide({ metric }: { metric: LeaderboardMetric }) {
  const { data, isLoading } = useQuery({
    queryKey: ['display-performance-source'],
    queryFn: fetchPerformanceData,
    staleTime: 55_000,
    refetchInterval: 60_000,
  })
  const rows = performanceRows(data?.rows ?? [])
    .sort((a, b) => metric.value(b) - metric.value(a))
    .slice(0, 5)
  const accent = metric.accent ?? MG
  const leader = rows[0]
  const leaderDealer = leader ? dealerInfoForRow(leader) : null
  const leaderProgress = leader ? metric.progress?.(leader) : undefined
  const runnerUps = rows.slice(1)

  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[3.5vh] pt-[5vh] gap-[2.2vh] select-none">
      <SlideHeader eyebrow={metric.eyebrow ?? 'Leaderboard'} title={metric.title} detail={metric.subtitle} />

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-[1.5vw] text-white/[0.30]">Loading leaderboard...</div>
        ) : !leader || !leaderDealer ? (
          <div className="flex h-full items-center justify-center text-[1.5vw] text-white/[0.30]">No Source rows available</div>
        ) : (
          <div className="grid h-full grid-cols-[1.08fr_0.92fr] gap-[2vw]">
            <div className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-[1.4vw] border p-[2vw]" style={{ background: `linear-gradient(135deg, ${accent}26, rgba(255,255,255,0.055))`, borderColor: `${accent}66` }}>
              <div className="absolute right-[-2vw] top-[-3vh] text-[14vw] font-black leading-none text-white/[0.035]">01</div>
              <div className="relative">
                <div className="inline-flex rounded-full border px-[0.8vw] py-[0.42vh] text-[0.9vw] font-black uppercase tracking-[0.14em] text-white shadow-[inset_0_1px_rgba(255,255,255,0.14)]" style={{ background: `${accent}26`, borderColor: `${accent}66`, color: accent }}>
                  Current leader
                </div>
                <div className="mt-[2vh] text-[4.7vw] font-black leading-[0.92] text-white">{leaderDealer.nickname}</div>
                <div className="mt-[1vh] text-[1.25vw] font-semibold text-white/[0.50]">{leaderDealer.location} | {leaderDealer.code}</div>
              </div>

              <div className="relative">
                <div className="text-[6vw] font-black leading-none tabular-nums text-white">{metric.formatValue(metric.value(leader))}</div>
                <div className="mt-[0.8vh] text-[1.05vw] font-semibold" style={{ color: goalState(leaderProgress)?.color ?? 'rgba(255,255,255,0.48)' }}>
                  {goalState(leaderProgress)?.label ?? metric.metricLabel}
                </div>
                {leaderProgress !== undefined && (
                  <div className="mt-[1.3vh]">
                    <ProgressBar value={leaderProgress} accent={accent} />
                  </div>
                )}
                <div className="mt-[1.4vh] grid grid-cols-3 gap-[0.8vw]">
                  <StatTile label="NR" value={formatPercent(leader.netRevenuePct)} accent={MG} />
                  <StatTile label="ACC" value={formatPercent(leader.accessoryPct)} accent={GOLD} />
                  <StatTile label="PP" value={formatPercent(leader.ppPct)} accent={GREEN} />
                </div>
              </div>
            </div>

            <div className="grid grid-rows-4 gap-[1vh] overflow-hidden">
              {runnerUps.map((row, idx) => {
                const dealer = dealerInfoForRow(row)
                const progress = metric.progress?.(row)
                return (
                  <div
                    key={row.store}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[1vw] rounded-xl border px-[1.1vw]"
                    style={{ background: PANEL, borderColor: LINE }}
                  >
                    <div className="flex h-[3vw] w-[3vw] items-center justify-center rounded-lg text-[1.15vw] font-black text-white" style={{ background: PANEL_STRONG }}>
                      {idx + 2}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[1.35vw] font-black text-white">{dealer.nickname}</div>
                      <div className="mt-[0.2vh] truncate text-[0.82vw] font-semibold text-white/[0.40]">{metric.detail?.(row) ?? dealer.code}</div>
                    </div>
                    <div className="min-w-[10vw] text-right">
                      <div className="text-[1.55vw] font-black tabular-nums text-white">{metric.formatValue(metric.value(row))}</div>
                      {progress !== undefined && <div className="mt-[0.45vh]"><ProgressBar value={progress} accent={accent} /></div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[3vh] pt-[5vh] gap-[2.2vh] select-none">
      <SlideHeader eyebrow={metric.eyebrow ?? 'Leaderboard'} title={metric.title} detail={metric.subtitle} />

      <div className="flex-1 w-full max-w-6xl overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-[1.5vw] text-white/[0.30]">Loading leaderboard...</div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[1.5vw] text-white/[0.30]">No Source rows available</div>
        ) : (
          <div className="grid h-full grid-rows-5 gap-[1vh]">
            {rows.map((row, index) => {
              const progress = metric.progress?.(row)
              const goal = metric.goalValue?.(row)
              const dealer = dealerInfoForRow(row)

              return (
                <div
                  key={row.store}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[1.35vw] rounded-xl px-[1.4vw] py-[1vh]"
                  style={{
                    background: index === 0 ? `linear-gradient(90deg, ${accent}24, ${PANEL})` : PANEL,
                    border: `1px solid ${index === 0 ? `${accent}55` : LINE}`,
                  }}
                >
                  <div
                    className="flex h-[3.5vw] w-[3.5vw] items-center justify-center rounded-lg text-[1.45vw] font-black text-white"
                    style={{ background: index === 0 ? accent : PANEL_STRONG }}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[1.7vw] font-black text-white">{dealer.nickname}</div>
                    <div className="mt-[0.25vh] flex items-center gap-[0.7vw] text-[0.95vw] text-white/[0.50]">
                      <span>{dealer.location}</span>
                      <span className="text-white/[0.20]">|</span>
                      <span>{dealer.code}</span>
                      <span className="text-white/[0.20]">|</span>
                      <span>{metric.detail?.(row) ?? `Traffic ${formatNumber(row.traffic)}`}</span>
                    </div>
                  </div>
                  <div className="min-w-[18vw] text-right">
                    <div className="text-[2.2vw] font-black text-white tabular-nums">{metric.formatValue(metric.value(row))}</div>
                    <div className="mt-[0.3vh] text-[0.85vw]" style={{ color: goalState(progress)?.color ?? 'rgba(255,255,255,0.45)' }}>
                      {goalState(progress)?.label ?? metric.metricLabel}
                    </div>
                    {goal !== undefined && goal > 0 && (
                      <div className="mt-[0.55vh] h-[0.55vh] overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(progress ?? 0, 100)}%`, background: accent }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function PostPaidLeaderboardSlide() {
  return (
    <PerformanceLeaderboardSlide
      metric={{
        title: 'Post Paid Leaderboard',
        subtitle: 'Top 5 by Post Paid Activations',
        metricLabel: 'PP Activations',
        eyebrow: 'Activation pace',
        accent: GREEN,
        value: (row) => row.totalPp,
        goalValue: (row) => row.dortGoal,
        progress: (row) => row.ppPct,
        detail: (row) => `PP ${formatPercent(row.ppPct)} | Traffic ${formatNumber(row.traffic)}`,
        formatValue: formatNumber,
      }}
    />
  )
}

function OverallLeaderboardSlide() {
  return (
    <PerformanceLeaderboardSlide
      metric={{
        title: 'Overall Leaderboard',
        subtitle: 'Net Rev + ACC + PP goal pace',
        metricLabel: 'Blended score',
        eyebrow: 'District ranking',
        accent: CYAN,
        value: overallScore,
        progress: overallScore,
        detail: (row) => `NR ${formatPercent(row.netRevenuePct)} | ACC ${formatPercent(row.accessoryPct)} | PP ${formatPercent(row.ppPct)}`,
        formatValue: formatPercent,
      }}
    />
  )
}

function AccessoriesLeaderboardSlide() {
  return (
    <PerformanceLeaderboardSlide
      metric={{
        title: 'Accessories Leaderboard',
        subtitle: 'Top 5 by Accessory Revenue',
        metricLabel: "Acc's",
        eyebrow: 'Attach performance',
        accent: GOLD,
        value: (row) => row.accessoryRevenue,
        goalValue: (row) => row.accessoryGoal,
        progress: (row) => row.accessoryPct,
        detail: (row) => `ACC ${formatPercent(row.accessoryPct)} | NR ${formatMoney(row.netRevenue)}`,
        formatValue: formatMoney,
      }}
    />
  )
}

function CommissionSnapshotSlide() {
  const { storeId } = useUiStore()
  const snapshots = useCommissionSnapshotStore((s) => s.snapshots)
  const rows = latestCommissionRows(snapshots, storeId)
  const snapshotDate = rows[0]?.snapshotDate

  const totals = rows.reduce((acc, row) => ({
    commission: acc.commission + row.commission,
    opportunity: acc.opportunity + row.commissionOpportunity,
    accessories: acc.accessories + row.accessories,
    accessoryGoal: acc.accessoryGoal + row.accessoryGoal,
    revenue: acc.revenue + row.revenue,
    revenueGoal: acc.revenueGoal + row.revenueGoal,
    voiceLines: acc.voiceLines + row.voiceLines,
    voiceLinesGoal: acc.voiceLinesGoal + row.voiceLinesGoal,
    bts: acc.bts + row.bts,
    btsGoal: acc.btsGoal + row.btsGoal,
    vaf: acc.vaf + row.vaf,
    vafGoal: acc.vafGoal + row.vafGoal,
  }), {
    commission: 0,
    opportunity: 0,
    accessories: 0,
    accessoryGoal: 0,
    revenue: 0,
    revenueGoal: 0,
    voiceLines: 0,
    voiceLinesGoal: 0,
    bts: 0,
    btsGoal: 0,
    vaf: 0,
    vafGoal: 0,
  })

  const capture = ratioPercent(totals.commission, totals.opportunity)
  const openOpportunity = Math.max(totals.opportunity - totals.commission, 0)
  const topRows = rows.slice(0, 5)
  const goalTiles = [
    { label: 'Accessory', value: formatMoney(totals.accessories), progress: ratioPercent(totals.accessories, totals.accessoryGoal), accent: GOLD },
    { label: 'Revenue', value: formatMoney(totals.revenue), progress: ratioPercent(totals.revenue, totals.revenueGoal), accent: CYAN },
    { label: 'Voice', value: formatNumber(totals.voiceLines), progress: ratioPercent(totals.voiceLines, totals.voiceLinesGoal), accent: GREEN },
    { label: 'BTS', value: formatNumber(totals.bts), progress: ratioPercent(totals.bts, totals.btsGoal), accent: MG2 },
  ]

  return (
    <div className="flex h-full flex-col gap-[2.4vh] px-[5vw] pb-[4vh] pt-[5vh] select-none">
      <SlideHeader
        eyebrow="Commission snapshot"
        title="Team Earnings Board"
        detail={snapshotDate ? format(new Date(`${snapshotDate}T12:00:00`), 'MMM d, yyyy') : 'Latest snapshot'}
      />

      <div className="grid flex-1 grid-cols-[0.95fr_1.05fr] gap-[2vw] overflow-hidden">
        <div className="relative flex min-w-0 flex-col overflow-hidden rounded-[1.8vw] border p-[2.25vw] shadow-[0_3vh_8vh_rgba(0,0,0,0.30)] backdrop-blur-2xl" style={{ background: 'linear-gradient(145deg, rgba(0,122,255,0.26), rgba(255,255,255,0.075))', borderColor: 'rgba(100,210,255,0.28)' }}>
          <div className="absolute right-[-7vw] top-[-10vh] h-[30vw] w-[30vw] rounded-full opacity-35 blur-[5vw]" style={{ background: CYAN }} />
          <div className="absolute bottom-[-12vh] left-[-8vw] h-[25vw] w-[25vw] rounded-full opacity-25 blur-[5vw]" style={{ background: GREEN }} />

          <div className="relative flex items-center gap-[1vw]">
            <div className="flex h-[4.2vw] w-[4.2vw] items-center justify-center rounded-[1.2vw] border text-white shadow-[inset_0_1px_rgba(255,255,255,0.18)]" style={{ background: 'rgba(255,255,255,0.13)', borderColor: LINE }}>
              <BadgeDollarSign size="2.25vw" strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-[0.85vw] font-black uppercase tracking-[0.16em] text-white/[0.48]">Team commission</div>
              <div className="text-[1.1vw] font-semibold text-white/[0.58]">{rows.length} reps on latest snapshot</div>
            </div>
          </div>

          <div className="relative mt-[4vh]">
            <div className="text-[7vw] font-black leading-none tabular-nums text-white drop-shadow-[0_1.6vh_3vh_rgba(0,0,0,0.24)]">
              {formatMoney(totals.commission)}
            </div>
            <div className="mt-[1.4vh] grid grid-cols-2 gap-[1vw]">
              <div className="rounded-[1.2vw] border p-[1.2vw]" style={{ background: 'rgba(0,0,0,0.18)', borderColor: 'rgba(255,255,255,0.14)' }}>
                <div className="text-[0.82vw] font-black uppercase tracking-[0.14em] text-white/[0.38]">Capture</div>
                <div className="mt-[0.45vh] text-[2.2vw] font-black tabular-nums" style={{ color: capture >= 100 ? GREEN : GOLD }}>{formatPercent(capture)}</div>
                <div className="mt-[0.8vh]"><ProgressBar value={capture} accent={capture >= 100 ? GREEN : GOLD} /></div>
              </div>
              <div className="rounded-[1.2vw] border p-[1.2vw]" style={{ background: 'rgba(0,0,0,0.18)', borderColor: 'rgba(255,255,255,0.14)' }}>
                <div className="text-[0.82vw] font-black uppercase tracking-[0.14em] text-white/[0.38]">Open opp</div>
                <div className="mt-[0.45vh] text-[2.2vw] font-black tabular-nums text-white">{formatMoney(openOpportunity)}</div>
                <div className="mt-[0.8vh] text-[0.9vw] font-semibold text-white/[0.44]">Opportunity {formatMoney(totals.opportunity)}</div>
              </div>
            </div>
          </div>

          <div className="relative mt-auto grid grid-cols-2 gap-[0.85vw]">
            {goalTiles.map((tile) => (
              <div key={tile.label} className="rounded-[1vw] border px-[1vw] py-[1vh]" style={{ background: 'rgba(255,255,255,0.075)', borderColor: `${tile.accent}38` }}>
                <div className="flex items-center justify-between gap-[0.6vw]">
                  <div className="text-[0.78vw] font-black uppercase tracking-[0.12em] text-white/[0.42]">{tile.label}</div>
                  <div className="text-[0.86vw] font-black tabular-nums" style={{ color: tile.accent }}>{formatPercent(tile.progress)}</div>
                </div>
                <div className="mt-[0.4vh] text-[1.25vw] font-black tabular-nums text-white">{tile.value}</div>
                <div className="mt-[0.65vh]"><ProgressBar value={tile.progress} accent={tile.accent} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col overflow-hidden rounded-[1.8vw] border p-[1.6vw] shadow-[inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl" style={{ background: PANEL, borderColor: LINE }}>
          <div className="mb-[1.4vh] flex items-center justify-between gap-[1vw]">
            <div>
              <div className="text-[0.9vw] font-black uppercase tracking-[0.16em]" style={{ color: CYAN }}>Top earners</div>
              <div className="mt-[0.4vh] text-[1vw] font-semibold text-white/[0.45]">Ranked by current commission</div>
            </div>
            <div className="flex items-center gap-[0.55vw] rounded-full border px-[1vw] py-[0.65vh] text-[0.9vw] font-black text-white/[0.70]" style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}>
              <Target size="1vw" />
              Live snapshot
            </div>
          </div>

          <div className="grid flex-1 gap-[1vh] overflow-hidden">
            {topRows.map((row, index) => {
              const rowCapture = ratioPercent(row.commission, row.commissionOpportunity)
              const accent = index === 0 ? GOLD : index === 1 ? CYAN : index === 2 ? GREEN : MG2
              return (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.07 }}
                  className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[1vw] rounded-[1.25vw] border px-[1.2vw] py-[1.15vh] shadow-[inset_0_1px_rgba(255,255,255,0.10)]"
                  style={{ background: `linear-gradient(90deg, ${accent}18, rgba(255,255,255,0.07))`, borderColor: `${accent}38` }}
                >
                  <div className="flex h-[3vw] w-[3vw] items-center justify-center rounded-[0.85vw] text-[1.2vw] font-black text-white" style={{ background: `${accent}55`, boxShadow: `0 0 1.2vw ${accent}25` }}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[1.75vw] font-black leading-tight text-white">{row.employeeName}</div>
                    <div className="mt-[0.45vh] flex items-center gap-[0.8vw] text-[0.86vw] font-semibold text-white/[0.45]">
                      <span>Capture {formatPercent(rowCapture)}</span>
                      <span className="text-white/[0.18]">|</span>
                      <span>Open {formatMoney(Math.max(row.commissionOpportunity - row.commission, 0))}</span>
                    </div>
                    <div className="mt-[0.65vh]"><ProgressBar value={rowCapture} accent={accent} /></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[2vw] font-black tabular-nums text-white">{formatMoney(row.commission)}</div>
                    <div className="mt-[0.35vh] text-[0.82vw] font-black uppercase tracking-[0.12em]" style={{ color: accent }}>Commission</div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function AnnouncementsSlide() {
  const { announcements } = useDisplayStore()
  const activeAnnouncements = announcements.filter((announcement) => isAnnouncementActive(announcement))
  const PCOLS = { normal: MG, important: GOLD, urgent: '#FF453A' }

  return (
    <div className="flex h-full flex-col px-[5vw] pb-[4vh] pt-[5vh] gap-[2.4vh] select-none">
      <SlideHeader eyebrow="Store messages" title="Announcements" detail={`${activeAnnouncements.length} active`} />

      <div className="flex flex-1 flex-col gap-[1.2vh] overflow-y-auto no-scrollbar">
        {activeAnnouncements.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-[1vh] rounded-[1.6vw] border text-white/[0.30] backdrop-blur-2xl" style={{ background: PANEL, borderColor: LINE }}>
            <span className="text-[4vw]">•</span>
            <span className="text-[1.7vw] font-semibold">No announcements</span>
          </div>
        ) : (
          activeAnnouncements.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-[1.1vw] rounded-[1.4vw] border px-[1.6vw] py-[1.7vh] shadow-[inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
              style={{
                background: `linear-gradient(90deg, ${PCOLS[a.priority]}18, rgba(255,255,255,0.075))`,
                borderColor: `${PCOLS[a.priority]}40`,
              }}
            >
              <div
                className="mt-[0.45vw] h-[1.1vw] w-[1.1vw] flex-shrink-0 rounded-full"
                style={{ background: PCOLS[a.priority], boxShadow: `0 0 10px ${PCOLS[a.priority]}80` }}
              />
              <div className="min-w-0">
                <div className="mb-[0.45vh] text-[0.78vw] font-black uppercase tracking-[0.14em]" style={{ color: PCOLS[a.priority] }}>{a.priority}</div>
                <p className="text-[2vw] text-white leading-snug">{a.text}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Slide registry ────────────────────────────────────────────────────────────
const SLIDES: DisplaySlideConfig[] = [
  { key: 'clock',    label: 'Clock',         component: ClockSlide },
  { key: 'pulse',    label: 'Pulse',         component: StorePulseSlide },
  { key: 'weather',  label: 'Weather',        component: WeatherSlide },
  { key: 'commission', label: 'Commission',    component: CommissionSnapshotSlide, shouldShow: ({ hasCommissionSnapshot }) => hasCommissionSnapshot },
  { key: 'radar',    label: 'Radar',          component: RadarSlide },
  { key: 'sched',    label: 'Schedule',       component: ScheduleSlide, shouldShow: ({ hasTodaySchedule }) => hasTodaySchedule },
  { key: 'outlook',  label: 'Outlook',        component: ScheduleOutlookSlide, shouldShow: ({ hasScheduleOutlook }) => hasScheduleOutlook },
  { key: 'district', label: 'District',       component: DistrictOutlookSlide },
  { key: 'overall',  label: 'Overall',        component: OverallLeaderboardSlide },
  { key: 'pp',       label: 'PP',             component: PostPaidLeaderboardSlide },
  { key: 'acc',      label: "Acc's",          component: AccessoriesLeaderboardSlide },
  { key: 'announce', label: 'Announcements',  component: AnnouncementsSlide, shouldShow: ({ hasAnnouncements }) => hasAnnouncements },
]

// ── Display shell ─────────────────────────────────────────────────────────────
export function DisplayPage() {
  const { accessMode, clearStoreSession, setTab } = useUiStore()
  const { isFullscreen, enter: enterFs, exit: exitFs } = useFullscreen()
  const { slideInterval, companyName, storeNumber } = useDisplayStore()
  const shifts = useScheduleStore((s) => s.shifts)
  const snapshots = useCommissionSnapshotStore((s) => s.snapshots)
  const announcements = useDisplayStore((s) => s.announcements)
  const storeId = useUiStore((s) => s.storeId)
  const [slideIdx, setSlideIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slideAvailability = useMemo<SlideAvailability>(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const outlookDates = new Set([1, 2, 3, 4].map((offset) => format(addDays(new Date(), offset), 'yyyy-MM-dd')))
    return {
      hasTodaySchedule: shifts.some((shift) => shift.date === today),
      hasScheduleOutlook: shifts.some((shift) => outlookDates.has(shift.date)),
      hasAnnouncements: announcements.some((announcement) => isAnnouncementActive(announcement)),
      hasCommissionSnapshot: latestCommissionRows(snapshots, storeId).length > 0,
    }
  }, [announcements, shifts, snapshots, storeId])
  const visibleSlides = useMemo(() => (
    SLIDES.filter((slide) => slide.shouldShow?.(slideAvailability) ?? true)
  ), [slideAvailability])
  const slideCount = visibleSlides.length

  const prev = useCallback(() => setSlideIdx((i) => (i - 1 + slideCount) % slideCount), [slideCount])
  const next = useCallback(() => setSlideIdx((i) => (i + 1) % slideCount), [slideCount])
  const restartDisplay = useCallback(() => {
    exitFs()
    if (accessMode === 'display') {
      window.location.reload()
      return
    }
    setTab('home')
  }, [accessMode, exitFs, setTab])
  const logoutDisplay = useCallback(() => {
    exitFs()
    clearStoreSession()
  }, [clearStoreSession, exitFs])

  useEffect(() => {
    if (slideIdx >= slideCount) setSlideIdx(0)
  }, [slideCount, slideIdx])

  useEffect(() => {
    if (paused || slideCount <= 1) return
    const id = setInterval(next, slideInterval * 1000)
    return () => clearInterval(id)
  }, [paused, slideCount, slideInterval, next])

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  useEffect(() => {
    resetHideTimer()
    window.addEventListener('mousemove', resetHideTimer)
    window.addEventListener('keydown', resetHideTimer)
    return () => {
      window.removeEventListener('mousemove', resetHideTimer)
      window.removeEventListener('keydown', resetHideTimer)
    }
  }, [resetHideTimer])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'Escape')     restartDisplay()
      if (e.key === ' ')          setPaused((p) => !p)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, restartDisplay])

  const Slide = visibleSlides[slideIdx]?.component ?? ClockSlide

  return (
    <div
      className="relative w-screen h-screen overflow-hidden cursor-none"
      style={{ background: '#05060A' }}
      onMouseMove={resetHideTimer}
    >
      {/* Broadcast backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: [
              'radial-gradient(circle at 18% 12%, rgba(0,122,255,0.32), transparent 30%)',
              'radial-gradient(circle at 82% 18%, rgba(48,209,88,0.16), transparent 30%)',
              'radial-gradient(circle at 52% 105%, rgba(100,210,255,0.18), transparent 42%)',
              'linear-gradient(180deg, rgba(255,255,255,0.045), transparent 46%)',
            ].join(', '),
          }}
        />
        <div
          className="absolute inset-x-[-10%] bottom-[-30%] h-[60%] rotate-[-4deg]"
          style={{ background: 'linear-gradient(90deg, rgba(0,122,255,0.15), rgba(100,210,255,0.1), transparent)', filter: 'blur(44px)' }}
        />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.76) 100%)' }} />
      </div>

      {/* Thin top line accent */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 z-10"
        style={{ background: `linear-gradient(90deg, ${MG}, ${CYAN}, ${GREEN})` }}
      />

      {/* Slide content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={visibleSlides[slideIdx]?.key ?? 'clock'}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <Slide />
        </motion.div>
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Top bar */}
            <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-5 pointer-events-auto">
              {/* Brand */}
              <div className="flex items-center gap-2.5 rounded-full border px-3 py-2 shadow-[inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl" style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black"
                  style={{ background: `linear-gradient(135deg, ${MG}, ${CYAN})` }}
                >
                  L
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-white text-xs font-semibold">
                    {companyName}
                    {storeNumber && <span className="text-white/[0.40] font-normal"> · #{storeNumber}</span>}
                  </span>
                  <span className="text-[10px]" style={{ color: CYAN }}>Live Display</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-white/[0.70] text-xs transition-colors hover:text-white cursor-auto backdrop-blur-2xl"
                  style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}
                >
                  {paused ? <Play size={11} /> : <Pause size={11} />}
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={() => isFullscreen ? exitFs() : enterFs()}
                  className="p-2 rounded-full border text-white/[0.70] hover:text-white transition-colors cursor-auto backdrop-blur-2xl"
                  style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}
                >
                  {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
                </button>
                <button
                  onClick={restartDisplay}
                  className="p-2 rounded-full border text-white/[0.70] hover:text-white transition-colors cursor-auto backdrop-blur-2xl"
                  style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}
                  title={accessMode === 'display' ? 'Reload display' : 'Exit display'}
                >
                  <X size={13} />
                </button>
                {accessMode === 'display' && (
                  <button
                    onClick={logoutDisplay}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-white/[0.70] text-xs transition-colors hover:text-white cursor-auto backdrop-blur-2xl"
                    style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}
                    title="Log out"
                  >
                    <LogOut size={11} />
                    Logout
                  </button>
                )}
              </div>
            </div>

            {/* Side nav arrows */}
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border p-2.5 text-white/[0.60] hover:text-white transition-all cursor-auto backdrop-blur-2xl"
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border p-2.5 text-white/[0.60] hover:text-white transition-all cursor-auto backdrop-blur-2xl"
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: LINE }}
            >
              <ChevronRight size={22} />
            </button>

            {/* Bottom: indicators */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-5 gap-2.5 pointer-events-auto">
              <div className="flex items-end gap-3">
                {visibleSlides.map((s, i) => {
                  const active = i === slideIdx
                  return (
                    <button
                      key={s.key}
                      onClick={() => setSlideIdx(i)}
                      className="flex flex-col items-center gap-1.5 cursor-auto"
                    >
                      <span
                        className="text-[10px] font-medium transition-colors"
                        style={{ color: active ? 'white' : 'rgba(255,255,255,0.25)' }}
                      >
                        {s.label}
                      </span>
                      <div
                        className="rounded-full overflow-hidden transition-all"
                        style={{
                          width: active ? 44 : 18,
                          height: 3,
                          background: 'rgba(255,255,255,0.12)',
                        }}
                      >
                        {active && !paused && (
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${MG}, ${CYAN})` }}
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: slideInterval, ease: 'linear' }}
                            key={slideIdx}
                          />
                        )}
                        {active && paused && (
                          <div className="h-full w-full rounded-full" style={{ background: `linear-gradient(90deg, ${MG}, ${CYAN})` }} />
                        )}
                        {i < slideIdx && (
                          <div className="h-full w-full rounded-full bg-white/50" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[9px] text-white/[0.20] tracking-widest uppercase">
                ← → navigate · Space pause · Esc exit
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
