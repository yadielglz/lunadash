import { useEffect } from 'react'
import { supabase, dbGetEmployees, dbGetShifts, dbGetGoals, dbGetAnnouncements, dbGetSettings } from '../lib/supabase'
import { useScheduleStore } from '../store/scheduleStore'
import { useGoalsStore } from '../store/goalsStore'
import { useDisplayStore } from '../store/displayStore'
import type { Employee, Shift } from '../store/scheduleStore'
import type { Goal } from '../store/goalsStore'
import type { Announcement } from '../store/displayStore'

export function DataProvider({ children }: { children: React.ReactNode }) {
  const scheduleInit = useScheduleStore((s) => s._init)
  const goalsInit    = useGoalsStore((s) => s._init)
  const displayInit  = useDisplayStore((s) => s._init)

  useEffect(() => {
    // ── Initial load ─────────────────────────────────────────────
    async function load() {
      const [employees, shifts, goals, announcements, settings] = await Promise.all([
        dbGetEmployees(),
        dbGetShifts(),
        dbGetGoals(),
        dbGetAnnouncements(),
        dbGetSettings(),
      ])
      scheduleInit(employees, shifts)
      goalsInit(goals)
      displayInit(
        announcements,
        settings ?? { company_name: 'Luna Store', store_number: '', slide_interval: 8 }
      )
    }
    load()

    // ── Real-time subscriptions ──────────────────────────────────
    const channel = supabase
      .channel('luna-realtime')

      // Employees
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employees' }, (payload) => {
        useScheduleStore.setState((s) => ({
          employees: [...s.employees.filter((e) => e.id !== (payload.new as Employee).id), payload.new as Employee],
        }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees' }, (payload) => {
        useScheduleStore.setState((s) => ({
          employees: s.employees.map((e) => e.id === (payload.new as Employee).id ? payload.new as Employee : e),
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'employees' }, (payload) => {
        useScheduleStore.setState((s) => ({
          employees: s.employees.filter((e) => e.id !== (payload.old as Employee).id),
        }))
      })

      // Shifts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shifts' }, (payload) => {
        const r = payload.new as any
        const shift: Shift = { id: r.id, employeeId: r.employee_id, date: r.date, startTime: r.start_time, endTime: r.end_time, type: r.type, note: r.note }
        useScheduleStore.setState((s) => ({
          shifts: [...s.shifts.filter((sh) => sh.id !== shift.id), shift],
        }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shifts' }, (payload) => {
        const r = payload.new as any
        const shift: Shift = { id: r.id, employeeId: r.employee_id, date: r.date, startTime: r.start_time, endTime: r.end_time, type: r.type, note: r.note }
        useScheduleStore.setState((s) => ({
          shifts: s.shifts.map((sh) => sh.id === shift.id ? shift : sh),
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shifts' }, (payload) => {
        useScheduleStore.setState((s) => ({
          shifts: s.shifts.filter((sh) => sh.id !== (payload.old as any).id),
        }))
      })

      // Goals
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goals' }, (payload) => {
        const r = payload.new as any
        const goal: Goal = { id: r.id, title: r.title, description: r.description, category: r.category, target: r.target, current: r.current_val, unit: r.unit, deadline: r.deadline, color: r.color, dailyTarget: r.daily_target, dailyLog: r.daily_log ?? {}, milestones: r.milestones ?? [], createdAt: r.created_at }
        useGoalsStore.setState((s) => ({ goals: [...s.goals.filter((g) => g.id !== goal.id), goal] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'goals' }, (payload) => {
        const r = payload.new as any
        const goal: Goal = { id: r.id, title: r.title, description: r.description, category: r.category, target: r.target, current: r.current_val, unit: r.unit, deadline: r.deadline, color: r.color, dailyTarget: r.daily_target, dailyLog: r.daily_log ?? {}, milestones: r.milestones ?? [], createdAt: r.created_at }
        useGoalsStore.setState((s) => ({ goals: s.goals.map((g) => g.id === goal.id ? goal : g) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'goals' }, (payload) => {
        useGoalsStore.setState((s) => ({ goals: s.goals.filter((g) => g.id !== (payload.old as any).id) }))
      })

      // Announcements
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        const a = payload.new as Announcement
        useDisplayStore.setState((s) => ({ announcements: [...s.announcements.filter((x) => x.id !== a.id), a] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements' }, (payload) => {
        const a = payload.new as Announcement
        useDisplayStore.setState((s) => ({ announcements: s.announcements.map((x) => x.id === a.id ? a : x) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, (payload) => {
        useDisplayStore.setState((s) => ({ announcements: s.announcements.filter((x) => x.id !== (payload.old as any).id) }))
      })

      // Settings
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
        const r = payload.new as any
        useDisplayStore.setState({ companyName: r.company_name, storeNumber: r.store_number, slideInterval: r.slide_interval })
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [scheduleInit, goalsInit, displayInit])

  return <>{children}</>
}
