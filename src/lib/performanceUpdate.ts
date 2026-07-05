import { supabase } from './supabase'

export type PerformanceSheetUpdate = {
  storeCode: string
  traffic?: number
  netRevenue?: number
  accessoryRevenue?: number
  vl?: number
  bts?: number
  hsi?: number
  updates?: Partial<Record<'traffic' | 'netRevenue' | 'accessoryRevenue' | 'vl' | 'bts' | 'hsi', number>>
}

export async function updatePerformanceSheet(payload: PerformanceSheetUpdate & {
  accessId: string
  accessRole: string
}) {
  const { data, error } = await supabase.functions.invoke('update-performance-sheet', {
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
    throw new Error(error.message || 'Could not update performance sheet')
  }
  if (data?.error) throw new Error(data.error)

  return data as { message: string; storeCode: string; updatedRange?: string }
}
