import { motion } from 'framer-motion'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  size?: 'sm' | 'md'
}

export function Toggle({ checked, onChange, label, size = 'md' }: ToggleProps) {
  const dims = {
    sm: { w: 32, h: 18, dot: 12, tx: 14 },
    md: { w: 42, h: 24, dot: 16, tx: 18 },
  }
  const d = dims[size]

  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 rounded-pill border-2 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
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
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
      {label && <span className="text-sm text-[var(--text)]">{label}</span>}
    </label>
  )
}
