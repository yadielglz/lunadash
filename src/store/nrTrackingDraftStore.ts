import { create } from 'zustand'
import type { VoicePlanCalculation } from '../lib/voicePlanCalculations'

export type PendingNRCalculation = VoicePlanCalculation & {
  submissionId: string
}

type NRTrackingDraftState = {
  pending: PendingNRCalculation | null
  setPending: (calculation: VoicePlanCalculation) => void
  clearPending: () => void
}

export const useNRTrackingDraftStore = create<NRTrackingDraftState>((set) => ({
  pending: null,
  setPending: (calculation) => set({ pending: { ...calculation, submissionId: crypto.randomUUID() } }),
  clearPending: () => set({ pending: null }),
}))

