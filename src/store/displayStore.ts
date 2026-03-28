import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  dbInsertAnnouncement, dbUpdateAnnouncement, dbDeleteAnnouncement,
  dbUpdateSettings,
} from '../lib/supabase'

const sid = () => {
  try {
    const raw = localStorage.getItem('luna-ui')
    return JSON.parse(raw ?? '{}')?.state?.storeId || 'default'
  } catch { return 'default' }
}

export interface Announcement {
  id: string
  text: string
  priority: 'normal' | 'important' | 'urgent'
  createdAt: string
}

interface DisplayState {
  announcements: Announcement[]
  slideInterval: number
  companyName: string
  storeNumber: string
  isLoaded: boolean

  _init: (announcements: Announcement[], settings: { company_name: string; store_number: string; slide_interval: number }) => void

  addAnnouncement: (text: string, priority?: Announcement['priority']) => void
  updateAnnouncement: (id: string, updates: Partial<Announcement>) => void
  removeAnnouncement: (id: string) => void
  reorderAnnouncements: (announcements: Announcement[]) => void
  setSlideInterval: (secs: number) => void
  setCompanyName: (name: string) => void
  setStoreNumber: (num: string) => void
}

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      announcements: [],
      slideInterval: 8,
      companyName: 'Luna Store',
      storeNumber: '',
      isLoaded: false,

      _init: (announcements, settings) => set({
        announcements,
        companyName:   settings.company_name,
        storeNumber:   settings.store_number,
        slideInterval: settings.slide_interval,
        isLoaded: true,
      }),

      addAnnouncement: (text, priority = 'normal') => {
        const a: Announcement = { id: crypto.randomUUID(), text, priority, createdAt: new Date().toISOString() }
        set((s) => ({ announcements: [...s.announcements, a] }))
        dbInsertAnnouncement(a, sid())
      },

      updateAnnouncement: (id, updates) => {
        set((s) => ({ announcements: s.announcements.map((a) => (a.id === id ? { ...a, ...updates } : a)) }))
        dbUpdateAnnouncement(id, updates)
      },

      removeAnnouncement: (id) => {
        set((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) }))
        dbDeleteAnnouncement(id)
      },

      reorderAnnouncements: (announcements) => set({ announcements }),

      setSlideInterval: (secs) => {
        set({ slideInterval: secs })
        dbUpdateSettings(sid(), { slide_interval: secs })
      },

      setCompanyName: (name) => {
        set({ companyName: name })
        dbUpdateSettings(sid(), { company_name: name })
      },

      setStoreNumber: (num) => {
        set({ storeNumber: num })
        dbUpdateSettings(sid(), { store_number: num })
      },
    }),
    {
      // Keep slideInterval, companyName, storeNumber locally as fallback
      name: 'luna-display-ui',
      partialize: (s) => ({ slideInterval: s.slideInterval, companyName: s.companyName, storeNumber: s.storeNumber }),
    }
  )
)
