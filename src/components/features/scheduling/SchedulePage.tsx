import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, LayoutGrid, Users, Trash2, Edit2 } from 'lucide-react'
import { WeeklyGrid } from './WeeklyGrid'
import { MonthlyCalendar } from './MonthlyCalendar'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { useScheduleStore } from '../../../store/scheduleStore'

const COLORS = ['#0078d4','#7c5ff5','#e74856','#16c60c','#f7630c','#00b7c3','#e3008c','#8764b8','#10893e']

function EmployeeManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employees, addEmployee, removeEmployee, updateEmployee } = useScheduleStore()
  const [name, setName] = useState('')
  const [role, setRole] = useState('Associate')
  const [color, setColor] = useState(COLORS[0])
  const [editId, setEditId] = useState<string | null>(null)

  const startEdit = (id: string) => {
    const e = employees.find((e) => e.id === id)
    if (!e) return
    setEditId(id); setName(e.name); setRole(e.role); setColor(e.color)
  }

  const save = () => {
    if (!name.trim()) return
    if (editId) {
      updateEmployee(editId, { name: name.trim(), role, color })
      setEditId(null)
    } else {
      addEmployee({ name: name.trim(), role, color })
    }
    setName(''); setRole('Associate'); setColor(COLORS[0])
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Employees" size="md">
      <div className="space-y-4">
        {/* Add/Edit form */}
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
          <h4 className="text-xs font-semibold text-[var(--text)]">{editId ? 'Edit Employee' : 'Add Employee'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            <Input label="Role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Associate" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {editId && <Button variant="ghost" onClick={() => { setEditId(null); setName(''); }}>Cancel</Button>}
            <Button variant="primary" onClick={save} disabled={!name.trim()}>
              {editId ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>

        {/* Employee list */}
        <div className="space-y-1.5">
          {employees.map((emp) => (
            <div key={emp.id} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-[var(--reveal-bg)] group transition-colors">
              <div className="w-3 h-3 rounded-full" style={{ background: emp.color }} />
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--text)]">{emp.name}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{emp.role}</div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(emp.id)} className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Edit2 size={12} /></button>
                <button onClick={() => removeEmployee(emp.id)} className="p-1 rounded hover:bg-[var(--reveal-bg)] text-[var(--text-tertiary)] hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

export function SchedulePage() {
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  const [empModalOpen, setEmpModalOpen] = useState(false)
  const { employees, shifts } = useScheduleStore()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)] flex items-center gap-2">
            <Calendar size={18} className="text-[var(--accent)]" />
            Schedule
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {employees.length} employees · {shifts.length} shifts total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={<Users size={13} />} onClick={() => setEmpModalOpen(true)}>
            Employees
          </Button>
          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(['weekly', 'monthly'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                }`}
              >
                {v === 'weekly' ? <><LayoutGrid size={12} /> Week</> : <><Calendar size={12} /> Month</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          key={view}
          className="h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {view === 'weekly' ? <WeeklyGrid /> : <MonthlyCalendar />}
        </motion.div>
      </div>

      <EmployeeManagerModal open={empModalOpen} onClose={() => setEmpModalOpen(false)} />
    </div>
  )
}
