import { useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useDevices } from '../../../hooks/useDevices'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { ModuleHeader, ModuleSkeleton } from '../../ui/ModulePrimitives'

interface ProtectRow { [key: string]: string }
type Step = 'brand' | 'model' | 'type' | 'result'

const BRAND_COLS = /brand|manufacturer|make/i
const MODEL_COLS = /model|product/i
const TYPE_COLS = /protection|protect|type|category|film|cover/i
const UPC_COLS = /upc|barcode|sku|item.?number|item.?id/i
const MDN_COLS = /mdn|mobile.directory|phone.number|phone|msisdn/i

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function findColumn(headers: string[], preferred: string[], matcher: RegExp) {
  const names = preferred.map(normalizeHeader)
  return headers.find((header) => names.includes(normalizeHeader(header)))
    ?? headers.find((header) => matcher.test(header))
    ?? ''
}

function value(row: ProtectRow, column: string) {
  return row[column]?.trim() || 'Other'
}

function unique(rows: ProtectRow[], column: string) {
  if (!column) return []
  return [...new Set(rows.map((row) => value(row, column)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export function ProtectPage() {
  const { headers, allRows, totalRows, isLoading, isError, refetch } = useDevices()
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')

  const columns = useMemo(() => ({
    brand: findColumn(headers, ['Device Brand', 'Manufacturer', 'Make', 'Brand'], BRAND_COLS),
    model: findColumn(headers, ['Device Model', 'Model', 'Product'], MODEL_COLS),
    type: findColumn(headers, ['Type', 'Protection Type', 'Protect Type'], TYPE_COLS),
    upc: findColumn(headers, ['UPC', 'Barcode', 'SKU'], UPC_COLS),
    mdn: findColumn(headers, ['MDN', 'Mobile Directory Number', 'Phone Number'], MDN_COLS),
  }), [headers])

  const brandRows = allRows
  const modelRows = brand ? brandRows.filter((row) => value(row, columns.brand) === brand) : []
  const typeRows = model ? modelRows.filter((row) => value(row, columns.model) === model) : []
  const results = type ? typeRows.filter((row) => value(row, columns.type) === type) : []
  const step: Step = type ? 'result' : model ? 'type' : brand ? 'model' : 'brand'
  const choices = step === 'brand' ? unique(brandRows, columns.brand)
    : step === 'model' ? unique(modelRows, columns.model)
      : step === 'type' ? unique(typeRows, columns.type) : []
  const visibleChoices = choices.filter((choice) => choice.toLowerCase().includes(search.toLowerCase()))

  const goBack = () => {
    setSearch('')
    if (type) setType('')
    else if (model) setModel('')
    else if (brand) setBrand('')
  }

  const choose = (choice: string) => {
    setSearch('')
    if (step === 'brand') setBrand(choice)
    else if (step === 'model') setModel(choice)
    else if (step === 'type') setType(choice)
  }

  return (
    <div className="tool-suite flex h-full flex-col bg-[var(--bg)]">
      <ModuleHeader
        icon={<ShieldCheck size={18} />}
        eyebrow="Protect catalog"
        title="Protection Lookup"
        description="Find compatible protection products by brand, model, and protection type."
        meta={<span>{isLoading ? 'Loading catalog…' : `${totalRows} catalog rows ready`}</span>}
        actions={<Button size="icon" variant="ghost" title="Refresh" icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />} onClick={() => refetch()}><span className="sr-only">Refresh</span></Button>}
      />

      <div className="tool-content flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center gap-2">
            {(brand || model || type) && <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={goBack}>Back</Button>}
            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              {brand && <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5">{brand}</span>}
              {model && <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5">{model}</span>}
              {type && <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5">{type}</span>}
            </div>
          </div>

          {isLoading ? <ModuleSkeleton rows={6} /> : isError ? (
            <div className="rounded-lg border border-red-400/25 bg-red-400/10 p-5 text-sm text-red-300">Protect catalog could not be loaded.</div>
          ) : step !== 'result' ? (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${step === 'type' ? 'protection types' : `${step}s`}…`} className="pl-9" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleChoices.map((choice) => (
                  <button key={choice} onClick={() => choose(choice)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)]">
                    {choice}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((row, index) => (
                <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Compatible product</div>
                  <div className="mt-2 text-base font-semibold text-[var(--text)]">{value(row, columns.type)}</div>
                  {columns.upc && <div className="mt-3 text-sm text-[var(--text-secondary)]">UPC: <span className="font-mono text-[var(--text)]">{row[columns.upc] || '—'}</span></div>}
                  {columns.mdn && row[columns.mdn] && <div className="mt-1 text-sm text-[var(--text-secondary)]">MDN: <span className="font-mono text-[var(--text)]">{row[columns.mdn]}</span></div>}
                </div>
              ))}
              {results.length === 0 && <div className="text-sm text-[var(--text-secondary)]">No compatible products found.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
