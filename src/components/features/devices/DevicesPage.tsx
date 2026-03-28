import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, RefreshCw, ChevronDown, ChevronRight, Monitor,
  Layers, LayoutList, Eye, EyeOff, Copy, Check, ShieldAlert
} from 'lucide-react'
import { useDevices } from '../../../hooks/useDevices'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

// CPNI-sensitive columns — shown masked by default, reveal on request
const CPNI_COLS   = /upc|barcode|sku|mdn|mobile.directory|phone.number|imei|serial/i

// Column role detection for hierarchy
const BRAND_COLS  = /brand|manufacturer|make/i
const MODEL_COLS  = /model|device.model|product/i
const TYPE_COLS   = /type|category|device.type|kind|class/i

interface DeviceRow { [key: string]: string }

// ── Masked CPNI field ─────────────────────────────────────────────────────────
function CpniField({ value, label }: { value: string; label: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-3)] border border-[var(--border)]">
        <ShieldAlert size={10} className="text-amber-400 flex-shrink-0" />
        <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wide">{label}</span>
        <span className="mx-1 text-[var(--border-strong)]">·</span>
        {revealed ? (
          <span className="text-xs text-[var(--text)] font-mono">{value}</span>
        ) : (
          <span className="text-xs text-[var(--text-tertiary)] tracking-widest">{'•'.repeat(Math.min(value.length, 10))}</span>
        )}
      </div>
      <button
        onClick={() => setRevealed((r) => !r)}
        title={revealed ? 'Hide' : 'Reveal'}
        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--reveal-bg)] transition-colors"
      >
        {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
      {revealed && (
        <button
          onClick={copy}
          title="Copy"
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--reveal-bg)] transition-colors"
        >
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
        </button>
      )}
    </div>
  )
}

