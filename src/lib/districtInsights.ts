import { dealerInfoForRow } from './dealers'
import { formatMoney, formatNumber, formatPercent, type PerformanceData, type PerformanceRow } from './performanceSheet'
import { normalizeStoreId } from './storeIds'

export type DistrictWin = {
  id: string
  label: string
  detail: string
  storeCode: string
  tone: string
}

export type DistrictBrief = {
  headline: string
  lines: string[]
  focusLabel: string
  focusValue: number
}

export function overallScore(row: PerformanceRow) {
  return (row.netRevenuePct + row.accessoryPct + row.ppPct) / 3
}

export function goalGapScore(row: PerformanceRow) {
  return (
    Math.max(100 - row.netRevenuePct, 0)
    + Math.max(100 - row.accessoryPct, 0)
    + Math.max(100 - row.ppPct, 0)
  ) / 3
}

export function rankPerformanceRows(rows: PerformanceRow[]) {
  return [...rows]
    .sort((a, b) => overallScore(b) - overallScore(a))
    .map((row, index) => ({ row, rank: index + 1 }))
}

export function findPerformanceRow(data: PerformanceData | undefined | null, identifiers: string[], useTotal = false) {
  if (!data) return null
  if (useTotal) return data.total

  const candidates = new Set(identifiers.map((value) => normalizeStoreId(value).replace(/\D/g, '')).filter(Boolean))
  return data.rows.find((row) => candidates.has(normalizeStoreId(row.storeCode).replace(/\D/g, ''))) ?? null
}

export function districtWins(data: PerformanceData | undefined | null): DistrictWin[] {
  if (!data?.rows.length) return []

  const ranked = rankPerformanceRows(data.rows)
  const top = ranked[0]?.row
  const comeback = [...data.rows].sort((a, b) => goalGapScore(a) - goalGapScore(b))[0]
  const accLeader = [...data.rows].sort((a, b) => b.accessoryPct - a.accessoryPct)[0]
  const trafficLeader = [...data.rows].sort((a, b) => b.traffic - a.traffic)[0]
  const overGoalCount = data.rows.filter((row) => row.netRevenuePct >= 100 && row.accessoryPct >= 100 && row.ppPct >= 100).length

  return [
    top && {
      id: 'top-overall',
      label: `${dealerInfoForRow(top).nickname} leads overall`,
      detail: `${formatPercent(overallScore(top))} blended score`,
      storeCode: top.storeCode,
      tone: '#7c5ff5',
    },
    accLeader && {
      id: 'acc-leader',
      label: `${dealerInfoForRow(accLeader).nickname} owns ACC`,
      detail: `${formatMoney(accLeader.accessoryRevenue)} at ${formatPercent(accLeader.accessoryPct)}`,
      storeCode: accLeader.storeCode,
      tone: '#00b7c3',
    },
    trafficLeader && {
      id: 'traffic-leader',
      label: `${dealerInfoForRow(trafficLeader).nickname} has the traffic`,
      detail: `${formatNumber(trafficLeader.traffic)} visits with ${formatPercent(trafficLeader.postConv)} post conv`,
      storeCode: trafficLeader.storeCode,
      tone: '#0f7ad8',
    },
    comeback && {
      id: 'closest-gap',
      label: `${dealerInfoForRow(comeback).nickname} is closest to clean`,
      detail: goalGapScore(comeback) <= 0 ? 'All core goals are met' : `${formatPercent(goalGapScore(comeback))} blended gap remaining`,
      storeCode: comeback.storeCode,
      tone: '#1f8a4c',
    },
    {
      id: 'over-goal-count',
      label: `${overGoalCount} stores swept core goals`,
      detail: 'Net revenue, ACC, and PP all at or above goal',
      storeCode: 'district',
      tone: '#c98408',
    },
  ].filter((win): win is DistrictWin => Boolean(win)).slice(0, 5)
}

export function smartDailyBrief({
  data,
  row,
  identifiers,
  shiftCount,
  openTaskCount,
  appointmentRows,
}: {
  data: PerformanceData | undefined | null
  row: PerformanceRow | null
  identifiers: string[]
  shiftCount: number
  openTaskCount: number
  appointmentRows: number
}): DistrictBrief {
  if (!row) {
    const store = identifiers.find(Boolean) || 'this store'
    return {
      headline: `No Source row found for ${store}.`,
      lines: [
        'Check the store ID, dealer code, or Source tab mapping.',
        `${shiftCount} shifts are scheduled and ${openTaskCount} checklist items are open.`,
      ],
      focusLabel: 'Mapping',
      focusValue: 0,
    }
  }

  const ranked = data?.rows.length ? rankPerformanceRows(data.rows) : []
  const rank = ranked.find((item) => normalizeStoreId(item.row.storeCode) === normalizeStoreId(row.storeCode))?.rank
  const metrics = [
    { label: 'Net Revenue', pct: row.netRevenuePct, left: formatMoney(Math.max(row.netRevenueGoal - row.netRevenue, 0)) },
    { label: 'ACC', pct: row.accessoryPct, left: formatMoney(Math.max(row.accessoryGoal - row.accessoryRevenue, 0)) },
    { label: 'PP', pct: row.ppPct, left: formatNumber(Math.max(row.dortGoal - row.totalPp, 0)) },
  ].sort((a, b) => a.pct - b.pct)
  const focus = metrics[0]
  const dealer = dealerInfoForRow(row)

  return {
    headline: rank
      ? `${dealer.nickname} is #${rank} in the district at ${formatPercent(overallScore(row))}.`
      : `${dealer.nickname} is at ${formatPercent(overallScore(row))} overall.`,
    lines: [
      `${focus.label} is the biggest opportunity at ${formatPercent(focus.pct)} with ${focus.left} left.`,
      `${shiftCount} shifts are scheduled today and ${openTaskCount} checklist items are open.`,
      appointmentRows > 0 ? `${appointmentRows} appointment rows are active this week.` : 'No appointment rows are filled for this week yet.',
    ],
    focusLabel: focus.label,
    focusValue: focus.pct,
  }
}
