import { createClient } from '@supabase/supabase-js'
import type { Employee, Shift } from '../store/scheduleStore'
import type { Goal } from '../store/goalsStore'
import type { Announcement } from '../store/displayStore'

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

// ── Employees ─────────────────────────────────────────────────────────────────

export async function dbGetEmployees(storeId: string): Promise<Employee[]> {
  const { data } = await supabase
    .from('employees').select('*').eq('store_id', storeId).order('created_at')
  return (data ?? []) as Employee[]
}

export async function dbInsertEmployee(e: Employee, storeId: string) {
  await supabase.from('employees').insert({
    id: e.id, store_id: storeId, name: e.name, role: e.role, color: e.color,
  })
}

export async function dbUpdateEmployee(id: string, patch: Partial<Employee>) {
  await supabase.from('employees').update(patch).eq('id', id)
}

export async function dbDeleteEmployee(id: string) {
  await supabase.from('employees').delete().eq('id', id)
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function dbGetShifts(storeId: string): Promise<Shift[]> {
  const { data } = await supabase
    .from('shifts').select('*').eq('store_id', storeId).order('date')
  return (data ?? []).map((r: any) => ({
    id: r.id, employeeId: r.employee_id, date: r.date,
    startTime: r.start_time, endTime: r.end_time, type: r.type, note: r.note ?? '',
  })) as Shift[]
}

export async function dbInsertShift(s: Shift, storeId: string) {
  await supabase.from('shifts').insert({
    id: s.id, store_id: storeId, employee_id: s.employeeId, date: s.date,
    start_time: s.startTime, end_time: s.endTime, type: s.type, note: s.note ?? '',
  })
}

export async function dbUpdateShift(id: string, s: Partial<Shift>) {
  const patch: any = {}
  if (s.employeeId !== undefined) patch.employee_id = s.employeeId
  if (s.date       !== undefined) patch.date        = s.date
  if (s.startTime  !== undefined) patch.start_time  = s.startTime
  if (s.endTime    !== undefined) patch.end_time    = s.endTime
  if (s.type       !== undefined) patch.type        = s.type
  if (s.note       !== undefined) patch.note        = s.note
  await supabase.from('shifts').update(patch).eq('id', id)
}

export async function dbDeleteShift(id: string) {
  await supabase.from('shifts').delete().eq('id', id)
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
    target: r.target, current: r.current_val, unit: r.unit, deadline: r.deadline,
    color: r.color, dailyTarget: r.daily_target ?? 1, dailyLog: r.daily_log ?? {},
    milestones: r.milestones ?? [], createdAt: r.created_at,
  }
}

export async function dbGetGoals(storeId: string): Promise<Goal[]> {
  const { data } = await supabase
    .from('goals').select('*').eq('store_id', storeId).order('created_at')
  return (data ?? []).map(dbToGoal)
}

export async function dbInsertGoal(g: Goal, storeId: string) {
  await supabase.from('goals').insert(goalToDb(g, storeId))
}

export async function dbUpdateGoal(id: string, patch: Partial<Goal>) {
  const dbPatch: any = {}
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
  await supabase.from('goals').update(dbPatch).eq('id', id)
}

export async function dbDeleteGoal(id: string) {
  await supabase.from('goals').delete().eq('id', id)
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function dbGetAnnouncements(storeId: string): Promise<Announcement[]> {
  const { data } = await supabase
    .from('announcements').select('*').eq('store_id', storeId).order('created_at')
  return (data ?? []) as Announcement[]
}

export async function dbInsertAnnouncement(a: Announcement, storeId: string) {
  await supabase.from('announcements').insert({
    id: a.id, store_id: storeId, text: a.text, priority: a.priority,
  })
}

export async function dbUpdateAnnouncement(id: string, patch: Partial<Announcement>) {
  await supabase.from('announcements').update(patch).eq('id', id)
}

export async function dbDeleteAnnouncement(id: string) {
  await supabase.from('announcements').delete().eq('id', id)
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function dbGetSettings(storeId: string): Promise<DbSettings | null> {
  const { data } = await supabase
    .from('app_settings').select('*').eq('store_id', storeId).single()
  return data as DbSettings | null
}

export async function dbUpdateSettings(storeId: string, patch: Partial<Omit<DbSettings, 'store_id'>>) {
  await supabase.from('app_settings').upsert({ store_id: storeId, ...patch })
}
