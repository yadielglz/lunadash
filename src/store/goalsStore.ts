import { create } from 'zustand'
import { dbInsertGoal, dbUpdateGoal, dbDeleteGoal } from '../lib/supabase'

export interface Milestone {
  id: string
  label: string
  completed: boolean
}

export interface Goal {
  id: string
  title: string
  description: string
  category: string
  target: number
  current: number
  unit: string
  deadline: string
  color: string
  milestones: Milestone[]
  createdAt: string
  dailyTarget: number
  dailyLog: Record<string, number>
}

interface GoalsState {
  goals: Goal[]
  categories: string[]
  isLoaded: boolean

  _init: (goals: Goal[]) => void

  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'dailyLog'>) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  removeGoal: (id: string) => void
  setProgress: (id: string, current: number) => void
  logDaily: (id: string, value: number) => void
  toggleMilestone: (goalId: string, milestoneId: string) => void
  addCategory: (cat: string) => void
  removeCategory: (cat: string) => void
}

const today = () => new Date().toISOString().split('T')[0]

export const useGoalsStore = create<GoalsState>()((set) => ({
  goals: [],
  categories: ['Voice Lines', 'BTS', 'Accessories', 'Features', 'VISA Card', 'HSI'],
  isLoaded: false,

  _init: (goals) => set({ goals, isLoaded: true }),

  addGoal: (goal) => {
    const newGoal: Goal = {
      ...goal,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      dailyLog: {},
    }
    set((s) => ({ goals: [...s.goals, newGoal] }))
    dbInsertGoal(newGoal)
  },

  updateGoal: (id, updates) => {
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)) }))
    dbUpdateGoal(id, updates)
  },

  removeGoal: (id) => {
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
    dbDeleteGoal(id)
  },

  setProgress: (id, current) => {
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, current } : g)) }))
    dbUpdateGoal(id, { current })
  },

  logDaily: (id, value) => {
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== id) return g
        const key   = today()
        const log   = g.dailyLog ?? {}
        const prev  = log[key] ?? 0
        const delta = value - prev
        const updated = {
          ...g,
          dailyLog: { ...log, [key]: Math.max(0, value) },
          current:  Math.max(0, g.current + delta),
        }
        dbUpdateGoal(id, { dailyLog: updated.dailyLog, current: updated.current })
        return updated
      }),
    }))
  },

  toggleMilestone: (goalId, milestoneId) => {
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g
        const milestones = g.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completed: !m.completed } : m
        )
        dbUpdateGoal(goalId, { milestones })
        return { ...g, milestones }
      }),
    }))
  },

  addCategory: (cat) =>
    set((s) => ({ categories: s.categories.includes(cat) ? s.categories : [...s.categories, cat] })),

  removeCategory: (cat) =>
    set((s) => ({ categories: s.categories.filter((c) => c !== cat) })),
}))
