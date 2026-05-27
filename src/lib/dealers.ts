import type { PerformanceRow } from './performanceSheet'

export type DealerInfo = {
  code: string
  nickname: string
  location: string
}

export const DEALERS_BY_CODE: Record<string, DealerInfo> = {
  '892E': { code: '892E', nickname: 'Avengers', location: 'Windermere' },
  '697D': { code: '697D', nickname: 'Wolfpack', location: 'Poinciana' },
  '769D': { code: '769D', nickname: 'Pink Mafia', location: 'Haines City' },
  '180E': { code: '180E', nickname: 'Titans', location: 'Clermont N' },
  '561D': { code: '561D', nickname: 'Top Guns', location: 'Clermont S' },
  '5383': { code: '5383', nickname: 'Pink Panthers', location: 'Davenport' },
  '582D': { code: '582D', nickname: 'Magenta Warriors', location: 'Lake Wales' },
  '843D': { code: '843D', nickname: 'El Cartel', location: 'Kissimmee' },
  '886E': { code: '886E', nickname: "D'Sharks", location: 'College Park' },
  '5733': { code: '5733', nickname: 'Undefeated', location: 'Havendale Blvd' },
  '693D': { code: '693D', nickname: 'GateWay', location: 'Champions Gate' },
}

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
  const override = dealerOverrides[normalized]
  if (!base && !override) return null
  return {
    code: normalized,
    nickname: override?.nickname || base?.nickname || normalized,
    location: override?.location || base?.location || normalized,
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
