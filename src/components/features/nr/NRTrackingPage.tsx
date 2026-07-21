import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { BarChart3, CalendarDays, Edit3, FilePlus2, LayoutDashboard, Plus, RefreshCw, Trash2, UploadCloud, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select, Textarea } from '../../ui/Input'
import { EmptyState, InlineNotice, ModuleHeader, PageFrame, WorkflowSteps } from '../../ui/ModulePrimitives'
import { formatMoney, formatNumber } from '../../../lib/performanceSheet'
import { calculateAddALinesByQuantity, calculateNetRevenue, getVoicePlanMrc } from '../../../lib/voicePlanCalculations'
import { calculateNRSummary, normalizeNRTrackingEntry, type NRTrackingEntry, type NRTrackingSource } from '../../../lib/nrTracking'
import { getAvailablePlans, getSupportedLineCounts, getVoicePlanById, VOICE_PLANS, VOICE_PLAN_CATEGORIES, VOICE_PLAN_CATEGORY_LABELS, type VoicePlanCategory } from '../../../lib/voicePlans'
import { dbDeleteNRSale, dbGetNRTrackingEntries, dbInsertNRTrackingEntry, dbMarkNRSaleDashboardPushed, dbMarkNRSaleSourcePushed, dbUpdateNRTrackingEntry } from '../../../lib/supabase'
import { normalizeStoreId } from '../../../lib/storeIds'
import { useNRTrackingDraftStore } from '../../../store/nrTrackingDraftStore'
import { useScheduleStore } from '../../../store/scheduleStore'
import { useUiStore } from '../../../store/uiStore'
import { fetchPerformanceData } from '../../../lib/performanceSheet'
import { updatePerformanceSheet } from '../../../lib/performanceUpdate'
import { calculateRecurringProductResult, getRecurringProductPlan, getRecurringProductPlans, PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, RECURRING_PRODUCT_PLANS, type ProductCategory } from '../../../lib/recurringProducts'

type Period = 'today' | 'week' | 'month' | 'custom'

type EntryDraft = {
  id: string
  saleId: string
  createdAt: string
  source: NRTrackingSource
  saleDate: string
  category: VoicePlanCategory
  planId: string
  lineCount: string
  mrc: string
  employeeId: string
  notes: string
  saleType: 'new-account' | 'add-a-line' | 'product'
  accessoryRevenue: string
  productCategory: ProductCategory
}

const today = () => format(new Date(), 'yyyy-MM-dd')

function blankDraft(source: NRTrackingSource = 'manual'): EntryDraft {
  const saleId = crypto.randomUUID()
  return { id: crypto.randomUUID(), saleId, createdAt: new Date().toISOString(), source, saleDate: today(), category: 'consumer', planId: '', lineCount: '', mrc: '', employeeId: '', notes: '', saleType: 'new-account', accessoryRevenue: '', productCategory: 'voice' }
}

