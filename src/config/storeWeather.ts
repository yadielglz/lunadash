import { getStoreProfile, STORE_PROFILES } from './storeProfiles'

export type StoreWeatherLocation = {
  storeId: string
  zip: string
  name: string
  lat: number
  lon: number
  source: 'default'
}

export const STORE_WEATHER_LOCATIONS: StoreWeatherLocation[] = STORE_PROFILES.map((profile) => ({
  storeId: profile.storeId,
  zip: profile.zip,
  name: `${profile.storeId} - ${profile.address}`,
  lat: profile.lat,
  lon: profile.lon,
  source: 'default',
}))

export function getStoreWeatherLocation(storeId: string | null | undefined): StoreWeatherLocation | null {
  const profile = getStoreProfile(storeId)
  if (!profile) return null
  return {
    storeId: profile.storeId,
    zip: profile.zip,
    name: `${profile.storeId} - ${profile.address}`,
    lat: profile.lat,
    lon: profile.lon,
    source: 'default',
  }
}
