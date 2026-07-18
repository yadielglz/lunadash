import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  LayoutGrid,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  StickyNote,
  Target,
  Table2,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select, Textarea } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { EmptyState } from '../../ui/ModulePrimitives'
import { useCommissionSnapshotStore, type CommissionSnapshot } from '../../../store/commissionSnapshotStore'
import { useUiStore } from '../../../store/uiStore'
import { useScheduleStore, type Employee } from '../../../store/scheduleStore'
import { normalizeStoreId } from '../../../lib/storeIds'
import { cn } from '../../../lib/utils'
import { dbGetCommissionSnapshots } from '../../../lib/supabase'

const todayKey = () => {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

type NumberField =
  | 'commission'
  | 'commissionOpportunity'
  | 'accessories'
  | 'accessoryGoal'
  | 'revenue'
  | 'revenueGoal'
  | 'vaf'
  | 'vafGoal'
  | 'voiceLines'
  | 'voiceLinesGoal'
  | 'bts'
  | 'btsGoal'
type MetricKey = 'accessories' | 'revenue' | 'vaf' | 'voiceLines' | 'bts'
type SummaryMode = 'daily' | 'mtd' | 'need'
type EntryView = 'cards' | 'table'
type StoreGoalField = 'accessoryGoal' | 'revenueGoal' | 'vafGoal' | 'voiceLinesGoal' | 'btsGoal'
type StoreGoalDefaults = Record<StoreGoalField, number>
type SaveFieldId = string

const BOARD_METRICS: Array<{
  key: MetricKey
  goalKey: StoreGoalField
  label: string
  shortLabel: string
  money?: boolean
}> = [
  { key: 'accessories', goalKey: 'accessoryGoal', label: 'Accessory', shortLabel: 'Acc', money: true },
  { key: 'revenue', goalKey: 'revenueGoal', label: 'Revenue', shortLabel: 'Rev', money: true },
  { key: 'vaf', goalKey: 'vafGoal', label: 'VAF', shortLabel: 'VAF', money: true },
  { key: 'voiceLines', goalKey: 'voiceLinesGoal', label: 'Voice Lines', shortLabel: 'Voice' },
  { key: 'bts', goalKey: 'btsGoal', label: 'BTS', shortLabel: 'BTS' },
]

const STORE_GOAL_FIELDS = BOARD_METRICS.map((metric) => metric.goalKey)
const emptyStoreGoalDefaults: StoreGoalDefaults = {
  accessoryGoal: 0,
  revenueGoal: 0,
  vafGoal: 0,
  voiceLinesGoal: 0,
  btsGoal: 0,
}

function formatMoney(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDecimal(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatMetricValue(value: number, money?: boolean) {
  return money ? formatMoney(value) : formatDecimal(value)
}

function goalPercent(actual: number, goal: number) {
  if (!goal) return null
  return (actual / goal) * 100
}

function capturePercent(actual: number, opportunity: number) {
  if (!opportunity) return null
  return (actual / opportunity) * 100
}

function formatGoalPercent(value: number | null) {
  if (value === null) return '-'
  return `${value.toFixed(0)}%`
}

function progressTone(value: number | null) {
  if (value === null) return {
    text: 'text-[var(--text-tertiary)]',
    bar: 'bg-[var(--surface-3)]',
  }
  if (value >= 100) return {
    text: 'text-emerald-500',
    bar: 'bg-emerald-500',
  }
  if (value >= 80) return {
    text: 'text-amber-500',
    bar: 'bg-amber-500',
  }
  return {
    text: 'text-red-500',
    bar: 'bg-red-500',
  }
}

function daysInSelectedMonth(dateKey: string) {
  const [year, month] = dateKey.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

function selectedDayOfMonth(dateKey: string) {
  return Number(dateKey.slice(8, 10)) || 1
}

function remainingSellingDaysInMonth(dateKey: string) {
  const [year, month] = dateKey.split('-').map(Number)
  const daysInMonth = daysInSelectedMonth(dateKey)
  const selectedDay = selectedDayOfMonth(dateKey)
  let sellingDays = 0

  for (let day = selectedDay + 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day, 12)
    if (date.getDay() !== 0) sellingDays += 1
  }

  return Math.max(1, sellingDays)
}

function monthKey(dateKey: string) {
  return dateKey.slice(0, 7)
}

function eomDailyNeed(mtdActual: number, monthGoal: number, dateKey: string) {
  const daysLeft = remainingSellingDaysInMonth(dateKey)
  return Math.max(0, monthGoal - mtdActual) / daysLeft
}

function parseMetric(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function storeGoalDefaultsKey(storeId: string) {
  return `luna-commission-goal-defaults:${normalizeStoreId(storeId)}`
}

function normalizeStoreGoalDefaults(value: unknown): StoreGoalDefaults {
  if (!value || typeof value !== 'object') return { ...emptyStoreGoalDefaults }
  const record = value as Partial<Record<StoreGoalField, unknown>>
  return STORE_GOAL_FIELDS.reduce((defaults, field) => {
    const numberValue = Number(record[field])
    defaults[field] = Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0
    return defaults
  }, { ...emptyStoreGoalDefaults })
}

function readStoreGoalDefaults(storeId: string): StoreGoalDefaults {
  try {
    const raw = window.localStorage.getItem(storeGoalDefaultsKey(storeId))
    return normalizeStoreGoalDefaults(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...emptyStoreGoalDefaults }
  }
}

function saveStoreGoalDefaults(storeId: string, defaults: StoreGoalDefaults) {
  window.localStorage.setItem(storeGoalDefaultsKey(storeId), JSON.stringify(defaults))
}

function sortCommissionSnapshots(snapshots: CommissionSnapshot[]) {
  return [...snapshots].sort((a, b) => {
    if (a.snapshotDate !== b.snapshotDate) return b.snapshotDate.localeCompare(a.snapshotDate)
    return a.sortOrder - b.sortOrder || a.employeeName.localeCompare(b.employeeName)
  })
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDateLabel(dateKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], options ?? { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimeLabel(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '--'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function numericInputValue(snapshot: CommissionSnapshot, field: NumberField) {
  const value = snapshot[field]
  return value === 0 ? '' : String(value)
}

function saveFieldId(snapshotId: string, field: NumberField | 'notes' | 'employeeName') {
  return `${snapshotId}:${field}`
}

function focusRelativeEditor(element: HTMLElement, offset: 1 | -1) {
  const editors = Array.from(document.querySelectorAll<HTMLElement>('[data-commission-editor="true"]'))
    .filter((editor) => {
      if (editor.hasAttribute('disabled') || editor.getAttribute('aria-disabled') === 'true') return false
      const rect = editor.getBoundingClientRect()
      const style = window.getComputedStyle(editor)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
  const index = editors.indexOf(element)
  if (index === -1) return
  const next = editors[index + offset]
  if (!next) return

  requestAnimationFrame(() => {
    next.focus({ preventScroll: true })
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) next.select()
  })
}

function handleNumberEditorKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const target = event.currentTarget
  const offset = event.shiftKey ? -1 : 1
  target.blur()
  focusRelativeEditor(target, offset)
}

function handleNotesEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    event.currentTarget.blur()
  }
}

function SavedCheck({ show }: { show: boolean }) {
  if (!show) return null
  return <Check size={13} className="text-emerald-500" />
}

function ProgressBar({ value }: { value: number | null }) {
  const tone = progressTone(value)
  const width = value === null ? 0 : Math.min(100, Math.max(0, value))

  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
      <div className={cn('h-full rounded-full transition-all duration-300', tone.bar)} style={{ width: `${width}%` }} />
    </div>
  )
}

function StatusPill({ value, label }: { value: number | null; label: string }) {
  const tone = progressTone(value)

  return (
    <span className={cn(
      'inline-flex h-6 max-w-full shrink-0 items-center rounded-md border px-2 text-[11px] font-semibold tabular-nums',
      value === null
        ? 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
        : value >= 100
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
          : value >= 80
            ? 'border-amber-500/20 bg-amber-500/10 text-amber-500'
            : 'border-red-500/20 bg-red-500/10 text-red-500'
    )}>
      <span className={cn('shrink-0', tone.text)}>{formatGoalPercent(value)}</span>
      <span className="ml-1 min-w-0 truncate text-[var(--text-tertiary)]">{label}</span>
    </span>
  )
}

function MetricCardFrame({
  children,
  status,
  featured = false,
}: {
  children: React.ReactNode
  status: number | null
  featured?: boolean
}) {
  const tone = progressTone(status)

  return (
    <div className={cn(
      'relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-lg border bg-[var(--surface-solid)] p-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.08)] transition-colors sm:min-h-[128px] sm:p-3',
      featured ? 'border-[var(--accent)]/25' : 'border-[var(--border)]'
    )}>
      <div className={cn('absolute inset-x-0 top-0 h-0.5', tone.bar)} />
      {children}
    </div>
  )
}

function MetricSummary({
  icon,
  label,
  value,
  detail,
  status,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  status: number | null
}) {
  const tone = progressTone(status)

  return (
    <Card className="!rounded-lg !p-3 shadow-[inset_0_1px_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
          <div className="mt-0.5 truncate text-2xl font-semibold tabular-nums text-[var(--text)]">{value}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className={`font-semibold tabular-nums ${tone.text}`}>{formatGoalPercent(status)}</span>
            <span className="text-[var(--text-tertiary)]">{detail}</span>
          </div>
          <ProgressBar value={status} />
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
          {icon}
        </span>
      </div>
    </Card>
  )
}

function NumberEditor({
  snapshot,
  field,
  ariaLabel,
  placeholder,
  savedField,
  onUpdateNumber,
  className,
}: {
  snapshot: CommissionSnapshot
  field: NumberField
  ariaLabel: string
  placeholder: string
  savedField: SaveFieldId
  onUpdateNumber: (snapshot: CommissionSnapshot, field: NumberField, value: string, savedId: SaveFieldId) => void
  className?: string
}) {
  const fieldId = saveFieldId(snapshot.id, field)
  const saved = savedField === fieldId

  return (
    <Input
      aria-label={ariaLabel}
      data-commission-editor="true"
      inputMode="decimal"
      defaultValue={numericInputValue(snapshot, field)}
      onBlur={(event) => onUpdateNumber(snapshot, field, event.target.value, fieldId)}
      onKeyDown={handleNumberEditorKeyDown}
      className={cn(
        'h-9 text-center tabular-nums',
        saved && 'border-emerald-500/50 focus:border-emerald-500',
        className
      )}
      suffix={<SavedCheck show={saved} />}
      placeholder={placeholder}
    />
  )
}

function MetricCell({
  snapshot,
  metric,
  canEdit,
  onUpdateNumber,
  savedField,
}: {
  snapshot: CommissionSnapshot
  metric: typeof BOARD_METRICS[number]
  canEdit: boolean
  onUpdateNumber: (snapshot: CommissionSnapshot, field: NumberField, value: string, savedId: SaveFieldId) => void
  savedField: SaveFieldId
}) {
  const actual = snapshot[metric.key]
  const goal = snapshot[metric.goalKey]
  const percentToGoal = goalPercent(actual, goal)

  return (
    <MetricCardFrame status={percentToGoal}>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{metric.label}</div>
            <div className="mt-0.5 truncate text-xl font-semibold tabular-nums text-[var(--text)]">
              {formatMetricValue(actual, metric.money)}
            </div>
          </div>
          <StatusPill value={percentToGoal} label="goal" />
        </div>
        <ProgressBar value={percentToGoal} />
      </div>

      <div className="mt-3">
        {canEdit ? (
          <div>
            <div className="mb-1.5 grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
              <span>Actual</span>
              <span>Goal</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberEditor
                snapshot={snapshot}
                field={metric.key}
                ariaLabel={`${metric.label} actual`}
                placeholder="0"
                savedField={savedField}
                onUpdateNumber={onUpdateNumber}
              />
              <NumberEditor
                snapshot={snapshot}
                field={metric.goalKey}
                ariaLabel={`${metric.label} goal`}
                placeholder="0"
                savedField={savedField}
                onUpdateNumber={onUpdateNumber}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-2)] px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Goal</span>
            <span className="truncate text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
              {goal ? formatMetricValue(goal, metric.money) : '-'}
            </span>
          </div>
        )}
      </div>
    </MetricCardFrame>
  )
}

function CommissionCell({
  snapshot,
  canEdit,
  onUpdateNumber,
  savedField,
}: {
  snapshot: CommissionSnapshot
  canEdit: boolean
  onUpdateNumber: (snapshot: CommissionSnapshot, field: NumberField, value: string, savedId: SaveFieldId) => void
  savedField: SaveFieldId
}) {
  const capture = capturePercent(snapshot.commission, snapshot.commissionOpportunity)
  const missed = Math.max(0, snapshot.commissionOpportunity - snapshot.commission)

  return (
    <MetricCardFrame status={capture} featured>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase text-[var(--accent)]">Commission</div>
            <div className="mt-0.5 truncate text-xl font-semibold tabular-nums text-[var(--text)]">{formatMoney(snapshot.commission)}</div>
          </div>
          <StatusPill value={capture} label="cap" />
        </div>
        <ProgressBar value={capture} />
      </div>

      <div className="mt-3">
        {canEdit ? (
          <div>
            <div className="mb-1.5 grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
              <span>Paid</span>
              <span>Opp</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberEditor
                snapshot={snapshot}
                field="commission"
                ariaLabel="Commission actual"
                placeholder="$0"
                savedField={savedField}
                onUpdateNumber={onUpdateNumber}
              />
              <NumberEditor
                snapshot={snapshot}
                field="commissionOpportunity"
                ariaLabel="Commission opportunity"
                placeholder="$0"
                savedField={savedField}
                onUpdateNumber={onUpdateNumber}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[var(--surface-2)] px-2 py-1.5">
              <span className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Open</span>
              <span className="truncate text-xs font-semibold tabular-nums text-[var(--text-secondary)]">{missed ? formatMoney(missed) : '-'}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-[var(--surface-2)] px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Opp</div>
              <div className="truncate text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                {snapshot.commissionOpportunity ? formatMoney(snapshot.commissionOpportunity) : '-'}
              </div>
            </div>
            <div className="rounded-md bg-[var(--surface-2)] px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Open</div>
              <div className="truncate text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                {missed ? formatMoney(missed) : '-'}
              </div>
            </div>
          </div>
        )}
      </div>
    </MetricCardFrame>
  )
}

function BulkEntryTable({
  snapshots,
  canEdit,
  commissionableEmployees,
  savedField,
  onUpdateRow,
  onUpdateNumber,
  onRemove,
}: {
  snapshots: CommissionSnapshot[]
  canEdit: boolean
  commissionableEmployees: Employee[]
  savedField: SaveFieldId
  onUpdateRow: (snapshot: CommissionSnapshot, updates: Partial<CommissionSnapshot>, savedId?: SaveFieldId) => void
  onUpdateNumber: (snapshot: CommissionSnapshot, field: NumberField, value: string, savedId: SaveFieldId) => void
  onRemove: (snapshot: CommissionSnapshot) => void
}) {
  const tableFields: Array<{ field: NumberField; label: string; placeholder: string }> = [
    { field: 'commission', label: 'Paid', placeholder: '$0' },
    { field: 'commissionOpportunity', label: 'Opp', placeholder: '$0' },
    ...BOARD_METRICS.flatMap((metric) => [
      { field: metric.key, label: metric.shortLabel, placeholder: metric.money ? '$0' : '0' },
      { field: metric.goalKey, label: `${metric.shortLabel} Goal`, placeholder: metric.money ? '$0' : '0' },
    ]),
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="overflow-x-auto">
        <table className="min-w-[1320px] border-separate border-spacing-0 text-left text-xs">
          <thead className="bg-[var(--surface-solid)] text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
            <tr>
              <th className="sticky left-0 z-20 w-56 border-b border-r border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2">Rep</th>
              {tableFields.map((item) => (
                <th key={item.field} className="w-24 border-b border-[var(--border)] px-2 py-2 text-center">
                  {item.label}
                </th>
              ))}
              <th className="w-72 border-b border-[var(--border)] px-2 py-2">Notes</th>
              {canEdit && <th className="w-12 border-b border-[var(--border)] px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => {
              const nameSaved = savedField === saveFieldId(snapshot.id, 'employeeName')
              const notesSaved = savedField === saveFieldId(snapshot.id, 'notes')

              return (
                <tr key={snapshot.id} className="odd:bg-[var(--surface)]/35">
                  <td className="sticky left-0 z-10 border-r border-t border-[var(--border)] bg-[var(--surface-solid)] px-2 py-2 align-top">
                    {canEdit ? (
                      <div className="relative">
                        <Select
                          aria-label="Rep name"
                          data-commission-editor="true"
                          value={snapshot.employeeName}
                          onChange={(event) => onUpdateRow(snapshot, { employeeName: event.target.value }, saveFieldId(snapshot.id, 'employeeName'))}
                          className={cn('h-8 pr-8 text-xs', nameSaved && 'border-emerald-500/50 focus:border-emerald-500')}
                        >
                          {snapshot.employeeName && !commissionableEmployees.some((employee) => employee.name === snapshot.employeeName) && (
                            <option value={snapshot.employeeName}>{snapshot.employeeName}</option>
                          )}
                          {commissionableEmployees.map((employee) => (
                            <option key={employee.id} value={employee.name}>
                              {employee.name}
                            </option>
                          ))}
                        </Select>
                        <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2">
                          <SavedCheck show={nameSaved} />
                        </span>
                      </div>
                    ) : (
                      <div className="truncate py-1 text-sm font-semibold text-[var(--text)]">{snapshot.employeeName || '-'}</div>
                    )}
                    <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                      Capture {formatGoalPercent(capturePercent(snapshot.commission, snapshot.commissionOpportunity))}
                    </div>
                  </td>
                  {tableFields.map((item) => (
                    <td key={item.field} className="border-t border-[var(--border)] px-1.5 py-2 align-top">
                      {canEdit ? (
                        <NumberEditor
                          snapshot={snapshot}
                          field={item.field}
                          ariaLabel={`${snapshot.employeeName || 'Rep'} ${item.label}`}
                          placeholder={item.placeholder}
                          savedField={savedField}
                          onUpdateNumber={onUpdateNumber}
                          className="h-8 min-w-[5.5rem] px-2 text-xs"
                        />
                      ) : (
                        <div className="py-1 text-center text-sm font-semibold tabular-nums text-[var(--text-secondary)]">
                          {snapshot[item.field] ? formatDecimal(snapshot[item.field]) : '-'}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="border-t border-[var(--border)] px-1.5 py-2 align-top">
                    {canEdit ? (
                      <div className="relative">
                        <Textarea
                          aria-label={`${snapshot.employeeName || 'Rep'} notes`}
                          data-commission-editor="true"
                          defaultValue={snapshot.notes}
                          rows={1}
                          onBlur={(event) => onUpdateRow(snapshot, { notes: event.target.value }, saveFieldId(snapshot.id, 'notes'))}
                          onKeyDown={handleNotesEditorKeyDown}
                          className={cn(
                            'min-h-8 min-w-[16rem] resize-y px-2 py-1.5 text-xs',
                            notesSaved && 'border-emerald-500/50 focus:border-emerald-500'
                          )}
                          placeholder="Notes"
                        />
                        <span className="pointer-events-none absolute right-2 top-2">
                          <SavedCheck show={notesSaved} />
                        </span>
                      </div>
                    ) : (
                      <div className="min-h-8 whitespace-pre-wrap py-1 text-xs text-[var(--text-secondary)]">
                        {snapshot.notes || '-'}
                      </div>
                    )}
                  </td>
                  {canEdit && (
                    <td className="border-t border-[var(--border)] px-1.5 py-2 align-top">
                      <Button size="icon" variant="danger" onClick={() => onRemove(snapshot)} aria-label={`Remove ${snapshot.employeeName || 'row'}`} className="h-8 w-8">
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RepCoachStrip({ snapshot }: { snapshot: CommissionSnapshot }) {
  const goals = BOARD_METRICS.map((metric) => ({
    label: metric.shortLabel,
    percent: goalPercent(snapshot[metric.key], snapshot[metric.goalKey]),
  })).filter((item) => item.percent !== null)
  const hitCount = goals.filter((item) => (item.percent ?? 0) >= 100).length
  const topGap = goals
    .filter((item) => (item.percent ?? 0) < 100)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0]
  const capture = capturePercent(snapshot.commission, snapshot.commissionOpportunity)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 font-semibold">
        <CheckCircle2 size={12} className={hitCount === goals.length && goals.length > 0 ? 'text-emerald-500' : 'text-[var(--text-tertiary)]'} />
        {hitCount}/{goals.length || BOARD_METRICS.length} goals
      </span>
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 font-semibold">
        <Zap size={12} className="text-[var(--accent)]" />
        Capture {formatGoalPercent(capture)}
      </span>
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 font-semibold">
        <Target size={12} className="text-amber-500" />
        {topGap ? `Coach ${topGap.label}` : 'On pace'}
      </span>
    </div>
  )
}

function RepHeader({
  snapshot,
  canEdit,
  commissionableEmployees,
  onUpdate,
  onRemove,
  savedField,
  compact = false,
}: {
  snapshot: CommissionSnapshot
  canEdit: boolean
  commissionableEmployees: Employee[]
  onUpdate: (updates: Partial<CommissionSnapshot>, savedId?: SaveFieldId) => void
  onRemove: () => void
  savedField: SaveFieldId
  compact?: boolean
}) {
  const nameSaved = savedField === saveFieldId(snapshot.id, 'employeeName')

  return (
    <div className={cn(
      'rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] shadow-[inset_0_1px_rgba(255,255,255,0.08)]',
      compact ? 'p-3' : 'p-2.5'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-sm font-semibold text-[var(--accent)]">
            {initialsForName(snapshot.employeeName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Rep</div>
            {canEdit ? (
              <div className="relative mt-1">
                <Select
                  aria-label="Rep name"
                  data-commission-editor="true"
                  value={snapshot.employeeName}
                  onChange={(event) => onUpdate({ employeeName: event.target.value }, saveFieldId(snapshot.id, 'employeeName'))}
                  className={cn('h-9 pr-8', nameSaved && 'border-emerald-500/50 focus:border-emerald-500')}
                >
                  {snapshot.employeeName && !commissionableEmployees.some((employee) => employee.name === snapshot.employeeName) && (
                    <option value={snapshot.employeeName}>{snapshot.employeeName}</option>
                  )}
                  {commissionableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.name}>
                      {employee.name}
                    </option>
                  ))}
                </Select>
                <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2">
                  <SavedCheck show={nameSaved} />
                </span>
              </div>
            ) : (
              <div className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">{snapshot.employeeName || '-'}</div>
            )}
          </div>
        </div>
        {canEdit && (
          <Button size="icon" variant="danger" onClick={onRemove} aria-label="Remove row" className="h-9 w-9">
            <Trash2 size={15} />
          </Button>
        )}
      </div>
      <RepCoachStrip snapshot={snapshot} />
    </div>
  )
}

function isCommissionableEmployee(employee: Employee, storeId: string) {
  const employeeStoreId = normalizeStoreId(employee.storeId ?? storeId)
  const role = employee.role.trim().toLowerCase().replace(/\s+/g, ' ')
  const isManagerRole = role === 'store manager'
    || role.includes('store manager')
    || role === 'retail store manager'
    || role === 'rsm'
  return employeeStoreId === storeId && !isManagerRole
}

export function CommissionSnapshotPage() {
  const { snapshots, addSnapshot, updateSnapshot, removeSnapshot } = useCommissionSnapshotStore()
  const employees = useScheduleStore((s) => s.employees)
  const { accessLabel, accessRole, storeId } = useUiStore()
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('daily')
  const [entryView, setEntryView] = useState<EntryView>('cards')
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [savedField, setSavedField] = useState<SaveFieldId>('')
  const [storeGoalDefaults, setStoreGoalDefaults] = useState(() => readStoreGoalDefaults(storeId))
  const [goalDraft, setGoalDraft] = useState<StoreGoalDefaults>(() => readStoreGoalDefaults(storeId))
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const latestSeenUpdateRef = useRef('')
  const savedFieldTimerRef = useRef<number | null>(null)
  const canEdit = accessRole === 'admin' || accessRole === 'district_manager'
  const normalizedStoreId = normalizeStoreId(storeId)

  useEffect(() => () => {
    if (savedFieldTimerRef.current) window.clearTimeout(savedFieldTimerRef.current)
  }, [])

  useEffect(() => {
    const defaults = readStoreGoalDefaults(normalizedStoreId)
    setStoreGoalDefaults(defaults)
    setGoalDraft(defaults)
  }, [normalizedStoreId])

  const commissionableEmployees = useMemo(() => (
    employees
      .filter((employee) => isCommissionableEmployee(employee, normalizedStoreId))
      .sort((a, b) => {
        const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER
        const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.name.localeCompare(b.name)
      })
  ), [employees, normalizedStoreId])

  const storeSnapshots = useMemo(() => (
    snapshots
      .filter((snapshot) => normalizeStoreId(snapshot.storeId ?? '') === normalizedStoreId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.employeeName.localeCompare(b.employeeName))
  ), [normalizedStoreId, snapshots])

  const latestSnapshot = useMemo(() => (
    storeSnapshots.reduce<CommissionSnapshot | null>((latest, snapshot) => {
      if (!latest) return snapshot
      if (snapshot.updatedAt !== latest.updatedAt) return snapshot.updatedAt > latest.updatedAt ? snapshot : latest
      if (snapshot.snapshotDate !== latest.snapshotDate) return snapshot.snapshotDate > latest.snapshotDate ? snapshot : latest
      return snapshot
    }, null)
  ), [storeSnapshots])

  useEffect(() => {
    if (!latestSnapshot) return
    const latestUpdate = latestSnapshot.updatedAt || latestSnapshot.createdAt || ''
    if (!latestSeenUpdateRef.current) {
      latestSeenUpdateRef.current = latestUpdate
      setSelectedDate(latestSnapshot.snapshotDate)
      return
    }
    if (latestUpdate > latestSeenUpdateRef.current) {
      latestSeenUpdateRef.current = latestUpdate
      setSelectedDate(latestSnapshot.snapshotDate)
    }
  }, [latestSnapshot])

  const dates = useMemo(() => {
    const uniqueDates = Array.from(new Set([todayKey(), selectedDate, ...storeSnapshots.map((snapshot) => snapshot.snapshotDate)]))
    return uniqueDates.sort((a, b) => b.localeCompare(a))
  }, [selectedDate, storeSnapshots])

  const visibleSnapshots = useMemo(() => (
    storeSnapshots.filter((snapshot) => snapshot.snapshotDate === selectedDate)
  ), [selectedDate, storeSnapshots])

  const totals = useMemo(() => {
    const totalCommission = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.commission, 0)
    const totalCommissionOpportunity = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.commissionOpportunity, 0)
    const totalAccessories = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.accessories, 0)
    const totalAccessoryGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.accessoryGoal, 0)
    const totalVoiceLines = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.voiceLines, 0)
    const totalVoiceLinesGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.voiceLinesGoal, 0)
    const totalBts = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.bts, 0)
    const totalBtsGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.btsGoal, 0)
    const totalRevenue = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.revenue, 0)
    const totalRevenueGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.revenueGoal, 0)
    const averageRevenue = visibleSnapshots.length ? totalRevenue / visibleSnapshots.length : 0
    const totalVaf = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.vaf, 0)
    const totalVafGoal = visibleSnapshots.reduce((sum, snapshot) => sum + snapshot.vafGoal, 0)
    const averageVaf = visibleSnapshots.length ? totalVaf / visibleSnapshots.length : 0
    return {
      totalCommission,
      totalCommissionOpportunity,
      totalAccessories,
      totalAccessoryGoal,
      totalVoiceLines,
      totalVoiceLinesGoal,
      totalBts,
      totalBtsGoal,
      totalRevenue,
      totalRevenueGoal,
      averageRevenue,
      totalVaf,
      totalVafGoal,
      averageVaf,
    }
  }, [visibleSnapshots])

  const mtdTotals = useMemo(() => {
    const month = monthKey(selectedDate)
    const monthSnapshots = storeSnapshots.filter((snapshot) => (
      snapshot.snapshotDate.startsWith(month)
      && snapshot.snapshotDate <= selectedDate
    ))
    return {
      commission: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.commission, 0),
      commissionOpportunity: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.commissionOpportunity, 0),
      accessories: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.accessories, 0),
      revenue: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.revenue, 0),
      vaf: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.vaf, 0),
      voiceLines: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.voiceLines, 0),
      bts: monthSnapshots.reduce((sum, snapshot) => sum + snapshot.bts, 0),
    }
  }, [selectedDate, storeSnapshots])

  const summaryCards = useMemo(() => {
    const details = summaryMode === 'daily'
      ? 'selected day'
      : summaryMode === 'mtd'
        ? 'month to date'
        : 'needed daily'
    const valueFor = (daily: number, mtd: number, need: number, money?: boolean) => {
      const value = summaryMode === 'daily' ? daily : summaryMode === 'mtd' ? mtd : need
      return formatMetricValue(value, money)
    }

    return [
      {
        icon: <BadgeDollarSign size={17} />,
        label: 'Commission Capture',
        value: summaryMode === 'need'
          ? formatMoney(Math.max(0, totals.totalCommissionOpportunity - totals.totalCommission))
          : formatGoalPercent(capturePercent(
            summaryMode === 'daily' ? totals.totalCommission : mtdTotals.commission,
            summaryMode === 'daily' ? totals.totalCommissionOpportunity : mtdTotals.commissionOpportunity
          )),
        detail: summaryMode === 'need' ? 'open opportunity' : details,
        status: capturePercent(
          summaryMode === 'daily' ? totals.totalCommission : mtdTotals.commission,
          summaryMode === 'daily' ? totals.totalCommissionOpportunity : mtdTotals.commissionOpportunity
        ),
      },
      {
        icon: <TrendingUp size={17} />,
        label: 'Accessory',
        value: valueFor(totals.totalAccessories, mtdTotals.accessories, eomDailyNeed(mtdTotals.accessories, totals.totalAccessoryGoal, selectedDate), true),
        detail: details,
        status: goalPercent(totals.totalAccessories, totals.totalAccessoryGoal),
      },
      {
        icon: <DollarSign size={17} />,
        label: 'Revenue Avg',
        value: valueFor(totals.averageRevenue, mtdTotals.revenue, eomDailyNeed(mtdTotals.revenue, totals.totalRevenueGoal, selectedDate), true),
        detail: details,
        status: goalPercent(totals.totalRevenue, totals.totalRevenueGoal),
      },
      {
        icon: <Users size={17} />,
        label: 'Voice Lines',
        value: valueFor(totals.totalVoiceLines, mtdTotals.voiceLines, eomDailyNeed(mtdTotals.voiceLines, totals.totalVoiceLinesGoal, selectedDate)),
        detail: details,
        status: goalPercent(totals.totalVoiceLines, totals.totalVoiceLinesGoal),
      },
      {
        icon: <Target size={17} />,
        label: 'VAF Avg',
        value: valueFor(totals.averageVaf, mtdTotals.vaf, eomDailyNeed(mtdTotals.vaf, totals.totalVafGoal, selectedDate), true),
        detail: details,
        status: goalPercent(totals.totalVaf, totals.totalVafGoal),
      },
      {
        icon: <Target size={17} />,
        label: 'BTS',
        value: valueFor(totals.totalBts, mtdTotals.bts, eomDailyNeed(mtdTotals.bts, totals.totalBtsGoal, selectedDate)),
        detail: details,
        status: goalPercent(totals.totalBts, totals.totalBtsGoal),
      },
    ]
  }, [mtdTotals, selectedDate, summaryMode, totals])

  const addSnapshotForEmployee = (employee: Employee, sortOrder: number) => {
    addSnapshot({
      storeId: normalizedStoreId,
      snapshotDate: selectedDate,
      employeeName: employee.name,
      commission: 0,
      commissionOpportunity: 0,
      accessories: 0,
      accessoryGoal: storeGoalDefaults.accessoryGoal,
      revenue: 0,
      revenueGoal: storeGoalDefaults.revenueGoal,
      vaf: 0,
      vafGoal: storeGoalDefaults.vafGoal,
      voiceLines: 0,
      voiceLinesGoal: storeGoalDefaults.voiceLinesGoal,
      bts: 0,
      btsGoal: storeGoalDefaults.btsGoal,
      notes: '',
      sortOrder,
      updatedBy: accessLabel,
    })
    setLastSavedAt(new Date().toISOString())
  }

  const addRow = () => {
    const assignedNames = new Set(visibleSnapshots.map((snapshot) => snapshot.employeeName.trim().toLowerCase()).filter(Boolean))
    const employee = commissionableEmployees.find((item) => !assignedNames.has(item.name.trim().toLowerCase())) ?? commissionableEmployees[0]
    if (!employee) return
    addSnapshotForEmployee(employee, visibleSnapshots.length)
  }

  const addMissingRows = () => {
    const assignedNames = new Set(visibleSnapshots.map((snapshot) => snapshot.employeeName.trim().toLowerCase()).filter(Boolean))
    const missingEmployees = commissionableEmployees.filter((employee) => !assignedNames.has(employee.name.trim().toLowerCase()))
    missingEmployees.forEach((employee, index) => addSnapshotForEmployee(employee, visibleSnapshots.length + index))
  }

  const markSaved = (savedId?: SaveFieldId) => {
    if (!savedId) return
    setSavedField(savedId)
    if (savedFieldTimerRef.current) window.clearTimeout(savedFieldTimerRef.current)
    savedFieldTimerRef.current = window.setTimeout(() => setSavedField(''), 1400)
  }

  const updateRow = (snapshot: CommissionSnapshot, updates: Partial<CommissionSnapshot>, savedId?: SaveFieldId) => {
    updateSnapshot(snapshot.id, {
      ...updates,
      storeId: snapshot.storeId,
      updatedBy: accessLabel,
    })
    setLastSavedAt(new Date().toISOString())
    markSaved(savedId)
  }

  const updateNumber = (snapshot: CommissionSnapshot, field: NumberField, value: string, savedId: SaveFieldId) => {
    updateRow(snapshot, { [field]: parseMetric(value) } as Partial<CommissionSnapshot>, savedId)
  }

  const refreshSnapshots = async () => {
    setRefreshing(true)
    try {
      const freshSnapshots = await dbGetCommissionSnapshots(normalizedStoreId)
      useCommissionSnapshotStore.setState((state) => ({
        snapshots: sortCommissionSnapshots([
          ...state.snapshots.filter((snapshot) => normalizeStoreId(snapshot.storeId ?? '') !== normalizedStoreId),
          ...freshSnapshots,
        ]),
      }))
      setLastSavedAt(new Date().toISOString())
    } finally {
      setRefreshing(false)
    }
  }

  const openGoalModal = () => {
    const defaults = readStoreGoalDefaults(normalizedStoreId)
    setStoreGoalDefaults(defaults)
    setGoalDraft(defaults)
    setGoalModalOpen(true)
  }

  const saveStoreGoals = () => {
    const previousDefaults = storeGoalDefaults
    const nextDefaults = normalizeStoreGoalDefaults(goalDraft)
    saveStoreGoalDefaults(normalizedStoreId, nextDefaults)
    setStoreGoalDefaults(nextDefaults)
    visibleSnapshots.forEach((snapshot) => {
      const updates = STORE_GOAL_FIELDS.reduce((patch, field) => {
        const currentValue = snapshot[field]
        if (currentValue === 0 || currentValue === previousDefaults[field]) {
          patch[field] = nextDefaults[field]
        }
        return patch
      }, {} as Partial<Pick<CommissionSnapshot, StoreGoalField>>)
      if (Object.keys(updates).length > 0) updateRow(snapshot, updates)
    })
    setGoalModalOpen(false)
    setLastSavedAt(new Date().toISOString())
  }

  const missingEmployeeCount = commissionableEmployees.length - new Set(
    visibleSnapshots.map((snapshot) => snapshot.employeeName.trim().toLowerCase()).filter(Boolean)
  ).size

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="module-legacy-header border-b border-[var(--border)] bg-[var(--app-bg)] px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <BadgeDollarSign size={19} className="text-[var(--accent)]" />
              <h1 className="text-xl font-semibold text-[var(--text)]">Commission Snapshot</h1>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase',
                canEdit
                  ? 'border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-tertiary)]'
              )}>
                {canEdit ? <Pencil size={12} /> : <LockKeyhole size={12} />}
                {canEdit ? 'Editable' : 'Read-only'}
              </span>
              {(lastSavedAt || visibleSnapshots[0]?.updatedAt) && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                  <Clock3 size={12} />
                  Updated {formatTimeLabel(lastSavedAt || visibleSnapshots[0]?.updatedAt)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Daily commission capture, attach-rate goals, and coaching notes for the store board.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex items-end gap-2">
              <Button size="icon" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label="Previous day">
                <ChevronLeft size={15} />
              </Button>
              <Input
                label="Snapshot Date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value || todayKey())}
                className="w-full md:w-44"
              />
              <Button size="icon" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label="Next day">
                <ChevronRight size={15} />
              </Button>
            </div>
            <Select
              label="Saved Dates"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full md:w-48"
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {formatDateLabel(date)}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<RefreshCw size={15} />} loading={refreshing} onClick={refreshSnapshots}>
                Refresh
              </Button>
              {canEdit && (
                <>
                <Button variant="accent" icon={<Target size={15} />} onClick={openGoalModal}>
                  Store Goals
                </Button>
                <Button variant="secondary" icon={<Users size={15} />} onClick={addMissingRows} disabled={missingEmployeeCount <= 0}>
                  Add Team
                </Button>
                <Button variant="primary" icon={<Plus size={15} />} onClick={addRow} disabled={commissionableEmployees.length === 0}>
                  Add Row
                </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">
            {formatDateLabel(selectedDate, { weekday: 'long', month: 'short', day: 'numeric' })} board
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-grid grid-cols-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
              {([
                ['daily', 'Today'],
                ['mtd', 'MTD'],
                ['need', 'Need/day'],
              ] as Array<[SummaryMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSummaryMode(mode)}
                  className={cn(
                    'h-8 rounded-md px-3 text-xs font-semibold transition-colors',
                    summaryMode === mode
                      ? 'bg-[var(--accent)] text-white shadow-[0_8px_20px_var(--accent-glow)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {canEdit && (
              <div className="inline-grid grid-cols-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1">
                {([
                  ['cards', 'Cards', <LayoutGrid size={13} />],
                  ['table', 'Table', <Table2 size={13} />],
                ] as Array<[EntryView, string, React.ReactNode]>).map(([view, label, icon]) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setEntryView(view)}
                    className={cn(
                      'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors',
                      entryView === view
                        ? 'bg-[var(--accent)] text-white shadow-[0_8px_20px_var(--accent-glow)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
                    )}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {summaryCards.map((card) => (
            <MetricSummary
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              detail={card.detail}
              status={card.status}
            />
          ))}
        </div>

        {!canEdit && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <LockKeyhole size={14} className="text-[var(--accent)]" />
            Admin or District Manager updates this board. Your view is read-only.
          </div>
        )}

        {canEdit && commissionableEmployees.length === 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] px-3 py-2 text-xs text-[var(--status-warn-text)]">
            <Users size={14} />
            Add store employees first. Store Manager and Retail Store Manager roles are excluded from commission snapshots.
          </div>
        )}

        {entryView === 'table' && canEdit && visibleSnapshots.length > 0 ? (
          <BulkEntryTable
            snapshots={visibleSnapshots}
            canEdit={canEdit}
            commissionableEmployees={commissionableEmployees}
            savedField={savedField}
            onUpdateRow={updateRow}
            onUpdateNumber={updateNumber}
            onRemove={(snapshot) => removeSnapshot(snapshot.id)}
          />
        ) : (
          <div className="space-y-3">
            {visibleSnapshots.map((snapshot) => {
              const notesSaved = savedField === saveFieldId(snapshot.id, 'notes')

              return (
            <div key={snapshot.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.06)]">
              <div className="md:hidden">
                <RepHeader
                  snapshot={snapshot}
                  canEdit={canEdit}
                  commissionableEmployees={commissionableEmployees}
                  onUpdate={(updates, savedId) => updateRow(snapshot, updates, savedId)}
                  onRemove={() => removeSnapshot(snapshot.id)}
                  savedField={savedField}
                  compact
                />

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <CommissionCell snapshot={snapshot} canEdit={canEdit} onUpdateNumber={updateNumber} savedField={savedField} />
                  </div>
                  {BOARD_METRICS.map((metric) => (
                    <MetricCell
                      key={metric.key}
                      snapshot={snapshot}
                      metric={metric}
                      canEdit={canEdit}
                      onUpdateNumber={updateNumber}
                      savedField={savedField}
                    />
                  ))}
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <div className="grid min-w-[1160px] grid-cols-[236px_172px_repeat(5,minmax(144px,1fr))] gap-2">
                  <div className="sticky left-0 z-10">
                    <RepHeader
                      snapshot={snapshot}
                      canEdit={canEdit}
                      commissionableEmployees={commissionableEmployees}
                      onUpdate={(updates, savedId) => updateRow(snapshot, updates, savedId)}
                      onRemove={() => removeSnapshot(snapshot.id)}
                      savedField={savedField}
                    />
                  </div>

                  <CommissionCell snapshot={snapshot} canEdit={canEdit} onUpdateNumber={updateNumber} savedField={savedField} />

                  {BOARD_METRICS.map((metric) => (
                    <MetricCell
                      key={metric.key}
                      snapshot={snapshot}
                      metric={metric}
                      canEdit={canEdit}
                      onUpdateNumber={updateNumber}
                      savedField={savedField}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-solid)]/80 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                    <StickyNote size={12} />
                    Notes
                  </div>
                  <SavedCheck show={notesSaved} />
                </div>
                {canEdit ? (
                  <Textarea
                    aria-label={`${snapshot.employeeName || 'Rep'} notes`}
                    data-commission-editor="true"
                    defaultValue={snapshot.notes}
                    rows={2}
                    onBlur={(event) => updateRow(snapshot, { notes: event.target.value }, saveFieldId(snapshot.id, 'notes'))}
                    onKeyDown={handleNotesEditorKeyDown}
                    placeholder="Add coaching context, promo notes, traffic, or follow-up..."
                    className={cn('min-h-[58px]', notesSaved && 'border-emerald-500/50 focus:border-emerald-500')}
                  />
                ) : (
                  <div className="min-h-[38px] whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                    {snapshot.notes || 'No notes.'}
                  </div>
                )}
              </div>
            </div>
              )
            })}
          </div>
        )}

          {visibleSnapshots.length === 0 && (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="No commission snapshot for this date"
              description={canEdit ? 'Create one row or add the full eligible team to begin today’s board.' : 'A manager has not published the commission board for this date yet.'}
              action={canEdit && commissionableEmployees.length > 0 ? (
                <div className="mt-4 flex justify-center gap-2">
                  <Button variant="accent" icon={<Target size={15} />} onClick={openGoalModal}>
                    Store Goals
                  </Button>
                  <Button variant="secondary" icon={<Users size={15} />} onClick={addMissingRows}>
                    Add Team
                  </Button>
                  <Button variant="primary" icon={<Plus size={15} />} onClick={addRow}>
                    Add Row
                  </Button>
                </div>
              ) : undefined}
            />
          )}
      </div>

      <Modal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} title="Store Commission Goals" size="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            These goals apply to this store's new rows and update existing rows only when that rep goal is blank or still matches the previous store default.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BOARD_METRICS.map((metric) => (
              <Input
                key={metric.goalKey}
                label={`${metric.label} Goal`}
                inputMode="decimal"
                value={goalDraft[metric.goalKey] || ''}
                onChange={(event) => setGoalDraft((draft) => ({
                  ...draft,
                  [metric.goalKey]: parseMetric(event.target.value),
                }))}
                className="tabular-nums"
                placeholder={metric.money ? '$0' : '0'}
              />
            ))}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            Rep-specific edited goals are preserved. To make a rep follow the store default again, clear that rep's goal back to 0 before saving store goals.
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setGoalModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={<Target size={15} />} onClick={saveStoreGoals}>
              Save Goals
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
