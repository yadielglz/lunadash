import { motion } from 'framer-motion'
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
      className="h-full flex flex-col justify-between cursor-pointer group"
      interactive
      onClick={() => setTab('schedule')}
      style={{
        background: 'linear-gradient(135deg, rgba(0,120,212,0.12) 0%, rgba(124,95,245,0.08) 100%)',
        borderColor: 'rgba(0,120,212,0.2)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-end gap-1">
          <motion.span
            key={`${hours}${minutes}`}
            className="text-5xl font-light tabular-nums leading-none text-[var(--text)]"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
          >
            {hours}:{minutes}
          </motion.span>
          <div className="flex flex-col mb-1 ml-1">
            <span className="text-sm font-medium text-[var(--accent)] leading-none">{period}</span>
            <span className="text-xs text-[var(--text-tertiary)] tabular-nums mt-1">{seconds}s</span>
          </div>
        </div>
        <span className="text-2xl float-anim">🌙</span>
      </div>
      <div>
        <p className="text-xs text-[var(--text-secondary)]">{dateStr}</p>
      </div>
    </Card>
  )
}
