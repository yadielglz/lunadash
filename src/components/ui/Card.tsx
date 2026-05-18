import { motion, HTMLMotionProps } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'glass' | 'accent'
  interactive?: boolean
  noPadding?: boolean
}

export function Card({ children, className, variant = 'default', interactive = false, noPadding = false, ...rest }: CardProps) {
  const base = 'rounded-lg border transition-colors duration-150'
  const variants = {
    default: 'bg-[var(--surface)] border-[var(--border)]',
    elevated: 'bg-[var(--surface)] border-[var(--border-strong)] shadow-[var(--shadow-float)]',
    glass: 'bg-[var(--surface)] border-[var(--border)]',
    accent: 'border-[var(--accent)]/25 bg-[var(--accent)]/8',
  }
  const interactiveClass = interactive
    ? 'cursor-pointer hover:border-[var(--accent)]/35 hover:bg-[var(--surface-3)] active:scale-[0.99]'
    : ''

  return (
    <motion.div
      className={cn(base, variants[variant], interactiveClass, !noPadding && 'p-4', className)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
