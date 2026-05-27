import { useEffect, useState } from 'react'
import { KeyRound, Plus, Check, Edit2, Power, Trash2 } from 'lucide-react'
import { accessRoleLabel, useUiStore, AccessRole } from '../../../store/uiStore'
import { dbGetAccessCodes, dbCreateAccessCode, dbUpdateAccessCode, dbDeleteAccessCode, dbResetAccessOnboarding, StoreAccessCode } from '../../../lib/supabase'
import { Input, Select } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { hashPin } from '../../../store/lockStore'
import { normalizeAccessCode, normalizeStoreId } from '../../../lib/storeIds'
import { Section } from './SettingsLayout'

export function AccessSection() {
  const { accessRole, storeId, dealerCode, accessLabel } = useUiStore()
  const [codes, setCodes] = useState<StoreAccessCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dealer, setDealer] = useState('')
  const [pin, setPin] = useState('')
  const [newStoreId, setNewStoreId] = useState(storeId === 'main' ? '' : storeId)
  const [role, setRole] = useState<AccessRole>('employee')
  const [label, setLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDealer, setEditDealer] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editStoreId, setEditStoreId] = useState('')
  const [editRole, setEditRole] = useState<AccessRole>('employee')
  const [editPin, setEditPin] = useState('')

  const canManageAccess = accessRole === 'admin' || accessRole === 'district_manager' || accessRole === 'manager'
  const canCreateAccess = accessRole === 'admin' || accessRole === 'district_manager'
  const canAdministerAccess = accessRole === 'admin' || accessRole === 'district_manager'
  const visibleCodes = accessRole === 'admin'
    ? codes
    : codes.filter((code) => (
      normalizeStoreId(code.store_id) === normalizeStoreId(storeId)
      && (accessRole !== 'manager' || code.role === 'manager' || code.role === 'employee' || code.role === 'display')
    ))

  const isValidLoginCode = (value: string) => /^[A-Z0-9_-]{2,20}$/i.test(value.trim()) || value.trim().toLowerCase() === 'admin'

  const loadCodes = async () => {
    setLoading(true)
    setError('')
    try {
      setCodes(await dbGetAccessCodes())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load access codes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canManageAccess) loadCodes()
  }, [canManageAccess])

  const createCode = async () => {
    const cleanDealer = dealer.trim().toLowerCase() === 'admin' ? 'admin' : normalizeAccessCode(dealer)
    const cleanPin = pin.trim()
    const targetStore = accessRole === 'admin' ? normalizeStoreId(newStoreId) : normalizeStoreId(storeId)
    if (!isValidLoginCode(cleanDealer)) {
      setError('Login must be a store ID or admin code.')
      return
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('PIN must be 4 digits.')
      return
    }
    if (!targetStore) {
      setError('Store ID / SAP is required.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await dbCreateAccessCode({
        dealer_code: cleanDealer,
        store_id: targetStore,
        pin_hash: await hashPin(cleanPin),
        role,
        label: label.trim() || `${accessRoleLabel(role)} access`,
      })
      setDealer('')
      setPin('')
      setLabel('')
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create access code')
    } finally {
      setLoading(false)
    }
  }

  const toggleCode = async (code: StoreAccessCode) => {
    setLoading(true)
    setError('')
    try {
      await dbUpdateAccessCode(code.id, { is_active: !code.is_active })
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update access code')
    } finally {
      setLoading(false)
    }
  }

  const deleteCode = async (code: StoreAccessCode) => {
    if (code.id === 'built-in-admin') {
      setError('Built-in access cannot be deleted here.')
      return
    }
    if (accessRole !== 'admin' && normalizeStoreId(code.store_id) !== normalizeStoreId(storeId)) {
      setError('Managers can only delete access for their current store.')
      return
    }
    if (!window.confirm(`Delete access for ${code.label || code.dealer_code}? This cannot be undone.`)) return

    setLoading(true)
    setError('')
    try {
      await dbDeleteAccessCode(code.id)
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete access code')
    } finally {
      setLoading(false)
    }
  }

  const resetOnboarding = async (code: StoreAccessCode) => {
    setLoading(true)
    setError('')
    try {
      const saved = await dbResetAccessOnboarding(code.id)
      if (!saved) {
        setError('Run the latest schema.sql to enable first-login onboarding sync.')
      }
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset onboarding')
    } finally {
      setLoading(false)
    }
  }

  const startEditCode = (code: StoreAccessCode) => {
    setEditingId(code.id)
    setEditDealer(code.dealer_code)
    setEditLabel(code.label ?? '')
    setEditStoreId(normalizeStoreId(code.store_id))
    setEditRole(code.role)
    setEditPin('')
    setError('')
  }

  const cancelEditCode = () => {
    setEditingId(null)
    setEditDealer('')
    setEditLabel('')
    setEditStoreId('')
    setEditRole('employee')
    setEditPin('')
  }

  const saveEditCode = async (code: StoreAccessCode) => {
    const cleanDealer = editDealer.trim().toLowerCase() === 'admin' ? 'admin' : normalizeAccessCode(editDealer)
    const targetStore = accessRole === 'admin' ? normalizeStoreId(editStoreId) : normalizeStoreId(storeId)
    if (!isValidLoginCode(cleanDealer)) {
      setError('Login must be a store ID or admin code.')
      return
    }
    if (!editLabel.trim()) {
      setError('Name / label is required.')
      return
    }
    if (!targetStore) {
      setError('Store ID / SAP is required.')
      return
    }
    if (editPin && !/^\d{4}$/.test(editPin.trim())) {
      setError('New PIN must be 4 digits.')
      return
    }
    if (accessRole !== 'admin' && normalizeStoreId(code.store_id) !== normalizeStoreId(storeId)) {
      setError('Managers can only edit access for their current store.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await dbUpdateAccessCode(code.id, {
        ...(accessRole === 'admin' ? { dealer_code: cleanDealer } : {}),
        label: editLabel.trim(),
        store_id: targetStore,
        role: accessRole === 'admin'
          ? editRole
          : accessRole === 'district_manager'
            ? (editRole === 'admin' || editRole === 'district_manager') ? 'manager' : editRole
            : code.role,
        ...(editPin ? { pin_hash: await hashPin(editPin.trim()) } : {}),
      })
      cancelEditCode()
      await loadCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update access code')
    } finally {
      setLoading(false)
    }
  }

  if (!canManageAccess) {
    return (
      <Section icon={<KeyRound size={14} />} title="Access">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-5 text-sm text-[var(--text-secondary)]">
            Access management is available to manager sessions and up.
        </div>
      </Section>
    )
  }

  return (
    <Section icon={<KeyRound size={14} />} title="Access">
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--text)]">Current Session</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {accessLabel || 'Access user'} · Login {dealerCode || 'n/a'} · Role {accessRoleLabel(accessRole)} · Store {storeId || 'none'}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
            Store Access: Dashboard, Schedule, Performance, Weather settings, and Scheduling settings · Manager: assigned store operations · District Manager: district store operations · Admin: all stores and access management
          </p>
        </div>

        {canCreateAccess && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 space-y-3">
            <p className="text-xs font-semibold text-[var(--text)]">Create Access Code</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Input label="Login / Store ID" autoCapitalize="characters" maxLength={20} value={dealer} onChange={(e) => setDealer(normalizeAccessCode(e.target.value))} placeholder="693D or admin" />
              <Input label="PIN" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 digits" />
              <Input label="Store ID / SAP" value={accessRole === 'admin' ? newStoreId : storeId} onChange={(e) => setNewStoreId(normalizeStoreId(e.target.value))} disabled={accessRole !== 'admin'} placeholder="697D or main" />
              <Select label="Role" value={role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as AccessRole)}>
                {accessRole === 'admin' && <option value="admin">Admin</option>}
                {accessRole === 'admin' && <option value="district_manager">District Manager</option>}
                <option value="manager">Manager</option>
                <option value="employee">Store Access</option>
                <option value="display">Display</option>
              </Select>
              <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Manager name" />
            </div>
            <div className="flex justify-end">
              <Button size="sm" icon={<Plus size={12} />} loading={loading} onClick={createCode}>
                Add Access
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)] overflow-hidden">
          {visibleCodes.map((code) => {
            const isEditing = editingId === code.id
            return (
              <div key={code.id} className="px-4 py-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <Input label="Login / Username" autoCapitalize="characters" maxLength={20} value={accessRole === 'admin' ? editDealer : code.dealer_code} onChange={(e) => setEditDealer(normalizeAccessCode(e.target.value))} disabled={accessRole !== 'admin'} placeholder="693D or admin" />
                      <Input label="Name" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="User name" />
                      <Input label="Store ID / SAP" value={accessRole === 'admin' ? editStoreId : storeId} onChange={(e) => setEditStoreId(normalizeStoreId(e.target.value))} disabled={accessRole !== 'admin'} placeholder="697D or main" />
                      <Select label="Role" value={editRole} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditRole(e.target.value as AccessRole)} disabled={!canAdministerAccess}>
                        {accessRole === 'admin' && <option value="admin">Admin</option>}
                        {accessRole === 'admin' && <option value="district_manager">District Manager</option>}
                        <option value="manager">Manager</option>
                        <option value="employee">Store Access</option>
                        <option value="display">Display</option>
                      </Select>
                      <Input label="New PIN" type="password" inputMode="numeric" maxLength={4} value={editPin} onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Keep current" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelEditCode}>Cancel</Button>
                      <Button size="sm" icon={<Check size={12} />} loading={loading} onClick={() => saveEditCode(code)}>Save User</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{code.label || 'Access code'}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Login {code.dealer_code} · {code.store_id} · {accessRoleLabel(code.role)}
                        {code.last_used_at ? ` · Last used ${new Date(code.last_used_at).toLocaleDateString()}` : ''}
                        {code.onboarded_at ? ` · Intro completed ${new Date(code.onboarded_at).toLocaleDateString()}` : ' · Intro pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canAdministerAccess && code.onboarded_at && (
                        <Button size="sm" variant="ghost" onClick={() => resetOnboarding(code)}>
                          Reset Intro
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" icon={<Edit2 size={12} />} onClick={() => startEditCode(code)}>
                        Edit
                      </Button>
                      {canAdministerAccess && (
                        <>
                          <Button size="sm" variant={code.is_active ? 'ghost' : 'accent'} icon={<Power size={12} />} onClick={() => toggleCode(code)}>
                            {code.is_active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="danger" icon={<Trash2 size={12} />} onClick={() => deleteCode(code)}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {visibleCodes.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-[var(--text-tertiary)]">No access codes found.</p>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </Section>
  )
}
