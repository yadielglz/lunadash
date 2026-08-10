import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, Pencil, RefreshCw, Search, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Input, Select, Textarea } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { ModuleHeader, ModuleSkeleton } from '../../ui/ModulePrimitives'
import { useUiStore } from '../../../store/uiStore'
import { cn } from '../../../lib/utils'
import { DEMO_SHEET_URL, fetchDemoDevices, updateDemoDevice, type DemoDevice } from '../../../lib/demoDevices'

const EMPTY_DEVICE: DemoDevice = { rowNumber: 0, mdn: '', make: '', model: '', imei: '', imeiBarcode: '', lastChecked: '', notes: '', account: '', activationStatus: '', informationMatches: '', checkedBy: '' }

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

export function DevicesPage() {
  const { accessId, accessRole, storeId } = useUiStore()
  const [devices, setDevices] = useState<DemoDevice[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<DemoDevice | null>(null)
  const [draft, setDraft] = useState<DemoDevice>(EMPTY_DEVICE)

  const load = async () => {
    setLoading(true)
    setError('')
    try { setDevices(await fetchDemoDevices()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load demo devices.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return devices
    return devices.filter((device) => [device.mdn, device.make, device.model, device.imei, device.notes, device.account].some((value) => value.toLowerCase().includes(query)))
  }, [devices, search])

  const verified = devices.filter((device) => checkedThisMonth(device.lastChecked)).length
  const active = devices.filter(isActivated).length

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
    const next = { ...device, lastChecked: verifiedNow ? todayForSheet() : device.lastChecked, checkedBy: verifiedNow ? (useUiStore.getState().accessLabel || device.checkedBy) : device.checkedBy }
    try {
      await updateDemoDevice({ ...next, accessId, accessRole: accessRole ?? '', storeCode: storeId })
      setDevices((items) => items.map((item) => item.rowNumber === next.rowNumber ? next : item))
      setEditing(null)
      setMessage(verifiedNow ? `${next.mdn} verified and written to Google Sheets.` : `${next.mdn} updated in Google Sheets.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the device.')
    } finally { setSaving(false) }
  }

  return (
    <div className="tool-suite devices-tool-page flex h-full flex-col bg-[var(--bg)]">
      <ModuleHeader
        icon={<Smartphone size={18} />}
        eyebrow="Store 693D · Management"
        title="Demo Management"
        description="Keep floor devices activated, identified, and verified against the live roster."
        meta={<span>{loading ? 'Loading roster…' : `${devices.length} demo lines · ${verified} checked this month`}</span>}
        actions={<div className="flex gap-2">
          <Button size="icon" variant="ghost" title="Refresh roster" icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />} onClick={() => void load()}><span className="sr-only">Refresh</span></Button>
          <Button variant="secondary" icon={<ExternalLink size={15} />} onClick={() => window.open(DEMO_SHEET_URL, '_blank', 'noopener,noreferrer')}>Open sheet</Button>
        </div>}
      />

      <div className="tool-content flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4"><div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Demo lines</div><div className="mt-1 text-2xl font-semibold text-[var(--text)]">{devices.length}</div></Card>
            <Card className="p-4"><div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Activated</div><div className="mt-1 text-2xl font-semibold text-emerald-400">{active}</div></Card>
            <Card className="p-4"><div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Checked this month</div><div className="mt-1 text-2xl font-semibold text-[var(--accent)]">{verified}/{devices.length}</div></Card>
          </div>

          {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 size={16} />{message}</div>}
          {error && <div className="flex items-center gap-2 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300"><AlertCircle size={16} />{error}</div>}

          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search phone, model, IMEI, account, or notes" className="pl-9" /></div>

          {loading ? <ModuleSkeleton rows={6} /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((device) => {
                const activated = isActivated(device)
                const checked = checkedThisMonth(device.lastChecked)
                return <Card key={device.rowNumber} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', activated ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400')}><Smartphone size={19} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--text)]">{device.make && device.make !== '-' ? `${device.make} ${device.model}` : 'Unassigned demo line'}</h3><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', activated ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400')}>{activated ? 'Activated' : 'Review'}</span></div>
                      <div className="mt-1 font-mono text-sm text-[var(--text-secondary)]">{device.mdn || 'No phone number'}</div>
                      <div className="mt-2 grid gap-1 text-xs text-[var(--text-tertiary)] sm:grid-cols-2"><span>IMEI: {device.imei || '—'}</span><span>Account: {device.account || '—'}</span><span>Last checked: {device.lastChecked || 'Never'}</span>{device.notes && <span className="truncate">Note: {device.notes}</span>}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border)] pt-3"><Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => openEditor(device)}>Edit details</Button><Button size="sm" disabled={saving} icon={<ShieldCheck size={14} />} onClick={() => openEditor(device)}>{checked ? 'Review check' : 'Verify device'}</Button></div>
                </Card>
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={Boolean(editing)} onClose={() => !saving && setEditing(null)} title="Edit demo device" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone number (MDN)" value={draft.mdn} onChange={(e) => setDraft({ ...draft, mdn: e.target.value })} />
          <Input label="Account" value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value })} />
          <Input label="Device make" value={draft.make} onChange={(e) => setDraft({ ...draft, make: e.target.value })} />
          <Input label="Device model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
          <Input label="IMEI" value={draft.imei} onChange={(e) => setDraft({ ...draft, imei: e.target.value })} />
          <Input label="IMEI barcode" value={draft.imeiBarcode} onChange={(e) => setDraft({ ...draft, imeiBarcode: e.target.value })} />
          <Input label="Last checked" placeholder="M/D" value={draft.lastChecked} onChange={(e) => setDraft({ ...draft, lastChecked: e.target.value })} />
          <Select label="Activation status" value={draft.activationStatus} onChange={(e) => setDraft({ ...draft, activationStatus: e.target.value })}><option value="">Select status</option><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Needs attention">Needs attention</option></Select>
          <Select label="Information matches" value={draft.informationMatches} onChange={(e) => setDraft({ ...draft, informationMatches: e.target.value })}><option value="">Select result</option><option value="Yes">Yes</option><option value="No">No</option></Select>
          <Input label="Checked by" value={draft.checkedBy} onChange={(e) => setDraft({ ...draft, checkedBy: e.target.value })} />
          <div className="sm:col-span-2"><Textarea label="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} /></div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button variant="secondary" onClick={() => void save(draft)} disabled={saving}>Save details</Button><Button icon={<ShieldCheck size={15} />} onClick={() => void save(draft, true)} disabled={saving}>{saving ? 'Saving…' : 'Save & verify today'}</Button></div>
      </Modal>
    </div>
  )
}
