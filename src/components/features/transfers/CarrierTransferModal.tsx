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
      className="h-[min(46rem,92vh)]"
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 focus-within:border-[var(--accent)]/60">
          <Search size={17} className="shrink-0 text-[var(--text-tertiary)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search carrier"
            aria-label="Search carriers"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-y-auto md:overflow-x-hidden md:pr-1">
            {filtered.map((carrier) => (
              <button
                key={carrier.id}
                type="button"
                onClick={() => setSelectedId(carrier.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors md:w-full',
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
            <article className="min-h-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
              <div className="mb-5 flex items-center gap-3 border-b border-[var(--border)] pb-4">
                <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: selected.color }} />
                <div>
                  <h3 className="text-lg font-bold text-[var(--text)]">{selected.name}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Port-out information for wireless lines</p>
                </div>
              </div>

              <div className="space-y-5">
                <GuideSection number="1" title="Find the account number" items={selected.accountNumber} />
                <GuideSection number="2" title="Get the transfer PIN" items={selected.transferPin} />

                <section className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4">
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
                  >
                    Official instructions <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </article>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/8 px-3 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
          <FileKey size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          Match the account holder name, service address, and ZIP exactly. Keep the old line active until the port completes.
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
      <ol className="ml-8 space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ol>
    </section>
  )
}

