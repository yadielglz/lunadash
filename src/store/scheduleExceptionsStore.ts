import { create } from 'zustand'
import {
  dbDeleteScheduleException,
  dbInsertScheduleException,
  dbUpdateScheduleException,
} from '../lib/supabase'
import { currentStoreId } from './currentStoreId'

export type ScheduleExceptionType = 'call_out' | 'no_show' | 'pto' | 'sick' | 'holiday'

export interface ScheduleException {
  id: string
  storeId?: string
  employeeId?: string | null
  date: string
  type: ScheduleExceptionType
  startTime?: string | null
  endTime?: string | null
  note?: string
  createdAt: string
}

interface ScheduleExceptionsState {
  exceptions: ScheduleException[]
  isLoaded: boolean
  _init: (exceptions: ScheduleException[]) => void
  addException: (exception: Omit<ScheduleException, 'id' | 'storeId' | 'createdAt'>) => void
  updateException: (id: string, patch: Partial<ScheduleException>) => void
  removeException: (id: string) => void
}

export const useScheduleExceptionsStore = create<ScheduleExceptionsState>()((set) => ({
  exceptions: [],
  isLoaded: false,

  _init: (exceptions) => set({ exceptions, isLoaded: true }),

  addException: (exception) => {
    const storeId = currentStoreId()
    const newException: ScheduleException = {
      ...exception,
      id: crypto.randomUUID(),
      storeId,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ exceptions: [...s.exceptions, newException] }))
    dbInsertScheduleException(newException, storeId)
  },

  updateException: (id, patch) => {
    set((s) => ({ exceptions: s.exceptions.map((item) => item.id === id ? { ...item, ...patch } : item) }))
    dbUpdateScheduleException(id, patch)
  },

  removeException: (id) => {
    set((s) => ({ exceptions: s.exceptions.filter((item) => item.id !== id) }))
    dbDeleteScheduleException(id)
  },
}))
