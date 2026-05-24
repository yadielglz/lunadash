import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { fetchWeather, geocodeCity } from '../lib/openMeteo'

interface Coords { lat: number; lon: number }
interface WeatherOptions { useGeolocation?: boolean }

const WEATHER_COORDS_KEY = 'luna-weather-coords'
const WEATHER_COORDS_EVENT = 'luna-weather-coords-change'
const DEFAULT_COORDS: Coords = { lat: 33.4484, lon: -112.0740 }

function readCachedCoords(): Coords | null {
  try {
    const raw = localStorage.getItem(WEATHER_COORDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Coords>
    if (typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') return null
    return { lat: parsed.lat, lon: parsed.lon }
  } catch {
    return null
  }
}

export function writeCachedWeatherCoords(coords: Coords) {
  try {
    localStorage.setItem(WEATHER_COORDS_KEY, JSON.stringify(coords))
  } catch {
    // Weather should still work if storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<Coords>(WEATHER_COORDS_EVENT, { detail: coords }))
}

function useGeolocation(enabled = true) {
  const [coords, setCoords] = useState<Coords | null>(() => readCachedCoords())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCoordsChange = (event: Event) => {
      const nextCoords = (event as CustomEvent<Coords>).detail
      if (typeof nextCoords?.lat !== 'number' || typeof nextCoords?.lon !== 'number') return
      setCoords(nextCoords)
    }

    window.addEventListener(WEATHER_COORDS_EVENT, handleCoordsChange)
    return () => window.removeEventListener(WEATHER_COORDS_EVENT, handleCoordsChange)
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setCoords(nextCoords)
        writeCachedWeatherCoords(nextCoords)
      },
      () => setError('Location denied'),
      { maximumAge: 30 * 60 * 1000, timeout: 3000 }
    )
  }, [enabled])

  return { coords, error }
}

export function useWeather(manualCoords?: Coords, options: WeatherOptions = {}) {
  const shouldUseGeolocation = options.useGeolocation ?? true
  const { coords: geoCoords, error: geoError } = useGeolocation(shouldUseGeolocation && !manualCoords)
  const coords = manualCoords ?? geoCoords ?? DEFAULT_COORDS

  return useQuery({
    queryKey: ['weather', coords?.lat, coords?.lon],
    queryFn: () => fetchWeather(coords.lat, coords.lon),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    meta: { geoError },
  })
}

export function useGeocode(city: string) {
  return useQuery({
    queryKey: ['geocode', city],
    queryFn: () => geocodeCity(city),
    enabled: city.length > 2,
    staleTime: 30 * 60 * 1000,
  })
}
