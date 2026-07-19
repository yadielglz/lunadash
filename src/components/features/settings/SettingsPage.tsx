import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Store, Megaphone, Check, ChevronRight, Trash2, Plus, Edit2, Info, RefreshCw, Moon, Sun, Cloud, KeyRound, Tv2, FileText, Printer, CarFront, MonitorCheck, Search, SlidersHorizontal
} from 'lucide-react'
import { Theme, useUiStore } from '../../../store/uiStore'

import { isAnnouncementActive, useDisplayStore } from '../../../store/displayStore'
import { useGoalsStore, type Goal } from '../../../store/goalsStore'
import { dbCheckSchemaHealth, dbDeleteSettings, dbForceEodSnapshot, dbGetGoals, dbGetStores, dbUpdateSettings, GLOBAL_ANNOUNCEMENT_STORE_ID, StoreSummary } from '../../../lib/supabase'
import { Input, Select } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { APP_META } from '../../../config/appMeta'
import { SyncArea, useSyncStore } from '../../../store/syncStore'
import { WeatherPage } from '../weather/WeatherPage'
import { TrafficPage } from '../traffic/TrafficPage'
import { getDealerInfo } from '../../../lib/dealers'
import { getStoreProfile } from '../../../config/storeProfiles'
import { normalizeStoreId } from '../../../lib/storeIds'
import { WEEKDAY_KEYS, WEEKDAY_LABELS, type StoreHours } from '../../../lib/storeHours'
import { Section, Row, Segment } from './SettingsLayout'
import { AccessSection } from './AccessSection'
import { RemoteSection } from './RemoteSection'
import { ModuleHeader } from '../../ui/ModulePrimitives'

