import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, suffix, className, ...rest }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3 text-[var(--text-tertiary)]">{icon}</span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full rounded-lg border bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
              'text-sm px-3 py-2 h-9',
              'border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30',
              'transition-colors duration-150',
              icon ? 'pl-9' : '',
              suffix ? 'pr-9' : '',
              error && 'border-red-500/50 focus:border-red-500',
              className
            )}
            {...rest}
          />
          {suffix && (
            <span className="absolute right-3 text-[var(--text-tertiary)]">{suffix}</span>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string
  children: ReactNode
}

export function Select({ label, children, className, ...rest }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>}
      <select
        className={cn(
          'w-full rounded-lg border bg-[var(--input-bg)] text-[var(--text)]',
          'text-sm px-3 py-2 h-9',
          'border-[var(--border)] focus:border-[var(--accent)] focus:outline-none',
          '[&>option]:bg-[var(--surface-solid)]',
          className
        )}
        {...(rest as any)}
      >
        {children}
      </select>
    </div>
  )
}

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  rows?: number
}

export function Textarea({ label, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>}
      <textarea
        rows={rows}
        className={cn(
          'w-full rounded-lg border bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
          'text-sm px-3 py-2',
          'border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30',
          'resize-none transition-colors duration-150',
          className
        )}
        {...(rest as any)}
      />
    </div>
  )
}
