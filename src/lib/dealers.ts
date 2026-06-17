import type { PerformanceRow } from './performanceSheet'
import { STORE_PROFILES, getStoreProfile } from '../config/storeProfiles'

export type DealerInfo = {
  code: string
  nickname: string
  location: string
  address?: string
  city?: string
  state?: string
  zip?: string
  lat?: number
  lon?: number
}

export const DEALERS_BY_CODE: Record<string, DealerInfo> = STORE_PROFILES.reduce((acc, profile) => {
  acc[profile.storeId] = {
    code: profile.storeId,
    nickname: profile.nickname,
    location: profile.location,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    lat: profile.lat,
    lon: profile.lon,
  }
  return acc
}, {} as Record<string, DealerInfo>)

let dealerOverrides: Record<string, Partial<Pick<DealerInfo, 'nickname' | 'location'>>> = {}

export function setDealerOverrides(stores: { store_id: string; dealer_nickname?: string | null; dealer_location?: string | null }[]) {
  dealerOverrides = stores.reduce((acc, store) => {
    const code = store.store_id.trim().toUpperCase()
    if (!code || code === 'MAIN') return acc
    const nickname = store.dealer_nickname?.trim()
    const location = store.dealer_location?.trim()
    if (nickname || location) acc[code] = { nickname, location }
    return acc
  }, {} as typeof dealerOverrides)
}

export function setDealerOverride(store: { store_id: string; dealer_nickname?: string | null; dealer_location?: string | null }) {
  const code = store.store_id.trim().toUpperCase()
  if (!code || code === 'MAIN') return
  const nickname = store.dealer_nickname?.trim()
  const location = store.dealer_location?.trim()
  dealerOverrides = {
    ...dealerOverrides,
    [code]: { nickname, location },
  }
}

export function getDealerInfo(code: string): DealerInfo | null {
  const normalized = code.trim().toUpperCase()
  const base = DEALERS_BY_CODE[normalized]
  const profile = getStoreProfile(normalized)
  const override = dealerOverrides[normalized]
  if (!base && !override && !profile) return null
  return {
    code: normalized,
    nickname: override?.nickname || base?.nickname || profile?.nickname || normalized,
    location: override?.location || base?.location || profile?.location || normalized,
    address: profile?.address || base?.address,
    city: profile?.city || base?.city,
    state: profile?.state || base?.state,
    zip: profile?.zip || base?.zip,
    lat: profile?.lat ?? base?.lat,
    lon: profile?.lon ?? base?.lon,
  }
}

export function dealerInfoForRow(row: PerformanceRow): DealerInfo {
  const mapped = getDealerInfo(row.storeCode)

  return {
    code: row.storeCode,
    nickname: mapped?.nickname || row.teamName || row.store,
    location: mapped?.location || row.store,
  }
}
