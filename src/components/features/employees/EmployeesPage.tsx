import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, DollarSign, Save, Store, Trash2, UserRound } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select } from '../../ui/Input'
import { useScheduleStore, type Employee } from '../../../store/scheduleStore'
import { useScheduleBlocksStore } from '../../../store/scheduleBlocksStore'
import {
  estimateNetRevenue,
  useEmployeeInsightsStore,
  type EmployeeSaleCategory,
  type EmployeeSchedulePreference,
} from '../../../store/employeeInsightsStore'
import { dbGetStores, type StoreSummary } from '../../../lib/supabase'
import { normalizeStoreId } from '../../../lib/storeIds'
import { useUiStore } from '../../../store/uiStore'
import { formatMoney } from '../../../lib/performanceSheet'

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

const SALE_TYPES: { value: EmployeeSaleCategory; label: string }[] = [
  { value: 'voice', label: 'Voice' },
  { value: 'bts', label: 'BTS' },
  { value: 'hsi', label: 'HSI' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'other', label: 'Other' },
]

function num(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function toggleNumber(values: number[], value: number) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort()
}

function toggleString(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort()
}

function emptyPreference(employee: Employee): EmployeeSchedulePreference {
  return {
    employeeId: employee.id,
    storeId: employee.storeId,
    preferredDays: [],
    unavailableDays: [],
    preferredBlocks: [],
    maxHoursPerWeek: null,
    notes: '',
    updatedAt: new Date().toISOString(),
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums text-[var(--text)]">{value}</div>
    </div>
  )
}

