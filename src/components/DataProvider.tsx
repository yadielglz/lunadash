import { useEffect, useRef, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { supabase, dbGetEmployees, dbGetShifts, dbGetGoals, dbGetAnnouncements, dbGetSettings, dbGetTasks } from '../lib/supabase'
import { useScheduleStore } from '../store/scheduleStore'
import { useGoalsStore } from '../store/goalsStore'
import { useDisplayStore } from '../store/displayStore'
import { useUiStore } from '../store/uiStore'
import { useTasksStore } from '../store/tasksStore'
import type { Employee, Shift } from '../store/scheduleStore'
import type { Goal } from '../store/goalsStore'
import type { Announcement } from '../store/displayStore'
import type { Task } from '../store/tasksStore'

type StoreScopedRow = { id: string; store_id: string }
type EmployeeRow = StoreScopedRow & { name: string; role: string; color: string }
type ShiftRow = StoreScopedRow & {
  employee_id: string
  date: string
  start_time: string
  end_time: string
  type: Shift['type']
  note?: string | null
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

const employeeFromRow = (r: EmployeeRow): Employee => ({ id: r.id, name: r.name, role: r.role, color: r.color })

const shiftFromRow = (r: ShiftRow): Shift => ({
  id: r.id,
  employeeId: r.employee_id,
  date: r.date,
  startTime: r.start_time,
  endTime: r.end_time,
  type: r.type,
  note: r.note ?? '',
})

const goalFromRow = (r: GoalRow): Goal => ({
  id: r.id,
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
  text: r.text,
  priority: r.priority,
  createdAt: r.created_at,
})

const taskFromRow = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  category: r.category,
  sortOrder: r.sort_order,
  completedDate: r.completed_date ?? null,
  createdAt: r.created_at,
})

export function DataProvider({ children }: { children: React.ReactNode }) {
  const storeId      = useUiStore((s) => s.storeId)
  const scheduleInit = useScheduleStore((s) => s._init)
  const goalsInit    = useGoalsStore((s) => s._init)
  const displayInit  = useDisplayStore((s) => s._init)
  const tasksInit    = useTasksStore((s) => s._init)
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    // ── Load all data for this store ────────────────────────────
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const [employees, shifts, goals, announcements, settings, tasks] = await Promise.all([
          dbGetEmployees(storeId),
          dbGetShifts(storeId),
          dbGetGoals(storeId),
          dbGetAnnouncements(storeId),
          dbGetSettings(storeId),
          dbGetTasks(storeId),
        ])
        if (cancelled) return
        scheduleInit(employees, shifts)
        goalsInit(goals)
        displayInit(
          announcements,
          settings ?? { company_name: 'Luna Store', store_number: '', slide_interval: 8 }
        )
        tasksInit(tasks)
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

    const channel = supabase
      .channel(`luna-${storeId}`)

      // Employees
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employees', filter: `store_id=eq.${storeId}` }, (p) => {
        const employee = employeeFromRow(p.new as EmployeeRow)
        useScheduleStore.setState((s) => ({ employees: [...s.employees.filter((e) => e.id !== employee.id), employee] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees', filter: `store_id=eq.${storeId}` }, (p) => {
        const employee = employeeFromRow(p.new as EmployeeRow)
        useScheduleStore.setState((s) => ({ employees: s.employees.map((e) => e.id === employee.id ? employee : e) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'employees' }, (p) => {
        const old = p.old as StoreScopedRow
        if (old.store_id !== storeId) return
        useScheduleStore.setState((s) => ({ employees: s.employees.filter((e) => e.id !== old.id) }))
      })

      // Shifts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shifts', filter: `store_id=eq.${storeId}` }, (p) => {
        const shift = shiftFromRow(p.new as ShiftRow)
        useScheduleStore.setState((s) => ({ shifts: [...s.shifts.filter((sh) => sh.id !== shift.id), shift] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shifts', filter: `store_id=eq.${storeId}` }, (p) => {
        const shift = shiftFromRow(p.new as ShiftRow)
        useScheduleStore.setState((s) => ({ shifts: s.shifts.map((sh) => sh.id === shift.id ? shift : sh) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shifts' }, (p) => {
        const old = p.old as StoreScopedRow
        if (old.store_id !== storeId) return
        useScheduleStore.setState((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== old.id) }))
      })

      // Goals
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goals', filter: `store_id=eq.${storeId}` }, (p) => {
        const goal = goalFromRow(p.new as GoalRow)
        useGoalsStore.setState((s) => ({ goals: [...s.goals.filter((g) => g.id !== goal.id), goal] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'goals', filter: `store_id=eq.${storeId}` }, (p) => {
        const goal = goalFromRow(p.new as GoalRow)
        useGoalsStore.setState((s) => ({ goals: s.goals.map((g) => g.id === goal.id ? goal : g) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'goals' }, (p) => {
        const old = p.old as StoreScopedRow
        if (old.store_id !== storeId) return
        useGoalsStore.setState((s) => ({ goals: s.goals.filter((g) => g.id !== old.id) }))
      })

      // Announcements
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `store_id=eq.${storeId}` }, (p) => {
        const a = announcementFromRow(p.new as AnnouncementRow)
        useDisplayStore.setState((s) => ({ announcements: [...s.announcements.filter((x) => x.id !== a.id), a] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements', filter: `store_id=eq.${storeId}` }, (p) => {
        const a = announcementFromRow(p.new as AnnouncementRow)
        useDisplayStore.setState((s) => ({ announcements: s.announcements.map((x) => x.id === a.id ? a : x) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, (p) => {
        const old = p.old as StoreScopedRow
        if (old.store_id !== storeId) return
        useDisplayStore.setState((s) => ({ announcements: s.announcements.filter((x) => x.id !== old.id) }))
      })

      // Settings
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: `store_id=eq.${storeId}` }, (p) => {
        const r = p.new as SettingsRow
        useDisplayStore.setState({ companyName: r.company_name, storeNumber: r.store_number, slideInterval: r.slide_interval })
      })

      // Tasks
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: `store_id=eq.${storeId}` }, (p) => {
        const task = taskFromRow(p.new as TaskRow)
        useTasksStore.setState((s) => ({ tasks: [...s.tasks.filter((t) => t.id !== task.id), task] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `store_id=eq.${storeId}` }, (p) => {
        const task = taskFromRow(p.new as TaskRow)
        useTasksStore.setState((s) => ({ tasks: s.tasks.map((t) => t.id === task.id ? task : t) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (p) => {
        const old = p.old as StoreScopedRow
        if (old.store_id !== storeId) return
        useTasksStore.setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== old.id) }))
      })

      .subscribe()

    channelRef.current = channel
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [storeId, retryKey, scheduleInit, goalsInit, displayInit, tasksInit])

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--surface)] text-[var(--text-secondary)]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={20} className="animate-spin text-[var(--accent)]" />
          <p className="text-sm">Loading dashboard data...</p>
        </div>
      </div>
    )
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
