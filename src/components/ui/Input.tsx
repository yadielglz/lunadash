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
          <label className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && (
            <span className="absolute left-3.5 text-[var(--text-tertiary)] flex items-center pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full rounded-xl border bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
              'text-sm px-4 py-2.5 h-10.5 transition-all duration-200',
              'border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25 focus:bg-[var(--surface-solid)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              icon ? 'pl-10' : '',
              suffix ? 'pr-10' : '',
              error && 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20',
              className
            )}
            {...rest}
          />
          {suffix && (
            <span className="absolute right-3.5 text-[var(--text-tertiary)] flex items-center">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs font-medium text-rose-400">{error}</p>}
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
        <label className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">
          {label}
        </label>
      )}
      <select
        className={cn(
          'w-full rounded-xl border bg-[var(--input-bg)] text-[var(--text)]',
          'text-sm px-4 py-2.5 h-10.5 transition-all duration-200 cursor-pointer',
          'border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25',
          '[&>option]:bg-[var(--surface-solid)] [&>option]:text-[var(--text)]',
          error && 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20',
          className
        )}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-xs font-medium text-rose-400">{error}</p>}
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
        <label className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={cn(
          'w-full rounded-xl border bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
          'text-sm px-4 py-3 transition-all duration-200',
          'border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25 focus:bg-[var(--surface-solid)]',
          'resize-none',
          error && 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20',
          className
        )}
        {...rest}
      />
      {error && <p className="text-xs font-medium text-rose-400">{error}</p>}
    </div>
  )
}
