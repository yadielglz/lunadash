import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Printer, RefreshCw } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Select } from '../../ui/Input'
import { EmptyState, InlineNotice, ModuleHeader } from '../../ui/ModulePrimitives'
import { useGoalsStore, type Goal } from '../../../store/goalsStore'
import { useDisplayStore } from '../../../store/displayStore'
import { useUiStore } from '../../../store/uiStore'
import { useCommissionSnapshotStore, type CommissionSnapshot } from '../../../store/commissionSnapshotStore'
import { useScheduleStore, type Employee } from '../../../store/scheduleStore'
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

type ReportMode = 'store' | 'district' | 'commission'
type CommissionReportRow = CommissionSnapshot & { employeeSortOrder: number }
type CommissionTotals = {
  commission: number
  opportunity: number
  accessories: number
  revenue: number
  vaf: number
  voiceLines: number
  bts: number
}

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

function formatPercent(value: number | null) {
  if (value === null) return '-'
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
}

function formatReportDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatReportDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function capturePercent(actual: number, opportunity: number) {
  if (!opportunity) return null
  return (actual / opportunity) * 100
}

function emptyCommissionTotals(): CommissionTotals {
  return { commission: 0, opportunity: 0, accessories: 0, revenue: 0, vaf: 0, voiceLines: 0, bts: 0 }
}

