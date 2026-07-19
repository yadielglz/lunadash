import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'

export function PageFrame({ children, width = 'wide', className }: {
  children: ReactNode
  width?: 'standard' | 'wide' | 'full'
  className?: string
}) {
  return <div className={cn('page-frame', `page-frame-${width}`, className)}>{children}</div>
}

export function SectionHeader({ title, description, icon, action, className }: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('section-header', className)}>
      <div className="section-header-copy">
        <div className="section-header-title">
          {icon && <span className="section-header-icon" aria-hidden="true">{icon}</span>}
          <h2>{title}</h2>
        </div>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="section-header-action">{action}</div>}
    </div>
  )
}

export function StatusDot({ tone = 'neutral', label }: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  label: string
}) {
  return (
    <span className={cn('status-label', `status-label-${tone}`)}>
      <span className="status-label-dot" aria-hidden="true" />
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
    <header className={cn('module-header', className)}>
      <div className="module-header-main">
        <div className="module-header-copy">
          {eyebrow && <div className="module-eyebrow">{eyebrow}</div>}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="module-header-icon" aria-hidden="true">{icon}</span>
            <h1>{title}</h1>
          </div>
          <div className="module-header-description">{description}</div>
          {meta && <div className="module-header-meta">{meta}</div>}
        </div>
        {actions && <div className="module-header-actions">{actions}</div>}
      </div>
      {children && <div className="module-header-toolbar">{children}</div>}
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
    <div className={cn('module-empty-state', compact && 'module-empty-state-compact', className)}>
      <div className="module-empty-icon" aria-hidden="true">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div className="module-empty-action">{action}</div>}
    </div>
  )
}

type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

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
  return (
    <div className={cn('module-notice', `module-notice-${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="module-notice-icon" aria-hidden="true">{noticeIcons[tone]}</span>
      <div className="min-w-0 flex-1">
        {title && <div className="module-notice-title">{title}</div>}
        <div className="module-notice-copy">{children}</div>
      </div>
      {action && <div className="module-notice-action">{action}</div>}
    </div>
  )
}

export function ModuleSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('module-skeleton', className)} role="status" aria-label="Loading module content">
      <div className="module-skeleton-heading shimmer" />
      {Array.from({ length: rows }).map((_, index) => <div key={index} className="module-skeleton-row shimmer" />)}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function WorkflowSteps({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn('module-workflow-steps', className)} aria-label="Workflow progress">
      {steps.map((step, index) => {
        const state = index < current ? 'complete' : index === current ? 'current' : 'upcoming'
        return (
          <li key={step} className={`module-workflow-step module-workflow-step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="module-workflow-number">{index + 1}</span>
            <span>{step}</span>
          </li>
        )
      })}
    </ol>
  )
}
