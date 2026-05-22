import { useState } from 'react'
import { KeyRound, Monitor, ShieldCheck, Smartphone } from 'lucide-react'
import { dbAuthenticateAccess } from '../lib/supabase'
import { hashPin } from '../store/lockStore'
import { AccessMode, useUiStore } from '../store/uiStore'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { APP_META } from '../config/appMeta'

const DEALER_PLACEHOLDERS = ['1047293', '2384517', '4829160', '7603148', '9158026']

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
          : access.role === 'employee'
            ? 'manager'
            : mode

      setAccessSession({
        storeId: access.store_id,
        role: access.role,
        dealerCode: access.dealer_code,
        label: access.label,
        mode: accessMode,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not validate access.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg)] px-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-modal)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[var(--accent)]/12 text-[var(--accent)] flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">LunaDash Access</h1>
            <p className="text-xs text-[var(--text-secondary)]">Enter your dealer code and 4-digit PIN.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
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
