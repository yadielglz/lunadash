import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, Plus, Check, ChevronDown, ChevronUp, Minus } from 'lucide-react'
import { useGoalsStore, Goal } from '../../../store/goalsStore'
import { ProgressRing } from '../../ui/ProgressRing'
import { Card } from '../../ui/Card'
import { Badge } from '../../ui/Badge'
import { Input } from '../../ui/Input'

const todayKey = () => new Date().toISOString().split('T')[0]

function isMoneyGoal(goal: Goal) {
  const text = `${goal.unit} ${goal.category} ${goal.title}`.toLowerCase()
  return goal.unit.includes('$') || text.includes('accessor')
}

function formatGoalValue(value: number, goal: Goal) {
  if (isMoneyGoal(goal)) return `$${value.toLocaleString()}`
  return `${value}${goal.unit}`
}

// ── Goal card ─────────────────────────────────────────────────────────────────
function GoalCard({ goal }: { goal: Goal }) {
  const { toggleMilestone, logDaily } = useGoalsStore()
  const [expanded, setExpanded] = useState(false)
  const [amount, setAmount] = useState('')

  const key        = todayKey()
  const log        = goal.dailyLog ?? {}
  const dailyTgt   = goal.dailyTarget ?? 1
  const todayVal   = log[key] ?? 0
  const dailyPct   = Math.min(Math.round((todayVal / dailyTgt) * 100), 100)
  const dailyDone  = todayVal >= dailyTgt
  const moneyGoal  = isMoneyGoal(goal)

  const step = (delta: number) => logDaily(goal.id, Math.max(0, todayVal + delta))
  const addAmount = (value: number) => step(value)
  const saveAmount = () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    addAmount(value)
    setAmount('')
  }

  return (
    <Card
        className="flex flex-col gap-0 overflow-hidden"
        style={{
          borderColor: `${goal.color}33`,
        }}
      >
        {/* Daily highlight strip */}
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ borderBottom: `1px solid ${goal.color}18` }}
        >
          {/* Today ring */}
          <ProgressRing value={dailyPct} size={58} strokeWidth={5} color={goal.color}>
            <span className="text-[10px] font-bold text-[var(--text)]">{dailyPct}%</span>
          </ProgressRing>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">{goal.title}</h3>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <Badge size="sm" color={goal.color} variant="soft">{goal.category}</Badge>
                  {dailyDone && (
                    <Badge size="sm" color="#16c60c" variant="soft">✓ Daily done!</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Today</span>
              <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => step(moneyGoal ? -25 : -1)}
                  className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] transition-colors"
                >
                  <Minus size={10} />
                </button>
                <span
                  className="text-sm font-bold px-2 tabular-nums min-w-[4ch] text-center"
                  style={{ color: goal.color }}
                >
                  {formatGoalValue(todayVal, goal)}
                </span>
                <button
                  onClick={() => step(moneyGoal ? 25 : 1)}
                  className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] transition-colors"
                >
                  <Plus size={10} />
                </button>
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">/ {formatGoalValue(dailyTgt, goal)} daily target</span>
            </div>

            {moneyGoal && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {[25, 50, 100, 250].map((value) => (
                  <button
                    key={value}
                    onClick={() => addAmount(value)}
                    className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
                  >
                    +${value}
                  </button>
                ))}
                <div className="flex items-center gap-1 w-full sm:w-auto sm:min-w-[160px]">
                  <Input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount"
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') saveAmount() }}
                    className="h-8 text-xs"
                  />
                  <button
                    onClick={saveAmount}
                    disabled={!amount}
                    className="h-8 rounded-md bg-[var(--accent)] px-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Milestones toggle */}
        {goal.milestones.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text)] transition-colors px-4 pb-2.5 self-start"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length} milestones
          </button>
        )}

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-1 border-t border-[var(--border)] px-4 py-2.5">
                {goal.milestones.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMilestone(goal.id, m.id)}
                    className="flex items-center gap-2 w-full text-left hover:bg-[var(--reveal-bg)] p-1.5 rounded-lg transition-colors"
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        m.completed ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]'
                      }`}
                    >
                      {m.completed && <Check size={9} className="text-white" />}
                    </div>
                    <span className={`text-xs ${m.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text)]'}`}>
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function GoalsPage() {
  const { goals, categories } = useGoalsStore()
  const [filterCat, setFilterCat] = useState('All')

  const key      = todayKey()
  const filtered = filterCat === 'All' ? goals : goals.filter((g) => g.category === filterCat)

  // Daily summary stats
  const dailyDone  = goals.filter((g) => ((g.dailyLog ?? {})[key] ?? 0) >= (g.dailyTarget ?? 1)).length
  const totalGoals = goals.length

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
              <h1 className="text-xl font-semibold text-[var(--text)] flex items-center gap-2">
                <Target size={18} className="text-[var(--accent)]" />
              Daily Goals
              </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Today: <span className="text-[var(--accent)] font-semibold">{dailyDone}/{totalGoals}</span> daily goals hit
              <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex gap-1.5 flex-wrap">
          {['All', ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-1 rounded-pill text-xs font-medium border transition-colors ${
                filterCat === c
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-5xl">🎯</span>
            <p className="text-sm text-[var(--text-secondary)]">No goals yet — create one in Settings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((goal, i) => (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <GoalCard goal={goal} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
