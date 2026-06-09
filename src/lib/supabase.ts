import { createClient } from '@supabase/supabase-js'
import type { Employee, Shift } from '../store/scheduleStore'
import type { ScheduleBlock } from '../store/scheduleBlocksStore'
import type { ScheduleTemplate, TemplateShift } from '../store/scheduleTemplatesStore'
import type { EmployeeSale, EmployeeSchedulePreference } from '../store/employeeInsightsStore'
import type { Goal } from '../store/goalsStore'
import type { Announcement } from '../store/displayStore'
import type { Task, TaskCategory } from '../store/tasksStore'
import type { ScheduleException } from '../store/scheduleExceptionsStore'
import { useSyncStore } from '../store/syncStore'
import type { AccessRole } from '../store/uiStore'
import { fetchPerformanceData, type PerformanceRow } from './performanceSheet'
import { setDealerOverride, setDealerOverrides } from './dealers'
import { normalizeAccessCode, normalizeStoreId } from './storeIds'
import { normalizeStoreHours, type StoreHours } from './storeHours'

export const supabase = createClient(
  'https://vzbuboclkpdthztfprgg.supabase.co',
  'sb_publishable_NzT-BI3Yy3ahV_WNx4X-_A_bhVz4l1X'
)

export const GLOBAL_ANNOUNCEMENT_STORE_ID = 'ALL'

// ── Types ─────────────────────────────────────────────────────────────────────

type DbGoal = {
  id: string; store_id: string; title: string; description: string; category: string
  target: number; current_val: number; unit: string; deadline: string
  color: string; daily_target: number; daily_log: Record<string, number>
  milestones: Goal['milestones']; created_at: string
}

type DbSettings = {
  store_id: string; company_name: string; store_number: string; slide_interval: number
  dealer_nickname?: string | null; dealer_location?: string | null
  store_hours?: StoreHours | null
}

export type StoreSummary = DbSettings

type DbEmployee = {
  id: string; store_id: string; name: string; role: string; color: string; sort_order?: number | null; created_at: string
}

type DbShift = {
  id: string; store_id: string; employee_id: string; date: string
  start_time: string; end_time: string; type: Shift['type']; note: string | null
  created_at: string
}

type DbScheduleException = {
  id: string; store_id: string; employee_id: string | null; exception_date: string
  type: ScheduleException['type']; start_time: string | null; end_time: string | null
  note: string | null; created_at: string
}

type DbScheduleBlock = {
  id: string; store_id: string; name: string; start_time: string; end_time: string
  note: string | null; color: string; sort_order: number | null; created_at: string
}

type DbScheduleTemplate = {
  id: string; store_id: string; name: string; shifts: TemplateShift[]; created_at: string
}

type DbEmployeeSchedulePreference = {
  employee_id: string; store_id: string; preferred_days: number[] | null
  unavailable_days: number[] | null; preferred_blocks: string[] | null
  max_hours_per_week: number | null; notes: string | null; updated_at: string
}

type DbEmployeeSale = {
  id: string; store_id: string; employee_id: string | null; sale_date: string
  category: EmployeeSale['category']; gross_revenue: number | null
  accessory_revenue: number | null; protection_count: number | null
  estimated_net_revenue: number | null; note: string | null; created_at: string
}

type DbAnnouncement = {
  id: string; store_id: string; text: string; priority: Announcement['priority']; start_at?: string | null; end_at?: string | null; created_at: string
}

type DbShiftPatch = Partial<{
  employee_id: string
  date: string
  start_time: string
  end_time: string
  type: Shift['type']
  note: string
}>

