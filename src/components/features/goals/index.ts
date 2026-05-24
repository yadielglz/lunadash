import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import Papa from "https://esm.sh/papaparse@5.4.1"

// ─── CSV Parsing Helpers ───────────────────────────────────────────────
function cell(row: string[], index: number) {
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

function rowFromCsv(row: string[]) {
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

serve(async (req) => {
  // 1. Timezone Check (Run strictly at 10:00 PM EST / EDT)
  const nyTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
  
  // If it's not exactly the 22nd hour (10:00 PM to 10:59 PM), exit early.
  if (nyTime.getHours() !== 22) {
    return new Response("Not 10:00 PM EST. Skipping snapshot.", { status: 200 })
  }

  // Format today's date as YYYY-MM-DD based strictly on New York time
  const today = nyTime.getFullYear() + '-' + 
                String(nyTime.getMonth() + 1).padStart(2, '0') + '-' + 
                String(nyTime.getDate()).padStart(2, '0')
  const month = today.slice(0, 7)

  // 2. Initialize Supabase Admin Client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // 3. Fetch Google Sheet data directly using PapaParse
  const sheetUrl = Deno.env.get('PERFORMANCE_SHEET_URL')
  let liveRows: any[] = []
  let liveTotal: any = null

  if (sheetUrl) {
    try {
      const res = await fetch(sheetUrl)
      const text = await res.text()
      const parsed = Papa.parse(text, { header: false, skipEmptyLines: false })
      const rows = parsed.data as string[][]
      
      const headerIndex = rows.findIndex((r) => 
        r.some((v) => typeof v === 'string' && v.trim() === 'Traffic') && 
        r.some((v) => typeof v === 'string' && v.trim() === 'Net Rev')
      )
      const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows

      for (const row of dataRows) {
        const store = cell(row, 1)
        if (!store) continue
        if (store.toLowerCase() === 'total') {
          liveTotal = rowFromCsv(row)
        } else if (store.toLowerCase() !== 'phoenix') {
          liveRows.push(rowFromCsv(row))
        }
      }
    } catch (err) {
      console.error("Failed to fetch/parse Google Sheet:", err)
    }
  }

  // 4. Fetch all active snapshot goals and app settings
  const [
    { data: goals, error: goalsError },
    { data: settings }
  ] = await Promise.all([
    supabase.from('goals').select('*').eq('category', 'Performance Snapshot'),
    supabase.from('app_settings').select('store_id, store_number')
  ])

  if (goalsError) return new Response(JSON.stringify({ error: goalsError.message }), { status: 500 })

  // 5. Calculate End of Day logs
  const updates = (goals || []).map((goal) => {
    const log = goal.daily_log || {}
    
    const metricKey = goal.description?.startsWith('source-snapshot:')
      ? goal.description.replace('source-snapshot:', '')
      : null
      
    let liveCurrentVal = goal.current_val || 0

    // Look up this store's real current value from the parsed Sheet
    if (metricKey) {
      let matchedRow = null
      if (goal.store_id === 'main') {
        matchedRow = liveTotal
      } else {
        const storeSetting = settings?.find((s: any) => s.store_id === goal.store_id)
        const storeNum = storeSetting?.store_number || goal.store_id
        matchedRow = liveRows.find((r) => 
          r.storeCode.includes(storeNum) || r.store.includes(storeNum)
        )
      }

      if (matchedRow && typeof matchedRow[metricKey as keyof typeof matchedRow] === 'number') {
        liveCurrentVal = matchedRow[metricKey as keyof typeof matchedRow]
      }
    }

    // Sum prior days this month
    let priorMtd = 0
    for (const [day, value] of Object.entries(log)) {
      if (day.startsWith(month) && day !== today) {
        priorMtd += Number(value) || 0
      }
    }
    
    // Today's actual number is the current MTD minus the previous days' sum
    const todayValue = Math.max(0, liveCurrentVal - priorMtd)

    return supabase
      .from('goals')
      .update({ 
        current_val: liveCurrentVal,
        daily_log: { ...log, [today]: todayValue } 
      })
      .eq('id', goal.id)
  })

  await Promise.all(updates)

  return new Response(`Successfully saved EOD snapshots for ${today}`, { status: 200 })
})