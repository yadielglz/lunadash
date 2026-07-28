import { createClient } from 'npm:@supabase/supabase-js@2'
import Papa from 'npm:papaparse@5.5.3'

const PERFORMANCE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1hJuUd6UkzfWBeTywVM6Yi5g0BxJodsNLe0XHgt-9nOQ/export?format=csv&gid=1896995460'
const SNAPSHOT_CATEGORY = 'Performance Snapshot'
const SNAPSHOT_PREFIX = 'source-snapshot:'
const SNAPSHOT_START_HOUR = 22
const SOURCE_FETCH_ROUNDS = 2
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

function isValidStoreCode(value: string) {
  return /^[A-Z0-9]{4}$/i.test(value.trim())
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
  const configuredUrl = new URL(sheetUrl)
  const sheetId = configuredUrl.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1]
  const gid = configuredUrl.searchParams.get('gid') ?? '0'
  const sourceUrls = [
    sheetUrl,
    ...(sheetId ? [
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&single=true&gid=${gid}`,
    ] : []),
  ]
  let csvText = ''
  let lastError = 'Performance sheet could not be loaded.'

  for (let round = 1; round <= SOURCE_FETCH_ROUNDS && !csvText; round += 1) {
    for (const sourceUrl of sourceUrls) {
      try {
        const res = await fetch(sourceUrl, {
          headers: {
            Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.1',
            'User-Agent': 'Mozilla/5.0 (compatible; LunaDash-EOD/1.0)',
          },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

        const candidate = await res.text()
        if (/<html|<!doctype|docs-sheet|waffle/i.test(candidate)) {
          throw new Error('Google returned HTML instead of CSV')
        }
        csvText = candidate
        break
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    if (!csvText && round < SOURCE_FETCH_ROUNDS) {
      await new Promise((resolve) => setTimeout(resolve, round * 1500))
    }
  }
  if (!csvText) throw new Error(`Performance sheet failed across all CSV endpoints: ${lastError}`)

  const parsed = Papa.parse<CsvRow>(csvText, {
    header: false,
    skipEmptyLines: false,
  })
  const rows = parsed.data
  const headerIndex = rows.findIndex((row) => (
    row.some((value) => typeof value === 'string' && value.trim() === 'Traffic')
    && row.some((value) => typeof value === 'string' && value.trim() === 'Net Rev')
  ))
  // The Google Visualization CSV endpoint omits the visible header rows but
  // preserves the same column positions. HTML is rejected above and the full
  // Total + valid four-character store set is validated below.
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
      const liveRow = rowFromCsv(row)
      if (isValidStoreCode(liveRow.storeCode)) liveRows.push(liveRow)
    }
  }

  if (liveRows.length === 0 || !liveTotal) {
    throw new Error('Performance sheet CSV did not include any valid stores and a Total row. Snapshot was not saved.')
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
    const { data: priorRun } = await supabase
      .from('eod_snapshot_runs')
      .select('status,attempt_count')
      .eq('snapshot_date', snapshotDay)
      .maybeSingle()

    if (!force && priorRun?.status === 'complete') {
      return Response.json({
        message: `EOD snapshot for ${snapshotDay} is already complete.`,
        skipped: true,
      }, { headers: CORS_HEADERS })
    }

    await supabase
      .from('eod_snapshot_runs')
      .upsert({
        snapshot_date: snapshotDay,
        status: 'running',
        attempt_count: Number(priorRun?.attempt_count ?? 0) + 1,
        last_error: null,
        last_attempt_at: new Date().toISOString(),
      })

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

    if (!liveTotal || targets.some(({ storeId }) => storeId !== 'main' && !isValidStoreCode(storeId))) {
      throw new Error('Performance sheet did not contain a complete, valid store set. Snapshot was not saved.')
    }

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

    await supabase
      .from('eod_snapshot_runs')
      .upsert({
        snapshot_date: snapshotDay,
        status: 'complete',
        expected_entries: results.length,
        saved_entries: results.length,
        attempt_count: Number(priorRun?.attempt_count ?? 0) + 1,
        last_error: null,
        last_attempt_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })

    return Response.json({
      message: `Successfully saved EOD snapshots for ${snapshotDay}`,
      updated: results.length,
      forced: force,
    }, { headers: CORS_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('snapshot-eod failed:', error)
    const { data: failedRun } = await supabase
      .from('eod_snapshot_runs')
      .select('attempt_count')
      .eq('snapshot_date', snapshotDay)
      .maybeSingle()
    await supabase
      .from('eod_snapshot_runs')
      .upsert({
        snapshot_date: snapshotDay,
        status: 'failed',
        attempt_count: Math.max(Number(failedRun?.attempt_count ?? 1), 1),
        last_error: message.slice(0, 1000),
        last_attempt_at: new Date().toISOString(),
      })
    return Response.json({ error: message }, { status: 500, headers: CORS_HEADERS })
  }
})
