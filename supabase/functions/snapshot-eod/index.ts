import { createClient } from 'npm:@supabase/supabase-js@2'
import Papa from 'npm:papaparse@5.5.3'

const PERFORMANCE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1hJuUd6UkzfWBeTywVM6Yi5g0BxJodsNLe0XHgt-9nOQ/export?format=csv&gid=1896995460'
const SNAPSHOT_CATEGORY = 'Performance Snapshot'
const SNAPSHOT_PREFIX = 'source-snapshot:'
const SNAPSHOT_START_HOUR = 22
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CsvRow = string[]

type SnapshotRow = {
  store: string
  storeCode: string
  teamName: string
  traffic: number
  netRevenueGoal: number
  netRevenue: number
  accessoryGoal: number
  accessoryRevenue: number
  dortGoal: number
  totalPp: number
  vl: number
  bts: number
  hsi: number
  visa: number
}

type SnapshotGoal = {
  id: string
  store_id: string
  title: string
  description: string | null
  current_val: number | null
  daily_target: number | null
  daily_log: Record<string, number> | null
}

type SnapshotMetric = {
  key: keyof SnapshotRow
  title: string
  unit: string
  color: string
}

const SNAPSHOT_METRICS: SnapshotMetric[] = [
  { key: 'netRevenue', title: 'Net Revenue', unit: '$', color: '#16c60c' },
  { key: 'accessoryRevenue', title: 'Accessories', unit: '$', color: '#00b7c3' },
  { key: 'totalPp', title: 'Total PP', unit: '', color: '#7c5ff5' },
  { key: 'traffic', title: 'Traffic', unit: '', color: '#f7b731' },
  { key: 'vl', title: 'Voice Lines', unit: '', color: '#0f7ad8' },
  { key: 'bts', title: 'BTS', unit: '', color: '#f7630c' },
  { key: 'hsi', title: 'HSI', unit: '', color: '#e3008c' },
  { key: 'visa', title: 'VISA', unit: '', color: '#e74856' },
]

function cell(row: CsvRow, index: number) {
  return (row[index] ?? '').trim()
}

function parseNumber(value: string) {
  const normalized = value.replace(/[$,%\s,]/g, '')
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStoreId(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
  if (!cleaned) return ''
  return cleaned.toLowerCase() === 'main' ? 'main' : cleaned.toUpperCase()
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
    netRevenueGoal: parseNumber(cell(row, 4)),
    netRevenue: parseNumber(cell(row, 5)),
    accessoryGoal: parseNumber(cell(row, 7)),
    accessoryRevenue: parseNumber(cell(row, 8)),
    dortGoal: parseNumber(cell(row, 10)),
    totalPp: parseNumber(cell(row, 11)),
    vl: parseNumber(cell(row, 13)),
    bts: parseNumber(cell(row, 14)),
    hsi: parseNumber(cell(row, 15)),
    visa: parseNumber(cell(row, 16)),
  }
}

function goalValueForMetric(row: SnapshotRow | null, metricKey: string | null) {
  if (!row || !metricKey) return 0
  if (metricKey === 'netRevenue') return row.netRevenueGoal
  if (metricKey === 'accessoryRevenue') return row.accessoryGoal
  if (metricKey === 'totalPp') return row.dortGoal
  if (metricKey === 'vl') return row.dortGoal * 0.5
  if (metricKey === 'bts') return row.dortGoal * 0.4
  if (metricKey === 'hsi') return row.dortGoal * 0.1
  return 0
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

function snapshotDescription(metricKey: string) {
  return `${SNAPSHOT_PREFIX}${metricKey}`
}

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function newYorkHour(date: Date) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date).find((part) => part.type === 'hour')?.value
  return Number(hour)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const now = new Date()
  const url = new URL(req.url)
  let force = url.searchParams.get('force') === 'true'
  try {
    const body = await req.json()
    force = force || body?.force === true
  } catch {
    // Scheduled invokes do not send JSON.
  }

  const hour = newYorkHour(now)
  if (!force && hour < SNAPSHOT_START_HOUR) {
    return Response.json({
      message: 'Not EOD yet in New York. Skipping snapshot.',
      skipped: true,
    }, { status: 200, headers: CORS_HEADERS })
  }

  const snapshotDay = dateKey(now)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Missing Supabase service environment variables' }, { status: 500, headers: CORS_HEADERS })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { liveRows, liveTotal } = await fetchSnapshotRows()
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('category', SNAPSHOT_CATEGORY)

    if (goalsError) throw goalsError

    const targets = [
      ...(liveTotal ? [{ storeId: 'main', row: liveTotal }] : []),
      ...liveRows.map((row) => ({ storeId: normalizeStoreId(row.storeCode), row })),
    ]

    const existingGoals = (goals ?? []) as SnapshotGoal[]
    const updates = targets.flatMap(({ storeId, row }) => (
      SNAPSHOT_METRICS.map((metric) => {
        const description = snapshotDescription(metric.key)
        const normalizedStoreId = normalizeStoreId(storeId)
        const existingGoal = existingGoals.find((goal) => (
          normalizeStoreId(goal.store_id) === normalizedStoreId
          && metricKeyFromGoal(goal) === metric.key
        ))
        const log = existingGoal?.daily_log ?? {}
        const liveValue = Number(row[metric.key]) || 0
        const dailyLog = { ...log, [snapshotDay]: Math.max(0, liveValue) }
        const dailyTarget = goalValueForMetric(row, metric.key)

        if (existingGoal) {
          return supabase
            .from('goals')
            .update({
              current_val: liveValue,
              daily_target: dailyTarget,
              daily_log: dailyLog,
            })
            .eq('id', existingGoal.id)
        }

        return supabase
          .from('goals')
          .insert({
            id: crypto.randomUUID(),
            store_id: normalizedStoreId,
            title: metric.title,
            description,
            category: SNAPSHOT_CATEGORY,
            target: 0,
            current_val: liveValue,
            unit: metric.unit,
            deadline: new Date().toISOString(),
            color: metric.color,
            daily_target: dailyTarget,
            daily_log: dailyLog,
            milestones: [],
          })
      })
    ))

    const results = await Promise.all(updates)
    const updateError = results.find((result) => result.error)?.error
    if (updateError) throw updateError

    return Response.json({
      message: `Successfully saved EOD snapshots for ${snapshotDay}`,
      updated: results.length,
      forced: force,
    }, { headers: CORS_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('snapshot-eod failed:', error)
    return Response.json({ error: message }, { status: 500, headers: CORS_HEADERS })
  }
})
