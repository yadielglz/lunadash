import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'glass' | 'subtle' | 'accent'
  interactive?: boolean
  noPadding?: boolean
}

export function Card({
  children,
  className,
  variant = 'default',
  interactive = false,
  noPadding = false,
  ...rest
}: CardProps) {
  const base = 'relative rounded-2xl border transition-all duration-200 backdrop-blur-md overflow-hidden'
  const variants = {
    default: 'bg-[var(--surface)] border-[var(--border)] shadow-[var(--shadow-card)]',
    elevated: 'bg-[var(--surface)] border-[var(--border-strong)] shadow-[var(--shadow-float)]',
    glass: 'bg-[var(--surface)]/80 border-[var(--border)] shadow-[var(--shadow-card)] backdrop-blur-xl',
    subtle: 'bg-[var(--surface-2)] border-[var(--border)] shadow-sm',
    accent: 'bg-gradient-to-br from-[var(--accent)]/10 via-[var(--surface)] to-[var(--surface)] border-[var(--accent)]/30 shadow-[0_8px_24px_-8px_var(--accent-glow)]',
  }
  const interactiveClass = interactive
    ? 'cursor-pointer hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-float)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]'
    : ''

  return (
    <motion.div
      className={cn(base, variants[variant], interactiveClass, !noPadding && 'p-5 sm:p-6', className)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
