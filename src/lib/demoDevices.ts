import Papa from 'papaparse'
import { supabase } from './supabase'

export const DEMO_SHEET_ID = '1-cfg8m2h1ua_51aRYx_7k9l2HTsr7qHqNl3KH7tXx2M'
export const DEMO_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEMO_SHEET_ID}/edit?gid=0#gid=0`
const DEMO_CSV_URL = `https://docs.google.com/spreadsheets/d/${DEMO_SHEET_ID}/export?format=csv&gid=0`

export type DemoDevice = {
  rowNumber: number
  mdn: string
  make: string
  model: string
  imei: string
  imeiBarcode: string
  lastChecked: string
  notes: string
  account: string
  activationStatus: string
  informationMatches: string
  checkedBy: string
}

export async function fetchDemoDevices(): Promise<DemoDevice[]> {
  const response = await fetch(`${DEMO_CSV_URL}&_=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load the demo-device sheet.')
  const text = await response.text()
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  return parsed.data.map((row, index) => ({
    rowNumber: index + 2,
    mdn: row.MDN?.trim() ?? '',
    make: row['DEV MAKE']?.trim() ?? '',
    model: row['DEV MODEL']?.trim() ?? '',
    imei: row.IMEI?.trim() ?? '',
    imeiBarcode: row['IMEI BARCODE']?.trim() ?? '',
    lastChecked: row['LAST CHECKED']?.trim() ?? '',
    notes: row.NOTES?.trim() ?? '',
    account: row.Account?.trim() ?? '',
    activationStatus: row['ACTIVATION STATUS']?.trim() ?? '',
    informationMatches: row['INFORMATION MATCHES']?.trim() ?? '',
    checkedBy: row['CHECKED BY']?.trim() ?? '',
  }))
}

/** Digits-only helper shared by audit-status checks. */
export function demoDigits(value: string) {
  return (value ?? '').replace(/\D/g, '')
}

/** A demo line counts as activated when it has a live SIM / valid MDN and no inactive note. */
export function isDemoDeviceActivated(device: DemoDevice) {
  if (device.activationStatus) return device.activationStatus.toLowerCase() === 'active'
  const note = device.notes.toLowerCase()
  return demoDigits(device.mdn).length >= 10 && !note.includes('inactive') && device.make !== '-' && device.model !== '-'
}

/** The sheet stores "M/D"; a device is current when that month matches this month. */
export function demoDeviceCheckedThisMonth(value: string) {
  const [month] = (value ?? '').split('/').map(Number)
  return month === new Date().getMonth() + 1
}

/** Today's date in the sheet's "M/D" format. */
export function demoSheetToday() {
  const now = new Date()
  return `${now.getMonth() + 1}/${now.getDate()}`
}

export type DemoDeviceUpdate = Omit<DemoDevice, 'rowNumber'> & {
  rowNumber: number
  accessId: string
  accessRole: string
  storeCode: string
}

export async function updateDemoDevice(payload: DemoDeviceUpdate) {
  const { data, error } = await supabase.functions.invoke('update-demo-sheet', { body: payload })
  if (error) {
    const response = (error as { context?: Response }).context
    if (response) {
      let serverMessage = ''
      try {
        const details = await response.clone().json() as { error?: string }
        serverMessage = details.error ?? ''
      } catch { /* Fall back to the SDK message for non-JSON responses. */ }
      if (serverMessage) throw new Error(serverMessage)
    }
    throw new Error(error.message || 'Could not update the demo-device sheet.')
  }
  if (data?.error) throw new Error(data.error)
  return data as { updatedRange: string }
}
