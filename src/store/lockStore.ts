import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface LockState {
  pinHash: string | null   // null = no PIN set
  isLocked: boolean
  setPinHash: (hash: string | null) => void
  lock: () => void
  unlock: () => void
}

export const useLockStore = create<LockState>()(
  persist(
    (set) => ({
      pinHash: null,
      isLocked: false,
      setPinHash: (hash) => set({ pinHash: hash }),
      lock: () => set({ isLocked: true }),
      unlock: () => set({ isLocked: false }),
    }),
    {
      name: 'luna-lock',
      partialize: (s) => ({ pinHash: s.pinHash }),
    }
  )
)