type DbScheduleBlockPatch = Partial<{
  store_id: string
  name: string
  start_time: string
  end_time: string
  note: string
  color: string
  sort_order: number
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

type DbAnnouncementPatch = Partial<{
  text: string
  priority: Announcement['priority']
  start_at: string | null
  end_at: string | null
}>

type DbScheduleExceptionPatch = Partial<{
  employee_id: string | null
  exception_date: string
  type: ScheduleException['type']
  start_time: string | null
  end_time: string | null
  note: string
}>

function isMissingStoreHoursColumnError(error: unknown) {
  if (!isSupabaseError(error)) return false
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return text.includes('store_hours')
    || text.includes('column app_settings.store_hours does not exist')
    || text.includes("could not find the 'store_hours'")
}

export type StoreAccessCode = {
  id: string
  dealer_code: string
  store_id: string
  assigned_store_ids?: string[]
  role: AccessRole
  label: string | null
  is_active: boolean
  created_at: string
  last_used_at: string | null
  onboarded_at: string | null
}

type DbStoreAccessCode = StoreAccessCode & {
  pin_hash: string
}

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

function isMissingOnboardingColumnError(error: unknown) {
  if (!isSupabaseError(error)) return false
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return text.includes('onboarded_at')
    || text.includes('column store_access_codes.onboarded_at does not exist')
    || text.includes('could not find the')
}

function isMissingEmployeeSortColumnError(error: unknown) {
  if (!isSupabaseError(error)) return false
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return text.includes('sort_order')
    || text.includes('column employees.sort_order does not exist')
    || text.includes('could not find the')
}

function isMissingAnnouncementPeriodColumnError(error: unknown) {
  if (!isSupabaseError(error)) return false
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return text.includes('start_at')
    || text.includes('end_at')
    || text.includes('announcement period')
    || text.includes('could not find the')
}

function throwIfError(error: unknown, context: string) {
  if (!error) return
  const message = isSupabaseError(error)
    ? error.message ?? error.details ?? String(error)
    : error instanceof Error ? error.message : String(error)
  throw new Error(`${context}: ${message}`)
}

let optionalTasksWarningShown = false
let optionalScheduleBlocksWarningShown = false
let optionalScheduleTemplatesWarningShown = false
let optionalScheduleExceptionsWarningShown = false
let optionalEmployeeInsightsWarningShown = false

function logOptionalTasksWarning(action: string, error: unknown) {
  if (!isMissingTableError(error)) return false
  if (!optionalTasksWarningShown) {
    optionalTasksWarningShown = true
    console.warn(`Tasks table is not available in this Supabase project; ${action} will stay local until schema.sql is applied.`)
  }
  return true
}

function logOptionalScheduleBlocksWarning(action: string, error: unknown) {
  if (!isMissingTableError(error)) return false
  if (!optionalScheduleBlocksWarningShown) {
    optionalScheduleBlocksWarningShown = true
    console.warn(`Schedule blocks table is not available in this Supabase project; ${action} will stay local until schema.sql is applied.`)
  }
  return true
}

function logOptionalScheduleTemplatesWarning(action: string, error: unknown) {
  if (!isMissingTableError(error)) return false
  if (!optionalScheduleTemplatesWarningShown) {
    optionalScheduleTemplatesWarningShown = true
    console.warn(`Schedule templates table is not available in this Supabase project; ${action} will stay local until schema.sql is applied.`)
  }
  return true
}

function logOptionalEmployeeInsightsWarning(action: string, error: unknown) {
  if (!isMissingTableError(error)) return false
  if (!optionalEmployeeInsightsWarningShown) {
    optionalEmployeeInsightsWarningShown = true
    console.warn(`Employee insights tables are not available in this Supabase project; ${action} will stay local until schema.sql is applied.`)
  }
  return true
}

// ── Access ───────────────────────────────────────────────────────────────────

const ACCESS_SELECT = 'id, dealer_code, store_id, role, label, is_active, created_at, last_used_at, onboarded_at'
const ACCESS_SELECT_LEGACY = 'id, dealer_code, store_id, role, label, is_active, created_at, last_used_at'
const BUILT_IN_ADMIN_PIN_HASH = '4dcd556f7a07c0c12fbe1bd911c3f5b857ebb09e57f4a0ac76ceeca171f3bc49'
const BUILT_IN_ACCESS: Record<string, Omit<StoreAccessCode, 'created_at' | 'last_used_at' | 'onboarded_at'>> = {
  admin: {
    id: 'built-in-admin',
    dealer_code: 'admin',
    store_id: 'main',
    assigned_store_ids: ['main'],
    role: 'admin',
    label: 'Admin',
    is_active: true,
  },
}

function withLegacyOnboarding(row: Omit<StoreAccessCode, 'onboarded_at'>): StoreAccessCode {
  return { ...row, onboarded_at: null }
}

function normalizeAccessRow(row: StoreAccessCode): StoreAccessCode {
  const dealer_code = row.dealer_code.trim().toLowerCase() === 'admin'
    ? 'admin'
    : normalizeAccessCode(row.dealer_code)
  return {
    ...row,
    dealer_code,
    store_id: normalizeStoreId(row.store_id),
    assigned_store_ids: (row.assigned_store_ids?.length ? row.assigned_store_ids : [row.store_id]).map(normalizeStoreId),
  }
}

async function dbGetAccessAssignments(accessIds: string[]) {
  if (accessIds.length === 0) return new Map<string, string[]>()
  const { data, error } = await supabase
    .from('store_access_assignments')
    .select('access_id, store_id')
    .in('access_id', accessIds)
  if (isMissingTableError(error)) return new Map<string, string[]>()
  throwIfError(error, 'Could not load access store assignments')
  const map = new Map<string, string[]>()
  ;(data ?? []).forEach((row) => {
    const accessId = String(row.access_id)
    map.set(accessId, [...(map.get(accessId) ?? []), normalizeStoreId(String(row.store_id))])
  })
  return map
}

async function withAccessAssignments(rows: StoreAccessCode[]) {
  const assignmentMap = await dbGetAccessAssignments(rows.map((row) => row.id).filter((id) => id !== 'built-in-admin'))
  return rows.map((row) => normalizeAccessRow({
    ...row,
    assigned_store_ids: assignmentMap.get(row.id) ?? row.assigned_store_ids ?? [row.store_id],
  }))
}

export async function dbAuthenticateAccess(dealerCode: string, pinHash: string): Promise<StoreAccessCode | null> {
  const normalizedDealerCode = dealerCode.trim().toLowerCase() === 'admin'
    ? 'admin'
    : normalizeAccessCode(dealerCode)
  const builtInAccess = BUILT_IN_ACCESS[normalizedDealerCode] ?? BUILT_IN_ACCESS[normalizedDealerCode.toLowerCase()]
  if (builtInAccess && pinHash === BUILT_IN_ADMIN_PIN_HASH) {
    const now = new Date().toISOString()
    return {
      ...builtInAccess,
      dealer_code: normalizedDealerCode,
      created_at: now,
      last_used_at: now,
      onboarded_at: now,
    }
  }

  let { data, error } = await supabase
    .from('store_access_codes')
    .select(ACCESS_SELECT)
    .eq('dealer_code', normalizedDealerCode)
    .eq('pin_hash', pinHash)
    .eq('is_active', true)
    .maybeSingle()
  if (error && isMissingOnboardingColumnError(error)) {
    const legacy = await supabase
      .from('store_access_codes')
      .select(ACCESS_SELECT_LEGACY)
      .eq('dealer_code', normalizedDealerCode)
      .eq('pin_hash', pinHash)
      .eq('is_active', true)
      .maybeSingle()
    data = legacy.data ? withLegacyOnboarding(legacy.data as Omit<StoreAccessCode, 'onboarded_at'>) : null
    error = legacy.error
  }
  throwIfError(error, 'Could not validate access')
  if (!data) return null

  await supabase
    .from('store_access_codes')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', (data as StoreAccessCode).id)

  return (await withAccessAssignments([data as StoreAccessCode]))[0]
}

export async function dbGetAccessCodes(): Promise<StoreAccessCode[]> {
  let { data, error } = await supabase
    .from('store_access_codes')
    .select(ACCESS_SELECT)
    .order('created_at', { ascending: false })
  if (error && isMissingOnboardingColumnError(error)) {
    const legacy = await supabase
      .from('store_access_codes')
      .select(ACCESS_SELECT_LEGACY)
      .order('created_at', { ascending: false })
    data = (legacy.data ?? []).map((row) => withLegacyOnboarding(row as Omit<StoreAccessCode, 'onboarded_at'>))
    error = legacy.error
  }
  throwIfError(error, 'Could not load access codes')
  return withAccessAssignments((data ?? []) as StoreAccessCode[])
}

export async function dbCreateAccessCode(code: {
  dealer_code: string
  store_id: string
  pin_hash: string
  role: AccessRole
  label: string
  assigned_store_ids?: string[]
}) {
  const dealerCode = code.dealer_code.trim().toLowerCase() === 'admin'
    ? 'admin'
    : normalizeAccessCode(code.dealer_code)
  const { data, error } = await supabase.from('store_access_codes').insert({
    ...code,
    dealer_code: dealerCode,
    store_id: normalizeStoreId(code.store_id),
    is_active: true,
  } satisfies Partial<DbStoreAccessCode>).select('id').single()
  throwIfError(error, 'Could not create access code')

  if (data?.id) await dbSetAccessAssignments(String(data.id), code.assigned_store_ids?.length ? code.assigned_store_ids : [code.store_id])
}

export async function dbUpdateAccessCode(id: string, patch: Partial<Pick<StoreAccessCode, 'dealer_code' | 'label' | 'role' | 'store_id' | 'is_active'> & { pin_hash: string }>) {
  const normalizedPatch = {
    ...patch,
    ...(patch.dealer_code !== undefined ? {
      dealer_code: patch.dealer_code.trim().toLowerCase() === 'admin' ? 'admin' : normalizeAccessCode(patch.dealer_code),
    } : {}),
    ...(patch.store_id !== undefined ? { store_id: normalizeStoreId(patch.store_id) } : {}),
  }
  const { error } = await supabase.from('store_access_codes').update(normalizedPatch).eq('id', id)
  throwIfError(error, 'Could not update access code')
}

export async function dbSetAccessAssignments(accessId: string, storeIds: string[]) {
  if (accessId === 'built-in-admin') return
  const normalized = Array.from(new Set(storeIds.map(normalizeStoreId).filter(Boolean)))
  const del = await supabase.from('store_access_assignments').delete().eq('access_id', accessId)
  if (isMissingTableError(del.error)) return
  throwIfError(del.error, 'Could not clear access store assignments')
  if (normalized.length === 0) return
  const { error } = await supabase.from('store_access_assignments').insert(
    normalized.map((storeId) => ({ access_id: accessId, store_id: storeId }))
  )
  throwIfError(error, 'Could not save access store assignments')
}

export async function dbDeleteAccessCode(id: string) {
  const { error } = await supabase.from('store_access_codes').delete().eq('id', id)
  throwIfError(error, 'Could not delete access code')
}

export async function dbMarkAccessOnboarded(id: string) {
  const { error } = await supabase
    .from('store_access_codes')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', id)
  if (error && isMissingOnboardingColumnError(error)) return false
  throwIfError(error, 'Could not complete onboarding')
  return true
}

export async function dbResetAccessOnboarding(id: string) {
  const { error } = await supabase
    .from('store_access_codes')
    .update({ onboarded_at: null })
    .eq('id', id)
  if (error && isMissingOnboardingColumnError(error)) return false
  throwIfError(error, 'Could not reset onboarding')
  return true
}

export async function dbCheckSchemaHealth() {
  const tables = ['employees', 'employee_schedule_preferences', 'employee_sales', 'shifts', 'schedule_exceptions', 'schedule_blocks', 'schedule_templates', 'goals', 'announcements', 'app_settings', 'tasks', 'store_access_codes']
  const results = await Promise.all(tables.map(async (table) => {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' })
    return {
      table,
      ok: !error,
      message: error ? (isSupabaseError(error) ? error.message ?? error.details ?? 'Unavailable' : 'Unavailable') : 'Ready',
    }
  }))
  return results
}

// ── Employees ─────────────────────────────────────────────────────────────────

export async function dbGetEmployees(storeId: string): Promise<Employee[]> {
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('store_id', sid)
    .order('created_at')
  throwIfError(error, 'Could not load employees')
  return (data ?? []).map(dbToEmployee).sort(compareEmployees)
}

function dbToEmployee(r: DbEmployee): Employee {
  return { id: r.id, storeId: r.store_id, name: r.name, role: r.role, color: r.color, sortOrder: r.sort_order ?? undefined }
}

function compareEmployees(a: Employee, b: Employee) {
  const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER
  const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER
  if (aOrder !== bOrder) return aOrder - bOrder
  return a.name.localeCompare(b.name)
}

function employeePatchToDb(patch: Partial<Employee>) {
  const dbPatch: Record<string, string | number | undefined> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.role !== undefined) dbPatch.role = patch.role
  if (patch.color !== undefined) dbPatch.color = patch.color
  if (patch.storeId !== undefined) dbPatch.store_id = normalizeStoreId(patch.storeId)
  if (patch.sortOrder !== undefined) dbPatch.sort_order = patch.sortOrder
  return dbPatch
}

