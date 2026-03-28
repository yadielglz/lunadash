import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'

export type ShiftType = 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Custom'

export interface Employee {
  id: string
  name: string
  role: string
  color: string
  avatar?: string
}

export interface Shift {
  id: string
  employeeId: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  type: ShiftType
  note?: string
}

interface ScheduleState {
  employees: Employee[]
  shifts: Shift[]
  selectedDate: string

  addEmployee: (emp: Omit<Employee, 'id'>) => void
  updateEmployee: (id: string, updates: Partial<Employee>) => void
  removeEmployee: (id: string) => void
  reorderEmployees: (employees: Employee[]) => void

  addShift: (shift: Omit<Shift, 'id'>) => void
  updateShift: (id: string, updates: Partial<Shift>) => void
  removeShift: (id: string) => void

  setSelectedDate: (date: string) => void
  getShiftsForDate: (date: string) => Shift[]
  getShiftsForEmployee: (employeeId: string) => Shift[]
  getShiftsForWeek: (weekStart: string) => Shift[]
}

const COLORS = ['#0078d4','#7c5ff5','#e74856','#16c60c','#f7630c','#00b7c3','#e3008c','#8764b8']
let colorIdx = 0

const DEMO_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Alex Rivera',   role: 'Floor Lead',    color: '#0078d4' },
  { id: '2', name: 'Jamie Chen',    role: 'Associate',     color: '#7c5ff5' },
  { id: '3', name: 'Sam Torres',    role: 'Associate',     color: '#16c60c' },
  { id: '4', name: 'Morgan Lee',    role: 'Supervisor',    color: '#f7630c' },
]

const today = format(new Date(), 'yyyy-MM-dd')

const DEMO_SHIFTS: Shift[] = [
  { id: 's1', employeeId: '1', date: today, startTime: '09:00', endTime: '17:00', type: 'Morning' },
  { id: 's2', employeeId: '2', date: today, startTime: '13:00', endTime: '21:00', type: 'Afternoon' },
  { id: 's3', employeeId: '3', date: today, startTime: '09:00', endTime: '14:00', type: 'Morning' },
  { id: 's4', employeeId: '4', date: today, startTime: '07:00', endTime: '15:00', type: 'Morning' },
]

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      employees: DEMO_EMPLOYEES,
      shifts: DEMO_SHIFTS,
      selectedDate: today,

      addEmployee: (emp) => {
        const color = COLORS[colorIdx++ % COLORS.length]
        set((s) => ({
          employees: [...s.employees, { ...emp, id: crypto.randomUUID(), color: emp.color || color }],
        }))
      },
      updateEmployee: (id, updates) =>
        set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...updates } : e)) })),
      removeEmployee: (id) =>
        set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })),
      reorderEmployees: (employees) => set({ employees }),

      addShift: (shift) =>
        set((s) => ({ shifts: [...s.shifts, { ...shift, id: crypto.randomUUID() }] })),
      updateShift: (id, updates) =>
        set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === id ? { ...sh, ...updates } : sh)) })),
      removeShift: (id) =>
        set((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== id) })),

      setSelectedDate: (date) => set({ selectedDate: date }),

      getShiftsForDate: (date) => get().shifts.filter((s) => s.date === date),
      getShiftsForEmployee: (employeeId) => get().shifts.filter((s) => s.employeeId === employeeId),
      getShiftsForWeek: (weekStart) => {
        const start = new Date(weekStart)
        const end = new Date(weekStart)
        end.setDate(end.getDate() + 7)
        return get().shifts.filter((s) => {
          const d = new Date(s.date)
          return d >= start && d < end
        })
      },
    }),
    { name: 'luna-schedule' }
  )
)
