import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  UploadCloud,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select } from '../../ui/Input'
import { EmptyState, InlineNotice, ModuleHeader, WorkflowSteps } from '../../ui/ModulePrimitives'
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

function emptyDraft(): Draft {
  return {
    traffic: '',
    accessoryRevenue: '',
    vl: '',
    bts: '',
    hsi: '',
  }
}

function parseDraftNumber(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : NaN
}

function parseOptionalDraftNumber(value: string) {
  return value.trim() ? parseDraftNumber(value) : undefined
}

function metricInputValue(value: string) {
  return value.replace(/[^\d.]/g, '')
}

function MetricTile({
  label,
  value,
  helper,
  money = false,
}: {
  label: string
  value: number
  helper?: string
  money?: boolean
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--text)]">
        {money ? formatMoney(value) : formatNumber(value)}
      </div>
      {helper && <div className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">{helper}</div>}
    </div>
  )
}

function SectionTitle({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
        <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">{detail}</div>
      </div>
    </div>
  )
}

export function PerformanceUpdatePage() {
  const { accessId, accessRole, storeId } = useUiStore()
  const [rows, setRows] = useState<PerformanceRow[]>([])
  const [selectedStoreCode, setSelectedStoreCode] = useState(normalizeStoreId(storeId) === 'main' ? '' : normalizeStoreId(storeId))
  const [draft, setDraft] = useState<Draft>(emptyDraft())
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
      setDraft(emptyDraft())
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
    setDraft(emptyDraft())
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
      traffic: parseOptionalDraftNumber(draft.traffic),
      accessoryRevenue: parseOptionalDraftNumber(draft.accessoryRevenue),
      vl: parseOptionalDraftNumber(draft.vl),
      bts: parseOptionalDraftNumber(draft.bts),
      hsi: parseOptionalDraftNumber(draft.hsi),
    }
    if (Object.values(values).every((value) => value === undefined)) {
      setError('Enter at least one tracker value before saving.')
      return
    }
    if (Object.values(values).some((value) => value !== undefined && Number.isNaN(value))) {
      setError('Entered update values must be valid numbers.')
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
        updates: Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)),
      })
      setMessage(result.message || `Updated ${selectedRow.storeCode}`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Google Cloud Services')
    } finally {
      setSaving(false)
    }
  }

  if (!canUpdate) {
    return (
      <div className="performance-suite performance-update-page flex h-full flex-col">
        <ModuleHeader
          icon={<UploadCloud size={18} />}
          eyebrow="Controlled tracker entry"
          title="Data Updates"
          description="Manually post verified tracker values to the Google Sheet."
        />
        <div className="performance-content flex flex-1 items-center justify-center p-4">
          <EmptyState
            className="w-full max-w-lg"
            icon={<UploadCloud size={22} />}
            title="Manager access required"
            description="Performance updates are available to manager, district manager, and administrator sessions."
          />
        </div>
      </div>
    )
  }

  const selectedDealer = selectedRow ? dealerInfoForRow(selectedRow) : null

  return (
    <div className="performance-suite performance-update-page flex h-full flex-col overflow-hidden">
      <ModuleHeader
        icon={<UploadCloud size={18} />}
        eyebrow="Controlled tracker entry"
        title="Data Updates"
        description="Update Traffic, Accessories, VL, BTS, and HSI directly in the connected Google Sheet."
        actions={
          <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
        }
      />
      <WorkflowSteps steps={['Select store', 'Enter values', 'Review and post']} current={message ? 2 : selectedRow ? 1 : 0} />

      <div className="performance-content flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <Card noPadding className="overflow-hidden">
            <div className="border-b border-[var(--border)] p-3">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stores" />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto xl:max-h-[calc(100vh-15rem)]">
              {visibleRows.map((row) => {
                const dealer = dealerInfoForRow(row)
                const selected = normalizeStoreId(row.storeCode) === normalizeStoreId(selectedStoreCode)
                return (
                  <button
                    key={row.store}
                    type="button"
                    onClick={() => setSelectedStoreCode(normalizeStoreId(row.storeCode))}
                    className={`block w-full border-b border-[var(--border)] px-3 py-3 text-left transition-colors ${
                      selected ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--reveal-bg)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--text)]">{dealer.nickname}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{dealer.code}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">{dealer.location}</div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-[var(--text-secondary)]">
                      <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 tabular-nums">{formatMoney(row.netRevenue)}</span>
                      <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 tabular-nums">VL {formatNumber(row.vl)}</span>
                      <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 tabular-nums">BTS {formatNumber(row.bts)}</span>
                    </div>
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <SectionTitle
                  icon={<Store size={16} />}
                  title={selectedDealer ? selectedDealer.nickname : 'No store selected'}
                  detail={selectedRow ? `${selectedRow.storeCode} - ${selectedDealer?.location || selectedRow.teamName || 'Store tracker'}` : 'Choose a store to begin'}
                />
                {canChooseStore && (
                  <Select
                    label="Store"
                    value={selectedStoreCode}
                    onChange={(event) => setSelectedStoreCode(normalizeStoreId(event.target.value))}
                    className="lg:w-64"
                  >
                    {rows.map((row) => (
                      <option key={row.store} value={normalizeStoreId(row.storeCode)}>
                        {row.teamName || row.store} ({row.storeCode})
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                <MetricTile label="Traffic" value={selectedRow?.traffic ?? 0} />
                <MetricTile label="Net Revenue" value={selectedRow?.netRevenue ?? 0} money helper={selectedRow ? `${formatMoney(Math.max(selectedRow.netRevenueGoal - selectedRow.netRevenue, 0))} left` : 'No store'} />
                <MetricTile label="Accessories" value={selectedRow?.accessoryRevenue ?? 0} money helper={selectedRow ? `${formatMoney(Math.max(selectedRow.accessoryGoal - selectedRow.accessoryRevenue, 0))} left` : 'No store'} />
                <MetricTile label="Total PP" value={selectedRow?.totalPp ?? 0} helper={selectedRow ? `${formatNumber(Math.max(selectedRow.dortGoal - selectedRow.totalPp, 0))} left` : 'No store'} />
                <MetricTile label="BTS" value={selectedRow?.bts ?? 0} />
                <MetricTile label="HSI" value={selectedRow?.hsi ?? 0} />
              </div>
            </Card>

            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <SectionTitle
                  icon={<SlidersHorizontal size={16} />}
                  title="Manual Tracker Adjustment"
                  detail="Use this when you need to overwrite the current tracker values directly."
                />
                <Button icon={<UploadCloud size={13} />} loading={saving} onClick={save} disabled={!selectedRow}>
                  Save Adjustment
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div>
                  <Input label="Traffic" inputMode="decimal" value={draft.traffic} onChange={(e) => setDraft((d) => ({ ...d, traffic: metricInputValue(e.target.value) }))} />
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Current {formatNumber(selectedRow?.traffic ?? 0)}</p>
                </div>
                <div>
                  <Input label="Accessories" inputMode="decimal" value={draft.accessoryRevenue} onChange={(e) => setDraft((d) => ({ ...d, accessoryRevenue: metricInputValue(e.target.value) }))} />
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Current {formatMoney(selectedRow?.accessoryRevenue ?? 0)}</p>
                </div>
                <div>
                  <Input label="VL" inputMode="decimal" value={draft.vl} onChange={(e) => setDraft((d) => ({ ...d, vl: metricInputValue(e.target.value) }))} />
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Current {formatNumber(selectedRow?.vl ?? 0)}</p>
                </div>
                <div>
                  <Input label="BTS" inputMode="decimal" value={draft.bts} onChange={(e) => setDraft((d) => ({ ...d, bts: metricInputValue(e.target.value) }))} />
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Current {formatNumber(selectedRow?.bts ?? 0)}</p>
                </div>
                <div>
                  <Input label="HSI" inputMode="decimal" value={draft.hsi} onChange={(e) => setDraft((d) => ({ ...d, hsi: metricInputValue(e.target.value) }))} />
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Current {formatNumber(selectedRow?.hsi ?? 0)}</p>
                </div>
              </div>
            </Card>

            {(error || message) && (
              <InlineNotice tone={error ? 'danger' : 'success'} title={error ? 'Update could not be posted' : 'Update posted'}>
                {error || message}
              </InlineNotice>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
