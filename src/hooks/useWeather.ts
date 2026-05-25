import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { fetchWeather, geocodeCity } from '../lib/openMeteo'
import { getStoreWeatherLocation, STORE_WEATHER_LOCATIONS } from '../config/storeWeather'
import { useUiStore } from '../store/uiStore'

interface Coords { lat: number; lon: number }
interface WeatherOptions { useGeolocation?: boolean }
export interface WeatherLocation extends Coords {
  name: string
  source: 'saved' | 'device' | 'geoip' | 'default'
}

const WEATHER_COORDS_KEY = 'luna-weather-coords'
const WEATHER_COORDS_EVENT = 'luna-weather-coords-change'
const GEOIP_LOOKUP_KEY = 'luna-weather-geoip-lookup'
const GEOIP_LOOKUP_TTL = 12 * 60 * 60 * 1000

export const CENTRAL_FLORIDA_WEATHER_POINTS: WeatherLocation[] = [
  ...STORE_WEATHER_LOCATIONS,
  { name: 'Haines City, FL', lat: 28.1142, lon: -81.6179, source: 'default' },
  { name: 'Davenport, FL', lat: 28.1614, lon: -81.6017, source: 'default' },
  { name: 'Kissimmee, FL', lat: 28.2919, lon: -81.4076, source: 'default' },
]

const DEFAULT_LOCATION = CENTRAL_FLORIDA_WEATHER_POINTS[0]

function storedLocation(location: WeatherLocation): WeatherLocation {
  return { ...location, source: location.source === 'default' ? 'saved' : location.source }
}

function readCachedWeatherLocation(): WeatherLocation | null {
  try {
    const raw = localStorage.getItem(WEATHER_COORDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WeatherLocation>
    if (typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') return null
    if (typeof parsed.name !== 'string') return null
    return {
      lat: parsed.lat,
      lon: parsed.lon,
      name: parsed.name,
      source: 'saved',
    }
  } catch {
    return null
  }
}

export function writeCachedWeatherLocation(location: WeatherLocation) {
  try {
    localStorage.setItem(WEATHER_COORDS_KEY, JSON.stringify(storedLocation(location)))
  } catch {
    // Weather should still work if storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<WeatherLocation>(WEATHER_COORDS_EVENT, { detail: location }))
}

export function writeCachedWeatherCoords(coords: Coords, name = 'Saved location') {
  writeCachedWeatherLocation({ ...coords, name, source: 'saved' })
}

function readGeoIpLookupTime() {
  try {
    return Number(localStorage.getItem(GEOIP_LOOKUP_KEY) ?? 0)
  } catch {
    return 0
  }
}

function writeGeoIpLookupTime() {
  try {
    localStorage.setItem(GEOIP_LOOKUP_KEY, String(Date.now()))
  } catch {
    // Non-critical cache hint.
  }
}

function distanceMiles(a: Coords, b: Coords) {
  const milesPerDegreeLat = 69
  const avgLat = ((a.lat + b.lat) / 2) * Math.PI / 180
  const milesPerDegreeLon = Math.cos(avgLat) * 69
  const dx = (a.lon - b.lon) * milesPerDegreeLon
  const dy = (a.lat - b.lat) * milesPerDegreeLat
  return Math.sqrt(dx * dx + dy * dy)
}

function nearestCentralFloridaPoint(coords: Coords) {
  return CENTRAL_FLORIDA_WEATHER_POINTS.reduce((nearest, point) => (
    distanceMiles(coords, point) < distanceMiles(coords, nearest) ? point : nearest
  ), CENTRAL_FLORIDA_WEATHER_POINTS[0])
}

async function fetchGeoIpLocation(): Promise<WeatherLocation | null> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 2500)

  try {
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal })
    if (!res.ok) return null
    const data = await res.json() as {
      city?: string
      region?: string
      region_code?: string
      latitude?: number
      longitude?: number
    }
    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return null

    const coords = { lat: data.latitude, lon: data.longitude }
    const nearest = nearestCentralFloridaPoint(coords)
    if ((data.region_code === 'FL' || data.region === 'Florida') && distanceMiles(coords, nearest) <= 90) {
      return { ...nearest, source: 'geoip' }
    }

    const region = data.region_code || data.region
    const name = [data.city, region].filter(Boolean).join(', ') || 'GeoIP location'
    return { ...coords, name, source: 'geoip' }
  } catch {
    return null
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function requestDeviceLocation(): Promise<WeatherLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        const nearest = nearestCentralFloridaPoint(coords)
        const location = distanceMiles(coords, nearest) <= 90
          ? { ...nearest, source: 'device' as const }
          : { ...coords, name: 'Device location', source: 'device' as const }
        writeCachedWeatherLocation(location)
        resolve(location)
      },
      () => reject(new Error('Location permission denied')),
      { maximumAge: 30 * 60 * 1000, timeout: 7000 }
    )
  })
}

