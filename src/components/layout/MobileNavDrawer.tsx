import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeDollarSign, Calendar, CalendarPlus, CheckSquare, FileText, LayoutGrid, Radar, Settings, ShieldCheck, Smartphone, Target, UploadCloud, Users, X } from 'lucide-react'
import { useUiStore, type Tab } from '../../store/uiStore'
import { canAccessTab } from '../../lib/accessControl'
import { type PerformanceRow } from '../../lib/performanceSheet'
import { fetchDashboardPerformanceData } from '../../lib/dashboardSales'
import { dealerInfoForRow } from '../../lib/dealers'
import { normalizeStoreId } from '../../lib/storeIds'
import { cn } from '../../lib/utils'

const NAV_ITEMS: { id: Tab; icon: ReactNode; label: string; employee?: boolean }[] = [
  { id: 'home', icon: <LayoutGrid size={17} />, label: 'Home' },
  { id: 'district', icon: <Radar size={17} />, label: 'District Outlook' },
  { id: 'schedule', icon: <Calendar size={17} />, label: 'Schedule' },
  { id: 'appointments', icon: <CalendarPlus size={17} />, label: 'Appointments' },
  { id: 'tasks', icon: <CheckSquare size={17} />, label: 'Checklist' },
  { id: 'protect', icon: <ShieldCheck size={17} />, label: 'Protect' },
  { id: 'devices', icon: <Smartphone size={17} />, label: 'Demo Management' },
  { id: 'goals', icon: <Target size={17} />, label: 'Goals' },
  { id: 'commission', icon: <BadgeDollarSign size={17} />, label: 'Commissions' },
  { id: 'reports', icon: <FileText size={17} />, label: 'Reports' },
  { id: 'employees', icon: <Users size={17} />, label: 'Employees', employee: true },
  { id: 'updates', icon: <UploadCloud size={17} />, label: 'Update' },
  { id: 'settings', icon: <Settings size={17} />, label: 'Settings' },
]

function score(row: PerformanceRow) {
  return (row.netRevenuePct + row.accessoryPct + row.ppPct) / 3
}

export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeTab, accessRole, setTab } = useUiStore()
  const [rows, setRows] = useState<PerformanceRow[]>([])
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    if (!open || rows.length > 0 || statsLoading) return
    setStatsLoading(true)
    fetchDashboardPerformanceData()
      .then((data) => setRows(data.rows))
      .catch(() => setRows([]))
      .finally(() => setStatsLoading(false))
  }, [open, rows.length, statsLoading])

  const topRows = useMemo(() => (
    [...rows]
      .sort((a, b) => score(b) - score(a))
      .slice(0, 3)
  ), [rows])

  const visibleItems = NAV_ITEMS.filter((item) => (
    canAccessTab(accessRole, item.id)
    && item.id !== 'display'
    && (!item.employee || accessRole !== 'employee')
  ))

  const go = (tab: Tab) => {
    setTab(tab)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="sm:hidden fixed inset-0 z-[220]">
          <motion.button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="absolute left-0 top-0 flex h-full w-[84vw] max-w-[320px] flex-col border-r border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-modal)]"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Menu</div>
                <div className="text-[10px] uppercase text-[var(--text-tertiary)]">LunaDash</div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]"
                aria-label="Close menu"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <div className="mb-4">
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Top Overall</div>
                <div className="space-y-1.5">
                  {statsLoading && [0, 1, 2].map((item) => (
                    <div key={item} className="h-10 animate-pulse rounded-md bg-[var(--surface-2)]" />
                  ))}
                  {!statsLoading && topRows.map((row, index) => {
                    const dealer = dealerInfoForRow(row)
                    return (
                      <button
                        key={row.store}
                        onClick={() => go('district')}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">{dealer.nickname}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)]">{normalizeStoreId(row.storeCode)}</div>
                        </div>
                        <div className="text-xs font-bold tabular-nums text-[var(--accent)]">#{index + 1}</div>
                      </button>
                    )
                  })}
                  {!statsLoading && topRows.length === 0 && (
                    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-tertiary)]">
                      No stats yet
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {visibleItems.map(({ id, icon, label }) => {
                  const active = activeTab === id
                  return (
                    <button
                      key={id}
                      onClick={() => go(id)}
                      className={cn(
                        'flex h-11 w-full items-center gap-3 rounded-md border px-3 text-sm font-medium transition-colors',
                        active
                          ? 'border-[var(--accent)]/30 bg-[var(--accent)]/12 text-[var(--accent)]'
                          : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
                      )}
                    >
                      {icon}
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
