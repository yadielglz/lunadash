import { useState } from 'react'
import { KeyRound, Monitor, ShieldCheck, Smartphone, Store } from 'lucide-react'
import { dbAuthenticateAccess, dbGetStores, type StoreAccessCode, type StoreSummary } from '../lib/supabase'
import { hashPin } from '../store/lockStore'
import { AccessMode, accessRoleLabel, useUiStore } from '../store/uiStore'
import { normalizeAccessCode, normalizeStoreId } from '../lib/storeIds'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { APP_META } from '../config/appMeta'
import { LunaWirelessLogo } from './brand/LunaWirelessLogo'

const DEALER_PLACEHOLDERS = ['693D', 'admin', 'Gateway']
const LOGIN_BACKDROP_URL = 'https://i.ibb.co/39JLm174/Wall.png'

type PendingAccess = {
  access: StoreAccessCode
  stores: StoreSummary[]
}

function isValidLoginCode(value: string) {
  return /^[A-Z0-9_-]{2,20}$/i.test(value) || value.trim().toLowerCase() === 'admin'
}

export function StoreLaunchScreen() {
  const setAccessSession = useUiStore((s) => s.setAccessSession)
  const theme = useUiStore((s) => s.theme)
  const [dealerPlaceholder] = useState(() => DEALER_PLACEHOLDERS[Math.floor(Math.random() * DEALER_PLACEHOLDERS.length)])
  const [showLogin, setShowLogin] = useState(false)
  const [dealerCode, setDealerCode] = useState('')
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<'manager' | 'display'>('manager')
  const [pendingAccess, setPendingAccess] = useState<PendingAccess | null>(null)
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const darkLogin = theme === 'dark' || theme === 'vista'
  const compactLogin = Boolean(pendingAccess)

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

  const login = async () => {
    const code = normalizeAccessCode(dealerCode)
    const cleanPin = pin.trim()
    if (!isValidLoginCode(code)) {
      setError('Use the store ID or admin login.')
      return
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('PIN must be 4 digits.')
      return
    }

    setIsLoading(true)
    setError('')
    try {
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
      className="relative h-full w-full flex items-center justify-center bg-[var(--bg)] px-6 overflow-hidden"
      style={{
        backgroundImage: `url(${LOGIN_BACKDROP_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,122,216,0.18),transparent_45%)]" />
      <div className={`login-card ${darkLogin ? 'login-card-dark' : 'login-card-light'} relative flex max-h-[calc(100vh-48px)] w-full max-w-md flex-col overflow-hidden rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md`}>
        <div className={`login-card-header relative border-b px-6 ${compactLogin ? 'pt-5 pb-4' : 'pt-7 pb-5'}`}>
          <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" />
          <div className="flex flex-col items-center text-center">
            <LunaWirelessLogo className={compactLogin ? 'h-16 w-44' : 'h-20 w-52'} tone={darkLogin ? 'dark-surface' : 'light-surface'} />
            <div className={`${compactLogin ? 'mt-3' : 'mt-4'} flex items-center justify-center gap-2`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent)]">
                <KeyRound size={16} />
              </span>
              <div className="text-left">
                <h1 className="text-lg font-semibold text-[var(--text)]">LunaDash Access</h1>
                <p className="text-xs text-[var(--text-secondary)]">{showLogin || pendingAccess ? 'Enter your store login and 4-digit PIN.' : 'Store workspace and display access.'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`${compactLogin ? 'space-y-3 p-5' : 'space-y-4 p-6'} min-h-0 overflow-y-auto`}>
          {pendingAccess ? (
            <>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2.5 shadow-sm">
                <p className="text-sm font-semibold text-[var(--text)]">Choose store</p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {pendingAccess.access.label || 'Access session'} · {accessRoleLabel(pendingAccess.access.role)}
                </p>
              </div>

              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {pendingAccess.access.role === 'admin' && (
                  <button
                    onClick={() => setSelectedStoreId('main')}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selectedStoreId === 'main'
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_26px_rgba(15,122,216,0.26)]'
                        : 'border-[var(--border)] bg-[var(--surface-solid)] text-[var(--text)] shadow-sm hover:border-[var(--accent)]/45 hover:bg-[var(--surface-3)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Store size={14} className={selectedStoreId === 'main' ? 'text-white' : 'text-[var(--accent)]'} />
                      <span className="text-sm font-semibold">Main Dashboard</span>
                    </div>
                    <p className={`mt-0.5 text-xs ${selectedStoreId === 'main' ? 'text-white/82' : 'text-[var(--text-secondary)]'}`}>All configured stores</p>
                  </button>
                )}

                {pendingAccess.stores.map((store) => {
                  const selected = selectedStoreId === store.store_id
                  return (
                    <button
                      key={store.store_id}
                      onClick={() => setSelectedStoreId(store.store_id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_26px_rgba(15,122,216,0.26)]'
                          : 'border-[var(--border)] bg-[var(--surface-solid)] text-[var(--text)] shadow-sm hover:border-[var(--accent)]/45 hover:bg-[var(--surface-3)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{store.company_name || store.store_id}</span>
                        <span className={`font-mono text-xs ${selected ? 'text-white/82' : 'text-[var(--text-secondary)]'}`}>{store.store_id}</span>
                      </div>
                      <p className={`mt-0.5 text-xs ${selected ? 'text-white/82' : 'text-[var(--text-secondary)]'}`}>
                        {store.store_number ? `Store #${store.store_number}` : 'Configured store'}
                      </p>
                    </button>
                  )
                })}
              </div>

              {pendingAccess.access.role !== 'admin' && pendingAccess.access.role !== 'display' && selectedStoreId !== 'main' && (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'manager', label: 'Manage', icon: <Smartphone size={14} /> },
                    { id: 'display', label: 'Display', icon: <Monitor size={14} /> },
                  ] as const).map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => setMode(choice.id)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 ${
                        mode === choice.id
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] bg-[var(--surface-solid)]'
                      }`}
                    >
                      {choice.icon}
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
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
                  className="flex-1"
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
                  Open Store
                </Button>
              </div>
            </>
          ) : !showLogin ? (
            <>
              <Button
                className="w-full"
                variant="primary"
                icon={<KeyRound size={14} />}
                onClick={() => setShowLogin(true)}
              >
                Login
              </Button>
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
                placeholder={dealerPlaceholder}
              />
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

              {error && <p className="text-xs text-red-400">{error}</p>}

              <Button
                className="w-full"
                variant="primary"
                icon={<ShieldCheck size={14} />}
                loading={isLoading}
                onClick={login}
                disabled={!isValidLoginCode(dealerCode) || pin.length !== 4}
              >
                Continue
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => {
                  setShowLogin(false)
                  setDealerCode('')
                  setPin('')
                  setError('')
                }}
              >
                Cancel
              </Button>
            </>
          )}

          <div className="border-t border-[var(--border)] pt-3 text-center">
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {APP_META.name} ver {APP_META.version} · Build {APP_META.build}
            </p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{APP_META.copyright}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
