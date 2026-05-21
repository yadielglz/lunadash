import { useState } from 'react'
import { LockKeyhole, ShieldCheck, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

const ADMIN_PASSWORD = '#1LunaWireless'

export function AdminMainAccess({ onUnlock }: { onUnlock: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setIsOpen(false)
    setPassword('')
    setError('')
  }

  const unlock = () => {
    if (password !== ADMIN_PASSWORD) {
      setError('Incorrect password')
      return
    }
    reset()
    onUnlock()
  }

  if (!isOpen) {
    return (
      <Button variant="ghost" size="sm" icon={<LockKeyhole size={12} />} onClick={() => setIsOpen(true)}>
        Admin location
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[var(--accent)]" />
          <p className="text-xs font-semibold text-[var(--text)]">Main Dashboard Access</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--reveal-bg)]"
          aria-label="Close admin access"
        >
          <X size={13} />
        </button>
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError('')
          }}
          placeholder="Admin password"
          error={error}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') unlock() }}
        />
        <Button size="sm" variant="primary" onClick={unlock}>Unlock</Button>
      </div>
    </div>
  )
}
