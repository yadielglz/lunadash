import { format } from 'date-fns'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { useScheduleStore } from '../../store/scheduleStore'
import { useUiStore } from '../../store/uiStore'
import { formatShiftTime } from '../../lib/utils'

export function ScheduleWidget() {
  const { setTab } = useUiStore()
  const { employees, getShiftsForDate } = useScheduleStore()
  const today = format(new Date(), 'yyyy-MM-dd')
  const shifts = getShiftsForDate(today)

  const shiftsWithEmployee = shifts
    .slice(0, 4)
    .map((s) => ({ shift: s, employee: employees.find((e) => e.id === s.employeeId) }))
    .filter((x) => x.employee)

  return (
    <Card
      className="h-full flex flex-col gap-3 cursor-pointer group"
      interactive
      onClick={() => setTab('schedule')}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">Today's Schedule</h3>
          <p className="text-xs text-[var(--text-secondary)]">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <Badge variant="soft">{shifts.length} shifts</Badge>
      </div>

      {shiftsWithEmployee.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[var(--text-tertiary)]">No shifts scheduled today</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
          {shiftsWithEmployee.map(({ shift, employee }) => (
            <div
              key={shift.id}
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--reveal-bg)] transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: employee!.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text)] truncate">{employee!.name}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  {formatShiftTime(shift.startTime, shift.endTime)}
                </div>
              </div>
              <Badge
                size="sm"
                color={employee!.color}
                variant="soft"
              >
                {shift.type}
              </Badge>
            </div>
          ))}
          {shifts.length > 4 && (
            <p className="text-[10px] text-[var(--text-tertiary)] text-center">+{shifts.length - 4} more</p>
          )}
        </div>
      )}
    </Card>
  )
}
