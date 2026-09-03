import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ReportOrientation = 'portrait' | 'landscape'

interface ReportLayoutState {
  /** Page orientation used for every print-ready report. Persisted per browser. */
  orientation: ReportOrientation
  setOrientation: (orientation: ReportOrientation) => void
}

export const useReportLayoutStore = create<ReportLayoutState>()(
  persist(
    (set) => ({
      orientation: 'portrait',
      setOrientation: (orientation) => set({ orientation }),
    }),
    { name: 'lunadash-report-layout' },
  ),
)

/** Orientation-dependent page geometry shared by all report HTML builders. */
export function reportPageMetrics(orientation: ReportOrientation) {
  const landscape = orientation === 'landscape'
  return {
    orientation,
    width: landscape ? '11in' : '8.5in',
    minHeight: landscape ? '8.5in' : '11in',
    padding: landscape ? '0.45in' : '0.55in',
    printPadding: landscape ? '0.35in' : '0.45in',
    pageRule: `@page { size: ${orientation}; margin: 0.35in; }`,
  }
}
