import { RectangleHorizontal, RectangleVertical } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useReportLayoutStore, type ReportOrientation } from '../../store/reportLayoutStore'

const OPTIONS: { value: ReportOrientation; label: string; icon: typeof RectangleVertical }[] = [
  { value: 'portrait', label: 'Portrait', icon: RectangleVertical },
  { value: 'landscape', label: 'Landscape', icon: RectangleHorizontal },
]

type Props = {
  /** Hide the text labels and show icons only (tight header rows). */
  compact?: boolean
  className?: string
}

/** Segmented control bound to the persisted report page orientation. */
export function OrientationToggle({ compact = false, className }: Props) {
  const orientation = useReportLayoutStore((s) => s.orientation)
  const setOrientation = useReportLayoutStore((s) => s.setOrientation)

  return (
    <div
      role="group"
      aria-label="Report page layout"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={orientation === value}
          title={`${label} report layout`}
          onClick={() => setOrientation(value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            orientation === value
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)]',
          )}
        >
          <Icon size={13} />
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  )
}