export async function dbInsertEmployee(e: Employee, storeId: string) {
  const sid = normalizeStoreId(storeId)
  const { error } = await supabase.from('employees').insert({
    id: e.id, store_id: sid, name: e.name, role: e.role, color: e.color, sort_order: e.sortOrder ?? 0,
  })
  if (error && isMissingEmployeeSortColumnError(error)) {
    const legacy = await supabase.from('employees').insert({
      id: e.id, store_id: sid, name: e.name, role: e.role, color: e.color,
    })
    throwIfError(legacy.error, 'Could not save employee')
    return
  }
  throwIfError(error, 'Could not save employee')
}

export async function dbUpdateEmployee(id: string, patch: Partial<Employee>) {
  const dbPatch = employeePatchToDb(patch)
  if (Object.keys(dbPatch).length === 0) return
  const { error } = await supabase.from('employees').update(dbPatch).eq('id', id)
  if (error && isMissingEmployeeSortColumnError(error)) {
    const legacyPatch = { ...dbPatch }
    delete legacyPatch.sort_order
    if (Object.keys(legacyPatch).length === 0) return
    const legacy = await supabase.from('employees').update(legacyPatch).eq('id', id)
    throwIfError(legacy.error, 'Could not update employee')
    return
  }
  throwIfError(error, 'Could not update employee')
}

