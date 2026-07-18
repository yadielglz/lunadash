import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Box,
  ChevronRight,
  Layers3,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'
import { useDevices } from '../../../hooks/useDevices'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

interface DeviceRow { [key: string]: string }

const BRAND_COLS = /brand|manufacturer|make/i
const MODEL_COLS = /model|product/i
const TYPE_COLS = /protection|protect|type|category|film|cover/i
const UPC_COLS = /upc|barcode|sku|item.?number|item.?id/i
const MDN_COLS = /mdn|mobile.directory|phone.number|phone|msisdn/i

type Step = 'brand' | 'model' | 'type' | 'result'

function normalize(value: string) {
  return value.trim() || 'Other'
}

function uniqueValues(rows: DeviceRow[], column: string) {
  return Array.from(new Set(rows.map((row) => normalize(row[column] ?? ''))))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function findColumn(headers: string[], preferredNames: string[], matcher: RegExp) {
  const normalizedPreferred = preferredNames.map(normalizeHeader)
  return (
    headers.find((header) => normalizedPreferred.includes(normalizeHeader(header))) ??
    headers.find((header) => matcher.test(header)) ??
    ''
  )
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'P'
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function StepPill({ active, complete, label }: { active: boolean; complete: boolean; label: string }) {
  return (
    <div
      className={`h-1.5 flex-1 rounded-full transition-colors ${
        active ? 'bg-[var(--accent)]' : complete ? 'bg-emerald-400' : 'bg-[var(--surface-3)]'
      }`}
      aria-label={label}
      aria-current={active ? 'step' : undefined}
      title={label}
    />
  )
}

function ChoiceButton({
  icon,
  title,
  subtitle,
  count,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  count?: number
  onClick: () => void
}) {
  return (
    <motion.button
      layout
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="group w-full min-h-[76px] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-3)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-[var(--text)]">{title}</div>
          <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{subtitle}</div>
        </div>
        {typeof count === 'number' && (
          <div className="rounded-full bg-[var(--reveal-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            {count}
          </div>
        )}
        <ChevronRight size={17} className="flex-shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5" />
      </div>
    </motion.button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
      <Search size={28} className="text-[var(--text-tertiary)]" />
      <p className="max-w-xs text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  )
}

function MdnList({ mdns }: { mdns: string[] }) {
  return (
    <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">Associated MDN</div>
        <div className="text-sm text-[var(--text-secondary)]">
          {plural(mdns.length, 'MDN match')} for the selected UPC.
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {mdns.map((mdn, index) => (
          <div
            key={`${mdn}-${index}`}
            className="rounded-md border border-amber-400/20 bg-black/10 px-3 py-2 font-mono text-sm text-[var(--text)]"
          >
            {mdn}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DevicesPage() {
  const { headers, allRows, totalRows, isLoading, isError, refetch, search, setSearch } = useDevices()
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedUpc, setSelectedUpc] = useState('')

  const columns = useMemo(() => ({
    brand: findColumn(headers, ['Device Brand', 'Manufacturer', 'Make', 'Brand'], BRAND_COLS),
    model: findColumn(headers, ['Device Model', 'Model', 'Product'], MODEL_COLS),
    type: findColumn(headers, ['Type', 'Protection Type', 'Protect Type'], TYPE_COLS),
    upc: findColumn(headers, ['UPC', 'Barcode', 'SKU'], UPC_COLS),
    mdn: findColumn(headers, ['MDN', 'Mobile Directory Number', 'Phone Number'], MDN_COLS),
  }), [headers])

  const brandRows = allRows
  const brands = useMemo(() => uniqueValues(brandRows, columns.brand), [brandRows, columns.brand])

  const modelRows = useMemo(() => (
    selectedBrand
      ? brandRows.filter((row) => normalize(row[columns.brand] ?? '') === selectedBrand)
      : []
  ), [brandRows, columns.brand, selectedBrand])

  const models = useMemo(() => uniqueValues(modelRows, columns.model), [modelRows, columns.model])

  const typeRows = useMemo(() => (
    selectedModel
      ? modelRows.filter((row) => normalize(row[columns.model] ?? '') === selectedModel)
      : []
  ), [modelRows, columns.model, selectedModel])

  const types = useMemo(() => uniqueValues(typeRows, columns.type), [typeRows, columns.type])

  const upcRows = useMemo(() => (
    selectedType
      ? typeRows.filter((row) => normalize(row[columns.type] ?? '') === selectedType)
      : []
  ), [columns.type, selectedType, typeRows])

  const upcs = useMemo(() => (
    columns.upc ? uniqueValues(upcRows.filter((row) => row[columns.upc]), columns.upc) : []
  ), [columns.upc, upcRows])

  const selectedUpcRows = useMemo(() => (
    selectedUpc
      ? upcRows.filter((row) => normalize(row[columns.upc] ?? '') === selectedUpc)
      : []
  ), [columns.upc, selectedUpc, upcRows])

  const mdns = useMemo(() => (
    columns.mdn ? uniqueValues(selectedUpcRows.filter((row) => row[columns.mdn]), columns.mdn) : []
  ), [columns.mdn, selectedUpcRows])

  const step: Step = selectedType ? 'result' : selectedModel ? 'type' : selectedBrand ? 'model' : 'brand'
  const stepIndex = ['brand', 'model', 'type', 'result'].indexOf(step)

  const resetFrom = (target: Step) => {
    if (target === 'brand') {
      setSelectedBrand('')
      setSelectedModel('')
      setSelectedType('')
      setSelectedUpc('')
    }
    if (target === 'model') {
      setSelectedModel('')
      setSelectedType('')
      setSelectedUpc('')
    }
    if (target === 'type') {
      setSelectedType('')
      setSelectedUpc('')
    }
  }

  const filteredBrands = brands.filter((brand) => brand.toLowerCase().includes(search.toLowerCase()))
  const filteredModels = models.filter((model) => model.toLowerCase().includes(search.toLowerCase()))
  const filteredTypes = types.filter((type) => type.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <header className="module-legacy-header border-b border-[var(--border)] bg-[var(--mica)] px-4 pb-3 pt-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                <ShieldCheck size={14} />
                Protect
              </div>
              <h1 className="truncate text-2xl font-semibold text-[var(--text)]">Protection Lookup</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {isLoading ? 'Loading catalog...' : `${totalRows} catalog rows ready`}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              title="Refresh"
              icon={<RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />}
              onClick={() => refetch()}
            >
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          <div className="flex items-center gap-1.5" aria-label="Lookup progress">
            {(['Brand', 'Device Model', 'Protection Type', 'Result'] as const).map((label, index) => (
              <StepPill key={label} label={label} active={index === stepIndex} complete={index < stepIndex} />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedBrand && (
              <button
                onClick={() => resetFrom('brand')}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--text)]"
              >
                {selectedBrand}
                <X size={13} className="text-[var(--text-tertiary)]" />
              </button>
            )}
            {selectedModel && (
              <button
                onClick={() => resetFrom('model')}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--text)]"
              >
                {selectedModel}
                <X size={13} className="text-[var(--text-tertiary)]" />
              </button>
            )}
            {selectedType && (
              <button
                onClick={() => resetFrom('type')}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--text)]"
              >
                {selectedType}
                <X size={13} className="text-[var(--text-tertiary)]" />
              </button>
            )}
          </div>

          {step !== 'result' && (
            <Input
              icon={<Search size={15} />}
              aria-label={step === 'model' ? 'Search device models' : `Search ${step}s`}
              placeholder={step === 'model' ? 'Search device models...' : `Search ${step}s...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-5xl">
          {isError && (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <PackageCheck size={34} className="text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-secondary)]">Protect catalog could not be loaded.</p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          )}

          {isLoading && (
            <div className="grid gap-3 md:grid-cols-2">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="shimmer h-[76px] rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && !isError && (
            <AnimatePresence mode="wait">
              {step === 'brand' && (
                <motion.div
                  key="brand"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid gap-3 md:grid-cols-2"
                >
                  {filteredBrands.length === 0 ? (
                    <div className="md:col-span-2">
                      <EmptyState message="No brands match the current search." />
                    </div>
                  ) : filteredBrands.map((brand) => {
                    const rows = brandRows.filter((row) => normalize(row[columns.brand] ?? '') === brand)
                    const modelCount = uniqueValues(rows, columns.model).length
                    return (
                      <ChoiceButton
                        key={brand}
                        icon={<span className="text-sm font-black">{getInitials(brand)}</span>}
                        title={brand}
                        subtitle={`${plural(modelCount, 'model')} available`}
                        count={rows.length}
                          onClick={() => {
                            setSelectedBrand(brand)
                            setSelectedModel('')
                            setSelectedType('')
                            setSelectedUpc('')
                            setSearch('')
                          }}
                        />
                    )
                  })}
                </motion.div>
              )}

              {step === 'model' && (
                <motion.div
                  key="model"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => resetFrom('brand')}>
                    Brands
                  </Button>
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredModels.length === 0 ? (
                      <div className="md:col-span-2">
                        <EmptyState message="No models match the current search." />
                      </div>
                    ) : filteredModels.map((model) => {
                      const rows = modelRows.filter((row) => normalize(row[columns.model] ?? '') === model)
                      const typeCount = uniqueValues(rows, columns.type).length
                      return (
                        <ChoiceButton
                          key={model}
                          icon={<Smartphone size={21} />}
                          title={model}
                          subtitle={`${selectedBrand} • ${plural(typeCount, 'type')}`}
                          count={rows.length}
                          onClick={() => {
                            setSelectedModel(model)
                            setSelectedType('')
                            setSelectedUpc('')
                            setSearch('')
                          }}
                        />
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {step === 'type' && (
                <motion.div
                  key="type"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => resetFrom('model')}>
                    Models
                  </Button>
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredTypes.length === 0 ? (
                      <div className="md:col-span-2">
                        <EmptyState message="No protection types match the current search." />
                      </div>
                    ) : filteredTypes.map((type) => {
                      const rows = typeRows.filter((row) => normalize(row[columns.type] ?? '') === type)
                      const upcCount = columns.upc ? uniqueValues(rows.filter((row) => row[columns.upc]), columns.upc).length : rows.length
                      return (
                        <ChoiceButton
                          key={type}
                          icon={<Layers3 size={21} />}
                          title={type}
                          subtitle={`${plural(upcCount, 'UPC')} available`}
                          count={rows.length}
                          onClick={() => {
                            setSelectedType(type)
                            setSelectedUpc('')
                            setSearch('')
                          }}
                        />
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {step === 'result' && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => resetFrom('type')}>
                    Types
                  </Button>

                  <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <div className="bg-[var(--surface-2)] px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            <ShieldCheck size={14} />
                            {plural(upcRows.length, 'match')}
                          </div>
                          <h2 className="text-2xl font-semibold text-[var(--text)]">{selectedType}</h2>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {selectedBrand} • {selectedModel}
                          </p>
                        </div>
                        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
                          <Sparkles size={25} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          <Box size={14} />
                          UPC of selected type
                        </div>
                        {upcs.length === 0 ? (
                          <div className="rounded-md bg-[var(--reveal-bg)] px-3 py-3 text-sm text-[var(--text-secondary)]">
                            No UPC is available for this selection.
                          </div>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {upcs.map((upc) => {
                              const rows = upcRows.filter((row) => normalize(row[columns.upc] ?? '') === upc)
                              const mdnCount = columns.mdn ? uniqueValues(rows.filter((row) => row[columns.mdn]), columns.mdn).length : rows.length
                              const active = selectedUpc === upc

                              return (
                                <button
                                  key={upc}
                                  onClick={() => setSelectedUpc(upc)}
                                  className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                                    active
                                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                                      : 'border-[var(--border)] bg-[var(--surface-3)] hover:border-[var(--accent)]/40'
                                  }`}
                                >
                                  <span className="font-mono text-base font-semibold text-[var(--text)]">{upc}</span>
                                  <span className="text-xs text-[var(--text-secondary)]">{plural(mdnCount, 'MDN')}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {selectedUpc && mdns.length > 0 ? (
                        <MdnList mdns={mdns} />
                      ) : selectedUpc ? (
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">
                          No MDN column/value was found for this UPC.
                        </div>
                      ) : null}
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
