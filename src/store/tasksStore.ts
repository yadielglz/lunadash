import { create } from 'zustand'
import { dbInsertTask, dbUpdateTask, dbDeleteTask } from '../lib/supabase'

const sid = () => {
  try {
    const raw = localStorage.getItem('luna-ui')
    return JSON.parse(raw ?? '{}')?.state?.storeId || 'default'
  } catch { return 'default' }
}

const today = () => new Date().toISOString().split('T')[0]

export type TaskCategory = 'opening' | 'closing' | 'general'

export interface Task {
  id: string
  title: string
  category: TaskCategory
  sortOrder: number
  completedDate: string | null   // YYYY-MM-DD or null
  createdAt: string
}

interface TasksState {
  tasks: Task[]
  isLoaded: boolean

  _init: (tasks: Task[]) => void

  addTask:    (data: Pick<Task, 'title' | 'category' | 'sortOrder'>) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  removeTask: (id: string) => void
  toggleTask: (id: string) => void
}

export const useTasksStore = create<TasksState>()((set) => ({
  tasks: [],
  isLoaded: false,

  _init: (tasks) => set({ tasks, isLoaded: true }),

  addTask: (data) => {
    const task: Task = {
      ...data,
      id: crypto.randomUUID(),
      completedDate: null,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ tasks: [...s.tasks, task] }))
    dbInsertTask(task, sid())
  },

  updateTask: (id, patch) => {
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) }))
    dbUpdateTask(id, patch)
  },

  removeTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    dbDeleteTask(id)
  },

  toggleTask: (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t
        const completedDate = t.completedDate === today() ? null : today()
        dbUpdateTask(id, { completedDate })
        return { ...t, completedDate }
      }),
    }))
  },
}))
