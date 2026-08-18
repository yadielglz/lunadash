import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'

export function PageFrame({ children, width = 'wide', className }: {
  children: ReactNode
  width?: 'standard' | 'wide' | 'full'
  className?: string
}) {
  const maxWidth = width === 'standard' ? 'max-w-5xl' : width === 'wide' ? 'max-w-7xl' : 'max-w-full'
  return <div className={cn('w-full mx-auto p-4 sm:p-6 lg:p-8', maxWidth, className)}>{children}</div>
}

export function SectionHeader({ title, description, icon, action, className }: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          {icon && <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]" aria-hidden="true">{icon}</span>}
          <h2 className="text-lg font-bold text-[var(--text)] tracking-tight">{title}</h2>
        </div>
        {description && <p className="text-xs text-[var(--text-secondary)] mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function StatusDot({ tone = 'neutral', label }: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  label: string
}) {
  const dotColor = {
    neutral: 'bg-slate-400',
    info: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]',
    success: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    warning: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
    danger: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
  }[tone]

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]">
      <span className={cn('h-2 w-2 rounded-full', dotColor)} aria-hidden="true" />
      {label}
    </span>
  )
}

type ModuleHeaderProps = {
  icon: ReactNode
  title: string
  description: ReactNode
  eyebrow?: string
  meta?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

export function ModuleHeader({ icon, title, description, eyebrow, meta, actions, children, className }: ModuleHeaderProps) {
  return (
    <header className={cn('relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface-2)] to-[var(--surface)] p-6 sm:p-7 shadow-lg backdrop-blur-xl mb-6', className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] mb-1">
              {eyebrow}
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25 shadow-sm" aria-hidden="true">
              {icon}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
              {title}
            </h1>
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed max-w-3xl">
            {description}
          </div>
          {meta && <div className="text-xs text-[var(--text-tertiary)] mt-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mt-5 pt-4 border-t border-[var(--border)]">{children}</div>}
    </header>
  )
}

type EmptyStateProps = {
  icon: ReactNode
  title: string
  description: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({ icon, title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]/40 backdrop-blur-sm p-8 sm:p-12',
      compact && 'p-4 sm:p-6',
      className
    )}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-3)] text-[var(--accent)] shadow-sm mb-3" aria-hidden="true">
        {icon}
      </div>
      <div className="max-w-md">
        <h3 className="text-base font-bold text-[var(--text)]">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{description}</p>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const noticeStyles: Record<NoticeTone, { bg: string; border: string; text: string; iconColor: string }> = {
  info: {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/25',
    text: 'text-sky-200',
    iconColor: 'text-sky-400',
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    text: 'text-emerald-200',
    iconColor: 'text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    text: 'text-amber-200',
    iconColor: 'text-amber-400',
  },
  danger: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
    text: 'text-rose-200',
    iconColor: 'text-rose-400',
  },
}

const noticeIcons: Record<NoticeTone, ReactNode> = {
  info: <Info size={18} />,
  success: <CheckCircle2 size={18} />,
  warning: <TriangleAlert size={18} />,
  danger: <AlertCircle size={18} />,
}

export function InlineNotice({ tone = 'info', title, children, action, className }: {
  tone?: NoticeTone
  title?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const style = noticeStyles[tone]

  return (
    <div
      className={cn(
        'flex items-start gap-3.5 rounded-2xl border p-4 backdrop-blur-md transition-all',
        style.bg,
        style.border,
        className
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className={cn('shrink-0 mt-0.5', style.iconColor)} aria-hidden="true">{noticeIcons[tone]}</span>
      <div className="min-w-0 flex-1">
        {title && <div className="text-sm font-bold text-[var(--text)]">{title}</div>}
        <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function ModuleSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-4 p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] animate-pulse', className)} role="status" aria-label="Loading module content">
      <div className="h-8 w-1/3 rounded-xl bg-[var(--surface-3)]" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-12 w-full rounded-xl bg-[var(--surface-3)]/60" />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function WorkflowSteps({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-2', className)} aria-label="Workflow progress">
      {steps.map((step, index) => {
        const isPast = index < current
        const isCurrent = index === current
        return (
          <li
            key={step}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              isCurrent
                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                : isPast
                ? 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]'
                : 'bg-[var(--surface-3)]/40 text-[var(--text-tertiary)] border-transparent'
            )}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', isCurrent ? 'bg-white/20 text-white' : isPast ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400')}>
              {isPast ? '✓' : index + 1}
            </span>
            <span>{step}</span>
          </li>
        )
      })}
    </ol>
  )
}
