import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  dbInsertAnnouncement, dbUpdateAnnouncement, dbDeleteAnnouncement,
  dbUpdateSettings,
} from '../lib/supabase'
import { currentStoreId } from './currentStoreId'

export interface Announcement {
  id: string
  storeId?: string
  text: string
  priority: 'normal' | 'important' | 'urgent'
  startAt?: string
  endAt?: string
  createdAt: string
}

interface DisplayState {
  announcements: Announcement[]
  slideInterval: number
  companyName: string
  storeNumber: string
  isLoaded: boolean

  _init: (announcements: Announcement[], settings: { company_name: string; store_number: string; slide_interval: number }) => void

  addAnnouncement: (text: string, priority?: Announcement['priority'], period?: Pick<Announcement, 'startAt' | 'endAt'>) => void
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

      addAnnouncement: (text, priority = 'normal', period = {}) => {
        const a: Announcement = {
          id: crypto.randomUUID(),
          text,
          priority,
          startAt: period.startAt,
          endAt: period.endAt,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ announcements: [...s.announcements, a] }))
        dbInsertAnnouncement(a, currentStoreId())
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
        dbUpdateSettings(currentStoreId(), { slide_interval: secs })
      },

      setCompanyName: (name) => {
        set({ companyName: name })
        dbUpdateSettings(currentStoreId(), { company_name: name })
      },

      setStoreNumber: (num) => {
        set({ storeNumber: num })
        dbUpdateSettings(currentStoreId(), { store_number: num })
      },
    }),
    {
      // Keep slideInterval, companyName, storeNumber locally as fallback
      name: 'luna-display-ui',
      partialize: (s) => ({ slideInterval: s.slideInterval, companyName: s.companyName, storeNumber: s.storeNumber }),
    }
  )
)

export function isAnnouncementActive(announcement: Announcement, now = new Date()) {
  const start = announcement.startAt ? new Date(`${announcement.startAt}T00:00:00`) : null
  const end = announcement.endAt ? new Date(`${announcement.endAt}T23:59:59.999`) : null
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}
