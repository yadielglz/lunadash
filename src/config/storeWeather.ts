import { normalizeStoreId } from '../lib/storeIds'

export type StoreWeatherLocation = {
  storeId: string
  zip: string
  name: string
  lat: number
  lon: number
  source: 'default'
}

export const STORE_WEATHER_LOCATIONS: StoreWeatherLocation[] = [
  { storeId: '180E', zip: '34711', name: 'Store 180E - Clermont, FL 34711', lat: 28.5196, lon: -81.7483, source: 'default' },
  { storeId: '5383', zip: '33837', name: 'Store 5383 - Davenport, FL 33837', lat: 28.1916, lon: -81.6141, source: 'default' },
  { storeId: '561D', zip: '34714', name: 'Store 561D - Clermont, FL 34714', lat: 28.4152, lon: -81.7879, source: 'default' },
  { storeId: '5733', zip: '33881', name: 'Store 5733 - Winter Haven, FL 33881', lat: 28.0544, lon: -81.7008, source: 'default' },
  { storeId: '582D', zip: '33853', name: 'Store 582D - Lake Wales, FL 33853', lat: 27.9019, lon: -81.5798, source: 'default' },
  { storeId: '693D', zip: '33896', name: 'Store 693D - Davenport, FL 33896', lat: 28.2527, lon: -81.6037, source: 'default' },
  { storeId: '697D', zip: '34759', name: 'Store 697D - Kissimmee, FL 34759', lat: 28.0911, lon: -81.4377, source: 'default' },
  { storeId: '769D', zip: '33844', name: 'Store 769D - Haines City, FL 33844', lat: 28.1022, lon: -81.6137, source: 'default' },
  { storeId: '843D', zip: '34744', name: 'Store 843D - Kissimmee, FL 34744', lat: 28.29, lon: -81.32, source: 'default' },
  { storeId: '886E', zip: '32804', name: 'Store 886E - Orlando, FL 32804', lat: 28.5769, lon: -81.3975, source: 'default' },
  { storeId: '892E', zip: '34786', name: 'Store 892E - Windermere, FL 34786', lat: 28.4821, lon: -81.5543, source: 'default' },
]

export function getStoreWeatherLocation(storeId: string | null | undefined): StoreWeatherLocation | null {
  const normalized = normalizeStoreId(storeId ?? '')
  return STORE_WEATHER_LOCATIONS.find((location) => location.storeId === normalized) ?? null
}