function commissionTotalsFor(rows: CommissionSnapshot[]) {
  return rows.reduce((totals, row) => ({
    commission: totals.commission + row.commission,
    opportunity: totals.opportunity + row.commissionOpportunity,
    accessories: totals.accessories + row.accessories,
    revenue: totals.revenue + row.revenue,
    vaf: totals.vaf + row.vaf,
    voiceLines: totals.voiceLines + row.voiceLines,
    bts: totals.bts + row.bts,
  }), emptyCommissionTotals())
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

function isCommissionableEmployee(employee: Employee, storeId: string) {
  const employeeStoreId = normalizeStoreId(employee.storeId ?? storeId)
  const role = employee.role.trim().toLowerCase().replace(/\s+/g, ' ')
  const isManagerRole = role === 'store manager'
    || role.includes('store manager')
    || role === 'retail store manager'
    || role === 'rsm'
  return employeeStoreId === storeId && !isManagerRole
}

function buildCommissionReportRows(params: {
  storeId: string
  snapshots: CommissionSnapshot[]
  employees: Employee[]
}) {
  const storeId = normalizeStoreId(params.storeId)
  const commissionableEmployees = params.employees.filter((employee) => isCommissionableEmployee(employee, storeId))
  const employeeByName = new Map(commissionableEmployees.map((employee) => [employee.name.trim().toLowerCase(), employee]))
  const storeSnapshots = params.snapshots.filter((snapshot) => (
    normalizeStoreId(snapshot.storeId ?? '') === storeId
    && employeeByName.has(snapshot.employeeName.trim().toLowerCase())
  ))
  const latestUpdate = storeSnapshots.reduce((latest, snapshot) => (
    (snapshot.updatedAt || snapshot.createdAt || '') > latest ? (snapshot.updatedAt || snapshot.createdAt || '') : latest
  ), '')
  const latestDate = storeSnapshots.reduce((latest, snapshot) => {
    if (!latest) return snapshot.snapshotDate
    if ((snapshot.updatedAt || snapshot.createdAt || '') === latestUpdate) return snapshot.snapshotDate
    return latest
  }, '')
  const reportDate = latestDate || storeSnapshots.map((snapshot) => snapshot.snapshotDate).sort().reverse()[0] || ''
  const rows = storeSnapshots
    .filter((snapshot) => snapshot.snapshotDate === reportDate)
    .map<CommissionReportRow>((snapshot) => {
      const employee = employeeByName.get(snapshot.employeeName.trim().toLowerCase())
      return { ...snapshot, employeeSortOrder: employee?.sortOrder ?? Number.MAX_SAFE_INTEGER }
    })
    .sort((a, b) => a.employeeSortOrder - b.employeeSortOrder || a.sortOrder - b.sortOrder || a.employeeName.localeCompare(b.employeeName))
  return { rows, reportDate, latestUpdate }
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
    .section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-top: 24px; }
    .section-title h2 { margin: 0; }
    .note { color: #64748b; font-size: 10px; }
    .employee { text-align: left !important; font-weight: 700; color: #111827; }
    .total-row td { background: #f8fafc; font-weight: 800; }
    .empty { margin-top: 10px; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; color: #64748b; font-size: 11px; }
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
  commissionRows: CommissionReportRow[]
  commissionDate: string
  commissionUpdatedAt: string
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
  const commissionTotals = params.commissionRows.reduce((totals, row) => ({
    commission: totals.commission + row.commission,
    opportunity: totals.opportunity + row.commissionOpportunity,
    accessories: totals.accessories + row.accessories,
    revenue: totals.revenue + row.revenue,
    vaf: totals.vaf + row.vaf,
    voiceLines: totals.voiceLines + row.voiceLines,
    bts: totals.bts + row.bts,
  }), emptyCommissionTotals())
  const averageCommissionRevenue = params.commissionRows.length ? commissionTotals.revenue / params.commissionRows.length : 0
  const averageCommissionVaf = params.commissionRows.length ? commissionTotals.vaf / params.commissionRows.length : 0
  const commissionMeta = [
    params.commissionDate ? formatReportDate(params.commissionDate) : '',
    params.commissionUpdatedAt ? `Last updated ${formatReportDateTime(params.commissionUpdatedAt)}` : '',
  ].filter(Boolean).join(' | ')
  const commissionRowsHtml = params.commissionRows.length > 0
    ? `<table><thead><tr><th class="employee">Employee</th><th>Paid</th><th>Opp</th><th>Capture</th><th>Accessories</th><th>Revenue</th><th>VAF</th><th>Voice</th><th>BTS</th></tr></thead><tbody>${params.commissionRows.map((row) => `<tr><td class="employee">${escapeHtml(row.employeeName || '-')}</td><td>${escapeHtml(formatReportValue(row.commission, 'money'))}</td><td>${escapeHtml(formatReportValue(row.commissionOpportunity, 'money'))}</td><td>${escapeHtml(formatPercent(capturePercent(row.commission, row.commissionOpportunity)))}</td><td>${escapeHtml(formatReportValue(row.accessories, 'money'))}</td><td>${escapeHtml(formatReportValue(row.revenue, 'money'))}</td><td>${escapeHtml(formatReportValue(row.vaf, 'money'))}</td><td>${escapeHtml(formatReportValue(row.voiceLines, 'number'))}</td><td>${escapeHtml(formatReportValue(row.bts, 'number'))}</td></tr>`).join('')}<tr class="total-row"><td class="employee">Team Total</td><td>${escapeHtml(formatReportValue(commissionTotals.commission, 'money'))}</td><td>${escapeHtml(formatReportValue(commissionTotals.opportunity, 'money'))}</td><td>${escapeHtml(formatPercent(capturePercent(commissionTotals.commission, commissionTotals.opportunity)))}</td><td>${escapeHtml(formatReportValue(commissionTotals.accessories, 'money'))}</td><td>${escapeHtml(formatReportValue(averageCommissionRevenue, 'money'))}</td><td>${escapeHtml(formatReportValue(averageCommissionVaf, 'money'))}</td><td>${escapeHtml(formatReportValue(commissionTotals.voiceLines, 'number'))}</td><td>${escapeHtml(formatReportValue(commissionTotals.bts, 'number'))}</td></tr></tbody></table>`
    : '<div class="empty">No team commission snapshot has been saved for this store in the selected month.</div>'

  return `<!doctype html><html><head><title>${escapeHtml(monthLabel(params.month))} Performance Snapshot</title><style>${baseReportCss('store')}</style></head><body><main>
    <header><div><h1>Performance Snapshot</h1><div class="subtle">${escapeHtml(monthLabel(params.month))}</div></div><div class="meta subtle"><div>${escapeHtml(storeLabel)}</div><div>Store ID: ${escapeHtml(params.storeId || 'DEFAULT')}</div><div>Generated ${escapeHtml(generatedAt)}</div></div></header>
    <section class="summary">${rows.slice(0, 4).map((row) => `<div class="tile"><div class="label">${escapeHtml(row.label)}</div><div class="value">${escapeHtml(formatReportValue(row.total, row.kind))}</div></div>`).join('')}</section>
    <table><thead><tr><th>Metric</th><th>MTD Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td class="store">${escapeHtml(row.label)}</td><td>${escapeHtml(formatReportValue(row.total, row.kind))}</td></tr>`).join('')}</tbody></table>
    <div class="section-title"><h2>Team Commission</h2><div class="note">${escapeHtml(commissionMeta || 'Not updated yet')}</div></div>
    ${commissionRowsHtml}
    <h2>EOD MTD Records</h2>
    <table><thead><tr><th>Date</th>${metricKeys.map((key) => `<th>${escapeHtml(REPORT_METRICS[key].label)}</th>`).join('')}</tr></thead><tbody>${dailyRows.map((row) => `<tr><td class="store">${escapeHtml(new Date(row.date + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}</td>${metricKeys.map((key) => `<td>${escapeHtml(formatReportValue(Number(row.values[key]) || 0, REPORT_METRICS[key].kind))}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <footer>MTD totals are calculated from saved daily Source snapshots.</footer>
  </main></body></html>`
}

function buildCommissionReportHtml(params: {
  storeId: string
  companyName: string
  storeNumber: string
  rows: CommissionReportRow[]
  reportDate: string
  updatedAt: string
}) {
  const generatedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  const storeLabel = `${params.companyName || 'Luna Store'}${params.storeNumber ? ` #${params.storeNumber}` : ''}`
  const totals = commissionTotalsFor(params.rows)
  const averageRevenue = params.rows.length ? totals.revenue / params.rows.length : 0
  const averageVaf = params.rows.length ? totals.vaf / params.rows.length : 0
  const openOpportunity = Math.max(totals.opportunity - totals.commission, 0)
  const reportMeta = [
    params.reportDate ? `Information date ${formatReportDate(params.reportDate)}` : 'No information date',
    params.updatedAt ? `Last updated ${formatReportDateTime(params.updatedAt)}` : 'Not updated yet',
  ].join(' | ')
  const employeeRows = params.rows.length > 0
    ? params.rows.map((row) => `<tr><td class="employee">${escapeHtml(row.employeeName || '-')}</td><td>${escapeHtml(formatReportValue(row.commission, 'money'))}</td><td>${escapeHtml(formatReportValue(row.commissionOpportunity, 'money'))}</td><td>${escapeHtml(formatPercent(capturePercent(row.commission, row.commissionOpportunity)))}</td><td>${escapeHtml(formatReportValue(Math.max(row.commissionOpportunity - row.commission, 0), 'money'))}</td><td>${escapeHtml(formatReportValue(row.accessories, 'money'))}</td><td>${escapeHtml(formatReportValue(row.revenue, 'money'))}</td><td>${escapeHtml(formatReportValue(row.vaf, 'money'))}</td><td>${escapeHtml(formatReportValue(row.voiceLines, 'number'))}</td><td>${escapeHtml(formatReportValue(row.bts, 'number'))}</td></tr>`).join('')
    : ''
  return `<!doctype html><html><head><title>Commission Dashboard</title><style>${baseReportCss('store')}</style></head><body><main>
    <header><div><h1>Commission Dashboard</h1><div class="subtle">${escapeHtml(params.reportDate ? formatReportDate(params.reportDate) : 'Current team view')}</div></div><div class="meta subtle"><div>${escapeHtml(storeLabel)}</div><div>Store ID: ${escapeHtml(params.storeId || 'DEFAULT')}</div><div>Generated ${escapeHtml(generatedAt)}</div></div></header>
    <section class="summary">
      <div class="tile"><div class="label">Team Paid</div><div class="value">${escapeHtml(formatReportValue(totals.commission, 'money'))}</div></div>
      <div class="tile"><div class="label">Opportunity</div><div class="value">${escapeHtml(formatReportValue(totals.opportunity, 'money'))}</div></div>
      <div class="tile"><div class="label">Capture</div><div class="value">${escapeHtml(formatPercent(capturePercent(totals.commission, totals.opportunity)))}</div></div>
      <div class="tile"><div class="label">Open Opp</div><div class="value">${escapeHtml(formatReportValue(openOpportunity, 'money'))}</div></div>
    </section>
    <div class="section-title"><h2>Team Commission</h2><div class="note">${escapeHtml(reportMeta)}</div></div>
    ${params.rows.length > 0
      ? `<table><thead><tr><th class="employee">Employee</th><th>Paid</th><th>Opp</th><th>Capture</th><th>Open</th><th>Accessories</th><th>Revenue</th><th>VAF</th><th>Voice</th><th>BTS</th></tr></thead><tbody>${employeeRows}<tr class="total-row"><td class="employee">Team Total</td><td>${escapeHtml(formatReportValue(totals.commission, 'money'))}</td><td>${escapeHtml(formatReportValue(totals.opportunity, 'money'))}</td><td>${escapeHtml(formatPercent(capturePercent(totals.commission, totals.opportunity)))}</td><td>${escapeHtml(formatReportValue(openOpportunity, 'money'))}</td><td>${escapeHtml(formatReportValue(totals.accessories, 'money'))}</td><td>${escapeHtml(formatReportValue(averageRevenue, 'money'))}</td><td>${escapeHtml(formatReportValue(averageVaf, 'money'))}</td><td>${escapeHtml(formatReportValue(totals.voiceLines, 'number'))}</td><td>${escapeHtml(formatReportValue(totals.bts, 'number'))}</td></tr></tbody></table>`
      : '<div class="empty">No current commission dashboard has been saved for this store yet.</div>'}
    <footer>Commission dashboard uses the store's latest saved team information. Store Manager, Retail Store Manager, and RSM roles are excluded.</footer>
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
  const commissionSnapshots = useCommissionSnapshotStore((s) => s.snapshots)
  const employees = useScheduleStore((s) => s.employees)
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
    [
      ...allSnapshotGoals.flatMap((goal) => Object.keys(goal.dailyLog ?? {}).map((day) => day.slice(0, 7))),
      ...commissionSnapshots
        .filter((snapshot) => normalizeStoreId(snapshot.storeId ?? '') === reportStoreId)
        .map((snapshot) => snapshot.snapshotDate.slice(0, 7)),
    ]
  )).sort().reverse(), [allSnapshotGoals, commissionSnapshots, reportStoreId])

  const commissionReport = useMemo(() => buildCommissionReportRows({
    storeId: reportStoreId,
    snapshots: commissionSnapshots,
    employees,
  }), [commissionSnapshots, employees, reportStoreId])

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
      if (mode !== 'commission' && !selectedMonth) {
        setPreviewHtml('')
        return
      }
      setLoadingPreview(true)
      setError('')
      try {
        const html = mode === 'district'
          ? buildDistrictReportHtml(selectedMonth, await loadDistrictSnapshotGoals())
          : mode === 'commission'
            ? buildCommissionReportHtml({
              storeId: storeId || 'DEFAULT',
              companyName,
              storeNumber,
              rows: commissionReport.rows,
              reportDate: commissionReport.reportDate,
              updatedAt: commissionReport.latestUpdate,
            })
            : buildStoreReportHtml({
            month: selectedMonth,
            goals: storeSnapshotGoals,
            storeId: storeId || 'DEFAULT',
            companyName,
            storeNumber,
            commissionRows: commissionReport.rows,
            commissionDate: commissionReport.reportDate,
            commissionUpdatedAt: commissionReport.latestUpdate,
          })
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
  }, [mode, selectedMonth, companyName, storeNumber, storeId, goals.length, commissionReport])

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
    <div className="performance-suite reports-performance-page flex h-full flex-col overflow-hidden">
      <ModuleHeader
        icon={<FileText size={18} />}
        eyebrow="Review and export"
        title="Reports"
        description="Choose a reporting view, verify the latest snapshot, and prepare a print-ready document."
        actions={
          <div className="flex flex-wrap gap-2">
            {mode !== 'commission' && (
              <Button size="sm" variant="secondary" icon={<RefreshCw size={13} />} loading={snapshotRunning} onClick={forceSnapshot}>
                Force Snapshot
              </Button>
            )}
            <Button size="sm" variant="primary" icon={<Printer size={13} />} disabled={!previewHtml || loadingPreview} onClick={printPreview}>
              Print Preview
            </Button>
          </div>
        }
      />

      <div className="performance-content grid flex-1 overflow-y-auto xl:grid-cols-[21rem_minmax(0,1fr)] xl:overflow-hidden">
        <aside className="report-setup border-b border-[var(--border)] p-4 xl:border-b-0 xl:border-r">
          <div className="space-y-4">
            <Card className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Report Setup</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">Choose a report and review it before printing.</div>
              </div>
              <Select label="Report" value={mode} onChange={(event) => setMode(event.target.value as ReportMode)}>
                <option value="store">Store Performance Snapshot</option>
                <option value="commission">Store Commission Dashboard</option>
                <option value="district">District Performance Snapshot</option>
              </Select>
              {mode !== 'commission' && (
                <Select label="Month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} disabled={months.length === 0}>
                  {months.length === 0 ? <option value="">No historical snapshots yet</option> : months.map((month) => (
                    <option key={month} value={month}>{monthLabel(month)}</option>
                  ))}
                </Select>
              )}
            </Card>

            <Card>
              <div className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">Preview Status</div>
              <div className="mt-2 text-sm font-semibold text-[var(--text)]">{loadingPreview ? 'Building preview...' : previewHtml ? 'Ready to print' : 'No report available'}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {mode === 'commission'
                  ? (commissionReport.latestUpdate ? `Last updated ${formatReportDateTime(commissionReport.latestUpdate)}` : 'No commission dashboard saved yet.')
                  : selectedMonth ? monthLabel(selectedMonth) : 'Select a month to begin.'}
              </div>
              {message && <InlineNotice className="mt-3" tone="success">{message}</InlineNotice>}
              {error && <InlineNotice className="mt-3" tone="danger">{error}</InlineNotice>}
            </Card>
          </div>
        </aside>

        <main className="report-preview overflow-visible bg-[var(--surface-2)] p-4 xl:overflow-auto">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Report Preview</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {mode === 'district'
                    ? `Landscape district report · ${selectedMonth ? monthLabel(selectedMonth) : 'No month selected'}`
                    : mode === 'commission'
                      ? `Store commission dashboard · ${commissionReport.reportDate ? formatReportDate(commissionReport.reportDate) : 'No information date'}`
                      : `Store report · ${selectedMonth ? monthLabel(selectedMonth) : 'No month selected'}`}
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
              {previewHtml ? (
                <iframe ref={previewRef} title="Report preview" srcDoc={previewHtml} className="h-[calc(100vh-13rem)] w-full bg-white" />
              ) : (
                <EmptyState
                  className="m-4 h-[30rem]"
                  icon={<FileText size={22} />}
                  title="No report preview yet"
                  description="Choose a report and an available month. The printable preview will appear here when its snapshot is ready."
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
