import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Delete } from 'lucide-react'
import { useLockStore, hashPin } from '../store/lockStore'

const PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
]

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

interface LockScreenProps {
  /** Render inside the content area instead of as a full-screen overlay */
  inline?: boolean
  /** Called on successful PIN entry instead of the global store unlock */
  onUnlock?: () => void
}

export function LockScreen({ inline = false, onUnlock }: LockScreenProps = {}) {
  const { pinHash, unlock } = useLockStore()
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isLockedOut = countdown > 0

  // Countdown ticker
  useEffect(() => {
    if (countdown <= 0) return
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!)
          setAttempts(0)
          setError('')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [countdown])

  const triggerError = (attemptsAfter: number) => {
    if (attemptsAfter >= MAX_ATTEMPTS) {
      setError(`Too many attempts. Try again in ${LOCKOUT_SECONDS}s`)
      setCountdown(LOCKOUT_SECONDS)
    } else {
      setError(`Incorrect PIN · ${MAX_ATTEMPTS - attemptsAfter} attempt${MAX_ATTEMPTS - attemptsAfter === 1 ? '' : 's'} left`)
    }
    setShake(true)
    setInput('')
    setTimeout(() => setShake(false), 600)
  }

  const tryUnlock = async (pin: string) => {
    const h = await hashPin(pin)
    if (h === pinHash) {
      setAttempts(0)
      setError('')
      onUnlock ? onUnlock() : unlock()
    } else {
      const next = attempts + 1
      setAttempts(next)
      triggerError(next)
    }
  }

  const handlePress = (key: string) => {
    if (isLockedOut) return
    if (key === '⌫') {
      setInput((p) => p.slice(0, -1))
      return
    }
    if (input.length >= 6) return
    const next = input + key
    setInput(next)
    if (next.length === 4) {
      tryUnlock(next)
    }
  }

  const wrapperClass = inline
    ? 'flex-1 w-full bg-[var(--bg)] flex flex-col items-center justify-center relative'
    : 'fixed inset-0 z-[999] bg-[var(--bg)] flex flex-col items-center justify-center'

  return (
    <div className={wrapperClass}>
      <motion.div
        animate={shake ? { x: [-12, 12, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-8 relative"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white text-3xl font-bold">L</span>
          </div>
          <div className="text-center">
            <p className="text-[var(--text)] text-lg font-semibold">Luna Dashboard</p>
            <p className="text-[var(--text-secondary)] text-sm mt-0.5">Enter your PIN to continue</p>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={i < input.length ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0.3 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="w-3 h-3 rounded-full"
              style={{ background: i < input.length ? 'var(--accent)' : 'var(--border-strong)' }}
            />
          ))}
        </div>

        {/* Error / lockout message */}
        <AnimatePresence mode="wait">
          {isLockedOut ? (
            <motion.div
              key="lockout"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-1 absolute -bottom-10"
            >
              <p className="text-red-400 text-sm">Too many attempts</p>
              <p className="text-[var(--text-secondary)] text-xs">Try again in {countdown}s</p>
            </motion.div>
          ) : error ? (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-red-400 text-sm absolute -bottom-6"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {PAD.flat().map((key, idx) => {
            if (key === '') return <div key={idx} />
            return (
              <motion.button
                key={key}
                onClick={() => handlePress(key)}
                whileTap={!isLockedOut ? { scale: 0.88 } : {}}
                disabled={isLockedOut}
                className={`w-16 h-16 rounded-xl flex items-center justify-center font-semibold text-xl transition-colors ${
                  isLockedOut
                    ? 'opacity-30 cursor-not-allowed bg-[var(--surface)] text-[var(--text-tertiary)]'
                    : key === '⌫'
                      ? 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]'
                      : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-3)]'
                }`}
              >
                {key === '⌫' ? <Delete size={20} /> : key}
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
