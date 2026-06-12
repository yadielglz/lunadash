import { useEffect, useState } from 'react'
import { RefreshCw, Store } from 'lucide-react'
import { dbGetStores, type StoreSummary } from '../../lib/supabase'
import { normalizeStoreId } from '../../lib/storeIds'
import { useUiStore } from '../../store/uiStore'
import { Button } from '../ui/Button'
import { Select } from '../ui/Input'
import { Modal } from '../ui/Modal'

interface StorePickerButtonProps {
  autoOpen?: boolean
  className?: string
  requireSelection?: boolean
  compact?: boolean
  readOnlyWhenLocked?: boolean
}

export function StorePickerButton({
  autoOpen = false,
  className,
  requireSelection = false,
  compact = false,
  readOnlyWhenLocked = false,
}: StorePickerButtonProps) {
  const storeId = useUiStore((s) => s.storeId)
  const accessRole = useUiStore((s) => s.accessRole)
  const setStoreId = useUiStore((s) => s.setStoreId)
  const canChooseStore = accessRole === 'admin' || accessRole === 'district_manager'
  const [open, setOpen] = useState(autoOpen && canChooseStore)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [storesError, setStoresError] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState(storeId === 'main' ? '' : storeId)

  const loadStores = async () => {
    setStoresLoading(true)
    setStoresError('')
    try {
      setStores((await dbGetStores()).filter((store) => normalizeStoreId(store.store_id) !== 'main'))
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : 'Could not load stores')
    } finally {
      setStoresLoading(false)
    }
  }

  useEffect(() => {
    if (!autoOpen || !canChooseStore) return
    setOpen(true)
    loadStores()
  }, [autoOpen, canChooseStore])

  useEffect(() => {
    if (storeId !== 'main') setSelectedStoreId(storeId)
  }, [storeId])

  if (!canChooseStore) {
    if (!readOnlyWhenLocked) return null

    return (
      <button
        type="button"
        className={className}
        disabled
        title={storeId || 'Store'}
      >
        <Store size={15} />
        <span className={compact ? 'text-[9px] font-semibold leading-none tabular-nums' : ''}>{storeId || 'Store'}</span>
      </button>
    )
  }

  const openPicker = () => {
    setOpen(true)
    loadStores()
  }

  const closePicker = () => {
    if (requireSelection && storeId === 'main') return
    setOpen(false)
  }

  const applyStore = () => {
    const nextStoreId = normalizeStoreId(selectedStoreId)
    if (!nextStoreId || nextStoreId === 'main') return
    setStoreId(nextStoreId)
    setOpen(false)
  }

  return (
    <>
      <Button className={className} size="sm" variant="ghost" icon={<Store size={13} />} onClick={openPicker}>
        {compact ? (
          <span className="text-[9px] font-semibold leading-none tabular-nums">{storeId || 'Store'}</span>
        ) : 'Store'}
      </Button>
      <Modal open={open} onClose={closePicker} title="Choose Store" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text)]">Which store do you want to open?</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Pick one configured location so schedules, goals, tasks, and updates stay scoped to that store.
            </p>
          </div>
          <Select
            label="Store"
            value={selectedStoreId}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setSelectedStoreId(event.target.value)}
          >
            <option value="" disabled>Select a store</option>
            {stores.map((store) => (
              <option key={store.store_id} value={store.store_id}>
                {store.company_name || 'Luna Store'}{store.store_number ? ` #${store.store_number}` : ''} ({store.store_id})
              </option>
            ))}
            {storeId !== 'main' && !stores.some((store) => normalizeStoreId(store.store_id) === normalizeStoreId(storeId)) && (
              <option value={storeId}>{storeId} (current)</option>
            )}
          </Select>
          {storesError && <p className="text-xs text-red-400">{storesError}</p>}
          <div className="flex justify-between gap-2">
            <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={loadStores} loading={storesLoading}>
              Refresh
            </Button>
            <Button size="sm" variant="primary" icon={<Store size={12} />} onClick={applyStore} disabled={!selectedStoreId}>
              Open Store
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
