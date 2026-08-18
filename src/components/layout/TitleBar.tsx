import { useState, useRef, useEffect } from 'react'
import { CloudSun, Sun, Moon, Pencil, Check, LogOut, RadioTower, Menu } from 'lucide-react'
import { accessRoleLabel, useUiStore } from '../../store/uiStore'
import { useTheme } from '../../hooks/useTheme'
import { useClock } from '../../hooks/useClock'
import { useDisplayStore } from '../../store/displayStore'
import { useWeather } from '../../hooks/useWeather'
import { useTempDisplay } from '../../hooks/useTempDisplay'
import { getWeatherInfo } from '../../lib/openMeteo'
import { LunaWirelessLogo } from '../brand/LunaWirelessLogo'
import { StorePickerButton } from '../shared/StorePickerButton'
import { MobileNavDrawer } from './MobileNavDrawer'

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
      <div className="titlebar-inline-control flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          onBlur={commit}
          className={`titlebar-inline-input bg-[var(--input-bg)] border border-[var(--accent)]/50 rounded px-1.5 py-0.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] ${className}`}
          placeholder={placeholder}
          style={{ width: Math.max(80, draft.length * 8) + 'px' }}
        />
        <button onClick={commit} className="titlebar-inline-action text-[var(--accent)]"><Check size={11} /></button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className="titlebar-inline-action group flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
    >
      <span>{value || placeholder}</span>
      <Pencil size={9} className="opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  )
}

function WeatherStatus() {
  const { data, isLoading, isError } = useWeather(undefined, { useGeolocation: false })
  const { setTab, setSettingsSection } = useUiStore()
  const { fmt, unit } = useTempDisplay()
  const openWeatherSettings = () => {
    setSettingsSection('weather')
    setTab('settings')
  }

  if (isLoading) {
    return (
      <div className="hidden h-7 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-[var(--text-tertiary)] sm:flex">
        <CloudSun size={13} />
        <span>Weather</span>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <button
        onClick={openWeatherSettings}
        className="hidden h-7 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--text)] sm:flex"
        title="Open weather settings"
      >
        <CloudSun size={13} />
        <span>Set weather</span>
      </button>
    )
  }

  const cw = data.current_weather
  const weather = getWeatherInfo(cw.weathercode, cw.is_day)

  return (
    <button
      onClick={openWeatherSettings}
      className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
      title={`${weather.label} - open weather settings`}
    >
      <span className="text-sm leading-none">{weather.icon}</span>
      <span className="tabular-nums text-[var(--text)]">{fmt(cw.temperature)}{unit}</span>
      <span className="hidden max-w-[92px] truncate sm:inline">{weather.label}</span>
    </button>
  )
}

export function TitleBar() {
  const { toggleTheme, isDark } = useTheme()
  const { accessRole, accessLabel, clearStoreSession, setTab } = useUiStore()
  const now = useClock()
  const { companyName, setCompanyName } = useDisplayStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="app-titlebar chrome-bar bg-[var(--titlebar-bg)]/80 backdrop-blur-xl border-b border-[var(--border)] flex flex-shrink-0 items-center justify-between px-3 sm:px-5 z-50 shadow-sm">
      {/* Logo + store info */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          onClick={() => setMenuOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] sm:hidden transition-colors"
          aria-label="Open menu"
        >
          <Menu size={19} />
        </button>
        <div className="luna-logo-badge flex h-9.5 w-9.5 flex-shrink-0 items-center justify-center rounded-xl">
          <LunaWirelessLogo className="h-7 w-7" />
        </div>
        <div className="hidden sm:flex flex-col leading-tight">
          <EditableField
            value={companyName}
            placeholder="Store name"
            onChange={setCompanyName}
            className="font-bold text-sm text-[var(--text)]"
          />
        </div>
      </div>

      {/* Center: persistent date, clock, and weather */}
      <div className="mx-2 flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-2.5">
        <button
          onClick={() => setTab('schedule')}
          className="flex h-8 min-w-0 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/80 px-2.5 text-xs text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text)] active:scale-95"
          title={dateStr}
        >
          <RadioTower size={12} className="hidden text-[var(--accent)] sm:block" />
          <span className="hidden sm:inline font-medium">{dateStr}</span>
          <span className="whitespace-nowrap tabular-nums font-semibold text-[var(--text)]">{timeStr}</span>
        </button>
        <WeatherStatus />
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <StorePickerButton className="hidden sm:inline-flex" />
        <StorePickerButton
          compact
          readOnlyWhenLocked
          className="inline-flex h-9 min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-1.5 text-[var(--text-secondary)] sm:hidden"
        />
        {accessRole && (
          <div className="hidden md:flex flex-col items-end leading-tight mr-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{accessRoleLabel(accessRole)}</span>
            <span className="text-[10px] text-[var(--text-tertiary)] max-w-[120px] truncate">{accessLabel || 'Access session'}</span>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="hidden w-8.5 h-8.5 rounded-xl sm:flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] transition-colors active:scale-95"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          onClick={clearStoreSession}
          className="hidden w-8.5 h-8.5 rounded-xl sm:flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] transition-colors active:scale-95"
          title="Log out"
        >
          <LogOut size={15} />
        </button>
      </div>
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
