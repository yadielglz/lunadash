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
  className
}: BadgeProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors select-none'
  const sizes = {
    xs: 'text-[10px] px-2 py-0.5 leading-none',
    sm: 'text-xs px-2.5 py-0.5 leading-none',
    md: 'text-xs px-3 py-1 leading-none font-medium',
  }

  if (color) {
    const styles: Record<string, React.CSSProperties> = {
      solid: { background: color, borderColor: color, color: '#fff' },
      soft: { background: `${color}18`, borderColor: `${color}33`, color: color },
      outline: { background: 'transparent', borderColor: `${color}66`, color: color },
      glass: { background: `${color}15`, borderColor: `${color}30`, color: color, backdropFilter: 'blur(8px)' },
    }
    return (
      <span className={cn(base, sizes[size], className)} style={styles[variant]}>
        {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
        {children}
      </span>
    )
  }

  if (tone) {
    const tones = {
      neutral: {
        solid: 'bg-zinc-700 border-zinc-600 text-white',
        soft: 'bg-zinc-500/15 border-zinc-500/25 text-[var(--text-secondary)]',
        outline: 'bg-transparent border-[var(--border)] text-[var(--text-secondary)]',
        glass: 'bg-zinc-500/10 border-zinc-500/20 text-[var(--text-secondary)] backdrop-blur-md',
        dot: 'bg-zinc-400',
      },
      info: {
        solid: 'bg-sky-500 border-sky-500 text-white',
        soft: 'bg-sky-500/15 border-sky-500/25 text-sky-400',
        outline: 'bg-transparent border-sky-500/30 text-sky-400',
        glass: 'bg-sky-500/10 border-sky-500/20 text-sky-400 backdrop-blur-md',
        dot: 'bg-sky-400',
      },
      success: {
        solid: 'bg-emerald-500 border-emerald-500 text-white',
        soft: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
        outline: 'bg-transparent border-emerald-500/30 text-emerald-400',
        glass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 backdrop-blur-md',
        dot: 'bg-emerald-400',
      },
      warning: {
        solid: 'bg-amber-500 border-amber-500 text-white',
        soft: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
        outline: 'bg-transparent border-amber-500/30 text-amber-400',
        glass: 'bg-amber-500/10 border-amber-500/20 text-amber-400 backdrop-blur-md',
        dot: 'bg-amber-400',
      },
      danger: {
        solid: 'bg-rose-500 border-rose-500 text-white',
        soft: 'bg-rose-500/15 border-rose-500/25 text-rose-400',
        outline: 'bg-transparent border-rose-500/30 text-rose-400',
        glass: 'bg-rose-500/10 border-rose-500/20 text-rose-400 backdrop-blur-md',
        dot: 'bg-rose-400',
      },
      tmobile: {
        solid: 'bg-[#E20074] border-[#E20074] text-white',
        soft: 'bg-[#E20074]/15 border-[#E20074]/25 text-[#E20074]',
        outline: 'bg-transparent border-[#E20074]/30 text-[#E20074]',
        glass: 'bg-[#E20074]/10 border-[#E20074]/20 text-[#E20074] backdrop-blur-md',
        dot: 'bg-[#E20074]',
      },
      accent: {
        solid: 'bg-[var(--accent)] border-[var(--accent)] text-white',
        soft: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
        outline: 'bg-transparent border-[var(--accent)]/30 text-[var(--accent)]',
        glass: 'bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)] backdrop-blur-md',
        dot: 'bg-[var(--accent)]',
      },
    }
    return (
      <span className={cn(base, sizes[size], tones[tone][variant], className)}>
        {dot && <span className={cn('w-1.5 h-1.5 rounded-full', tones[tone].dot)} />}
        {children}
      </span>
    )
  }

  const variants = {
    solid: 'bg-[var(--accent)] border-[var(--accent)] text-white',
    soft: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
    outline: 'bg-transparent border-[var(--border-strong)] text-[var(--text-secondary)]',
    glass: 'bg-[var(--surface-2)]/80 border-[var(--border)] text-[var(--text)] backdrop-blur-md',
  }

  return (
    <span className={cn(base, sizes[size], variants[variant], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
      {children}
    </span>
  )
}
