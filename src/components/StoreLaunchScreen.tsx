import { useEffect, useState } from 'react'
import { Building2, RefreshCw } from 'lucide-react'
import { dbGetStores, dbUpdateSettings, StoreSummary } from '../lib/supabase'
import { useUiStore } from '../store/uiStore'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Input'

export function StoreLaunchScreen() {
  const setStoreId = useUiStore((s) => s.setStoreId)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [selected, setSelected] = useState('main')
  const [newStoreId, setNewStoreId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadStores = async () => {
    setIsLoading(true)
    setError('')
    try {
      const rows = await dbGetStores()
      setStores(rows)
      if (rows.length === 0) setSelected('default')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stores')
      setStores([])
      setSelected('default')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  const addStore = async () => {
    const id = newStoreId.trim() || 'default'
    await dbUpdateSettings(id, { company_name: 'Luna Store', store_number: '', slide_interval: 8 })
    setNewStoreId('')
    setStoreId(id)
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg)] px-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-modal)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[var(--accent)]/12 text-[var(--accent)] flex items-center justify-center">
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">Choose Dashboard</h1>
            <p className="text-xs text-[var(--text-secondary)]">Select the store view for this device.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Select label="Dashboard View" value={selected} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelected(e.target.value)}>
            <option value="main">Main Dashboard - All Stores</option>
            {stores.map((store) => (
              <option key={store.store_id} value={store.store_id}>
                {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
              </option>
            ))}
            <option value="default">Default Store</option>
          </Select>

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} loading={isLoading} onClick={loadStores}>
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setStoreId(selected || 'default')}>
              Continue
            </Button>
          </div>

          <div className="border-t border-[var(--border)] pt-4 space-y-2">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Add a store instead</p>
            <div className="flex gap-2">
              <Input
                value={newStoreId}
                onChange={(e) => setNewStoreId(e.target.value)}
                placeholder="Store ID, e.g. 693D"
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') addStore() }}
              />
              <Button size="sm" onClick={addStore}>Add</Button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
