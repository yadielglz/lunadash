import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'

export function PageFrame({ children, width = 'wide', className }: {
  children: ReactNode
  width?: 'standard' | 'wide' | 'full'
  className?: string
}) {
  const maxWidth = width === 'standard' ? 'max-w-5xl' : width === 'wide' ? 'max-w-7xl' : 'max-w-full'
  return <div className={cn('page-frame w-full mx-auto px-3.5 py-4 sm:px-6 sm:py-5', maxWidth, className)}>{children}</div>
}

export function SectionHeader({ title, description, icon, action, className }: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[var(--accent)]" aria-hidden="true">{icon}</span>}
          <h2 className="text-base font-bold text-[var(--text)] tracking-tight">{title}</h2>
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
    neutral: 'bg-[var(--text-tertiary)]',
    info:    'bg-[var(--status-info)]',
    success: 'bg-[var(--status-good)]',
    warning: 'bg-[var(--status-warn)]',
    danger:  'bg-[var(--status-danger)]',
  }[tone]

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]">
      <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} aria-hidden="true" />
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
  persistActionsOnCollapse?: boolean
  children?: ReactNode
  className?: string
}

export function ModuleHeader({ icon, title, description, eyebrow, meta, actions, children, className }: ModuleHeaderProps) {
  return (
    <header className={cn(
      'relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 mb-4 sm:mb-5 shadow-[var(--shadow-card)]',
      className
    )}>
      <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between md:gap-5">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)] mb-1">
              {eyebrow}
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)]" aria-hidden="true">
              {icon}
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text)] tracking-tight leading-tight">
              {title}
            </h1>
          </div>
          <div className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed max-w-3xl">
            {description}
          </div>
          {meta && <div className="overflow-x-auto text-xs text-[var(--text-tertiary)] mt-2">{meta}</div>}
        </div>
        {actions && (
          <div className="flex w-full shrink-0 items-center gap-2 overflow-x-auto pb-0.5 md:w-auto md:flex-wrap md:justify-end md:overflow-visible md:pb-0">
            {actions}
          </div>
        )}
      </div>
      {children && <div className="mt-4 pt-3.5 border-t border-[var(--border)]">{children}</div>}
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
      'flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]/50 p-6 sm:p-10',
      compact && 'p-4 sm:p-5',
      className
    )}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] mb-2.5" aria-hidden="true">
        {icon}
      </div>
      <div className="max-w-md">
        <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{description}</p>
      </div>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  )
}

type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const noticeStyles: Record<NoticeTone, { bg: string; border: string; iconColor: string }> = {
  info: {
    bg: 'bg-[var(--status-info-bg)]',
    border: 'border-[var(--status-info-border)]',
    iconColor: 'text-[var(--status-info-text)]',
  },
  success: {
    bg: 'bg-[var(--status-good-bg)]',
    border: 'border-[var(--status-good-border)]',
    iconColor: 'text-[var(--status-good-text)]',
  },
  warning: {
    bg: 'bg-[var(--status-warn-bg)]',
    border: 'border-[var(--status-warn-border)]',
    iconColor: 'text-[var(--status-warn-text)]',
  },
  danger: {
    bg: 'bg-[var(--status-danger-bg)]',
    border: 'border-[var(--status-danger-border)]',
    iconColor: 'text-[var(--status-danger-text)]',
  },
}

const noticeIcons: Record<NoticeTone, ReactNode> = {
  info: <Info size={16} />,
  success: <CheckCircle2 size={16} />,
  warning: <TriangleAlert size={16} />,
  danger: <AlertCircle size={16} />,
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
        'flex items-start gap-3 rounded-xl border p-3.5 transition-colors',
        style.bg,
        style.border,
        className
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className={cn('shrink-0 mt-0.5', style.iconColor)} aria-hidden="true">{noticeIcons[tone]}</span>
      <div className="min-w-0 flex-1">
        {title && <div className="text-sm font-semibold text-[var(--text)]">{title}</div>}
        <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function ModuleSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3 p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] animate-pulse', className)} role="status" aria-label="Loading module content">
      <div className="h-6 w-1/3 rounded-md bg-[var(--surface-3)]" />
      <div className="space-y-2 pt-1">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-10 w-full rounded-lg bg-[var(--surface-2)]" />
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
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              isCurrent
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : isPast
                ? 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]'
                : 'bg-[var(--surface)] text-[var(--text-tertiary)] border-[var(--border)]'
            )}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
              isCurrent
                ? 'bg-white/20 text-white'
                : isPast
                ? 'bg-[var(--status-good-bg)] text-[var(--status-good-text)]'
                : 'bg-[var(--surface-3)] text-[var(--text-tertiary)]'
            )}>
              {isPast ? '✓' : index + 1}
            </span>
            <span>{step}</span>
          </li>
        )
      })}
    </ol>
  )
}
