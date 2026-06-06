import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

interface SchedulePreferencesState {
  weekStartsOn: WeekStartDay
  showShiftNames: boolean
  setWeekStartsOn: (day: WeekStartDay) => void
  setShowShiftNames: (show: boolean) => void
}

export const WEEKDAY_OPTIONS: { value: WeekStartDay; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export const useSchedulePreferencesStore = create<SchedulePreferencesState>()(
  persist(
    (set) => ({
      weekStartsOn: 4,
      showShiftNames: true,
      setWeekStartsOn: (day) => set({ weekStartsOn: day }),
      setShowShiftNames: (show) => set({ showShiftNames: show }),
    }),
    {
      name: 'luna-schedule-preferences',
      version: 1,
    }
  )
)
