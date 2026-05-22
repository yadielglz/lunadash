import { Card } from '../ui/Card'
import { ProgressRing } from '../ui/ProgressRing'
import { useGoalsStore } from '../../store/goalsStore'
import { useUiStore } from '../../store/uiStore'

function isMoneyGoal(unit: string) {
  return unit.includes('$')
}

function formatGoalValue(value: number, unit: string) {
  return isMoneyGoal(unit) ? `$${value.toLocaleString()}` : `${value}${unit}`
}

export function GoalsWidget() {
  const { goals } = useGoalsStore()
  const { setTab } = useUiStore()
  const topGoals = goals.slice(0, 3)
  const today = new Date().toISOString().split('T')[0]

  const mtdProgress = goals.length
    ? Math.round(goals.reduce((acc, g) => acc + (g.target > 0 ? (g.current / g.target) * 100 : 0), 0) / goals.length)
    : 0
  const dailyDone = goals.filter((g) => ((g.dailyLog ?? {})[today] ?? 0) >= (g.dailyTarget ?? 1)).length

  return (
    <Card
      className="h-full flex flex-col gap-3 cursor-pointer group"
      interactive
      onClick={() => setTab('goals')}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Store Summary</h3>
        <span className="text-xs text-[var(--text-secondary)]">MTD goals</span>
      </div>

      {goals.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[var(--text-tertiary)]">No goals yet</p>
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-4">
          <ProgressRing value={mtdProgress} size={64} strokeWidth={6} color="var(--accent-secondary)">
            <span className="text-sm font-semibold text-[var(--text)]">{mtdProgress}%</span>
          </ProgressRing>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
              <span>Daily hit</span>
              <span className="font-semibold text-[var(--accent)]">{dailyDone}/{goals.length}</span>
            </div>
            {topGoals.map((g) => {
              const pct = g.target > 0 ? Math.min(Math.round((g.current / g.target) * 100), 100) : 0
              return (
                <div key={g.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-[var(--text-secondary)] truncate pr-2">{g.title}</span>
                    <span className="text-[11px] font-medium text-[var(--text)] flex-shrink-0">
                      {formatGoalValue(g.current, g.unit)} / {formatGoalValue(g.target, g.unit)}
                    </span>
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
