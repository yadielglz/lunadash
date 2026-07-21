import { calculateNetRevenue } from './voicePlanCalculations'
import type { VoicePlanCategory } from './voicePlans'
import type { ProductCategory } from './recurringProducts'

export type NRTrackingSource = 'voice-plan-calculator' | 'manual'

export type NRTrackingEntry = {
  id: string
  saleId: string
  createdAt: string
  saleDate: string
  employeeId?: string
  employeeName?: string
  storeId?: string
  storeName?: string
  source: NRTrackingSource
  category: VoicePlanCategory
  planId: string
  planName: string
  lineCount: number
  mrc: number
  nr: number
  notes?: string
  saleType: 'new-account' | 'add-a-line' | 'product'
  productCategory: ProductCategory
  accountLineCountBefore: number
  accountLineCountAfter: number
  accountMrcBefore: number
  accountMrcAfter: number
  accessoryRevenue: number
  dashboardPushedAt?: string
  dashboardPushedBy?: string
  sourcePushedAt?: string
  sourcePushedBy?: string
}

export type NRSummary = {
  totalNR: number
  totalMRC: number
  totalSales: number
  totalVoiceLines: number
  averageNRPerSale: number
  averageNRPerVoiceLine: number
  totalAccessoryRevenue: number
  totalBts: number
  totalHsi: number
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export function normalizeNRTrackingEntry(entry: Omit<NRTrackingEntry, 'nr'> & { nr?: number }): NRTrackingEntry {
  if (!entry.id.trim()) throw new Error('A submission ID is required.')
  if (!entry.saleDate) throw new Error('Sale date is required.')
  if (!entry.planId || !entry.planName) throw new Error('Voice plan is required.')
  if (!Number.isInteger(entry.lineCount) || entry.lineCount <= 0) throw new Error('Voice line count must be a positive whole number.')
  const saleType = entry.saleType ?? 'new-account'
  const accountLineCountBefore = entry.accountLineCountBefore ?? 0
  const accountLineCountAfter = entry.accountLineCountAfter ?? entry.lineCount
  const accountMrcBefore = entry.accountMrcBefore ?? 0
  const accountMrcAfter = entry.accountMrcAfter ?? entry.mrc
  if (saleType === 'add-a-line') {
    if (!Number.isInteger(entry.lineCount) || entry.lineCount <= 0) throw new Error('Add-a-line entries require a positive line quantity.')
  }
  const mrc = saleType === 'add-a-line'
    ? roundCurrency(accountMrcAfter - accountMrcBefore)
    : roundCurrency(entry.mrc)
  if (mrc < 0) throw new Error('Incremental MRC cannot be negative.')
  const accessoryRevenue = roundCurrency(entry.accessoryRevenue ?? 0)
  if (accessoryRevenue < 0) throw new Error('Accessory revenue cannot be negative.')
  return { ...entry, saleType, accountLineCountBefore, accountLineCountAfter, accountMrcBefore, accountMrcAfter, accessoryRevenue, mrc, nr: calculateNetRevenue(mrc) }
}

export function calculateNRSummary(entries: NRTrackingEntry[]): NRSummary {
  const totalMRC = roundCurrency(entries.reduce((sum, entry) => sum + entry.mrc, 0))
  const totalNR = roundCurrency(entries.reduce((sum, entry) => sum + calculateNetRevenue(entry.mrc), 0))
  const totalSales = new Set(entries.map((entry) => entry.saleId || entry.id)).size
  const totalAccessoryRevenue = roundCurrency(entries.reduce((sum, entry) => sum + (entry.accessoryRevenue ?? 0), 0))
  const totalBts = entries.filter((entry) => entry.productCategory === 'tablet' || entry.productCategory === 'watch' || entry.productCategory === 'hotspot').reduce((sum, entry) => sum + entry.lineCount, 0)
  const totalHsi = entries.filter((entry) => entry.productCategory === 'home-internet').reduce((sum, entry) => sum + entry.lineCount, 0)
  const totalVoiceLines = entries.filter((entry) => entry.productCategory === 'voice').reduce((sum, entry) => sum + entry.lineCount, 0)
  return {
    totalNR,
    totalMRC,
    totalSales,
    totalVoiceLines,
    averageNRPerSale: totalSales ? roundCurrency(totalNR / totalSales) : 0,
    averageNRPerVoiceLine: totalVoiceLines ? roundCurrency(totalNR / totalVoiceLines) : 0,
    totalAccessoryRevenue,
    totalBts,
    totalHsi,
  }
}

export function hasDuplicateSubmission(entries: NRTrackingEntry[], id: string) {
  return entries.some((entry) => entry.id === id)
}
