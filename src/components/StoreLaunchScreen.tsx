import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, Building2, KeyRound, Loader2, LockKeyhole, Monitor, ShieldCheck, Smartphone, Store, Tag, Wifi } from 'lucide-react'
import {
  dbAuthenticateAccess,
  dbCreateKioskEnrollment,
  dbGetKioskEnrollmentByToken,
  dbGetStores,
  dbTouchKioskEnrollment,
  type KioskEnrollment,
  type StoreAccessCode,
  type StoreSummary,
} from '../lib/supabase'
import { hashPin } from '../store/lockStore'
import { AccessMode, accessRoleLabel, useUiStore } from '../store/uiStore'
import { normalizeAccessCode, normalizeStoreId } from '../lib/storeIds'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Input'
import { APP_META } from '../config/appMeta'
import { LunaWirelessLogo } from './brand/LunaWirelessLogo'

const DEALER_PLACEHOLDERS = ['693D', 'admin', 'Gateway']
const LOGIN_BACKDROP_URL = 'https://i.ibb.co/39JLm174/Wall.png'
const KIOSK_LOGIN_CODE = 'KIOSK'
const KIOSK_ENROLLMENT_KEY = 'luna-kiosk-enrollment-token'

type PendingAccess = {
  access: StoreAccessCode
  stores: StoreSummary[]
}

function isValidLoginCode(value: string) {
  return /^[A-Z0-9_-]{2,20}$/i.test(value) || value.trim().toLowerCase() === 'admin'
}

function AccessStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.14] bg-white/[0.08] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-white/[0.58]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function LoginNotice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'error' }) {
  const toneClass = tone === 'error'
    ? 'border-red-500/25 bg-red-500/10 text-red-100'
    : tone === 'warning'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-100'
      : 'border-white/[0.12] bg-white/[0.08] text-white/[0.72]'

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${toneClass}`}>
      <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function StoreLaunchScreen() {
  const setAccessSession = useUiStore((s) => s.setAccessSession)
  const [dealerPlaceholder] = useState(() => DEALER_PLACEHOLDERS[Math.floor(Math.random() * DEALER_PLACEHOLDERS.length)])
  const [dealerCode, setDealerCode] = useState('')
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<'manager' | 'display'>('manager')
  const [pendingAccess, setPendingAccess] = useState<PendingAccess | null>(null)
  const [kioskEnrollment, setKioskEnrollment] = useState<KioskEnrollment | null>(null)
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const compactLogin = Boolean(pendingAccess || kioskEnrollment)
  const isKioskLogin = normalizeAccessCode(dealerCode) === KIOSK_LOGIN_CODE
  const limitedBrowserContext = typeof window !== 'undefined' && !window.isSecureContext

  const completeKioskEnrollment = (enrollment: KioskEnrollment) => {
    if (!enrollment.store_id || enrollment.status !== 'approved') return
    setAccessSession({
      id: enrollment.id,
      storeId: enrollment.store_id,
      role: 'display',
      dealerCode: KIOSK_LOGIN_CODE,
      label: enrollment.display_name || 'Kiosk Display',
      onboardedAt: enrollment.approved_at ?? new Date().toISOString(),
      mode: 'display',
    })
  }

  const completeLogin = (access: StoreAccessCode, accessMode: AccessMode, storeId: string) => {
    setAccessSession({
      id: access.id,
      storeId: normalizeStoreId(storeId),
      role: access.role,
      dealerCode: access.dealer_code,
      label: access.label,
      onboardedAt: access.onboarded_at,
      mode: accessMode,
    })
  }

  useEffect(() => {
    const token = window.localStorage.getItem(KIOSK_ENROLLMENT_KEY)
    if (!token) return
    let cancelled = false
    dbGetKioskEnrollmentByToken(token)
      .then((enrollment) => {
        if (cancelled || !enrollment) {
          if (!cancelled) window.localStorage.removeItem(KIOSK_ENROLLMENT_KEY)
          return
        }
        if (enrollment.status === 'approved') completeKioskEnrollment(enrollment)
        else if (enrollment.status === 'pending') {
          setDealerCode(KIOSK_LOGIN_CODE)
          setKioskEnrollment(enrollment)
        } else {
          window.localStorage.removeItem(KIOSK_ENROLLMENT_KEY)
        }
      })
      .catch(() => window.localStorage.removeItem(KIOSK_ENROLLMENT_KEY))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!kioskEnrollment?.device_token) return
    let cancelled = false
    const checkEnrollment = async () => {
      try {
        await dbTouchKioskEnrollment(kioskEnrollment.device_token)
        const enrollment = await dbGetKioskEnrollmentByToken(kioskEnrollment.device_token)
        if (cancelled || !enrollment) return
        if (enrollment.status === 'approved') {
          completeKioskEnrollment(enrollment)
          return
        }
        if (enrollment.status === 'rejected') {
          window.localStorage.removeItem(KIOSK_ENROLLMENT_KEY)
          setKioskEnrollment(null)
          setError('This kiosk enrollment was rejected. Start a new pairing session.')
          return
        }
        setKioskEnrollment(enrollment)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not check kiosk enrollment.')
      }
    }
    checkEnrollment()
    const id = window.setInterval(checkEnrollment, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [kioskEnrollment?.device_token])

  const login = async () => {
    const code = normalizeAccessCode(dealerCode)
    const cleanPin = pin.trim()
    if (!isValidLoginCode(code)) {
      setError('Use the store ID or admin login.')
      return
    }
    if (code !== KIOSK_LOGIN_CODE && !/^\d{4}$/.test(cleanPin)) {
      setError('PIN must be 4 digits.')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      if (code === KIOSK_LOGIN_CODE) {
        const enrollment = await dbCreateKioskEnrollment('Kiosk browser')
        window.localStorage.setItem(KIOSK_ENROLLMENT_KEY, enrollment.device_token)
        setKioskEnrollment(enrollment)
        return
      }

      const access = await dbAuthenticateAccess(code, await hashPin(cleanPin))
      if (!access) {
        setError('Login or PIN was not recognized.')
        return
      }

      if (access.role === 'admin' || access.role === 'district_manager') {
        let stores: StoreSummary[] = []
        try {
          stores = await dbGetStores()
        } catch {
          stores = []
        }
        const accessStoreId = normalizeStoreId(access.store_id)
        const fallbackStore = { store_id: accessStoreId, company_name: accessStoreId, store_number: '', slide_interval: 8 }
        const availableStores = stores.length > 0 ? stores : [fallbackStore]
        const storesWithAccessStore = accessStoreId && accessStoreId !== 'main' && !availableStores.some((store) => normalizeStoreId(store.store_id) === accessStoreId)
          ? [fallbackStore, ...availableStores]
          : availableStores
        setPendingAccess({ access, stores: storesWithAccessStore })
        setSelectedStoreId(accessStoreId === 'main' ? storesWithAccessStore[0]?.store_id ?? '' : accessStoreId)
        return
      }

      if (access.role === 'display') {
        completeLogin(access, 'display', access.store_id)
        return
      }

      const accessStoreId = normalizeStoreId(access.store_id)
      const assignedStoreIds = Array.from(new Set((access.assigned_store_ids?.length ? access.assigned_store_ids : [accessStoreId]).map(normalizeStoreId).filter(Boolean)))
      let configuredStores: StoreSummary[] = []
      if (assignedStoreIds.length > 1) {
        try {
          configuredStores = await dbGetStores()
        } catch {
          configuredStores = []
        }
      }
      const storesById = new Map(configuredStores.map((store) => [normalizeStoreId(store.store_id), store]))
      const assignedStores = assignedStoreIds.map((id) => (
        storesById.get(id) ?? { store_id: id, company_name: id, store_number: '', slide_interval: 8 }
      ))
      setPendingAccess({
        access,
        stores: assignedStores.length > 0
          ? assignedStores
          : [{ store_id: accessStoreId, company_name: access.label || accessStoreId, store_number: '', slide_interval: 8 }],
      })
      setSelectedStoreId(assignedStores[0]?.store_id ?? accessStoreId)
      setMode('manager')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not validate access.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#07111f] p-4 text-white sm:p-6"
      style={{
        backgroundImage: `url(${LOGIN_BACKDROP_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-[#07111f]/[0.86]" />
      <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(7,17,31,0.95)_0%,rgba(7,17,31,0.82)_48%,rgba(7,17,31,0.68)_100%)]" />

      <main className="relative grid max-h-[calc(100vh-32px)] w-full max-w-6xl overflow-hidden rounded-lg border border-white/[0.16] bg-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="hidden min-h-[640px] flex-col justify-between border-r border-white/[0.12] bg-black/[0.18] p-8 lg:flex">
          <div>
            <div className="flex justify-center pt-6">
              <LunaWirelessLogo className="h-28 w-72" tone="dark-surface" />
            </div>
            <div className="mx-auto mt-10 max-w-xl text-center">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.14] bg-white/[0.08] px-3 py-1.5 text-xs font-semibold uppercase text-white/[0.68]">
                <LockKeyhole size={13} />
                Authorized access
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-normal text-white">
                One sign-in for store execution.
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/[0.68]">
                Open the right LunaDash workspace for store operations, district performance, or approved display screens.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <AccessStat icon={<Tag size={13} />} label="Version" value={APP_META.version} />
            <AccessStat icon={<Wifi size={13} />} label="Status" value={limitedBrowserContext ? 'LAN dev' : 'Secure context'} />
            <AccessStat icon={<Building2 size={13} />} label="Build" value={APP_META.build} />
          </div>
        </section>

        <section className={`login-card login-card-dark flex min-h-0 flex-col ${compactLogin ? 'lg:min-h-[560px]' : 'lg:min-h-[640px]'}`}>
          <div className="border-b border-[var(--border)] px-5 py-5 sm:px-7 lg:hidden">
            <div className="flex justify-center">
              <LunaWirelessLogo className="h-20 w-56" tone="dark-surface" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-7">
            <div className="mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/14 text-[var(--accent)]">
                {kioskEnrollment ? <Monitor size={19} /> : pendingAccess ? <Store size={19} /> : <KeyRound size={19} />}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal text-[var(--text)]">
                {kioskEnrollment ? 'Pair display' : pendingAccess ? 'Choose workspace' : 'Sign in'}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {kioskEnrollment
                  ? 'Admin approval is required before this screen opens.'
                  : pendingAccess
                    ? `${pendingAccess.access.label || 'Access session'} · ${accessRoleLabel(pendingAccess.access.role)}`
                    : 'Use your assigned login and 4-digit PIN.'}
              </p>
            </div>

            <div className="space-y-4">
              {limitedBrowserContext && (
                <LoginNotice tone="warning">
                  Network dev mode is running over plain HTTP. Login uses compatibility hashing, but some browser features may need HTTPS or localhost.
                </LoginNotice>
              )}

              {kioskEnrollment ? (
                <>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] px-4 py-4 text-center shadow-sm">
                    <p className="text-sm font-semibold text-[var(--text)]">Approval code</p>
                    <div className="mt-4 rounded-md border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-4 py-5 text-4xl font-black tracking-[0.22em] text-[var(--accent)]">
                      {kioskEnrollment.pairing_code}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)]">
                      <Loader2 size={13} className="animate-spin" />
                      Waiting for approval
                    </div>
                  </div>

                  {error && <LoginNotice tone="error">{error}</LoginNotice>}

                  <Button
                    className="w-full"
                    variant="ghost"
                    onClick={() => {
                      window.localStorage.removeItem(KIOSK_ENROLLMENT_KEY)
                      setKioskEnrollment(null)
                      setDealerCode('')
                      setError('')
                    }}
                  >
                    Cancel Pairing
                  </Button>
                </>
              ) : pendingAccess ? (
                <>
                  <Select
                    label="Store"
                    value={selectedStoreId}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedStoreId(event.target.value)}
                  >
                    {pendingAccess.access.role === 'admin' && (
                      <option value="main">Main Dashboard - All configured stores</option>
                    )}
                    {pendingAccess.stores.map((store) => {
                      const storeName = store.company_name || store.store_id
                      const storeNumber = store.store_number ? ` #${store.store_number}` : ''
                      return (
                        <option key={store.store_id} value={store.store_id}>
                          {storeName}{storeNumber} - {store.store_id}
                        </option>
                      )
                    })}
                  </Select>

                  {pendingAccess.access.role !== 'admin' && pendingAccess.access.role !== 'display' && selectedStoreId !== 'main' && (
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { id: 'manager', label: 'Manage', icon: <Smartphone size={14} /> },
                        { id: 'display', label: 'Display', icon: <Monitor size={14} /> },
                      ] as const).map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => setMode(choice.id)}
                          className={`flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                            mode === choice.id
                              ? 'border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]'
                              : 'border-[var(--border)] bg-[var(--surface-solid)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                          }`}
                        >
                          {choice.icon}
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {error && <LoginNotice tone="error">{error}</LoginNotice>}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPendingAccess(null)
                        setSelectedStoreId('')
                        setPin('')
                        setError('')
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      icon={<ShieldCheck size={14} />}
                      disabled={!selectedStoreId}
                      onClick={() => {
                        const accessMode: AccessMode = pendingAccess.access.role === 'admin'
                          ? 'admin'
                          : pendingAccess.access.role === 'display'
                            ? 'display'
                            : mode
                        completeLogin(pendingAccess.access, accessMode, selectedStoreId)
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Input
                    label="Store ID / Login"
                    autoCapitalize="characters"
                    maxLength={20}
                    value={dealerCode}
                    onChange={(e) => {
                      setDealerCode(normalizeAccessCode(e.target.value))
                      setError('')
                    }}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && isKioskLogin) login() }}
                    placeholder={dealerPlaceholder}
                  />
                  {!isKioskLogin && (
                    <Input
                      label="PIN"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                        setError('')
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') login() }}
                      placeholder="4-digit PIN"
                    />
                  )}

                  {error && <LoginNotice tone="error">{error}</LoginNotice>}

                  <Button
                    className="w-full"
                    variant="primary"
                    icon={<ShieldCheck size={14} />}
                    loading={isLoading}
                    onClick={login}
                    disabled={!isValidLoginCode(dealerCode) || (!isKioskLogin && pin.length !== 4)}
                  >
                    Continue
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      icon={<Monitor size={14} />}
                      onClick={() => {
                        setDealerCode(KIOSK_LOGIN_CODE)
                        setPin('')
                        setError('')
                      }}
                    >
                      Pair Display
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDealerCode('')
                        setPin('')
                        setError('')
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border)] px-5 py-3 text-center sm:px-7">
            <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{APP_META.copyright}</p>
          </div>
        </section>
      </main>
    </div>
  )
}