export function EmployeesPage() {
  const { employees, updateEmployee } = useScheduleStore()
  const blocks = useScheduleBlocksStore((s) => s.blocks)
  const { accessRole, storeId } = useUiStore()
  const canChooseStore = accessRole === 'admin' || accessRole === 'district_manager'
  const [selectedId, setSelectedId] = useState(employees[0]?.id ?? '')
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [draftStoreId, setDraftStoreId] = useState('')
  const [draftRole, setDraftRole] = useState('')
  const [draftPreference, setDraftPreference] = useState<EmployeeSchedulePreference | null>(null)
  const [saleDate, setSaleDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saleCategory, setSaleCategory] = useState<EmployeeSaleCategory>('voice')
  const [grossRevenue, setGrossRevenue] = useState('')
  const [accessoryRevenue, setAccessoryRevenue] = useState('')
  const [protectionCount, setProtectionCount] = useState('')
  const [saleNote, setSaleNote] = useState('')
  const preferences = useEmployeeInsightsStore((s) => s.preferences)
  const sales = useEmployeeInsightsStore((s) => s.sales)
  const loadInsights = useEmployeeInsightsStore((s) => s.loadInsights)
  const savePreference = useEmployeeInsightsStore((s) => s.savePreference)
  const addSale = useEmployeeInsightsStore((s) => s.addSale)
  const removeSale = useEmployeeInsightsStore((s) => s.removeSale)

  const selectedEmployee = employees.find((employee) => employee.id === selectedId) ?? employees[0]
  const employeeSales = useMemo(() => (
    selectedEmployee ? sales.filter((sale) => sale.employeeId === selectedEmployee.id) : []
  ), [sales, selectedEmployee])
  const totalNr = employeeSales.reduce((sum, sale) => sum + sale.estimatedNetRevenue, 0)
  const monthKey = format(new Date(), 'yyyy-MM')
  const monthNr = employeeSales
    .filter((sale) => sale.saleDate.startsWith(monthKey))
    .reduce((sum, sale) => sum + sale.estimatedNetRevenue, 0)
  const estimatedNr = estimateNetRevenue({
    grossRevenue: num(grossRevenue),
    accessoryRevenue: num(accessoryRevenue),
    protectionCount: num(protectionCount),
  })

  useEffect(() => {
    loadInsights()
  }, [loadInsights, storeId])

  useEffect(() => {
    if (!selectedEmployee) return
    setDraftStoreId(normalizeStoreId(selectedEmployee.storeId ?? storeId))
    setDraftRole(selectedEmployee.role)
    setDraftPreference(preferences.find((preference) => preference.employeeId === selectedEmployee.id) ?? emptyPreference(selectedEmployee))
  }, [preferences, selectedEmployee, storeId])

  useEffect(() => {
    if (!canChooseStore) return
    setStoresLoading(true)
    dbGetStores()
      .then((nextStores) => setStores(nextStores.filter((store) => normalizeStoreId(store.store_id) !== 'MAIN')))
      .finally(() => setStoresLoading(false))
  }, [canChooseStore])

  const saveProfile = () => {
    if (!selectedEmployee) return
    updateEmployee(selectedEmployee.id, {
      role: draftRole.trim() || 'Associate',
      ...(canChooseStore && draftStoreId ? { storeId: normalizeStoreId(draftStoreId) } : {}),
    })
    setMessage('Employee profile updated.')
  }

  const saveSchedulePreference = async () => {
    if (!draftPreference || !selectedEmployee) return
    await savePreference({
      ...draftPreference,
      employeeId: selectedEmployee.id,
      storeId: normalizeStoreId(selectedEmployee.storeId ?? storeId),
    })
    setMessage('Schedule preferences saved.')
  }

  const saveSale = async () => {
    if (!selectedEmployee) return
    if (estimatedNr <= 0 && saleCategory !== 'other') return
    await addSale({
      employeeId: selectedEmployee.id,
      storeId: normalizeStoreId(selectedEmployee.storeId ?? storeId),
      saleDate,
      category: saleCategory,
      grossRevenue: num(grossRevenue),
      accessoryRevenue: num(accessoryRevenue),
      protectionCount: Math.round(num(protectionCount)),
      estimatedNetRevenue: estimatedNr,
      note: saleNote.trim(),
    })
    setGrossRevenue('')
    setAccessoryRevenue('')
    setProtectionCount('')
    setSaleNote('')
    setMessage('Sale saved with NR estimate.')
  }

  if (employees.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center">
        <div>
          <UserRound size={28} className="mx-auto text-[var(--accent)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--text)]">No employees yet</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">Add employees from Schedule, then manage profiles here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--text)]">
              <UserRound size={18} className="text-[var(--accent)]" />
              Employees
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Profiles, schedule preferences, and sales NR tracking.</p>
          </div>
          {message && <div className="text-xs font-medium text-[var(--accent)]">{message}</div>}
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[var(--border)] p-3 lg:border-b-0 lg:border-r">
          <div className="space-y-1.5">
            {employees.map((employee) => {
              const active = selectedEmployee?.id === employee.id
              const employeeTotal = sales
                .filter((sale) => sale.employeeId === employee.id && sale.saleDate.startsWith(monthKey))
                .reduce((sum, sale) => sum + sale.estimatedNetRevenue, 0)
              return (
                <button
                  key={employee.id}
                  onClick={() => setSelectedId(employee.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--reveal-bg)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: employee.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">{employee.name}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)]">
                    <span className="truncate">{employee.role}</span>
                    <span>{formatMoney(employeeTotal)} MTD</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {selectedEmployee && draftPreference && (
          <main className="overflow-auto p-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
              <div className="space-y-4">
                <Card className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Store size={16} className="text-[var(--accent)]" />
                    <h2 className="text-sm font-semibold text-[var(--text)]">Profile</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input label="Name" value={selectedEmployee.name} disabled />
                    <Input label="Role" value={draftRole} onChange={(e) => setDraftRole(e.target.value)} />
                    <Select
                      label="Assigned Store"
                      value={draftStoreId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDraftStoreId(e.target.value)}
                      disabled={!canChooseStore || storesLoading}
                    >
                      <option value={normalizeStoreId(selectedEmployee.storeId ?? storeId)}>{normalizeStoreId(selectedEmployee.storeId ?? storeId)}</option>
                      {stores.map((store) => (
                        <option key={store.store_id} value={store.store_id}>
                          {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
                        </option>
                      ))}
                    </Select>
                    <Input label="Color" value={selectedEmployee.color} disabled />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="primary" icon={<Save size={13} />} onClick={saveProfile}>
                      Save Profile
                    </Button>
                  </div>
                </Card>

                <Card className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-[var(--accent)]" />
                    <h2 className="text-sm font-semibold text-[var(--text)]">Schedule Preferences</h2>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Preferred Days</div>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => setDraftPreference((pref) => pref ? { ...pref, preferredDays: toggleNumber(pref.preferredDays, day.value) } : pref)}
                          className={`rounded-md border px-2.5 py-1 text-xs ${
                            draftPreference.preferredDays.includes(day.value)
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Unavailable Days</div>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => setDraftPreference((pref) => pref ? { ...pref, unavailableDays: toggleNumber(pref.unavailableDays, day.value) } : pref)}
                          className={`rounded-md border px-2.5 py-1 text-xs ${
                            draftPreference.unavailableDays.includes(day.value)
                              ? 'border-red-400/40 bg-red-500/10 text-red-300'
                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Preferred Blocks</div>
                    <div className="flex flex-wrap gap-1.5">
                      {blocks.length === 0 ? (
                        <span className="text-xs text-[var(--text-tertiary)]">Create schedule blocks in Settings to assign preferences.</span>
                      ) : blocks.map((block) => (
                        <button
                          key={block.id}
                          onClick={() => setDraftPreference((pref) => pref ? { ...pref, preferredBlocks: toggleString(pref.preferredBlocks, block.name) } : pref)}
                          className={`rounded-md border px-2.5 py-1 text-xs ${
                            draftPreference.preferredBlocks.includes(block.name)
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)]'
                          }`}
                        >
                          {block.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <Input
                      label="Max Hours"
                      type="number"
                      value={draftPreference.maxHoursPerWeek ?? ''}
                      onChange={(e) => setDraftPreference((pref) => pref ? { ...pref, maxHoursPerWeek: e.target.value ? num(e.target.value) : null } : pref)}
                    />
                    <Input
                      label="Notes"
                      value={draftPreference.notes}
                      onChange={(e) => setDraftPreference((pref) => pref ? { ...pref, notes: e.target.value } : pref)}
                      placeholder="Availability notes"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="primary" icon={<Save size={13} />} onClick={saveSchedulePreference}>
                      Save Preferences
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="MTD Est. NR" value={formatMoney(monthNr)} />
                  <Stat label="Total Est. NR" value={formatMoney(totalNr)} />
                  <Stat label="Sales Logged" value={String(employeeSales.length)} />
                </div>

                <Card className="space-y-4">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-[var(--accent)]" />
                    <h2 className="text-sm font-semibold text-[var(--text)]">Sale NR Estimate</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input label="Sale Date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                    <Select label="Category" value={saleCategory} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSaleCategory(e.target.value as EmployeeSaleCategory)}>
                      {SALE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </Select>
                    <Input label="Plan / Gross NR" inputMode="decimal" value={grossRevenue} onChange={(e) => setGrossRevenue(e.target.value)} placeholder="0.00" />
                    <Input label="Accessory NR" inputMode="decimal" value={accessoryRevenue} onChange={(e) => setAccessoryRevenue(e.target.value)} placeholder="0.00" />
                    <Input label="Protection Count" inputMode="numeric" value={protectionCount} onChange={(e) => setProtectionCount(e.target.value)} placeholder="0" />
                    <Input label="Note" value={saleNote} onChange={(e) => setSaleNote(e.target.value)} placeholder="Optional detail" />
                  </div>
                  <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">Estimated Net Revenue</div>
                      <div className="mt-1 text-xl font-semibold text-[var(--text)]">{formatMoney(estimatedNr)}</div>
                    </div>
                    <Button size="sm" variant="primary" icon={<Save size={13} />} onClick={saveSale}>
                      Save Sale
                    </Button>
                  </div>
                </Card>

                <Card className="space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--text)]">Recent Sales</h2>
                  {employeeSales.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[var(--text-tertiary)]">No sales logged for this employee yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {employeeSales.slice(0, 12).map((sale) => (
                        <div key={sale.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[var(--text)]">{formatMoney(sale.estimatedNetRevenue)}</div>
                            <div className="text-[10px] uppercase text-[var(--text-tertiary)]">
                              {sale.saleDate} · {sale.category}{sale.note ? ` · ${sale.note}` : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => removeSale(sale.id)}
                            className="rounded-md p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--reveal-bg)] hover:text-red-400"
                            title="Delete sale"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
