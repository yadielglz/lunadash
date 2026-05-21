import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ScheduleBlock {
  id: string
  name: string
  startTime: string
  endTime: string
  note: string
  color: string
  sortOrder: number
}

interface ScheduleBlocksState {
  blocks: ScheduleBlock[]
  addBlock: (block: Omit<ScheduleBlock, 'id' | 'sortOrder'>) => void
  updateBlock: (id: string, patch: Partial<Omit<ScheduleBlock, 'id'>>) => void
  removeBlock: (id: string) => void
}

const DEFAULT_BLOCKS: ScheduleBlock[] = [
  { id: 'morning', name: 'Morning', startTime: '09:00', endTime: '17:00', note: '', color: '#f7630c', sortOrder: 0 },
  { id: 'afternoon', name: 'Afternoon', startTime: '13:00', endTime: '21:00', note: '', color: '#0078d4', sortOrder: 1 },
  { id: 'evening', name: 'Evening', startTime: '17:00', endTime: '01:00', note: '', color: '#7c5ff5', sortOrder: 2 },
  { id: 'night', name: 'Night', startTime: '22:00', endTime: '06:00', note: '', color: '#16c60c', sortOrder: 3 },
]

export const useScheduleBlocksStore = create<ScheduleBlocksState>()(
  persist(
    (set) => ({
      blocks: DEFAULT_BLOCKS,

      addBlock: (block) => set((s) => ({
        blocks: [
          ...s.blocks,
          { ...block, id: crypto.randomUUID(), sortOrder: s.blocks.length },
        ],
      })),

      updateBlock: (id, patch) => set((s) => ({
        blocks: s.blocks.map((block) => block.id === id ? { ...block, ...patch } : block),
      })),

      removeBlock: (id) => set((s) => ({
        blocks: s.blocks.filter((block) => block.id !== id),
      })),
    }),
    {
      name: 'luna-schedule-blocks',
      version: 1,
    }
  )
)
