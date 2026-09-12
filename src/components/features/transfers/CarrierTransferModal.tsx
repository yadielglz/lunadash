import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileKey, Search, ShieldAlert } from 'lucide-react'
import { CARRIER_TRANSFER_GUIDES } from '../../../lib/carrierTransferGuides'
import { cn } from '../../../lib/utils'
import { Modal } from '../../ui/Modal'

export function CarrierTransferModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(CARRIER_TRANSFER_GUIDES[0].id)

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return CARRIER_TRANSFER_GUIDES
    return CARRIER_TRANSFER_GUIDES.filter((carrier) => (
      [carrier.name, ...carrier.aliases].join(' ').toLowerCase().includes(normalized)
    ))
  }, [query])

  useEffect(() => {
    if (filtered.length && !filtered.some((carrier) => carrier.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const selected = filtered.find((carrier) => carrier.id === selectedId) ?? filtered[0]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Carrier transfer guide"
      subtitle="Account number and number transfer PIN quick reference"
      size="xl"
      className="h-[100dvh] max-h-[100dvh] rounded-none border-x-0 border-b-0 sm:h-[min(46rem,88vh)] sm:max-h-[88vh] sm:rounded-3xl sm:border"
      contentClassName="overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6"
    >
      <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4">
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 focus-within:border-[var(--accent)]/60">
          <Search size={17} className="shrink-0 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search carrier"
            aria-label="Search carriers"
            inputMode="search"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)] sm:text-sm"
          />
        </div>

        <label className="relative md:hidden">
          <span className="sr-only">Selected carrier</span>
          <select
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={filtered.length === 0}
            className="min-h-11 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 pr-10 text-base font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]/60"
          >
            {filtered.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
            {filtered.length === 0 && <option value="">No carrier found</option>}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)]">▼</span>
        </label>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="hidden space-y-1 overflow-y-auto overflow-x-hidden pr-1 md:block">
            {filtered.map((carrier) => (
              <button
                key={carrier.id}
                type="button"
                onClick={() => setSelectedId(carrier.id)}
                className={cn(
                  'flex min-h-11 w-full shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                  selected?.id === carrier.id
                    ? 'border-[var(--accent)]/40 bg-[var(--accent)]/12 text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: carrier.color }} />
                <span className="whitespace-nowrap md:truncate">{carrier.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="w-full rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--text-secondary)]">
                No carrier found.
              </div>
            )}
          </div>

          {selected && (
            <article className="min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-5">
              <div className="mb-3 flex items-center gap-3 border-b border-[var(--border)] pb-3 sm:mb-5 sm:pb-4">
                <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: selected.color }} />
                <div>
                  <h3 className="text-lg font-bold text-[var(--text)]">{selected.name}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Port-out information for wireless lines</p>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-start gap-2 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/8 px-3 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                  <FileKey size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                  Match the account holder name, service address, and ZIP exactly. Keep the old line active until the port completes.
                </div>
                <GuideSection number="1" title="Find the account number" items={selected.accountNumber} />
                <GuideSection number="2" title="Get the transfer PIN" items={selected.transferPin} />

                <section className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 sm:p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
                    <ShieldAlert size={16} className="text-amber-500" />
                    Notes before submitting
                  </div>
                  <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {selected.notes.map((note) => <li key={note}>• {note}</li>)}
                  </ul>
                </section>

                <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--text-tertiary)]">Verified from carrier guidance · Sep 12, 2026</p>
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)] sm:min-h-0 sm:text-xs"
                  >
                    Official instructions <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </article>
          )}
        </div>

      </div>
    </Modal>
  )
}

function GuideSection({ number, title, items }: { number: string; title: string; items: string[] }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">{number}</span>
        <h4 className="text-sm font-bold text-[var(--text)]">{title}</h4>
      </div>
      <ol className="ml-8 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-[var(--text-secondary)] marker:font-semibold marker:text-[var(--accent)]">
        {items.map((item) => <li key={item} className="pl-1">{item}</li>)}
      </ol>
    </section>
  )
}
