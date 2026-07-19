import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { toPng } from 'html-to-image'
import { AlertCircle, ArrowDown, ArrowUp, BarChart3, Camera, CheckCircle2, ChevronRight, Clock, Columns3, Copy, Filter, LocateFixed, MessageSquarePlus, Package, Pin, RefreshCw, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Textarea } from '../../ui/Input'
import { InlineNotice, ModuleHeader } from '../../ui/ModulePrimitives'
import { useUiStore } from '../../../store/uiStore'
import { useDistrictCoachingStore } from '../../../store/districtCoachingStore'
import { normalizeStoreId } from '../../../lib/storeIds'
import {
  fetchPerformanceData,
  formatMoney,
  formatNumber,
  formatPercent,
  PerformanceData,
  PerformanceRow,
} from '../../../lib/performanceSheet'
import { dealerInfoForRow } from '../../../lib/dealers'
import { copyEodToClipboard } from '../../../lib/eodCopy'

type SortKey = 'overallScore' | 'goalGapScore' | 'netRevenue' | 'netRevenuePct' | 'accessoryRevenue' | 'accessoryPct' | 'totalPp' | 'ppPct' | 'traffic'
type OptionalColumn = 'traffic' | 'postConv' | 'goals' | 'products'
type ViewMode = 'today' | 'ranking' | 'compare'
type SmartFilter = 'all' | 'behind' | 'overGoal' | 'top5' | 'needsAcc' | 'lowPp' | 'highTraffic' | 'goalGap'
type PinnedMetric = 'overall' | 'netRevenuePct' | 'accessoryPct' | 'ppPct' | 'traffic' | 'goalGap'
type RankedRow = PerformanceRow & {
  overallScore: number
  goalGapScore: number
  goalGapLabel: string
  overallRank: number
  netRevenueRank: number
  accessoryRank: number
  ppRank: number
  movement: number | null
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'overallScore', label: 'Overall' },
  { key: 'goalGapScore', label: 'Goal Gap' },
  { key: 'netRevenue', label: 'Net Rev' },
  { key: 'netRevenuePct', label: 'NR %' },
  { key: 'accessoryRevenue', label: 'ACC' },
  { key: 'accessoryPct', label: 'ACC %' },
  { key: 'totalPp', label: 'PP' },
  { key: 'ppPct', label: 'PP %' },
  { key: 'traffic', label: 'Traffic' },
]

const SHEET_REFRESH_MS = 60_000
const MAIN_STORE_ID = 'main'
const SORT_STORAGE_KEY = 'lunadash-performance-sort'
const COLUMN_STORAGE_KEY = 'lunadash-performance-columns'
const RANK_SNAPSHOT_KEY = 'lunadash-performance-rank-snapshot'
const PINNED_METRICS_KEY = 'lunadash-performance-pinned-metrics'
const STORE_NUMBERS_CAPTURE_SIZE = 720
const DEFAULT_COLUMNS: Record<OptionalColumn, boolean> = {
  traffic: true,
  postConv: true,
  goals: true,
  products: true,
}
const DEFAULT_PINNED_METRICS: PinnedMetric[] = ['overall', 'netRevenuePct', 'accessoryPct', 'ppPct']

function readStoredSort() {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SORT_STORAGE_KEY) || 'null')
    if (!parsed || !SORT_OPTIONS.some((option) => option.key === parsed.sortKey)) return null
    return {
      sortKey: parsed.sortKey as SortKey,
      direction: parsed.direction === 'asc' ? 'asc' as const : 'desc' as const,
    }
  } catch {
    return null
  }
}

function readStoredColumns() {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COLUMN_STORAGE_KEY) || 'null')
    return { ...DEFAULT_COLUMNS, ...(parsed ?? {}) }
  } catch {
    return DEFAULT_COLUMNS
  }
}

function readStoredRankSnapshot() {
  if (typeof window === 'undefined') return new Map<string, number>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RANK_SNAPSHOT_KEY) || '{}')
    return new Map<string, number>(Object.entries(parsed).map(([store, rank]) => [store, Number(rank)]))
  } catch {
    return new Map<string, number>()
  }
}

function readStoredPinnedMetrics() {
  if (typeof window === 'undefined') return DEFAULT_PINNED_METRICS
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PINNED_METRICS_KEY) || 'null')
    if (!Array.isArray(parsed)) return DEFAULT_PINNED_METRICS
    return parsed.filter((metric): metric is PinnedMetric => (
      metric === 'overall'
      || metric === 'netRevenuePct'
      || metric === 'accessoryPct'
      || metric === 'ppPct'
      || metric === 'traffic'
      || metric === 'goalGap'
    ))
  } catch {
    return DEFAULT_PINNED_METRICS
  }
}

function metricColor(value: number, warning = 80) {
  if (value >= 100) return '#16c60c'
  if (value >= warning) return '#f7b731'
  return '#e74856'
}

function rankRows(rows: PerformanceRow[], previousRanks = new Map<string, number>()): RankedRow[] {
  const rankBy = (valueFor: (row: PerformanceRow) => number) => {
    const ranks = new Map<string, number>()
    const sorted = [...rows].sort((a, b) => valueFor(b) - valueFor(a))
    sorted.forEach((row, index) => ranks.set(row.store, index + 1))
    return ranks
  }

  const overallScore = (row: PerformanceRow) => (row.netRevenuePct + row.accessoryPct + row.ppPct) / 3
  const goalGapScore = (row: PerformanceRow) => (
    Math.max(100 - row.netRevenuePct, 0)
    + Math.max(100 - row.accessoryPct, 0)
    + Math.max(100 - row.ppPct, 0)
  ) / 3
  const goalGapLabel = (row: PerformanceRow) => {
    const gaps = [
      Math.max(row.netRevenueGoal - row.netRevenue, 0),
      Math.max(row.accessoryGoal - row.accessoryRevenue, 0),
      Math.max(row.dortGoal - row.totalPp, 0),
    ]
    if (gaps.every((gap) => gap === 0)) return 'No gaps'
    return `${formatMoney(gaps[0])} NR · ${formatMoney(gaps[1])} ACC · ${formatNumber(gaps[2])} PP`
  }
  const overallRanks = rankBy(overallScore)
  const netRevenueRanks = rankBy((row) => row.netRevenue)
  const accessoryRanks = rankBy((row) => row.accessoryRevenue)
  const ppRanks = rankBy((row) => row.totalPp)

  return rows.map((row) => ({
    ...row,
    overallScore: overallScore(row),
    goalGapScore: goalGapScore(row),
    goalGapLabel: goalGapLabel(row),
    overallRank: overallRanks.get(row.store) ?? 0,
    netRevenueRank: netRevenueRanks.get(row.store) ?? 0,
    accessoryRank: accessoryRanks.get(row.store) ?? 0,
    ppRank: ppRanks.get(row.store) ?? 0,
    movement: previousRanks.has(row.store) ? (previousRanks.get(row.store) ?? 0) - (overallRanks.get(row.store) ?? 0) : null,
  }))
}

