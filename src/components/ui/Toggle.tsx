import { motion } from 'framer-motion'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  size?: 'sm' | 'md'
}

export function Toggle({ checked, onChange, label, size = 'md' }: ToggleProps) {
  const dims = {
    sm: { w: 34, h: 20, dot: 14, tx: 17 },
    md: { w: 42, h: 24, dot: 18, tx: 21 },
  }
  const d = dims[size]

  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]"
        style={{
          width: d.w,
          height: d.h,
          background: checked ? 'var(--accent)' : 'var(--surface-3)',
          borderColor: checked ? 'var(--accent)' : 'var(--border-strong)',
        }}
      >
        <motion.span
          className="absolute top-0 bottom-0 my-auto rounded-full bg-white shadow-sm"
          style={{ width: d.dot, height: d.dot }}
          animate={{ left: checked ? d.tx - 2 : 2 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        />
      </button>
      {label && <span className="text-sm text-[var(--text)]">{label}</span>}
    </label>
  )
}
