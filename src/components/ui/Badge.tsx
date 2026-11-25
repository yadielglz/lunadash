import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: ReactNode
  color?: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'tmobile' | 'accent'
  variant?: 'solid' | 'soft' | 'outline' | 'glass'
  size?: 'xs' | 'sm' | 'md'
  dot?: boolean
  className?: string
}

export function Badge({
  children,
  color,
  tone,
  variant = 'soft',
  size = 'md',
  dot = false,
  className,
}: BadgeProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-md border transition-colors select-none whitespace-nowrap'
  const sizes = {
    xs: 'text-[11px] px-1.5 py-0.5 leading-tight',
    sm: 'text-xs px-2 py-0.5 leading-tight',
    md: 'text-xs px-2.5 py-1 leading-tight',
  }

  if (color) {
    const styles: Record<string, React.CSSProperties> = {
      solid:   { background: color, borderColor: color, color: '#fff' },
      soft:    { background: `${color}1a`, borderColor: `${color}38`, color },
      outline: { background: 'transparent', borderColor: `${color}66`, color },
      glass:   { background: `${color}18`, borderColor: `${color}33`, color },
    }
    return (
      <span className={cn(base, sizes[size], className)} style={styles[variant]}>
        {dot && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />}
        {children}
      </span>
    )
  }

  if (tone) {
    const tones = {
      neutral: {
        solid:   'bg-[var(--surface-3)] border-[var(--border-strong)] text-[var(--text)]',
        soft:    'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)]',
        outline: 'bg-transparent border-[var(--border)] text-[var(--text-secondary)]',
        glass:   'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)]',
        dot:     'bg-[var(--text-tertiary)]',
      },
      info: {
        solid:   'bg-[var(--status-info)] border-[var(--status-info)] text-white',
        soft:    'bg-[var(--status-info-bg)] border-[var(--status-info-border)] text-[var(--status-info-text)]',
        outline: 'bg-transparent border-[var(--status-info-border)] text-[var(--status-info-text)]',
        glass:   'bg-[var(--status-info-bg)] border-[var(--status-info-border)] text-[var(--status-info-text)]',
        dot:     'bg-[var(--status-info)]',
      },
      success: {
        solid:   'bg-[var(--status-good)] border-[var(--status-good)] text-white',
        soft:    'bg-[var(--status-good-bg)] border-[var(--status-good-border)] text-[var(--status-good-text)]',
        outline: 'bg-transparent border-[var(--status-good-border)] text-[var(--status-good-text)]',
        glass:   'bg-[var(--status-good-bg)] border-[var(--status-good-border)] text-[var(--status-good-text)]',
        dot:     'bg-[var(--status-good)]',
      },
      warning: {
        solid:   'bg-[var(--status-warn)] border-[var(--status-warn)] text-white',
        soft:    'bg-[var(--status-warn-bg)] border-[var(--status-warn-border)] text-[var(--status-warn-text)]',
        outline: 'bg-transparent border-[var(--status-warn-border)] text-[var(--status-warn-text)]',
        glass:   'bg-[var(--status-warn-bg)] border-[var(--status-warn-border)] text-[var(--status-warn-text)]',
        dot:     'bg-[var(--status-warn)]',
      },
      danger: {
        solid:   'bg-[var(--status-danger)] border-[var(--status-danger)] text-white',
        soft:    'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger-text)]',
        outline: 'bg-transparent border-[var(--status-danger-border)] text-[var(--status-danger-text)]',
        glass:   'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger-text)]',
        dot:     'bg-[var(--status-danger)]',
      },
      tmobile: {
        solid:   'bg-[#E20074] border-[#E20074] text-white',
        soft:    'bg-[#E20074]/12 border-[#E20074]/30 text-[#E20074]',
        outline: 'bg-transparent border-[#E20074]/35 text-[#E20074]',
        glass:   'bg-[#E20074]/12 border-[#E20074]/30 text-[#E20074]',
        dot:     'bg-[#E20074]',
      },
      accent: {
        solid:   'bg-[var(--accent)] border-[var(--accent)] text-white',
        soft:    'bg-[var(--accent-light)] border-[var(--accent)]/30 text-[var(--accent)]',
        outline: 'bg-transparent border-[var(--accent)]/35 text-[var(--accent)]',
        glass:   'bg-[var(--accent-light)] border-[var(--accent)]/30 text-[var(--accent)]',
        dot:     'bg-[var(--accent)]',
      },
    }
    return (
      <span className={cn(base, sizes[size], tones[tone][variant], className)}>
        {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', tones[tone].dot)} />}
        {children}
      </span>
    )
  }

  const variants = {
    solid:   'bg-[var(--accent)] border-[var(--accent)] text-white',
    soft:    'bg-[var(--accent-light)] border-[var(--accent)]/30 text-[var(--accent)]',
    outline: 'bg-transparent border-[var(--border-strong)] text-[var(--text-secondary)]',
    glass:   'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]',
  }

  return (
    <span className={cn(base, sizes[size], variants[variant], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-[var(--accent)]" />}
      {children}
    </span>
  )
}
