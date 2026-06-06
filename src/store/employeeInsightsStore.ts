import { create } from 'zustand'
import {
  dbDeleteEmployeeSale,
  dbGetStores,
  dbGetEmployeeSales,
  dbGetEmployeeSchedulePreferences,
  dbInsertEmployeeSale,
  dbUpsertEmployeeSchedulePreference,
} from '../lib/supabase'
import { currentStoreId } from './currentStoreId'

const PREFS_KEY = 'luna-employee-schedule-preferences'
const SALES_KEY = 'luna-employee-sales'

export type EmployeeSchedulePreference = {
  employeeId: string
  storeId?: string
  preferredDays: number[]
  unavailableDays: number[]
  preferredBlocks: string[]
  maxHoursPerWeek: number | null
  notes: string
  updatedAt: string
}

export type EmployeeSaleCategory = 'voice' | 'bts' | 'hsi' | 'accessory' | 'other'

export type EmployeeSale = {
  id: string
  storeId?: string
  employeeId: string
  saleDate: string
  category: EmployeeSaleCategory
  grossRevenue: number
  accessoryRevenue: number
  protectionCount: number
  estimatedNetRevenue: number
  note: string
  createdAt: string
}

interface EmployeeInsightsState {
  preferences: EmployeeSchedulePreference[]
  sales: EmployeeSale[]
  isLoaded: boolean
  loadInsights: () => Promise<void>
  savePreference: (preference: EmployeeSchedulePreference) => Promise<void>
  addSale: (sale: Omit<EmployeeSale, 'id' | 'createdAt'>) => Promise<EmployeeSale>
  removeSale: (id: string) => Promise<void>
}

function loadLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocal<T>(key: string, values: T[]) {
  localStorage.setItem(key, JSON.stringify(values))
}

function storeScoped<T extends { storeId?: string }>(values: T[], storeId: string) {
  return values.filter((value) => (value.storeId ?? storeId) === storeId)
}

function anyStore<T extends { storeId?: string }>(values: T[]) {
  return values
}

export function estimateNetRevenue(input: {
  grossRevenue: number
  accessoryRevenue: number
  protectionCount: number
}) {
  return input.grossRevenue + input.accessoryRevenue + (input.protectionCount * 18)
}

export const useEmployeeInsightsStore = create<EmployeeInsightsState>()((set, get) => ({
  preferences: [],
  sales: [],
  isLoaded: false,

  loadInsights: async () => {
    const storeId = currentStoreId()
    const storeIds = storeId === 'MAIN'
      ? (await dbGetStores()).map((store) => store.store_id).filter((id) => id && id !== 'main' && id !== 'MAIN')
      : [storeId]
    const [remotePreferences, remoteSales] = await Promise.all([
      Promise.all(storeIds.map(dbGetEmployeeSchedulePreferences)),
      Promise.all(storeIds.map(dbGetEmployeeSales)),
    ])
    const localPreferences = storeId === 'MAIN'
      ? anyStore(loadLocal<EmployeeSchedulePreference>(PREFS_KEY))
      : storeScoped(loadLocal<EmployeeSchedulePreference>(PREFS_KEY), storeId)
    const localSales = storeId === 'MAIN'
      ? anyStore(loadLocal<EmployeeSale>(SALES_KEY))
      : storeScoped(loadLocal<EmployeeSale>(SALES_KEY), storeId)
    const flatRemotePreferences = remotePreferences.flat()
    const flatRemoteSales = remoteSales.flat()
    set({
      preferences: flatRemotePreferences.length > 0 ? flatRemotePreferences : localPreferences,
      sales: flatRemoteSales.length > 0 ? flatRemoteSales : localSales,
      isLoaded: true,
    })
  },

  savePreference: async (preference) => {
    const storeId = preference.storeId ?? currentStoreId()
    const nextPreference = {
      ...preference,
      storeId,
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({
      preferences: [
        ...s.preferences.filter((item) => item.employeeId !== nextPreference.employeeId),
        nextPreference,
      ],
    }))
    const savedRemotely = await dbUpsertEmployeeSchedulePreference(nextPreference, storeId)
    if (!savedRemotely) saveLocal(PREFS_KEY, get().preferences)
  },

  addSale: async (sale) => {
    const storeId = sale.storeId ?? currentStoreId()
    const nextSale: EmployeeSale = {
      ...sale,
      id: crypto.randomUUID(),
      storeId,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ sales: [nextSale, ...s.sales] }))
    const savedRemotely = await dbInsertEmployeeSale(nextSale, storeId)
    if (!savedRemotely) saveLocal(SALES_KEY, get().sales)
    return nextSale
  },

  removeSale: async (id) => {
    const nextSales = get().sales.filter((sale) => sale.id !== id)
    set({ sales: nextSales })
    const deletedRemotely = await dbDeleteEmployeeSale(id)
    if (!deletedRemotely) saveLocal(SALES_KEY, nextSales)
  },
}))
