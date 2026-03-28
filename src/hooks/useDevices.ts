import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { fetchSheetData, searchRows, sortRows } from '../lib/googleSheets'

export type SortDir = 'asc' | 'desc'

export function useDevices() {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

  const query = useQuery({
    queryKey: ['devices'],
    queryFn: fetchSheetData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })

  const filtered = useMemo(() => {
    if (!query.data) return []
    let rows = query.data.rows
    rows = searchRows(rows, search, query.data.headers)
    // Apply column filters
    Object.entries(columnFilters).forEach(([col, val]) => {
      if (val) rows = rows.filter((r) => r[col]?.toLowerCase().includes(val.toLowerCase()))
    })
    if (sortCol) rows = sortRows(rows, sortCol, sortDir)
    return rows
  }, [query.data, search, sortCol, sortDir, columnFilters])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated  = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
    setPage(0)
  }

  const setColumnFilter = (col: string, val: string) => {
    setColumnFilters((f) => ({ ...f, [col]: val }))
    setPage(0)
  }

  return {
    ...query,
    headers:     query.data?.headers ?? [],
    rows:        paginated,
    allRows:     filtered,          // full filtered set — for hierarchy
    totalRows:   filtered.length,
    search, setSearch: (v: string) => { setSearch(v); setPage(0) },
    sortCol, sortDir, toggleSort,
    page, setPage,
    pageSize, setPageSize: (v: number) => { setPageSize(v); setPage(0) },
    totalPages,
    columnFilters, setColumnFilter,
  }
}
