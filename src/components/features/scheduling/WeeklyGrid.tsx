import { useEffect, useState } from 'react'
import { format, addDays, startOfWeek, isToday } from 'date-fns'
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, GripVertical, Plus, Printer, Save, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScheduleStore, Shift } from '../../../store/scheduleStore'
import { ShiftModal } from './ShiftModal'
import { formatShiftTime, hexToRgba } from '../../../lib/utils'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Input'
import { useScheduleBlocksStore } from '../../../store/scheduleBlocksStore'
import { useSchedulePreferencesStore } from '../../../store/schedulePreferencesStore'
import { shiftsToTemplateShifts, useScheduleTemplatesStore, type TemplateShift } from '../../../store/scheduleTemplatesStore'
import { useUiStore } from '../../../store/uiStore'
import { PrintableScheduleModal } from './PrintableScheduleModal'

const SCHEDULE_GRID_COLUMNS = '220px repeat(7, minmax(118px, 1fr))'

function weekDates(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'))
}

function templateShiftsToShifts(templateShifts: TemplateShift[], weekStart: Date): Omit<Shift, 'id'>[] {
  return templateShifts.map((shift) => ({
    employeeId: shift.employeeId,
    date: format(addDays(weekStart, shift.dayOffset), 'yyyy-MM-dd'),
    startTime: shift.startTime,
    endTime: shift.endTime,
    type: shift.type,
    note: shift.note,
  }))
}

function ScheduleTemplatesModal({
  open,
  onClose,
  weekStart,
}: {
  open: boolean
  onClose: () => void
  weekStart: Date
}) {
  const { employees, shifts, addShifts, removeShifts } = useScheduleStore()
  const templates = useScheduleTemplatesStore((s) => s.templates)
  const templatesLoaded = useScheduleTemplatesStore((s) => s.isLoaded)
  const loadTemplates = useScheduleTemplatesStore((s) => s.loadTemplates)
  const addTemplate = useScheduleTemplatesStore((s) => s.addTemplate)
  const removeTemplate = useScheduleTemplatesStore((s) => s.removeTemplate)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [busy, setBusy] = useState(false)

  const dates = weekDates(weekStart)
  const weekShifts = shifts.filter((shift) => dates.includes(shift.date))
  const selectedTemplate = templates.find((template) => template.id === selectedId)

  useEffect(() => {
    if (open) loadTemplates()
  }, [loadTemplates, open])

  useEffect(() => {
    if (templates.length > 0 && (!selectedId || !templates.some((template) => template.id === selectedId))) {
      setSelectedId(templates[0].id)
    }
  }, [selectedId, templates])

  const saveCurrentWeek = async () => {
    if (!name.trim() || weekShifts.length === 0) return
    setBusy(true)
    try {
      const template = await addTemplate({
        name: name.trim(),
        shifts: shiftsToTemplateShifts(weekShifts, dates),
      })
      setSelectedId(template.id)
      setName('')
    } finally {
      setBusy(false)
    }
  }

  const applyTemplate = () => {
    if (!selectedTemplate) return
    if (replaceExisting) removeShifts(weekShifts.map((shift) => shift.id))
    addShifts(templateShiftsToShifts(selectedTemplate.shifts, weekStart))
    onClose()
  }

  const deleteTemplate = async () => {
    if (!selectedTemplate) return
    setBusy(true)
    try {
      await removeTemplate(selectedTemplate.id)
      setSelectedId('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Templates" size="md">
      <div className="space-y-5">
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Save This Week</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Saves {weekShifts.length} shifts from {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentWeek() }}
            />
            <Button size="sm" icon={<Save size={12} />} onClick={saveCurrentWeek} disabled={!name.trim() || weekShifts.length === 0 || busy} loading={busy}>
              Save
            </Button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Apply Template</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Templates keep employees, days, times, shift types, and notes.
            </p>
          </div>

          {!templatesLoaded ? (
            <p className="text-xs text-[var(--text-tertiary)] py-2">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] py-2">No templates saved yet.</p>
          ) : (
            <>
              <Select value={selectedId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedId(e.target.value)}>
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.shifts.length} shifts)
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Replace shifts already scheduled in this week
              </label>
              <div className="flex items-center justify-between gap-2">
                <Button variant="danger" size="sm" onClick={deleteTemplate} disabled={!selectedTemplate || busy}>
                  Delete Template
                </Button>
                <Button variant="primary" size="sm" icon={<Upload size={12} />} onClick={applyTemplate} disabled={!selectedTemplate || employees.length === 0}>
                  Apply
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function shiftsOverlap(a: Shift, b: Shift) {
  return a.id !== b.id && a.startTime < b.endTime && b.startTime < a.endTime
}

function ShiftCard({
  shift,
  accentColor,
  hasConflict,
  canEdit,
  showShiftName,
  showShiftNote,
  compact,
  onClick,
  onDuplicate,
  onDragStart,
}: {
  shift: Shift
  accentColor: string
  hasConflict: boolean
  canEdit: boolean
  showShiftName: boolean
  showShiftNote: boolean
  compact: boolean
  onClick: () => void
  onDuplicate: () => void
  onDragStart: () => void
}) {
  return (
    <motion.button
      layout
      draggable={canEdit}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onDragStart={(e) => { e.stopPropagation(); onDragStart() }}
      className={`w-full text-left rounded-xl px-2.5 transition-all ${compact ? 'py-1.5' : 'py-2'}`}
      style={{
        background: hexToRgba(accentColor, 0.12),
        border: `1px solid ${hasConflict ? '#ef4444' : hexToRgba(accentColor, 0.25)}`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        {showShiftName ? (
          <div
            className="text-[11px] font-semibold leading-tight truncate"
            style={{ color: accentColor }}
          >
            {shift.type}
          </div>
        ) : (
          <div className="min-w-0 flex-1 text-[11px] font-semibold leading-tight text-[var(--text)] truncate">
            {formatShiftTime(shift.startTime, shift.endTime)}
          </div>
        )}
        <div className="flex items-center gap-1">
          {hasConflict && <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />}
          {canEdit && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onDuplicate() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDuplicate() } }}
              className="rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--reveal-bg)]"
              title="Duplicate shift"
            >
              <Copy size={10} />
            </span>
          )}
        </div>
      </div>
      {showShiftName && (
        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 truncate">
          {formatShiftTime(shift.startTime, shift.endTime)}
        </div>
      )}
      {showShiftNote && shift.note && (
        <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">
          {shift.note}
        </div>
      )}
    </motion.button>
  )
}