function useWeatherLocation(enableGeoIp = true) {
  const [location, setLocationState] = useState<WeatherLocation>(() => readCachedWeatherLocation() ?? DEFAULT_LOCATION)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCoordsChange = (event: Event) => {
      const nextLocation = (event as CustomEvent<WeatherLocation>).detail
      if (typeof nextLocation?.lat !== 'number' || typeof nextLocation?.lon !== 'number') return
      setLocationState({
        lat: nextLocation.lat,
        lon: nextLocation.lon,
        name: nextLocation.name || 'Saved location',
        source: nextLocation.source || 'saved',
      })
    }

    window.addEventListener(WEATHER_COORDS_EVENT, handleCoordsChange)
    return () => window.removeEventListener(WEATHER_COORDS_EVENT, handleCoordsChange)
  }, [])

  useEffect(() => {
    if (!enableGeoIp) return
    if (readCachedWeatherLocation()) return
    if (Date.now() - readGeoIpLookupTime() < GEOIP_LOOKUP_TTL) return

    let cancelled = false
    writeGeoIpLookupTime()
    fetchGeoIpLocation().then((geoIpLocation) => {
      if (cancelled || !geoIpLocation) return
      setLocationState(geoIpLocation)
      writeCachedWeatherLocation(geoIpLocation)
    })

    return () => {
      cancelled = true
    }
  }, [enableGeoIp])

  const setLocation = (nextLocation: WeatherLocation) => {
    setError(null)
    setLocationState(nextLocation)
    writeCachedWeatherLocation(nextLocation)
  }

  const useDeviceLocation = async () => {
    try {
      setError(null)
      const nextLocation = await requestDeviceLocation()
      setLocationState(nextLocation)
      return nextLocation
    } catch (locationError) {
      const message = locationError instanceof Error ? locationError.message : 'Unable to use device location'
      setError(message)
      throw locationError
    }
  }

  return { location, setLocation, useDeviceLocation, error }
}

export function useWeather(manualCoords?: Coords, options: WeatherOptions = {}) {
  const shouldUseGeoIp = options.useGeolocation ?? true
  const storeId = useUiStore((s) => s.storeId)
  const storeLocation = getStoreWeatherLocation(storeId)
  const { location, setLocation, useDeviceLocation, error: locationError } = useWeatherLocation(shouldUseGeoIp && !manualCoords)
  const selectedLocation = manualCoords ? { ...manualCoords, name: 'Selected location', source: 'saved' as const } : storeLocation ?? location

  const weatherQuery = useQuery({
    queryKey: ['weather', selectedLocation.lat, selectedLocation.lon],
    queryFn: () => fetchWeather(selectedLocation.lat, selectedLocation.lon),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    meta: { locationError },
  })

  return { ...weatherQuery, location: selectedLocation, setLocation, useDeviceLocation, locationError }
}

export function useGeocode(city: string) {
  return useQuery({
    queryKey: ['geocode', city],
    queryFn: () => geocodeCity(city),
    enabled: city.length > 2,
    staleTime: 30 * 60 * 1000,
  })
}
