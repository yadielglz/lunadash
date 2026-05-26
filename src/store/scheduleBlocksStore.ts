import { create } from 'zustand'
import {
  dbDeleteScheduleBlock,
  dbInsertScheduleBlock,
  dbUpdateScheduleBlock,
} from '../lib/supabase'
import { currentStoreId } from './currentStoreId'

export interface ScheduleBlock {
  id: string
  storeId?: string
  name: string
  startTime: string
  endTime: string
  note: string
  color: string
  sortOrder: number
}

interface ScheduleBlocksState {
  blocks: ScheduleBlock[]
  isLoaded: boolean
  _init: (blocks: ScheduleBlock[]) => void
  addBlock: (block: Omit<ScheduleBlock, 'id' | 'sortOrder'>) => void
  updateBlock: (id: string, patch: Partial<Omit<ScheduleBlock, 'id'>>) => void
  removeBlock: (id: string) => void
}

function sortBlocks(blocks: ScheduleBlock[]) {
  return [...blocks].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.name.localeCompare(b.name)
  })
}

export const useScheduleBlocksStore = create<ScheduleBlocksState>()((set, get) => ({
  blocks: [],
  isLoaded: false,

  _init: (blocks) => set({ blocks: sortBlocks(blocks), isLoaded: true }),

  addBlock: (block) => {
    const storeId = currentStoreId()
    const newBlock: ScheduleBlock = {
      ...block,
      id: crypto.randomUUID(),
      storeId,
      sortOrder: get().blocks.length,
    }
    set((s) => ({ blocks: sortBlocks([...s.blocks, newBlock]) }))
    dbInsertScheduleBlock(newBlock, storeId)
  },

  updateBlock: (id, patch) => {
    set((s) => ({ blocks: sortBlocks(s.blocks.map((block) => block.id === id ? { ...block, ...patch } : block)) }))
    dbUpdateScheduleBlock(id, patch)
  },

  removeBlock: (id) => {
    set((s) => ({ blocks: s.blocks.filter((block) => block.id !== id) }))
    dbDeleteScheduleBlock(id)
  },
}))
