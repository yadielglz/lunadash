import { createClient } from 'npm:@supabase/supabase-js@2'

const SPREADSHEET_ID = '1-cfg8m2h1ua_51aRYx_7k9l2HTsr7qHqNl3KH7tXx2M'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ALLOWED_ROLES = new Set(['admin', 'district_manager', 'manager'])

type Payload = {
  accessId?: string; accessRole?: string; storeCode?: string; rowNumber?: number
  mdn?: string; make?: string; model?: string; imei?: string; imeiBarcode?: string
  lastChecked?: string; notes?: string; account?: string
  activationStatus?: string; informationMatches?: string; checkedBy?: string
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

function clean(value: unknown, max = 250) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max)
}

function base64Url(input: ArrayBuffer | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pemToArrayBuffer(pem: string) {
  const binary = atob(pem.replace(/\\n/g, '\n').replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, ''))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer
}

async function googleAccessToken() {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')
  if (!email || !privateKey) throw new Error('Google Sheets credentials are not configured.')
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  }))}`
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64Url(signature)}` }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description ?? 'Could not authenticate with Google.')
  return { token: data.access_token as string, email }
}

async function validateAccess(payload: Payload) {
  if (!ALLOWED_ROLES.has(payload.accessRole ?? '')) throw new Error('Demo Management requires manager access or above.')
  if (payload.storeCode?.toUpperCase() !== '693D') throw new Error('This demo roster is assigned to store 693D.')
  if (payload.accessId === 'built-in-admin' && payload.accessRole === 'admin') return
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Access validation is not configured.')
  const { data, error } = await createClient(url, key).from('store_access_codes').select('role,is_active,store_id').eq('id', payload.accessId).maybeSingle()
  if (error || !data?.is_active || !ALLOWED_ROLES.has(data.role) || String(data.store_id).toUpperCase() !== '693D') {
    throw new Error('Your manager session is no longer authorized for store 693D.')
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  try {
    const payload = await request.json() as Payload
    await validateAccess(payload)
    const rowNumber = Number(payload.rowNumber)
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > 1000) throw new Error('Invalid sheet row.')
    const values = [[clean(payload.mdn, 24), clean(payload.make, 60), clean(payload.model, 80), clean(payload.imei, 30), clean(payload.imeiBarcode, 120), clean(payload.lastChecked, 20), clean(payload.notes, 250), clean(payload.account, 60), clean(payload.activationStatus, 30), clean(payload.informationMatches, 10), clean(payload.checkedBy, 80)]]
    const range = `A${rowNumber}:K${rowNumber}`
    const google = await googleAccessToken()
    const headerResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/I1:K1?valueInputOption=RAW`, {
      method: 'PUT', headers: { Authorization: `Bearer ${google.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['ACTIVATION STATUS', 'INFORMATION MATCHES', 'CHECKED BY']] }),
    })
    if (!headerResponse.ok) {
      const headerResult = await headerResponse.json()
      const reason = headerResult.error?.message ?? 'Google Sheets update failed.'
      if (headerResponse.status === 403) throw new Error(`${reason} Share the sheet with ${google.email} as an Editor.`)
      throw new Error(reason)
    }
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT', headers: { Authorization: `Bearer ${google.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values }),
    })
    const result = await response.json()
    if (!response.ok) {
      const reason = result.error?.message ?? 'Google Sheets update failed.'
      if (response.status === 403) throw new Error(`${reason} Share the sheet with ${google.email} as an Editor.`)
      throw new Error(reason)
    }
    return json({ updatedRange: result.updatedRange ?? range })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not update the demo-device sheet.' }, 400)
  }
})
