import { useState, useEffect } from 'react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Input'
import { useScheduleStore, Shift, ShiftType } from '../../../store/scheduleStore'

const SHIFT_TYPES: ShiftType[] = ['Morning', 'Afternoon', 'Evening', 'Night', 'Custom']
const SHIFT_PRESETS: Record<ShiftType, { start: string; end: string }> = {
  Morning:   { start: '09:00', end: '17:00' },
  Afternoon: { start: '13:00', end: '21:00' },
  Evening:   { start: '17:00', end: '01:00' },
  Night:     { start: '22:00', end: '06:00' },
  Custom:    { start: '08:00', end: '16:00' },
}

interface Props {
  open: boolean
  onClose: () => void
  initialDate?: string
  editShift?: Shift
}

export function ShiftModal({ open, onClose, initialDate, editShift }: Props) {
  const { employees, addShift, updateShift, removeShift } = useScheduleStore()

  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const [date, setDate]             = useState(initialDate ?? new Date().toISOString().split('T')[0])
  const [type, setType]             = useState<ShiftType>('Morning')
  const [start, setStart]           = useState('09:00')
  const [end, setEnd]               = useState('17:00')
  const [note, setNote]             = useState('')

  useEffect(() => {
    if (editShift) {
      setEmployeeId(editShift.employeeId)
      setDate(editShift.date)
      setType(editShift.type)
      setStart(editShift.startTime)
      setEnd(editShift.endTime)
      setNote(editShift.note ?? '')
    } else {
      setEmployeeId(employees[0]?.id ?? '')
      setDate(initialDate ?? new Date().toISOString().split('T')[0])
      setType('Morning')
      setStart('09:00')
      setEnd('17:00')
      setNote('')
    }
  }, [editShift, initialDate, employees, open])

  const handleTypeChange = (t: ShiftType) => {
    setType(t)
    const preset = SHIFT_PRESETS[t]
    setStart(preset.start)
    setEnd(preset.end)
  }

  const handleSave = () => {
    if (!employeeId || !date) return
    const data = { employeeId, date, startTime: start, endTime: end, type, note: note || undefined }
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
        <Select label="Employee" value={employeeId} onChange={(e: any) => setEmployeeId(e.target.value)}>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
          ))}
        </Select>

        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Shift Type</label>
          <div className="flex flex-wrap gap-1.5">
            {SHIFT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  type === t
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Time" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="End Time"   type="time" value={end}   onChange={(e) => setEnd(e.target.value)} />
        </div>

        <Input label="Note (optional)" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="flex justify-between pt-2">
          {editShift ? (
            <Button variant="danger" onClick={handleDelete} size="sm">Delete</Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>
              {editShift ? 'Update' : 'Add Shift'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
