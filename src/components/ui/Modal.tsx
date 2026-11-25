import { ReactNode, useEffect, useId, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
  contentClassName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  ariaLabel?: string
}

export function Modal({ open, onClose, title, subtitle, children, className, contentClassName, size = 'md', ariaLabel }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [contentScrolled, setContentScrolled] = useState(false)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) {
      setContentScrolled(false)
      return
    }
    const previousFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((item) => !item.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      previousFocus?.focus()
    }
  }, [open])

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : (ariaLabel ?? 'Dialog')}
            tabIndex={-1}
            className={cn(
              'relative w-full rounded-t-2xl sm:rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-[var(--shadow-modal)] overflow-hidden flex flex-col outline-none',
              sizes[size],
              'max-h-[92dvh] sm:max-h-[86dvh]',
              className
            )}
            initial={{ y: 16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-[var(--border-strong)]" />
            </div>

            {title && (
              <div className={cn(
                'flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-[var(--border)] bg-[var(--surface)] transition-shadow',
                contentScrolled && 'shadow-sm'
              )}>
                <div className="min-w-0 pr-3">
                  <h2 id={titleId} className="text-base font-bold text-[var(--text)] tracking-tight truncate">{title}</h2>
                  {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div
              className={cn('flex-1 overflow-y-auto p-4 sm:p-5', contentClassName)}
              onScrollCapture={(event) => {
                const nextScrolled = (event.target as HTMLElement).scrollTop > 16
                setContentScrolled((current) => current === nextScrolled ? current : nextScrolled)
              }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
