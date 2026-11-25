import { ReactNode, ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
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
  type = 'button',
  ...rest
}: ButtonProps) {
  const base = [
    'ui-button inline-flex items-center justify-center gap-2 font-medium border',
    'transition-[background-color,border-color,color,transform] duration-150 select-none cursor-pointer',
    'active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]',
  ].join(' ')

  const variants = {
    primary:   'bg-[var(--accent)] border-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)]',
    secondary: 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)]',
    ghost:     'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]',
    danger:    'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger-text)] hover:brightness-110',
    accent:    'bg-[var(--accent-light)] border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/20',
    tmobile:   'bg-[#E20074] border-[#E20074] text-white hover:bg-[#c40064] hover:border-[#c40064]',
    outline:   'bg-transparent border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--surface-2)]',
  }

  const sizes = {
    xs:        'text-xs px-2.5 h-7 rounded-md',
    sm:        'text-xs px-3 h-8 rounded-lg',
    md:        'text-sm px-3.5 h-9 rounded-lg',
    lg:        'text-sm px-5 h-11 rounded-xl font-semibold',
    icon:      'text-sm h-9 w-9 p-0 rounded-lg',
    'icon-sm': 'text-xs h-8 w-8 p-0 rounded-md',
  }

  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v3.5A4.5 4.5 0 007.5 12H4z" />
        </svg>
      ) : icon}
      {children}
    </button>
  )
}
