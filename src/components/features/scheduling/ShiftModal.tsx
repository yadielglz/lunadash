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

export function ShiftModal({ open, onClose, initialDate, editShift }: Props) {
  const { employees, addShift, updateShift, removeShift } = useScheduleStore()
  const blocks = useScheduleBlocksStore((s) => s.blocks)

  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const [date, setDate]             = useState(initialDate ?? new Date().toISOString().split('T')[0])
  const [blockId, setBlockId]       = useState(blocks[0]?.id ?? '')
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
    } else {
      setEmployeeId(employees[0]?.id ?? '')
      setDate(initialDate ?? new Date().toISOString().split('T')[0])
      setBlockId(sortedBlocks[0]?.id ?? '')
    }
  }, [editShift, initialDate, employees, open, sortedBlocks])

  const handleSave = () => {
    const block = selectedBlock ?? (editShift ? legacyBlockForShift(editShift) : undefined)
    if (!employeeId || !date || !block) return
    const data = {
      employeeId,
      date,
      startTime: block.startTime,
      endTime: block.endTime,
      type: block.name,
      note: block.note || undefined,
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

        {displayBlock ? (
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
            <Button variant="primary" onClick={handleSave} disabled={!selectedBlock && !editShift}>
              {editShift ? 'Update' : 'Add Shift'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
