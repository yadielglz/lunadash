import { useClock } from '../../hooks/useClock'
import { Card } from '../ui/Card'
import { useUiStore } from '../../store/uiStore'

export function ClockWidget() {
  const now = useClock()
  const { setTab } = useUiStore()

  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  const period = now.getHours() >= 12 ? 'PM' : 'AM'

  return (
    <Card
      className="h-full flex flex-col justify-between cursor-pointer group !p-5"
      interactive
      onClick={() => setTab('schedule')}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-end gap-1">
          <span className="text-7xl font-light tabular-nums leading-none text-[var(--text)]">
            {hours}:{minutes}
          </span>
          <div className="flex flex-col mb-2 ml-1.5">
            <span className="text-xl font-medium text-[var(--accent)] leading-none">{period}</span>
            <span className="text-sm text-[var(--text-tertiary)] tabular-nums mt-1">{seconds}s</span>
          </div>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Now</span>
      </div>
      <div>
        <p className="text-base text-[var(--text-secondary)]">{dateStr}</p>
      </div>
    </Card>
  )
}
