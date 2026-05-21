import { useUiStore } from './uiStore'

export function currentStoreId() {
  return useUiStore.getState().storeId || 'default'
}
