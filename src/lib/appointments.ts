import { supabase } from './supabase'

const APPOINTMENT_SHEET_ID = '1-mdm8o2I96dXSdsp_IZT2CTBvR29JDdiI3wRfJaEjUw'

export type AppointmentBucket = 'Week 1' | 'Week 2' | 'Week 3' | 'Week 4' | 'Week 5'

export const APPOINTMENT_BUCKETS: AppointmentBucket[] = [
  'Week 1',
  'Week 2',
  'Week 3',
  'Week 4',
  'Week 5',
]

export const APPOINTMENT_STORE_SHEETS: Record<string, string> = {
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

export const APPOINTMENT_COLUMNS = [
  'Week #',
  'Employee Name',
  'Appointment Date',
  'Total Postpaid Activations',
  'Customer Number',
  'Customer Name',
  'What are we selling?',
  'Outcome?',
] as const

export type AppointmentRow = {
  rowNumber?: number
  week: string
  employeeName: string
  appointmentDate: string
  totalPostpaidActivations: string
  customerNumber: string
  customerName: string
  selling: string
  outcome: string
}

export type AppointmentTrackerData = {
  sheetTitle: string
  rows: AppointmentRow[]
  updatedAt: string
}

export type AppointmentSheetUpdate = {
  accessId: string
  accessRole: string
  storeCode: string
  week: AppointmentBucket
  employeeName: string
  appointmentDate: string
  totalPostpaidActivations: number
  customerNumber: string
  customerName: string
  selling: string
  outcome: string
  rowNumber?: number
}

function gvizUrl(sheetTitle: string) {
  const params = new URLSearchParams({
    tqx: 'out:json',
    sheet: sheetTitle,
  })
  return `https://docs.google.com/spreadsheets/d/${APPOINTMENT_SHEET_ID}/gviz/tq?${params.toString()}`
}

function parseGviz(text: string) {
  const jsonText = text
    .replace(/^[\s\S]*?google\.visualization\.Query\.setResponse\(/, '')
    .replace(/\);\s*$/, '')
  return JSON.parse(jsonText) as {
    table?: {
      rows?: { c?: ({ v?: string | number | null; f?: string | null } | null)[] }[]
    }
  }
}

function cell(row: { c?: ({ v?: string | number | null; f?: string | null } | null)[] }, index: number) {
  const value = row.c?.[index]
  return String(value?.f ?? value?.v ?? '').trim()
}

export function appointmentSheetForStore(storeCode: string) {
  return APPOINTMENT_STORE_SHEETS[storeCode.trim().toUpperCase()] ?? ''
}

export async function fetchAppointmentTrackerData(storeCode: string): Promise<AppointmentTrackerData> {
  const sheetTitle = appointmentSheetForStore(storeCode)
  if (!sheetTitle) throw new Error(`Store ${storeCode || 'unknown'} is not mapped to an appointment sheet tab.`)

  const res = await fetch(gvizUrl(sheetTitle))
  if (!res.ok) throw new Error(`Failed to fetch appointments: ${res.statusText}`)
  const data = parseGviz(await res.text())
  const rows = (data.table?.rows ?? [])
    .map((row, index) => ({
      rowNumber: index + 1,
      week: cell(row, 0),
      employeeName: cell(row, 1),
      appointmentDate: cell(row, 2),
      totalPostpaidActivations: cell(row, 3),
      customerNumber: cell(row, 4),
      customerName: cell(row, 5),
      selling: cell(row, 6),
      outcome: cell(row, 7),
    }))
    .filter((row) => row.week && row.week !== 'Week #')

  return { sheetTitle, rows, updatedAt: new Date().toISOString() }
}

export function appointmentPostpaidTotal(data: AppointmentTrackerData | null, week: string) {
  return (data?.rows ?? [])
    .filter((row) => row.week.trim().toLowerCase() === week.trim().toLowerCase())
    .reduce((sum, row) => {
      const parsed = Number(row.totalPostpaidActivations.replace(/[,\s]/g, ''))
      return sum + (Number.isFinite(parsed) ? parsed : 0)
    }, 0)
}

export function appointmentFilledRows(data: AppointmentTrackerData | null, week: string) {
  return (data?.rows ?? []).filter((row) => (
    row.week.trim().toLowerCase() === week.trim().toLowerCase()
    && [row.employeeName, row.appointmentDate, row.customerNumber, row.customerName, row.selling, row.outcome].some(Boolean)
  ))
}

export async function updateAppointmentSheet(payload: AppointmentSheetUpdate) {
  const { data, error } = await supabase.functions.invoke('update-appointment-sheet', {
    body: payload,
  })

  if (error) {
    const context = 'context' in error ? error.context : null
    if (context instanceof Response) {
      try {
        const body = await context.clone().json()
        if (body?.error) throw new Error(body.error)
      } catch (bodyError) {
        if (bodyError instanceof Error && bodyError.message) throw bodyError
      }
    }
    throw new Error(error.message || 'Could not update appointment sheet')
  }
  if (data?.error) throw new Error(data.error)

  return data as { message: string; storeCode: string; sheetTitle: string; updatedRange?: string }
}
