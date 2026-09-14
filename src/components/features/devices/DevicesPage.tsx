import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Barcode,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
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
import { useDisplayStore } from '../../../store/displayStore'
import { cn } from '../../../lib/utils'
import {
  DEMO_SHEET_URL,
  demoDeviceCheckedThisMonth,
  demoSheetToday,
  fetchDemoDevices,
  isDemoDeviceActivated,
  updateDemoDevice,
  type DemoDevice,
} from '../../../lib/demoDevices'
import { isScannableImei } from '../../../lib/demoBarcode'
import { useReportLayoutStore } from '../../../store/reportLayoutStore'
import { OrientationToggle } from '../../ui/OrientationToggle'
import { DeviceImeiBarcode } from './DeviceImeiBarcode'
import { openDemoAuditReport, openDemoBarcodeLabels } from './demoReport'

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

const isActivated = isDemoDeviceActivated
const checkedThisMonth = demoDeviceCheckedThisMonth
const isOffloaded = (device: DemoDevice) => device.activationStatus.toLowerCase() === 'offloaded'
const isUnassigned = (device: DemoDevice) => {
  const make = device.make.trim()
  const model = device.model.trim()
  return (!make || make === '-') && (!model || model === '-')
}
const isInactivePool = (device: DemoDevice) => isOffloaded(device) || isUnassigned(device)

type BrandFilter = 'all' | 'apple' | 'samsung' | 'google' | 'motorola' | 'other'
type StatusFilter = 'floor' | 'unverified' | 'inactive' | 'offloaded'
type AuditAction = 'keep' | 'offload' | 'archived' | 'restore'

