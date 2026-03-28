import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: ReactNode
  color?: string
  variant?: 'solid' | 'soft' | 'outline'
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ children, color, variant = 'soft', size = 'md', className }: BadgeProps) {
  const base = 'inline-flex items-center font-medium rounded-pill border'
  const sizes = { sm: 'text-[10px] px-1.5 py-0.5', md: 'text-xs px-2 py-0.5' }

  if (color) {
    const styles: Record<string, React.CSSProperties> = {
      solid: { background: color, borderColor: color, color: '#fff' },
      soft: { background: `${color}22`, borderColor: `${color}33`, color: color },
      outline: { background: 'transparent', borderColor: `${color}66`, color: color },
    }
    return (
      <span className={cn(base, sizes[size], className)} style={styles[variant]}>
        {children}
      </span>
    )
  }

  const variants = {
    solid: 'bg-[var(--accent)] border-[var(--accent)] text-white',
    soft: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
    outline: 'bg-transparent border-[var(--border-strong)] text-[var(--text-secondary)]',
  }

  return (
    <span className={cn(base, sizes[size], variants[variant], className)}>
      {children}
    </span>
  )
}
