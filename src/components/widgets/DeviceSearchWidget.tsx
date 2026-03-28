import { useState } from 'react'
import { Search, Monitor, ChevronRight } from 'lucide-react'
import { Card } from '../ui/Card'
import { useDevices } from '../../hooks/useDevices'
import { useUiStore } from '../../store/uiStore'

export function DeviceSearchWidget() {
  const [q, setQ] = useState('')
  const { headers, rows, totalRows, isLoading, setSearch, setTab: _setTab } = { ...useDevices(), setTab: useUiStore().setTab }
  const { setTab } = useUiStore()

  const handleSearch = (v: string) => {
    setQ(v)
    setSearch(v)
  }

  const preview = rows.slice(0, 3)

  return (
    <Card className="h-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Device Browser</h3>
        <button
          onClick={() => setTab('devices')}
          className="text-[10px] text-[var(--accent)] flex items-center gap-0.5 hover:underline"
        >
          View all <ChevronRight size={10} />
        </button>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setTab('devices')}
          placeholder="Search UPC or device…"
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="shimmer h-7 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {preview.length === 0 && q ? (
            <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No results found</p>
          ) : (
            <div className="flex flex-col gap-1">
              {preview.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--reveal-bg)] transition-colors cursor-pointer group"
                  onClick={() => setTab('devices')}
                >
                  <Monitor size={12} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {headers.slice(0, 2).map((h) => (
                      <span key={h} className="text-xs text-[var(--text)] truncate block">{row[h]}</span>
                    ))}
                  </div>
                </div>
              ))}
              {totalRows > 3 && (
                <p className="text-[10px] text-[var(--text-tertiary)] text-center pt-1">
                  {totalRows} total devices
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