function RankPill({ rank, tone = '#7c5ff5' }: { rank: number; tone?: string }) {
  return (
    <span
      className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-bold tabular-nums"
      style={{ borderColor: `${tone}55`, background: `${tone}18`, color: tone }}
    >
      #{rank || '-'}
    </span>
  )
}

function MovementBadge({ movement }: { movement: number | null }) {
  if (movement === null) {
    return <span className="text-[10px] font-medium text-[var(--text-tertiary)]">new</span>
  }
  if (movement === 0) {
    return <span className="text-[10px] font-medium text-[var(--text-tertiary)]">same</span>
  }

  const positive = movement > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${positive ? 'text-[#16c60c]' : 'text-[#e74856]'}`}>
      {positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(movement)}
    </span>
  )
}

function GoalChip({ value }: { value: number }) {
  const color = metricColor(value)
  const label = value >= 100 ? 'Met' : value >= 80 ? 'Close' : 'Behind'

  return (
    <span
      className="inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-semibold uppercase tabular-nums"
      style={{ borderColor: `${color}45`, background: `${color}18`, color }}
    >
      {label} {formatPercent(value)}
    </span>
  )
}

function SummaryTile({ label, value, helper, tone }: { label: string; value: string; helper: string; tone?: string }) {
  return (
    <Card className="min-h-[92px] p-3">
      <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-[var(--text)] tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        {tone && <span className="h-2 w-2 rounded-full" style={{ background: tone }} />}
        <span>{helper}</span>
      </div>
    </Card>
  )
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="min-h-[92px] animate-pulse p-3">
            <div className="h-3 w-20 rounded bg-[var(--surface-3)]" />
            <div className="mt-3 h-7 w-28 rounded bg-[var(--surface-3)]" />
            <div className="mt-3 h-3 w-36 rounded bg-[var(--surface-3)]" />
          </Card>
        ))}
      </div>
      <Card noPadding className="overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-3)]" />
        </div>
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded-md bg-[var(--surface-2)]" />
          ))}
        </div>
      </Card>
    </div>
  )
}

function goalHelper(value: number) {
  return value >= 100 ? 'Goal Met' : `${formatPercent(value)} to goal`
}

function SortButton({ option, active, direction, onClick }: {
  option: { key: SortKey; label: string }
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text)]'
      }`}
    >
      {option.label}
      {active && (direction === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
    </button>
  )
}

