import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { fetchWeather, geocodeCity } from '../lib/openMeteo'

interface Coords { lat: number; lon: number }

function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setError('Location denied'),
      { timeout: 10000 }
    )
  }, [])

  return { coords, error }
}

export function useWeather(manualCoords?: Coords) {
  const { coords: geoCoords, error: geoError } = useGeolocation()
  const coords = manualCoords ?? geoCoords

  return useQuery({
    queryKey: ['weather', coords?.lat, coords?.lon],
    queryFn: () => fetchWeather(coords!.lat, coords!.lon),
    enabled: !!coords,
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
