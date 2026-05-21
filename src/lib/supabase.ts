import { createClient } from '@supabase/supabase-js'
import type { Employee, Shift } from '../store/scheduleStore'
import type { Goal } from '../store/goalsStore'
import type { Announcement } from '../store/displayStore'
import type { Task, TaskCategory } from '../store/tasksStore'

export const supabase = createClient(
  'https://vzbuboclkpdthztfprgg.supabase.co',
  'sb_publishable_NzT-BI3Yy3ahV_WNx4X-_A_bhVz4l1X'
)

// ── Types ─────────────────────────────────────────────────────────────────────

type DbGoal = {
  id: string; store_id: string; title: string; description: string; category: string
  target: number; current_val: number; unit: string; deadline: string
  color: string; daily_target: number; daily_log: Record<string, number>
  milestones: Goal['milestones']; created_at: string
}

type DbSettings = {
  store_id: string; company_name: string; store_number: string; slide_interval: number
}

export type StoreSummary = DbSettings

type DbEmployee = {
  id: string; store_id: string; name: string; role: string; color: string; created_at: string
}

type DbShift = {
  id: string; store_id: string; employee_id: string; date: string
  start_time: string; end_time: string; type: Shift['type']; note: string | null
  created_at: string
}

type DbAnnouncement = {
  id: string; store_id: string; text: string; priority: Announcement['priority']; created_at: string
}

type DbShiftPatch = Partial<{
  employee_id: string
  date: string
  start_time: string
  end_time: string
  type: Shift['type']
  note: string
}>

type DbGoalPatch = Partial<{
  title: string
  description: string
  category: string
  target: number
  current_val: number
  unit: string
  deadline: string
  color: string
  daily_target: number
  daily_log: Goal['dailyLog']
  milestones: Goal['milestones']
}>

type DbTaskPatch = Partial<{
  title: string
  category: Task['category']
  sort_order: number
  completed_date: string | null
}>

type SupabaseError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function isSupabaseError(error: unknown): error is SupabaseError {
  return typeof error === 'object' && error !== null
}

function isMissingTableError(error: unknown) {
  if (!isSupabaseError(error)) return false
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return text.includes('42p01')
    || text.includes('pgrst205')
    || text.includes('could not find the table')
    || text.includes('relation "public.tasks" does not exist')
}

function throwIfError(error: unknown, context: string) {
  if (!error) return
  const message = isSupabaseError(error)
    ? error.message ?? error.details ?? String(error)
    : error instanceof Error ? error.message : String(error)
  throw new Error(`${context}: ${message}`)
}

function logOptionalTasksWarning(action: string, error: unknown) {
  if (!isMissingTableError(error)) return false
  console.warn(`Tasks table is not available in this Supabase project; ${action} will stay local until schema.sql is applied.`)
  return true
}

// ── Employees ─────────────────────────────────────────────────────────────────

export async function dbGetEmployees(storeId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees').select('*').eq('store_id', storeId).order('created_at')
  throwIfError(error, 'Could not load employees')
  return (data ?? []).map(dbToEmployee)
}

function dbToEmployee(r: DbEmployee): Employee {
  return { id: r.id, storeId: r.store_id, name: r.name, role: r.role, color: r.color }
}

export async function dbInsertEmployee(e: Employee, storeId: string) {
  const { error } = await supabase.from('employees').insert({
    id: e.id, store_id: storeId, name: e.name, role: e.role, color: e.color,
  })
  throwIfError(error, 'Could not save employee')
}

export async function dbUpdateEmployee(id: string, patch: Partial<Employee>) {
  const { error } = await supabase.from('employees').update(patch).eq('id', id)
  throwIfError(error, 'Could not update employee')
}

export async function dbDeleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  throwIfError(error, 'Could not delete employee')
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function dbGetShifts(storeId: string): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts').select('*').eq('store_id', storeId).order('date')
  throwIfError(error, 'Could not load shifts')
  return ((data ?? []) as DbShift[]).map((r) => ({
    id: r.id, storeId: r.store_id, employeeId: r.employee_id, date: r.date,
    startTime: r.start_time, endTime: r.end_time, type: r.type, note: r.note ?? '',
  }))
}

export async function dbInsertShift(s: Shift, storeId: string) {
  const { error } = await supabase.from('shifts').insert({
    id: s.id, store_id: storeId, employee_id: s.employeeId, date: s.date,
    start_time: s.startTime, end_time: s.endTime, type: s.type, note: s.note ?? '',
  })
  throwIfError(error, 'Could not save shift')
}

export async function dbUpdateShift(id: string, s: Partial<Shift>) {
  const patch: DbShiftPatch = {}
  if (s.employeeId !== undefined) patch.employee_id = s.employeeId
  if (s.date       !== undefined) patch.date        = s.date
  if (s.startTime  !== undefined) patch.start_time  = s.startTime
  if (s.endTime    !== undefined) patch.end_time    = s.endTime
  if (s.type       !== undefined) patch.type        = s.type
  if (s.note       !== undefined) patch.note        = s.note
  const { error } = await supabase.from('shifts').update(patch).eq('id', id)
  throwIfError(error, 'Could not update shift')
}

export async function dbDeleteShift(id: string) {
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  throwIfError(error, 'Could not delete shift')
}

// ── Goals ─────────────────────────────────────────────────────────────────────

function goalToDb(g: Goal, storeId: string) {
  return {
    id: g.id, store_id: storeId, title: g.title, description: g.description,
    category: g.category, target: g.target, current_val: g.current,
    unit: g.unit, deadline: g.deadline, color: g.color,
    daily_target: g.dailyTarget ?? 1, daily_log: g.dailyLog ?? {},
    milestones: g.milestones,
  }
}

