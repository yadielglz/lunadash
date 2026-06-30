import { useCallback, useEffect, useState } from 'react'
import { Check, MonitorCheck, Power, RefreshCw, Trash2, X } from 'lucide-react'
import {
  dbDeleteKioskEnrollment,
  dbIssueKioskCommand,
  dbGetKioskEnrollments,
  dbGetStores,
  dbUpdateKioskEnrollment,
  type KioskEnrollment,
  type KioskRemoteCommand,
  type StoreSummary,
} from '../../../lib/supabase'
import { useUiStore } from '../../../store/uiStore'
import { normalizeStoreId } from '../../../lib/storeIds'
import { Button } from '../../ui/Button'
import { Input, Select } from '../../ui/Input'
import { Section } from './SettingsLayout'

export function RemoteSection() {
  const accessRole = useUiStore((state) => state.accessRole)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [kioskEnrollments, setKioskEnrollments] = useState<KioskEnrollment[]>([])
  const [kioskStoreById, setKioskStoreById] = useState<Record<string, string>>({})
  const [kioskNameById, setKioskNameById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canManageRemote = accessRole === 'admin' || accessRole === 'district_manager'
  const pendingKioskEnrollments = kioskEnrollments.filter((enrollment) => enrollment.status === 'pending')
  const managedKioskEnrollments = kioskEnrollments.filter((enrollment) => enrollment.status === 'approved')
  const firstAssignableStoreId = stores.find((store) => normalizeStoreId(store.store_id) !== 'main')?.store_id ?? ''

  const loadStores = useCallback(async () => {
    try {
      setStores((await dbGetStores()).filter((store) => normalizeStoreId(store.store_id) !== 'main'))
    } catch {
      setStores([])
    }
  }, [])

  const loadKioskEnrollments = useCallback(async () => {
    if (!canManageRemote) return
    setLoading(true)
    setError('')
    try {
      const enrollments = await dbGetKioskEnrollments()
      setKioskEnrollments(enrollments)
      setKioskStoreById((current) => {
        const next = { ...current }
        enrollments.forEach((enrollment) => {
          if (!next[enrollment.id]) {
            next[enrollment.id] = enrollment.store_id || firstAssignableStoreId
          }
          if (normalizeStoreId(next[enrollment.id]) === 'main') {
            next[enrollment.id] = enrollment.store_id || firstAssignableStoreId
          }
        })
        return next
      })
      setKioskNameById((current) => {
        const next = { ...current }
        enrollments.forEach((enrollment) => {
          if (!next[enrollment.id]) next[enrollment.id] = enrollment.display_name || 'Front Display'
        })
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load kiosk enrollments')
    } finally {
      setLoading(false)
    }
  }, [canManageRemote, firstAssignableStoreId])

  useEffect(() => {
    if (!canManageRemote) return
    loadStores()
  }, [canManageRemote, loadStores])

  useEffect(() => {
    if (!canManageRemote) return
    loadKioskEnrollments()
    const id = window.setInterval(loadKioskEnrollments, 10000)
    return () => window.clearInterval(id)
  }, [canManageRemote, loadKioskEnrollments, stores.length])

  const approveKioskEnrollment = async (enrollment: KioskEnrollment) => {
    const targetStore = normalizeStoreId(kioskStoreById[enrollment.id] || firstAssignableStoreId)
    if (!targetStore) {
      setError('Choose a store before approving the kiosk.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await dbUpdateKioskEnrollment(enrollment.id, {
        status: 'approved',
        store_id: targetStore,
        display_name: kioskNameById[enrollment.id]?.trim() || 'Kiosk Display',
        approved_at: new Date().toISOString(),
      })
      await loadKioskEnrollments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve kiosk enrollment')
    } finally {
      setLoading(false)
    }
  }

  const rejectKioskEnrollment = async (enrollment: KioskEnrollment) => {
    setLoading(true)
    setError('')
    try {
      await dbUpdateKioskEnrollment(enrollment.id, { status: 'rejected' })
      await loadKioskEnrollments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject kiosk enrollment')
    } finally {
      setLoading(false)
    }
  }

  const saveManagedDisplay = async (enrollment: KioskEnrollment) => {
    const targetStore = normalizeStoreId(kioskStoreById[enrollment.id] || enrollment.store_id || firstAssignableStoreId)
    if (!targetStore) {
      setError('Choose a store before saving the display.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await dbUpdateKioskEnrollment(enrollment.id, {
        store_id: targetStore,
        display_name: kioskNameById[enrollment.id]?.trim() || enrollment.display_name || 'Kiosk Display',
      })
      await loadKioskEnrollments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save display assignment')
    } finally {
      setLoading(false)
    }
  }

  const issueCommand = async (enrollment: KioskEnrollment, command: KioskRemoteCommand) => {
    setLoading(true)
    setError('')
    try {
      await dbIssueKioskCommand(enrollment.id, command)
      await loadKioskEnrollments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send remote command')
    } finally {
      setLoading(false)
    }
  }

  const clearCommand = async (enrollment: KioskEnrollment) => {
    setLoading(true)
    setError('')
    try {
      await dbUpdateKioskEnrollment(enrollment.id, {
        command: null,
        command_issued_at: null,
        command_ack_at: null,
      })
      await loadKioskEnrollments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear command status')
    } finally {
      setLoading(false)
    }
  }

  const disconnectDisplay = async (enrollment: KioskEnrollment) => {
    const name = enrollment.display_name || enrollment.pairing_code
    if (!window.confirm(`Disconnect ${name}? The kiosk browser will leave display mode on its next check-in.`)) return
    setLoading(true)
    setError('')
    try {
      await dbUpdateKioskEnrollment(enrollment.id, { status: 'rejected' })
      await loadKioskEnrollments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect display')
    } finally {
      setLoading(false)
    }
  }

  const deleteDisplay = async (enrollment: KioskEnrollment) => {
    const name = enrollment.display_name || enrollment.pairing_code
    if (!window.confirm(`Delete ${name} from Remote? If it is online, it will leave display mode on its next check-in.`)) return
    setLoading(true)
    setError('')
    try {
      await dbDeleteKioskEnrollment(enrollment.id)
      await loadKioskEnrollments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete display')
    } finally {
      setLoading(false)
    }
  }

  const lastSeenLabel = (enrollment: KioskEnrollment) => {
    if (!enrollment.last_seen_at) return { label: 'Never seen', tone: 'text-[var(--text-tertiary)]' }
    const ageMs = Date.now() - new Date(enrollment.last_seen_at).getTime()
    if (ageMs < 30_000) return { label: 'Online now', tone: 'text-emerald-400' }
    if (ageMs < 5 * 60_000) return { label: `Seen ${Math.max(1, Math.round(ageMs / 60_000))}m ago`, tone: 'text-amber-300' }
    return { label: `Seen ${new Date(enrollment.last_seen_at).toLocaleString()}`, tone: 'text-[var(--text-tertiary)]' }
  }

  const commandLabel = (enrollment: KioskEnrollment) => {
    if (!enrollment.command || !enrollment.command_issued_at) return 'No command sent'
    const acknowledged = enrollment.command_ack_at === enrollment.command_issued_at
    return `${enrollment.command === 'update' ? 'Update' : 'Refresh'} ${acknowledged ? 'acknowledged' : 'pending'}`
  }

  if (!canManageRemote) {
    return (
      <Section icon={<MonitorCheck size={14} />} title="Remote">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-5 text-sm text-[var(--text-secondary)]">
          Remote display management is available to district manager and admin sessions.
        </div>
      </Section>
    )
  }

  return (
    <Section icon={<MonitorCheck size={14} />} title="Remote">
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
                <MonitorCheck size={14} />
                Kiosk Enrollment
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Pair displays that sign in with KIOSK from a browser or Android TV kiosk app.
              </p>
            </div>
            <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} loading={loading} onClick={loadKioskEnrollments}>
              Refresh
            </Button>
          </div>

          {pendingKioskEnrollments.length > 0 ? (
            <div className="space-y-2">
              {pendingKioskEnrollments.map((enrollment) => {
                const targetStore = kioskStoreById[enrollment.id] || firstAssignableStoreId
                return (
                  <div key={enrollment.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-2xl font-black tracking-[0.18em] text-[var(--accent)]">{enrollment.pairing_code}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          Started {new Date(enrollment.created_at).toLocaleTimeString()} · {enrollment.last_seen_at ? `Seen ${new Date(enrollment.last_seen_at).toLocaleTimeString()}` : 'Waiting for heartbeat'}
                        </p>
                      </div>
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:max-w-xl">
                        <Input
                          label="Display Name"
                          value={kioskNameById[enrollment.id] ?? ''}
                          onChange={(event) => setKioskNameById((current) => ({ ...current, [enrollment.id]: event.target.value }))}
                          placeholder="Front Display"
                        />
                        <Select
                          label="Store"
                          value={targetStore}
                          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setKioskStoreById((current) => ({ ...current, [enrollment.id]: event.target.value }))}
                        >
                          {stores.map((store) => {
                            const id = normalizeStoreId(store.store_id)
                            return (
                              <option key={id} value={id}>
                                {store.company_name || id} - {id}
                              </option>
                            )
                          })}
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" icon={<X size={12} />} loading={loading} onClick={() => rejectKioskEnrollment(enrollment)}>
                          Reject
                        </Button>
                        <Button size="sm" icon={<Check size={12} />} loading={loading} disabled={!targetStore} onClick={() => approveKioskEnrollment(enrollment)}>
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
              No kiosk displays are waiting for approval.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text)]">Managed Displays</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Approved kiosk browsers report heartbeat status and accept remote commands.
              </p>
            </div>
            <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
              {managedKioskEnrollments.length} active
            </span>
          </div>

          {managedKioskEnrollments.length > 0 ? (
            <div className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {managedKioskEnrollments.map((enrollment) => {
                const seen = lastSeenLabel(enrollment)
                const targetStore = kioskStoreById[enrollment.id] || enrollment.store_id || firstAssignableStoreId
                return (
                  <div key={enrollment.id} className="flex flex-col gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{enrollment.display_name || 'Kiosk Display'}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                        Store {enrollment.store_id || 'unassigned'} · Code {enrollment.pairing_code} · {commandLabel(enrollment)}
                      </p>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          label="Display Name"
                          value={kioskNameById[enrollment.id] ?? ''}
                          onChange={(event) => setKioskNameById((current) => ({ ...current, [enrollment.id]: event.target.value }))}
                          placeholder="Front Display"
                        />
                        <Select
                          label="Assigned Store"
                          value={targetStore}
                          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setKioskStoreById((current) => ({ ...current, [enrollment.id]: event.target.value }))}
                        >
                          {stores.map((store) => {
                            const id = normalizeStoreId(store.store_id)
                            return (
                              <option key={id} value={id}>
                                {store.company_name || id} - {id}
                              </option>
                            )
                          })}
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className={`text-xs font-semibold ${seen.tone}`}>{seen.label}</span>
                        <Button size="sm" variant="ghost" loading={loading} disabled={!targetStore} onClick={() => saveManagedDisplay(enrollment)}>
                          Save
                        </Button>
                        {enrollment.command && (
                          <Button size="sm" variant="ghost" loading={loading} onClick={() => clearCommand(enrollment)}>
                            Clear Status
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} loading={loading} onClick={() => issueCommand(enrollment, 'refresh')}>
                          Force Refresh
                        </Button>
                        <Button size="sm" icon={<RefreshCw size={12} />} loading={loading} onClick={() => issueCommand(enrollment, 'update')}>
                          Force Update
                        </Button>
                        <Button size="sm" variant="ghost" icon={<Power size={12} />} loading={loading} onClick={() => disconnectDisplay(enrollment)}>
                          Disconnect
                        </Button>
                        <Button size="sm" variant="danger" icon={<Trash2 size={12} />} loading={loading} onClick={() => deleteDisplay(enrollment)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
              No approved kiosk displays yet. Pair a display with KIOSK, then approve it above.
            </p>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </Section>
  )
}
