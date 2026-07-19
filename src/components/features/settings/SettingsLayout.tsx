import React from 'react'

export function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section space-y-3">
      <div className="settings-section-heading flex items-center gap-2 border-b border-[var(--border)] pb-1">
        <span className="settings-section-heading-icon text-[var(--accent)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function Row({ label, description, children, layout = 'default' }: { label: string; description?: string; children: React.ReactNode; layout?: 'default' | 'stacked' }) {
  return (
    <div className={`settings-row flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 transition-colors hover:border-[var(--border-strong)] ${layout === 'default' ? 'sm:flex-row sm:items-center sm:justify-between sm:gap-4' : ''}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        {description && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</div>}
      </div>
      <div className={layout === 'default' ? 'sm:flex-shrink-0' : 'w-full'}>{children}</div>
    </div>
  )
}

export function Segment<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="settings-segment flex w-full flex-wrap gap-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 sm:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-w-[4.5rem] flex-1 px-3 py-1.5 text-xs font-medium transition-all rounded-md sm:flex-none ${value === o.value ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
