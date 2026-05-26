import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, RefreshCw, Search, UploadCloud } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select } from '../../ui/Input'
import { fetchPerformanceData, formatMoney, formatNumber, type PerformanceRow } from '../../../lib/performanceSheet'
import { updatePerformanceSheet } from '../../../lib/performanceUpdate'
import { useUiStore } from '../../../store/uiStore'
import { normalizeStoreId } from '../../../lib/storeIds'
import { dealerInfoForRow } from '../../../lib/dealers'

type Draft = {
  traffic: string
  accessoryRevenue: string
  vl: string
  bts: string
  hsi: string
}

function toDraft(row: PerformanceRow | null): Draft {
  return {
    traffic: row ? String(row.traffic) : '',
    accessoryRevenue: row ? String(row.accessoryRevenue) : '',
    vl: row ? String(row.vl) : '',
    bts: row ? String(row.bts) : '',
    hsi: row ? String(row.hsi) : '',
  }
}

function parseDraftNumber(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : NaN
}

function metricInputValue(value: string) {
  return value.replace(/[^\d.]/g, '')
}

export function PerformanceUpdatePage() {
  const { accessId, accessRole, storeId } = useUiStore()
  const [rows, setRows] = useState<PerformanceRow[]>([])
  const [selectedStoreCode, setSelectedStoreCode] = useState(normalizeStoreId(storeId) === 'main' ? '' : normalizeStoreId(storeId))
  const [draft, setDraft] = useState<Draft>(toDraft(null))
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canChooseStore = accessRole === 'admin' || accessRole === 'district_manager'
  const canUpdate = accessRole === 'admin' || accessRole === 'district_manager' || accessRole === 'manager'

  const selectedRow = useMemo(() => {
    return rows.find((row) => normalizeStoreId(row.storeCode) === normalizeStoreId(selectedStoreCode)) ?? null
  }, [rows, selectedStoreCode])

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scoped = canChooseStore
      ? rows
      : rows.filter((row) => normalizeStoreId(row.storeCode) === normalizeStoreId(storeId))

    return scoped.filter((row) => {
      const dealer = dealerInfoForRow(row)
      return !q
        || row.storeCode.toLowerCase().includes(q)
        || row.teamName.toLowerCase().includes(q)
        || dealer.nickname.toLowerCase().includes(q)
        || dealer.location.toLowerCase().includes(q)
    })
  }, [canChooseStore, query, rows, storeId])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPerformanceData()
      setRows(data.rows)
      const currentStore = normalizeStoreId(selectedStoreCode || storeId)
      const fallback = normalizeStoreId(storeId) === 'main' ? data.rows[0]?.storeCode ?? '' : storeId
      const nextStore = data.rows.some((row) => normalizeStoreId(row.storeCode) === currentStore)
        ? currentStore
        : normalizeStoreId(fallback)
      setSelectedStoreCode(nextStore)
      setDraft(toDraft(data.rows.find((row) => normalizeStoreId(row.storeCode) === nextStore) ?? null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load performance data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Load the sheet once on page entry; manual refresh handles later reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setDraft(toDraft(selectedRow))
    setMessage('')
  }, [selectedRow])

  const save = async () => {
    if (!canUpdate) {
      setError('Performance updates are available to manager sessions and up.')
      return
    }
    if (!selectedRow) {
      setError('Select a store before saving.')
      return
    }

    const values = {
      traffic: parseDraftNumber(draft.traffic),
      accessoryRevenue: parseDraftNumber(draft.accessoryRevenue),
      vl: parseDraftNumber(draft.vl),
      bts: parseDraftNumber(draft.bts),
      hsi: parseDraftNumber(draft.hsi),
    }
    if (Object.values(values).some((value) => Number.isNaN(value))) {
      setError('All update values must be valid numbers.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await updatePerformanceSheet({
        accessId,
        accessRole: accessRole ?? '',
        storeCode: selectedRow.storeCode,
        ...values,
      })
      setMessage(result.message || `Updated ${selectedRow.storeCode}`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the Google Sheet')
    } finally {
      setSaving(false)
    }
  }

  if (!canUpdate) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="max-w-md text-sm text-[var(--text-secondary)]">
          Performance updates are available to manager sessions and up.
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text)]">
              <UploadCloud size={18} className="text-[var(--accent)]" />
              Performance Update
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Update Traffic, Accessories, VL, BTS, and HSI for the selected store.
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card noPadding className="overflow-hidden">
            <div className="border-b border-[var(--border)] p-3">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stores" />
              </div>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {visibleRows.map((row) => {
                const dealer = dealerInfoForRow(row)
                const selected = normalizeStoreId(row.storeCode) === normalizeStoreId(selectedStoreCode)
                return (
                  <button
                    key={row.store}
                    type="button"
                    onClick={() => setSelectedStoreCode(normalizeStoreId(row.storeCode))}
                    className={`block w-full border-b border-[var(--border)] px-3 py-2.5 text-left transition-colors ${
                      selected ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--reveal-bg)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--text)]">{dealer.nickname}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{dealer.code}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">{dealer.location}</div>
                  </button>
                )
              })}
              {visibleRows.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
                  {loading ? 'Loading stores...' : 'No stores found.'}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">Selected Store</div>
                  <div className="mt-1 text-lg font-semibold text-[var(--text)]">
                    {selectedRow ? dealerInfoForRow(selectedRow).nickname : 'No store selected'}
                  </div>
                  {selectedRow && (
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      {selectedRow.storeCode} · Current ACC {formatMoney(selectedRow.accessoryRevenue)} · Traffic {formatNumber(selectedRow.traffic)}
                    </div>
                  )}
                </div>
                {canChooseStore && (
                  <Select
                    label="Store"
                    value={selectedStoreCode}
                    onChange={(event) => setSelectedStoreCode(normalizeStoreId(event.target.value))}
                    className="sm:w-56"
                  >
                    {rows.map((row) => (
                      <option key={row.store} value={normalizeStoreId(row.storeCode)}>
                        {row.teamName || row.store} ({row.storeCode})
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </Card>

            <Card>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Input label="Traffic" inputMode="decimal" value={draft.traffic} onChange={(e) => setDraft((d) => ({ ...d, traffic: metricInputValue(e.target.value) }))} />
                <Input label="Accessories" inputMode="decimal" value={draft.accessoryRevenue} onChange={(e) => setDraft((d) => ({ ...d, accessoryRevenue: metricInputValue(e.target.value) }))} />
                <Input label="VL" inputMode="decimal" value={draft.vl} onChange={(e) => setDraft((d) => ({ ...d, vl: metricInputValue(e.target.value) }))} />
                <Input label="BTS" inputMode="decimal" value={draft.bts} onChange={(e) => setDraft((d) => ({ ...d, bts: metricInputValue(e.target.value) }))} />
                <Input label="HSI" inputMode="decimal" value={draft.hsi} onChange={(e) => setDraft((d) => ({ ...d, hsi: metricInputValue(e.target.value) }))} />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5">
                  {error && (
                    <p className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle size={13} />
                      {error}
                    </p>
                  )}
                  {message && (
                    <p className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 size={13} />
                      {message}
                    </p>
                  )}
                </div>
                <Button icon={<UploadCloud size={13} />} loading={saving} onClick={save} disabled={!selectedRow}>
                  Update Google Sheet
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
