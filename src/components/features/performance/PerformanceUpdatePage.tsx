import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select } from '../../ui/Input'
import { fetchPerformanceData, formatMoney, formatNumber, type PerformanceRow } from '../../../lib/performanceSheet'
import { updatePerformanceSheet } from '../../../lib/performanceUpdate'
import { useUiStore } from '../../../store/uiStore'
import { normalizeStoreId } from '../../../lib/storeIds'
import { dealerInfoForRow } from '../../../lib/dealers'
import { useScheduleStore } from '../../../store/scheduleStore'
import { estimateNetRevenue, useEmployeeInsightsStore, type EmployeeSaleCategory } from '../../../store/employeeInsightsStore'

type Draft = {
  traffic: string
  netRevenue: string
  accessoryRevenue: string
  vl: string
  bts: string
  hsi: string
}

type SaleType = 'voice' | 'bts' | 'hsi' | 'other'

type SaleEntry = {
  id: string
  rep: string
  revenue: string
  type: SaleType
  feature: string
  accessory: string
  phones: string
  p360: string
}

type PlanKey =
  | 'experienceBeyond'
  | 'experienceMore'
  | 'betterValue'
  | 'experienceBeyond55'
  | 'experienceMore55'
  | 'fourFor100'
  | 'voiceAal'
  | 'btsLine'
  | 'hsiLine'

type PlanOption = {
  key: PlanKey
  label: string
  value: number
}

type PlanCounts = Record<PlanKey, string>

const PLAN_GROUPS: { label: string; prices: PlanOption[] }[] = [
  {
    label: 'Premium Plans',
    prices: [
      { key: 'experienceBeyond', label: 'Experience Beyond', value: 180 },
      { key: 'experienceMore', label: 'Experience More', value: 150 },
      { key: 'betterValue', label: 'Better Value', value: 155 },
    ],
  },
  {
    label: 'Value / 55+ Plans',
    prices: [
      { key: 'experienceBeyond55', label: 'Experience Beyond 55+', value: 130 },
      { key: 'experienceMore55', label: 'Experience More 55+', value: 100 },
      { key: 'fourFor100', label: '4 x $100', value: 120 },
    ],
  },
  {
    label: 'Add-a-line / Other',
    prices: [
      { key: 'voiceAal', label: 'Voice / AAL', value: 65 },
      { key: 'btsLine', label: 'BTS', value: 20 },
      { key: 'hsiLine', label: 'HSI', value: 15 },
    ],
  },
]

const EMPTY_PLAN_COUNTS = PLAN_GROUPS
  .flatMap((group) => group.prices)
  .reduce((acc, plan) => ({ ...acc, [plan.key]: '' }), {} as PlanCounts)

const newSaleEntry = (): SaleEntry => ({
  id: crypto.randomUUID(),
  rep: '',
  revenue: '',
  type: 'voice',
  feature: '',
  accessory: '',
  phones: '',
  p360: '',
})

