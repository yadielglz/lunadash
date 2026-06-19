import { create } from 'zustand'

export type SyncArea = 'settings' | 'schedule' | 'tasks' | 'goals' | 'announcements'
export type SyncState = 'idle' | 'saving' | 'synced' | 'error'

type SyncEntry = {
  state: SyncState
  message: string
  updatedAt: string | null
}

type SyncStore = {
  entries: Record<SyncArea, SyncEntry>
  setSync: (area: SyncArea, state: SyncState, message?: string) => void
}

const initialEntry: SyncEntry = { state: 'idle', message: 'Not checked yet', updatedAt: null }

export const useSyncStore = create<SyncStore>()((set) => ({
  entries: {
    settings: initialEntry,
    schedule: initialEntry,
    tasks: initialEntry,
    goals: initialEntry,
    announcements: initialEntry,
  },
  setSync: (area, state, message) => set((s) => ({
    entries: {
      ...s.entries,
      [area]: {
        state,
        message: message ?? (
          state === 'synced' ? 'Confirmed in Supabase Database Sync'
          : state === 'saving' ? 'Saving to Supabase Database Sync'
          : state === 'error' ? 'Sync failed'
          : 'Not checked yet'
        ),
        updatedAt: new Date().toISOString(),
      },
    },
  })),
}))
