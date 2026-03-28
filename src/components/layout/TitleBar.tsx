import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Store, Pencil, Check } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useTheme } from '../../hooks/useTheme'
import { useClock } from '../../hooks/useClock'
import { useDisplayStore } from '../../store/displayStore'

function EditableField({
  value,
  placeholder,
  onChange,
  className = '',
}: {
  value: string
  placeholder: string
  onChange: (v: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    onChange(draft.trim() || value)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          onBlur={commit}
          className={`bg-[var(--input-bg)] border border-[var(--accent)]/50 rounded px-1.5 py-0.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] ${className}`}
          placeholder={placeholder}
          style={{ width: Math.max(80, draft.length * 8) + 'px' }}
        />
        <button onClick={commit} className="text-[var(--accent)]"><Check size={11} /></button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className="group flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
    >
      <span>{value || placeholder}</span>
      <Pencil size={9} className="opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  )
}

export function TitleBar() {
  const { toggleTheme, isDark } = useTheme()
  const { activeTab } = useUiStore()
  const now = useClock()
  const { companyName, storeNumber, setCompanyName, setStoreNumber } = useDisplayStore()

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="mica border-b border-[var(--border)] flex items-center justify-between px-4 h-12 flex-shrink-0 z-50">
      {/* Logo + store info */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="text-white text-xs font-bold tracking-tight">L</span>
        </div>
        <div className="hidden sm:flex flex-col leading-none gap-0.5">
          <EditableField
            value={companyName}
            placeholder="Store name"
            onChange={setCompanyName}
            className="font-semibold"
          />
          <div className="flex items-center gap-1">
            <Store size={9} className="text-[var(--text-tertiary)]" />
            <EditableField
              value={storeNumber}
              placeholder="Store #"
              onChange={setStoreNumber}
            />
          </div>
        </div>
      </div>

      {/* Center: tab title on mobile, date on desktop */}
      <div className="flex flex-col items-center">
        <span className="text-sm font-medium text-[var(--text)] sm:hidden capitalize">{activeTab}</span>
        <span className="hidden sm:block text-xs text-[var(--text-secondary)]">{dateStr}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--text-secondary)] mr-2 hidden sm:inline tabular-nums">{timeStr}</span>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </div>
  )
}