function MetricPanel({ label, value, helper, percent }: { label: string; value: string; helper?: string; percent?: number }) {
  const color = percent === undefined ? undefined : metricColor(percent)

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
      {percent !== undefined ? (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(percent, 0), 100)}%`, background: color }} />
          </div>
          <div className="mt-1 text-xs tabular-nums" style={{ color }}>{formatPercent(percent)} to goal</div>
        </div>
      ) : helper && (
        <div className="mt-1 text-xs text-[var(--text-secondary)]">{helper}</div>
      )}
    </div>
  )
}

function CompactStoreNumbersCapture({
  row,
  updated,
  districtAverage,
}: {
  row: RankedRow
  updated: string
  districtAverage: { netRevenuePct: number; accessoryPct: number; ppPct: number; overallScore: number } | null
}) {
  const dealer = dealerInfoForRow(row)
  const metrics = [
    ['NR', row.netRevenuePct],
    ['ACC', row.accessoryPct],
    ['PP', row.ppPct],
  ] as const
  const strongest = [...metrics].sort((a, b) => b[1] - a[1])[0]
  const weakest = [...metrics].sort((a, b) => a[1] - b[1])[0]
  const netLeft = row.netRevenueGoal - row.netRevenue
  const accLeft = row.accessoryGoal - row.accessoryRevenue
  const ppLeft = row.dortGoal - row.totalPp
  const primaryMetrics = [
    ['Net Revenue', formatMoney(row.netRevenue), formatMoney(row.netRevenueGoal), row.netRevenuePct, netLeft],
    ['Accessories', formatMoney(row.accessoryRevenue), formatMoney(row.accessoryGoal), row.accessoryPct, accLeft],
    ['Total PP', formatNumber(row.totalPp), formatNumber(row.dortGoal), row.ppPct, ppLeft],
  ] as const
  const detailMetrics = [
    ['Traffic', formatNumber(row.traffic), 'Store visits'],
    ['Post Conv', formatPercent(row.postConv), 'Conversion'],
    ['VL', formatNumber(row.vl), 'Voice lines'],
    ['BTS', formatNumber(row.bts), 'Products'],
    ['HSI', formatNumber(row.hsi), 'Internet'],
    ['VISA', formatNumber(row.visa), 'Cards'],
  ] as const

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--surface)] p-8 text-[var(--text)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="min-w-0">
          <div className="text-3xl font-black tracking-normal text-[var(--text)]">{dealer?.nickname || row.store}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span className="rounded-md bg-[var(--accent)] px-2.5 py-1 font-bold text-white">{row.storeCode}</span>
            <span className="truncate">{dealer?.location || row.store}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">Overall</div>
          <div className="text-4xl font-black tabular-nums text-[var(--text)]">{formatPercent(row.overallScore)}</div>
          <div className="mt-1 text-xs text-[var(--text-tertiary)]">Rank #{row.overallRank} · {updated || 'just now'}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {primaryMetrics.map(([label, value, goal, percent, left]) => (
          <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
            <div className="mt-2 text-2xl font-black tabular-nums text-[var(--text)]">{value}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">Goal {goal}</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(percent, 0), 100)}%`, background: metricColor(percent) }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold tabular-nums" style={{ color: metricColor(percent) }}>{formatPercent(percent)}</span>
              <span className="tabular-nums text-[var(--text-tertiary)]">{left <= 0 ? 'Over' : `${label === 'Total PP' ? formatNumber(left) : formatMoney(left)} left`}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {detailMetrics.map(([label, value, helper]) => (
          <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-center">
            <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
            <div className="mt-1 text-xl font-black tabular-nums text-[var(--text)]">{value}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{helper}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Strongest</div>
          <div className="mt-1 text-xl font-black text-[var(--text)]">{strongest[0]}</div>
          <div className="text-xs tabular-nums text-[var(--text-secondary)]">{formatPercent(strongest[1])}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Opportunity</div>
          <div className="mt-1 text-xl font-black text-[var(--text)]">{weakest[0]}</div>
          <div className="text-xs tabular-nums text-[var(--text-secondary)]">{formatPercent(weakest[1])}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Vs District</div>
          <div className="mt-1 text-xl font-black tabular-nums text-[var(--text)]">
            {districtAverage ? `${row.overallScore >= districtAverage.overallScore ? '+' : ''}${formatPercent(row.overallScore - districtAverage.overallScore)}` : '-'}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">overall score</div>
        </div>
      </div>
    </div>
  )
}

function StoreDetailDrawer({
  row,
  updated,
  districtAverage,
  onClose,
}: {
  row: RankedRow | null
  updated: string
  districtAverage: { netRevenuePct: number; accessoryPct: number; ppPct: number; overallScore: number } | null
  onClose: () => void
}) {
  const captureRef = useRef<HTMLDivElement | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [noteText, setNoteText] = useState('')
  const notes = useDistrictCoachingStore((s) => s.notes)
  const addNote = useDistrictCoachingStore((s) => s.addNote)
  const setNoteStatus = useDistrictCoachingStore((s) => s.setNoteStatus)
  const removeNote = useDistrictCoachingStore((s) => s.removeNote)
  const netLeft = row ? row.netRevenueGoal - row.netRevenue : 0
  const accLeft = row ? row.accessoryGoal - row.accessoryRevenue : 0
  const ppLeft = row ? row.dortGoal - row.totalPp : 0
  const dealer = row ? dealerInfoForRow(row) : null
  const metrics = row ? [
    ['NR', row.netRevenuePct],
    ['ACC', row.accessoryPct],
    ['PP', row.ppPct],
  ] as const : []
  const strongest = metrics.length ? [...metrics].sort((a, b) => b[1] - a[1])[0] : null
  const weakest = metrics.length ? [...metrics].sort((a, b) => a[1] - b[1])[0] : null
  const captureTitle = dealer ? `${dealer.nickname} Numbers` : 'Store Numbers'
  const storeNotes = row
    ? notes.filter((note) => normalizeStoreId(note.storeId) === normalizeStoreId(row.storeCode))
    : []
  const openNotes = storeNotes.filter((note) => note.status === 'open')

  const saveNote = () => {
    if (!row || !noteText.trim()) return
    addNote(row.storeCode, noteText)
    setNoteText('')
  }

  const copyEod = async () => {
    if (!row) return

    try {
      await copyEodToClipboard(row)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    } finally {
      window.setTimeout(() => setCopyState('idle'), 1800)
    }
  }

  const handleCapture = async () => {
    if (!captureRef.current || !row || capturing) return
    setCapturing(true)
    const captureNode = captureRef.current
    const previousCaptureStyle = captureNode.getAttribute('style')
    try {
      Object.assign(captureNode.style, {
        backgroundColor: 'var(--surface)',
        height: `${STORE_NUMBERS_CAPTURE_SIZE}px`,
        left: '0',
        opacity: '1',
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'fixed',
        top: '0',
        width: `${STORE_NUMBERS_CAPTURE_SIZE}px`,
        zIndex: '10000',
      })

      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      await new Promise((resolve) => window.requestAnimationFrame(resolve))

      const dataUrl = await toPng(captureNode, {
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.captureExclude === 'true'),
        height: STORE_NUMBERS_CAPTURE_SIZE,
        pixelRatio: Math.min(window.devicePixelRatio || 2, 3),
        width: STORE_NUMBERS_CAPTURE_SIZE,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || getComputedStyle(captureNode).backgroundColor,
      })
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const fileName = `${row.storeCode}-${captureTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: captureTitle,
          text: `${captureTitle} refreshed ${updated || 'just now'}`,
        })
        return
      }

      const link = document.createElement('a')
      link.href = dataUrl
      link.download = fileName
      link.click()
    } finally {
      if (previousCaptureStyle === null) {
        captureNode.removeAttribute('style')
      } else {
        captureNode.setAttribute('style', previousCaptureStyle)
      }
      setCapturing(false)
    }
  }

  return (
    <div className={`fixed inset-0 z-[200] ${row ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <button
        aria-label="Close store details"
        className={`absolute inset-0 bg-black/35 transition-opacity ${row ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`store-detail-drawer absolute right-0 flex w-full max-w-[520px] flex-col border-l border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-modal)] transition-transform duration-200 ${row ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {row && (
          <>
            <div
              ref={captureRef}
              className="fixed left-[-10000px] top-0 overflow-hidden bg-[var(--surface)]"
              style={{ width: STORE_NUMBERS_CAPTURE_SIZE, height: STORE_NUMBERS_CAPTURE_SIZE }}
              aria-hidden="true"
            >
              <CompactStoreNumbersCapture row={row} updated={updated} districtAverage={districtAverage} />
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-[var(--text)]">{captureTitle}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                  <Clock size={12} />
                  Source refreshed {updated || 'just now'}
                </div>
              </div>
              <div className="flex items-center gap-1" data-capture-exclude="true">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={copyEod}
                  aria-label="Copy EOD"
                  title={copyState === 'copied' ? 'Copied EOD' : copyState === 'error' ? 'Could not copy EOD' : 'Copy EOD'}
                >
                  {copyState === 'copied' ? <CheckCircle2 size={16} /> : copyState === 'error' ? <AlertCircle size={16} /> : <Copy size={16} />}
                </Button>
                <Button size="icon" variant="ghost" onClick={handleCapture} loading={capturing} aria-label="Capture store numbers">
                  <Camera size={16} />
                </Button>
                <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close store details">
                  <X size={16} />
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--surface)] p-5" data-capture-scroll="true">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="#0f7ad8">{row.storeCode}</Badge>
                <span className="text-sm font-semibold text-[var(--text)]">{dealer?.location}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RankPill rank={row.overallRank} />
                <MovementBadge movement={row.movement} />
                <GoalChip value={row.overallScore} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['VL', row.vl],
                ['BTS', row.bts],
                ['HSI', row.hsi],
                ['VISA', row.visa],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                  <div className="text-[10px] font-medium text-[var(--text-tertiary)]">{label}</div>
                  <div className="text-lg font-semibold tabular-nums text-[var(--text)]">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="text-xs uppercase text-[var(--text-tertiary)]">Strongest</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text)]">{strongest?.[0] ?? '-'}</div>
              <div className="text-xs tabular-nums text-[var(--text-secondary)]">{strongest ? formatPercent(strongest[1]) : '-'}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="text-xs uppercase text-[var(--text-tertiary)]">Opportunity</div>
              <div className="mt-1 text-lg font-semibold text-[var(--text)]">{weakest?.[0] ?? '-'}</div>
              <div className="text-xs tabular-nums text-[var(--text-secondary)]">{weakest ? formatPercent(weakest[1]) : '-'}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="text-xs uppercase text-[var(--text-tertiary)]">Vs District</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--text)]">
                {districtAverage ? `${row.overallScore >= districtAverage.overallScore ? '+' : ''}${formatPercent(row.overallScore - districtAverage.overallScore)}` : '-'}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">overall score</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricPanel label="Net Revenue" value={formatMoney(row.netRevenue)} helper={`${formatMoney(Math.max(netLeft, 0))} left`} percent={row.netRevenuePct} />
            <MetricPanel label="Accessories" value={formatMoney(row.accessoryRevenue)} helper={`${formatMoney(Math.max(accLeft, 0))} left`} percent={row.accessoryPct} />
            <MetricPanel label="Total PP" value={formatNumber(row.totalPp)} helper={`${formatNumber(Math.max(ppLeft, 0))} left`} percent={row.ppPct} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card noPadding className="overflow-hidden md:col-span-2">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <MessageSquarePlus size={14} className="text-[var(--accent)]" />
                    Coaching Notes
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">{openNotes.length} open action plan{openNotes.length === 1 ? '' : 's'}</div>
                </div>
                {!!openNotes.length && <Badge color="#c98408">{openNotes.length} open</Badge>}
              </div>
              <div className="space-y-3 p-4">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Textarea
                    label="Action Plan"
                    rows={2}
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Add the next coaching move for this store"
                  />
                  <Button size="sm" variant="primary" icon={<MessageSquarePlus size={13} />} onClick={saveNote} disabled={!noteText.trim()}>
                    Add Note
                  </Button>
                </div>

                {storeNotes.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--text-secondary)]">
                    No coaching notes yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {storeNotes.map((note) => (
                      <div key={note.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`text-sm ${note.status === 'resolved' ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text)]'}`}>{note.text}</div>
                            <div className="mt-1 text-[10px] font-medium uppercase text-[var(--text-tertiary)]">
                              {note.status} · {new Date(note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 gap-1">
                            {note.status === 'open' ? (
                              <Button size="icon" variant="ghost" onClick={() => setNoteStatus(note.id, 'resolved')} aria-label="Resolve note">
                                <CheckCircle2 size={15} />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" onClick={() => setNoteStatus(note.id, 'open')} aria-label="Reopen note">
                                <RotateCcw size={15} />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => removeNote(note.id)} aria-label="Delete note">
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card noPadding className="overflow-hidden">
              <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)]">Goal Breakdown</div>
              <div className="divide-y divide-[var(--border)]">
                {[
                  ['Traffic', formatNumber(row.traffic), 'Store visits'],
                  ['Post Conv', formatPercent(row.postConv), 'Conversion'],
                  ['NR Goal', formatMoney(row.netRevenueGoal), `${netLeft <= 0 ? formatMoney(Math.abs(netLeft)) + ' over' : formatMoney(netLeft) + ' left'}`],
                  ['ACC Goal', formatMoney(row.accessoryGoal), `${accLeft <= 0 ? formatMoney(Math.abs(accLeft)) + ' over' : formatMoney(accLeft) + ' left'}`],
                  ['DORT Goal', formatNumber(row.dortGoal), `${ppLeft <= 0 ? formatNumber(Math.abs(ppLeft)) + ' over' : formatNumber(ppLeft) + ' left'}`],
                ].map(([label, value, helper]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--text)]">{label}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{helper}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-[var(--text)]">{value}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card noPadding className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
                <Package size={14} className="text-[var(--accent)]" />
                Product Mix
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {[
                  ['Voice Lines', row.vl],
                  ['BTS', row.bts],
                  ['HSI', row.hsi],
                  ['VISA', row.visa],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

export function PerformancePage() {
  const storeId = useUiStore((s) => s.storeId)
  const coachingNotes = useDistrictCoachingStore((s) => s.notes)
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const storedSort = useMemo(() => readStoredSort(), [])
  const [sortKey, setSortKey] = useState<SortKey>(storedSort?.sortKey ?? 'overallScore')
  const [direction, setDirection] = useState<'asc' | 'desc'>(storedSort?.direction ?? 'desc')
  const [columns, setColumns] = useState<Record<OptionalColumn, boolean>>(() => readStoredColumns())
  const [viewMode, setViewMode] = useState<ViewMode>('ranking')
  const [smartFilter, setSmartFilter] = useState<SmartFilter>('all')
  const [pinnedMetrics, setPinnedMetrics] = useState<PinnedMetric[]>(() => readStoredPinnedMetrics())
  const [compareStores, setCompareStores] = useState<string[]>([])
  const [previousRanks, setPreviousRanks] = useState(() => readStoredRankSnapshot())
  const [selectedStore, setSelectedStore] = useState<RankedRow | null>(null)
  const rowRefs = useRef<Record<string, HTMLElement | null>>({})
  const mobileSearchRef = useRef<HTMLInputElement | null>(null)

  const loadData = async (background = false) => {
    if (!background) setLoading(true)
    setError('')
    try {
      setData(await fetchPerformanceData())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load performance Source')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => loadData(true), SHEET_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!mobileSearchOpen) return
    requestAnimationFrame(() => mobileSearchRef.current?.focus())
  }, [mobileSearchOpen])

  useEffect(() => {
    window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ sortKey, direction }))
  }, [direction, sortKey])

  useEffect(() => {
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columns))
  }, [columns])

  useEffect(() => {
    window.localStorage.setItem(PINNED_METRICS_KEY, JSON.stringify(pinnedMetrics))
  }, [pinnedMetrics])

  const currentStoreId = normalizeStoreId(storeId || MAIN_STORE_ID)
  const isMainDashboard = currentStoreId === MAIN_STORE_ID
  const storeRow = useMemo(() => (
    data?.rows.find((row) => normalizeStoreId(row.storeCode) === currentStoreId) ?? null
  ), [currentStoreId, data?.rows])
  const rankedRows = useMemo(() => rankRows(data?.rows ?? [], previousRanks), [data?.rows, previousRanks])
  const storeRank = useMemo(() => (
    rankedRows.find((row) => normalizeStoreId(row.storeCode) === currentStoreId)?.overallRank ?? null
  ), [currentStoreId, rankedRows])

  const districtAverage = useMemo(() => {
    if (!rankedRows.length) return null
    const sum = rankedRows.reduce((acc, row) => ({
      netRevenuePct: acc.netRevenuePct + row.netRevenuePct,
      accessoryPct: acc.accessoryPct + row.accessoryPct,
      ppPct: acc.ppPct + row.ppPct,
      overallScore: acc.overallScore + row.overallScore,
      traffic: acc.traffic + row.traffic,
    }), { netRevenuePct: 0, accessoryPct: 0, ppPct: 0, overallScore: 0, traffic: 0 })
    return {
      netRevenuePct: sum.netRevenuePct / rankedRows.length,
      accessoryPct: sum.accessoryPct / rankedRows.length,
      ppPct: sum.ppPct / rankedRows.length,
      overallScore: sum.overallScore / rankedRows.length,
      traffic: sum.traffic / rankedRows.length,
    }
  }, [rankedRows])

  useEffect(() => {
    if (!rankedRows.length) return
    const id = window.setTimeout(() => {
      const snapshot = Object.fromEntries(rankedRows.map((row) => [row.store, row.overallRank]))
      window.localStorage.setItem(RANK_SNAPSHOT_KEY, JSON.stringify(snapshot))
      setPreviousRanks(new Map(Object.entries(snapshot).map(([store, rank]) => [store, Number(rank)])))
    }, 1000)
    return () => window.clearTimeout(id)
  }, [data?.updatedAt, rankedRows])

  useEffect(() => {
    if (!selectedStore) return
    const freshRow = rankedRows.find((row) => row.store === selectedStore.store)
    if (freshRow) setSelectedStore(freshRow)
  }, [rankedRows, selectedStore])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...rankedRows]
      .filter((row) => {
        const dealer = dealerInfoForRow(row)
        const matchesQuery = !q
          || row.store.toLowerCase().includes(q)
          || row.teamName.toLowerCase().includes(q)
          || row.storeCode.toLowerCase().includes(q)
          || dealer.nickname.toLowerCase().includes(q)
          || dealer.location.toLowerCase().includes(q)
        if (!matchesQuery) return false

        if (smartFilter === 'behind') return row.netRevenuePct < 100 || row.accessoryPct < 100 || row.ppPct < 100
        if (smartFilter === 'overGoal') return row.netRevenuePct >= 100 && row.accessoryPct >= 100 && row.ppPct >= 100
        if (smartFilter === 'top5') return row.overallRank <= 5
        if (smartFilter === 'needsAcc') return row.accessoryPct < 80
        if (smartFilter === 'lowPp') return row.ppPct < 80
        if (smartFilter === 'highTraffic') return districtAverage ? row.traffic > districtAverage.traffic : false
        if (smartFilter === 'goalGap') return row.goalGapScore > 0
        return true
      })
      .sort((a, b) => {
        const result = a[sortKey] - b[sortKey]
        return direction === 'asc' ? result : -result
      })
  }, [direction, districtAverage, query, rankedRows, smartFilter, sortKey])

  const compareRows = useMemo(() => (
    compareStores
      .map((store) => rankedRows.find((row) => row.store === store))
      .filter((row): row is RankedRow => !!row)
  ), [compareStores, rankedRows])

  const openNotesByStore = useMemo(() => (
    coachingNotes.reduce((acc, note) => {
      if (note.status !== 'open') return acc
      const key = normalizeStoreId(note.storeId)
      acc.set(key, (acc.get(key) ?? 0) + 1)
      return acc
    }, new Map<string, number>())
  ), [coachingNotes])

  const todayRows = useMemo(() => {
    const current = storeRow
      ? rankedRows.find((row) => normalizeStoreId(row.storeCode) === currentStoreId)
      : null
    const needsAttention = [...rankedRows]
      .filter((row) => row.goalGapScore > 0)
      .sort((a, b) => b.goalGapScore - a.goalGapScore)
      .slice(0, 4)
    return current ? [current, ...needsAttention.filter((row) => row.store !== current.store).slice(0, 3)] : needsAttention
  }, [currentStoreId, rankedRows, storeRow])

  const insights = useMemo(() => {
    if (!rankedRows.length) return []
    const topOverall = [...rankedRows].sort((a, b) => a.overallRank - b.overallRank)[0]
    const weakestMetric = ([
      ['NR', districtAverage?.netRevenuePct ?? 0],
      ['ACC', districtAverage?.accessoryPct ?? 0],
      ['PP', districtAverage?.ppPct ?? 0],
    ] as [string, number][]).sort((a, b) => a[1] - b[1])[0]
    const closeStores = rankedRows.filter((row) => row.netRevenuePct >= 90 && row.netRevenuePct < 100).length
    const movers = rankedRows.filter((row) => row.movement !== null && row.movement > 0).length
    return [
      topOverall ? `${dealerInfoForRow(topOverall).nickname} leads overall at ${formatPercent(topOverall.overallScore)}.` : '',
      `${weakestMetric[0]} is the district opportunity at ${formatPercent(Number(weakestMetric[1]))}.`,
      closeStores ? `${closeStores} stores are within 10% of Net Revenue goal.` : 'No stores are within 10% of Net Revenue goal.',
      movers ? `${movers} stores moved up since the last refresh.` : 'No upward rank movement since the last refresh.',
    ].filter(Boolean)
  }, [districtAverage, rankedRows])

  const total = data?.total
  const focusedTotal = isMainDashboard ? total : storeRow
  const focusedDealer = storeRow ? dealerInfoForRow(storeRow) : null
  const updated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

  const setSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => current === 'desc' ? 'asc' : 'desc')
      return
    }
    setSortKey(key)
    setDirection(key === 'goalGapScore' ? 'asc' : 'desc')
  }

  const toggleColumn = (key: OptionalColumn) => {
    setColumns((current) => ({ ...current, [key]: !current[key] }))
  }

  const togglePinnedMetric = (metric: PinnedMetric) => {
    setPinnedMetrics((current) => (
      current.includes(metric)
        ? current.filter((item) => item !== metric)
        : [...current, metric]
    ))
  }

  const toggleCompareStore = (row: RankedRow) => {
    setCompareStores((current) => {
      if (current.includes(row.store)) return current.filter((store) => store !== row.store)
      return [...current, row.store].slice(-4)
    })
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: RankedRow) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedStore(row)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const index = filteredRows.findIndex((item) => item.store === row.store)
    const next = filteredRows[index + (event.key === 'ArrowDown' ? 1 : -1)]
    if (next) rowRefs.current[normalizeStoreId(next.storeCode)]?.focus()
  }

  const jumpToMyStore = () => {
    const row = rowRefs.current[currentStoreId]
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="performance-suite district-performance-page flex h-full flex-col overflow-hidden">
      <ModuleHeader
        icon={<BarChart3 size={18} />}
        eyebrow="District intelligence"
        title="District Outlook"
        description="Compare store rankings, goal gaps, and live Source performance across the district."
        meta={<span>{updated ? `Refreshed ${updated}` : 'Awaiting refresh'} · Updates every 60 seconds</span>}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="hidden min-w-0 sm:relative sm:block sm:w-64">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                className="pl-8"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search stores"
              />
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <button
                type="button"
                aria-label="Search stores"
                onClick={() => setMobileSearchOpen((open) => !open)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                  mobileSearchOpen || query
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                }`}
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                aria-label="Refresh district outlook"
                onClick={() => loadData()}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <Button className="hidden sm:inline-flex" size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={() => loadData()} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      >
        {mobileSearchOpen && (
          <div className="relative sm:hidden">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              ref={mobileSearchRef}
              className="h-10 pl-8 pr-10 text-[16px]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setMobileSearchOpen(false)
              }}
              placeholder="Search stores"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </ModuleHeader>

      <div className="performance-content flex-1 overflow-y-auto p-4">
        {error && (
          <InlineNotice className="mb-4" tone="danger" title="Performance Source could not load">
            {error} Confirm Google Cloud Services are reachable and that this device or an ad blocker is not blocking the data source.
          </InlineNotice>
        )}

        {loading && !data ? (
          <SkeletonDashboard />
        ) : (
          <div className="space-y-4">
            <div className="performance-filter-bar flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ['today', 'Today'],
                  ['ranking', 'Ranking'],
                  ['compare', `Compare ${compareRows.length ? `(${compareRows.length})` : ''}`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setViewMode(key as ViewMode)}
                    aria-pressed={viewMode === key}
                    className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
                      viewMode === key
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pin size={13} className="text-[var(--text-tertiary)]" />
                {[
                  ['overall', 'Overall'],
                  ['netRevenuePct', 'NR %'],
                  ['accessoryPct', 'ACC %'],
                  ['ppPct', 'PP %'],
                  ['traffic', 'Traffic'],
                  ['goalGap', 'Gap'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => togglePinnedMetric(key as PinnedMetric)}
                    className={`h-7 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                      pinnedMetrics.includes(key as PinnedMetric)
                        ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {pinnedMetrics.includes('overall') && (
                <SummaryTile
                  label={isMainDashboard ? 'Overall Avg' : 'Overall Rank'}
                  value={isMainDashboard ? (districtAverage ? formatPercent(districtAverage.overallScore) : '0%') : (storeRank ? `#${storeRank}` : '-')}
                  helper={focusedTotal ? `${formatPercent(focusedTotal.netRevenuePct)} NR · ${formatPercent(focusedTotal.accessoryPct)} ACC · ${formatPercent(focusedTotal.ppPct)} PP` : 'No Source row found'}
                  tone={districtAverage ? metricColor(districtAverage.overallScore) : undefined}
                />
              )}
              {pinnedMetrics.includes('netRevenuePct') && (
                <SummaryTile
                  label="Net Revenue"
                  value={focusedTotal ? formatMoney(focusedTotal.netRevenue) : '$0'}
                  helper={focusedTotal ? goalHelper(focusedTotal.netRevenuePct) : 'No Source row found'}
                  tone={focusedTotal ? metricColor(focusedTotal.netRevenuePct) : undefined}
                />
              )}
              {pinnedMetrics.includes('accessoryPct') && (
                <SummaryTile
                  label="Accessories"
                  value={focusedTotal ? formatMoney(focusedTotal.accessoryRevenue) : '$0'}
                  helper={focusedTotal ? goalHelper(focusedTotal.accessoryPct) : 'No Source row found'}
                  tone={focusedTotal ? metricColor(focusedTotal.accessoryPct) : undefined}
                />
              )}
              {pinnedMetrics.includes('ppPct') && (
                <SummaryTile
                  label="Total PP"
                  value={focusedTotal ? formatNumber(focusedTotal.totalPp) : '0'}
                  helper={focusedTotal ? goalHelper(focusedTotal.ppPct) : 'No Source row found'}
                  tone={focusedTotal ? metricColor(focusedTotal.ppPct) : undefined}
                />
              )}
              {pinnedMetrics.includes('traffic') && (
                <SummaryTile
                  label="Traffic"
                  value={focusedTotal ? formatNumber(focusedTotal.traffic) : '0'}
                  helper={focusedTotal ? `${formatPercent(focusedTotal.postConv)} post conversion` : 'No Source row found'}
                />
              )}
              {pinnedMetrics.includes('goalGap') && (
                <SummaryTile
                  label="Goal Gap"
                  value={isMainDashboard ? `${rankedRows.filter((row) => row.goalGapScore > 0).length} stores` : (storeRow ? `${formatPercent(Math.max(100 - ((storeRow.netRevenuePct + storeRow.accessoryPct + storeRow.ppPct) / 3), 0))}` : '-')}
                  helper="Remaining blended gap"
                  tone="#f7b731"
                />
              )}
            </div>

            {viewMode === 'today' && (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card noPadding className="overflow-hidden">
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Today's Focus</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Current store plus the biggest district gaps</div>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {todayRows.map((row) => {
                      const dealer = dealerInfoForRow(row)
                      return (
                        <button
                          key={row.store}
                          onClick={() => setSelectedStore(row)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--reveal-bg)]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <RankPill rank={row.overallRank} />
                              <div className="truncate text-sm font-semibold text-[var(--text)]">{dealer.nickname}</div>
                              <MovementBadge movement={row.movement} />
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-tertiary)]">{row.goalGapLabel}</div>
                          </div>
                          <GoalChip value={row.overallScore} />
                        </button>
                      )
                    })}
                  </div>
                </Card>
                <Card noPadding className="overflow-hidden">
                  <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)]">Insights</div>
                  <div className="divide-y divide-[var(--border)]">
                    {insights.map((insight) => (
                      <div key={insight} className="px-4 py-3 text-sm text-[var(--text-secondary)]">{insight}</div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {viewMode === 'compare' && (
              <Card noPadding className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">Store Comparison</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Select up to four stores from the ranking</div>
                  </div>
                  {!!compareRows.length && (
                    <Button size="sm" variant="ghost" onClick={() => setCompareStores([])}>
                      Clear
                    </Button>
                  )}
                </div>
                {compareRows.length ? (
                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                    {compareRows.map((row) => {
                      const dealer = dealerInfoForRow(row)
                      return (
                        <div key={row.store} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-[var(--text)]">{dealer.nickname}</div>
                              <div className="text-xs text-[var(--text-tertiary)]">{dealer.code}</div>
                            </div>
                            <RankPill rank={row.overallRank} />
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <GoalChip value={row.netRevenuePct} />
                            <GoalChip value={row.accessoryPct} />
                            <GoalChip value={row.ppPct} />
                          </div>
                          <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                            <div className="flex justify-between"><span>Net Rev</span><span className="font-semibold text-[var(--text)]">{formatMoney(row.netRevenue)}</span></div>
                            <div className="flex justify-between"><span>ACC</span><span className="font-semibold text-[var(--text)]">{formatMoney(row.accessoryRevenue)}</span></div>
                            <div className="flex justify-between"><span>PP</span><span className="font-semibold text-[var(--text)]">{formatNumber(row.totalPp)}</span></div>
                            <div className="flex justify-between"><span>Traffic</span><span className="font-semibold text-[var(--text)]">{formatNumber(row.traffic)}</span></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">Pick stores from the District Ranking to compare them here.</div>
                )}
              </Card>
            )}

            {!isMainDashboard && storeRow && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card noPadding className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{focusedDealer?.location ?? storeRow.store}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{storeRow.storeCode} · Same Source metrics, read-only in LunaDash</div>
                    </div>
                    <Badge color={metricColor(storeRow.netRevenuePct)}>{formatPercent(storeRow.netRevenuePct)}</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
                    <MetricPanel label="Net Rev Goal" value={formatMoney(storeRow.netRevenueGoal)} helper={`${formatMoney(Math.max(storeRow.netRevenueGoal - storeRow.netRevenue, 0))} left`} percent={storeRow.netRevenuePct} />
                    <MetricPanel label="ACC Goal" value={formatMoney(storeRow.accessoryGoal)} helper={`${formatMoney(Math.max(storeRow.accessoryGoal - storeRow.accessoryRevenue, 0))} left`} percent={storeRow.accessoryPct} />
                    <MetricPanel label="DORT Goal" value={formatNumber(storeRow.dortGoal)} helper={`${formatNumber(Math.max(storeRow.dortGoal - storeRow.totalPp, 0))} left`} percent={storeRow.ppPct} />
                  </div>
                </Card>
                <Card noPadding className="overflow-hidden">
                  <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)]">Product Mix</div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {[
                      ['VL', storeRow.vl],
                      ['BTS', storeRow.bts],
                      ['HSI', storeRow.hsi],
                      ['VISA', storeRow.visa],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                        <div className="text-[10px] font-medium text-[var(--text-tertiary)]">{label}</div>
                        <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {!isMainDashboard && !storeRow && (
              <Card>
                <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#f7b731]" />
                  <div>
                    <p className="font-semibold text-[var(--text)]">No Source row was found for store ID {currentStoreId}.</p>
                    <p className="mt-1 text-xs">Check this session’s store ID, dealer code, and the Source sheet store code. LunaDash matches against the store code in the sheet, such as 693D or 5383.</p>
                  </div>
                </div>
              </Card>
            )}

            {isMainDashboard && data?.summary && (
              <Card className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-[var(--text-tertiary)]">Net Rev Left</div>
                  <div className="text-lg font-semibold text-[var(--text)]">{data.summary.netRevenueLeft === null ? '-' : formatMoney(data.summary.netRevenueLeft)}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-tertiary)]">Acc Left</div>
                  <div className="text-lg font-semibold text-[var(--text)]">{data.summary.accessoryLeft === null ? '-' : formatMoney(data.summary.accessoryLeft)}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-tertiary)]">Post Left</div>
                  <div className="text-lg font-semibold text-[var(--text)]">{data.summary.postLeft ?? '-'}</div>
                </div>
              </Card>
            )}

            <Card noPadding className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">District Ranking</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{filteredRows.length} stores ranked by {SORT_OPTIONS.find((option) => option.key === sortKey)?.label}</div>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  <div className="flex flex-wrap gap-1.5">
                    {storeRow && (
                      <Button size="sm" variant="accent" icon={<LocateFixed size={13} />} onClick={jumpToMyStore}>
                        My Store
                      </Button>
                    )}
                    {SORT_OPTIONS.map((option) => (
                      <SortButton
                        key={option.key}
                        option={option}
                        active={sortKey === option.key}
                        direction={direction}
                        onClick={() => setSort(option.key)}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Columns3 size={13} className="text-[var(--text-tertiary)]" />
                    {[
                      ['traffic', 'Traffic'],
                      ['postConv', 'Post Conv'],
                      ['goals', 'Goals'],
                      ['products', 'Products'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => toggleColumn(key as OptionalColumn)}
                        className={`h-7 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                          columns[key as OptionalColumn]
                            ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
                            : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Filter size={13} className="text-[var(--text-tertiary)]" />
                    {[
                      ['all', 'All'],
                      ['behind', 'Behind'],
                      ['overGoal', 'Over Goal'],
                      ['top5', 'Top 5'],
                      ['needsAcc', 'Needs ACC'],
                      ['lowPp', 'Low PP'],
                      ['highTraffic', 'High Traffic'],
                      ['goalGap', 'Goal Gap'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setSmartFilter(key as SmartFilter)}
                        className={`h-7 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                          smartFilter === key
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-[var(--text)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="hidden w-full min-w-[1180px] text-left text-xs lg:table">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                    <tr>
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-4 py-2 font-medium">Compare</th>
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-4 py-2 font-medium">Overall</th>
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-4 py-2 font-medium">Store</th>
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">NR Rank</th>
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">ACC Rank</th>
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">PP Rank</th>
                      {columns.traffic && <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">Traffic</th>}
                      {columns.postConv && <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">Post Conv</th>}
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">Net Rev</th>
                      {columns.goals && <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">NR Goal</th>}
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">ACC</th>
                      {columns.goals && <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">ACC Goal</th>}
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">PP</th>
                      {columns.products && <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">VL</th>}
                      {columns.products && <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">BTS</th>}
                      {columns.products && <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">HSI</th>}
                      {columns.products && <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium">VISA</th>}
                      <th className="sticky top-0 z-10 bg-[var(--surface-2)] px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredRows.map((row) => {
                      const dealer = dealerInfoForRow(row)
                      const isCurrentStore = normalizeStoreId(row.storeCode) === currentStoreId
                      const openNoteCount = openNotesByStore.get(normalizeStoreId(row.storeCode)) ?? 0

                      return (
                      <tr
                        key={row.store}
                        ref={(element) => { rowRefs.current[normalizeStoreId(row.storeCode)] = element }}
                        className={`cursor-pointer hover:bg-[var(--reveal-bg)] ${isCurrentStore ? 'bg-[var(--accent)]/10 shadow-[inset_3px_0_0_var(--accent)]' : ''}`}
                        onClick={() => setSelectedStore(row)}
                        tabIndex={0}
                        onKeyDown={(event) => handleRowKeyDown(event, row)}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleCompareStore(row)
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition-colors ${
                              compareStores.includes(row.store)
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
                            }`}
                            aria-label={`Compare ${dealer.nickname}`}
                          >
                            {compareStores.includes(row.store) ? '✓' : '+'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <RankPill rank={row.overallRank} tone="#7c5ff5" />
                          <div className="mt-1"><MovementBadge movement={row.movement} /></div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-[var(--text)]">{dealer.nickname}</div>
                              <div className="text-[var(--text-tertiary)]">{dealer.location} | {dealer.code}</div>
                            </div>
                            {isCurrentStore && <Badge color="#7c5ff5">Mine</Badge>}
                            {openNoteCount > 0 && <Badge color="#c98408">{openNoteCount} note{openNoteCount === 1 ? '' : 's'}</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-3"><RankPill rank={row.netRevenueRank} tone="#f7b731" /></td>
                        <td className="px-3 py-3"><RankPill rank={row.accessoryRank} tone="#00b7c3" /></td>
                        <td className="px-3 py-3"><RankPill rank={row.ppRank} tone="#16c60c" /></td>
                        {columns.traffic && <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.traffic)}</td>}
                        {columns.postConv && <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatPercent(row.postConv)}</td>}
                        <td className="px-3 py-3">
                          <div className="font-semibold tabular-nums text-[var(--text)]">{formatMoney(row.netRevenue)}</div>
                          <div className="mt-1"><GoalChip value={row.netRevenuePct} /></div>
                        </td>
                        {columns.goals && <td className="px-3 py-3 tabular-nums text-[var(--text-secondary)]">{formatMoney(row.netRevenueGoal)}</td>}
                        <td className="px-3 py-3">
                          <div className="font-semibold tabular-nums text-[var(--text)]">{formatMoney(row.accessoryRevenue)}</div>
                          <div className="mt-1"><GoalChip value={row.accessoryPct} /></div>
                        </td>
                        {columns.goals && <td className="px-3 py-3 tabular-nums text-[var(--text-secondary)]">{formatMoney(row.accessoryGoal)}</td>}
                        <td className="px-3 py-3">
                          <div className="font-semibold tabular-nums text-[var(--text)]">{formatNumber(row.totalPp)}</div>
                          <div className="mt-1"><GoalChip value={row.ppPct} /></div>
                        </td>
                        {columns.products && <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.vl)}</td>}
                        {columns.products && <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.bts)}</td>}
                        {columns.products && <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.hsi)}</td>}
                        {columns.products && <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.visa)}</td>}
                        <td className="px-3 py-3 text-right text-[var(--text-tertiary)]">
                          <ChevronRight size={15} />
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>

                <div className="grid gap-2 p-3 lg:hidden">
                  {filteredRows.map((row) => {
                    const dealer = dealerInfoForRow(row)
                    const isCurrentStore = normalizeStoreId(row.storeCode) === currentStoreId
                    const openNoteCount = openNotesByStore.get(normalizeStoreId(row.storeCode)) ?? 0

                    return (
                      <div
                        key={row.store}
                        ref={(element) => { rowRefs.current[normalizeStoreId(row.storeCode)] = element }}
                        className={`rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 ${isCurrentStore ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button className="min-w-0 text-left" onClick={() => setSelectedStore(row)}>
                            <div className="flex items-center gap-2">
                              <RankPill rank={row.overallRank} />
                              <MovementBadge movement={row.movement} />
                              {isCurrentStore && <Badge color="#7c5ff5">Mine</Badge>}
                              {openNoteCount > 0 && <Badge color="#c98408">{openNoteCount} note{openNoteCount === 1 ? '' : 's'}</Badge>}
                            </div>
                            <div className="mt-2 truncate text-sm font-semibold text-[var(--text)]">{dealer.nickname}</div>
                            <div className="text-xs text-[var(--text-tertiary)]">{dealer.location} | {dealer.code}</div>
                          </button>
                          <button
                            onClick={() => toggleCompareStore(row)}
                            className={`h-8 rounded-md border px-2 text-xs font-bold transition-colors ${
                              compareStores.includes(row.store)
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)]'
                            }`}
                          >
                            {compareStores.includes(row.store) ? 'Added' : 'Compare'}
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div><div className="text-[10px] uppercase text-[var(--text-tertiary)]">NR</div><GoalChip value={row.netRevenuePct} /></div>
                          <div><div className="text-[10px] uppercase text-[var(--text-tertiary)]">ACC</div><GoalChip value={row.accessoryPct} /></div>
                          <div><div className="text-[10px] uppercase text-[var(--text-tertiary)]">PP</div><GoalChip value={row.ppPct} /></div>
                        </div>
                        <div className="mt-3 text-xs text-[var(--text-secondary)]">{row.goalGapLabel}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
      <StoreDetailDrawer row={selectedStore} updated={updated} districtAverage={districtAverage} onClose={() => setSelectedStore(null)} />
    </div>
  )
}
