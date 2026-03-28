import { useState } from 'react'
import { format, addDays, startOfWeek, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScheduleStore, Shift } from '../../../store/scheduleStore'
import { ShiftModal } from './ShiftModal'
import { formatShiftTime, hexToRgba } from '../../../lib/utils'

const TYPE_COLORS: Record<string, string> = {
  Morning:   '#f7630c',
  Afternoon: '#0078d4',
  Evening:   '#7c5ff5',
  Night:     '#16c60c',
  Custom:    '#e3008c',
}

function ShiftCard({ shift, empColor, onClick }: { shift: Shift; empColor: string; onClick: () => void }) {
  const accentColor = TYPE_COLORS[shift.type] ?? empColor
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="w-full text-left rounded-xl px-2.5 py-2 transition-all"
      style={{
        background: hexToRgba(accentColor, 0.12),
        border: `1px solid ${hexToRgba(accentColor, 0.25)}`,
      }}
    >
      <div
        className="text-[11px] font-semibold leading-tight truncate"
        style={{ color: accentColor }}
      >
        {shift.type}
      </div>
      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 truncate">
        {formatShiftTime(shift.startTime, shift.endTime)}
      </div>
    </motion.button>
  )
}

export function WeeklyGrid() {
  const { employees, shifts } = useScheduleStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | undefined>()
  const [clickedDate, setClickedDate] = useState<string | undefined>()

  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const openAdd = (date: string) => {
    setEditShift(undefined); setClickedDate(date); setModalOpen(true)
  }
  const openEdit = (shift: Shift) => {
    setEditShift(shift); setClickedDate(undefined); setModalOpen(true)
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--reveal-bg)] text-[var(--text-secondary)] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[var(--text)] min-w-[160px] text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--reveal-bg)] text-[var(--text-secondary)] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={() => setWeekOffset(0)}
          className="text-xs font-medium text-[var(--accent)] hover:underline"
        >
          Today
        </button>
      </div>

      {/* Main grid */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
            <div /> {/* Employee column spacer */}
            {days.map((d) => {
              const today = isToday(d)
              return (
                <div
                  key={d.toISOString()}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-2xl transition-colors ${today ? 'bg-[var(--accent)]/10' : ''}`}
                >
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${today ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    {format(d, 'EEE')}
                  </span>
                  <span
                    className={`text-lg font-bold leading-none ${today ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}
                  >
                    {format(d, 'd')}
                  </span>
                  {today && (
                    <span className="text-[9px] text-[var(--accent)] font-semibold">Today</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Employee rows */}
          <div className="space-y-2">
            {employees.map((emp) => (
              <motion.div
                key={emp.id}
                layout
                className="grid gap-2 items-start"
                style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}
              >
                {/* Employee label */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] h-full">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: emp.color }}
                  >
                    {emp.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">{emp.name}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] truncate">{emp.role}</div>
                  </div>
                </div>

                {/* Day cells */}
                {days.map((d) => {
                  const dateStr = format(d, 'yyyy-MM-dd')
                  const dayShifts = shifts.filter((s) => s.employeeId === emp.id && s.date === dateStr)
                  const today = isToday(d)

                  return (
                    <div
                      key={dateStr}
                      onClick={() => openAdd(dateStr)}
                      className={`group relative flex flex-col gap-1 p-1.5 rounded-2xl min-h-[68px] cursor-pointer transition-colors border ${
                        today
                          ? 'bg-[var(--accent)]/5 border-[var(--accent)]/20'
                          : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)]/30 hover:bg-[var(--reveal-bg)]'
                      }`}
                    >
                      <AnimatePresence>
                        {dayShifts.map((shift) => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            empColor={emp.color}
                            onClick={() => openEdit(shift)}
                          />
                        ))}
                      </AnimatePresence>

                      {dayShifts.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                            <Plus size={12} className="text-[var(--accent)]" />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </motion.div>
            ))}
          </div>

          {employees.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-tertiary)]">
              <span className="text-4xl">👥</span>
              <p className="text-sm">No employees yet — add one in Employees</p>
            </div>
          )}
        </div>
      </div>

      <ShiftModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialDate={clickedDate}
        editShift={editShift}
      />
    </div>
  )
}
