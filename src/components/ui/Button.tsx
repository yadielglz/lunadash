import { ReactNode, ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'tmobile' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl border transition-all duration-200 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2'

  const variants = {
    primary:   'bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_4px_14px_-2px_var(--accent-glow)] hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] hover:shadow-[0_6px_20px_-2px_var(--accent-glow)] active:scale-[0.98]',
    secondary: 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] shadow-sm hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)] hover:text-white active:scale-[0.98]',
    ghost:     'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] active:scale-[0.98]',
    danger:    'bg-rose-500/10 border-rose-500/25 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 active:scale-[0.98]',
    accent:    'bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/25 active:scale-[0.98]',
    tmobile:   'bg-[#E20074] border-[#E20074] text-white shadow-[0_4px_14px_-2px_rgba(226,0,116,0.35)] hover:bg-[#B5005D] hover:border-[#B5005D] active:scale-[0.98]',
    outline:   'bg-transparent border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)] active:scale-[0.98]',
  }

  const sizes = {
    xs:      'text-xs px-2.5 py-1 h-7 rounded-lg',
    sm:      'text-xs px-3 py-1.5 h-8.5 rounded-lg',
    md:      'text-sm px-4 py-2 h-10 rounded-xl',
    lg:      'text-base px-5 py-2.5 h-12 rounded-xl font-semibold',
    icon:    'text-sm p-2 h-10 w-10 rounded-xl',
    'icon-sm': 'text-xs p-1.5 h-8 w-8 rounded-lg',
  }

  return (
    <motion.button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
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