function ThemePicker({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  const choices: { value: Theme; label: string; icon: React.ReactNode; preview: string; accents: string[] }[] = [
    { value: 'dark', label: 'Luna Night', icon: <Moon size={14} />, preview: 'bg-[linear-gradient(135deg,#071018,#172631_58%,#159bd7)]', accents: ['#159bd7', '#55c8f4'] },
    { value: 'light', label: 'Luna Light', icon: <Sun size={14} />, preview: 'bg-[linear-gradient(135deg,#ffffff,#eaf1f4_58%,#159bd7)]', accents: ['#159bd7', '#087fb8'] },
  ]

  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
      {choices.map((choice) => {
        const selected = value === choice.value
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => onChange(choice.value as Theme)}
            aria-pressed={selected}
            className={`group rounded-lg border p-2 text-left transition-colors ${
              selected
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className={`h-16 overflow-hidden rounded-md border border-[var(--border)] ${choice.preview}`}>
              <div className="h-3 border-b border-white/10 bg-white/10" />
              <div className="p-1.5 space-y-1">
                <div className="h-2 w-10 rounded" style={{ background: choice.accents[0] }} />
                <div className="h-1.5 w-14 rounded bg-slate-400/45" />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 truncate text-xs font-medium text-[var(--text)]">
                  {choice.icon}
                  {choice.label}
                </span>
                <div className="mt-1 flex items-center gap-1">
                  {choice.accents.map((accent) => (
                    <span key={accent} className="h-2.5 w-2.5 rounded-full border border-white/30" style={{ background: accent }} />
                  ))}
                </div>
              </div>
              {selected && <Check size={13} className="text-[var(--accent)]" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── General section ──────────────────────────────────────────────────────────
function GeneralSection() {
  const { theme, setTheme, timeFormat, setTimeFormat, tempUnit, toggleTempUnit, uiScale, setUiScale } = useUiStore()
  return (
    <Section icon={<Clock size={14} />} title="General">
      <Row layout="stacked" label="Theme & Accent" description="Each theme includes its own accent colors across the app">
        <ThemePicker value={theme} onChange={setTheme} />
      </Row>
      <Row label="App Zoom" description="Increase dashboard size on larger displays">
        <Segment
          options={[{ value: '100', label: '100%' }, { value: '120', label: '120%' }]}
          value={uiScale}
          onChange={setUiScale}
        />
      </Row>
      <Row label="Time Format" description="How time is displayed across the app">
        <Segment
          options={[{ value: '12', label: '12h' }, { value: '24', label: '24h' }]}
          value={timeFormat}
          onChange={setTimeFormat}
        />
      </Row>
      <Row label="Session Timeout" description="How long store access stays open after activity">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)]">
          15 minutes
        </div>
      </Row>
      <Row label="Temperature Unit" description="Used in weather and display slides">
        <Segment
          options={[{ value: 'F', label: '°F' }, { value: 'C', label: '°C' }]}
          value={tempUnit}
          onChange={(v) => { if (v !== tempUnit) toggleTempUnit() }}
        />
      </Row>
    </Section>
  )
}

// ── Store details ────────────────────────────────────────────────────────────
function StoreSection() {
  const { companyName, storeNumber, slideInterval, storeHours, setCompanyName, setStoreNumber, setStoreHours } = useDisplayStore()
  const { storeId, setStoreId, accessRole } = useUiStore()
  const canSwitchStores = accessRole === 'admin'
  const [name, setName]       = useState(companyName)
  const [num, setNum]         = useState(storeNumber)
  const [hours, setHours]     = useState<StoreHours>(storeHours)
  const [newStoreId, setNewStoreId] = useState('')
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [storesError, setStoresError] = useState('')
  const [sidSaved, setSidSaved] = useState(false)
  const [detailsSaveState, setDetailsSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [detailsSaveMessage, setDetailsSaveMessage] = useState('')

  const loadStores = async () => {
    setStoresLoading(true)
    setStoresError('')
    try {
      const rows = await dbGetStores()
      const hasDefault = rows.some((store) => normalizeStoreId(store.store_id) === 'DEFAULT')
      setStores(hasDefault ? rows : [
        { store_id: 'DEFAULT', company_name: 'Luna Store', store_number: '', slide_interval: 8 },
        ...rows,
      ])
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : 'Could not load stores')
      setStores([{ store_id: 'DEFAULT', company_name: 'Luna Store', store_number: '', slide_interval: 8 }])
    } finally {
      setStoresLoading(false)
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  useEffect(() => {
    setName(companyName)
    setNum(storeNumber)
    setHours(storeHours)
  }, [companyName, storeHours, storeNumber])

  const saveDetails = async () => {
    setDetailsSaveState('saving')
    setDetailsSaveMessage('')
    try {
      await Promise.all([
        setCompanyName(name.trim() || companyName),
        setStoreNumber(num.trim()),
        setStoreHours(hours),
      ])
      setDetailsSaveState('saved')
      setDetailsSaveMessage('Store details and hours saved.')
      loadStores()
    } catch (err) {
      setDetailsSaveState('error')
      setDetailsSaveMessage(err instanceof Error ? err.message : 'Store details could not be saved.')
    }
  }

  const updateDayHours = (day: keyof StoreHours, patch: Partial<StoreHours[keyof StoreHours]>) => {
    setHours((current) => ({
      ...current,
      [day]: { ...current[day], ...patch },
    }))
  }

  const switchStore = (nextStoreId: string) => {
    setStoreId(normalizeStoreId(nextStoreId) || 'DEFAULT')
    setSidSaved(true)
    setTimeout(() => setSidSaved(false), 2000)
  }

  const addStore = async () => {
    const id = normalizeStoreId(newStoreId) || 'DEFAULT'
    await dbUpdateSettings(id, {
      company_name: id === storeId ? companyName : 'Luna Store',
      store_number: id === storeId ? storeNumber : '',
      slide_interval: id === storeId ? slideInterval : 8,
    })
    setNewStoreId('')
    await loadStores()
    switchStore(id)
  }

  return (
    <Section icon={<Store size={14} />} title="Store Details">
      {canSwitchStores && (
      <div className="px-4 py-4 rounded-xl bg-[var(--surface-2)] border border-[var(--accent)]/20 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Store Selection</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Select a store already configured in Supabase Database Sync, or add one by Store Data ID.
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={loadStores} loading={storesLoading}>
            Refresh
          </Button>
        </div>

        <Select
          label="Known Stores"
          value={storeId === 'main' ? '' : storeId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => switchStore(e.target.value)}
        >
          <option value="" disabled>{storeId === 'main' ? 'Main Dashboard active' : 'Select a store'}</option>
          {stores.map((store) => (
            <option key={store.store_id} value={store.store_id}>
              {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
            </option>
          ))}
          {storeId !== 'main' && !stores.some((store) => normalizeStoreId(store.store_id) === normalizeStoreId(storeId)) && (
            <option value={storeId}>{storeId} (current)</option>
          )}
        </Select>

        {accessRole === 'admin' && (
          <Button size="sm" variant={storeId === 'main' ? 'accent' : 'ghost'} onClick={() => switchStore('main')}>
            {storeId === 'main' ? 'Main Dashboard active' : 'Use Main Dashboard'}
          </Button>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newStoreId}
            onChange={(e) => setNewStoreId(normalizeStoreId(e.target.value))}
            placeholder="New store ID, e.g. 693D"
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') addStore() }}
          />
          <Button size="sm" onClick={addStore} icon={<Plus size={12} />}>
            Add / Use
          </Button>
        </div>

        <p className="text-[10px] text-[var(--text-tertiary)]">
          Current: <span className="font-mono text-[var(--accent)]">{storeId || 'DEFAULT'}</span>
          {sidSaved && <span className="ml-2 text-[var(--accent)]">Applied</span>}
        </p>
        {storesError && <p className="text-xs text-red-400">{storesError}</p>}
      </div>
      )}

      {/* Display info */}
      <div className="px-4 py-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Company Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Luna Store" />
          <Input label="Store Number" value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 1234" />
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Store Hours</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {WEEKDAY_KEYS.map((day) => (
              <div key={day} className="grid grid-cols-[minmax(74px,1fr)_auto] gap-2 px-3 py-2 sm:grid-cols-[110px_auto_1fr] sm:items-center">
                <div className="text-xs font-medium text-[var(--text)]">{WEEKDAY_LABELS[day]}</div>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={hours[day].open}
                    onChange={(event) => updateDayHours(day, { open: event.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  Open
                </label>
                <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1">
                  <Input
                    aria-label={`${WEEKDAY_LABELS[day]} open time`}
                    type="time"
                    value={hours[day].start}
                    onChange={(event) => updateDayHours(day, { start: event.target.value })}
                    disabled={!hours[day].open}
                  />
                  <Input
                    aria-label={`${WEEKDAY_LABELS[day]} close time`}
                    type="time"
                    value={hours[day].end}
                    onChange={(event) => updateDayHours(day, { end: event.target.value })}
                    disabled={!hours[day].open}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {detailsSaveMessage && (
            <span className={`text-xs ${detailsSaveState === 'error' ? 'text-red-400' : 'text-[var(--accent)]'}`}>
              {detailsSaveMessage}
            </span>
          )}
          <Button size="sm" onClick={saveDetails} icon={<Check size={12} />} loading={detailsSaveState === 'saving'}>
            Save
          </Button>
        </div>
      </div>

    </Section>
  )
}

function DisplaySettingsSection() {
  const { slideInterval, setSlideInterval } = useDisplayStore()
  const { setTab } = useUiStore()

  return (
    <Section icon={<Tv2 size={14} />} title="Display">
      <Row label="Display Slide Interval" description={`Each slide shows for ${slideInterval}s`}>
        <div className="flex items-center gap-2">
          <input
            type="range" min={4} max={30} step={2} value={slideInterval}
            onChange={(e) => setSlideInterval(Number(e.target.value))}
            className="w-24 accent-[var(--accent)]"
          />
          <span className="text-xs text-[var(--text-secondary)] w-8 text-right">{slideInterval}s</span>
        </div>
      </Row>
      <Row label="Display Mode" description="Launch the passive store display">
        <Button size="sm" variant="ghost" icon={<Tv2 size={13} />} onClick={() => setTab('display')}>
          Open Display
        </Button>
      </Row>
    </Section>
  )
}

// ── Announcements section ────────────────────────────────────────────────────
function AnnouncementsSection() {
  const { announcements, addAnnouncement, removeAnnouncement } = useDisplayStore()
  const { accessRole, storeId } = useUiStore()
  const [draft, setDraft] = useState('')
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal')
  const [startAt, setStartAt] = useState(new Date().toISOString().split('T')[0])
  const [endAt, setEndAt] = useState('')
  const [targetStoreId, setTargetStoreId] = useState(GLOBAL_ANNOUNCEMENT_STORE_ID)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const PCOLS = { normal: '#0078d4', important: '#f7630c', urgent: '#e74856' }
  const canChooseTarget = accessRole === 'admin' || accessRole === 'district_manager'

  useEffect(() => {
    if (!canChooseTarget) return
    dbGetStores()
      .then((rows) => setStores(rows.filter((store) => normalizeStoreId(store.store_id) !== 'main')))
      .catch(() => setStores([]))
  }, [canChooseTarget])

  const add = () => {
    if (!draft.trim()) return
    const target = canChooseTarget ? targetStoreId : normalizeStoreId(storeId)
    addAnnouncement(draft.trim(), priority, { startAt: startAt || undefined, endAt: endAt || undefined }, target)
    setDraft('')
    setPriority('normal')
    setStartAt(new Date().toISOString().split('T')[0])
    setEndAt('')
  }

  return (
    <Section icon={<Megaphone size={14} />} title="Announcements">
      {/* Add new */}
      <div className="px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New announcement…"
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') add() }}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Starts" type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          <Input label="Ends" type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
        {canChooseTarget && (
          <Select
            label="Send To"
            value={targetStoreId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetStoreId(e.target.value)}
          >
            <option value={GLOBAL_ANNOUNCEMENT_STORE_ID}>All Stores</option>
            {stores.map((store) => (
              <option key={store.store_id} value={normalizeStoreId(store.store_id)}>
                {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
              </option>
            ))}
          </Select>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {(['normal', 'important', 'urgent'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors capitalize"
                style={priority === p
                  ? { background: PCOLS[p], borderColor: PCOLS[p], color: '#fff' }
                  : { background: `${PCOLS[p]}15`, borderColor: `${PCOLS[p]}30`, color: PCOLS[p] }}
              >
                {p}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={add} disabled={!draft.trim()} icon={<Plus size={12} />}>Add</Button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {announcements.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] group">
            <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: PCOLS[a.priority] }} />
            <p className="flex-1 text-sm text-[var(--text)]">{a.text}</p>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {a.storeId === GLOBAL_ANNOUNCEMENT_STORE_ID ? 'All Stores' : a.storeId || storeId} · {a.startAt || 'Now'} - {a.endAt || 'No end'}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize"
              style={{ background: `${PCOLS[a.priority]}20`, color: PCOLS[a.priority] }}
            >
              {isAnnouncementActive(a) ? a.priority : 'scheduled'}
            </span>
            <button
              onClick={() => removeAnnouncement(a.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-tertiary)] hover:text-red-400 transition-all flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {announcements.length === 0 && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No announcements</p>
        )}
      </div>
    </Section>
  )
}

// ── Configured stores section ────────────────────────────────────────────────
function ConfiguredStoresSection() {
  const { storeId, setStoreId, accessRole } = useUiStore()
  const canEditStoreLabels = accessRole === 'admin' || accessRole === 'district_manager'
  const canRemoveStores = accessRole === 'admin'
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNumber, setEditNumber] = useState('')
  const [editInterval, setEditInterval] = useState(8)
  const [editNickname, setEditNickname] = useState('')
  const [editLocation, setEditLocation] = useState('')

  const loadStores = async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await dbGetStores()
      setStores(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  const startEditStore = (store: StoreSummary) => {
    const dealer = getDealerInfo(store.store_id)
    const profile = getStoreProfile(store.store_id)
    setEditingStoreId(store.store_id)
    setEditName(store.company_name || '')
    setEditNumber(store.store_number || '')
    setEditInterval(store.slide_interval || 8)
    setEditNickname(store.dealer_nickname || dealer?.nickname || '')
    setEditLocation(store.dealer_location || dealer?.location || profile?.location || '')
    setError('')
  }

  const cancelEditStore = () => {
    setEditingStoreId(null)
    setEditName('')
    setEditNumber('')
    setEditInterval(8)
    setEditNickname('')
    setEditLocation('')
  }

  const saveStore = async (store: StoreSummary) => {
    setLoading(true)
    setError('')
    try {
      await dbUpdateSettings(store.store_id, {
        company_name: editName.trim() || 'Luna Store',
        store_number: editNumber.trim(),
        slide_interval: editInterval,
        dealer_nickname: editNickname.trim(),
        dealer_location: editLocation.trim(),
      })
      cancelEditStore()
      await loadStores()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update store')
    } finally {
      setLoading(false)
    }
  }

  const removeStore = async (store: StoreSummary) => {
    if (normalizeStoreId(store.store_id) === normalizeStoreId(storeId)) {
      setError('Switch to another store before removing the current store.')
      return
    }
    if (!window.confirm(`Remove ${store.company_name || store.store_id} from configured stores?`)) return
    setLoading(true)
    setError('')
    try {
      await dbDeleteSettings(store.store_id)
      await loadStores()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove store')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section icon={<Store size={14} />} title="Configured Stores">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={loadStores} loading={loading}>
          Refresh
        </Button>
      </div>

      <div className="space-y-1.5">
        {accessRole === 'admin' && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text)] truncate">Main Dashboard</span>
                {storeId === 'main' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">Current</span>
                )}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">All configured stores</div>
            </div>
            <Button size="sm" variant={storeId === 'main' ? 'accent' : 'ghost'} onClick={() => setStoreId('main')}>
              {storeId === 'main' ? 'Selected' : 'Use'}
            </Button>
          </div>
        )}

        {stores.map((store) => {
          const isEditing = editingStoreId === store.store_id
          const dealer = getDealerInfo(store.store_id)
          const profile = getStoreProfile(store.store_id)
          const nickname = store.dealer_nickname || dealer?.nickname || ''
          const location = store.dealer_location || dealer?.location || ''
          return (
            <div key={store.store_id} className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input label="Store Name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Luna Store" />
                    <Input label="Store #" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} placeholder="1234" />
                    <Input label="Nickname" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder="Top Guns" />
                    <Input label="Location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Clermont S" />
                    <Input label="Slide Seconds" type="number" min={4} max={30} value={editInterval} onChange={(e) => setEditInterval(Number(e.target.value) || 8)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={cancelEditStore}>Cancel</Button>
                    <Button size="sm" icon={<Check size={12} />} loading={loading} onClick={() => saveStore(store)}>Save Store</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text)] truncate">{store.company_name || 'Luna Store'}</span>
                      {normalizeStoreId(store.store_id) === normalizeStoreId(storeId) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">Current</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      ID: <span className="font-mono">{store.store_id}</span>
                      {store.store_number ? ` · Store #${store.store_number}` : ''}
                      {` · Slides ${store.slide_interval}s`}
                    </div>
                    {(nickname || location) && (
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {nickname || 'No nickname'}{location ? ` | ${location}` : ''}
                      </div>
                    )}
                    {profile?.address && (
                      <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {profile.address}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant={normalizeStoreId(store.store_id) === normalizeStoreId(storeId) ? 'accent' : 'ghost'} onClick={() => setStoreId(normalizeStoreId(store.store_id))}>
                    {normalizeStoreId(store.store_id) === normalizeStoreId(storeId) ? 'Selected' : 'Use'}
                  </Button>
                  {canEditStoreLabels && (
                    <>
                      <Button size="sm" variant="ghost" icon={<Edit2 size={12} />} onClick={() => startEditStore(store)}>Edit</Button>
                    </>
                  )}
                  {canRemoveStores && (
                    <>
                      <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => removeStore(store)}>Remove</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {stores.length === 0 && !loading && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No configured stores found in Supabase Database Sync.</p>
        )}
        {error && <p className="text-xs text-red-400 text-center py-2">{error}</p>}
      </div>
    </Section>
  )
}

// ── Reports section ──────────────────────────────────────────────────────────
const SNAPSHOT_CATEGORY = 'Performance Snapshot'
const SNAPSHOT_PREFIX = 'source-snapshot:'
const REPORT_METRICS: Record<string, { label: string; kind: 'money' | 'number' | 'percent' }> = {
  netRevenue: { label: 'Net Revenue', kind: 'money' },
  accessoryRevenue: { label: 'Accessories', kind: 'money' },
  totalPp: { label: 'Total PP', kind: 'number' },
  traffic: { label: 'Traffic', kind: 'number' },
  vl: { label: 'Voice Lines', kind: 'number' },
  bts: { label: 'BTS', kind: 'number' },
  hsi: { label: 'HSI', kind: 'number' },
  visa: { label: 'VISA', kind: 'number' },
}

function snapshotKey(goal: Goal) {
  return goal.description.startsWith(SNAPSHOT_PREFIX)
    ? goal.description.slice(SNAPSHOT_PREFIX.length)
    : ''
}

function monthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function formatReportValue(value: number, kind: 'money' | 'number' | 'percent') {
  if (kind === 'money') {
    return Math.round(value).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
  }
  if (kind === 'percent') return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
  return Math.round(value).toLocaleString('en-US')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isReportStoreId(storeId: string) {
  return storeId === 'main' || /^[A-Z0-9]{4}$/.test(storeId)
}

function storeReportLabel(storeId: string) {
  if (storeId === 'main') return 'District'
  const profile = getStoreProfile(storeId)
  return profile ? `${profile.nickname} | ${storeId}` : storeId
}

function reportGoalFor(goals: Goal[], metricKey: string, storeId?: string) {
  return goals.find((goal) => (
    snapshotKey(goal) === metricKey
    && (!storeId || normalizeStoreId(goal.storeId ?? '') === normalizeStoreId(storeId))
  ))
}

function monthSnapshotTotal(goal: Goal | undefined, month: string) {
  return Object.entries(goal?.dailyLog ?? {}).reduce((sum, [day, value]) => (
    day.startsWith(month) ? sum + (Number(value) || 0) : sum
  ), 0)
}

function dailyValue(goal: Goal | undefined, date: string) {
  return Number(goal?.dailyLog?.[date]) || 0
}

function ReportSection() {
  const { goals, _init: goalsInit } = useGoalsStore()
  const { companyName, storeNumber } = useDisplayStore()
  const { storeId } = useUiStore()
  const [snapshotRunning, setSnapshotRunning] = useState(false)
  const [reportRunning, setReportRunning] = useState(false)
  const [snapshotMessage, setSnapshotMessage] = useState('')
  const [snapshotError, setSnapshotError] = useState('')
  const [reportError, setReportError] = useState('')
  const reportStoreId = normalizeStoreId(storeId || 'main')
  const allSnapshotGoals = goals.filter((goal) => (
    goal.category === SNAPSHOT_CATEGORY
    && snapshotKey(goal)
    && isReportStoreId(normalizeStoreId(goal.storeId ?? ''))
  ))
  const snapshotGoals = goals.filter((goal) => (
    goal.category === SNAPSHOT_CATEGORY
    && snapshotKey(goal)
    && normalizeStoreId(goal.storeId ?? '') === reportStoreId
  ))
  const months = Array.from(new Set(
    allSnapshotGoals.flatMap((goal) => Object.keys(goal.dailyLog ?? {}).map((day) => day.slice(0, 7)))
  ))
    .sort()
    .reverse()
  const [selectedMonth, setSelectedMonth] = useState(months[0] ?? '')

  useEffect(() => {
    if (!selectedMonth && months[0]) setSelectedMonth(months[0])
    if (selectedMonth && months.length > 0 && !months.includes(selectedMonth)) setSelectedMonth(months[0])
  }, [months, selectedMonth])

  const openPrintableReport = (html: string) => {
    const blob = new Blob([html], { type: 'text/html' })
    const reportUrl = URL.createObjectURL(blob)
    const reportWindow = window.open(reportUrl, '_blank')
    window.setTimeout(() => URL.revokeObjectURL(reportUrl), 60_000)
    if (!reportWindow) {
      setReportError('Report popup was blocked. Allow popups for LunaDash and try again.')
    }
  }

  const printStoreReport = () => {
    setReportError('')
    if (!selectedMonth) return

    const rows = Object.entries(REPORT_METRICS).map(([key, meta]) => {
      const goal = reportGoalFor(snapshotGoals, key)
      return { ...meta, total: monthSnapshotTotal(goal, selectedMonth) }
    })
    const metricKeys = Object.keys(REPORT_METRICS)
    const dailyDates = Array.from(new Set(
      snapshotGoals.flatMap((goal) => Object.keys(goal.dailyLog ?? {}).filter((day) => day.startsWith(selectedMonth)))
    )).sort()
    const dailyRows = dailyDates.map((date) => {
      const values = Object.fromEntries(metricKeys.map((key) => {
        const goal = reportGoalFor(snapshotGoals, key)
        return [key, dailyValue(goal, date)]
      }))
      return { date, values }
    })

    const generatedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    const storeLabel = `${companyName || 'Luna Store'}${storeNumber ? ` #${storeNumber}` : ''}`
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(monthLabel(selectedMonth))} Performance Snapshot</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", system-ui, sans-serif; background: #f7f8fb; }
            main { width: 8.5in; min-height: 11in; margin: 0 auto; padding: 0.55in; background: white; }
            header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 18px; }
            h1 { margin: 0; font-size: 26px; letter-spacing: 0; }
            .subtle { color: #64748b; font-size: 12px; }
            .meta { text-align: right; line-height: 1.5; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
            .tile { border: 1px solid #d8dee8; border-radius: 8px; padding: 14px; min-height: 92px; }
            .label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .value { margin-top: 10px; font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { text-align: left; color: #64748b; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding: 10px 8px; }
            td { border-bottom: 1px solid #e5e7eb; padding: 12px 8px; font-size: 13px; }
            td:last-child, th:last-child { text-align: right; font-variant-numeric: tabular-nums; }
            footer { margin-top: 28px; color: #64748b; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
            @media print {
              body { background: white; }
              main { width: auto; min-height: auto; margin: 0; padding: 0.45in; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <main>
            <header>
              <div>
                <h1>Performance Snapshot</h1>
                <div class="subtle">${escapeHtml(monthLabel(selectedMonth))}</div>
              </div>
              <div class="meta subtle">
                <div>${escapeHtml(storeLabel)}</div>
                <div>Store ID: ${escapeHtml(storeId || 'DEFAULT')}</div>
                <div>Generated ${escapeHtml(generatedAt)}</div>
              </div>
            </header>
            <section class="summary">
              ${rows.slice(0, 4).map((row) => `
                <div class="tile">
                  <div class="label">${escapeHtml(row.label)}</div>
                  <div class="value">${escapeHtml(formatReportValue(row.total, row.kind))}</div>
                </div>
              `).join('')}
            </section>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>MTD Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.label)}</td>
                    <td>${escapeHtml(formatReportValue(row.total, row.kind))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <h2>EOD MTD Records</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  ${metricKeys.map((key) => `<th>${escapeHtml(REPORT_METRICS[key].label)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${dailyRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(new Date(row.date + 'T12:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}</td>
                    ${metricKeys.map((key) => `<td>${escapeHtml(formatReportValue(Number(row.values[key]) || 0, REPORT_METRICS[key].kind))}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <footer>
              MTD totals are calculated from saved daily Source snapshots.
            </footer>
          </main>
          <script>
            window.addEventListener('load', () => {
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>
    `

    openPrintableReport(html)
  }

  const loadDistrictSnapshotGoals = async () => {
    const currentDistrictGoals = allSnapshotGoals.filter((goal) => {
      const sid = normalizeStoreId(goal.storeId ?? '')
      return sid === 'main' || /^[A-Z0-9]{4}$/.test(sid)
    })
    const storeIds = Array.from(new Set(currentDistrictGoals.map((goal) => normalizeStoreId(goal.storeId ?? '')).filter(Boolean)))
    if (storeIds.includes('main') && storeIds.filter((id) => id !== 'main').length >= 2) return currentDistrictGoals

    const stores = await dbGetStores()
    const goalSets = await Promise.all([
      dbGetGoals('main'),
      ...stores
        .map((store) => normalizeStoreId(store.store_id))
        .filter((id) => /^[A-Z0-9]{4}$/.test(id))
        .map((id) => dbGetGoals(id)),
    ])
    const loadedGoals = goalSets.flat()
    const merged = [
      ...goals.filter((goal) => goal.category !== SNAPSHOT_CATEGORY),
      ...loadedGoals,
    ]
    goalsInit(merged)
    return loadedGoals.filter((goal) => (
      goal.category === SNAPSHOT_CATEGORY
      && snapshotKey(goal)
      && isReportStoreId(normalizeStoreId(goal.storeId ?? ''))
    ))
  }

  const printDistrictReport = async () => {
    setReportError('')
    if (!selectedMonth) return

    setReportRunning(true)
    try {
      const districtGoals = await loadDistrictSnapshotGoals()
      const storeIds = Array.from(new Set(
        districtGoals
          .map((goal) => normalizeStoreId(goal.storeId ?? ''))
          .filter((id) => /^[A-Z0-9]{4}$/.test(id))
      )).sort()
      const mainGoals = districtGoals.filter((goal) => normalizeStoreId(goal.storeId ?? '') === 'main')
      const storeGoals = districtGoals.filter((goal) => storeIds.includes(normalizeStoreId(goal.storeId ?? '')))

      const rows = Object.entries(REPORT_METRICS).map(([key, meta]) => {
        const mainGoal = reportGoalFor(mainGoals, key, 'main')
        const total = mainGoal
          ? monthSnapshotTotal(mainGoal, selectedMonth)
          : storeIds.reduce((sum, sid) => sum + monthSnapshotTotal(reportGoalFor(storeGoals, key, sid), selectedMonth), 0)
        return { key, ...meta, total }
      })
      const leaderboardRows = storeIds
        .map((sid) => ({
          storeId: sid,
          netRevenue: monthSnapshotTotal(reportGoalFor(storeGoals, 'netRevenue', sid), selectedMonth),
          accessories: monthSnapshotTotal(reportGoalFor(storeGoals, 'accessoryRevenue', sid), selectedMonth),
          totalPp: monthSnapshotTotal(reportGoalFor(storeGoals, 'totalPp', sid), selectedMonth),
        }))
        .sort((a, b) => b.netRevenue - a.netRevenue)

      const generatedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      const html = `
        <!doctype html>
        <html>
          <head>
            <title>${escapeHtml(monthLabel(selectedMonth))} District Performance Snapshot</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; color: #111827; font-family: "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", system-ui, sans-serif; background: #f7f8fb; }
              main { width: 11in; min-height: 8.5in; margin: 0 auto; padding: 0.45in; background: white; }
              header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
              h1 { margin: 0; font-size: 25px; letter-spacing: 0; }
              h2 { margin: 24px 0 0; font-size: 15px; }
              .subtle { color: #64748b; font-size: 12px; }
              .meta { text-align: right; line-height: 1.5; }
              .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
              .tile { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; min-height: 82px; }
              .label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
              .value { margin-top: 8px; font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { text-align: left; color: #64748b; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding: 8px 6px; }
              td { border-bottom: 1px solid #e5e7eb; padding: 9px 6px; font-size: 11px; }
              td:not(:first-child), th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
              .rank { width: 34px; color: #64748b; }
              .store { text-align: left !important; font-weight: 700; color: #111827; }
              footer { margin-top: 22px; color: #64748b; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
              @media print {
                @page { size: landscape; }
                body { background: white; }
                main { width: auto; min-height: auto; margin: 0; padding: 0.35in; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <main>
              <header>
                <div>
                  <h1>District Performance Snapshot</h1>
                  <div class="subtle">${escapeHtml(monthLabel(selectedMonth))}</div>
                </div>
                <div class="meta subtle">
                  <div>Full District</div>
                  <div>${storeIds.length} stores</div>
                  <div>Generated ${escapeHtml(generatedAt)}</div>
                </div>
              </header>
              <section class="summary">
                ${rows.slice(0, 4).map((row) => `
                  <div class="tile">
                    <div class="label">${escapeHtml(row.label)}</div>
                    <div class="value">${escapeHtml(formatReportValue(row.total, row.kind))}</div>
                  </div>
                `).join('')}
              </section>
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>District MTD Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      <td class="store">${escapeHtml(row.label)}</td>
                      <td>${escapeHtml(formatReportValue(row.total, row.kind))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <h2>Store Leaderboard - MTD</h2>
              <table>
                <thead>
                  <tr>
                    <th class="rank">Rank</th>
                    <th class="store">Store</th>
                    <th>Net Revenue</th>
                    <th>Accessories</th>
                    <th>Total PP</th>
                  </tr>
                </thead>
                <tbody>
                  ${leaderboardRows.map((row, index) => `
                    <tr>
                      <td class="rank">${index + 1}</td>
                      <td class="store">${escapeHtml(storeReportLabel(row.storeId))}</td>
                      <td>${escapeHtml(formatReportValue(row.netRevenue, 'money'))}</td>
                      <td>${escapeHtml(formatReportValue(row.accessories, 'money'))}</td>
                      <td>${escapeHtml(formatReportValue(row.totalPp, 'number'))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <footer>
                District totals and leaderboard values are calculated from saved daily Source snapshots in the selected month.
              </footer>
            </main>
            <script>
              window.addEventListener('load', () => {
                window.focus();
                window.print();
              });
            </script>
          </body>
        </html>
      `

      openPrintableReport(html)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not build district report')
    } finally {
      setReportRunning(false)
    }
  }

  const forceSnapshot = async () => {
    setSnapshotRunning(true)
    setSnapshotMessage('')
    setSnapshotError('')
    try {
      const result = await dbForceEodSnapshot()
      const refreshedGoals = storeId === 'main'
        ? (await Promise.all([
            dbGetGoals('main'),
            ...(await dbGetStores()).map((store) => dbGetGoals(store.store_id)),
          ])).flat()
        : await dbGetGoals(storeId || 'DEFAULT')
      goalsInit(refreshedGoals)
      setSnapshotMessage(`${result.message}${result.updated ? ` (${result.updated} metrics)` : ''}`)
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Could not run EOD snapshot')
    } finally {
      setSnapshotRunning(false)
    }
  }

  return (
    <Section icon={<FileText size={14} />} title="Reports">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Performance Snapshot Report</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Select a month and open a print-ready report with MTD totals from saved daily snapshots.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <Select
            label="Month"
            value={selectedMonth}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(event.target.value)}
            disabled={months.length === 0}
          >
            {months.length === 0 ? (
              <option value="">No historical snapshots yet</option>
            ) : months.map((month) => (
              <option key={month} value={month}>{monthLabel(month)}</option>
            ))}
          </Select>
          <Button size="sm" icon={<Printer size={13} />} disabled={!selectedMonth || reportRunning} onClick={printStoreReport}>
            Store PDF
          </Button>
          <Button size="sm" icon={<Printer size={13} />} loading={reportRunning} disabled={!selectedMonth} onClick={printDistrictReport}>
            District PDF
          </Button>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Reports open in a print window so the Settings tab stays clean.
        </p>
        {reportError && <p className="text-xs text-red-400">{reportError}</p>}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">End of Day Snapshot</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Pull current Source numbers now and save them into today&apos;s MTD history.
            </p>
          </div>
          <Button size="sm" icon={<RefreshCw size={13} />} loading={snapshotRunning} onClick={forceSnapshot}>
            Force Snapshot
          </Button>
        </div>
        {snapshotMessage && <p className="text-xs text-[var(--accent)]">{snapshotMessage}</p>}
        {snapshotError && <p className="text-xs text-red-400">{snapshotError}</p>}
      </div>
    </Section>
  )
}

// ── About section ─────────────────────────────────────────────────────────────
function AboutSection() {
  const { setTab, sessionExpiresAt, sessionTimeout, extendStoreSession, accessRole } = useUiStore()
  const [now, setNow] = useState(Date.now())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil(((sessionExpiresAt ?? now) - now) / 1000))
  const remainingLabel = sessionExpiresAt
    ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
    : 'No active timer'

  const forceUpdateRestart = async () => {
    setRefreshing(true)
    setRefreshError('')
    try {
      if (window.lunadashDesktop?.forceUpdateRestart) {
        await window.lunadashDesktop.forceUpdateRestart()
        return
      }

      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
      document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0]?.trim()
        if (!name) return
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      })
      window.location.reload()
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Could not clear cache and restart')
      setRefreshing(false)
    }
  }

  return (
    <Section icon={<Info size={14} />} title="About">
      <div className="px-4 py-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
        <div className="flex justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <img
            src="/brand/glz-tech-banner.png"
            alt="GLZ Tech"
            className="h-auto w-full max-w-[18rem] object-contain sm:max-w-[22rem]"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">LunaDash</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">ver {APP_META.version} | {APP_META.codename} | Build {APP_META.build}</p>
        </div>
        <div className="text-sm text-[var(--text-secondary)] space-y-1">
          <p>{APP_META.copyright}</p>
          <p>
            Any Issues? email:{' '}
            <a className="text-[var(--accent)] hover:underline" href={`mailto:${APP_META.supportEmail}`}>
              {APP_META.supportEmail}
            </a>
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-xs font-medium text-[var(--text)]">Update Notes</p>
          <ul className="mt-2 list-disc pl-4 text-xs text-[var(--text-secondary)] space-y-1">
            {APP_META.updateNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text)]">Force Update & Restart</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Clears app cache and cookies, then reloads LunaDash fresh.</p>
            </div>
            <Button size="sm" variant="accent" icon={<RefreshCw size={13} />} loading={refreshing} onClick={forceUpdateRestart}>
              Update & Restart
            </Button>
          </div>
          {refreshError && <p className="mt-2 text-xs text-red-400">{refreshError}</p>}
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--text)]">Store Session</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">
                {sessionTimeout === 'never' ? 'This device keeps the store session open.' : 'Timer resets with activity.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[var(--accent)]">{remainingLabel}</span>
              {sessionExpiresAt && <Button size="sm" variant="ghost" onClick={extendStoreSession}>Extend</Button>}
            </div>
          </div>
        </div>
        {accessRole === 'admin' && (
          <div className="pt-2 border-t border-[var(--border)]">
            <button
              onClick={() => setTab('devices')}
              className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Internal reference
            </button>
          </div>
        )}
      </div>
    </Section>
  )
}

function SyncStatusSection() {
  const entries = useSyncStore((s) => s.entries)
  const [schema, setSchema] = useState<{ table: string; ok: boolean; message: string }[]>([])
  const [checking, setChecking] = useState(false)
  const [schemaError, setSchemaError] = useState('')
  const rows: { area: SyncArea; label: string }[] = [
    { area: 'settings', label: 'Settings' },
    { area: 'schedule', label: 'Schedule' },
    { area: 'tasks', label: 'Daily Checklist' },
    { area: 'goals', label: 'Performance Snapshots' },
    { area: 'announcements', label: 'Announcements' },
  ]

  const colorFor = (state: string) => (
    state === 'synced' ? 'text-emerald-400'
    : state === 'saving' ? 'text-[var(--accent)]'
    : state === 'error' ? 'text-red-400'
    : 'text-[var(--text-tertiary)]'
  )

  const checkSchema = async () => {
    setChecking(true)
    setSchemaError('')
    try {
      setSchema(await dbCheckSchemaHealth())
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : 'Could not check Supabase Database Sync schema')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Section icon={<Cloud size={14} />} title="Sync Status">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} loading={checking} onClick={checkSchema}>
            Check Schema
          </Button>
        </div>
        {rows.map(({ area, label }) => {
          const entry = entries[area]
          return (
            <div key={area} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{label}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{entry.message}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold uppercase ${colorFor(entry.state)}`}>{entry.state}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                  {entry.updatedAt ? new Date(entry.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Pending'}
                </p>
              </div>
            </div>
          )
        })}
        {schema.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)] overflow-hidden">
            {schema.map((row) => (
              <div key={row.table} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium text-[var(--text)]">{row.table}</span>
                <span className={`text-xs font-semibold ${row.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.ok ? 'Ready' : row.message}
                </span>
              </div>
            ))}
          </div>
        )}
        {schemaError && <p className="text-xs text-red-400">{schemaError}</p>}
      </div>
    </Section>
  )
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'general',       label: 'General',       icon: <Clock size={14} /> },
  { id: 'weather',       label: 'Weather',       icon: <Cloud size={14} /> },
  { id: 'traffic',       label: 'Traffic',       icon: <CarFront size={14} /> },
  { id: 'display',       label: 'Display',       icon: <Tv2 size={14} /> },
  { id: 'remote',        label: 'Remote',        icon: <MonitorCheck size={14} /> },
  { id: 'store',         label: 'Store Details',  icon: <Store size={14} /> },
  { id: 'configuredStores', label: 'Configured Stores', icon: <Store size={14} /> },
  { id: 'reports',       label: 'Reports',        icon: <FileText size={14} /> },
  { id: 'announcements', label: 'Announcements',  icon: <Megaphone size={14} /> },
  { id: 'access',        label: 'Access',         icon: <KeyRound size={14} /> },
  { id: 'sync',          label: 'Sync Status',    icon: <Cloud size={14} /> },
  { id: 'about',         label: 'About',          icon: <Info size={14} /> },
] as const

type SectionId = typeof SECTIONS[number]['id']
const MOBILE_SECTION_LABELS: Partial<Record<SectionId, string>> = {
  general: 'General',
  weather: 'Weather',
  traffic: 'Traffic',
  display: 'Display',
  remote: 'Remote',
  store: 'Store',
  configuredStores: 'Stores',
  reports: 'Reports',
  announcements: 'News',
  access: 'Access',
  sync: 'Sync',
  about: 'About',
}
const LIMITED_SETTINGS_SECTIONS: SectionId[] = ['weather', 'traffic']
const MANAGER_HIDDEN_SECTIONS: SectionId[] = ['store', 'configuredStores', 'remote']
const DISTRICT_HIDDEN_SECTIONS: SectionId[] = ['store']
const STANDALONE_SETTINGS_SECTIONS: SectionId[] = ['reports']
const SECTION_SEARCH_TERMS: Record<SectionId, string> = {
  general: 'theme accent zoom time temperature session',
  weather: 'forecast weather location radar temperature',
  traffic: 'traffic roads commute cameras alerts',
  display: 'display screen slides interval kiosk',
  remote: 'remote kiosk approval refresh update command',
  store: 'store details hours profile number',
  configuredStores: 'stores database configured delete sync',
  reports: 'reports print goals commission',
  announcements: 'announcements messages alerts display urgent',
  access: 'access login roles pin codes permissions',
  sync: 'sync database supabase cloud status schema',
  about: 'about version build support update notes',
}

function isSectionId(value: string): value is SectionId {
  return SECTIONS.some((section) => section.id === value)
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const accessRole = useUiStore((state) => state.accessRole)
  const requestedSection = useUiStore((state) => state.settingsSection)
  const setSettingsSection = useUiStore((state) => state.setSettingsSection)
  const [sectionQuery, setSectionQuery] = useState('')
  const visibleSections = useMemo(() => (
    accessRole === 'employee'
      ? SECTIONS.filter((section) => LIMITED_SETTINGS_SECTIONS.includes(section.id))
      : accessRole === 'manager'
        ? SECTIONS.filter((section) => !MANAGER_HIDDEN_SECTIONS.includes(section.id))
        : accessRole === 'district_manager'
          ? SECTIONS.filter((section) => !DISTRICT_HIDDEN_SECTIONS.includes(section.id))
      : SECTIONS
  ).filter((section) => !STANDALONE_SETTINGS_SECTIONS.includes(section.id)), [accessRole])
  const fallbackSection = visibleSections[0]?.id ?? 'weather'
  const [active, setActive] = useState<SectionId>(
    isSectionId(requestedSection) && visibleSections.some((section) => section.id === requestedSection)
      ? requestedSection
      : fallbackSection
  )

  useEffect(() => {
    if (isSectionId(requestedSection) && visibleSections.some((section) => section.id === requestedSection)) {
      setActive(requestedSection)
      return
    }
    if (!visibleSections.some((section) => section.id === active)) setActive(fallbackSection)
  }, [active, fallbackSection, requestedSection, visibleSections])

  const activeSection = visibleSections.some((section) => section.id === active) ? active : fallbackSection
  const searchedSections = useMemo(() => {
    const query = sectionQuery.trim().toLowerCase()
    if (!query) return visibleSections
    return visibleSections.filter((section) => (
      `${section.label} ${SECTION_SEARCH_TERMS[section.id]}`.toLowerCase().includes(query)
    ))
  }, [sectionQuery, visibleSections])

  const content: Record<SectionId, React.ReactNode> = {
    general:       <GeneralSection />,
    weather:       <WeatherPage />,
    traffic:       <TrafficPage />,
    display:       <DisplaySettingsSection />,
    remote:        <RemoteSection />,
    store:         <StoreSection />,
    configuredStores: <ConfiguredStoresSection />,
    reports:       <ReportSection />,
    announcements: <AnnouncementsSection />,
    access:        <AccessSection />,
    sync:          <SyncStatusSection />,
    about:         <AboutSection />,
  }

  return (
    <div className="tool-suite settings-admin-page flex h-full flex-col overflow-hidden">
      <ModuleHeader
        icon={<SlidersHorizontal size={18} />}
        eyebrow="System administration"
        title="Settings"
        description="Configure store identity, displays, integrations, access, reports, and application preferences."
      />
      <div className="settings-workspace flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
      {/* Sidebar */}
      <nav aria-label="Settings sections" className="settings-section-nav sm:w-56 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--border)] flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto px-3 py-2 sm:px-2 sm:py-3">
        <div className="relative mb-1 hidden sm:block">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={sectionQuery}
            onChange={(event) => setSectionQuery(event.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] pl-8 pr-3 text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
            placeholder="Search settings"
          />
        </div>
        {searchedSections.length === 0 ? (
          <div className="hidden rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-secondary)] sm:block">
            No settings match.
          </div>
        ) : searchedSections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setActive(s.id)
              setSettingsSection(s.id)
            }}
            aria-current={activeSection === s.id ? 'page' : undefined}
            className={`settings-section-tab relative flex items-center gap-2.5 sm:mx-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left whitespace-nowrap ${
              activeSection === s.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--reveal-bg)] hover:text-[var(--text)]'
            }`}
          >
            {activeSection === s.id && (
              <motion.div
                layoutId="activeSettingsTab"
                className="absolute inset-0 rounded-xl bg-[var(--accent)]/12"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex min-w-0 items-center gap-2.5 flex-1">
              <span className="settings-section-icon">{s.icon}</span>
              <span className="settings-section-label-full">{s.label}</span>
              <span className="settings-section-label-mobile">{MOBILE_SECTION_LABELS[s.id] ?? s.label}</span>
            </span>
            {active === s.id && <ChevronRight size={12} className="relative z-10 ml-auto opacity-60 hidden sm:block" />}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="settings-content flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {content[activeSection]}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </div>
  )
}
