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
  const base = 'rounded-xl border transition-all duration-150'
  const variants = {
    default: 'glass',
    elevated: 'glass-strong shadow-float',
    glass: 'glass',
    accent: 'border-accent/30 bg-accent/10 backdrop-blur-mica',
  }
  const interactiveClass = interactive
    ? 'cursor-pointer hover:border-white/15 hover:shadow-float active:scale-[0.99]'
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
