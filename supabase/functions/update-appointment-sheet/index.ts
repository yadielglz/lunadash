import { createClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_SPREADSHEET_ID = '1-mdm8o2I96dXSdsp_IZT2CTBvR29JDdiI3wRfJaEjUw'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ALLOWED_ROLES = new Set(['admin', 'district_manager', 'manager', 'employee'])
const STORE_SHEETS: Record<string, string> = {
  '892E': 'Lakeside',
  '697D': 'Poinciana',
  '769D': 'Haines City',
  '180E': 'Clermont',
  '561D': 'Clermont',
  '5383': 'Davenport',
  '582D': 'Lake Wales',
  '843D': 'BVL',
  '886E': 'Albert Park',
  '5733': 'Havendale',
  '693D': 'Champions Gate',
}

type UpdatePayload = {
  accessId?: string
  accessRole?: string
  storeCode?: string
  week?: string
  employeeName?: string
  appointmentDate?: string
  totalPostpaidActivations?: number
  customerNumber?: string
  customerName?: string
  selling?: string
  outcome?: string
  rowNumber?: number
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

function normalizeStoreId(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
  if (!cleaned) return ''
  return cleaned.toLowerCase() === 'main' ? 'main' : cleaned.toUpperCase()
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function cleanText(value: unknown, maxLength = 250) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function assertWeek(value: unknown) {
  const week = cleanText(value, 20)
  if (!/^Week [1-5]$/.test(week)) throw new Error('Week # must be Week 1 through Week 5.')
  return week
}

function assertTotal(value: unknown) {
  const total = Number(value)
  if (!Number.isInteger(total) || total < 0 || total > 999) {
    throw new Error('Total Postpaid Activations must be a whole number from 0 to 999.')
  }
  return total
}

function formatSheetDate(value: string) {
  if (!value) throw new Error('Appointment Date is required.')
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) throw new Error('Appointment Date must be a valid date.')
  return `${month}/${day}`
}

function base64Url(input: ArrayBuffer | string) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function getGoogleAccessToken() {
  const clientEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')
  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY.')
  }

  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${base64Url(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Could not authenticate with Google.')
  return data.access_token as string
}

async function getValues(accessToken: string, spreadsheetId: string, sheetTitle: string) {
  const range = encodeURIComponent(`'${sheetTitle.replace(/'/g, "''")}'!A:H`)
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Could not read ${sheetTitle}.`)
  return (data.values ?? []) as string[][]
}

function isOpenAppointmentRow(row: string[], week: string) {
  if (normalizeLabel(row[0] ?? '') !== normalizeLabel(week)) return false
  return [1, 2, 4, 5, 6, 7].every((index) => !(row[index] ?? '').trim())
}

function firstOpenRow(values: string[][], week: string) {
  const rowIndex = values.findIndex((row) => isOpenAppointmentRow(row, week))
  if (rowIndex >= 0) return rowIndex + 1

  const hasWeekRows = values.some((row) => normalizeLabel(row[0] ?? '') === normalizeLabel(week))
  if (hasWeekRows) throw new Error(`${week} is full on this appointment sheet.`)
  throw new Error(`Could not find ${week} rows in the appointment sheet.`)
}

function targetRowNumber(values: string[][], payload: UpdatePayload, week: string) {
  const rowNumber = Number(payload.rowNumber)
  if (!Number.isInteger(rowNumber) || rowNumber < 1) return firstOpenRow(values, week)

  const row = values[rowNumber - 1]
  if (!row) throw new Error('Could not find the appointment row to edit.')
  if (!/^week [1-5]$/.test(normalizeLabel(row[0] ?? ''))) {
    throw new Error('Selected row is not an appointment row.')
  }
  return rowNumber
}

async function validateAccess(payload: UpdatePayload) {
  if (!ALLOWED_ROLES.has(payload.accessRole ?? '')) {
    throw new Error('Appointment updates require an active store access session.')
  }

  if (payload.accessId === 'built-in-admin' && payload.accessRole === 'admin') return

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase service environment variables.')

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase
    .from('store_access_codes')
    .select('id, role, is_active')
    .eq('id', payload.accessId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.is_active || !ALLOWED_ROLES.has(data.role)) {
    throw new Error('Appointment updates require an active store login.')
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const payload = await req.json() as UpdatePayload
    await validateAccess(payload)

    const storeCode = normalizeStoreId(payload.storeCode ?? '')
    const sheetTitle = STORE_SHEETS[storeCode]
    if (!storeCode || storeCode === 'main' || !sheetTitle) {
      throw new Error(`Store ${storeCode || 'unknown'} is not mapped to an appointment sheet tab.`)
    }

    const week = assertWeek(payload.week)
    const employeeName = cleanText(payload.employeeName, 80)
    if (!employeeName) throw new Error('Employee Name is required.')

    const row = [
      week,
      employeeName,
      formatSheetDate(cleanText(payload.appointmentDate, 20)),
      assertTotal(payload.totalPostpaidActivations),
      cleanText(payload.customerNumber, 32),
      cleanText(payload.customerName, 120),
      cleanText(payload.selling, 250),
      cleanText(payload.outcome, 250),
    ]

    const spreadsheetId = Deno.env.get('APPOINTMENT_SPREADSHEET_ID') ?? DEFAULT_SPREADSHEET_ID
    const accessToken = await getGoogleAccessToken()
    const rows = await getValues(accessToken, spreadsheetId, sheetTitle)
    const rowNumber = targetRowNumber(rows, payload, week)
    const escapedTitle = sheetTitle.replace(/'/g, "''")
    const range = `'${escapedTitle}'!A${rowNumber}:H${rowNumber}`

    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    })
    const updateResult = await updateRes.json()
    if (!updateRes.ok) throw new Error(updateResult.error?.message ?? 'Google Sheets update failed.')

    return json({
      message: `${payload.rowNumber ? 'Updated' : 'Added'} appointment to ${sheetTitle} (${week}).`,
      storeCode,
      sheetTitle,
      updatedRange: updateResult.updatedRange,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not update appointment sheet.' }, 400)
  }
})