export async function dbDeleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  throwIfError(error, 'Could not delete employee')
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function dbGetShifts(storeId: string): Promise<Shift[]> {
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('shifts').select('*').eq('store_id', sid).order('date')
  throwIfError(error, 'Could not load shifts')
  return ((data ?? []) as DbShift[]).map((r) => ({
    id: r.id, storeId: r.store_id, employeeId: r.employee_id, date: r.date,
    startTime: r.start_time, endTime: r.end_time, type: r.type, note: r.note ?? '',
  }))
}

export async function dbInsertShift(s: Shift, storeId: string) {
  const sid = normalizeStoreId(storeId)
  const { error } = await supabase.from('shifts').insert({
    id: s.id, store_id: sid, employee_id: s.employeeId, date: s.date,
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

// ── Schedule blocks ──────────────────────────────────────────────────────────

function scheduleExceptionToDb(exception: ScheduleException, storeId: string) {
  return {
    id: exception.id,
    store_id: normalizeStoreId(exception.storeId ?? storeId),
    employee_id: exception.type === 'holiday' ? null : exception.employeeId ?? null,
    exception_date: exception.date,
    type: exception.type,
    start_time: exception.startTime || null,
    end_time: exception.endTime || null,
    note: exception.note ?? '',
  }
}

function dbToScheduleException(row: DbScheduleException): ScheduleException {
  return {
    id: row.id,
    storeId: row.store_id,
    employeeId: row.employee_id,
    date: row.exception_date,
    type: row.type,
    startTime: row.start_time,
    endTime: row.end_time,
    note: row.note ?? '',
    createdAt: row.created_at,
  }
}

export async function dbGetScheduleExceptions(storeId: string): Promise<ScheduleException[]> {
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('schedule_exceptions')
    .select('*')
    .eq('store_id', sid)
    .order('exception_date')
    .order('created_at')
  if (logOptionalScheduleExceptionsWarning('schedule exceptions', error)) return []
  throwIfError(error, 'Could not load schedule exceptions')
  return ((data ?? []) as DbScheduleException[]).map(dbToScheduleException)
}

export async function dbInsertScheduleException(exception: ScheduleException, storeId: string) {
  const { error } = await supabase.from('schedule_exceptions').insert(scheduleExceptionToDb(exception, storeId))
  if (!logOptionalScheduleExceptionsWarning('new schedule exceptions', error)) throwIfError(error, 'Could not save schedule exception')
}

export async function dbUpdateScheduleException(id: string, patch: Partial<ScheduleException>) {
  const dbPatch: DbScheduleExceptionPatch = {}
  if (patch.employeeId !== undefined) dbPatch.employee_id = patch.type === 'holiday' ? null : patch.employeeId ?? null
  if (patch.date !== undefined) dbPatch.exception_date = patch.date
  if (patch.type !== undefined) dbPatch.type = patch.type
  if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime || null
  if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime || null
  if (patch.note !== undefined) dbPatch.note = patch.note
  const { error } = await supabase.from('schedule_exceptions').update(dbPatch).eq('id', id)
  if (!logOptionalScheduleExceptionsWarning('schedule exception updates', error)) throwIfError(error, 'Could not update schedule exception')
}

export async function dbDeleteScheduleException(id: string) {
  const { error } = await supabase.from('schedule_exceptions').delete().eq('id', id)
  if (!logOptionalScheduleExceptionsWarning('schedule exception deletion', error)) throwIfError(error, 'Could not delete schedule exception')
}

function dbToScheduleBlock(r: DbScheduleBlock): ScheduleBlock {
  return {
    id: r.id,
    storeId: r.store_id,
    name: r.name,
    startTime: r.start_time,
    endTime: r.end_time,
    note: r.note ?? '',
    color: r.color,
    sortOrder: r.sort_order ?? 0,
  }
}

function scheduleBlockToDb(block: ScheduleBlock, storeId: string) {
  return {
    id: block.id,
    store_id: normalizeStoreId(block.storeId ?? storeId),
    name: block.name,
    start_time: block.startTime,
    end_time: block.endTime,
    note: block.note ?? '',
    color: block.color,
    sort_order: block.sortOrder,
  }
}

export async function dbGetScheduleBlocks(storeId: string): Promise<ScheduleBlock[]> {
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('store_id', sid)
    .order('sort_order')
    .order('name')
  if (logOptionalScheduleBlocksWarning('schedule block data', error)) return []
  throwIfError(error, 'Could not load schedule blocks')
  return ((data ?? []) as DbScheduleBlock[]).map(dbToScheduleBlock)
}

export async function dbInsertScheduleBlock(block: ScheduleBlock, storeId: string) {
  const { error } = await supabase.from('schedule_blocks').insert(scheduleBlockToDb(block, storeId))
  if (!logOptionalScheduleBlocksWarning('new schedule blocks', error)) throwIfError(error, 'Could not save schedule block')
}

export async function dbUpdateScheduleBlock(id: string, patch: Partial<Omit<ScheduleBlock, 'id'>>) {
  const dbPatch: DbScheduleBlockPatch = {}
  if (patch.storeId !== undefined) dbPatch.store_id = normalizeStoreId(patch.storeId)
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime
  if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime
  if (patch.note !== undefined) dbPatch.note = patch.note
  if (patch.color !== undefined) dbPatch.color = patch.color
  if (patch.sortOrder !== undefined) dbPatch.sort_order = patch.sortOrder
  if (Object.keys(dbPatch).length === 0) return
  const { error } = await supabase.from('schedule_blocks').update(dbPatch).eq('id', id)
  if (!logOptionalScheduleBlocksWarning('schedule block updates', error)) throwIfError(error, 'Could not update schedule block')
}

export async function dbDeleteScheduleBlock(id: string) {
  const { error } = await supabase.from('schedule_blocks').delete().eq('id', id)
  if (!logOptionalScheduleBlocksWarning('schedule block deletion', error)) throwIfError(error, 'Could not delete schedule block')
}

// ── Schedule templates ───────────────────────────────────────────────────────

function dbToScheduleTemplate(r: DbScheduleTemplate): ScheduleTemplate {
  return {
    id: r.id,
    storeId: r.store_id,
    name: r.name,
    shifts: Array.isArray(r.shifts) ? r.shifts : [],
    createdAt: r.created_at,
  }
}

function scheduleTemplateToDb(template: ScheduleTemplate, storeId: string) {
  return {
    id: template.id,
    store_id: normalizeStoreId(template.storeId ?? storeId),
    name: template.name,
    shifts: template.shifts,
    created_at: template.createdAt,
  }
}

export async function dbGetScheduleTemplates(storeId: string): Promise<ScheduleTemplate[]> {
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('schedule_templates')
    .select('*')
    .eq('store_id', sid)
    .order('created_at', { ascending: false })
  if (logOptionalScheduleTemplatesWarning('schedule templates', error)) return []
  throwIfError(error, 'Could not load schedule templates')
  return ((data ?? []) as DbScheduleTemplate[]).map(dbToScheduleTemplate)
}

export async function dbInsertScheduleTemplate(template: ScheduleTemplate, storeId: string): Promise<boolean> {
  const { error } = await supabase.from('schedule_templates').upsert(scheduleTemplateToDb(template, storeId))
  if (logOptionalScheduleTemplatesWarning('new schedule templates', error)) return false
  throwIfError(error, 'Could not save schedule template')
  return true
}

export async function dbDeleteScheduleTemplate(id: string): Promise<boolean> {
  const { error } = await supabase.from('schedule_templates').delete().eq('id', id)
  if (logOptionalScheduleTemplatesWarning('schedule template deletion', error)) return false
  throwIfError(error, 'Could not delete schedule template')
  return true
}

// ── Employee insights ────────────────────────────────────────────────────────

function dbToEmployeeSchedulePreference(r: DbEmployeeSchedulePreference): EmployeeSchedulePreference {
  return {
    employeeId: r.employee_id ?? '',
    storeId: r.store_id,
    preferredDays: r.preferred_days ?? [],
    unavailableDays: r.unavailable_days ?? [],
    preferredBlocks: r.preferred_blocks ?? [],
    maxHoursPerWeek: r.max_hours_per_week,
    notes: r.notes ?? '',
    updatedAt: r.updated_at,
  }
}

function employeeSchedulePreferenceToDb(preference: EmployeeSchedulePreference, storeId: string) {
  return {
    employee_id: preference.employeeId,
    store_id: normalizeStoreId(preference.storeId ?? storeId),
    preferred_days: preference.preferredDays,
    unavailable_days: preference.unavailableDays,
    preferred_blocks: preference.preferredBlocks,
    max_hours_per_week: preference.maxHoursPerWeek,
    notes: preference.notes,
    updated_at: preference.updatedAt,
  }
}

function dbToEmployeeSale(r: DbEmployeeSale): EmployeeSale {
  return {
    id: r.id,
    storeId: r.store_id,
    employeeId: r.employee_id ?? '',
    saleDate: r.sale_date,
    category: r.category,
    grossRevenue: r.gross_revenue ?? 0,
    accessoryRevenue: r.accessory_revenue ?? 0,
    protectionCount: r.protection_count ?? 0,
    estimatedNetRevenue: r.estimated_net_revenue ?? 0,
    note: r.note ?? '',
    createdAt: r.created_at,
  }
}

function employeeSaleToDb(sale: EmployeeSale, storeId: string) {
  return {
    id: sale.id,
    store_id: normalizeStoreId(sale.storeId ?? storeId),
    employee_id: sale.employeeId,
    sale_date: sale.saleDate,
    category: sale.category,
    gross_revenue: sale.grossRevenue,
    accessory_revenue: sale.accessoryRevenue,
    protection_count: sale.protectionCount,
    estimated_net_revenue: sale.estimatedNetRevenue,
    note: sale.note,
    created_at: sale.createdAt,
  }
}

export async function dbGetEmployeeSchedulePreferences(storeId: string): Promise<EmployeeSchedulePreference[]> {
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('employee_schedule_preferences')
    .select('*')
    .eq('store_id', sid)
  if (logOptionalEmployeeInsightsWarning('employee schedule preferences', error)) return []
  throwIfError(error, 'Could not load employee schedule preferences')
  return ((data ?? []) as DbEmployeeSchedulePreference[]).map(dbToEmployeeSchedulePreference)
}

export async function dbUpsertEmployeeSchedulePreference(preference: EmployeeSchedulePreference, storeId: string): Promise<boolean> {
  const { error } = await supabase
    .from('employee_schedule_preferences')
    .upsert(employeeSchedulePreferenceToDb(preference, storeId))
  if (logOptionalEmployeeInsightsWarning('employee schedule preference updates', error)) return false
  throwIfError(error, 'Could not save employee schedule preference')
  return true
}

export async function dbGetEmployeeSales(storeId: string): Promise<EmployeeSale[]> {
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('employee_sales')
    .select('*')
    .eq('store_id', sid)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (logOptionalEmployeeInsightsWarning('employee sales', error)) return []
  throwIfError(error, 'Could not load employee sales')
  return ((data ?? []) as DbEmployeeSale[]).map(dbToEmployeeSale)
}

export async function dbInsertEmployeeSale(sale: EmployeeSale, storeId: string): Promise<boolean> {
  const { error } = await supabase.from('employee_sales').insert(employeeSaleToDb(sale, storeId))
  if (logOptionalEmployeeInsightsWarning('employee sale entries', error)) return false
  throwIfError(error, 'Could not save employee sale')
  return true
}

export async function dbDeleteEmployeeSale(id: string): Promise<boolean> {
  const { error } = await supabase.from('employee_sales').delete().eq('id', id)
  if (logOptionalEmployeeInsightsWarning('employee sale deletion', error)) return false
  throwIfError(error, 'Could not delete employee sale')
  return true
}

export async function dbSaveScheduleSnapshot(storeId: string, employees: Employee[], shifts: Shift[]) {
  const sid = normalizeStoreId(storeId)
  const snapshotEmployees = employees.filter((employee) => normalizeStoreId(employee.storeId ?? sid) === sid)
  const snapshotShifts = shifts.filter((shift) => normalizeStoreId(shift.storeId ?? sid) === sid)
  useSyncStore.getState().setSync('schedule', 'saving', 'Saving schedule snapshot')
  if (snapshotEmployees.length > 0) {
    const { error } = await supabase.from('employees').upsert(snapshotEmployees.map((e, index) => ({
      id: e.id,
      store_id: sid,
      name: e.name,
      role: e.role,
      color: e.color,
      sort_order: e.sortOrder ?? index,
    })))
    if (error && isMissingEmployeeSortColumnError(error)) {
      const legacy = await supabase.from('employees').upsert(snapshotEmployees.map((e) => ({
        id: e.id,
        store_id: sid,
        name: e.name,
        role: e.role,
        color: e.color,
      })))
      throwIfError(legacy.error, 'Could not save schedule employees')
    } else {
      throwIfError(error, 'Could not save schedule employees')
    }
  }

  if (snapshotShifts.length > 0) {
    const { error } = await supabase.from('shifts').upsert(snapshotShifts.map((s) => ({
      id: s.id,
      store_id: sid,
      employee_id: s.employeeId,
      date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
      type: s.type,
      note: s.note ?? '',
    })))
    throwIfError(error, 'Could not save schedule shifts')
  }

  const [existingEmployees, existingShifts] = await Promise.all([
    dbGetEmployees(sid),
    dbGetShifts(sid),
  ])
  const snapshotEmployeeIds = new Set(snapshotEmployees.map((employee) => employee.id))
  const snapshotShiftIds = new Set(snapshotShifts.map((shift) => shift.id))
  const employeeIdsToDelete = existingEmployees.filter((employee) => !snapshotEmployeeIds.has(employee.id)).map((employee) => employee.id)
  const shiftIdsToDelete = existingShifts.filter((shift) => !snapshotShiftIds.has(shift.id)).map((shift) => shift.id)

  if (shiftIdsToDelete.length > 0) {
    const { error } = await supabase.from('shifts').delete().in('id', shiftIdsToDelete)
    throwIfError(error, 'Could not remove deleted schedule shifts')
  }
  if (employeeIdsToDelete.length > 0) {
    const { error } = await supabase.from('employees').delete().in('id', employeeIdsToDelete)
    throwIfError(error, 'Could not remove deleted schedule employees')
  }

  const [savedEmployees, savedShifts] = await Promise.all([
    dbGetEmployees(sid),
    dbGetShifts(sid),
  ])

  const employeeIds = new Set(savedEmployees.map((employee) => employee.id))
  const shiftIds = new Set(savedShifts.map((shift) => shift.id))
  const missingEmployees = snapshotEmployees.filter((employee) => !employeeIds.has(employee.id))
  const missingShifts = snapshotShifts.filter((shift) => !shiftIds.has(shift.id))
  const extraEmployees = savedEmployees.filter((employee) => !snapshotEmployeeIds.has(employee.id))
  const extraShifts = savedShifts.filter((shift) => !snapshotShiftIds.has(shift.id))

  if (missingEmployees.length > 0 || missingShifts.length > 0 || extraEmployees.length > 0 || extraShifts.length > 0) {
    useSyncStore.getState().setSync('schedule', 'error', 'Schedule validation failed')
    throw new Error(`Schedule validation failed: ${missingEmployees.length} employees and ${missingShifts.length} shifts were missing; ${extraEmployees.length} employees and ${extraShifts.length} shifts were not removed`)
  }
  useSyncStore.getState().setSync('schedule', 'synced', `${snapshotEmployees.length} employees and ${snapshotShifts.length} shifts confirmed`)
}

function logOptionalScheduleExceptionsWarning(action: string, error: unknown) {
  if (!isMissingTableError(error)) return false
  if (!optionalScheduleExceptionsWarningShown) {
    optionalScheduleExceptionsWarningShown = true
    console.warn(`Schedule exceptions table is not available in this Supabase project; ${action} will stay local until migration is applied.`)
  }
  return true
}

// ── Goals ─────────────────────────────────────────────────────────────────────

function goalToDb(g: Goal, storeId: string) {
  return {
    id: g.id, store_id: normalizeStoreId(storeId), title: g.title, description: g.description,
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
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('goals').select('*').eq('store_id', sid).order('created_at')
  throwIfError(error, 'Could not load goals')
  return (data ?? []).map(dbToGoal)
}

export async function dbInsertGoal(g: Goal, storeId: string) {
  const sid = normalizeStoreId(storeId)
  const isSnapshotGoal = g.category === SNAPSHOT_CATEGORY && g.description.startsWith(SNAPSHOT_PREFIX)

  if (isSnapshotGoal) {
    const { data: existing, error: existingError } = await supabase
      .from('goals')
      .select('id')
      .eq('store_id', sid)
      .eq('category', SNAPSHOT_CATEGORY)
      .eq('description', g.description)
      .maybeSingle()
    throwIfError(existingError, 'Could not load existing snapshot goal')
    if (existing?.id) {
      await dbUpdateGoal(String(existing.id), {
        title: g.title,
        target: g.target,
        current: g.current,
        unit: g.unit,
        deadline: g.deadline,
        color: g.color,
        dailyTarget: g.dailyTarget,
        milestones: g.milestones,
      })
      return
    }
  }

  const { error } = await supabase.from('goals').insert(goalToDb(g, sid))
  if (error?.code === '23505' && isSnapshotGoal) {
    const { data: existing, error: existingError } = await supabase
      .from('goals')
      .select('id')
      .eq('store_id', sid)
      .eq('category', SNAPSHOT_CATEGORY)
      .eq('description', g.description)
      .maybeSingle()
    throwIfError(existingError, 'Could not load existing snapshot goal')
    if (existing?.id) {
      await dbUpdateGoal(String(existing.id), {
        title: g.title,
        target: g.target,
        current: g.current,
        unit: g.unit,
        deadline: g.deadline,
        color: g.color,
        dailyTarget: g.dailyTarget,
        milestones: g.milestones,
      })
      return
    }
  }
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

const SNAPSHOT_CATEGORY = 'Performance Snapshot'
const SNAPSHOT_PREFIX = 'source-snapshot:'
const SNAPSHOT_METRICS: Array<{
  key: keyof Pick<PerformanceRow, 'netRevenue' | 'accessoryRevenue' | 'totalPp' | 'traffic' | 'vl' | 'bts' | 'hsi' | 'visa'>
  title: string
  unit: string
  color: string
  goal: (row: PerformanceRow) => number
}> = [
  { key: 'netRevenue', title: 'Net Revenue', unit: '$', color: '#16c60c', goal: (row) => row.netRevenueGoal },
  { key: 'accessoryRevenue', title: 'Accessories', unit: '$', color: '#00b7c3', goal: (row) => row.accessoryGoal },
  { key: 'totalPp', title: 'Total PP', unit: '', color: '#7c5ff5', goal: (row) => row.dortGoal },
  { key: 'traffic', title: 'Traffic', unit: '', color: '#f7b731', goal: () => 0 },
  { key: 'vl', title: 'Voice Lines', unit: '', color: '#0f7ad8', goal: (row) => row.dortGoal * 0.5 },
  { key: 'bts', title: 'BTS', unit: '', color: '#f7630c', goal: (row) => row.dortGoal * 0.4 },
  { key: 'hsi', title: 'HSI', unit: '', color: '#e3008c', goal: (row) => row.dortGoal * 0.1 },
  { key: 'visa', title: 'VISA', unit: '', color: '#e74856', goal: () => 0 },
]

function todayKey() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function snapshotDescription(metricKey: string) {
  return `${SNAPSHOT_PREFIX}${metricKey}`
}

function metricKeyFromSnapshotGoal(goal: Pick<Goal, 'description'>) {
  return goal.description.startsWith(SNAPSHOT_PREFIX)
    ? goal.description.slice(SNAPSHOT_PREFIX.length)
    : ''
}

export async function dbForceEodSnapshot(): Promise<{ message: string; updated: number; forced?: boolean }> {
  const snapshotDay = todayKey()
  const source = await fetchPerformanceData()
  const targets = [
    ...(source.total ? [{ storeId: 'main', row: source.total }] : []),
    ...source.rows.map((row) => ({ storeId: normalizeStoreId(row.storeCode), row })),
  ]
  const { data: existingRows, error: existingError } = await supabase
    .from('goals')
    .select('*')
    .eq('category', SNAPSHOT_CATEGORY)
  throwIfError(existingError, 'Could not load existing snapshots')

  const existingGoals = ((existingRows ?? []) as DbGoal[]).map(dbToGoal)
  const rows = targets.flatMap(({ storeId, row }) => (
    SNAPSHOT_METRICS.map((metric) => {
      const existing = existingGoals.find((goal) => (
        normalizeStoreId(goal.storeId ?? '') === normalizeStoreId(storeId)
        && metricKeyFromSnapshotGoal(goal) === metric.key
      ))
      const liveValue = Number(row[metric.key]) || 0
      const dailyLog = { ...(existing?.dailyLog ?? {}), [snapshotDay]: Math.max(0, liveValue) }

      return {
        id: existing?.id ?? crypto.randomUUID(),
        store_id: normalizeStoreId(storeId),
        title: metric.title,
        description: snapshotDescription(metric.key),
        category: SNAPSHOT_CATEGORY,
        target: 0,
        current_val: liveValue,
        unit: metric.unit,
        deadline: new Date().toISOString(),
        color: metric.color,
        daily_target: metric.goal(row),
        daily_log: dailyLog,
        milestones: existing?.milestones ?? [],
      }
    })
  ))

  if (rows.length > 0) {
    const { error } = await supabase.from('goals').upsert(rows)
    throwIfError(error, 'Could not save EOD snapshot')
  }

  return {
    message: `Successfully saved EOD snapshots for ${snapshotDay}`,
    updated: rows.length,
    forced: true,
  }
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function dbGetAnnouncements(storeId: string): Promise<Announcement[]> {
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('announcements').select('*').in('store_id', [sid, GLOBAL_ANNOUNCEMENT_STORE_ID]).order('created_at')
  throwIfError(error, 'Could not load announcements')
  return (data ?? []).map(dbToAnnouncement)
}

function dbToAnnouncement(r: DbAnnouncement): Announcement {
  return { id: r.id, storeId: r.store_id, text: r.text, priority: r.priority, startAt: r.start_at ?? undefined, endAt: r.end_at ?? undefined, createdAt: r.created_at }
}

export async function dbInsertAnnouncement(a: Announcement, storeId: string) {
  const sid = storeId === GLOBAL_ANNOUNCEMENT_STORE_ID ? GLOBAL_ANNOUNCEMENT_STORE_ID : normalizeStoreId(storeId)
  const row = {
    id: a.id, store_id: sid, text: a.text, priority: a.priority,
    start_at: a.startAt ?? null, end_at: a.endAt ?? null,
  }
  const { error } = await supabase.from('announcements').insert(row)
  if (error && isMissingAnnouncementPeriodColumnError(error)) {
    const legacy = await supabase.from('announcements').insert({
      id: a.id, store_id: sid, text: a.text, priority: a.priority,
    })
    throwIfError(legacy.error, 'Could not save announcement')
    return
  }
  throwIfError(error, 'Could not save announcement')
}

export async function dbUpdateAnnouncement(id: string, patch: Partial<Announcement>) {
  const dbPatch: DbAnnouncementPatch = {}
  if (patch.text !== undefined) dbPatch.text = patch.text
  if (patch.priority !== undefined) dbPatch.priority = patch.priority
  if (patch.startAt !== undefined) dbPatch.start_at = patch.startAt || null
  if (patch.endAt !== undefined) dbPatch.end_at = patch.endAt || null
  const { error } = await supabase.from('announcements').update(dbPatch).eq('id', id)
  if (error && isMissingAnnouncementPeriodColumnError(error)) {
    const legacyPatch = { ...dbPatch }
    delete legacyPatch.start_at
    delete legacyPatch.end_at
    if (Object.keys(legacyPatch).length === 0) return
    const legacy = await supabase.from('announcements').update(legacyPatch).eq('id', id)
    throwIfError(legacy.error, 'Could not update announcement')
    return
  }
  throwIfError(error, 'Could not update announcement')
}

export async function dbDeleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  throwIfError(error, 'Could not delete announcement')
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function dbGetSettings(storeId: string): Promise<DbSettings | null> {
  const sid = normalizeStoreId(storeId)
  let { data, error } = await supabase
    .from('app_settings').select('*').eq('store_id', sid).maybeSingle()
  if (error && isMissingStoreHoursColumnError(error)) {
    const legacy = await supabase
      .from('app_settings')
      .select('store_id, company_name, store_number, slide_interval, dealer_nickname, dealer_location')
      .eq('store_id', sid)
      .maybeSingle()
    data = legacy.data ? { ...legacy.data, store_hours: normalizeStoreHours(null) } : null
    error = legacy.error
  }
  throwIfError(error, 'Could not load app settings')
  const settings = data ? { ...(data as DbSettings), store_hours: normalizeStoreHours((data as DbSettings).store_hours) } : null
  if (settings) setDealerOverride(settings)
  return settings
}

export async function dbGetStores(): Promise<StoreSummary[]> {
  let { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .order('store_id')
  if (error && isMissingStoreHoursColumnError(error)) {
    const legacy = await supabase
      .from('app_settings')
      .select('store_id, company_name, store_number, slide_interval, dealer_nickname, dealer_location')
      .order('store_id')
    data = (legacy.data ?? []).map((row) => ({ ...row, store_hours: normalizeStoreHours(null) }))
    error = legacy.error
  }
  throwIfError(error, 'Could not load stores')
  const stores = (data ?? []).map((store) => ({
    ...store,
    store_id: normalizeStoreId(store.store_id),
    store_hours: normalizeStoreHours((store as DbSettings).store_hours),
  })) as StoreSummary[]
  setDealerOverrides(stores)
  return stores
}

export async function dbDeleteSettings(storeId: string) {
  const { error } = await supabase.from('app_settings').delete().eq('store_id', normalizeStoreId(storeId))
  throwIfError(error, 'Could not remove store')
}

export async function dbUpdateSettings(storeId: string, patch: Partial<Omit<DbSettings, 'store_id'>>) {
  const sid = normalizeStoreId(storeId)
  useSyncStore.getState().setSync('settings', 'saving', 'Saving app settings')
  const normalizedPatch = patch.store_hours !== undefined ? { ...patch, store_hours: normalizeStoreHours(patch.store_hours) } : patch
  const { error } = await supabase.from('app_settings').upsert({ store_id: sid, ...normalizedPatch })
  if (error && isMissingStoreHoursColumnError(error)) {
    useSyncStore.getState().setSync('settings', 'error', 'Store hours column is missing in Supabase')
    throw new Error('Supabase is missing the app_settings.store_hours column. Run the latest schema.sql migration.')
  }
  if (error && isSupabaseError(error) && /dealer_(nickname|location)|schema cache/i.test(error.message ?? '')) {
    const legacyPatch = { ...normalizedPatch }
    delete legacyPatch.dealer_nickname
    delete legacyPatch.dealer_location
    const legacy = await supabase.from('app_settings').upsert({ store_id: sid, ...legacyPatch })
    if (!legacy.error) {
      useSyncStore.getState().setSync('settings', 'error', 'Store nickname/location columns are missing in Supabase')
      throw new Error('Supabase is missing dealer_nickname and dealer_location columns. Run the app_settings store label migration.')
    }
  }
  if (error) useSyncStore.getState().setSync('settings', 'error', isSupabaseError(error) ? error.message ?? 'Settings sync failed' : 'Settings sync failed')
  throwIfError(error, 'Could not save app settings')
  setDealerOverride({ store_id: sid, dealer_nickname: patch.dealer_nickname, dealer_location: patch.dealer_location })
  useSyncStore.getState().setSync('settings', 'synced', 'Settings confirmed in Supabase')
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

type DbTask = {
  id: string; store_id: string; title: string; category: string
  sort_order: number; completed_date: string | null; created_at: string
}

function taskToDb(t: Task, storeId: string) {
  return {
    id: t.id, store_id: normalizeStoreId(storeId), title: t.title, category: t.category,
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
  const sid = normalizeStoreId(storeId)
  const { data, error } = await supabase
    .from('tasks').select('*').eq('store_id', sid).order('sort_order').order('created_at')
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

export async function dbSaveTasksSnapshot(storeId: string, tasks: Task[]) {
  const sid = normalizeStoreId(storeId)
  useSyncStore.getState().setSync('tasks', 'saving', 'Saving task snapshot')
  if (tasks.length > 0) {
    const { error } = await supabase.from('tasks').upsert(tasks.map((t) => taskToDb(t, t.storeId ?? sid)))
    if (logOptionalTasksWarning('tasks', error)) {
      throw new Error('Tasks table is not available in this Supabase project')
    }
    throwIfError(error, 'Could not save tasks')
  }

  const savedTasks = await dbGetTasks(sid)
  const savedIds = new Set(savedTasks.map((task) => task.id))
  const missingTasks = tasks.filter((task) => normalizeStoreId(task.storeId ?? sid) === sid && !savedIds.has(task.id))

  if (missingTasks.length > 0) {
    useSyncStore.getState().setSync('tasks', 'error', 'Task validation failed')
    throw new Error(`Task validation failed: ${missingTasks.length} tasks were not confirmed in Supabase`)
  }
  useSyncStore.getState().setSync('tasks', 'synced', `${tasks.length} tasks confirmed`)
}