// ── Device card — shows visible fields + CPNI masked ────────────────────────
function DeviceCard({
  row, visibleHeaders, cpniHeaders,
}: { row: DeviceRow; visibleHeaders: string[]; cpniHeaders: string[] }) {
  const shown = visibleHeaders.filter((h) => row[h])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors space-y-1.5"
    >
      {/* Visible fields */}
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          {shown.map((h) => (
            <div key={h} className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">{h}:</span>
              <span className="text-xs text-[var(--text)]">{row[h]}</span>
            </div>
          ))}
        </div>
      )}

      {/* CPNI masked fields */}
      {cpniHeaders.filter((h) => row[h]).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {cpniHeaders.filter((h) => row[h]).map((h) => (
            <CpniField key={h} value={row[h]} label={h} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ── Type group ────────────────────────────────────────────────────────────────
function TypeGroup({
  type, rows, visibleHeaders, cpniHeaders,
}: { type: string; rows: DeviceRow[]; visibleHeaders: string[]; cpniHeaders: string[] }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
      >
        <ChevronDown size={12} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className="uppercase tracking-wide">{type || 'Other'}</span>
        <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{rows.length}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-1.5 pl-4"
          >
            {rows.map((r, i) => (
              <DeviceCard key={i} row={r} visibleHeaders={visibleHeaders} cpniHeaders={cpniHeaders} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Model group ───────────────────────────────────────────────────────────────
function ModelGroup({
  model, rows, typeCol, visibleHeaders, cpniHeaders,
}: { model: string; rows: DeviceRow[]; typeCol: string; visibleHeaders: string[]; cpniHeaders: string[] }) {
  const [open, setOpen] = useState(false)

  const byType = useMemo(() => {
    const map: Record<string, DeviceRow[]> = {}
    for (const r of rows) {
      const t = typeCol ? (r[typeCol] || '') : ''
      ;(map[t] ??= []).push(r)
    }
    return map
  }, [rows, typeCol])

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-[var(--surface-2)] hover:bg-[var(--reveal-bg)] transition-colors"
      >
        <Monitor size={13} className="text-[var(--accent)] flex-shrink-0" />
        <span className="text-sm font-semibold text-[var(--text)] flex-1 text-left">{model || 'Unknown Model'}</span>
        <span className="text-xs text-[var(--text-tertiary)]">{rows.length} device{rows.length !== 1 ? 's' : ''}</span>
        <ChevronRight size={14} className={`text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-3 border-t border-[var(--border)]">
              {typeCol
                ? Object.entries(byType).map(([type, tRows]) => (
                    <TypeGroup key={type} type={type} rows={tRows} visibleHeaders={visibleHeaders} cpniHeaders={cpniHeaders} />
                  ))
                : rows.map((r, i) => (
                    <DeviceCard key={i} row={r} visibleHeaders={visibleHeaders} cpniHeaders={cpniHeaders} />
                  ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Brand section ─────────────────────────────────────────────────────────────
function BrandSection({
  brand, rows, modelCol, typeCol, visibleHeaders, cpniHeaders,
}: {
  brand: string; rows: DeviceRow[]; modelCol: string; typeCol: string;
  visibleHeaders: string[]; cpniHeaders: string[]
}) {
  const [open, setOpen] = useState(true)

  const byModel = useMemo(() => {
    const map: Record<string, DeviceRow[]> = {}
    for (const r of rows) {
      const m = modelCol ? (r[modelCol] || '') : ''
      ;(map[m] ??= []).push(r)
    }
    return map
  }, [rows, modelCol])

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 w-full group"
      >
        <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent)]/20 transition-colors">
          <span className="text-sm font-black text-[var(--accent)]">{brand.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 text-left">
          <span className="text-base font-bold text-[var(--text)]">{brand || 'Other'}</span>
          <span className="text-xs text-[var(--text-tertiary)] ml-2">
            {rows.length} device{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <ChevronDown size={16} className={`text-[var(--text-tertiary)] transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-2 pl-11"
          >
            {modelCol
              ? Object.entries(byModel).map(([model, mRows]) => (
                  <ModelGroup
                    key={model} model={model} rows={mRows}
                    typeCol={typeCol} visibleHeaders={visibleHeaders} cpniHeaders={cpniHeaders}
                  />
                ))
              : rows.map((r, i) => (
                  <DeviceCard key={i} row={r} visibleHeaders={visibleHeaders} cpniHeaders={cpniHeaders} />
                ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function DevicesPage() {
  const {
    headers, rows, allRows, totalRows, isLoading, isError, refetch,
    search, setSearch,
    page, setPage, pageSize, setPageSize, totalPages,
  } = useDevices()

  const [viewMode, setViewMode] = useState<'hierarchy' | 'list'>('hierarchy')

  // Split columns: CPNI (masked) vs visible
  const cpniHeaders    = headers.filter((h) => CPNI_COLS.test(h))
  const visibleHeaders = headers.filter((h) => !CPNI_COLS.test(h))

  // Detect structural columns from visible set
  const brandCol  = visibleHeaders.find((h) => BRAND_COLS.test(h)) ?? ''
  const modelCol  = visibleHeaders.find((h) => MODEL_COLS.test(h)) ?? ''
  const typeCol   = visibleHeaders.find((h) => TYPE_COLS.test(h)) ?? ''

  // Detail fields exclude brand/model/type (shown as section headers)
  const detailHeaders = visibleHeaders.filter((h) => h !== brandCol && h !== modelCol && h !== typeCol)

  // Hierarchy uses ALL filtered rows (not paginated)
  const byBrand = useMemo(() => {
    const map: Record<string, DeviceRow[]> = {}
    for (const r of allRows) {
      const b = brandCol ? (r[brandCol] || 'Other') : 'Devices'
      ;(map[b] ??= []).push(r)
    }
    return map
  }, [allRows, brandCol])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text)] flex items-center gap-2">
              <Monitor size={18} className="text-[var(--accent)]" />
              Device Browser
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5">
              {isLoading ? 'Loading…' : `${totalRows} devices`}
              {cpniHeaders.length > 0 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <ShieldAlert size={10} />
                  {cpniHeaders.join(', ')} hidden — reveal per device
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="ghost"
              icon={<RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setViewMode('hierarchy')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'hierarchy' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'}`}
              >
                <Layers size={12} /> Hierarchy
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'}`}
              >
                <LayoutList size={12} /> List
              </button>
            </div>
          </div>
        </div>

        <Input
          icon={<Search size={14} />}
          placeholder="Search devices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <span className="text-4xl">📡</span>
            <p className="text-sm text-[var(--text-secondary)]">Failed to load device data</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
          </div>
        )}

        {!isLoading && !isError && allRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--text-tertiary)]">
            <span className="text-4xl">🔍</span>
            <p className="text-sm">No devices match "{search}"</p>
          </div>
        )}

        {!isLoading && !isError && allRows.length > 0 && (
          viewMode === 'hierarchy' ? (
            /* Hierarchy: Brand → Model → Type — uses ALL filtered rows */
            <div className="space-y-6">
              {Object.entries(byBrand)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([brand, bRows]) => (
                  <BrandSection
                    key={brand}
                    brand={brand} rows={bRows}
                    modelCol={modelCol} typeCol={typeCol}
                    visibleHeaders={detailHeaders} cpniHeaders={cpniHeaders}
                  />
                ))}
            </div>
          ) : (
            /* List view — paginated */
            <>
              <div className="space-y-1.5">
                {rows.map((row, i) => (
                  <DeviceCard key={i} row={row} visibleHeaders={visibleHeaders} cpniHeaders={cpniHeaders} />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-[var(--border)] flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="text-xs px-2 py-1 rounded-md bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none"
                  >
                    {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalRows)} of {totalRows}</span>
                  <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</Button>
                  <span className="px-2">{page + 1} / {totalPages || 1}</span>
                  <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</Button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
