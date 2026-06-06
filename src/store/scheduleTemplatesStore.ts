import { create } from 'zustand'
import {
  dbDeleteScheduleTemplate,
  dbGetScheduleTemplates,
  dbInsertScheduleTemplate,
} from '../lib/supabase'
import { currentStoreId } from './currentStoreId'
import type { Shift, ShiftType } from './scheduleStore'

export const SCHEDULE_TEMPLATE_KEY = 'luna-schedule-templates'

export type TemplateShift = {
  employeeId: string
  dayOffset: number
  startTime: string
  endTime: string
  type: ShiftType
  note?: string
}

export type ScheduleTemplate = {
  id: string
  storeId?: string
  name: string
  shifts: TemplateShift[]
  createdAt: string
}

interface ScheduleTemplatesState {
  templates: ScheduleTemplate[]
  isLoaded: boolean
  loadTemplates: () => Promise<void>
  addTemplate: (template: Omit<ScheduleTemplate, 'id' | 'storeId' | 'createdAt'>) => Promise<ScheduleTemplate>
  removeTemplate: (id: string) => Promise<void>
}

function sortTemplates(templates: ScheduleTemplate[]) {
  return [...templates].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function loadLegacyTemplates(): ScheduleTemplate[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_TEMPLATE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function clearLegacyTemplates() {
  localStorage.removeItem(SCHEDULE_TEMPLATE_KEY)
}

function saveLegacyTemplates(templates: ScheduleTemplate[]) {
  localStorage.setItem(SCHEDULE_TEMPLATE_KEY, JSON.stringify(sortTemplates(templates)))
}

export function shiftsToTemplateShifts(shifts: Shift[], weekDates: string[]): TemplateShift[] {
  return shifts
    .map((shift) => ({
      employeeId: shift.employeeId,
      dayOffset: weekDates.indexOf(shift.date),
      startTime: shift.startTime,
      endTime: shift.endTime,
      type: shift.type,
      note: shift.note,
    }))
    .filter((shift) => shift.dayOffset >= 0)
}

export const useScheduleTemplatesStore = create<ScheduleTemplatesState>()((set, get) => ({
  templates: [],
  isLoaded: false,

  loadTemplates: async () => {
    const storeId = currentStoreId()
    const remoteTemplates = await dbGetScheduleTemplates(storeId)
    const legacyTemplates = loadLegacyTemplates()

    if (remoteTemplates.length === 0 && legacyTemplates.length > 0) {
      const migrated = legacyTemplates.map((template) => ({
        ...template,
        storeId,
        createdAt: template.createdAt ?? new Date().toISOString(),
      }))
      const results = await Promise.all(migrated.map((template) => dbInsertScheduleTemplate(template, storeId)))
      if (results.every(Boolean)) clearLegacyTemplates()
      set({ templates: sortTemplates(migrated), isLoaded: true })
      return
    }

    if (remoteTemplates.length > 0 && legacyTemplates.length > 0) clearLegacyTemplates()
    set({ templates: sortTemplates(remoteTemplates), isLoaded: true })
  },

  addTemplate: async (template) => {
    const storeId = currentStoreId()
    const newTemplate: ScheduleTemplate = {
      ...template,
      id: crypto.randomUUID(),
      storeId,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ templates: sortTemplates([newTemplate, ...s.templates]) }))
    const savedRemotely = await dbInsertScheduleTemplate(newTemplate, storeId)
    if (!savedRemotely) saveLegacyTemplates(get().templates)
    return newTemplate
  },

  removeTemplate: async (id) => {
    const nextTemplates = get().templates.filter((template) => template.id !== id)
    set((s) => ({ templates: s.templates.filter((template) => template.id !== id) }))
    const deletedRemotely = await dbDeleteScheduleTemplate(id)
    if (!deletedRemotely) saveLegacyTemplates(nextTemplates)
  },
}))
