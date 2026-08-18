import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Layers,
  Pencil,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Badge } from '../../ui/Badge'
import { Input, Select, Textarea } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { ModuleHeader, ModuleSkeleton } from '../../ui/ModulePrimitives'
import { useUiStore } from '../../../store/uiStore'
import { cn } from '../../../lib/utils'
import { DEMO_SHEET_URL, fetchDemoDevices, updateDemoDevice, type DemoDevice } from '../../../lib/demoDevices'

const EMPTY_DEVICE: DemoDevice = {
  rowNumber: 0,
  mdn: '',
  make: '',
  model: '',
  imei: '',
  imeiBarcode: '',
  lastChecked: '',
  notes: '',
  account: '',
  activationStatus: '',
  informationMatches: '',
  checkedBy: '',
}

function todayForSheet() {
  const now = new Date()
  return `${now.getMonth() + 1}/${now.getDate()}`
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function isActivated(device: DemoDevice) {
  if (device.activationStatus) return device.activationStatus.toLowerCase() === 'active'
  const note = device.notes.toLowerCase()
  return digits(device.mdn).length >= 10 && !note.includes('inactive') && device.make !== '-' && device.model !== '-'
}

function checkedThisMonth(value: string) {
  const [month] = value.split('/').map(Number)
  return month === new Date().getMonth() + 1
}

type BrandFilter = 'all' | 'apple' | 'samsung' | 'google' | 'motorola' | 'other'

export function DevicesPage() {
  const { accessId, accessRole, storeId } = useUiStore()
  const [devices, setDevices] = useState<DemoDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<DemoDevice | null>(null)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unverified'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [editing, setEditing] = useState<DemoDevice | null>(null)
  const [draft, setDraft] = useState<DemoDevice>(EMPTY_DEVICE)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchDemoDevices()
      setDevices(data)
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0])
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load demo devices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    return devices.filter((device) => {
      const query = search.trim().toLowerCase()
      const matchesSearch = !query || [
        device.mdn,
        device.make,
        device.model,
        device.imei,
        device.notes,
        device.account
      ].some((value) => value.toLowerCase().includes(query))

      const makeLower = device.make.toLowerCase()
      const matchesBrand =
        brandFilter === 'all' ||
        (brandFilter === 'apple' && makeLower.includes('apple')) ||
        (brandFilter === 'samsung' && makeLower.includes('samsung')) ||
        (brandFilter === 'google' && makeLower.includes('google')) ||
        (brandFilter === 'motorola' && (makeLower.includes('motorola') || makeLower.includes('moto'))) ||
        (brandFilter === 'other' && !['apple', 'samsung', 'google', 'motorola', 'moto'].some((b) => makeLower.includes(b)))

      const activated = isActivated(device)
      const checked = checkedThisMonth(device.lastChecked)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && activated) ||
        (statusFilter === 'unverified' && !checked)

      return matchesSearch && matchesBrand && matchesStatus
    })
  }, [devices, search, brandFilter, statusFilter])

  const verifiedCount = devices.filter((device) => checkedThisMonth(device.lastChecked)).length
  const activeCount = devices.filter(isActivated).length

  const handleCopy = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(label)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const openEditor = (device: DemoDevice) => {
    setEditing(device)
    setDraft({ ...device })
    setError('')
    setMessage('')
  }

  const save = async (device: DemoDevice, verifiedNow = false) => {
    setError('')
    setMessage('')
    if (verifiedNow && (!device.activationStatus || !device.informationMatches)) {
      setError('Choose an activation status and whether the device information matches before verifying.')
      return
    }
    setSaving(true)
    const next: DemoDevice = {
      ...device,
      lastChecked: verifiedNow ? todayForSheet() : device.lastChecked,
      checkedBy: verifiedNow ? (useUiStore.getState().accessLabel || device.checkedBy || 'Floor Lead') : device.checkedBy,
    }
    try {
      await updateDemoDevice({ ...next, accessId, accessRole: accessRole ?? '', storeCode: storeId })
      setDevices((items) => items.map((item) => (item.rowNumber === next.rowNumber ? next : item)))
      setSelectedDevice(next)
      setEditing(null)
      setMessage(verifiedNow ? `${next.mdn || next.model} verified and recorded.` : `${next.mdn || next.model} updated successfully.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the device.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tool-suite devices-tool-page flex h-full flex-col bg-[var(--bg)]">
      <ModuleHeader
        icon={<Smartphone size={20} className="text-[var(--accent)]" />}
        eyebrow="Store Fleet & Inventory"
        title="Demo Device Management"
        description="Verify live floor demo units, audit IMEIs, track activation health, and sync with live Google Sheets."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" variant="glass">{devices.length} Total Lines</Badge>
            <Badge tone="success" variant="glass">{activeCount} Activated</Badge>
            <Badge tone={verifiedCount === devices.length && devices.length > 0 ? 'success' : 'warning'} variant="glass">
              {verifiedCount}/{devices.length} Audited This Month
            </Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
              onClick={() => void load()}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<ExternalLink size={14} />}
              onClick={() => window.open(DEMO_SHEET_URL, '_blank', 'noopener,noreferrer')}
            >
              Google Sheet
            </Button>
          </div>
        }
      />

      {/* Notifications */}
      {message && (
        <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 backdrop-blur-md animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300 backdrop-blur-md animate-fade-in">
          <AlertCircle size={18} className="text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dual-Pane Workspace */}
      <div className="dual-pane-container flex-1 overflow-hidden">
        {/* Master List Pane */}
        <div className="dual-pane-master space-y-4">
          {/* Top Quick Filters and Search */}
          <div className="space-y-3">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search phone number, brand, model, IMEI, or notes…"
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'apple', 'samsung', 'google', 'motorola', 'other'] as BrandFilter[]).map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setBrandFilter(brand)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-full capitalize transition-all duration-200 border',
                      brandFilter === brand
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-sm'
                        : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-strong)]'
                    )}
                  >
                    {brand}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors border',
                    statusFilter === 'all'
                      ? 'bg-[var(--surface-3)] border-[var(--border-strong)] text-[var(--text)]'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text)]'
                  )}
                >
                  All ({devices.length})
                </button>
                <button
                  onClick={() => setStatusFilter('unverified')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors border',
                    statusFilter === 'unverified'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-amber-400'
                  )}
                >
                  Needs Audit ({devices.length - verifiedCount})
                </button>
              </div>
            </div>
          </div>

          {/* Roster Cards */}
          {loading ? (
            <ModuleSkeleton rows={6} />
          ) : filtered.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <Smartphone size={36} className="text-[var(--text-tertiary)] mb-3 opacity-50" />
              <h3 className="text-base font-semibold text-[var(--text)]">No demo devices found</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Try adjusting your search query or filters.</p>
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => { setSearch(''); setBrandFilter('all'); setStatusFilter('all') }}>
                Reset Filters
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((device) => {
                const activated = isActivated(device)
                const checked = checkedThisMonth(device.lastChecked)
                const isSelected = selectedDevice?.rowNumber === device.rowNumber

                return (
                  <Card
                    key={device.rowNumber}
                    interactive
                    onClick={() => setSelectedDevice(device)}
                    className={cn(
                      'p-4 cursor-pointer transition-all duration-200',
                      isSelected
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/25 bg-[var(--surface-2)] shadow-[var(--shadow-float)]'
                        : 'hover:border-[var(--border-strong)]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
                          activated
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        )}
                      >
                        <Smartphone size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-sm text-[var(--text)] truncate">
                            {device.make && device.make !== '-' ? `${device.make} ${device.model}` : 'Unassigned Demo'}
                          </h3>
                          <Badge
                            tone={checked ? 'success' : 'warning'}
                            size="xs"
                            dot
                          >
                            {checked ? 'Audited' : 'Pending'}
                          </Badge>
                        </div>

                        <div className="mt-1 font-mono text-xs font-medium text-[var(--accent)] tracking-tight">
                          {device.mdn || 'No Phone Assigned'}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-xs text-[var(--text-tertiary)] border-t border-[var(--border)] pt-2">
                          <span>IMEI: …{device.imei ? device.imei.slice(-6) : '—'}</span>
                          <span className={cn('text-[11px] font-medium', checked ? 'text-emerald-400' : 'text-amber-400')}>
                            {checked ? `Checked ${device.lastChecked}` : 'Not checked this month'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail Inspection Pane */}
        <aside className="dual-pane-detail flex flex-col justify-between">
          {selectedDevice ? (
            <div className="space-y-6">
              {/* Header Profile */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Device Inspection
                  </span>
                  <Badge tone={isActivated(selectedDevice) ? 'success' : 'warning'} size="xs">
                    {isActivated(selectedDevice) ? 'Active SIM' : 'Needs Review'}
                  </Badge>
                </div>
                <h2 className="mt-2 text-xl font-bold text-[var(--text)] tracking-tight">
                  {selectedDevice.make} {selectedDevice.model || 'Demo Unit'}
                </h2>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--accent)]">
                    {selectedDevice.mdn || 'No MDN'}
                  </span>
                  {selectedDevice.mdn && (
                    <button
                      onClick={() => handleCopy(selectedDevice.mdn, 'mdn')}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text)] p-1 rounded-md transition-colors"
                      title="Copy phone number"
                    >
                      <Copy size={13} />
                    </button>
                  )}
                  {copiedField === 'mdn' && (
                    <span className="text-[10px] text-emerald-400 font-medium animate-fade-in">Copied!</span>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              <div
                className={cn(
                  'rounded-2xl border p-4 backdrop-blur-md',
                  checkedThisMonth(selectedDevice.lastChecked)
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                )}
              >
                <div className="flex items-start gap-3">
                  {checkedThisMonth(selectedDevice.lastChecked) ? (
                    <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      {checkedThisMonth(selectedDevice.lastChecked)
                        ? 'Floor Audit Complete'
                        : 'Audit Required For Current Cycle'}
                    </h4>
                    <p className="text-xs mt-1 text-[var(--text-secondary)]">
                      {checkedThisMonth(selectedDevice.lastChecked)
                        ? `Last verified on ${selectedDevice.lastChecked} by ${selectedDevice.checkedBy || 'Floor Staff'}.`
                        : 'This unit has not been audited yet for this billing cycle.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Specifications & Telemetry Card */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Line & Hardware Identifiers
                </h4>
                
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-tertiary)]">IMEI Serial</span>
                    <div className="flex items-center gap-1.5 font-mono font-medium text-[var(--text)]">
                      <span>{selectedDevice.imei || '—'}</span>
                      {selectedDevice.imei && (
                        <button
                          onClick={() => handleCopy(selectedDevice.imei, 'imei')}
                          className="text-[var(--text-tertiary)] hover:text-[var(--text)]"
                          title="Copy IMEI"
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-tertiary)]">Barcode</span>
                    <span className="font-mono text-[var(--text)]">{selectedDevice.imeiBarcode || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-tertiary)]">Account Type</span>
                    <span className="font-medium text-[var(--text)]">{selectedDevice.account || 'Demo Line'}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[var(--text-tertiary)]">Info Matches Sheet</span>
                    <Badge tone={selectedDevice.informationMatches === 'Yes' ? 'success' : 'neutral'} size="xs">
                      {selectedDevice.informationMatches || 'Pending'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedDevice.notes && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">
                    Floor Notes
                  </h4>
                  <p className="text-xs text-[var(--text)] leading-relaxed italic">
                    "{selectedDevice.notes}"
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  icon={<ShieldCheck size={16} />}
                  onClick={() => save(selectedDevice, true)}
                  disabled={saving}
                >
                  {checkedThisMonth(selectedDevice.lastChecked) ? 'Re-Verify Today' : 'Verify & Record Audit'}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  icon={<Pencil size={15} />}
                  onClick={() => openEditor(selectedDevice)}
                >
                  Edit Specifications
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[var(--text-tertiary)]">
              <Layers size={36} className="opacity-40 mb-3" />
              <h4 className="text-sm font-semibold text-[var(--text)]">Select a Device</h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Choose a demo device from the left roster to view audit telemetry and line details.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Edit Device Modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        title="Edit Demo Device Record"
        subtitle="Update hardware identifiers, activation status, and floor audit records"
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone Number (MDN)"
            value={draft.mdn}
            onChange={(e) => setDraft({ ...draft, mdn: e.target.value })}
            placeholder="e.g. (555) 000-0000"
          />
          <Input
            label="Account / Tier"
            value={draft.account}
            onChange={(e) => setDraft({ ...draft, account: e.target.value })}
            placeholder="e.g. Demo Fleet"
          />
          <Input
            label="Make / Manufacturer"
            value={draft.make}
            onChange={(e) => setDraft({ ...draft, make: e.target.value })}
            placeholder="e.g. Apple, Samsung"
          />
          <Input
            label="Device Model"
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            placeholder="e.g. iPhone 16 Pro Max 256GB"
          />
          <Input
            label="IMEI Serial"
            value={draft.imei}
            onChange={(e) => setDraft({ ...draft, imei: e.target.value })}
            placeholder="15-digit IMEI"
          />
          <Input
            label="IMEI Barcode / Tag"
            value={draft.imeiBarcode}
            onChange={(e) => setDraft({ ...draft, imeiBarcode: e.target.value })}
            placeholder="Optional scanner barcode"
          />
          <Select
            label="Activation Status"
            value={draft.activationStatus}
            onChange={(e) => setDraft({ ...draft, activationStatus: e.target.value })}
          >
            <option value="">Select status</option>
            <option value="Active">Active (Live SIM on floor)</option>
            <option value="Inactive">Inactive (Needs Activation)</option>
            <option value="Needs attention">Needs Attention / Damaged</option>
          </Select>
          <Select
            label="Information Matches Floor Tag"
            value={draft.informationMatches}
            onChange={(e) => setDraft({ ...draft, informationMatches: e.target.value })}
          >
            <option value="">Select verification</option>
            <option value="Yes">Yes (Matches Physical Unit)</option>
            <option value="No">No (Discrepancy)</option>
          </Select>
          <Input
            label="Audited By (Staff Name)"
            value={draft.checkedBy}
            onChange={(e) => setDraft({ ...draft, checkedBy: e.target.value })}
            placeholder="Auditor name"
          />
          <Input
            label="Last Checked Date (M/D)"
            value={draft.lastChecked}
            onChange={(e) => setDraft({ ...draft, lastChecked: e.target.value })}
            placeholder="e.g. 8/17"
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Floor & Audit Notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={3}
              placeholder="Display location, security tether condition, cosmetic status…"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void save(draft)} disabled={saving}>
            Save Details Only
          </Button>
          <Button
            variant="primary"
            icon={<ShieldCheck size={16} />}
            onClick={() => void save(draft, true)}
            disabled={saving}
          >
            {saving ? 'Saving to Cloud…' : 'Save & Mark Verified Today'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

