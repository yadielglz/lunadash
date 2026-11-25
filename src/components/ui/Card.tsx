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
  const base = 'ui-card relative rounded-xl border transition-colors duration-150 overflow-hidden'
  const variants = {
    default:  'bg-[var(--surface)] border-[var(--border)] shadow-[var(--shadow-card)]',
    elevated: 'bg-[var(--surface)] border-[var(--border-strong)] shadow-[var(--shadow-float)]',
    glass:    'bg-[var(--surface)] border-[var(--border)] shadow-[var(--shadow-card)]',
    subtle:   'bg-[var(--surface-2)] border-[var(--border)]',
    accent:   'bg-[var(--surface)] border-[var(--accent)]/35 shadow-[var(--shadow-card)]',
  }
  const interactiveClass = interactive
    ? 'cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]/60 active:scale-[0.995]'
    : ''

  return (
    <motion.div
      className={cn(base, variants[variant], interactiveClass, !noPadding && 'p-4 sm:p-5', className)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