function dbToGoal(r: DbGoal): Goal {
  return {
    id: r.id, title: r.title, description: r.description, category: r.category,
    storeId: r.store_id,
    target: r.target, current: r.current_val, unit: r.unit, deadline: r.deadline,
    color: r.color, dailyTarget: r.daily_target ?? 1, dailyLog: r.daily_log ?? {},
    milestones: r.milestones ?? [], createdAt: r.created_at,
  }
}

export async function dbGetGoals(storeId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals').select('*').eq('store_id', storeId).order('created_at')
  throwIfError(error, 'Could not load goals')
  return (data ?? []).map(dbToGoal)
}

export async function dbInsertGoal(g: Goal, storeId: string) {
  const { error } = await supabase.from('goals').insert(goalToDb(g, storeId))
  throwIfError(error, 'Could not save goal')
}

export async function dbUpdateGoal(id: string, patch: Partial<Goal>) {
  const dbPatch: DbGoalPatch = {}
  if (patch.title       !== undefined) dbPatch.title        = patch.title
  if (patch.description !== undefined) dbPatch.description  = patch.description
  if (patch.category    !== undefined) dbPatch.category     = patch.category
  if (patch.target      !== undefined) dbPatch.target       = patch.target
  if (patch.current     !== undefined) dbPatch.current_val  = patch.current
  if (patch.unit        !== undefined) dbPatch.unit         = patch.unit
  if (patch.deadline    !== undefined) dbPatch.deadline     = patch.deadline
  if (patch.color       !== undefined) dbPatch.color        = patch.color
  if (patch.dailyTarget !== undefined) dbPatch.daily_target = patch.dailyTarget
  if (patch.dailyLog    !== undefined) dbPatch.daily_log    = patch.dailyLog
  if (patch.milestones  !== undefined) dbPatch.milestones   = patch.milestones
  const { error } = await supabase.from('goals').update(dbPatch).eq('id', id)
  throwIfError(error, 'Could not update goal')
}

export async function dbDeleteGoal(id: string) {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  throwIfError(error, 'Could not delete goal')
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function dbGetAnnouncements(storeId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements').select('*').eq('store_id', storeId).order('created_at')
  throwIfError(error, 'Could not load announcements')
  return (data ?? []).map(dbToAnnouncement)
}

function dbToAnnouncement(r: DbAnnouncement): Announcement {
  return { id: r.id, storeId: r.store_id, text: r.text, priority: r.priority, createdAt: r.created_at }
}

export async function dbInsertAnnouncement(a: Announcement, storeId: string) {
  const { error } = await supabase.from('announcements').insert({
    id: a.id, store_id: storeId, text: a.text, priority: a.priority,
  })
  throwIfError(error, 'Could not save announcement')
}

export async function dbUpdateAnnouncement(id: string, patch: Partial<Announcement>) {
  const { error } = await supabase.from('announcements').update(patch).eq('id', id)
  throwIfError(error, 'Could not update announcement')
}

export async function dbDeleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  throwIfError(error, 'Could not delete announcement')
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function dbGetSettings(storeId: string): Promise<DbSettings | null> {
  const { data, error } = await supabase
    .from('app_settings').select('*').eq('store_id', storeId).maybeSingle()
  throwIfError(error, 'Could not load app settings')
  return data as DbSettings | null
}

export async function dbGetStores(): Promise<StoreSummary[]> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('store_id, company_name, store_number, slide_interval')
    .order('store_id')
  throwIfError(error, 'Could not load stores')
  return (data ?? []) as StoreSummary[]
}

export async function dbUpdateSettings(storeId: string, patch: Partial<Omit<DbSettings, 'store_id'>>) {
  const { error } = await supabase.from('app_settings').upsert({ store_id: storeId, ...patch })
  throwIfError(error, 'Could not save app settings')
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

type DbTask = {
  id: string; store_id: string; title: string; category: string
  sort_order: number; completed_date: string | null; created_at: string
}

function taskToDb(t: Task, storeId: string) {
  return {
    id: t.id, store_id: storeId, title: t.title, category: t.category,
    sort_order: t.sortOrder, completed_date: t.completedDate ?? null,
  }
}

function dbToTask(r: DbTask): Task {
  return {
    id: r.id, title: r.title, category: r.category as TaskCategory,
    storeId: r.store_id,
    sortOrder: r.sort_order, completedDate: r.completed_date ?? null,
    createdAt: r.created_at,
  }
}

export async function dbGetTasks(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks').select('*').eq('store_id', storeId).order('sort_order').order('created_at')
  if (logOptionalTasksWarning('task data', error)) return []
  throwIfError(error, 'Could not load tasks')
  return (data ?? []).map(dbToTask)
}

export async function dbInsertTask(t: Task, storeId: string) {
  const { error } = await supabase.from('tasks').insert(taskToDb(t, storeId))
  if (!logOptionalTasksWarning('new tasks', error)) throwIfError(error, 'Could not save task')
}

export async function dbUpdateTask(id: string, patch: Partial<Task>) {
  const dbPatch: DbTaskPatch = {}
  if (patch.title         !== undefined) dbPatch.title          = patch.title
  if (patch.category      !== undefined) dbPatch.category       = patch.category
  if (patch.sortOrder     !== undefined) dbPatch.sort_order     = patch.sortOrder
  if (patch.completedDate !== undefined) dbPatch.completed_date = patch.completedDate
  const { error } = await supabase.from('tasks').update(dbPatch).eq('id', id)
  if (!logOptionalTasksWarning('task updates', error)) throwIfError(error, 'Could not update task')
}

export async function dbDeleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (!logOptionalTasksWarning('task deletion', error)) throwIfError(error, 'Could not delete task')
}
