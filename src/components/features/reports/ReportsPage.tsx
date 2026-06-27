import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Printer, RefreshCw } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Select } from '../../ui/Input'
import { useGoalsStore, type Goal } from '../../../store/goalsStore'
import { useDisplayStore } from '../../../store/displayStore'
import { useUiStore } from '../../../store/uiStore'
import { dbForceEodSnapshot, dbGetGoals, dbGetStores } from '../../../lib/supabase'
import { getStoreProfile } from '../../../config/storeProfiles'
import { normalizeStoreId } from '../../../lib/storeIds'

const SNAPSHOT_CATEGORY = 'Performance Snapshot'
const SNAPSHOT_PREFIX = 'source-snapshot:'
const REPORT_METRICS: Record<string, { label: string; kind: 'money' | 'number' | 'percent' }> = {
  netRevenue: { label: 'Net Revenue', kind: 'money' },
  accessoryRevenue: { label: 'Accessories', kind: 'money' },
  totalPp: { label: 'Total PP', kind: 'number' },
  traffic: { label: 'Traffic', kind: 'number' },
  vl: { label: 'Voice Lines', kind: 'number' },
  bts: { label: 'BTS', kind: 'number' },
  hsi: { label: 'HSI', kind: 'number' },
  visa: { label: 'VISA', kind: 'number' },
}

type ReportMode = 'store' | 'district'

function snapshotKey(goal: Goal) {
  return goal.description.startsWith(SNAPSHOT_PREFIX) ? goal.description.slice(SNAPSHOT_PREFIX.length) : ''
}

function monthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function formatReportValue(value: number, kind: 'money' | 'number' | 'percent') {
  if (kind === 'money') {
    return Math.round(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
  if (kind === 'percent') return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
  return Math.round(value).toLocaleString('en-US')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isReportStoreId(storeId: string) {
  return storeId === 'main' || /^[A-Z0-9]{4}$/.test(storeId)
}

function storeReportLabel(storeId: string) {
  if (storeId === 'main') return 'District'
  const profile = getStoreProfile(storeId)
  return profile ? `${profile.nickname} | ${storeId}` : storeId
}

function reportGoalFor(goals: Goal[], metricKey: string, storeId?: string) {
  return goals.find((goal) => (
    snapshotKey(goal) === metricKey
    && (!storeId || normalizeStoreId(goal.storeId ?? '') === normalizeStoreId(storeId))
  ))
}

function monthSnapshotTotal(goal: Goal | undefined, month: string) {
  return Object.entries(goal?.dailyLog ?? {}).reduce((sum, [day, value]) => (
    day.startsWith(month) ? sum + (Number(value) || 0) : sum
  ), 0)
}

function dailyValue(goal: Goal | undefined, date: string) {
  return Number(goal?.dailyLog?.[date]) || 0
}

function baseReportCss(mode: ReportMode) {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", system-ui, sans-serif; background: #eef2f7; }
    main { width: ${mode === 'district' ? '11in' : '8.5in'}; min-height: ${mode === 'district' ? '8.5in' : '11in'}; margin: 0 auto; padding: ${mode === 'district' ? '0.45in' : '0.55in'}; background: white; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
    h1 { margin: 0; font-size: 25px; letter-spacing: 0; }
    h2 { margin: 24px 0 0; font-size: 15px; }
    .subtle { color: #64748b; font-size: 12px; }
    .meta { text-align: right; line-height: 1.5; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
    .tile { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; min-height: 82px; }
    .label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .value { margin-top: 8px; font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { text-align: left; color: #64748b; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding: 8px 6px; }
    td { border-bottom: 1px solid #e5e7eb; padding: 9px 6px; font-size: 11px; }
    td:not(:first-child), th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
    .store { text-align: left !important; font-weight: 700; color: #111827; }
    footer { margin-top: 22px; color: #64748b; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print {
      ${mode === 'district' ? '@page { size: landscape; }' : ''}
      body { background: white; }
      main { width: auto; min-height: auto; margin: 0; padding: ${mode === 'district' ? '0.35in' : '0.45in'}; }
    }
  `
}

function buildStoreReportHtml(params: {
  month: string
  goals: Goal[]
  storeId: string
  companyName: string
  storeNumber: string
}) {
  const rows = Object.entries(REPORT_METRICS).map(([key, meta]) => ({
    key,
    ...meta,
    total: monthSnapshotTotal(reportGoalFor(params.goals, key), params.month),
  }))
  const metricKeys = Object.keys(REPORT_METRICS)
  const dailyDates = Array.from(new Set(
    params.goals.flatMap((goal) => Object.keys(goal.dailyLog ?? {}).filter((day) => day.startsWith(params.month)))
  )).sort()
  const dailyRows = dailyDates.map((date) => ({
    date,
    values: Object.fromEntries(metricKeys.map((key) => [key, dailyValue(reportGoalFor(params.goals, key), date)])),
  }))
  const generatedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  const storeLabel = `${params.companyName || 'Luna Store'}${params.storeNumber ? ` #${params.storeNumber}` : ''}`

  return `<!doctype html><html><head><title>${escapeHtml(monthLabel(params.month))} Performance Snapshot</title><style>${baseReportCss('store')}</style></head><body><main>
    <header><div><h1>Performance Snapshot</h1><div class="subtle">${escapeHtml(monthLabel(params.month))}</div></div><div class="meta subtle"><div>${escapeHtml(storeLabel)}</div><div>Store ID: ${escapeHtml(params.storeId || 'DEFAULT')}</div><div>Generated ${escapeHtml(generatedAt)}</div></div></header>
    <section class="summary">${rows.slice(0, 4).map((row) => `<div class="tile"><div class="label">${escapeHtml(row.label)}</div><div class="value">${escapeHtml(formatReportValue(row.total, row.kind))}</div></div>`).join('')}</section>
    <table><thead><tr><th>Metric</th><th>MTD Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="store">${escapeHtml(row.label)}</td><td>${escapeHtml(formatReportValue(row.total, row.kind))}</td></tr>`).join('')}</tbody></table>
    <h2>EOD MTD Records</h2>
    <table><thead><tr><th>Date</th>${metricKeys.map((key) => `<th>${escapeHtml(REPORT_METRICS[key].label)}</th>`).join('')}</tr></thead><tbody>${dailyRows.map((row) => `<tr><td class="store">${escapeHtml(new Date(row.date + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}</td>${metricKeys.map((key) => `<td>${escapeHtml(formatReportValue(Number(row.values[key]) || 0, REPORT_METRICS[key].kind))}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <footer>MTD totals are calculated from saved daily Source snapshots.</footer>
  </main></body></html>`
}

function buildDistrictReportHtml(month: string, districtGoals: Goal[]) {
  const storeIds = Array.from(new Set(
    districtGoals.map((goal) => normalizeStoreId(goal.storeId ?? '')).filter((id) => /^[A-Z0-9]{4}$/.test(id))
  )).sort()
  const mainGoals = districtGoals.filter((goal) => normalizeStoreId(goal.storeId ?? '') === 'main')
  const storeGoals = districtGoals.filter((goal) => storeIds.includes(normalizeStoreId(goal.storeId ?? '')))
  const rows = Object.entries(REPORT_METRICS).map(([key, meta]) => {
    const mainGoal = reportGoalFor(mainGoals, key, 'main')
    const total = mainGoal
      ? monthSnapshotTotal(mainGoal, month)
      : storeIds.reduce((sum, sid) => sum + monthSnapshotTotal(reportGoalFor(storeGoals, key, sid), month), 0)
    return { key, ...meta, total }
  })
  const leaderboardRows = storeIds
    .map((sid) => ({
      storeId: sid,
      netRevenue: monthSnapshotTotal(reportGoalFor(storeGoals, 'netRevenue', sid), month),
      accessories: monthSnapshotTotal(reportGoalFor(storeGoals, 'accessoryRevenue', sid), month),
      totalPp: monthSnapshotTotal(reportGoalFor(storeGoals, 'totalPp', sid), month),
    }))
    .sort((a, b) => b.netRevenue - a.netRevenue)
  const generatedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

  return `<!doctype html><html><head><title>${escapeHtml(monthLabel(month))} District Performance Snapshot</title><style>${baseReportCss('district')}</style></head><body><main>
    <header><div><h1>District Performance Snapshot</h1><div class="subtle">${escapeHtml(monthLabel(month))}</div></div><div class="meta subtle"><div>Full District</div><div>${storeIds.length} stores</div><div>Generated ${escapeHtml(generatedAt)}</div></div></header>
    <section class="summary">${rows.slice(0, 4).map((row) => `<div class="tile"><div class="label">${escapeHtml(row.label)}</div><div class="value">${escapeHtml(formatReportValue(row.total, row.kind))}</div></div>`).join('')}</section>
    <table><thead><tr><th>Metric</th><th>District MTD Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="store">${escapeHtml(row.label)}</td><td>${escapeHtml(formatReportValue(row.total, row.kind))}</td></tr>`).join('')}</tbody></table>
    <h2>Store Leaderboard - MTD</h2>
    <table><thead><tr><th>Rank</th><th class="store">Store</th><th>Net Revenue</th><th>Accessories</th><th>Total PP</th></tr></thead><tbody>${leaderboardRows.map((row, index) => `<tr><td>${index + 1}</td><td class="store">${escapeHtml(storeReportLabel(row.storeId))}</td><td>${escapeHtml(formatReportValue(row.netRevenue, 'money'))}</td><td>${escapeHtml(formatReportValue(row.accessories, 'money'))}</td><td>${escapeHtml(formatReportValue(row.totalPp, 'number'))}</td></tr>`).join('')}</tbody></table>
    <footer>District totals and leaderboard values are calculated from saved daily Source snapshots in the selected month.</footer>
  </main></body></html>`
}

export function ReportsPage() {
  const { goals, _init: goalsInit } = useGoalsStore()
  const { companyName, storeNumber } = useDisplayStore()
  const { storeId } = useUiStore()
  const previewRef = useRef<HTMLIFrameElement>(null)
  const [mode, setMode] = useState<ReportMode>('store')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [snapshotRunning, setSnapshotRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const reportStoreId = normalizeStoreId(storeId || 'main')

  const allSnapshotGoals = goals.filter((goal) => (
    goal.category === SNAPSHOT_CATEGORY && snapshotKey(goal) && isReportStoreId(normalizeStoreId(goal.storeId ?? ''))
  ))
  const storeSnapshotGoals = goals.filter((goal) => (
    goal.category === SNAPSHOT_CATEGORY && snapshotKey(goal) && normalizeStoreId(goal.storeId ?? '') === reportStoreId
  ))
  const months = useMemo(() => Array.from(new Set(
    allSnapshotGoals.flatMap((goal) => Object.keys(goal.dailyLog ?? {}).map((day) => day.slice(0, 7)))
  )).sort().reverse(), [allSnapshotGoals])

  useEffect(() => {
    if (!selectedMonth && months[0]) setSelectedMonth(months[0])
    if (selectedMonth && months.length > 0 && !months.includes(selectedMonth)) setSelectedMonth(months[0])
  }, [months, selectedMonth])

  const loadDistrictSnapshotGoals = async () => {
    const currentDistrictGoals = allSnapshotGoals.filter((goal) => {
      const sid = normalizeStoreId(goal.storeId ?? '')
      return sid === 'main' || /^[A-Z0-9]{4}$/.test(sid)
    })
    const storeIds = Array.from(new Set(currentDistrictGoals.map((goal) => normalizeStoreId(goal.storeId ?? '')).filter(Boolean)))
    if (storeIds.includes('main') && storeIds.filter((id) => id !== 'main').length >= 2) return currentDistrictGoals

    const stores = await dbGetStores()
    const goalSets = await Promise.all([
      dbGetGoals('main'),
      ...stores.map((store) => normalizeStoreId(store.store_id)).filter((id) => /^[A-Z0-9]{4}$/.test(id)).map((id) => dbGetGoals(id)),
    ])
    const loadedGoals = goalSets.flat()
    goalsInit([...goals.filter((goal) => goal.category !== SNAPSHOT_CATEGORY), ...loadedGoals])
    return loadedGoals.filter((goal) => (
      goal.category === SNAPSHOT_CATEGORY && snapshotKey(goal) && isReportStoreId(normalizeStoreId(goal.storeId ?? ''))
    ))
  }

  useEffect(() => {
    let cancelled = false
    const buildPreview = async () => {
      if (!selectedMonth) {
        setPreviewHtml('')
        return
      }
      setLoadingPreview(true)
      setError('')
      try {
        const html = mode === 'store'
          ? buildStoreReportHtml({ month: selectedMonth, goals: storeSnapshotGoals, storeId: storeId || 'DEFAULT', companyName, storeNumber })
          : buildDistrictReportHtml(selectedMonth, await loadDistrictSnapshotGoals())
        if (!cancelled) setPreviewHtml(html)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not build report preview')
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }
    buildPreview()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedMonth, companyName, storeNumber, storeId, goals.length])

  const printPreview = () => {
    const frame = previewRef.current
    if (!frame?.contentWindow) {
      setError('Report preview is not ready yet.')
      return
    }
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }

  const forceSnapshot = async () => {
    setSnapshotRunning(true)
    setMessage('')
    setError('')
    try {
      const result = await dbForceEodSnapshot()
      const refreshedGoals = storeId === 'main'
        ? (await Promise.all([dbGetGoals('main'), ...(await dbGetStores()).map((store) => dbGetGoals(store.store_id))])).flat()
        : await dbGetGoals(storeId || 'DEFAULT')
      goalsInit(refreshedGoals)
      setMessage(`${result.message}${result.updated ? ` (${result.updated} metrics)` : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run EOD snapshot')
    } finally {
      setSnapshotRunning(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text)]">
              <FileText size={18} className="text-[var(--accent)]" />
              Reports
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Preview, print, and refresh performance snapshot reports.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<RefreshCw size={13} />} loading={snapshotRunning} onClick={forceSnapshot}>
              Force Snapshot
            </Button>
            <Button size="sm" variant="primary" icon={<Printer size={13} />} disabled={!previewHtml || loadingPreview} onClick={printPreview}>
              Print Preview
            </Button>
          </div>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border)] p-4 xl:border-b-0 xl:border-r">
          <div className="space-y-4">
            <Card className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Report Setup</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">Choose a report and review it before printing.</div>
              </div>
              <Select label="Report" value={mode} onChange={(event) => setMode(event.target.value as ReportMode)}>
                <option value="store">Store Performance Snapshot</option>
                <option value="district">District Performance Snapshot</option>
              </Select>
              <Select label="Month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} disabled={months.length === 0}>
                {months.length === 0 ? <option value="">No historical snapshots yet</option> : months.map((month) => (
                  <option key={month} value={month}>{monthLabel(month)}</option>
                ))}
              </Select>
            </Card>

            <Card>
              <div className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">Preview Status</div>
              <div className="mt-2 text-sm font-semibold text-[var(--text)]">{loadingPreview ? 'Building preview...' : previewHtml ? 'Ready to print' : 'No report available'}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{selectedMonth ? monthLabel(selectedMonth) : 'Select a month to begin.'}</div>
              {message && <p className="mt-3 text-xs text-[var(--accent)]">{message}</p>}
              {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            </Card>
          </div>
        </aside>

        <main className="overflow-auto bg-[var(--surface-2)] p-4">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Report Preview</div>
                <div className="text-xs text-[var(--text-tertiary)]">{mode === 'district' ? 'Landscape district report' : 'Store report'} · {selectedMonth ? monthLabel(selectedMonth) : 'No month selected'}</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
              {previewHtml ? (
                <iframe ref={previewRef} title="Report preview" srcDoc={previewHtml} className="h-[calc(100vh-13rem)] w-full bg-white" />
              ) : (
                <div className="flex h-[32rem] items-center justify-center text-sm text-slate-500">No report preview yet.</div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
