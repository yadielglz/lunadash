import React from 'react'

export function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <span className="text-[var(--accent)] flex items-center">{icon}</span>
        <h2 className="text-sm font-bold text-[var(--text)] tracking-tight">{title}</h2>
      </div>
      <div className="space-y-2.5">
        {children}
      </div>
    </section>
  )
}

export function Row({ label, description, children, layout = 'default' }: { label: string; description?: string; children: React.ReactNode; layout?: 'default' | 'stacked' }) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)] ${layout === 'default' ? 'sm:flex-row sm:items-center sm:justify-between sm:gap-6' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        {description && <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{description}</div>}
      </div>
      <div className={layout === 'default' ? 'sm:flex-shrink-0' : 'w-full pt-0.5'}>{children}</div>
    </div>
  )
}

export function Segment<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex w-full flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 sm:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-w-[4rem] flex-1 px-3 py-1.5 text-xs font-semibold transition-colors rounded-md sm:flex-none ${
            value === o.value
              ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
