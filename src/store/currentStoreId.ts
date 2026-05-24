import { useUiStore } from './uiStore'
import { normalizeStoreId } from '../lib/storeIds'

export function currentStoreId() {
  return normalizeStoreId(useUiStore.getState().storeId) || 'DEFAULT'
}