export function NRTrackingPage() {
  const { accessId, accessLabel, accessRole, dealerCode, storeId } = useUiStore()
  const queryClient = useQueryClient()
  const employees = useScheduleStore((state) => state.employees)
  const pending = useNRTrackingDraftStore((state) => state.pending)
  const clearPending = useNRTrackingDraftStore((state) => state.clearPending)
  const [entries, setEntries] = useState<NRTrackingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushingId, setPushingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<EntryDraft | null>(() => blankDraft())
  const [saleItems, setSaleItems] = useState<NRTrackingEntry[]>([])
  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState(today())
  const [customEnd, setCustomEnd] = useState(today())
  const [planFilter, setPlanFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | VoicePlanCategory>('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const canManage = accessRole === 'admin' || accessRole === 'district_manager' || accessRole === 'manager'
  const storeEmployees = employees.filter((employee) => normalizeStoreId(employee.storeId ?? storeId) === normalizeStoreId(storeId))

  const loadEntries = async () => {
    setLoading(true)
    setError('')
    try {
      setEntries(await dbGetNRTrackingEntries(storeId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load NR tracking')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEntries()
    // Reload when the active store changes; refresh handles subsequent requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  useEffect(() => {
    if (!pending) return
    setDraft({
      id: pending.submissionId,
      saleId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      source: 'voice-plan-calculator',
      saleDate: today(),
      category: pending.category,
      planId: pending.planId,
      lineCount: String(pending.accountLineCountAfter),
      mrc: String(pending.mrc),
      employeeId: '',
      notes: '',
      saleType: pending.saleType,
      accessoryRevenue: '',
      productCategory: pending.productCategory,
    })
    setMessage('Review the sale date and details, then save this calculated sale.')
  }, [pending])

  const dateBounds = useMemo(() => {
    const now = new Date()
    if (period === 'today') return [today(), today()]
    if (period === 'week') return [format(startOfWeek(now), 'yyyy-MM-dd'), format(endOfWeek(now), 'yyyy-MM-dd')]
    if (period === 'month') return [format(startOfMonth(now), 'yyyy-MM-dd'), format(endOfMonth(now), 'yyyy-MM-dd')]
    return [customStart, customEnd]
  }, [customEnd, customStart, period])

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    return entry.saleDate >= dateBounds[0]
      && entry.saleDate <= dateBounds[1]
      && (planFilter === 'all' || entry.planId === planFilter)
      && (categoryFilter === 'all' || entry.category === categoryFilter)
      && (employeeFilter === 'all' || entry.employeeId === employeeFilter)
  }), [categoryFilter, dateBounds, employeeFilter, entries, planFilter])
  const summary = useMemo(() => calculateNRSummary(filteredEntries), [filteredEntries])
  const groupedSales = useMemo(() => {
    const groups = new Map<string, NRTrackingEntry[]>()
    filteredEntries.forEach((entry) => groups.set(entry.saleId, [...(groups.get(entry.saleId) ?? []), entry]))
    return [...groups.values()].sort((left, right) => {
      const dateOrder = right[0].saleDate.localeCompare(left[0].saleDate)
      return dateOrder || right[0].createdAt.localeCompare(left[0].createdAt)
    })
  }, [filteredEntries])

  const availableDraftPlans = draft?.productCategory === 'voice' ? getAvailablePlans(draft.category) : []
  const availableDraftLines = draft?.productCategory === 'voice' && draft.planId ? getSupportedLineCounts(draft.planId) : []
  const selectedDraftPlan = draft?.productCategory === 'voice' && draft.planId ? getVoicePlanById(draft.planId) : null
  const draftNr = draft?.mrc ? calculateNetRevenue(Number(draft.mrc)) : 0

  const changeDraftCategory = (category: VoicePlanCategory) => setDraft((current) => current ? { ...current, category, planId: '', lineCount: '', mrc: '' } : null)
  const changeDraftPlan = (planId: string) => setDraft((current) => current ? { ...current, planId, lineCount: '', mrc: '' } : null)
  const changeDraftSaleType = (saleType: 'new-account' | 'add-a-line') => setDraft((current) => current ? { ...current, saleType, lineCount: '', mrc: '' } : null)
  const changeDraftProductCategory = (productCategory: ProductCategory) => setDraft((current) => current ? { ...current, productCategory, saleType: productCategory === 'voice' ? 'new-account' : 'product', category: 'consumer', planId: '', lineCount: '', mrc: '' } : null)
  const changeDraftLines = (lineCount: string) => setDraft((current) => {
    if (!current) return null
    if (!lineCount) return { ...current, lineCount, mrc: '' }
    const mrc = current.productCategory !== 'voice'
      ? calculateRecurringProductResult(current.planId, Number(lineCount)).mrc
      : current.saleType === 'add-a-line'
      ? calculateAddALinesByQuantity(current.planId, Number(lineCount)).mrc
      : getVoicePlanMrc(current.planId, Number(lineCount))
    return { ...current, lineCount, mrc: String(mrc) }
  })

  const saveDraft = async () => {
    if (!draft || saving) return
    const existingEntry = entries.find((entry) => entry.id === draft.id)
    const selectedPlan = draft.planId ? draft.productCategory === 'voice' ? getVoicePlanById(draft.planId) : getRecurringProductPlan(draft.planId) : null
    if (!selectedPlan || !draft.lineCount || !draft.mrc || !draft.saleDate) {
      setError('Plan, line count, MRC, and sale date are required.')
      return
    }
    const mrc = Number(draft.mrc)
    if (!Number.isFinite(mrc) || mrc < 0) {
      setError('MRC must be a valid non-negative amount.')
      return
    }
    const employee = storeEmployees.find((item) => item.id === draft.employeeId)
    const accountLineCountBefore = 0
    const accountLineCountAfter = Number(draft.lineCount)
    const accountMrcBefore = 0
    const accountMrcAfter = draft.saleType === 'add-a-line' || draft.productCategory !== 'voice' ? mrc : draft.source === 'voice-plan-calculator' ? getVoicePlanMrc(selectedPlan.id, accountLineCountAfter) : mrc
    const normalized = normalizeNRTrackingEntry({
      id: draft.id,
      saleId: draft.saleId,
      createdAt: draft.createdAt,
      saleDate: draft.saleDate,
      employeeId: employee?.id,
      employeeName: employee?.name || (accessRole === 'employee' ? accessLabel : undefined),
      storeId,
      storeName: storeId,
      source: draft.source,
      category: draft.productCategory === 'voice' ? selectedPlan.category as VoicePlanCategory : 'consumer',
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      lineCount: accountLineCountAfter,
      mrc,
      notes: draft.notes.trim() || undefined,
      saleType: draft.saleType,
      accountLineCountBefore,
      accountLineCountAfter,
      accountMrcBefore,
      accountMrcAfter,
      accessoryRevenue: Number(draft.accessoryRevenue || 0),
      productCategory: draft.productCategory,
      dashboardPushedAt: existingEntry?.dashboardPushedAt,
      dashboardPushedBy: existingEntry?.dashboardPushedBy,
      sourcePushedAt: existingEntry?.sourcePushedAt,
      sourcePushedBy: existingEntry?.sourcePushedBy,
    })

    setError('')
    setMessage('')
    const exists = Boolean(existingEntry)
    if (!exists) {
      setSaleItems((items) => [...items, { ...normalized, accessoryRevenue: 0 }])
      setDraft((current) => current ? { ...current, id: crypto.randomUUID(), planId: '', lineCount: '', mrc: '', productCategory: 'voice', saleType: 'new-account', category: 'consumer' } : null)
      setMessage(`${normalized.planName} added to the sale.`)
      return
    }
    setSaving(true)
    try {
      const saved = await dbUpdateNRTrackingEntry(normalized, storeId)
      setEntries((current) => current.map((item) => item.id === saved.id ? saved : item))
      setDraft(null)
      setMessage('Sale item updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save NR entry')
    } finally {
      setSaving(false)
    }
  }

  const completeSale = async () => {
    if (!draft || saleItems.length === 0 || saving) {
      setError('Add at least one item before saving the sale.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const employee = storeEmployees.find((item) => item.id === draft.employeeId)
      const items = saleItems.map((item, index) => normalizeNRTrackingEntry({
        ...item,
        saleDate: draft.saleDate,
        employeeId: employee?.id,
        employeeName: employee?.name || (accessRole === 'employee' ? accessLabel : undefined),
        notes: draft.notes.trim() || undefined,
        accessoryRevenue: index === 0 ? Number(draft.accessoryRevenue || 0) : 0,
      }))
      const saved = await Promise.all(items.map((item) => dbInsertNRTrackingEntry(item, storeId)))
      setEntries((current) => [...saved, ...current])
      setSaleItems([])
      setDraft(null)
      if (pending) clearPending()
      setMessage(`Sale saved with ${saved.length} item${saved.length === 1 ? '' : 's'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save sale')
    } finally {
      setSaving(false)
    }
  }

  const editEntry = (entry: NRTrackingEntry) => {
    setSaleItems([])
    setError('')
    setMessage(`Editing ${entry.planName}. Save the item to update the transaction totals.`)
    setDraft({
      id: entry.id, saleId: entry.saleId, createdAt: entry.createdAt, source: entry.source, saleDate: entry.saleDate,
      category: entry.category, planId: entry.planId, lineCount: String(entry.accountLineCountAfter), mrc: String(entry.mrc),
      employeeId: entry.employeeId ?? '', notes: entry.notes ?? '',
      saleType: entry.saleType, accessoryRevenue: entry.accessoryRevenue ? String(entry.accessoryRevenue) : '', productCategory: entry.productCategory,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteEntry = async (entry: NRTrackingEntry) => {
    if (entry.sourcePushedAt || !window.confirm(`Delete this entire sale from ${entry.saleDate}? This removes every item in the transaction.`)) return
    setError('')
    try {
      await dbDeleteNRSale(entry.saleId)
      setEntries((current) => current.filter((item) => item.saleId !== entry.saleId))
      setMessage('Sale deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete NR entry')
    }
  }

  const replaceEntries = (saved: NRTrackingEntry[]) => setEntries((current) => current.map((item) => saved.find((next) => next.id === item.id) ?? item))

  const pushToDashboard = async (entry: NRTrackingEntry) => {
    if (pushingId) return
    setPushingId(entry.id)
    setError('')
    try {
      const saved = await dbMarkNRSaleDashboardPushed(entry.saleId, accessId || accessLabel || 'dashboard-user')
      replaceEntries(saved)
      await queryClient.invalidateQueries({ queryKey: ['today-performance'] })
      setMessage('Complete sale pushed to LunaDash.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not push sale to dashboard')
    } finally {
      setPushingId('')
    }
  }

  const pushToSource = async (entry: NRTrackingEntry) => {
    if (!canManage || pushingId) return
    setPushingId(entry.id)
    setError('')
    try {
      const sale = entries.filter((item) => item.saleId === entry.saleId)
      const saleSummary = calculateNRSummary(sale)
      const performance = await fetchPerformanceData()
      const targetIds = [entry.storeId, storeId, dealerCode].map((value) => normalizeStoreId(value ?? ''))
      const row = performance.rows.find((item) => targetIds.includes(normalizeStoreId(item.storeCode)))
      if (!row) throw new Error('This store is not mapped to a Google performance row.')
      await updatePerformanceSheet({
        accessId,
        accessRole: accessRole ?? '',
        storeCode: row.storeCode,
        netRevenue: row.netRevenue + saleSummary.totalNR,
        accessoryRevenue: row.accessoryRevenue + saleSummary.totalAccessoryRevenue,
        vl: row.vl + saleSummary.totalVoiceLines,
        bts: row.bts + saleSummary.totalBts,
        hsi: row.hsi + saleSummary.totalHsi,
      })
      const saved = await dbMarkNRSaleSourcePushed(entry.saleId, accessId || accessLabel || 'dashboard-user')
      replaceEntries(saved)
      await queryClient.invalidateQueries({ queryKey: ['today-performance'] })
      setMessage('Complete sale pushed to Google Source and LunaDash.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not push sale to Google Source')
    } finally {
      setPushingId('')
    }
  }

  return (
    <PageFrame width="full">
      <ModuleHeader
        icon={<BarChart3 size={20} />}
        eyebrow="Sales production"
        title="Sales Tracker"
        description="Build complete multi-item transactions, review combined production, then publish the whole sale to LunaDash or Google Source."
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" icon={<RefreshCw size={14} />} loading={loading} onClick={loadEntries}>Refresh</Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setSaleItems([]); setDraft(blankDraft()); setError(''); setMessage('') }}>Start sale</Button>
          </div>
        }
      />

      {(error || message) && <div className="mt-4"><InlineNotice tone={error ? 'danger' : 'success'}>{error || message}</InlineNotice></div>}

      {draft && (
        <Card className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--text)]">{entries.some((entry) => entry.id === draft.id) ? 'Edit sale item' : 'New customer sale'}</h2>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">Build the complete basket before publishing. Current item NR: <span className="font-semibold text-emerald-500">{formatMoney(draftNr)}</span></p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Close entry form" onClick={() => { setDraft(null); if (pending) clearPending() }}><X size={16} /></Button>
          </div>
          {!entries.some((entry) => entry.id === draft.id) && <WorkflowSteps className="mt-4" steps={['Sale details', 'Add items', 'Review & save']} current={saleItems.length > 0 ? 2 : draft.planId ? 1 : 0} />}
          <div className="mt-4 flex items-center gap-2 border-b border-[var(--border)] pb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">1</span>
            <div><div className="text-sm font-semibold text-[var(--text)]">Sale details & next item</div><div className="text-[11px] text-[var(--text-tertiary)]">Choose the product, quantity, employee, and transaction details.</div></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Product family" value={draft.productCategory} onChange={(event) => changeDraftProductCategory(event.target.value as ProductCategory)}>
              {PRODUCT_CATEGORIES.map((item) => <option key={item} value={item}>{PRODUCT_CATEGORY_LABELS[item]}</option>)}
            </Select>
            {draft.productCategory === 'voice' && <>
            <Select label="Sale circumstance" value={draft.saleType} onChange={(event) => changeDraftSaleType(event.target.value as 'new-account' | 'add-a-line')}>
              <option value="new-account">New plan sale</option><option value="add-a-line">Add a line</option>
            </Select>
            <Select label="Customer segment" value={draft.category} onChange={(event) => changeDraftCategory(event.target.value as VoicePlanCategory)}>
              {VOICE_PLAN_CATEGORIES.map((item) => <option key={item} value={item}>{VOICE_PLAN_CATEGORY_LABELS[item]}</option>)}
            </Select>
            <Select label="Voice plan" value={draft.planId} onChange={(event) => changeDraftPlan(event.target.value)}>
              <option value="">Select a plan</option>
              {availableDraftPlans.map((item) => <option key={item.id} value={item.id} disabled={draft.saleType === 'add-a-line' && item.addALineMrc === undefined}>{item.name}{draft.saleType === 'add-a-line' && item.addALineMrc === undefined ? ' · AAL unavailable' : ''}</option>)}
            </Select>
            <Select label={draft.saleType === 'add-a-line' ? 'Number of add-a-lines' : 'Voice lines sold'} value={draft.lineCount} disabled={!draft.planId || (draft.saleType === 'add-a-line' && !selectedDraftPlan?.addALineMrc)} onChange={(event) => changeDraftLines(event.target.value)}>
              <option value="">Select lines</option>
              {(draft.saleType === 'add-a-line' ? [1, 2, 3, 4, 5, 6, 7, 8] : availableDraftLines).map((count) => <option key={count} value={count}>{count}{draft.saleType === 'add-a-line' ? ` × ${formatMoney(selectedDraftPlan?.addALineMrc ?? 0)}` : ` · ${formatMoney(getVoicePlanMrc(draft.planId, count))}`}</option>)}
            </Select>
            <Input label={draft.saleType === 'add-a-line' ? 'Incremental MRC' : 'MRC'} type="number" min="0" step="0.01" value={draft.mrc} disabled={draft.source === 'voice-plan-calculator' || draft.saleType === 'add-a-line'} onChange={(event) => setDraft((current) => current ? { ...current, mrc: event.target.value } : null)} />
            </>}
            {draft.productCategory !== 'voice' && <>
              <Select label={`${PRODUCT_CATEGORY_LABELS[draft.productCategory]} plan`} value={draft.planId} onChange={(event) => changeDraftPlan(event.target.value)}>
                <option value="">Select a plan</option>
                {getRecurringProductPlans(draft.productCategory).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.mrc)}</option>)}
              </Select>
              <Select label="Quantity sold" value={draft.lineCount} disabled={!draft.planId} onChange={(event) => changeDraftLines(event.target.value)}>
                <option value="">Select quantity</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}
              </Select>
              <Input label="MRC" type="number" min="0" step="0.01" value={draft.mrc} disabled onChange={() => undefined} />
            </>}
            <Input label="Accessories" type="number" min="0" step="0.01" value={draft.accessoryRevenue} onChange={(event) => setDraft((current) => current ? { ...current, accessoryRevenue: event.target.value } : null)} />
            <Input label="Sale date" type="date" value={draft.saleDate} onChange={(event) => setDraft((current) => current ? { ...current, saleDate: event.target.value } : null)} />
            <Select label="Employee (optional)" value={draft.employeeId} onChange={(event) => setDraft((current) => current ? { ...current, employeeId: event.target.value } : null)}>
              <option value="">Not assigned</option>
              {storeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </Select>
            <div className="sm:col-span-2"><Textarea label="Notes (optional)" rows={1} value={draft.notes} onChange={(event) => setDraft((current) => current ? { ...current, notes: event.target.value } : null)} /></div>
          </div>
          {saleItems.length > 0 && <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text)]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">2</span>Sale basket ({saleItems.length} {saleItems.length === 1 ? 'item' : 'items'})</div>
            <div className="space-y-2">{saleItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-[var(--surface)] px-3 py-2 text-xs"><span><strong>{item.planName}</strong> · {PRODUCT_CATEGORY_LABELS[item.productCategory]} × {item.lineCount}</span><span className="flex items-center gap-2 tabular-nums">{formatMoney(item.nr)} NR <button type="button" className="text-red-400" onClick={() => setSaleItems((items) => items.filter((row) => row.id !== item.id))}><X size={13} /></button></span></div>)}</div>
            <SaleTotals entries={saleItems} accessoryRevenue={Number(draft.accessoryRevenue || 0)} compact />
          </div>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setDraft(null); setSaleItems([]); if (pending) clearPending() }}>Cancel</Button>
            {entries.some((entry) => entry.id === draft.id) ? <Button variant="primary" loading={saving} onClick={saveDraft}>Save item</Button> : <>
              <Button variant="secondary" icon={<Plus size={13} />} onClick={saveDraft}>Add item to sale</Button>
              <Button variant="primary" loading={saving} disabled={saleItems.length === 0} onClick={completeSale}>Save complete sale</Button>
            </>}
          </div>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <SummaryCard label="Total NR" value={formatMoney(summary.totalNR)} accent />
        <SummaryCard label="Total MRC" value={formatMoney(summary.totalMRC)} />
        <SummaryCard label="Accessories" value={formatMoney(summary.totalAccessoryRevenue)} />
        <SummaryCard label="Sales" value={formatNumber(summary.totalSales)} />
        <SummaryCard label="Voice lines" value={formatNumber(summary.totalVoiceLines)} />
        <SummaryCard label="BTS" value={formatNumber(summary.totalBts)} />
        <SummaryCard label="HSI" value={formatNumber(summary.totalHsi)} />
        <SummaryCard label="Avg NR / sale" value={formatMoney(summary.averageNRPerSale)} />
        <SummaryCard label="Avg NR / line" value={formatMoney(summary.averageNRPerVoiceLine)} />
      </div>

      <Card className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Reporting period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            <option value="today">Today</option><option value="week">Current week</option><option value="month">Current month</option><option value="custom">Custom range</option>
          </Select>
          {period === 'custom' ? <><Input label="Start date" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /><Input label="End date" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></> : <div className="flex items-end text-xs text-[var(--text-tertiary)] sm:col-span-2"><CalendarDays size={14} className="mr-2" />{dateBounds[0]} through {dateBounds[1]}</div>}
          <Select label="Plan" value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}><option value="all">All plans</option>{[...VOICE_PLANS, ...RECURRING_PRODUCT_PLANS].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select label="Segment" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | VoicePlanCategory)}><option value="all">All segments</option>{VOICE_PLAN_CATEGORIES.map((item) => <option key={item} value={item}>{VOICE_PLAN_CATEGORY_LABELS[item]}</option>)}</Select>
          <Select label="Employee" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="all">All employees</option>{storeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {loading ? <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading NR entries…</div> : filteredEntries.length === 0 ? (
          <Card><EmptyState icon={<FilePlus2 size={24} />} title="No sales in this period" description="Use the sale builder above to add a complete multi-item transaction." compact /></Card>
        ) : (
          groupedSales.map((sale) => <SalePreviewCard key={sale[0].saleId} entries={sale} canPushSource={canManage} pushingId={pushingId} onDashboard={pushToDashboard} onSource={pushToSource} onEdit={editEntry} onDelete={deleteEntry} />)
        )}
      </div>
    </PageFrame>
  )
}

function SummaryCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <Card className={accent ? 'border-emerald-500/25 bg-emerald-500/10' : ''}><div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div><div className={`mt-2 text-xl font-bold tabular-nums ${accent ? 'text-emerald-500' : 'text-[var(--text)]'}`}>{value}</div></Card>
}

function SaleTotals({ entries, accessoryRevenue, compact = false }: { entries: NRTrackingEntry[]; accessoryRevenue?: number; compact?: boolean }) {
  const totals = calculateNRSummary(entries)
  const accessories = accessoryRevenue ?? totals.totalAccessoryRevenue
  const saleTotal = totals.totalMRC + accessories
  return <div className={`grid grid-cols-2 gap-2 border-t border-[var(--border)] ${compact ? 'mt-3 pt-3 sm:grid-cols-4' : 'mt-4 pt-4 md:grid-cols-4'}`}>
    <SaleMetric label="Sale total" value={formatMoney(saleTotal)} />
    <SaleMetric label="MRC" value={formatMoney(totals.totalMRC)} />
    <SaleMetric label="NR" value={formatMoney(totals.totalNR)} accent />
    <SaleMetric label="Accessories" value={formatMoney(accessories)} />
  </div>
}

function SaleMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-lg bg-[var(--surface)] px-3 py-2"><div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div><div className={`mt-1 font-bold tabular-nums ${accent ? 'text-emerald-500' : 'text-[var(--text)]'}`}>{value}</div></div>
}

type SalePreviewCardProps = {
  entries: NRTrackingEntry[]
  canPushSource: boolean
  pushingId: string
  onDashboard: (entry: NRTrackingEntry) => Promise<void>
  onSource: (entry: NRTrackingEntry) => Promise<void>
  onEdit: (entry: NRTrackingEntry) => void
  onDelete: (entry: NRTrackingEntry) => Promise<void>
}

function SalePreviewCard({ entries, canPushSource, pushingId, onDashboard, onSource, onEdit, onDelete }: SalePreviewCardProps) {
  const lead = entries[0]
  const sourcePublished = entries.every((entry) => Boolean(entry.sourcePushedAt))
  const dashboardPublished = entries.every((entry) => Boolean(entry.dashboardPushedAt))
  const units = entries.reduce((total, entry) => total + entry.lineCount, 0)
  const status = sourcePublished ? 'Google Source' : dashboardPublished ? 'Dashboard' : 'Ready to publish'

  return <Card className="overflow-hidden">
    <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-[var(--text)]">Sale · {lead.saleDate}</h3>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${sourcePublished ? 'bg-emerald-500/10 text-emerald-500' : dashboardPublished ? 'bg-sky-500/10 text-sky-500' : 'bg-amber-500/10 text-amber-500'}`}>{status}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{lead.employeeName || 'Unassigned employee'} · {entries.length} {entries.length === 1 ? 'item' : 'items'} · {units} {units === 1 ? 'unit' : 'units'}{lead.notes ? ` · ${lead.notes}` : ''}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!dashboardPublished && <Button size="sm" variant="accent" icon={<LayoutDashboard size={13} />} loading={pushingId === lead.id} onClick={() => onDashboard(lead)}>Push to Dash</Button>}
        {canPushSource && !sourcePublished && <Button size="sm" variant="secondary" icon={<UploadCloud size={13} />} loading={pushingId === lead.id} onClick={() => onSource(lead)}>Push to Google</Button>}
        {!sourcePublished && <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => onDelete(lead)}>Delete sale</Button>}
      </div>
    </div>
    <div className="mt-3 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
      {entries.map((entry) => <div key={entry.id} className="grid gap-2 px-3 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
        <div className="min-w-0"><div className="truncate font-semibold text-[var(--text)]">{entry.planName}</div><div className="mt-0.5 text-[var(--text-tertiary)]">{PRODUCT_CATEGORY_LABELS[entry.productCategory]} · {entry.saleType === 'add-a-line' ? 'Add-a-line' : entry.saleType === 'new-account' ? 'New plan' : 'Product'} · Qty {entry.lineCount}</div></div>
        <div className="tabular-nums text-[var(--text-secondary)]"><span className="text-[var(--text-tertiary)]">MRC </span>{formatMoney(entry.mrc)}</div>
        <div className="font-semibold tabular-nums text-emerald-500"><span className="font-normal text-[var(--text-tertiary)]">NR </span>{formatMoney(entry.nr)}</div>
        {!sourcePublished ? <Button size="sm" variant="ghost" icon={<Edit3 size={13} />} onClick={() => onEdit(entry)}>Edit</Button> : <span className="text-[10px] text-[var(--text-tertiary)]">Locked</span>}
      </div>)}
    </div>
    <SaleTotals entries={entries} />
    {sourcePublished && <p className="mt-3 text-[10px] text-[var(--text-tertiary)]">This sale is locked because its totals have already been added to Google Source.</p>}
  </Card>
}
