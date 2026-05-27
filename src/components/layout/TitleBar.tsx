import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CloudSun, Sun, Moon, Store, Pencil, Check, LogOut } from 'lucide-react'
import { accessRoleLabel, useUiStore } from '../../store/uiStore'
import { useTheme } from '../../hooks/useTheme'
import { useClock } from '../../hooks/useClock'
import { useDisplayStore } from '../../store/displayStore'
import { useWeather } from '../../hooks/useWeather'
import { useTempDisplay } from '../../hooks/useTempDisplay'
import { getWeatherInfo } from '../../lib/openMeteo'
import { dbGetAccessCodes } from '../../lib/supabase'
import { fetchPerformanceData } from '../../lib/performanceSheet'
import { normalizeStoreId } from '../../lib/storeIds'
import { LunaWirelessLogo } from '../brand/LunaWirelessLogo'

function normalizeStoreCode(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

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

function StoreSelector() {
  const { accessRole, storeId, setStoreId } = useUiStore()
  const { storeNumber } = useDisplayStore()
  const canSwitchStores = accessRole === 'admin' || accessRole === 'district_manager'
  const accessQuery = useQuery({
    queryKey: ['titlebar-access-stores'],
    queryFn: dbGetAccessCodes,
    enabled: canSwitchStores,
    staleTime: 60_000,
  })
  const sourceQuery = useQuery({
    queryKey: ['titlebar-performance-source'],
    queryFn: fetchPerformanceData,
    enabled: canSwitchStores,
    staleTime: 55_000,
    refetchInterval: 60_000,
  })
  const fallbackLabel = storeNumber ? `Store #${storeNumber}` : storeId || 'Store'

  if (!canSwitchStores) {
    return (
      <span className="max-w-[170px] truncate text-xs text-[var(--text-secondary)]">
        {fallbackLabel}
      </span>
    )
  }

  const sourceRows = sourceQuery.data?.rows ?? []
  const sourceByCode = new Map(sourceRows.map((row) => [normalizeStoreCode(row.storeCode), row]))
  const codedStores = new Map<string, { id: string; label: string }>()

  accessQuery.data
    ?.filter((code) => code.is_active && code.store_id && normalizeStoreId(code.store_id) !== 'main')
    .forEach((code) => {
      const storeId = normalizeStoreId(code.store_id)
      const row = sourceByCode.get(normalizeStoreCode(storeId))
      if (!row || codedStores.has(storeId)) return
      codedStores.set(storeId, {
        id: storeId,
        label: `${row.teamName || row.store} #${row.storeCode}`,
      })
    })

  const options = [
    ...(accessRole === 'admin' ? [{ id: 'main', label: 'Main Dashboard' }] : []),
    ...Array.from(codedStores.values()).sort((a, b) => a.label.localeCompare(b.label)),
  ]

  const currentValue = options.some((option) => option.id === storeId) ? storeId : ''
  if (options.length === 0) {
    return (
      <span className="max-w-[170px] truncate text-xs text-[var(--text-secondary)]">
        {fallbackLabel}
      </span>
    )
  }

  return (
    <select
      value={currentValue}
      onChange={(event) => {
        if (event.target.value) setStoreId(normalizeStoreId(event.target.value))
      }}
      className="max-w-[190px] rounded border border-transparent bg-transparent py-0 pr-5 text-xs text-[var(--text-secondary)] outline-none transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus:border-[var(--accent)] focus:bg-[var(--surface-2)]"
      title="Switch store"
    >
      {!currentValue && <option value="">{fallbackLabel}</option>}
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  )
}

export function TitleBar() {
  const { toggleTheme, isDark } = useTheme()
  const { activeTab, accessRole, accessLabel, clearStoreSession, setTab } = useUiStore()
  const now = useClock()
  const { companyName, setCompanyName } = useDisplayStore()

  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const mobileTabLabel = activeTab === 'goals' ? 'Performance' : activeTab

  return (
    <div className="app-titlebar chrome-bar bg-[var(--titlebar-bg)] border-b border-[var(--border)] flex flex-shrink-0 items-center justify-between px-3 sm:px-4 z-50">
      {/* Logo + store info */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-7 w-11 flex-shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5">
          <LunaWirelessLogo className="h-4 w-full" />
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
            <StoreSelector />
          </div>
        </div>
      </div>

      {/* Center: persistent date, clock, and weather */}
      <div className="mx-2 flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2">
        <button
          onClick={() => setTab('schedule')}
          className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-transparent px-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] sm:px-2"
          title={dateStr}
        >
          <span className="hidden sm:inline">{dateStr}</span>
          <span className="sm:hidden text-sm font-medium capitalize text-[var(--text)]">{mobileTabLabel}</span>
          <span className="tabular-nums text-[var(--text)]">{timeStr}</span>
        </button>
        <WeatherStatus />
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {accessRole && (
          <div className="hidden md:flex flex-col items-end leading-none mr-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--accent)]">{accessRoleLabel(accessRole)}</span>
            <span className="text-[10px] text-[var(--text-tertiary)] max-w-[120px] truncate">{accessLabel || 'Access session'}</span>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          onClick={clearStoreSession}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)] transition-colors"
          title="Log out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  )
}
