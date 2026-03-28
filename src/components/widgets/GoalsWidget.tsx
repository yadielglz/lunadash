import { Card } from '../ui/Card'
import { ProgressRing } from '../ui/ProgressRing'
import { useGoalsStore } from '../../store/goalsStore'
import { useUiStore } from '../../store/uiStore'

export function GoalsWidget() {
  const { goals } = useGoalsStore()
  const { setTab } = useUiStore()
  const topGoals = goals.slice(0, 3)

  const avgProgress = goals.length
    ? Math.round(goals.reduce((acc, g) => acc + (g.current / g.target) * 100, 0) / goals.length)
    : 0

  return (
    <Card
      className="h-full flex flex-col gap-3 cursor-pointer group"
      interactive
      onClick={() => setTab('goals')}
      style={{
        background: 'linear-gradient(135deg, rgba(124,95,245,0.08) 0%, rgba(0,120,212,0.06) 100%)',
        borderColor: 'rgba(124,95,245,0.2)',
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Goals</h3>
        <span className="text-xs text-[var(--text-secondary)]">{goals.length} active</span>
      </div>

      {goals.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[var(--text-tertiary)]">No goals yet</p>
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-4">
          <ProgressRing value={avgProgress} size={64} strokeWidth={6} color="var(--accent-secondary)">
            <span className="text-sm font-semibold text-[var(--text)]">{avgProgress}%</span>
          </ProgressRing>
          <div className="flex-1 min-w-0 space-y-2">
            {topGoals.map((g) => {
              const pct = Math.round((g.current / g.target) * 100)
              return (
                <div key={g.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-[var(--text-secondary)] truncate pr-2">{g.title}</span>
                    <span className="text-[11px] font-medium text-[var(--text)] flex-shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${pct}%`, background: g.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
