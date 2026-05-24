import { createClient } from 'npm:@supabase/supabase-js@2'
import * as Papa from 'npm:papaparse@5.5.3'

const PERFORMANCE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1hJuUd6UkzfWBeTywVM6Yi5g0BxJodsNLe0XHgt-9nOQ/export?format=csv&gid=1896995460'
const SNAPSHOT_CATEGORY = 'Performance Snapshot'
const SNAPSHOT_PREFIX = 'source-snapshot:'

type CsvRow = string[]

type SnapshotRow = {
  store: string
  storeCode: string
  teamName: string
  traffic: number
  netRevenue: number
  accessoryRevenue: number
  totalPp: number
  vl: number
  bts: number
  hsi: number
  visa: number
}

type SnapshotGoal = {
  id: string
  store_id: string
  description: string | null
  current_val: number | null
  daily_log: Record<string, number> | null
}

type StoreSetting = {
  store_id: string
  store_number: string | null
}

function cell(row: CsvRow, index: number) {
  return (row[index] ?? '').trim()
}

function parseNumber(value: string) {
  const normalized = value.replace(/[$,%\s,]/g, '')
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function splitStoreName(value: string) {
  const [code, ...nameParts] = value.split(' - ')
  return {
    storeCode: code?.trim() ?? '',
    teamName: nameParts.join(' - ').trim(),
  }
}

function rowFromCsv(row: CsvRow): SnapshotRow {
  const store = cell(row, 1)
  const { storeCode, teamName } = splitStoreName(store)

  return {
    store,
    storeCode,
    teamName,
    traffic: parseNumber(cell(row, 2)),
    netRevenue: parseNumber(cell(row, 5)),
    accessoryRevenue: parseNumber(cell(row, 8)),
    totalPp: parseNumber(cell(row, 11)),
    vl: parseNumber(cell(row, 13)),
    bts: parseNumber(cell(row, 14)),
    hsi: parseNumber(cell(row, 15)),
    visa: parseNumber(cell(row, 16)),
  }
}

async function fetchSnapshotRows() {
  const sheetUrl = Deno.env.get('PERFORMANCE_SHEET_URL') ?? PERFORMANCE_SHEET_CSV_URL
  const res = await fetch(sheetUrl)
  if (!res.ok) throw new Error(`Failed to fetch performance sheet: ${res.status} ${res.statusText}`)

  const parsed = Papa.parse<CsvRow>(await res.text(), {
    header: false,
    skipEmptyLines: false,
  })
  const rows = parsed.data
  const headerIndex = rows.findIndex((row) => (
    row.some((value) => typeof value === 'string' && value.trim() === 'Traffic')
    && row.some((value) => typeof value === 'string' && value.trim() === 'Net Rev')
  ))
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows
  const liveRows: SnapshotRow[] = []
  let liveTotal: SnapshotRow | null = null

  for (const row of dataRows) {
    const store = cell(row, 1)
    if (!store) continue

    const normalizedStore = store.toLowerCase()
    if (normalizedStore === 'total') {
      liveTotal = rowFromCsv(row)
    } else if (normalizedStore !== 'phoenix') {
      liveRows.push(rowFromCsv(row))
    }
  }

  return { liveRows, liveTotal }
}

function metricKeyFromGoal(goal: SnapshotGoal) {
  return goal.description?.startsWith(SNAPSHOT_PREFIX)
    ? goal.description.slice(SNAPSHOT_PREFIX.length)
    : null
}

function findSourceRow(
  goal: SnapshotGoal,
  settings: StoreSetting[],
  liveRows: SnapshotRow[],
  liveTotal: SnapshotRow | null,
) {
  if (goal.store_id === 'main') return liveTotal

  const storeSetting = settings.find((setting) => setting.store_id === goal.store_id)
  const storeNumber = storeSetting?.store_number || goal.store_id

  return liveRows.find((row) => (
    row.storeCode.includes(storeNumber)
    || row.store.includes(storeNumber)
  )) ?? null
}

Deno.serve(async (_req: Request) => {
  const nyTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  if (nyTime.getHours() !== 22) {
    return new Response('Not 10:00 PM New York time. Skipping snapshot.', { status: 200 })
  }

  const today = [
    nyTime.getFullYear(),
    String(nyTime.getMonth() + 1).padStart(2, '0'),
    String(nyTime.getDate()).padStart(2, '0'),
  ].join('-')
  const month = today.slice(0, 7)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Missing Supabase service environment variables' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { liveRows, liveTotal } = await fetchSnapshotRows()
    const [{ data: goals, error: goalsError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from('goals').select('*').eq('category', SNAPSHOT_CATEGORY),
      supabase.from('app_settings').select('store_id, store_number'),
    ])

    if (goalsError) throw goalsError
    if (settingsError) throw settingsError

    const updates = ((goals ?? []) as SnapshotGoal[]).map((goal) => {
      const log = goal.daily_log ?? {}
      const metricKey = metricKeyFromGoal(goal)
      const matchedRow = findSourceRow(goal, (settings ?? []) as StoreSetting[], liveRows, liveTotal)
      const liveValue = metricKey && matchedRow && metricKey in matchedRow
        ? Number(matchedRow[metricKey as keyof SnapshotRow]) || 0
        : goal.current_val ?? 0

      const priorMtd = Object.entries(log).reduce((sum, [day, value]) => {
        if (!day.startsWith(month) || day === today) return sum
        return sum + (Number(value) || 0)
      }, 0)

      return supabase
        .from('goals')
        .update({
          current_val: liveValue,
          daily_log: { ...log, [today]: Math.max(0, liveValue - priorMtd) },
        })
        .eq('id', goal.id)
    })

    const results = await Promise.all(updates)
    const updateError = results.find((result) => result.error)?.error
    if (updateError) throw updateError

    return Response.json({
      message: `Successfully saved EOD snapshots for ${today}`,
      updated: results.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('snapshot-eod failed:', error)
    return Response.json({ error: message }, { status: 500 })
  }
})
