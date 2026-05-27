import { useState, useEffect, useMemo } from 'react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Input'
import { useScheduleStore, Shift } from '../../../store/scheduleStore'
import { useScheduleBlocksStore, ScheduleBlock } from '../../../store/scheduleBlocksStore'

interface Props {
  open: boolean
  onClose: () => void
  initialDate?: string
  initialEmployeeId?: string
  editShift?: Shift
}

function legacyBlockForShift(shift: Shift): ScheduleBlock {
  return {
    id: `legacy-${shift.id}`,
    name: shift.type,
    startTime: shift.startTime,
    endTime: shift.endTime,
    note: shift.note ?? '',
    color: '#0078d4',
    sortOrder: -1,
  }
}

export function ShiftModal({ open, onClose, initialDate, initialEmployeeId, editShift }: Props) {
  const { employees, addShift, updateShift, removeShift } = useScheduleStore()
  const blocks = useScheduleBlocksStore((s) => s.blocks)

  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const [date, setDate]             = useState(initialDate ?? new Date().toISOString().split('T')[0])
  const [blockId, setBlockId]       = useState(blocks[0]?.id ?? '')
  const [manualTime, setManualTime] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualStartTime, setManualStartTime] = useState('09:00')
  const [manualEndTime, setManualEndTime] = useState('17:00')
  const [manualNote, setManualNote] = useState('')
  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [blocks]
  )
  const selectedBlock = sortedBlocks.find((block) => block.id === blockId)
  const displayBlock = selectedBlock ?? (editShift ? legacyBlockForShift(editShift) : undefined)

  useEffect(() => {
    if (editShift) {
      const matchingBlock = sortedBlocks.find((block) =>
        block.name === editShift.type
        && block.startTime === editShift.startTime
        && block.endTime === editShift.endTime
      )
      setEmployeeId(editShift.employeeId)
      setDate(editShift.date)
      setBlockId(matchingBlock?.id ?? '')
      setManualTime(!matchingBlock)
      setManualName(editShift.type)
      setManualStartTime(editShift.startTime)
      setManualEndTime(editShift.endTime)
      setManualNote(editShift.note ?? '')
    } else {
      setEmployeeId(initialEmployeeId || employees[0]?.id || '')
      setDate(initialDate ?? new Date().toISOString().split('T')[0])
      setBlockId(sortedBlocks[0]?.id ?? '')
      setManualTime(false)
      setManualName(sortedBlocks[0]?.name ?? 'Custom')
      setManualStartTime(sortedBlocks[0]?.startTime ?? '09:00')
      setManualEndTime(sortedBlocks[0]?.endTime ?? '17:00')
      setManualNote(sortedBlocks[0]?.note ?? '')
    }
  }, [editShift, initialDate, initialEmployeeId, employees, open, sortedBlocks])

  useEffect(() => {
    if (!selectedBlock || manualTime) return
    setManualName(selectedBlock.name)
    setManualStartTime(selectedBlock.startTime)
    setManualEndTime(selectedBlock.endTime)
    setManualNote(selectedBlock.note)
  }, [selectedBlock, manualTime])

  const handleSave = () => {
    const block = selectedBlock ?? (editShift ? legacyBlockForShift(editShift) : undefined)
    if (!employeeId || !date) return
    if (!manualTime && !block) return
    const shiftName = manualTime ? manualName.trim() : block?.name
    const startTime = manualTime ? manualStartTime : block?.startTime
    const endTime = manualTime ? manualEndTime : block?.endTime
    const note = manualTime ? manualNote.trim() : block?.note
    if (!shiftName || !startTime || !endTime) return
    const data = {
      employeeId,
      date,
      startTime,
      endTime,
      type: shiftName,
      note: note || undefined,
    }
    if (editShift) updateShift(editShift.id, data)
    else addShift(data)
    onClose()
  }

  const handleDelete = () => {
    if (editShift) { removeShift(editShift.id); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title={editShift ? 'Edit Shift' : 'Add Shift'} size="sm">
      <div className="space-y-4">
        <Select label="Employee" value={employeeId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEmployeeId(e.target.value)}>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
          ))}
        </Select>

        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <Select
          label="Schedule Block"
          value={blockId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBlockId(e.target.value)}
        >
          <option value="">Select a saved block</option>
          {sortedBlocks.map((block) => (
            <option key={block.id} value={block.id}>{block.name} · {block.startTime}-{block.endTime}</option>
          ))}
        </Select>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={manualTime}
            onChange={(e) => setManualTime(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Manually edit this shift's time
        </label>

        {manualTime ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 space-y-3">
            <Input label="Shift Name" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. Mid" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Time" type="time" value={manualStartTime} onChange={(e) => setManualStartTime(e.target.value)} />
              <Input label="End Time" type="time" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} />
            </div>
            <Input label="Note" value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Optional note" />
          </div>
        ) : displayBlock ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: displayBlock.color }} />
              <span className="text-sm font-medium text-[var(--text)]">{displayBlock.name}</span>
            </div>
            <div className="mt-1 text-xs text-[var(--text-tertiary)]">
              {displayBlock.startTime} - {displayBlock.endTime}{displayBlock.note ? ` · ${displayBlock.note}` : ''}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-tertiary)]">
            Create schedule blocks in Settings before assigning shifts.
          </p>
        )}

        <div className="flex justify-between pt-2">
          {editShift ? (
            <Button variant="danger" onClick={handleDelete} size="sm">Delete</Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={manualTime ? !manualName.trim() || !manualStartTime || !manualEndTime : (!selectedBlock && !editShift)}>
              {editShift ? 'Update' : 'Add Shift'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
