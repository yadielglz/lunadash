import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isSameDay, eachDayOfInterval } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScheduleStore, Shift } from '../../../store/scheduleStore'
import { ShiftModal } from './ShiftModal'
import { hexToRgba, formatShiftTime } from '../../../lib/utils'
import { Card } from '../../ui/Card'

export function MonthlyCalendar() {
  const { employees, shifts } = useScheduleStore()
  const [current, setCurrent] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | undefined>()

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = addDays(startOfWeek(addDays(monthEnd, 6)), 6)
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const getShiftsForDay = (date: Date) =>
    shifts.filter((s) => s.date === format(date, 'yyyy-MM-dd'))

  const selectedShifts = selectedDate
    ? shifts.filter((s) => s.date === selectedDate)
    : []

  const openAdd = () => {
    setEditShift(undefined)
    setModalOpen(true)
  }

  const openEdit = (shift: Shift) => {
    setEditShift(shift)
    setModalOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Month Nav */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() - 1))} className="p-1.5 rounded-lg hover:bg-[var(--reveal-bg)] text-[var(--text-secondary)]">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[var(--text)] w-32 text-center">
            {format(current, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() + 1))} className="p-1.5 rounded-lg hover:bg-[var(--reveal-bg)] text-[var(--text-secondary)]">
            <ChevronRight size={16} />
          </button>
        </div>
        <button onClick={() => setCurrent(new Date())} className="text-xs text-[var(--accent)] hover:underline">Today</button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-0">
        {/* Calendar */}
        <div className="flex-1 overflow-auto">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-medium text-[var(--text-secondary)]">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {allDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayShifts = getShiftsForDay(day)
              const isCurrentMonth = isSameMonth(day, current)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDate === dateStr

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`border-b border-r border-[var(--border)] p-1.5 min-h-[72px] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--accent)]/10' :
                    isToday ? 'bg-[var(--accent)]/5' :
                    !isCurrentMonth ? 'opacity-30' : 'hover:bg-[var(--reveal-bg)]'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${
                    isToday ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)]'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayShifts.slice(0, 2).map((shift) => {
                      const emp = employees.find((e) => e.id === shift.employeeId)
                      return emp ? (
                        <div
                          key={shift.id}
                          className="rounded text-[9px] px-1 py-0.5 truncate leading-tight"
                          style={{
                            background: hexToRgba(emp.color, 0.18),
                            color: emp.color,
                          }}
                        >
                          {emp.name.split(' ')[0]}
                        </div>
                      ) : null
                    })}
                    {dayShifts.length > 2 && (
                      <div className="text-[9px] text-[var(--text-tertiary)] pl-1">+{dayShifts.length - 2}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <AnimatePresence>
          {selectedDate && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-[var(--border)] overflow-hidden flex-shrink-0"
            >
              <div className="w-[280px] h-full flex flex-col p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">
                      {format(new Date(selectedDate + 'T12:00:00'), 'EEEE')}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {format(new Date(selectedDate + 'T12:00:00'), 'MMMM d, yyyy')}
                    </div>
                  </div>
                  <button
                    onClick={openAdd}
                    className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                  >
                    + Add
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                  {selectedShifts.length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)] text-center py-8">No shifts — click "+ Add" to schedule</p>
                  ) : (
                    selectedShifts.map((shift) => {
                      const emp = employees.find((e) => e.id === shift.employeeId)
                      if (!emp) return null
                      return (
                        <Card
                          key={shift.id}
                          interactive
                          className="!p-3 cursor-pointer"
                          onClick={() => openEdit(shift)}
                          style={{ borderColor: hexToRgba(emp.color, 0.3), background: hexToRgba(emp.color, 0.06) }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: emp.color }} />
                            <span className="text-xs font-medium text-[var(--text)]">{emp.name}</span>
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] mt-1">
                            {shift.type} · {formatShiftTime(shift.startTime, shift.endTime)}
                          </div>
                          {shift.note && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 italic">{shift.note}</div>}
                        </Card>
                      )
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ShiftModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialDate={selectedDate ?? undefined}
        editShift={editShift}
      />
    </div>
  )
}
