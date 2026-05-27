import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { supabase, dbGetEmployees, dbGetShifts, dbGetScheduleBlocks, dbGetGoals, dbGetAnnouncements, dbGetSettings, dbGetStores, dbGetTasks, GLOBAL_ANNOUNCEMENT_STORE_ID } from '../lib/supabase'
import { useScheduleStore } from '../store/scheduleStore'
import { useScheduleBlocksStore } from '../store/scheduleBlocksStore'
import { useGoalsStore } from '../store/goalsStore'
import { useDisplayStore } from '../store/displayStore'
import { useUiStore } from '../store/uiStore'
import { useTasksStore } from '../store/tasksStore'
import { DashboardLoader } from './ui/DashboardLoader'
import type { Employee, Shift } from '../store/scheduleStore'
import type { ScheduleBlock } from '../store/scheduleBlocksStore'
import type { Goal } from '../store/goalsStore'
import type { Announcement } from '../store/displayStore'
import type { Task } from '../store/tasksStore'

type StoreScopedRow = { id: string; store_id: string }
type EmployeeRow = StoreScopedRow & { name: string; role: string; color: string; sort_order?: number | null }
type ShiftRow = StoreScopedRow & {
  employee_id: string
  date: string
  start_time: string
  end_time: string
  type: Shift['type']
  note?: string | null
}
type ScheduleBlockRow = StoreScopedRow & {
  name: string
  start_time: string
  end_time: string
  note?: string | null
  color: string
  sort_order?: number | null
}
type GoalRow = StoreScopedRow & {
  title: string
  description: string
  category: string
  target: number
  current_val: number
  unit: string
  deadline: string
  color: string
  daily_target: number
  daily_log?: Goal['dailyLog'] | null
  milestones?: Goal['milestones'] | null
  created_at: string
}
type AnnouncementRow = StoreScopedRow & {
  text: string
  priority: Announcement['priority']
  start_at?: string | null
  end_at?: string | null
  created_at: string
}
type SettingsRow = {
  company_name: string
  store_number: string
  slide_interval: number
}
type TaskRow = StoreScopedRow & {
  title: string
  category: Task['category']
  sort_order: number
  completed_date?: string | null
  created_at: string
}

const employeeFromRow = (r: EmployeeRow): Employee => ({
  id: r.id,
  storeId: r.store_id,
  name: r.name,
  role: r.role,
  color: r.color,
  sortOrder: r.sort_order ?? undefined,
})

function sortEmployees(employees: Employee[]) {
  return [...employees].sort((a, b) => {
    const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER
    const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name)
  })
}

const shiftFromRow = (r: ShiftRow): Shift => ({
  id: r.id,
  storeId: r.store_id,
  employeeId: r.employee_id,
  date: r.date,
  startTime: r.start_time,
  endTime: r.end_time,
  type: r.type,
  note: r.note ?? '',
})

const scheduleBlockFromRow = (r: ScheduleBlockRow): ScheduleBlock => ({
  id: r.id,
  storeId: r.store_id,
  name: r.name,
  startTime: r.start_time,
  endTime: r.end_time,
  note: r.note ?? '',
  color: r.color,
  sortOrder: r.sort_order ?? 0,
})

function sortScheduleBlocks(blocks: ScheduleBlock[]) {
  return [...blocks].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.name.localeCompare(b.name)
  })
}

function uniqueAnnouncements(announcements: Announcement[]) {
  return Array.from(new Map(announcements.map((announcement) => [announcement.id, announcement])).values())
}

const goalFromRow = (r: GoalRow): Goal => ({
  id: r.id,
  storeId: r.store_id,
  title: r.title,
  description: r.description,
  category: r.category,
  target: r.target,
  current: r.current_val,
  unit: r.unit,
  deadline: r.deadline,
  color: r.color,
  dailyTarget: r.daily_target,
  dailyLog: r.daily_log ?? {},
  milestones: r.milestones ?? [],
  createdAt: r.created_at,
})

