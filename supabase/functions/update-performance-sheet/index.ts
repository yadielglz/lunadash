import { createClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_SPREADSHEET_ID = '1hJuUd6UkzfWBeTywVM6Yi5g0BxJodsNLe0XHgt-9nOQ'
const DEFAULT_SHEET_GID = 1896995460
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ALLOWED_ROLES = new Set(['admin', 'district_manager', 'manager'])

type UpdatePayload = {
  accessId?: string
  accessRole?: string
  storeCode?: string
  traffic?: number
  accessoryRevenue?: number
  vl?: number
  bts?: number
  hsi?: number
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

function normalizeStoreId(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
  if (!cleaned) return ''
  return cleaned.toLowerCase() === 'main' ? 'main' : cleaned.toUpperCase()
}

function assertNumber(value: unknown, label: string) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${label} must be a valid positive number.`)
  }
  return numberValue
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
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`
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

async function getSheetTitle(accessToken: string, spreadsheetId: string, gid: number) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Could not read spreadsheet metadata.')
  const sheet = data.sheets?.find((item: { properties?: { sheetId?: number } }) => item.properties?.sheetId === gid)
  const title = sheet?.properties?.title
  if (!title) throw new Error(`Could not find sheet tab with gid ${gid}.`)
  return title as string
}

async function getValues(accessToken: string, spreadsheetId: string, sheetTitle: string) {
  const range = encodeURIComponent(`'${sheetTitle.replace(/'/g, "''")}'!A:Q`)
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Could not read sheet values.')
  return (data.values ?? []) as string[][]
}

function storeCodeFromCell(value: string) {
  return normalizeStoreId((value.split(' - ')[0] ?? '').trim())
}

async function validateAccess(payload: UpdatePayload) {
  if (!ALLOWED_ROLES.has(payload.accessRole ?? '')) {
    throw new Error('Performance updates require manager access or higher.')
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
    throw new Error('Performance updates require an active manager, district manager, or admin login.')
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const payload = await req.json() as UpdatePayload
    await validateAccess(payload)

    const storeCode = normalizeStoreId(payload.storeCode ?? '')
    if (!storeCode || storeCode === 'main') throw new Error('A valid store code is required.')

    const values = {
      traffic: assertNumber(payload.traffic, 'Traffic'),
      accessoryRevenue: assertNumber(payload.accessoryRevenue, 'Accessories'),
      vl: assertNumber(payload.vl, 'VL'),
      bts: assertNumber(payload.bts, 'BTS'),
      hsi: assertNumber(payload.hsi, 'HSI'),
    }

    const spreadsheetId = Deno.env.get('PERFORMANCE_SPREADSHEET_ID') ?? DEFAULT_SPREADSHEET_ID
    const gid = Number(Deno.env.get('PERFORMANCE_SHEET_GID') ?? DEFAULT_SHEET_GID)
    const accessToken = await getGoogleAccessToken()
    const sheetTitle = await getSheetTitle(accessToken, spreadsheetId, gid)
    const rows = await getValues(accessToken, spreadsheetId, sheetTitle)
    const rowIndex = rows.findIndex((row) => storeCodeFromCell(row[1] ?? '') === storeCode)
    if (rowIndex < 0) throw new Error(`Could not find store ${storeCode} in the performance sheet.`)

    const rowNumber = rowIndex + 1
    const escapedTitle = sheetTitle.replace(/'/g, "''")
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${escapedTitle}'!C${rowNumber}`, values: [[values.traffic]] },
          { range: `'${escapedTitle}'!I${rowNumber}`, values: [[values.accessoryRevenue]] },
          { range: `'${escapedTitle}'!N${rowNumber}:P${rowNumber}`, values: [[values.vl, values.bts, values.hsi]] },
        ],
      }),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error?.message ?? 'Google Sheets update failed.')

    return json({
      message: `Updated ${storeCode} in Google Sheets.`,
      storeCode,
      updatedRange: result.responses?.map((item: { updatedRange?: string }) => item.updatedRange).filter(Boolean).join(', '),
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not update Google Sheets.' }, 400)
  }
})
