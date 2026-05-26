import { supabase } from './supabase'

export type PerformanceSheetUpdate = {
  storeCode: string
  traffic: number
  accessoryRevenue: number
  vl: number
  bts: number
  hsi: number
}

export async function updatePerformanceSheet(payload: PerformanceSheetUpdate & {
  accessId: string
  accessRole: string
}) {
  const { data, error } = await supabase.functions.invoke('update-performance-sheet', {
    body: payload,
  })

  if (error) throw new Error(error.message || 'Could not update performance sheet')
  if (data?.error) throw new Error(data.error)

  return data as { message: string; storeCode: string; updatedRange?: string }
}
