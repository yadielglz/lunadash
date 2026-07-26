import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EodCopyFormat = 'detailed' | 'compact'
export type CaptureMetric = 'netRevenue' | 'accessories' | 'pp' | 'vl' | 'bts' | 'hsi' | 'visa'

export const CAPTURE_METRIC_LABELS: Record<CaptureMetric, string> = {
  netRevenue: 'NR',
  accessories: 'ACC',
  pp: 'PP',
  vl: 'VL',
  bts: 'BTS',
  hsi: 'HSI',
  visa: 'VISA',
}

interface EodSettingsState {
  copyFormat: EodCopyFormat
  captureShowTotals: boolean
  captureShowTopFive: boolean
  captureShowOutlook: boolean
  captureMetrics: CaptureMetric[]
  setCopyFormat: (format: EodCopyFormat) => void
  setCaptureShowTotals: (show: boolean) => void
  setCaptureShowTopFive: (show: boolean) => void
  setCaptureShowOutlook: (show: boolean) => void
  toggleCaptureMetric: (metric: CaptureMetric) => void
}

export const useEodSettingsStore = create<EodSettingsState>()(
  persist(
    (set) => ({
      copyFormat: 'detailed',
      captureShowTotals: true,
      captureShowTopFive: true,
      captureShowOutlook: true,
      captureMetrics: ['netRevenue', 'accessories', 'pp', 'vl', 'bts', 'hsi', 'visa'],
      setCopyFormat: (copyFormat) => set({ copyFormat }),
      setCaptureShowTotals: (captureShowTotals) => set({ captureShowTotals }),
      setCaptureShowTopFive: (captureShowTopFive) => set({ captureShowTopFive }),
      setCaptureShowOutlook: (captureShowOutlook) => set({ captureShowOutlook }),
      toggleCaptureMetric: (metric) => set((state) => ({
        captureMetrics: state.captureMetrics.includes(metric)
          ? state.captureMetrics.filter((item) => item !== metric)
          : [...state.captureMetrics, metric],
      })),
    }),
    { name: 'lunadash-eod-settings' },
  ),
)
