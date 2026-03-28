import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  target: number        // monthly target
  current: number       // running monthly total
  unit: string
  deadline: string      // ISO date string
  color: string
  milestones: Milestone[]
  createdAt: string
  dailyTarget: number              // what to hit each day
  dailyLog: Record<string, number> // date (yyyy-MM-dd) → that day's count
}

interface GoalsState {
  goals: Goal[]
  categories: string[]

  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'dailyLog'>) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  removeGoal: (id: string) => void
  setProgress: (id: string, current: number) => void
  logDaily: (id: string, value: number) => void   // set today's count; adjusts monthly total
  toggleMilestone: (goalId: string, milestoneId: string) => void
  addCategory: (cat: string) => void
  removeCategory: (cat: string) => void
}

const today = () => new Date().toISOString().split('T')[0]
const eom   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()

const DEMO_GOALS: Goal[] = [
  {
    id: 'g1', title: 'Voice Lines', description: 'Monthly voice line activations & upgrades target',
    category: 'Voice Lines', target: 40, current: 27, unit: ' lines', deadline: eom,
    color: '#0078d4', dailyTarget: 2, dailyLog: { [today()]: 1 },
    milestones: [
      { id: 'm1', label: '10 activations', completed: true },
      { id: 'm2', label: '25 activations', completed: true },
      { id: 'm3', label: '35 activations', completed: false },
      { id: 'm4', label: 'Hit 40 — goal!', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'g2', title: 'BTS', description: 'Business-to-business / business solutions target',
    category: 'BTS', target: 15, current: 8, unit: ' accts', deadline: eom,
    color: '#7c5ff5', dailyTarget: 1, dailyLog: {},
    milestones: [
      { id: 'm5', label: '5 BTS accounts', completed: true },
      { id: 'm6', label: '10 BTS accounts', completed: false },
      { id: 'm7', label: '15 BTS accounts', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'g3', title: 'Accessories', description: 'Accessories attach rate & revenue goal',
    category: 'Accessories', target: 100, current: 64, unit: '%', deadline: eom,
    color: '#f7630c', dailyTarget: 80, dailyLog: { [today()]: 75 },
    milestones: [
      { id: 'm8', label: '50% attach rate', completed: true },
      { id: 'm9', label: '75% attach rate', completed: false },
      { id: 'm10', label: '100% attach rate', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'g4', title: 'Features', description: 'Feature additions (insurance, cloud, etc.) per account',
    category: 'Features', target: 60, current: 34, unit: ' adds', deadline: eom,
    color: '#00b7c3', dailyTarget: 3, dailyLog: { [today()]: 2 },
    milestones: [
      { id: 'm11', label: '20 feature adds', completed: true },
      { id: 'm12', label: '40 feature adds', completed: false },
      { id: 'm13', label: '60 feature adds', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'g5', title: 'VISA Card', description: 'Co-branded VISA card applications this month',
    category: 'VISA Card', target: 20, current: 11, unit: ' apps', deadline: eom,
    color: '#e3008c', dailyTarget: 1, dailyLog: {},
    milestones: [
      { id: 'm14', label: '5 applications', completed: true },
      { id: 'm15', label: '10 applications', completed: true },
      { id: 'm16', label: '20 applications', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'g6', title: 'HSI', description: 'Home internet (HSI) activations target',
    category: 'HSI', target: 25, current: 14, unit: ' activations', deadline: eom,
    color: '#16c60c', dailyTarget: 1, dailyLog: { [today()]: 1 },
    milestones: [
      { id: 'm17', label: '10 HSI activations', completed: true },
      { id: 'm18', label: '20 HSI activations', completed: false },
      { id: 'm19', label: '25 HSI activations', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
]

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set) => ({
      goals: DEMO_GOALS,
      categories: ['Voice Lines', 'BTS', 'Accessories', 'Features', 'VISA Card', 'HSI'],

      addGoal: (goal) =>
        set((s) => ({
          goals: [
            ...s.goals,
            { ...goal, id: crypto.randomUUID(), createdAt: new Date().toISOString(), dailyLog: {} },
          ],
        })),

      updateGoal: (id, updates) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)) })),

      removeGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      setProgress: (id, current) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, current } : g)) })),

      // Set today's daily count; delta is reflected in monthly total
      logDaily: (id, value) =>
        set((s) => ({
          goals: s.goals.map((g) => {
            if (g.id !== id) return g
            const key   = today()
            const log   = g.dailyLog ?? {}
            const prev  = log[key] ?? 0
            const delta = value - prev
            return {
              ...g,
              dailyLog: { ...log, [key]: Math.max(0, value) },
              current:  Math.max(0, g.current + delta),
            }
          }),
        })),

      toggleMilestone: (goalId, milestoneId) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  milestones: g.milestones.map((m) =>
                    m.id === milestoneId ? { ...m, completed: !m.completed } : m
                  ),
                }
              : g
          ),
        })),

      addCategory: (cat) =>
        set((s) => ({ categories: s.categories.includes(cat) ? s.categories : [...s.categories, cat] })),

      removeCategory: (cat) =>
        set((s) => ({ categories: s.categories.filter((c) => c !== cat) })),
    }),
    {
      name: 'luna-goals',
      version: 2,
      migrate: (persisted: any, version: number) => {
        // v1 → v2: add dailyTarget and dailyLog to existing goals
        if (version < 2) {
          const state = persisted as { goals?: Goal[]; categories?: string[] }
          if (Array.isArray(state.goals)) {
            state.goals = state.goals.map((g) => ({
              ...g,
              dailyTarget: (g as any).dailyTarget ?? 1,
              dailyLog:    (g as any).dailyLog    ?? {},
            }))
          }
        }
        return persisted as GoalsState
      },
    }
  )
)
