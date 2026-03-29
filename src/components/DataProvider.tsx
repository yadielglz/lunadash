import { useEffect, useRef } from 'react'
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const storeId      = useUiStore((s) => s.storeId)
  const scheduleInit = useScheduleStore((s) => s._init)
  const goalsInit    = useGoalsStore((s) => s._init)
  const displayInit  = useDisplayStore((s) => s._init)
  const tasksInit    = useTasksStore((s) => s._init)
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    // ── Load all data for this store ────────────────────────────
    async function load() {
      const [employees, shifts, goals, announcements, settings, tasks] = await Promise.all([
        dbGetEmployees(storeId),
        dbGetShifts(storeId),
        dbGetGoals(storeId),
        dbGetAnnouncements(storeId),
        dbGetSettings(storeId),
        dbGetTasks(storeId),
      ])
      scheduleInit(employees, shifts)
      goalsInit(goals)
      displayInit(
        announcements,
        settings ?? { company_name: 'Luna Store', store_number: '', slide_interval: 8 }
      )
      tasksInit(tasks)
    }
    load()

    // ── Real-time: filter by store_id ────────────────────────────
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const channel = supabase
      .channel(`luna-${storeId}`)

      // Employees
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employees', filter: `store_id=eq.${storeId}` }, (p) => {
        useScheduleStore.setState((s) => ({ employees: [...s.employees.filter((e) => e.id !== (p.new as Employee).id), p.new as Employee] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees', filter: `store_id=eq.${storeId}` }, (p) => {
        useScheduleStore.setState((s) => ({ employees: s.employees.map((e) => e.id === (p.new as Employee).id ? p.new as Employee : e) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'employees' }, (p) => {
        useScheduleStore.setState((s) => ({ employees: s.employees.filter((e) => e.id !== (p.old as any).id) }))
      })

      // Shifts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shifts', filter: `store_id=eq.${storeId}` }, (p) => {
        const r = p.new as any
        const shift: Shift = { id: r.id, employeeId: r.employee_id, date: r.date, startTime: r.start_time, endTime: r.end_time, type: r.type, note: r.note }
        useScheduleStore.setState((s) => ({ shifts: [...s.shifts.filter((sh) => sh.id !== shift.id), shift] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shifts', filter: `store_id=eq.${storeId}` }, (p) => {
        const r = p.new as any
        const shift: Shift = { id: r.id, employeeId: r.employee_id, date: r.date, startTime: r.start_time, endTime: r.end_time, type: r.type, note: r.note }
        useScheduleStore.setState((s) => ({ shifts: s.shifts.map((sh) => sh.id === shift.id ? shift : sh) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shifts' }, (p) => {
        useScheduleStore.setState((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== (p.old as any).id) }))
      })

      // Goals
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goals', filter: `store_id=eq.${storeId}` }, (p) => {
        const r = p.new as any
        const goal: Goal = { id: r.id, title: r.title, description: r.description, category: r.category, target: r.target, current: r.current_val, unit: r.unit, deadline: r.deadline, color: r.color, dailyTarget: r.daily_target, dailyLog: r.daily_log ?? {}, milestones: r.milestones ?? [], createdAt: r.created_at }
        useGoalsStore.setState((s) => ({ goals: [...s.goals.filter((g) => g.id !== goal.id), goal] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'goals', filter: `store_id=eq.${storeId}` }, (p) => {
        const r = p.new as any
        const goal: Goal = { id: r.id, title: r.title, description: r.description, category: r.category, target: r.target, current: r.current_val, unit: r.unit, deadline: r.deadline, color: r.color, dailyTarget: r.daily_target, dailyLog: r.daily_log ?? {}, milestones: r.milestones ?? [], createdAt: r.created_at }
        useGoalsStore.setState((s) => ({ goals: s.goals.map((g) => g.id === goal.id ? goal : g) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'goals' }, (p) => {
        useGoalsStore.setState((s) => ({ goals: s.goals.filter((g) => g.id !== (p.old as any).id) }))
      })

      // Announcements
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `store_id=eq.${storeId}` }, (p) => {
        const a = p.new as Announcement
        useDisplayStore.setState((s) => ({ announcements: [...s.announcements.filter((x) => x.id !== a.id), a] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements', filter: `store_id=eq.${storeId}` }, (p) => {
        const a = p.new as Announcement
        useDisplayStore.setState((s) => ({ announcements: s.announcements.map((x) => x.id === a.id ? a : x) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, (p) => {
        useDisplayStore.setState((s) => ({ announcements: s.announcements.filter((x) => x.id !== (p.old as any).id) }))
      })

      // Settings
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: `store_id=eq.${storeId}` }, (p) => {
        const r = p.new as any
        useDisplayStore.setState({ companyName: r.company_name, storeNumber: r.store_number, slideInterval: r.slide_interval })
      })

      // Tasks
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: `store_id=eq.${storeId}` }, (p) => {
        const r = p.new as any
        const task: Task = { id: r.id, title: r.title, category: r.category, sortOrder: r.sort_order, completedDate: r.completed_date ?? null, createdAt: r.created_at }
        useTasksStore.setState((s) => ({ tasks: [...s.tasks.filter((t) => t.id !== task.id), task] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `store_id=eq.${storeId}` }, (p) => {
        const r = p.new as any
        const task: Task = { id: r.id, title: r.title, category: r.category, sortOrder: r.sort_order, completedDate: r.completed_date ?? null, createdAt: r.created_at }
        useTasksStore.setState((s) => ({ tasks: s.tasks.map((t) => t.id === task.id ? task : t) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (p) => {
        useTasksStore.setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== (p.old as any).id) }))
      })

      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [storeId, scheduleInit, goalsInit, displayInit, tasksInit])

  return <>{children}</>
}
