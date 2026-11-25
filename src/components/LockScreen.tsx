import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Delete } from 'lucide-react'
import { useLockStore, hashPin } from '../store/lockStore'
import { LunaWirelessLogo } from './brand/LunaWirelessLogo'

const PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
]

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

interface LockScreenProps {
  inline?: boolean
  onUnlock?: () => void
}

export function LockScreen({ inline = false, onUnlock }: LockScreenProps = {}) {
  const { pinHash, unlock } = useLockStore()
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')
  const [, setAttempts] = useState(0)
  const [countdown, setCountdown] = useState(0)

  const isLockedOut = countdown > 0

  useEffect(() => {
    if (!isLockedOut) return
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setAttempts(0)
          setError('')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [isLockedOut])

  const triggerError = useCallback((attemptsAfter: number) => {
    if (attemptsAfter >= MAX_ATTEMPTS) {
      setError(`Too many attempts. Try again in ${LOCKOUT_SECONDS}s`)
      setCountdown(LOCKOUT_SECONDS)
    } else {
      const remaining = MAX_ATTEMPTS - attemptsAfter
      setError(`Incorrect PIN · ${remaining} attempt${remaining === 1 ? '' : 's'} left`)
    }
    setShake(true)
    setInput('')
    window.setTimeout(() => setShake(false), 500)
  }, [])

  const tryUnlock = useCallback(async (pin: string) => {
    const h = await hashPin(pin)
    if (h === pinHash) {
      setAttempts(0)
      setError('')
      if (onUnlock) onUnlock()
      else unlock()
    } else {
      setAttempts((prev) => {
        const next = prev + 1
        triggerError(next)
        return next
      })
    }
  }, [onUnlock, pinHash, triggerError, unlock])

  const handlePress = useCallback((key: string) => {
    if (isLockedOut) return
    if (key === '⌫') {
      setInput((p) => p.slice(0, -1))
      return
    }
    setInput((prev) => {
      if (prev.length >= 4) return prev
      const next = prev + key
      if (next.length === 4) {
        void tryUnlock(next)
      }
      return next
    })
  }, [isLockedOut, tryUnlock])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        handlePress(event.key)
      } else if (event.key === 'Backspace') {
        event.preventDefault()
        handlePress('⌫')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlePress])

  const wrapperClass = inline
    ? 'flex-1 min-h-full w-full bg-[var(--bg)] flex flex-col items-center justify-center p-4'
    : 'fixed inset-0 z-[999] bg-[var(--bg)] flex flex-col items-center justify-center p-4'

  return (
    <div className={wrapperClass} role="region" aria-label="Protected area">
      <motion.div
        animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xs flex flex-col items-center gap-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-7 shadow-[var(--shadow-float)]"
      >
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
            <LunaWirelessLogo className="h-8 w-8" />
          </div>
          <div>
            <p className="text-[var(--text)] text-base font-bold tracking-tight">Protected Area</p>
            <p className="text-[var(--text-secondary)] text-xs mt-0.5">Enter 4-digit PIN to continue</p>
          </div>
        </div>

        <div className="flex items-center gap-3" aria-label={`${input.length} of 4 PIN digits entered`}>
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={i < input.length ? { scale: 1, opacity: 1 } : { scale: 0.65, opacity: 0.35 }}
              transition={{ duration: 0.14 }}
              className="h-3 w-3 rounded-full"
              style={{ background: i < input.length ? 'var(--accent)' : 'var(--border-strong)' }}
            />
          ))}
        </div>

        <div className="min-h-[1.25rem] text-center" role="alert">
          <AnimatePresence mode="wait">
            {isLockedOut ? (
              <motion.p
                key="lockout"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-medium text-[var(--status-danger-text)]"
              >
                Locked out · Try again in {countdown}s
              </motion.p>
            ) : error ? (
              <motion.p
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-medium text-[var(--status-danger-text)]"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-3 gap-2.5 w-full">
          {PAD.flat().map((key, idx) => {
            if (!key) return <div key={idx} />
            return (
              <button
                key={idx}
                type="button"
                disabled={isLockedOut}
                onClick={() => handlePress(key)}
                aria-label={key === '⌫' ? 'Delete digit' : key}
                className="h-12 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-lg font-semibold flex items-center justify-center transition-colors hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)] active:scale-95 disabled:opacity-40"
              >
                {key === '⌫' ? <Delete size={18} /> : key}
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
