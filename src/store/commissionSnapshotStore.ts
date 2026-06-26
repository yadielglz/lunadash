import { create } from 'zustand'
import { dbDeleteCommissionSnapshot, dbUpsertCommissionSnapshot } from '../lib/supabase'
import { currentStoreId } from './currentStoreId'

export interface CommissionSnapshot {
  id: string
  storeId?: string
  snapshotDate: string
  employeeName: string
  commission: number
  commissionOpportunity: number
  accessories: number
  accessoryGoal: number
  revenue: number
  revenueGoal: number
  vaf: number
  vafGoal: number
  voiceLines: number
  voiceLinesGoal: number
  bts: number
  btsGoal: number
  notes: string
  sortOrder: number
  updatedBy?: string
  updatedAt: string
  createdAt: string
}

type CommissionSnapshotDraft = Omit<CommissionSnapshot, 'id' | 'createdAt' | 'updatedAt'>

interface CommissionSnapshotState {
  snapshots: CommissionSnapshot[]
  isLoaded: boolean
  _init: (snapshots: CommissionSnapshot[]) => void
  addSnapshot: (snapshot: CommissionSnapshotDraft) => void
  updateSnapshot: (id: string, updates: Partial<CommissionSnapshot>) => void
  removeSnapshot: (id: string) => void
}

export const useCommissionSnapshotStore = create<CommissionSnapshotState>()((set) => ({
  snapshots: [],
  isLoaded: false,

  _init: (snapshots) => set({ snapshots, isLoaded: true }),

  addSnapshot: (snapshot) => {
    const now = new Date().toISOString()
    const storeId = snapshot.storeId ?? currentStoreId()
    const newSnapshot: CommissionSnapshot = {
      ...snapshot,
      storeId,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    set((s) => ({ snapshots: [...s.snapshots, newSnapshot] }))
    dbUpsertCommissionSnapshot(newSnapshot, storeId)
  },

  updateSnapshot: (id, updates) => {
    set((s) => ({
      snapshots: s.snapshots.map((snapshot) => (
        snapshot.id === id
          ? { ...snapshot, ...updates, updatedAt: updates.updatedAt ?? new Date().toISOString() }
          : snapshot
      )),
    }))
    dbUpsertCommissionSnapshot({ ...updates, id } as CommissionSnapshot, updates.storeId)
  },

  removeSnapshot: (id) => {
    set((s) => ({ snapshots: s.snapshots.filter((snapshot) => snapshot.id !== id) }))
    dbDeleteCommissionSnapshot(id)
  },
}))