const announcementFromRow = (r: AnnouncementRow): Announcement => ({
  id: r.id,
  storeId: r.store_id,
  text: r.text,
  priority: r.priority,
  startAt: r.start_at ?? undefined,
  endAt: r.end_at ?? undefined,
  createdAt: r.created_at,
})

const taskFromRow = (r: TaskRow): Task => ({
  id: r.id,
  storeId: r.store_id,
  title: r.title,
  category: r.category,
  sortOrder: r.sort_order,
  completedDate: r.completed_date ?? null,
  createdAt: r.created_at,
})

export function DataProvider({ children }: { children: React.ReactNode }) {
  const storeId      = useUiStore((s) => s.storeId)
  const activeTab    = useUiStore((s) => s.activeTab)
  const scheduleInit = useScheduleStore((s) => s._init)
  const scheduleBlocksInit = useScheduleBlocksStore((s) => s._init)
  const goalsInit    = useGoalsStore((s) => s._init)
  const displayInit  = useDisplayStore((s) => s._init)
  const tasksInit    = useTasksStore((s) => s._init)
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const isMain = storeId === 'main'
    const shouldSyncTasks = activeTab === 'tasks'

    // ── Load all data for this store ────────────────────────────
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const storeIds = isMain
          ? (await dbGetStores()).map((store) => store.store_id).filter((id) => id && id !== 'main')
          : [storeId || 'DEFAULT']

        const goalStoreIds = isMain ? ['main', ...storeIds] : storeIds

        const [employeeSets, shiftSets, blockSets, goalSets, announcementSets, settings, taskSets] = await Promise.all([
          Promise.all(storeIds.map(dbGetEmployees)),
          Promise.all(storeIds.map(dbGetShifts)),
          Promise.all(storeIds.map(dbGetScheduleBlocks)),
          Promise.all(goalStoreIds.map(dbGetGoals)),
          Promise.all(storeIds.map(dbGetAnnouncements)),
          isMain ? Promise.resolve({ company_name: 'Main Dashboard', store_number: 'All Stores', slide_interval: 8 }) : dbGetSettings(storeIds[0]),
          shouldSyncTasks ? Promise.all(storeIds.map(dbGetTasks)) : Promise.resolve([]),
        ])
        if (cancelled) return
        scheduleInit(sortEmployees(employeeSets.flat()), shiftSets.flat())
        scheduleBlocksInit(sortScheduleBlocks(blockSets.flat()))
        goalsInit(goalSets.flat())
        displayInit(
          uniqueAnnouncements(announcementSets.flat()),
          settings ?? { company_name: 'Luna Store', store_number: '', slide_interval: 8 }
        )
        if (shouldSyncTasks) tasksInit(taskSets.flat())
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load dashboard data')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()

    // ── Real-time: filter by store_id ────────────────────────────
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    let channel = supabase
      .channel(`luna-${storeId}`)

      // Employees
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employees', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const employee = employeeFromRow(p.new as EmployeeRow)
        useScheduleStore.setState((s) => ({ employees: sortEmployees([...s.employees.filter((e) => e.id !== employee.id), employee]) }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const employee = employeeFromRow(p.new as EmployeeRow)
        useScheduleStore.setState((s) => ({ employees: sortEmployees(s.employees.map((e) => e.id === employee.id ? employee : e)) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'employees' }, (p) => {
        const old = p.old as StoreScopedRow
        if (!isMain && old.store_id !== storeId) return
        useScheduleStore.setState((s) => ({ employees: s.employees.filter((e) => e.id !== old.id) }))
      })

      // Shifts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shifts', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const shift = shiftFromRow(p.new as ShiftRow)
        useScheduleStore.setState((s) => ({ shifts: [...s.shifts.filter((sh) => sh.id !== shift.id), shift] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shifts', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const shift = shiftFromRow(p.new as ShiftRow)
        useScheduleStore.setState((s) => ({ shifts: s.shifts.map((sh) => sh.id === shift.id ? shift : sh) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shifts' }, (p) => {
        const old = p.old as StoreScopedRow
        if (!isMain && old.store_id !== storeId) return
        useScheduleStore.setState((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== old.id) }))
      })

      // Schedule blocks
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_blocks', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const block = scheduleBlockFromRow(p.new as ScheduleBlockRow)
        useScheduleBlocksStore.setState((s) => ({ blocks: sortScheduleBlocks([...s.blocks.filter((item) => item.id !== block.id), block]) }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedule_blocks', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const block = scheduleBlockFromRow(p.new as ScheduleBlockRow)
        useScheduleBlocksStore.setState((s) => ({ blocks: sortScheduleBlocks(s.blocks.map((item) => item.id === block.id ? block : item)) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'schedule_blocks' }, (p) => {
        const old = p.old as StoreScopedRow
        if (!isMain && old.store_id !== storeId) return
        useScheduleBlocksStore.setState((s) => ({ blocks: s.blocks.filter((item) => item.id !== old.id) }))
      })

      // Goals
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goals', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const goal = goalFromRow(p.new as GoalRow)
        useGoalsStore.setState((s) => ({ goals: [...s.goals.filter((g) => g.id !== goal.id), goal] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'goals', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const goal = goalFromRow(p.new as GoalRow)
        useGoalsStore.setState((s) => ({ goals: s.goals.map((g) => g.id === goal.id ? goal : g) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'goals' }, (p) => {
        const old = p.old as StoreScopedRow
        if (!isMain && old.store_id !== storeId) return
        useGoalsStore.setState((s) => ({ goals: s.goals.filter((g) => g.id !== old.id) }))
      })

      // Announcements
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (p) => {
        const a = announcementFromRow(p.new as AnnouncementRow)
        if (!isMain && a.storeId !== storeId && a.storeId !== GLOBAL_ANNOUNCEMENT_STORE_ID) return
        useDisplayStore.setState((s) => ({ announcements: [...s.announcements.filter((x) => x.id !== a.id), a] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements' }, (p) => {
        const a = announcementFromRow(p.new as AnnouncementRow)
        if (!isMain && a.storeId !== storeId && a.storeId !== GLOBAL_ANNOUNCEMENT_STORE_ID) return
        useDisplayStore.setState((s) => ({ announcements: s.announcements.map((x) => x.id === a.id ? a : x) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, (p) => {
        const old = p.old as StoreScopedRow
        if (!isMain && old.store_id !== storeId && old.store_id !== GLOBAL_ANNOUNCEMENT_STORE_ID) return
        useDisplayStore.setState((s) => ({ announcements: s.announcements.filter((x) => x.id !== old.id) }))
      })

      // Settings
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        if (isMain) return
        const r = p.new as SettingsRow
        useDisplayStore.setState({ companyName: r.company_name, storeNumber: r.store_number, slideInterval: r.slide_interval })
      })

    if (shouldSyncTasks) {
      // Tasks
      channel = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const task = taskFromRow(p.new as TaskRow)
        useTasksStore.setState((s) => ({ tasks: [...s.tasks.filter((t) => t.id !== task.id), task] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', ...(isMain ? {} : { filter: `store_id=eq.${storeId}` }) }, (p) => {
        const task = taskFromRow(p.new as TaskRow)
        useTasksStore.setState((s) => ({ tasks: s.tasks.map((t) => t.id === task.id ? task : t) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (p) => {
        const old = p.old as StoreScopedRow
        if (!isMain && old.store_id !== storeId) return
        useTasksStore.setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== old.id) }))
      })
    }

    channel.subscribe()

    channelRef.current = channel
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [activeTab, storeId, retryKey, scheduleInit, scheduleBlocksInit, goalsInit, displayInit, tasksInit])

  if (isLoading) {
    return <DashboardLoader label="Syncing store data" />
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--surface)] px-6">
        <div className="max-w-md rounded-xl border border-red-500/25 bg-red-500/10 p-5 text-center">
          <AlertCircle size={22} className="mx-auto text-red-400" />
          <h2 className="mt-3 text-base font-semibold text-[var(--text)]">Dashboard data did not load</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{error}</p>
          <button
            onClick={() => setRetryKey((key) => key + 1)}
            className="mt-4 inline-flex items-center justify-center rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
