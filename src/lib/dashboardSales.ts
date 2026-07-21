import type { NRTrackingEntry } from './nrTracking'
import type { PerformanceData, PerformanceRow } from './performanceSheet'
import { fetchPerformanceData } from './performanceSheet'
import { dbGetDashboardNRTrackingEntries } from './supabase'

function storeKey(value: string | undefined) {
  return (value ?? '').replace(/\D/g, '')
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function applyTotals(row: PerformanceRow, entries: NRTrackingEntry[]): PerformanceRow {
  const netRevenue = row.netRevenue + entries.reduce((sum, entry) => sum + entry.nr, 0)
  const accessoryRevenue = row.accessoryRevenue + entries.reduce((sum, entry) => sum + entry.accessoryRevenue, 0)
  const vl = row.vl + entries.filter((entry) => entry.productCategory === 'voice').reduce((sum, entry) => sum + entry.lineCount, 0)
  const bts = row.bts + entries.filter((entry) => entry.productCategory === 'tablet' || entry.productCategory === 'watch' || entry.productCategory === 'hotspot').reduce((sum, entry) => sum + entry.lineCount, 0)
  const hsi = row.hsi + entries.filter((entry) => entry.productCategory === 'home-internet').reduce((sum, entry) => sum + entry.lineCount, 0)
  return {
    ...row,
    netRevenue,
    accessoryRevenue,
    vl,
    bts,
    hsi,
    netRevenuePct: row.netRevenueGoal > 0 ? (netRevenue / row.netRevenueGoal) * 100 : row.netRevenuePct,
    accessoryPct: row.accessoryGoal > 0 ? (accessoryRevenue / row.accessoryGoal) * 100 : row.accessoryPct,
  }
}

export function applyDashboardSales(source: PerformanceData, entries: NRTrackingEntry[]): PerformanceData {
  const month = currentMonthKey()
  const pending = entries.filter((entry) => entry.dashboardPushedAt && !entry.sourcePushedAt && entry.saleDate.startsWith(month))
  if (pending.length === 0) return source

  const rows = source.rows.map((row) => {
    const key = storeKey(row.storeCode)
    return applyTotals(row, pending.filter((entry) => storeKey(entry.storeId) === key))
  })
  return {
    ...source,
    rows,
    total: source.total ? applyTotals(source.total, pending) : null,
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchDashboardPerformanceData(): Promise<PerformanceData> {
  const [source, sales] = await Promise.all([fetchPerformanceData(), dbGetDashboardNRTrackingEntries()])
  return applyDashboardSales(source, sales)
}
