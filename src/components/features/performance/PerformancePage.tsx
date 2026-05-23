import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, BarChart3, RefreshCw, Search, Trophy } from 'lucide-react'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input } from '../../ui/Input'
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

function LeaderCard({ row, metric, value, rank }: { row: PerformanceRow; metric: string; value: string; rank: number }) {
  return (
    <Card className="flex min-h-[116px] flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--text)]">{row.teamName || row.store}</div>
          <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">{row.storeCode}</div>
        </div>
        <Badge color={rank === 1 ? '#f7b731' : '#00b7c3'}>#{rank}</Badge>
      </div>
      <div>
        <div className="text-xs text-[var(--text-tertiary)]">{metric}</div>
        <div className="text-xl font-semibold text-[var(--text)] tabular-nums">{value}</div>
      </div>
    </Card>
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

export function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('netRevenue')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchPerformanceData())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load performance sheet')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
              First Google Sheet tab{updated ? ` · refreshed ${updated}` : ''}
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
            <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={loadData} loading={loading}>
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
            Loading performance sheet...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile
                label="Net Revenue"
                value={total ? formatMoney(total.netRevenue) : '$0'}
                helper={total ? `${formatPercent(total.netRevenuePct)} to goal` : 'No total row found'}
                tone={total ? metricColor(total.netRevenuePct) : undefined}
              />
              <SummaryTile
                label="Accessories"
                value={total ? formatMoney(total.accessoryRevenue) : '$0'}
                helper={total ? `${formatPercent(total.accessoryPct)} to goal` : 'No total row found'}
                tone={total ? metricColor(total.accessoryPct) : undefined}
              />
              <SummaryTile
                label="Total PP"
                value={total ? formatNumber(total.totalPp) : '0'}
                helper={total ? `${formatPercent(total.ppPct)} to goal` : 'No total row found'}
                tone={total ? metricColor(total.ppPct) : undefined}
              />
              <SummaryTile
                label="Traffic"
                value={total ? formatNumber(total.traffic) : '0'}
                helper={total ? `${formatPercent(total.postConv)} post conversion` : 'No total row found'}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <Card noPadding className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
                  <Trophy size={15} className="text-[#f7b731]" />
                  Net Revenue Leaders
                </div>
                <div className="grid gap-3 p-3">
                  {leaders.netRevenue.map((row, index) => (
                    <LeaderCard key={row.store} row={row} rank={index + 1} metric="Net Revenue" value={formatMoney(row.netRevenue)} />
                  ))}
                </div>
              </Card>
              <Card noPadding className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
                  <Trophy size={15} className="text-[#00b7c3]" />
                  Accessory Leaders
                </div>
                <div className="grid gap-3 p-3">
                  {leaders.accessories.map((row, index) => (
                    <LeaderCard key={row.store} row={row} rank={index + 1} metric="ACC" value={formatMoney(row.accessoryRevenue)} />
                  ))}
                </div>
              </Card>
              <Card noPadding className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
                  <Trophy size={15} className="text-[#16c60c]" />
                  PP Leaders
                </div>
                <div className="grid gap-3 p-3">
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
                  <div className="text-sm font-semibold text-[var(--text)]">Store Detail</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{filteredRows.length} stores</div>
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
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                    <tr>
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
                    {filteredRows.map((row) => (
                      <tr key={row.store} className="hover:bg-[var(--reveal-bg)]">
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
    </div>
  )
}
