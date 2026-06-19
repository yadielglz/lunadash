import { create } from 'zustand'
import { dbInsertTask, dbUpdateTask, dbDeleteTask } from '../lib/supabase'
import { currentStoreId } from './currentStoreId'
import { useSyncStore } from './syncStore'

const today = () => new Date().toISOString().split('T')[0]

function trackTaskSync(action: string, operation: Promise<void>) {
  useSyncStore.getState().setSync('tasks', 'saving', action)
  operation
    .then(() => useSyncStore.getState().setSync('tasks', 'synced', 'Checklist confirmed in Supabase Database Sync'))
    .catch((err) => {
      useSyncStore.getState().setSync('tasks', 'error', err instanceof Error ? err.message : 'Checklist sync failed')
    })
}

export type TaskCategory = 'opening' | 'closing' | 'general'

export interface Task {
  id: string
  storeId?: string
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
  moveTask: (id: string, direction: 'up' | 'down') => void
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
    trackTaskSync('Saving checklist task', dbInsertTask(task, currentStoreId()))
  },

  updateTask: (id, patch) => {
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) }))
    trackTaskSync('Saving checklist update', dbUpdateTask(id, patch))
  },

  removeTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    trackTaskSync('Deleting checklist task', dbDeleteTask(id))
  },

  toggleTask: (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t
        const completedDate = t.completedDate === today() ? null : today()
        trackTaskSync('Saving checklist completion', dbUpdateTask(id, { completedDate }))
        return { ...t, completedDate }
      }),
    }))
  },

  moveTask: (id, direction) => {
    set((s) => {
      const task = s.tasks.find((t) => t.id === id)
      if (!task) return s

      const categoryTasks = s.tasks
        .filter((t) => t.category === task.category)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
      const currentIndex = categoryTasks.findIndex((t) => t.id === id)
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= categoryTasks.length) return s

      const reordered = [...categoryTasks]
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(nextIndex, 0, moved)

      const orderPatch = new Map(reordered.map((t, index) => [t.id, index]))
      const tasks = s.tasks.map((t) => (
        orderPatch.has(t.id) ? { ...t, sortOrder: orderPatch.get(t.id)! } : t
      ))

      reordered.forEach((t, index) => {
        if (t.sortOrder !== index) trackTaskSync('Saving checklist order', dbUpdateTask(t.id, { sortOrder: index }))
      })

      return { tasks }
    })
  },
}))
