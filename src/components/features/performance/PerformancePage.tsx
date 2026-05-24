import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, BarChart3, Clock, Package, RefreshCw, Search, Trophy } from 'lucide-react'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import {
  fetchPerformanceData,
  formatMoney,
  formatNumber,
  formatPercent,
  PerformanceData,
  PerformanceRow,
} from '../../../lib/performanceSheet'

type SortKey = 'netRevenue' | 'netRevenuePct' | 'accessoryRevenue' | 'accessoryPct' | 'totalPp' | 'ppPct' | 'traffic'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'netRevenue', label: 'Net Rev' },
  { key: 'netRevenuePct', label: 'NR %' },
  { key: 'accessoryRevenue', label: 'ACC' },
  { key: 'accessoryPct', label: 'ACC %' },
  { key: 'totalPp', label: 'PP' },
  { key: 'ppPct', label: 'PP %' },
  { key: 'traffic', label: 'Traffic' },
]

const SHEET_REFRESH_MS = 60_000

function metricColor(value: number, warning = 80) {
  if (value >= 100) return '#16c60c'
  if (value >= warning) return '#f7b731'
  return '#e74856'
}

function SummaryTile({ label, value, helper, tone }: { label: string; value: string; helper: string; tone?: string }) {
  return (
    <Card className="min-h-[108px]">
      <div className="text-xs font-medium uppercase text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)] tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        {tone && <span className="h-2 w-2 rounded-full" style={{ background: tone }} />}
        <span>{helper}</span>
      </div>
    </Card>
  )
}

function goalHelper(value: number) {
  return value >= 100 ? 'Goal Met' : `${formatPercent(value)} to goal`
}

function LeaderCard({ row, metric, value, rank }: { row: PerformanceRow; metric: string; value: string; rank: number }) {
  const rankColor = rank === 1 ? '#f7b731' : rank === 2 ? '#00b7c3' : '#7c5ff5'

  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2"
      style={{ boxShadow: `inset 3px 0 0 ${rankColor}` }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-black text-white"
        style={{ background: rankColor }}
      >
        {rank}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-[var(--text)]">{row.teamName || row.store}</span>
          <span className="flex-shrink-0 text-[10px] text-[var(--text-tertiary)]">{row.storeCode}</span>
        </div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{metric}</div>
      </div>
      <div className="text-right text-sm font-semibold tabular-nums text-[var(--text)]">{value}</div>
    </div>
  )
}

