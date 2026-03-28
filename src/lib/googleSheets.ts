import Papa from 'papaparse'

const SHEET_ID = '1nj6k7ouNzxImks-9CEuYvkSkFQfgOeR43Py2c2XH2eU'
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`

export interface SheetRow {
  [key: string]: string
}

export interface SheetData {
  headers: string[]
  rows: SheetRow[]
  rawHeaders: string[]
}

export async function fetchSheetData(): Promise<SheetData> {
  const res = await fetch(SHEET_CSV_URL)
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.statusText}`)
  const text = await res.text()

  return new Promise((resolve, reject) => {
    Papa.parse<SheetRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      complete: (results) => {
        const rawHeaders = results.meta.fields ?? []
        const headers = rawHeaders.filter(h => h.length > 0)
        const rows = results.data.filter((row) =>
          headers.some((h) => row[h]?.trim())
        )
        resolve({ headers, rawHeaders, rows })
      },
      error: reject,
    })
  })
}

export function searchRows(rows: SheetRow[], query: string, headers: string[]): SheetRow[] {
  if (!query.trim()) return rows
  const q = query.toLowerCase()
  return rows.filter((row) =>
    headers.some((h) => row[h]?.toLowerCase().includes(q))
  )
}

export function sortRows(rows: SheetRow[], column: string, direction: 'asc' | 'desc'): SheetRow[] {
  return [...rows].sort((a, b) => {
    const av = a[column] ?? ''
    const bv = b[column] ?? ''
    const an = parseFloat(av)
    const bn = parseFloat(bv)
    const numericSort = !isNaN(an) && !isNaN(bn)
    const cmp = numericSort ? an - bn : av.localeCompare(bv)
    return direction === 'asc' ? cmp : -cmp
  })
}
