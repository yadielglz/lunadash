import Papa from 'papaparse'

const PERFORMANCE_SHEET_ID = '1hJuUd6UkzfWBeTywVM6Yi5g0BxJodsNLe0XHgt-9nOQ'
const PERFORMANCE_SHEET_GID = '1896995460'

export const PERFORMANCE_SHEET_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${PERFORMANCE_SHEET_ID}/export?format=csv&gid=${PERFORMANCE_SHEET_GID}`

export interface PerformanceRow {
  rank: string
  store: string
  storeCode: string
  teamName: string
  traffic: number
  postConv: number
  netRevenueGoal: number
  netRevenue: number
  netRevenuePct: number
  accessoryGoal: number
  accessoryRevenue: number
  accessoryPct: number
  dortGoal: number
  totalPp: number
  ppPct: number
  vl: number
  bts: number
  hsi: number
  visa: number
}

export interface PerformanceSummary {
  label: string
  netRevenueLeft: number | null
  accessoryLeft: number | null
  postLeft: number | null
}

export interface PerformanceData {
  rows: PerformanceRow[]
  total: PerformanceRow | null
  summary: PerformanceSummary | null
  updatedAt: string
}

type RawCsvRow = string[]

function cell(row: RawCsvRow, index: number) {
  return (row[index] ?? '').trim()
}

function parseNumber(value: string) {
  const normalized = value.replace(/[$,%\s,]/g, '')
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseNullableNumber(value: string) {
  if (!value.trim()) return null
  return parseNumber(value)
}

function percentToGoal(value: number, goal: number, fallback: number) {
  if (goal <= 0) return fallback
  return (value / goal) * 100
}

function splitStoreName(value: string) {
  const [code, ...nameParts] = value.split(' - ')
  return {
    storeCode: code?.trim() ?? '',
    teamName: nameParts.join(' - ').trim(),
  }
}

function rowFromCsv(row: RawCsvRow): PerformanceRow {
  const store = cell(row, 1)
  const { storeCode, teamName } = splitStoreName(store)
  const netRevenueGoal = parseNumber(cell(row, 4))
  const netRevenue = parseNumber(cell(row, 5))
  const accessoryGoal = parseNumber(cell(row, 7))
  const accessoryRevenue = parseNumber(cell(row, 8))
  const dortGoal = parseNumber(cell(row, 10))
  const totalPp = parseNumber(cell(row, 11))

  return {
    rank: cell(row, 0),
    store,
    storeCode,
    teamName,
    traffic: parseNumber(cell(row, 2)),
    postConv: parseNumber(cell(row, 3)),
    netRevenueGoal,
    netRevenue,
    netRevenuePct: percentToGoal(netRevenue, netRevenueGoal, parseNumber(cell(row, 6))),
    accessoryGoal,
    accessoryRevenue,
    accessoryPct: percentToGoal(accessoryRevenue, accessoryGoal, parseNumber(cell(row, 9))),
    dortGoal,
    totalPp,
    ppPct: percentToGoal(totalPp, dortGoal, parseNumber(cell(row, 12))),
    vl: parseNumber(cell(row, 13)),
    bts: parseNumber(cell(row, 14)),
    hsi: parseNumber(cell(row, 15)),
    visa: parseNumber(cell(row, 16)),
  }
}

function parseSummary(row: RawCsvRow): PerformanceSummary | null {
  const label = cell(row, 1)
  if (!label) return null

  return {
    label,
    netRevenueLeft: parseNullableNumber(cell(row, 5)),
    accessoryLeft: parseNullableNumber(cell(row, 8)),
    postLeft: parseNullableNumber(cell(row, 11)),
  }
}

function parseCsv(text: string): PerformanceData {
  const parsed = Papa.parse<RawCsvRow>(text, {
    header: false,
    skipEmptyLines: false,
  })

  const rows = parsed.data
  const headerIndex = rows.findIndex((row) => (
    row.some((value) => value.trim() === 'Traffic')
    && row.some((value) => value.trim() === 'Net Rev')
  ))
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows
  const performanceRows: PerformanceRow[] = []
  let total: PerformanceRow | null = null
  let summary: PerformanceSummary | null = null

  for (const row of dataRows) {
    const store = cell(row, 1)
    if (!store) continue

    if (store.toLowerCase() === 'total') {
      total = rowFromCsv(row)
      continue
    }

    if (store.toLowerCase() === 'phoenix') {
      summary = parseSummary(row)
      continue
    }

    performanceRows.push(rowFromCsv(row))
  }

  return {
    rows: performanceRows,
    total,
    summary,
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchPerformanceData(): Promise<PerformanceData> {
  const res = await fetch(PERFORMANCE_SHEET_CSV_URL)
  if (!res.ok) throw new Error(`Failed to fetch performance Source: ${res.statusText}`)
  return parseCsv(await res.text())
}

export function formatMoney(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function formatNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function formatPercent(value: number) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}
