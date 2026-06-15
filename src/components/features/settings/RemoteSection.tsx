import { useEffect, useState } from 'react'
import { Check, MonitorCheck, RefreshCw, X } from 'lucide-react'
import {
  dbGetKioskEnrollments,
  dbGetStores,
  dbUpdateKioskEnrollment,
  type KioskEnrollment,
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
  const firstAssignableStoreId = stores.find((store) => normalizeStoreId(store.store_id) !== 'main')?.store_id ?? ''

  const loadStores = async () => {
    try {
      setStores((await dbGetStores()).filter((store) => normalizeStoreId(store.store_id) !== 'main'))
    } catch {
      setStores([])
    }
  }

  const loadKioskEnrollments = async () => {
    if (!canManageRemote) return
    setLoading(true)
    setError('')
    try {
      const enrollments = await dbGetKioskEnrollments()
      setKioskEnrollments(enrollments)
      setKioskStoreById((current) => {
        const next = { ...current }
        enrollments.forEach((enrollment) => {
          if (!next[enrollment.id] || normalizeStoreId(next[enrollment.id]) === 'main') {
            next[enrollment.id] = firstAssignableStoreId
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
  }

  useEffect(() => {
    if (!canManageRemote) return
    loadStores()
  }, [canManageRemote])

  useEffect(() => {
    if (!canManageRemote) return
    loadKioskEnrollments()
    const id = window.setInterval(loadKioskEnrollments, 10000)
    return () => window.clearInterval(id)
  }, [canManageRemote, stores.length])

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

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </Section>
  )
}
