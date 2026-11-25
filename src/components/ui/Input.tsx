import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  icon?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, suffix, className, ...rest }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && (
            <span className="absolute left-3 text-[var(--text-tertiary)] flex items-center pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'ui-input w-full rounded-lg border bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
              'text-sm px-3 h-10 transition-colors duration-150',
              'border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              Boolean(icon) && 'pl-9',
              Boolean(suffix) && 'pr-9',
              error && 'border-[var(--status-danger)] focus:border-[var(--status-danger)] focus:ring-[var(--status-danger)]/20',
              className
            )}
            {...rest}
          />
          {suffix && (
            <span className="absolute right-3 text-[var(--text-tertiary)] flex items-center">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs font-medium text-[var(--status-danger-text)]">{error}</p>}
        {!error && helperText && <p className="text-xs text-[var(--text-tertiary)]">{helperText}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: ReactNode
}

export function Select({ label, error, children, className, ...rest }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <select
        className={cn(
          'ui-select w-full rounded-lg border bg-[var(--input-bg)] text-[var(--text)]',
          'text-sm px-3 h-10 transition-colors duration-150 cursor-pointer',
          'border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20',
          '[&>option]:bg-[var(--surface-solid)] [&>option]:text-[var(--text)]',
          error && 'border-[var(--status-danger)] focus:border-[var(--status-danger)] focus:ring-[var(--status-danger)]/20',
          className
        )}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-xs font-medium text-[var(--status-danger-text)]">{error}</p>}
    </div>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  rows?: number
}

export function Textarea({ label, error, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={cn(
          'ui-textarea w-full rounded-lg border bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
          'text-sm px-3 py-2.5 transition-colors duration-150',
          'border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20',
          'resize-none',
          error && 'border-[var(--status-danger)] focus:border-[var(--status-danger)] focus:ring-[var(--status-danger)]/20',
          className
        )}
        {...rest}
      />
      {error && <p className="text-xs font-medium text-[var(--status-danger-text)]">{error}</p>}
    </div>
  )
}
