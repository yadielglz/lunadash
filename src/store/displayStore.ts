import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Announcement {
  id: string
  text: string
  priority: 'normal' | 'important' | 'urgent'
  createdAt: string
}

interface DisplayState {
  announcements: Announcement[]
  slideInterval: number   // seconds per slide
  companyName: string
  storeNumber: string
  companyLogo?: string

  addAnnouncement: (text: string, priority?: Announcement['priority']) => void
  updateAnnouncement: (id: string, updates: Partial<Announcement>) => void
  removeAnnouncement: (id: string) => void
  reorderAnnouncements: (announcements: Announcement[]) => void
  setSlideInterval: (secs: number) => void
  setCompanyName: (name: string) => void
  setStoreNumber: (num: string) => void
}

const DEMO_ANNOUNCEMENTS: Announcement[] = [
  { id: 'a1', text: 'Welcome! Please check the schedule for this week\'s shifts.', priority: 'normal', createdAt: new Date().toISOString() },
  { id: 'a2', text: 'Team meeting Friday at 3PM in the break room.', priority: 'important', createdAt: new Date().toISOString() },
  { id: 'a3', text: 'Remember to clock in/out using the new system.', priority: 'normal', createdAt: new Date().toISOString() },
]

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      announcements: DEMO_ANNOUNCEMENTS,
      slideInterval: 8,
      companyName: 'Luna Store',
      storeNumber: '',

      addAnnouncement: (text, priority = 'normal') =>
        set((s) => ({
          announcements: [...s.announcements, { id: crypto.randomUUID(), text, priority, createdAt: new Date().toISOString() }],
        })),
      updateAnnouncement: (id, updates) =>
        set((s) => ({ announcements: s.announcements.map((a) => (a.id === id ? { ...a, ...updates } : a)) })),
      removeAnnouncement: (id) =>
        set((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) })),
      reorderAnnouncements: (announcements) => set({ announcements }),
      setSlideInterval: (secs) => set({ slideInterval: secs }),
      setCompanyName: (name) => set({ companyName: name }),
      setStoreNumber: (num) => set({ storeNumber: num }),
    }),
    { name: 'luna-display' }
  )
)