function emptyDraft(): Draft {
  return {
    traffic: '',
    netRevenue: '',
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

function safeDraftNumber(value: string) {
  const parsed = parseDraftNumber(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function metricInputValue(value: string) {
  return value.replace(/[^\d.]/g, '')
}

function sumPlanRevenue(counts: PlanCounts) {
  return PLAN_GROUPS.flatMap((group) => group.prices).reduce((sum, plan) => (
    sum + safeDraftNumber(counts[plan.key]) * plan.value
  ), 0)
}

function sumSalesRevenue(entries: SaleEntry[]) {
  return entries.reduce((sum, entry) => sum + safeDraftNumber(entry.revenue) + safeDraftNumber(entry.feature), 0)
}

function sumAccessories(entries: SaleEntry[]) {
  return entries.reduce((sum, entry) => sum + safeDraftNumber(entry.accessory), 0)
}

function countType(entries: SaleEntry[], type: SaleType) {
  return entries.filter((entry) => entry.type === type).length
}

function saleCategoryForType(type: SaleType): EmployeeSaleCategory {
  if (type === 'voice') return 'voice'
  if (type === 'bts') return 'bts'
  if (type === 'hsi') return 'hsi'
  return 'other'
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
  const employees = useScheduleStore((state) => state.employees)
  const addEmployeeSale = useEmployeeInsightsStore((state) => state.addSale)
  const [rows, setRows] = useState<PerformanceRow[]>([])
  const [selectedStoreCode, setSelectedStoreCode] = useState(normalizeStoreId(storeId) === 'main' ? '' : normalizeStoreId(storeId))
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [planCounts, setPlanCounts] = useState<PlanCounts>(EMPTY_PLAN_COUNTS)
  const [sales, setSales] = useState<SaleEntry[]>([])

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

  const calculatorTotals = useMemo(() => {
    const planRevenue = sumPlanRevenue(planCounts)
    const salesRevenue = sumSalesRevenue(sales)
    const accessoryRevenue = sumAccessories(sales)
    return {
      planRevenue,
      salesRevenue,
      netRevenue: planRevenue + salesRevenue,
      accessoryRevenue,
      vl: countType(sales, 'voice'),
      bts: countType(sales, 'bts'),
      hsi: countType(sales, 'hsi'),
    }
  }, [planCounts, sales])

  const nextTotals = selectedRow ? {
    netRevenue: selectedRow.netRevenue + Math.round(calculatorTotals.netRevenue),
    accessoryRevenue: selectedRow.accessoryRevenue + Math.round(calculatorTotals.accessoryRevenue),
    vl: selectedRow.vl + calculatorTotals.vl,
    bts: selectedRow.bts + calculatorTotals.bts,
    hsi: selectedRow.hsi + calculatorTotals.hsi,
  } : null

  const hasCalculatorValues = calculatorTotals.netRevenue > 0
    || calculatorTotals.accessoryRevenue > 0
    || calculatorTotals.vl > 0
    || calculatorTotals.bts > 0
    || calculatorTotals.hsi > 0

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

  const updateSale = (id: string, patch: Partial<SaleEntry>) => {
    setSales((entries) => entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry))
  }

  const removeSale = (id: string) => {
    setSales((entries) => entries.filter((entry) => entry.id !== id))
  }

  const applyCalculatorTotals = async () => {
    if (!canUpdate) {
      setError('Performance updates are available to manager sessions and up.')
      return
    }
    if (!selectedRow) {
      setError('Select a store before applying calculator totals.')
      return
    }
    if (!hasCalculatorValues) {
      setError('Enter calculator values before applying totals.')
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
        traffic: selectedRow.traffic,
        netRevenue: nextTotals?.netRevenue ?? selectedRow.netRevenue,
        accessoryRevenue: nextTotals?.accessoryRevenue ?? selectedRow.accessoryRevenue,
        vl: nextTotals?.vl ?? selectedRow.vl,
        bts: nextTotals?.bts ?? selectedRow.bts,
        hsi: nextTotals?.hsi ?? selectedRow.hsi,
      })
      const selectedStoreId = normalizeStoreId(selectedRow.storeCode)
      const storeEmployees = employees.filter((employee) => normalizeStoreId(employee.storeId ?? selectedStoreId) === selectedStoreId)
      const employeeByName = new Map(storeEmployees.map((employee) => [employee.name.trim().toLowerCase(), employee]))
      await Promise.all(sales.map(async (entry) => {
        const employee = employeeByName.get(entry.rep.trim().toLowerCase())
        if (!employee) return
        const grossRevenue = safeDraftNumber(entry.revenue) + safeDraftNumber(entry.feature)
        const accessoryRevenue = safeDraftNumber(entry.accessory)
        const protectionCount = Math.round(safeDraftNumber(entry.p360))
        const estimatedNetRevenue = estimateNetRevenue({
          grossRevenue,
          accessoryRevenue,
          protectionCount,
        })
        if (estimatedNetRevenue <= 0) return
        await addEmployeeSale({
          employeeId: employee.id,
          storeId: selectedStoreId,
          saleDate: new Date().toISOString().slice(0, 10),
          category: saleCategoryForType(entry.type),
          grossRevenue,
          accessoryRevenue,
          protectionCount,
          estimatedNetRevenue,
          note: [
            'Performance Update',
            entry.phones ? `${entry.phones} phones` : '',
            entry.p360 ? `${entry.p360} P360` : '',
          ].filter(Boolean).join(' · '),
        })
      }))
      setMessage(result.message || `Added calculator totals to ${selectedRow.storeCode}`)
      setPlanCounts(EMPTY_PLAN_COUNTS)
      setSales([])
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Google Cloud Services')
    } finally {
      setSaving(false)
    }
  }

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
      <div className="flex h-full items-center justify-center p-4">
        <Card className="max-w-md text-sm text-[var(--text-secondary)]">
          Performance updates are available to manager sessions and up.
        </Card>
      </div>
    )
  }

  const selectedDealer = selectedRow ? dealerInfoForRow(selectedRow) : null

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
              Add sales activity or make a controlled tracker adjustment for the selected store.
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <Card noPadding className="overflow-hidden">
            <div className="border-b border-[var(--border)] p-3">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stores" />
              </div>
            </div>
            <div className="max-h-[calc(100vh-15rem)] overflow-y-auto">
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
                  icon={<CalculatorIcon />}
                  title="Add Sales Activity"
                  detail="Enter quantities or sale rows, review the preview, then post the totals."
                />
                <Button
                  size="sm"
                  variant="accent"
                  icon={<CheckCircle2 size={13} />}
                  loading={saving}
                  disabled={!selectedRow || !hasCalculatorValues}
                  onClick={applyCalculatorTotals}
                >
                  Post Totals
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <MetricTile label="Plan Revenue" value={calculatorTotals.planRevenue} money />
                <MetricTile label="Sale Revenue" value={calculatorTotals.salesRevenue} money />
                <MetricTile label="NR Add" value={calculatorTotals.netRevenue} money helper={nextTotals ? `New ${formatMoney(nextTotals.netRevenue)}` : undefined} />
                <MetricTile label="ACC Add" value={calculatorTotals.accessoryRevenue} money helper={nextTotals ? `New ${formatMoney(nextTotals.accessoryRevenue)}` : undefined} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
                {PLAN_GROUPS.map((group) => (
                  <div key={group.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <div className="mb-3 text-xs font-semibold text-[var(--text)]">{group.label}</div>
                    <div className="space-y-2">
                      {group.prices.map((plan) => (
                        <Input
                          key={plan.key}
                          label={`${plan.label} (${formatMoney(plan.value)})`}
                          inputMode="decimal"
                          value={planCounts[plan.key]}
                          onChange={(event) => setPlanCounts((counts) => ({ ...counts, [plan.key]: metricInputValue(event.target.value) }))}
                          placeholder="0"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
                <div className="flex flex-col gap-2 border-b border-[var(--border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">Sale Detail Rows</div>
                    <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
                      {sales.length ? `${sales.length} row${sales.length === 1 ? '' : 's'} included in preview` : 'Optional detail for rep-level sales and accessories.'}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setSales((entries) => [...entries, newSaleEntry()])}>
                    Add Row
                  </Button>
                </div>

                <div className="space-y-2 p-3">
                  {sales.length === 0 && (
                    <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--text-tertiary)]">
                      No sale rows added.
                    </div>
                  )}
                  {sales.map((entry, index) => (
                    <div key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">Sale {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeSale(entry.id)}
                          className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Remove sale"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <Input label="Rep" value={entry.rep} onChange={(event) => updateSale(entry.id, { rep: event.target.value })} />
                        <Input label="Sale Revenue" inputMode="decimal" value={entry.revenue} onChange={(event) => updateSale(entry.id, { revenue: metricInputValue(event.target.value) })} />
                        <Select label="Type" value={entry.type} onChange={(event) => updateSale(entry.id, { type: event.target.value as SaleType })}>
                          <option value="voice">Voice / AAL</option>
                          <option value="bts">BTS</option>
                          <option value="hsi">HSI</option>
                          <option value="other">Other</option>
                        </Select>
                        <Input label="Feature $" inputMode="decimal" value={entry.feature} onChange={(event) => updateSale(entry.id, { feature: metricInputValue(event.target.value) })} />
                        <Input label="ACC $" inputMode="decimal" value={entry.accessory} onChange={(event) => updateSale(entry.id, { accessory: metricInputValue(event.target.value) })} />
                        <Input label="# Phones" inputMode="decimal" value={entry.phones} onChange={(event) => updateSale(entry.id, { phones: metricInputValue(event.target.value) })} />
                        <Input label="# P360" inputMode="decimal" value={entry.p360} onChange={(event) => updateSale(entry.id, { p360: metricInputValue(event.target.value) })} />
                      </div>
                    </div>
                  ))}
                </div>
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
              <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-green-500/25 bg-green-500/10 text-green-300'}`}>
                {error ? (
                  <p className="flex items-center gap-1.5">
                    <AlertCircle size={13} />
                    {error}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    {message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CalculatorIcon() {
  return (
    <span className="relative flex h-4 w-4 items-center justify-center">
      <Calculator size={16} />
      <DollarSign size={8} className="absolute -right-1 -top-1 rounded-full bg-[var(--surface)] text-[var(--accent)]" />
    </span>
  )
}
