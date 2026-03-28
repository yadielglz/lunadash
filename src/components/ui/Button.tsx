import { ReactNode, ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
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
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg border transition-all duration-150 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

  const variants = {
    primary:   'bg-[var(--accent)] border-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] active:opacity-90 shadow-sm',
    secondary: 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)] active:opacity-80',
    ghost:     'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] hover:border-[var(--border)]',
    danger:    'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30',
    accent:    'bg-[var(--accent-secondary)]/10 border-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)]/20',
  }

  const sizes = {
    sm:   'text-xs px-3 py-1.5 h-7',
    md:   'text-sm px-4 py-2 h-9',
    lg:   'text-base px-5 py-2.5 h-11',
    icon: 'text-sm p-2 h-9 w-9',
  }

  return (
    <motion.button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      {...(rest as any)}
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