function ScoreBar({ value }: { value: number }) {
  const width = Math.min(Math.max(value, 0), 160)
  const color = metricColor(value)

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(width, 100)}%`, background: color }} />
      </div>
      <span className="w-12 text-right tabular-nums" style={{ color }}>{formatPercent(value)}</span>
    </div>
  )
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

function StoreDetailModal({ row, updated, onClose }: { row: PerformanceRow | null; updated: string; onClose: () => void }) {
  const netLeft = row ? row.netRevenueGoal - row.netRevenue : 0
  const accLeft = row ? row.accessoryGoal - row.accessoryRevenue : 0
  const ppLeft = row ? row.dortGoal - row.totalPp : 0

  return (
    <Modal open={!!row} onClose={onClose} title={row ? `${row.teamName || row.store} Numbers` : undefined} size="full">
      {row && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="#0f7ad8">{row.storeCode}</Badge>
                <span className="text-sm font-semibold text-[var(--text)]">{row.store}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                <Clock size={12} />
                Source refreshed {updated || 'just now'}
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricPanel label="Net Revenue" value={formatMoney(row.netRevenue)} helper={`${formatMoney(Math.max(netLeft, 0))} left`} percent={row.netRevenuePct} />
            <MetricPanel label="Accessories" value={formatMoney(row.accessoryRevenue)} helper={`${formatMoney(Math.max(accLeft, 0))} left`} percent={row.accessoryPct} />
            <MetricPanel label="Total PP" value={formatNumber(row.totalPp)} helper={`${formatNumber(Math.max(ppLeft, 0))} left`} percent={row.ppPct} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
      )}
    </Modal>
  )
}

export function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('netRevenue')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedStore, setSelectedStore] = useState<PerformanceRow | null>(null)

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
    if (!selectedStore) return
    const freshRow = data?.rows.find((row) => row.store === selectedStore.store)
    if (freshRow) setSelectedStore(freshRow)
  }, [data?.rows, selectedStore])

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? []
    const q = query.trim().toLowerCase()
    return [...rows]
      .filter((row) => !q || row.store.toLowerCase().includes(q) || row.teamName.toLowerCase().includes(q) || row.storeCode.toLowerCase().includes(q))
      .sort((a, b) => {
        const result = a[sortKey] - b[sortKey]
        return direction === 'asc' ? result : -result
      })
  }, [data?.rows, direction, query, sortKey])

  const leaders = useMemo(() => {
    const rows = data?.rows ?? []
    return {
      netRevenue: [...rows].sort((a, b) => b.netRevenue - a.netRevenue).slice(0, 3),
      accessories: [...rows].sort((a, b) => b.accessoryRevenue - a.accessoryRevenue).slice(0, 3),
      pp: [...rows].sort((a, b) => b.totalPp - a.totalPp).slice(0, 3),
    }
  }, [data?.rows])

  const total = data?.total
  const updated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

  const setSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => current === 'desc' ? 'asc' : 'desc')
      return
    }
    setSortKey(key)
    setDirection('desc')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text)]">
              <BarChart3 size={18} className="text-[var(--accent)]" />
              Phoenix Performance
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Source{updated ? ` · refreshed ${updated}` : ''} · auto-refreshes every 60s
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-64">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                className="pl-8"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search stores"
              />
            </div>
            <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={() => loadData()} loading={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex min-h-[360px] items-center justify-center text-sm text-[var(--text-secondary)]">
            <RefreshCw size={18} className="mr-2 animate-spin text-[var(--accent)]" />
            Loading performance Source...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile
                label="Net Revenue"
                value={total ? formatMoney(total.netRevenue) : '$0'}
                helper={total ? goalHelper(total.netRevenuePct) : 'No total row found'}
                tone={total ? metricColor(total.netRevenuePct) : undefined}
              />
              <SummaryTile
                label="Accessories"
                value={total ? formatMoney(total.accessoryRevenue) : '$0'}
                helper={total ? goalHelper(total.accessoryPct) : 'No total row found'}
                tone={total ? metricColor(total.accessoryPct) : undefined}
              />
              <SummaryTile
                label="Total PP"
                value={total ? formatNumber(total.totalPp) : '0'}
                helper={total ? goalHelper(total.ppPct) : 'No total row found'}
                tone={total ? metricColor(total.ppPct) : undefined}
              />
              <SummaryTile
                label="Traffic"
                value={total ? formatNumber(total.traffic) : '0'}
                helper={total ? `${formatPercent(total.postConv)} post conversion` : 'No total row found'}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
              <Card noPadding className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <Trophy size={15} className="text-[#f7b731]" />
                    Net Revenue Leaders
                  </div>
                  <span className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Top 3</span>
                </div>
                <div className="grid gap-1.5 p-2">
                  {leaders.netRevenue.map((row, index) => (
                    <LeaderCard key={row.store} row={row} rank={index + 1} metric="Net Revenue" value={formatMoney(row.netRevenue)} />
                  ))}
                </div>
              </Card>
              <Card noPadding className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <Trophy size={15} className="text-[#00b7c3]" />
                    Accessory Leaders
                  </div>
                  <span className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Top 3</span>
                </div>
                <div className="grid gap-1.5 p-2">
                  {leaders.accessories.map((row, index) => (
                    <LeaderCard key={row.store} row={row} rank={index + 1} metric="ACC" value={formatMoney(row.accessoryRevenue)} />
                  ))}
                </div>
              </Card>
              <Card noPadding className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <Trophy size={15} className="text-[#16c60c]" />
                    PP Leaders
                  </div>
                  <span className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Top 3</span>
                </div>
                <div className="grid gap-1.5 p-2">
                  {leaders.pp.map((row, index) => (
                    <LeaderCard key={row.store} row={row} rank={index + 1} metric="Total PP" value={formatNumber(row.totalPp)} />
                  ))}
                </div>
              </Card>
            </div>

            {data?.summary && (
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
                  <div className="text-sm font-semibold text-[var(--text)]">District Outlook</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{filteredRows.length} stores ranked by {SORT_OPTIONS.find((option) => option.key === sortKey)?.label}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
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
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Rank</th>
                      <th className="px-4 py-2 font-medium">Store</th>
                      <th className="px-3 py-2 font-medium">Traffic</th>
                      <th className="px-3 py-2 font-medium">Post Conv</th>
                      <th className="px-3 py-2 font-medium">Net Rev</th>
                      <th className="px-3 py-2 font-medium">NR Goal</th>
                      <th className="px-3 py-2 font-medium">ACC</th>
                      <th className="px-3 py-2 font-medium">ACC Goal</th>
                      <th className="px-3 py-2 font-medium">PP</th>
                      <th className="px-3 py-2 font-medium">VL</th>
                      <th className="px-3 py-2 font-medium">BTS</th>
                      <th className="px-3 py-2 font-medium">HSI</th>
                      <th className="px-3 py-2 font-medium">VISA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredRows.map((row, index) => (
                      <tr
                        key={row.store}
                        className="cursor-pointer hover:bg-[var(--reveal-bg)]"
                        onClick={() => setSelectedStore(row)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedStore(row)
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs font-bold text-[var(--text)]">
                            #{index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--text)]">{row.teamName || row.store}</div>
                          <div className="text-[var(--text-tertiary)]">{row.storeCode}</div>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.traffic)}</td>
                        <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatPercent(row.postConv)}</td>
                        <td className="px-3 py-3">
                          <div className="font-semibold tabular-nums text-[var(--text)]">{formatMoney(row.netRevenue)}</div>
                          <ScoreBar value={row.netRevenuePct} />
                        </td>
                        <td className="px-3 py-3 tabular-nums text-[var(--text-secondary)]">{formatMoney(row.netRevenueGoal)}</td>
                        <td className="px-3 py-3">
                          <div className="font-semibold tabular-nums text-[var(--text)]">{formatMoney(row.accessoryRevenue)}</div>
                          <ScoreBar value={row.accessoryPct} />
                        </td>
                        <td className="px-3 py-3 tabular-nums text-[var(--text-secondary)]">{formatMoney(row.accessoryGoal)}</td>
                        <td className="px-3 py-3">
                          <div className="font-semibold tabular-nums text-[var(--text)]">{formatNumber(row.totalPp)}</div>
                          <ScoreBar value={row.ppPct} />
                        </td>
                        <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.vl)}</td>
                        <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.bts)}</td>
                        <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.hsi)}</td>
                        <td className="px-3 py-3 tabular-nums text-[var(--text)]">{formatNumber(row.visa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
      <StoreDetailModal row={selectedStore} updated={updated} onClose={() => setSelectedStore(null)} />
    </div>
  )
}
