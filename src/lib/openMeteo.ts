export interface CurrentWeather {
  temperature: number
  windspeed: number
  winddirection: number
  weathercode: number
  is_day: number
  time: string
}

export interface DailyForecast {
  time: string[]
  weathercode: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_probability_max: number[]
}

export interface HourlyForecast {
  time: string[]
  temperature_2m: number[]
  precipitation_probability: number[]
  weathercode: number[]
}

export interface WeatherData {
  current_weather: CurrentWeather
  daily: DailyForecast
  hourly: HourlyForecast
  alerts: WeatherAlert[]
  alertsUnavailable?: boolean
  latitude: number
  longitude: number
  timezone: string
}

export interface WeatherAlert {
  id: string
  event: string
  headline: string
  severity: string
  urgency: string
  area: string
  effective: string
  expires: string
  description: string
  instruction?: string
}

export interface GeocodingResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country: string
  country_code: string
  admin1?: string
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(4))
  url.searchParams.set('longitude', lon.toFixed(4))
  url.searchParams.set('current_weather', 'true')
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weathercode')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '7')
  url.searchParams.set('windspeed_unit', 'mph')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Weather fetch failed')
  const data = await res.json()

  try {
    const alerts = await fetchWeatherAlerts(lat, lon, 4500)
    return { ...data, alerts, alertsUnavailable: false }
  } catch {
    return { ...data, alerts: [], alertsUnavailable: true }
  }
}

async function fetchWeatherAlerts(lat: number, lon: number, timeoutMs: number): Promise<WeatherAlert[]> {
  const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  const res = await fetch(url, {
    headers: { Accept: 'application/geo+json' },
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeoutId))
  if (!res.ok) throw new Error('Weather alerts unavailable')
  const data = await res.json()
  return (data.features ?? []).map((feature: {
    id?: string
    properties?: {
      id?: string
      event?: string
      headline?: string
      severity?: string
      urgency?: string
      areaDesc?: string
      effective?: string
      expires?: string
      description?: string
      instruction?: string
    }
  }) => {
    const p = feature.properties ?? {}
    return {
      id: feature.id ?? p.id ?? crypto.randomUUID(),
      event: p.event ?? 'Weather Alert',
      headline: p.headline ?? p.event ?? 'Weather Alert',
      severity: p.severity ?? 'Unknown',
      urgency: p.urgency ?? 'Unknown',
      area: p.areaDesc ?? '',
      effective: p.effective ?? '',
      expires: p.expires ?? '',
      description: p.description ?? '',
      instruction: p.instruction ?? '',
    }
  })
}

export async function geocodeCity(city: string): Promise<GeocodingResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Geocoding failed')
  const data = await res.json()
  return data.results ?? []
}

// WMO Weather Codes
export const WMO_CODES: Record<number, { label: string; icon: string; icon_night?: string }> = {
  0:  { label: 'Clear sky',           icon: '☀️', icon_night: '🌙' },
  1:  { label: 'Mainly clear',        icon: '🌤️', icon_night: '🌙' },
  2:  { label: 'Partly cloudy',       icon: '⛅', icon_night: '☁️' },
  3:  { label: 'Overcast',            icon: '☁️' },
  45: { label: 'Foggy',               icon: '🌫️' },
  48: { label: 'Icy fog',             icon: '🌫️' },
  51: { label: 'Light drizzle',       icon: '🌦️' },
  53: { label: 'Drizzle',             icon: '🌧️' },
  55: { label: 'Heavy drizzle',       icon: '🌧️' },
  61: { label: 'Slight rain',         icon: '🌧️' },
  63: { label: 'Moderate rain',       icon: '🌧️' },
  65: { label: 'Heavy rain',          icon: '⛈️' },
  71: { label: 'Slight snow',         icon: '🌨️' },
  73: { label: 'Moderate snow',       icon: '❄️' },
  75: { label: 'Heavy snow',          icon: '🌨️' },
  77: { label: 'Snow grains',         icon: '❄️' },
  80: { label: 'Slight showers',      icon: '🌦️' },
  81: { label: 'Moderate showers',    icon: '🌧️' },
  82: { label: 'Violent showers',     icon: '⛈️' },
  85: { label: 'Slight snow showers', icon: '🌨️' },
  86: { label: 'Heavy snow showers',  icon: '🌨️' },
  95: { label: 'Thunderstorm',        icon: '⛈️' },
  96: { label: 'Thunderstorm + hail', icon: '⛈️' },
  99: { label: 'Thunderstorm + hail', icon: '⛈️' },
}

export function getWeatherInfo(code: number, isDay = 1) {
  const info = WMO_CODES[code] ?? { label: 'Unknown', icon: '🌡️' }
  return {
    label: info.label,
    icon: isDay ? info.icon : (info.icon_night ?? info.icon),
  }
}

export function getWindDirection(deg: number): string {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}

export function formatWeatherTimezone(timezone: string): string {
  if (!timezone) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(new Date())
  } catch {
    return timezone.split('/').pop()?.replace('_', ' ') ?? timezone
  }
}
