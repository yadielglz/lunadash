import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeStoreId } from '../lib/storeIds'

export type CoachingNoteStatus = 'open' | 'resolved'

export type CoachingNote = {
  id: string
  storeId: string
  text: string
  status: CoachingNoteStatus
  createdAt: string
  resolvedAt?: string
}

interface DistrictCoachingState {
  notes: CoachingNote[]
  addNote: (storeId: string, text: string) => void
  setNoteStatus: (id: string, status: CoachingNoteStatus) => void
  removeNote: (id: string) => void
  notesForStore: (storeId: string) => CoachingNote[]
  openNotesForStore: (storeId: string) => CoachingNote[]
}

function noteId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `note-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useDistrictCoachingStore = create<DistrictCoachingState>()(
  persist(
    (set, get) => ({
      notes: [],
      addNote: (storeId, text) => {
        const cleanText = text.trim()
        const normalizedStoreId = normalizeStoreId(storeId)
        if (!cleanText || !normalizedStoreId) return

        const note: CoachingNote = {
          id: noteId(),
          storeId: normalizedStoreId,
          text: cleanText,
          status: 'open',
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ notes: [note, ...state.notes] }))
      },
      setNoteStatus: (id, status) => {
        set((state) => ({
          notes: state.notes.map((note) => (
            note.id === id
              ? { ...note, status, resolvedAt: status === 'resolved' ? new Date().toISOString() : undefined }
              : note
          )),
        }))
      },
      removeNote: (id) => set((state) => ({ notes: state.notes.filter((note) => note.id !== id) })),
      notesForStore: (storeId) => {
        const normalizedStoreId = normalizeStoreId(storeId)
        return get().notes.filter((note) => normalizeStoreId(note.storeId) === normalizedStoreId)
      },
      openNotesForStore: (storeId) => {
        const normalizedStoreId = normalizeStoreId(storeId)
        return get().notes.filter((note) => normalizeStoreId(note.storeId) === normalizedStoreId && note.status === 'open')
      },
    }),
    {
      name: 'luna-district-coaching-notes',
      version: 1,
    },
  ),
)
