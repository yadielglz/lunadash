import { useState } from 'react'
import { KeyRound, Monitor, ShieldCheck, Smartphone } from 'lucide-react'
import { dbAuthenticateAccess } from '../lib/supabase'
import { hashPin } from '../store/lockStore'
import { AccessMode, useUiStore } from '../store/uiStore'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { APP_META } from '../config/appMeta'
import { LunaWirelessLogo } from './brand/LunaWirelessLogo'

const DEALER_PLACEHOLDERS = ['1047293', '2384517', '4829160', '7603148', '9158026']
const LOGIN_BACKDROP_URL = 'https://i.ibb.co/39JLm174/Wall.png'

export function StoreLaunchScreen() {
  const setAccessSession = useUiStore((s) => s.setAccessSession)
  const [dealerPlaceholder] = useState(() => DEALER_PLACEHOLDERS[Math.floor(Math.random() * DEALER_PLACEHOLDERS.length)])
  const [dealerCode, setDealerCode] = useState('')
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<'manager' | 'display'>('manager')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    const code = dealerCode.trim()
    const cleanPin = pin.trim()
    if (!/^\d{7}$/.test(code)) {
      setError('Dealer code must be 7 digits.')
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
        setError('Dealer code or PIN was not recognized.')
        return
      }

      const accessMode: AccessMode = access.role === 'admin'
        ? 'admin'
        : access.role === 'display'
          ? 'display'
          : mode

      setAccessSession({
        id: access.id,
        storeId: access.store_id,
        role: access.role,
        dealerCode: access.dealer_code,
        label: access.label,
        onboardedAt: access.onboarded_at,
        mode: accessMode,
      })
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
      <div className="relative w-full max-w-md rounded-xl border border-white/12 bg-[var(--surface)]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden backdrop-blur-md">
        <div className="relative px-6 pt-7 pb-5 border-b border-[var(--border)] bg-[var(--surface-2)]/92">
          <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" />
          <div className="flex flex-col items-center text-center">
            <LunaWirelessLogo className="h-20 w-52" />
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-[var(--accent)]/12 text-[var(--accent)] flex items-center justify-center">
                <KeyRound size={16} />
              </span>
              <div className="text-left">
                <h1 className="text-lg font-semibold text-[var(--text)]">LunaDash Access</h1>
                <p className="text-xs text-[var(--text-secondary)]">Enter your dealer code and 4-digit PIN.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:hidden">
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
                    : 'border-[var(--border)] text-[var(--text-secondary)] bg-[var(--surface-2)]'
                }`}
              >
                {choice.icon}
                {choice.label}
              </button>
            ))}
          </div>

          <Input
            label="Dealer Code"
            inputMode="numeric"
            maxLength={7}
            value={dealerCode}
            onChange={(e) => {
              setDealerCode(e.target.value.replace(/\D/g, '').slice(0, 7))
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
            disabled={dealerCode.length !== 7 || pin.length !== 4}
          >
            Continue
          </Button>

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