export function WeeklyGrid({ canEdit = false }: { canEdit?: boolean }) {
  const { employees, shifts, addShift, addShifts, updateShift, removeShifts, reorderEmployees } = useScheduleStore()
  const blocks = useScheduleBlocksStore((s) => s.blocks)
  const weekStartsOn = useSchedulePreferencesStore((s) => s.weekStartsOn)
  const showShiftNames = useSchedulePreferencesStore((s) => s.showShiftNames)
  const showShiftNotes = useSchedulePreferencesStore((s) => s.showShiftNotes)
  const showEmployeeRoles = useSchedulePreferencesStore((s) => s.showEmployeeRoles)
  const compactSchedule = useSchedulePreferencesStore((s) => s.compactSchedule)
  const isMainDashboard = useUiStore((s) => s.storeId === 'main')
  const [weekOffset, setWeekOffset] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | undefined>()
  const [clickedDate, setClickedDate] = useState<string | undefined>()
  const [clickedEmployeeId, setClickedEmployeeId] = useState<string | undefined>()
  const [dragShiftId, setDragShiftId] = useState<string | null>(null)
  const [dragEmployeeId, setDragEmployeeId] = useState<string | null>(null)
  const [dragOverEmployeeId, setDragOverEmployeeId] = useState<string | null>(null)

  const weekStart = addDays(startOfWeek(new Date(), { weekStartsOn }), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const currentWeekDates = weekDates(weekStart)
  const previousWeekStart = addDays(weekStart, -7)
  const previousWeekDates = weekDates(previousWeekStart)
  const currentWeekShifts = shifts.filter((shift) => currentWeekDates.includes(shift.date))
  const previousWeekShifts = shifts.filter((shift) => previousWeekDates.includes(shift.date))
  const blockColors = new Map(blocks.map((block) => [block.name, block.color]))

  const openAdd = (date: string, employeeId: string) => {
    if (!canEdit) return
    setEditShift(undefined); setClickedDate(date); setClickedEmployeeId(employeeId); setModalOpen(true)
  }
  const openEdit = (shift: Shift) => {
    if (!canEdit) return
    setEditShift(shift); setClickedDate(undefined); setClickedEmployeeId(undefined); setModalOpen(true)
  }

  const copyPreviousWeek = () => {
    if (!canEdit) return
    if (previousWeekShifts.length === 0) return
    const shouldReplace = currentWeekShifts.length === 0 || window.confirm('Replace shifts already scheduled in this week?')
    if (shouldReplace) removeShifts(currentWeekShifts.map((shift) => shift.id))
    addShifts(templateShiftsToShifts(shiftsToTemplateShifts(previousWeekShifts, previousWeekDates), weekStart))
  }

  const duplicateShift = (shift: Shift) => {
    if (!canEdit) return
    addShift({
      employeeId: shift.employeeId,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      type: shift.type,
      note: shift.note,
    })
  }

  const copyEmployeeWeek = (employeeId: string) => {
    if (!canEdit) return
    const employeeShifts = currentWeekShifts.filter((shift) => shift.employeeId === employeeId)
    if (employeeShifts.length === 0) return
    addShifts(employeeShifts.map((shift) => ({
      employeeId,
      date: format(addDays(new Date(`${shift.date}T12:00:00`), 7), 'yyyy-MM-dd'),
      startTime: shift.startTime,
      endTime: shift.endTime,
      type: shift.type,
      note: shift.note,
    })))
    setWeekOffset((w) => w + 1)
  }

  const dropShift = (date: string, employeeId: string) => {
    if (!canEdit) return
    if (!dragShiftId) return
    updateShift(dragShiftId, { date, employeeId })
    setDragShiftId(null)
  }

  const moveEmployee = (targetEmployeeId: string) => {
    if (!canEdit) return
    if (!dragEmployeeId || dragEmployeeId === targetEmployeeId) return
    const fromIndex = employees.findIndex((employee) => employee.id === dragEmployeeId)
    const toIndex = employees.findIndex((employee) => employee.id === targetEmployeeId)
    if (fromIndex < 0 || toIndex < 0) return
    const ordered = [...employees]
    const [moved] = ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, moved)
    reorderEmployees(ordered)
    setDragEmployeeId(null)
    setDragOverEmployeeId(null)
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Week navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--reveal-bg)] text-[var(--text-secondary)] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[var(--text)] min-w-[150px] text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--reveal-bg)] text-[var(--text-secondary)] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {canEdit && (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy size={12} />}
                onClick={copyPreviousWeek}
                disabled={previousWeekShifts.length === 0 || employees.length === 0}
              >
                Copy Previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Save size={12} />}
                onClick={() => setTemplatesOpen(true)}
              >
                Templates
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Printer size={12} />}
            onClick={() => setPrintOpen(true)}
          >
            Print
          </Button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Today
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 overflow-auto px-3 sm:px-4 pb-4">
        <div className="min-w-[1060px]">
          {/* Day headers */}
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: SCHEDULE_GRID_COLUMNS }}>
            <div className="sticky left-0 z-20 bg-[var(--bg)]" /> {/* Employee column spacer */}
            {days.map((d) => {
              const today = isToday(d)
              return (
                <div
                  key={d.toISOString()}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors ${today ? 'bg-[var(--accent)]/10' : ''}`}
                >
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${today ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    {format(d, 'EEE')}
                  </span>
                  <span
                    className={`text-lg font-bold leading-none ${today ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}
                  >
                    {format(d, 'd')}
                  </span>
                  {today && (
                    <span className="text-[9px] text-[var(--accent)] font-semibold">Today</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Employee rows */}
          <div className="space-y-2">
            {employees.map((emp) => (
              <motion.div
                key={emp.id}
                layout
                className="grid gap-2 items-start"
                style={{ gridTemplateColumns: SCHEDULE_GRID_COLUMNS }}
              >
                {/* Employee label */}
                <div
                  draggable={canEdit}
                  onDragStart={(e) => {
                    if (!canEdit) return
                    setDragEmployeeId(emp.id)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/luna-employee-id', emp.id)
                  }}
                  onDragOver={(e) => {
                    if (!canEdit) return
                    if (!dragEmployeeId || dragEmployeeId === emp.id) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverEmployeeId(emp.id)
                  }}
                  onDragLeave={() => {
                    if (dragOverEmployeeId === emp.id) setDragOverEmployeeId(null)
                  }}
                  onDrop={(e) => {
                    if (!canEdit) return
                    e.preventDefault()
                    moveEmployee(emp.id)
                  }}
                  onDragEnd={() => {
                    setDragEmployeeId(null)
                    setDragOverEmployeeId(null)
                  }}
                  className={`sticky left-0 z-10 flex items-center gap-2.5 px-2.5 sm:px-3 py-2 rounded-lg bg-[var(--surface-2-solid)] border h-full shadow-[4px_0_10px_rgba(0,0,0,0.08)] group/emp transition-colors ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''} ${
                    dragOverEmployeeId === emp.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)]'
                  }`}
                  title={canEdit ? 'Drag to reorder employees' : undefined}
                >
                  {canEdit && <GripVertical size={13} className="hidden sm:block flex-shrink-0 text-[var(--text-tertiary)]" />}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: emp.color }}
                  >
                    {emp.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold leading-snug text-[var(--text)] break-words">{emp.name}</div>
                    {showEmployeeRoles && (
                      <div className="text-[10px] leading-snug text-[var(--text-tertiary)] break-words">
                        {isMainDashboard && emp.storeId ? `${emp.storeId} · ` : ''}{emp.role}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        copyEmployeeWeek(emp.id)
                      }}
                      className="ml-auto hidden sm:flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--reveal-bg)] opacity-0 group-hover/emp:opacity-100 transition-opacity"
                      title="Copy employee week to next week"
                    >
                      <Copy size={11} />
                    </button>
                  )}
                </div>

                {/* Day cells */}
                {days.map((d) => {
                  const dateStr = format(d, 'yyyy-MM-dd')
                  const dayShifts = shifts.filter((s) => s.employeeId === emp.id && s.date === dateStr)
                  const today = isToday(d)
                  const conflictIds = new Set(dayShifts.flatMap((shift) => (
                    dayShifts.some((other) => shiftsOverlap(shift, other)) ? [shift.id] : []
                  )))

                  return (
                    <div
                      key={dateStr}
                      onClick={() => openAdd(dateStr, emp.id)}
                      onDragOver={(e) => { if (canEdit) e.preventDefault() }}
                      onDrop={(e) => { if (!canEdit) return; e.preventDefault(); dropShift(dateStr, emp.id) }}
                      className={`group relative flex flex-col gap-1 p-1.5 rounded-lg ${compactSchedule ? 'min-h-[50px]' : 'min-h-[68px]'} transition-colors border ${canEdit ? 'cursor-pointer' : ''} ${
                        today
                          ? 'bg-[var(--accent)]/5 border-[var(--accent)]/20'
                          : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)]/30 hover:bg-[var(--reveal-bg)]'
                      }`}
                    >
                      <AnimatePresence>
                        {dayShifts.map((shift) => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            accentColor={blockColors.get(shift.type) ?? emp.color}
                            hasConflict={conflictIds.has(shift.id)}
                            canEdit={canEdit}
                            showShiftName={showShiftNames}
                            showShiftNote={showShiftNotes}
                            compact={compactSchedule}
                            onClick={() => openEdit(shift)}
                            onDuplicate={() => duplicateShift(shift)}
                            onDragStart={() => { if (canEdit) setDragShiftId(shift.id) }}
                          />
                        ))}
                      </AnimatePresence>

                      {canEdit && dayShifts.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                            <Plus size={12} className="text-[var(--accent)]" />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </motion.div>
            ))}
          </div>

          {employees.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-tertiary)]">
              <span className="text-4xl">👥</span>
              <p className="text-sm">No employees yet — add one in Employees</p>
            </div>
          )}
        </div>
      </div>

      <ShiftModal
        open={canEdit && modalOpen}
        onClose={() => setModalOpen(false)}
        initialDate={clickedDate}
        initialEmployeeId={clickedEmployeeId}
        editShift={editShift}
      />
      <ScheduleTemplatesModal
        open={canEdit && templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        weekStart={weekStart}
      />
      <PrintableScheduleModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        weekStart={weekStart}
      />
    </div>
  )
}
