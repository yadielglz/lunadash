import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize, Minimize, X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { format } from 'date-fns'
import { useFullscreen } from '../../../hooks/useFullscreen'
import { useWeather } from '../../../hooks/useWeather'
import { useTempDisplay } from '../../../hooks/useTempDisplay'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useGoalsStore } from '../../../store/goalsStore'
import { useDisplayStore } from '../../../store/displayStore'
import { useUiStore } from '../../../store/uiStore'
import { getWeatherInfo } from '../../../lib/openMeteo'
import { ProgressRing } from '../../ui/ProgressRing'
import { formatShiftTime, hexToRgba } from '../../../lib/utils'

// T-Mobile magenta palette
const MG  = '#E20074'       // primary magenta
const MG2 = '#FF0084'       // bright magenta for glows
const MG3 = '#9B004F'       // deep magenta

// ── Slide: Clock ─────────────────────────────────────────────────────────────
function ClockSlide() {
  const [now, setNow] = useState(new Date())
  const { companyName, storeNumber } = useDisplayStore()
  const { timeFormat } = useUiStore()

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
            <span className="text-[3.5vw] font-thin text-white/40">:{seconds}</span>
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
      <div className="text-[2.8vw] font-light text-white/60 tracking-wide">
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
        <span className="text-white/70">{companyName}</span>
        {storeNumber && (
          <>
            <span className="text-white/20">·</span>
            <span className="text-white/50">Store #{storeNumber}</span>
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
        <div className="flex flex-col items-center gap-4 text-white/30">
          <div className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          <span className="text-xl">Loading weather…</span>
        </div>
      </div>
    )
  }

  const cw = data.current_weather
  const weather = getWeatherInfo(cw.weathercode, cw.is_day)
  const dailyHigh = data.daily.temperature_2m_max[0]
  const dailyLow  = data.daily.temperature_2m_min[0]

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-[6vw] select-none">
      {/* Current conditions */}
      <div className="flex items-center gap-[4vw]">
        <span className="text-[14vw] leading-none drop-shadow-2xl">{weather.icon}</span>
        <div className="flex flex-col gap-1">
          <div className="text-[10vw] font-black text-white leading-none tabular-nums">
            {fmt(cw.temperature)}<span className="text-[5vw] text-white/50">{unit}</span>
          </div>
          <div className="text-[2.2vw] font-medium text-white/60">{weather.label}</div>
          <div className="flex items-center gap-4 text-[1.5vw] mt-1">
            <span style={{ color: MG2 }}>↑ {fmt(dailyHigh)}{unit}</span>
            <span className="text-white/40">↓ {fmt(dailyLow)}{unit}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full max-w-4xl h-px" style={{ background: `linear-gradient(90deg, transparent, ${MG}40, transparent)` }} />

      {/* 5-day forecast */}
      <div className="flex items-center gap-6 w-full max-w-4xl justify-center">
        {data.daily.time.slice(0, 5).map((d, i) => {
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
              <span className={`text-[1.3vw] font-semibold ${isToday ? '' : 'text-white/50'}`} style={isToday ? { color: MG } : {}}>
                {isToday ? 'Today' : format(new Date(d + 'T12:00'), 'EEE')}
              </span>
              <span className="text-[2.5vw] leading-none">{getWeatherInfo(data.daily.weathercode[i]).icon}</span>
              <span className="text-[1.4vw] text-white font-medium">
                {fmt(data.daily.temperature_2m_max[i])}{unit}
              </span>
              <span className="text-[1vw] text-white/35">
                {fmt(data.daily.temperature_2m_min[i])}{unit}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Slide: Schedule ───────────────────────────────────────────────────────────
function ScheduleSlide() {
  const { employees, getShiftsForDate } = useScheduleStore()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const shifts   = getShiftsForDate(todayStr)
  const sorted   = [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime))

  // Font scale: fewer shifts = bigger text
  const scale = sorted.length <= 4 ? 1 : sorted.length <= 6 ? 0.85 : 0.72

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
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/30">
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
                    className="text-white/50 whitespace-nowrap"
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

// ── Slide: Goals ──────────────────────────────────────────────────────────────
function GoalsSlide() {
  const { goals } = useGoalsStore()
  const key  = new Date().toISOString().split('T')[0]
  const cols = goals.length <= 3 ? goals.length : goals.length <= 6 ? 3 : 4

  // Daily summary
  const dailyDone = goals.filter((g) => ((g.dailyLog ?? {})[key] ?? 0) >= (g.dailyTarget ?? 1)).length

  return (
    <div className="flex flex-col items-center h-full pt-[3.5vh] pb-[2vh] px-[4vw] gap-4 select-none">
      {/* Header */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <h2 className="text-[2.8vw] font-black text-white tracking-tight">Today's Goals</h2>
        <p className="text-[1.2vw]" style={{ color: MG }}>
          {dailyDone} of {goals.length} daily targets hit
          <span className="text-white/30 mx-2">·</span>
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
      </div>

      {/* Goal cards */}
      <div
        className="w-full max-w-6xl overflow-hidden"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '1vw' }}
      >
        {goals.map((g) => {
          const dailyTgt    = g.dailyTarget ?? 1
          const todayVal    = (g.dailyLog ?? {})[key] ?? 0
          const dailyPct    = Math.min(Math.round((todayVal / dailyTgt) * 100), 100)
          const monthlyPct  = Math.min(Math.round((g.current / g.target) * 100), 100)
          const dailyDoneG  = todayVal >= dailyTgt

          return (
            <div
              key={g.id}
              className="flex flex-col items-center gap-2 rounded-2xl"
              style={{
                padding: '1.2vw',
                background: dailyDoneG
                  ? `linear-gradient(135deg, ${hexToRgba(g.color, 0.18)}, ${hexToRgba(g.color, 0.08)})`
                  : hexToRgba(g.color, 0.09),
                border: `1px solid ${hexToRgba(g.color, dailyDoneG ? 0.4 : 0.2)}`,
              }}
            >
              {/* Daily ring */}
              <ProgressRing value={dailyPct} size={72} strokeWidth={7} color={g.color}>
                <div className="flex flex-col items-center leading-none">
                  <span className="text-[1.3vw] font-black text-white">{todayVal}</span>
                  <span className="text-[0.7vw] text-white/40">/{g.dailyTarget}</span>
                </div>
              </ProgressRing>

              {/* Title + done badge */}
              <div className="text-center w-full">
                <div className="text-[1.2vw] font-bold text-white leading-tight">{g.title}</div>
                {dailyDoneG ? (
                  <div
                    className="text-[0.85vw] font-semibold mt-0.5"
                    style={{ color: g.color }}
                  >
                    ✓ Done!
                  </div>
                ) : (
                  <div className="text-[0.85vw] text-white/35 mt-0.5">
                    {dailyTgt - todayVal}{g.unit} to go
                  </div>
                )}
              </div>

              {/* Monthly mini bar */}
              <div className="w-full space-y-0.5">
                <div className="flex justify-between text-[0.75vw] text-white/25">
                  <span>Monthly</span>
                  <span>{monthlyPct}%</span>
                </div>
                <div className="h-[3px] rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${monthlyPct}%`, background: `${g.color}80` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Slide: Announcements ──────────────────────────────────────────────────────
function AnnouncementsSlide() {
  const { announcements } = useDisplayStore()
  const PCOLS = { normal: MG, important: '#FF8C00', urgent: '#FF3B3B' }

  return (
    <div className="flex flex-col items-center h-full pt-[5vh] px-[6vw] gap-6 select-none">
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <h2 className="text-[3vw] font-black text-white tracking-tight">Announcements</h2>
        <div
          className="w-12 h-0.5 rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${MG}, transparent)` }}
        />
      </div>

      <div className="flex flex-col gap-3 w-full max-w-4xl overflow-y-auto no-scrollbar">
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-white/30">
            <span className="text-5xl">📢</span>
            <span className="text-xl">No announcements</span>
          </div>
        ) : (
          announcements.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-4 px-6 py-4 rounded-2xl"
              style={{
                background: `${PCOLS[a.priority]}10`,
                borderLeft: `4px solid ${PCOLS[a.priority]}`,
                border: `1px solid ${PCOLS[a.priority]}25`,
                borderLeftWidth: '4px',
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full mt-[0.9vw] flex-shrink-0"
                style={{ background: PCOLS[a.priority], boxShadow: `0 0 10px ${PCOLS[a.priority]}80` }}
              />
              <p className="text-[2vw] text-white leading-relaxed">{a.text}</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Slide registry ────────────────────────────────────────────────────────────
const SLIDES = [
  { key: 'clock',    label: 'Clock',         component: ClockSlide },
  { key: 'weather',  label: 'Weather',        component: WeatherSlide },
  { key: 'sched',    label: 'Schedule',       component: ScheduleSlide },
  { key: 'goals',    label: 'Goals',          component: GoalsSlide },
  { key: 'announce', label: 'Announcements',  component: AnnouncementsSlide },
]

// ── Display shell ─────────────────────────────────────────────────────────────
export function DisplayPage() {
  const { setTab } = useUiStore()
  const { isFullscreen, enter: enterFs, exit: exitFs } = useFullscreen()
  const { slideInterval, companyName, storeNumber } = useDisplayStore()
  const [slideIdx, setSlideIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prev = () => setSlideIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length)
  const next = useCallback(() => setSlideIdx((i) => (i + 1) % SLIDES.length), [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(next, slideInterval * 1000)
    return () => clearInterval(id)
  }, [paused, slideInterval, next])

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
      if (e.key === 'Escape')     { exitFs(); setTab('home') }
      if (e.key === ' ')          setPaused((p) => !p)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, exitFs, setTab])

  const Slide = SLIDES[slideIdx].component

  return (
    <div
      className="relative w-screen h-screen overflow-hidden cursor-none"
      style={{ background: '#0D0007' }}
      onMouseMove={resetHideTimer}
    >
      {/* Ambient magenta glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/3 -left-1/4 w-3/4 h-3/4 rounded-full blur-[160px] opacity-15"
          style={{ background: MG }}
        />
        <div
          className="absolute -bottom-1/3 -right-1/4 w-2/3 h-2/3 rounded-full blur-[140px] opacity-10"
          style={{ background: MG3 }}
        />
        {/* Subtle vignette */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
      </div>

      {/* Thin magenta top line accent */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 z-10"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${MG} 30%, ${MG2} 50%, ${MG} 70%, transparent 100%)` }}
      />

      {/* Slide content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slideIdx}
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
            <div className="absolute top-2 left-0 right-0 flex items-center justify-between px-5 pointer-events-auto">
              {/* Brand */}
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-black"
                  style={{ background: `linear-gradient(135deg, ${MG}, ${MG3})`, boxShadow: `0 0 16px ${MG}50` }}
                >
                  T
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-white text-xs font-semibold">
                    {companyName}
                    {storeNumber && <span className="text-white/40 font-normal"> · #{storeNumber}</span>}
                  </span>
                  <span className="text-[10px]" style={{ color: MG }}>Live Display</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/70 text-xs transition-colors hover:text-white cursor-auto"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  {paused ? <Play size={11} /> : <Pause size={11} />}
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={() => isFullscreen ? exitFs() : enterFs()}
                  className="p-2 rounded-lg text-white/70 hover:text-white transition-colors cursor-auto"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
                </button>
                <button
                  onClick={() => { exitFs(); setTab('home') }}
                  className="p-2 rounded-lg text-white/70 hover:text-white transition-colors cursor-auto"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Side nav arrows */}
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl text-white/60 hover:text-white transition-all cursor-auto"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl text-white/60 hover:text-white transition-all cursor-auto"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              <ChevronRight size={22} />
            </button>

            {/* Bottom: indicators */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-5 gap-2.5 pointer-events-auto">
              <div className="flex items-end gap-3">
                {SLIDES.map((s, i) => {
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
                            style={{ background: MG }}
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: slideInterval, ease: 'linear' }}
                            key={slideIdx}
                          />
                        )}
                        {active && paused && (
                          <div className="h-full w-full rounded-full" style={{ background: MG }} />
                        )}
                        {i < slideIdx && (
                          <div className="h-full w-full rounded-full bg-white/50" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[9px] text-white/20 tracking-widest uppercase">
                ← → navigate · Space pause · Esc exit
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
