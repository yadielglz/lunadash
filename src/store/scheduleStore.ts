import { create } from 'zustand'
import { format } from 'date-fns'
import {
  dbInsertEmployee, dbUpdateEmployee, dbDeleteEmployee,
  dbInsertShift, dbUpdateShift, dbDeleteShift,
} from '../lib/supabase'

// Read storeId at call time to avoid circular imports
const sid = () => {
  try {
    const raw = localStorage.getItem('luna-ui')
    return JSON.parse(raw ?? '{}')?.state?.storeId || 'default'
  } catch { return 'default' }
}

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
  isLoaded: boolean

  _init: (employees: Employee[], shifts: Shift[]) => void

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

const today = format(new Date(), 'yyyy-MM-dd')

export const useScheduleStore = create<ScheduleState>()((set, get) => ({
  employees: [],
  shifts: [],
  selectedDate: today,
  isLoaded: false,

  _init: (employees, shifts) => set({ employees, shifts, isLoaded: true }),

  addEmployee: (emp) => {
    const newEmp: Employee = { ...emp, id: crypto.randomUUID() }
    set((s) => ({ employees: [...s.employees, newEmp] }))
    dbInsertEmployee(newEmp, sid())
  },

  updateEmployee: (id, updates) => {
    set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...updates } : e)) }))
    dbUpdateEmployee(id, updates)
  },

  removeEmployee: (id) => {
    set((s) => ({
      employees: s.employees.filter((e) => e.id !== id),
      shifts: s.shifts.filter((sh) => sh.employeeId !== id),
    }))
    dbDeleteEmployee(id)
  },

  reorderEmployees: (employees) => set({ employees }),

  addShift: (shift) => {
    const newShift: Shift = { ...shift, id: crypto.randomUUID() }
    set((s) => ({ shifts: [...s.shifts, newShift] }))
    dbInsertShift(newShift, sid())
  },

  updateShift: (id, updates) => {
    set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === id ? { ...sh, ...updates } : sh)) }))
    dbUpdateShift(id, updates)
  },

  removeShift: (id) => {
    set((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== id) }))
    dbDeleteShift(id)
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  getShiftsForDate: (date) => get().shifts.filter((s) => s.date === date),
  getShiftsForEmployee: (employeeId) => get().shifts.filter((s) => s.employeeId === employeeId),
  getShiftsForWeek: (weekStart) => {
    const start = new Date(weekStart)
    const end   = new Date(weekStart)
    end.setDate(end.getDate() + 7)
    return get().shifts.filter((s) => {
      const d = new Date(s.date)
      return d >= start && d < end
    })
  },
}))
