import { ReactNode, ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  children, variant = 'secondary', size = 'md',
  loading, icon, className, disabled, ...rest
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-pill border transition-all duration-200 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'

  const variants = {
    primary:   'bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_10px_24px_var(--accent-glow)] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] active:translate-y-0 active:opacity-90',
    secondary: 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] shadow-[inset_0_1px_rgba(255,255,255,0.12)] hover:-translate-y-0.5 hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)] active:translate-y-0 active:opacity-80',
    ghost:     'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] hover:border-[var(--border)]',
    danger:    'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30',
    accent:    'bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/15',
  }

  const sizes = {
    sm:   'text-xs px-3.5 py-1.5 h-8',
    md:   'text-sm px-4 py-2 h-10',
    lg:   'text-base px-5 py-2.5 h-12',
    icon: 'text-sm p-2 h-10 w-10',
  }

  return (
    <motion.button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      {...rest}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      ) : icon}
      {children}
    </motion.button>
  )
}