export function DevicesPage() {
  const { accessId, accessRole, storeId } = useUiStore()
  const { companyName, storeNumber } = useDisplayStore()
  const reportOrientation = useReportLayoutStore((s) => s.orientation)
  const [devices, setDevices] = useState<DemoDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<DemoDevice | null>(null)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('floor')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [editing, setEditing] = useState<DemoDevice | null>(null)
  const [draft, setDraft] = useState<DemoDevice>(EMPTY_DEVICE)
  const [auditing, setAuditing] = useState<DemoDevice | null>(null)
  const [auditDraft, setAuditDraft] = useState<DemoDevice>(EMPTY_DEVICE)
  const [auditAction, setAuditAction] = useState<AuditAction>('keep')
  const [offloadReason, setOffloadReason] = useState('')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchDemoDevices()
      setDevices(data)
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(data.find((device) => !isOffloaded(device) && !isUnassigned(device)) ?? data[0])
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

      const checked = checkedThisMonth(device.lastChecked)
      const offloaded = isOffloaded(device)
      const unassigned = isUnassigned(device)
      const matchesStatus =
        (statusFilter === 'floor' && !offloaded && !unassigned) ||
        (statusFilter === 'unverified' && !offloaded && !unassigned && !checked) ||
        (statusFilter === 'inactive' && (offloaded || unassigned)) ||
        (statusFilter === 'offloaded' && offloaded)

      return matchesSearch && matchesBrand && matchesStatus
    })
  }, [devices, search, brandFilter, statusFilter])

  const floorDevices = devices.filter((device) => !isInactivePool(device))
  const inactivePoolDevices = devices.filter(isInactivePool)
  const offloadedDevices = devices.filter(isOffloaded)
  const verifiedCount = floorDevices.filter((device) => checkedThisMonth(device.lastChecked)).length
  const activeCount = floorDevices.filter(isActivated).length

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

  const openAudit = (device: DemoDevice) => {
    setAuditing(device)
    setAuditDraft({
      ...device,
      activationStatus: isOffloaded(device) ? 'Active' : device.activationStatus,
    })
    setAuditAction(isOffloaded(device) ? 'archived' : 'keep')
    setOffloadReason('')
    setError('')
    setMessage('')
  }

  const save = async (device: DemoDevice, verifiedNow = false, allowIncompleteAudit = false) => {
    setError('')
    setMessage('')
    if (verifiedNow && !allowIncompleteAudit && (!device.activationStatus || !device.informationMatches)) {
      setError('Choose an activation status and whether the device information matches before verifying.')
      return false
    }
    setSaving(true)
    const next: DemoDevice = {
      ...device,
      lastChecked: verifiedNow ? demoSheetToday() : device.lastChecked,
      checkedBy: verifiedNow ? (useUiStore.getState().accessLabel || device.checkedBy || 'Floor Lead') : device.checkedBy,
    }
    try {
      await updateDemoDevice({ ...next, accessId, accessRole: accessRole ?? '', storeCode: storeId })
      setDevices((items) => items.map((item) => (item.rowNumber === next.rowNumber ? next : item)))
      setSelectedDevice(next)
      setEditing(null)
      setAuditing(null)
      setMessage(
        isOffloaded(next)
          ? `${next.mdn || next.model} offloaded and retained in device history.`
          : verifiedNow
            ? `${next.mdn || next.model} verified and recorded.`
            : `${next.mdn || next.model} updated successfully.`
      )
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the device.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const completeAudit = async () => {
    if (!auditing) return
    if (auditAction === 'archived') {
      setAuditing(null)
      return
    }
    const auditor = useUiStore.getState().accessLabel || auditDraft.checkedBy || 'Floor Lead'
    if (!auditDraft.activationStatus || !auditDraft.informationMatches) {
      setError('Choose an activation status and whether the device information matches.')
      return
    }
    if (auditAction === 'offload' && !offloadReason.trim()) {
      setError('Enter an offload reason so the device history is clear.')
      return
    }

    const today = demoSheetToday()
    const historyEntry = auditAction === 'offload'
      ? `Offloaded ${today} by ${auditor}: ${offloadReason.trim()}`
      : auditAction === 'restore'
        ? `Returned to floor ${today} by ${auditor}`
        : ''
    const nextNotes = historyEntry
      ? [historyEntry, auditDraft.notes].filter(Boolean).join(' • ')
      : auditDraft.notes

    await save({
      ...auditDraft,
      activationStatus: auditAction === 'offload'
        ? 'Offloaded'
        : auditDraft.activationStatus,
      notes: nextNotes,
      checkedBy: auditor,
    }, true)
  }

  const storeLabel = `${companyName || 'Luna Store'}${storeNumber ? ` #${storeNumber}` : ''}`

  const runReport = () => {
    if (floorDevices.length === 0) {
      setError('There are no active floor devices to include in the report.')
      return
    }
    const ok = openDemoAuditReport({ devices: floorDevices, storeLabel, storeId, orientation: reportOrientation })
    if (!ok) setError('Allow pop-ups for this site to open the report.')
  }

  const runBarcodeLabels = () => {
    const forLabels = (filtered.length > 0 ? filtered : floorDevices)
      .filter((device) => !isOffloaded(device) && isScannableImei(device.imei))
    if (forLabels.length === 0) {
      setError('No devices in view have a scannable IMEI.')
      return
    }
    const ok = openDemoBarcodeLabels({ devices: forLabels, storeLabel, storeId })
    if (!ok) setError('Allow pop-ups for this site to open the label sheet.')
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
            <Badge tone="accent" variant="glass">{floorDevices.length} On Floor</Badge>
            <Badge tone="success" variant="glass">{activeCount} Activated</Badge>
            <Badge
              tone={floorDevices.length === 0 ? 'neutral' : verifiedCount === floorDevices.length ? 'success' : 'warning'}
              variant="glass"
            >
              {verifiedCount}/{floorDevices.length} Audited This Month
            </Badge>
            {inactivePoolDevices.length > 0 && (
              <Badge tone="neutral" variant="glass">{inactivePoolDevices.length} Inactive Pool</Badge>
            )}
            {offloadedDevices.length > 0 && (
              <Badge tone="neutral" variant="glass">{offloadedDevices.length} In History</Badge>
            )}
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
            <OrientationToggle compact />
            <Button
              size="sm"
              variant="outline"
              icon={<FileText size={14} />}
              onClick={runReport}
              disabled={loading || devices.length === 0}
            >
              Report
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<Barcode size={14} />}
              onClick={runBarcodeLabels}
              disabled={loading || devices.length === 0}
            >
              Barcode Labels
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
                  onClick={() => setStatusFilter('floor')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors border',
                    statusFilter === 'floor'
                      ? 'bg-[var(--surface-3)] border-[var(--border-strong)] text-[var(--text)]'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text)]'
                  )}
                >
                  Floor ({floorDevices.length})
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
                  Needs Audit ({floorDevices.length - verifiedCount})
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors border',
                    statusFilter === 'inactive'
                      ? 'bg-slate-500/20 border-slate-500/40 text-slate-300'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text)]'
                  )}
                >
                  Inactive Pool ({inactivePoolDevices.length})
                </button>
                <button
                  onClick={() => setStatusFilter('offloaded')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors border',
                    statusFilter === 'offloaded'
                      ? 'bg-slate-500/20 border-slate-500/40 text-slate-300'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text)]'
                  )}
                >
                  History ({offloadedDevices.length})
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
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => { setSearch(''); setBrandFilter('all'); setStatusFilter('floor') }}>
                Reset Filters
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filtered.map((device) => {
                const activated = isActivated(device)
                const checked = checkedThisMonth(device.lastChecked)
                const offloaded = isOffloaded(device)
                const unassigned = isUnassigned(device)
                const isSelected = selectedDevice?.rowNumber === device.rowNumber

                return (
                  <Card
                    key={device.rowNumber}
                    interactive
                    onClick={() => {
                      setSelectedDevice(device)
                      setMobileDetailOpen(true)
                    }}
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
                          offloaded || unassigned
                            ? 'bg-slate-500/15 text-slate-400 border border-slate-500/25'
                            : activated
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        )}
                      >
                        <Smartphone size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-sm text-[var(--text)] truncate">
                            {offloaded || unassigned ? 'Unassigned' : `${device.make} ${device.model}`}
                          </h3>
                          <Badge
                            tone={offloaded || unassigned ? 'neutral' : checked ? 'success' : 'warning'}
                            size="xs"
                            dot
                          >
                            {offloaded ? 'Offloaded' : unassigned ? 'Inactive Pool' : checked ? 'Audited' : 'Pending'}
                          </Badge>
                        </div>

                        <div className="mt-1 font-mono text-xs font-medium text-[var(--accent)] tracking-tight">
                          {device.mdn || 'No Phone Assigned'}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-xs text-[var(--text-tertiary)] border-t border-[var(--border)] pt-2">
                          <span>IMEI: …{device.imei ? device.imei.slice(-6) : '—'}</span>
                          <span className={cn(
                            'text-[11px] font-medium',
                            offloaded || unassigned ? 'text-slate-400' : checked ? 'text-emerald-400' : 'text-amber-400'
                          )}>
                            {offloaded
                              ? 'Retained in history'
                              : unassigned
                                ? 'Low priority · inactive pool'
                                : checked
                                  ? `Checked ${device.lastChecked}`
                                  : 'Not checked this month'}
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
        <aside className={cn('dual-pane-detail flex flex-col justify-between', mobileDetailOpen && 'mobile-detail-open')}>
          {selectedDevice ? (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                className="mobile-detail-back -mx-1 hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <ArrowLeft size={17} />
                Back to device roster
              </button>

              {/* Header Profile */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Device Inspection
                  </span>
                  <Badge
                    tone={isOffloaded(selectedDevice) || isUnassigned(selectedDevice) ? 'neutral' : isActivated(selectedDevice) ? 'success' : 'warning'}
                    size="xs"
                  >
                    {isOffloaded(selectedDevice)
                      ? 'Offloaded History'
                      : isUnassigned(selectedDevice)
                        ? 'Inactive Pool'
                        : isActivated(selectedDevice)
                          ? 'Active SIM'
                          : 'Needs Review'}
                  </Badge>
                </div>
                <h2 className="mt-2 text-xl font-bold text-[var(--text)] tracking-tight">
                  {isInactivePool(selectedDevice)
                    ? 'Unassigned'
                    : `${selectedDevice.make} ${selectedDevice.model || 'Demo Unit'}`}
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
                  isOffloaded(selectedDevice) || isUnassigned(selectedDevice)
                    ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
                    : checkedThisMonth(selectedDevice.lastChecked)
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                )}
              >
                <div className="flex items-start gap-3">
                  {isOffloaded(selectedDevice) ? (
                    <Archive size={20} className="text-slate-400 shrink-0 mt-0.5" />
                  ) : isUnassigned(selectedDevice) ? (
                    <Layers size={20} className="text-slate-400 shrink-0 mt-0.5" />
                  ) : checkedThisMonth(selectedDevice.lastChecked) ? (
                    <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      {isOffloaded(selectedDevice)
                        ? 'Offloaded From Demo Floor'
                        : isUnassigned(selectedDevice)
                          ? 'Unassigned Inactive Pool'
                          : checkedThisMonth(selectedDevice.lastChecked)
                            ? 'Floor Audit Complete'
                            : 'Audit Required For Current Cycle'}
                    </h4>
                    <p className="text-xs mt-1 text-[var(--text-secondary)]">
                      {isOffloaded(selectedDevice)
                        ? `Record retained. Last handled on ${selectedDevice.lastChecked || 'an unknown date'} by ${selectedDevice.checkedBy || 'Floor Staff'}.`
                        : isUnassigned(selectedDevice)
                          ? 'Low-priority record held outside the active floor audit cycle until a device is assigned.'
                          : checkedThisMonth(selectedDevice.lastChecked)
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

              {/* Scannable IMEI Barcode */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    IMEI Barcode
                  </h4>
                  <span className="text-[10px] text-[var(--text-tertiary)]">CODE 128</span>
                </div>
                <div className="mt-3 flex items-center justify-center rounded-xl bg-white px-3 py-3 text-[#111827]">
                  {isScannableImei(selectedDevice.imei) ? (
                    <DeviceImeiBarcode imei={selectedDevice.imei} />
                  ) : (
                    <span className="py-4 text-xs text-[#64748b]">No scannable IMEI on file for this line.</span>
                  )}
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
                {isUnassigned(selectedDevice) && !isOffloaded(selectedDevice) ? (
                  <Button
                    variant="secondary"
                    className="w-full justify-center"
                    icon={<Pencil size={15} />}
                    onClick={() => openEditor(selectedDevice)}
                  >
                    Assign Device
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    className="w-full justify-center"
                    icon={isOffloaded(selectedDevice) ? <ArchiveRestore size={16} /> : <ShieldCheck size={16} />}
                    onClick={() => openAudit(selectedDevice)}
                    disabled={saving}
                  >
                    {isOffloaded(selectedDevice)
                      ? 'Review History or Return to Floor'
                      : checkedThisMonth(selectedDevice.lastChecked)
                        ? 'Re-Audit Device'
                        : 'Start Device Audit'}
                  </Button>
                )}

                {!isOffloaded(selectedDevice) && !isUnassigned(selectedDevice) && (
                  <Button
                    variant="secondary"
                    className="w-full justify-center"
                    icon={<Pencil size={15} />}
                    onClick={() => openEditor(selectedDevice)}
                  >
                    Edit Specifications
                  </Button>
                )}
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

      {/* Device Audit Modal */}
      <Modal
        open={Boolean(auditing)}
        onClose={() => !saving && setAuditing(null)}
        title={auditing && isOffloaded(auditing) ? 'Offloaded Device History' : 'Complete Device Audit'}
        subtitle={auditing ? `${auditing.make} ${auditing.model} · ${auditing.mdn || 'No MDN'}` : undefined}
        size="lg"
        className="h-[100dvh] max-h-[100dvh] rounded-none border-x-0 border-b-0 sm:h-auto sm:max-h-[88vh] sm:rounded-3xl sm:border"
        contentClassName="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      >
        {auditing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-xs">
              <div>
                <div className="text-[var(--text-tertiary)]">Device</div>
                <div className="mt-1 font-semibold text-[var(--text)]">{auditing.make} {auditing.model}</div>
              </div>
              <div>
                <div className="text-[var(--text-tertiary)]">IMEI</div>
                <div className="mt-1 break-all font-mono font-semibold text-[var(--text)]">{auditing.imei || '—'}</div>
              </div>
              <div>
                <div className="text-[var(--text-tertiary)]">Last audit</div>
                <div className="mt-1 font-semibold text-[var(--text)]">{auditing.lastChecked || 'Never'}</div>
              </div>
              <div>
                <div className="text-[var(--text-tertiary)]">Audited by</div>
                <div className="mt-1 font-semibold text-[var(--text)]">{auditing.checkedBy || '—'}</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Activation Status"
                value={auditDraft.activationStatus}
                onChange={(e) => setAuditDraft({ ...auditDraft, activationStatus: e.target.value })}
              >
                <option value="">Select status</option>
                <option value="Active">Active (Live SIM)</option>
                <option value="Inactive">Inactive (Needs Activation)</option>
                <option value="Needs attention">Needs Attention / Damaged</option>
              </Select>
              <Select
                label="Floor Status"
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value as AuditAction)}
              >
                {isOffloaded(auditing) ? (
                  <>
                    <option value="archived">Offloaded / Device History</option>
                    <option value="restore">Return to Demo Floor</option>
                  </>
                ) : (
                  <>
                    <option value="keep">Active / On Demo Floor</option>
                    <option value="offload">Offload to Device History</option>
                  </>
                )}
              </Select>
              <div className="sm:col-span-2">
                <Select
                  label="Information Matches Physical Device"
                  value={auditDraft.informationMatches}
                  onChange={(e) => setAuditDraft({ ...auditDraft, informationMatches: e.target.value })}
                >
                  <option value="">Select verification</option>
                  <option value="Yes">Yes, everything matches</option>
                  <option value="No">No, discrepancy found</option>
                </Select>
              </div>
            </div>

            <Textarea
              label={isOffloaded(auditing) ? 'Preserved Device History & Notes' : 'Audit Notes'}
              value={auditDraft.notes}
              onChange={(e) => setAuditDraft({ ...auditDraft, notes: e.target.value })}
              rows={3}
              placeholder="Condition, security tether, display location, or discrepancy…"
            />

            {auditAction === 'offload' && (
              <Textarea
                label="Offload Reason"
                value={offloadReason}
                onChange={(e) => setOffloadReason(e.target.value)}
                rows={2}
                placeholder="Returned, replaced, damaged, transferred, or another reason…"
              />
            )}

            {auditAction === 'restore' && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-[var(--text-secondary)]">
                <ArchiveRestore size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>This device will return to the active floor roster after the audit is saved.</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-medium text-rose-300" role="alert">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2.5 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setAuditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant={auditAction === 'offload' ? 'secondary' : 'primary'}
                icon={auditAction === 'offload' ? <Archive size={16} /> : auditAction === 'restore' ? <ArchiveRestore size={16} /> : <ShieldCheck size={16} />}
                onClick={() => void completeAudit()}
                disabled={saving}
              >
                {saving
                  ? 'Saving to Cloud…'
                  : auditAction === 'offload'
                    ? 'Complete Audit & Offload'
                    : auditAction === 'restore'
                      ? 'Audit & Return to Floor'
                      : auditAction === 'archived'
                        ? 'Close History'
                        : 'Complete Audit'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Device Modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        title="Edit Demo Device Record"
        subtitle="Update phone, account, and hardware identifiers"
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
          <Button variant="primary" onClick={() => void save(draft)} disabled={saving}>
            {saving ? 'Saving to Cloud…' : 'Save Device Details'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

