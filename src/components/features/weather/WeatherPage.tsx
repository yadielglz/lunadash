import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, LocateFixed, Search, Wind, Droplets, Thermometer, MapPin, RefreshCw } from 'lucide-react'
import { CENTRAL_FLORIDA_WEATHER_POINTS, useWeather, useGeocode, type WeatherLocation } from '../../../hooks/useWeather'
import { formatWeatherTimezone, getWeatherInfo, getWindDirection, type GeocodingResult } from '../../../lib/openMeteo'
import { useTempDisplay } from '../../../hooks/useTempDisplay'
import { format } from 'date-fns'
import { Input } from '../../ui/Input'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { getStoreWeatherLocation } from '../../../config/storeWeather'
import { useUiStore } from '../../../store/uiStore'

export function WeatherPage() {
  const queryClient = useQueryClient()
  const storeId = useUiStore((state) => state.storeId)
  const storeWeatherLocation = getStoreWeatherLocation(storeId)
  const [citySearch, setCitySearch] = useState('')
  const [locating, setLocating] = useState(false)
  const { data: geoResults } = useGeocode(citySearch)
  const { data, isLoading, isError, isFetching, refetch, location, setLocation, locateDevice: requestDeviceLocation, locationError } = useWeather()
  const { fmt, unit, toggleTempUnit } = useTempDisplay()

  const selectCity = (result: GeocodingResult) => {
    const nextLocation: WeatherLocation = {
      lat: result.latitude,
      lon: result.longitude,
      name: [result.name, result.admin1, result.country_code].filter(Boolean).join(', '),
      source: 'saved',
    }
    setLocation(nextLocation)
    setCitySearch('')
  }

  const selectWeatherPoint = (point: WeatherLocation) => {
    setLocation({ ...point, source: 'saved' })
  }

  const locateDevice = async () => {
    setLocating(true)
    try {
      await requestDeviceLocation()
    } catch {
      // The hook exposes the permission/support message in the page.
    } finally {
      setLocating(false)
    }
  }

  const refreshWeather = async () => {
    await queryClient.invalidateQueries({ queryKey: ['weather'] })
    await refetch()
  }

  const cw = data?.current_weather
  const weather = cw ? getWeatherInfo(cw.weathercode, cw.is_day) : null
  const timezoneLabel = data ? formatWeatherTimezone(data.timezone) : ''

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-xl font-semibold text-[var(--text)]">🌤️ Weather</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />}
              onClick={refreshWeather}
              loading={isFetching}
            >
              Refresh
            </Button>
            {/* °F / °C toggle */}
            <button
              onClick={toggleTempUnit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-pill border border-[var(--border)] bg-[var(--surface-2)] text-sm font-semibold text-[var(--accent)] hover:bg-[var(--surface-3)] hover:border-[var(--accent)]/40 transition-colors"
              title="Toggle temperature unit"
            >
              <Thermometer size={13} />
              {unit}
            </button>
          </div>
        </div>
        {storeWeatherLocation ? (
          <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--text)]">
            <MapPin size={14} className="text-[var(--accent)]" />
            <span className="truncate">{storeWeatherLocation.name}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className="relative max-w-sm w-full">
              <Input
                icon={<Search size={14} />}
                placeholder="Search city..."
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
              />
              {geoResults && geoResults.length > 0 && citySearch.length > 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden z-50 shadow-[var(--shadow-float)]">
                  {geoResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => selectCity(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--reveal-bg)] transition-colors flex items-center gap-2"
                    >
                      <MapPin size={12} className="text-[var(--text-tertiary)]" />
                      <span className="text-[var(--text)]">{r.name}</span>
                      <span className="text-[var(--text-tertiary)] text-xs">{r.admin1}, {r.country}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {CENTRAL_FLORIDA_WEATHER_POINTS.map((point) => (
                <Button
                  key={point.name}
                  size="sm"
                  variant={Math.abs(location.lat - point.lat) < 0.01 && Math.abs(location.lon - point.lon) < 0.01 ? 'accent' : 'secondary'}
                  icon={<MapPin size={12} />}
                  onClick={() => selectWeatherPoint(point)}
                >
                  {point.name.replace('Store ', '').replace(' - ', ' ')}
                </Button>
              ))}
              <Button
                size="sm"
                variant="secondary"
                icon={<LocateFixed size={12} />}
                loading={locating}
                onClick={locateDevice}
              >
                Use device
              </Button>
            </div>
          </div>
        )}
        {locationError && (
          <p className="mt-2 text-xs text-red-400">{locationError}</p>
        )}
        {location.source === 'default' && !location.name.startsWith('Store ') && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Using Haines City until GeoIP finishes or you pick a store weather point.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isError && !data && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-5xl">📡</span>
            <p className="text-sm text-[var(--text-secondary)]">Enable location or search for a city above</p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            <div className="shimmer h-40 rounded-lg" />
            <div className="shimmer h-24 rounded-lg" />
            <div className="grid grid-cols-7 gap-2">
              {[...Array(7)].map((_, i) => <div key={i} className="shimmer h-28 rounded-xl" />)}
            </div>
          </div>
        )}

        {data && weather && cw && (
          <>
            {/* Current conditions hero */}
            <Card
              className="!p-6 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-end gap-2">
                    <span className="text-7xl font-thin text-[var(--text)] tabular-nums">{fmt(cw.temperature)}</span>
                    <button
                      onClick={toggleTempUnit}
                      className="text-2xl mb-3 text-[var(--accent)] hover:underline font-medium"
                      title="Toggle °F / °C"
                    >
                      {unit}
                    </button>
                  </div>
                  <p className="text-lg font-medium text-[var(--text)]">{weather.label}</p>
                  <div className="flex items-center gap-1 mt-1 text-sm text-[var(--text-secondary)]">
                    <MapPin size={13} />
                    <span>{location.name}</span>
                  </div>
                </div>
                <motion.span
                  className="text-7xl leading-none"
                >
                  {weather.icon}
                </motion.span>
              </div>

              {data.alerts.length > 0 && (
                <div className="mt-5 space-y-2">
                  {data.alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="mt-0.5 text-red-400" />
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">{alert.event}</div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{alert.headline}</div>
                          {alert.area && <div className="text-[10px] text-[var(--text-tertiary)] mt-1">{alert.area}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {data.alerts.length === 0 && !data.alertsUnavailable && (
                <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-3)] p-3 text-xs text-[var(--text-secondary)]">
                  No active National Weather Service alerts for {location.name}. Expired alerts are not shown.
                </div>
              )}

              {data.alertsUnavailable && (
                <div className="mt-5 rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                  National Weather Service alerts could not be loaded for this location.
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                {[
                  { icon: <Wind size={14} />, label: 'Wind', value: `${Math.round(cw.windspeed)} mph ${getWindDirection(cw.winddirection)}` },
                  { icon: <Droplets size={14} />, label: 'Precip.', value: `${data.daily.precipitation_probability_max[0]}%` },
                  { icon: <Thermometer size={14} />, label: 'High / Low', value: `${fmt(data.daily.temperature_2m_max[0])}${unit} / ${fmt(data.daily.temperature_2m_min[0])}${unit}` },
                  { icon: <MapPin size={14} />, label: 'Local Time', value: timezoneLabel },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-3)] p-3">
                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)] mb-1">
                      {icon}
                      <span className="text-xs">{label}</span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--text)]">{value}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 7-day forecast */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-3">7-Day Forecast</h3>
              <div className="grid grid-cols-7 gap-2">
                {data.daily.time.map((dateStr, i) => {
                  const dayWeather = getWeatherInfo(data.daily.weathercode[i])
                  const isToday = i === 0
                  return (
                    <motion.div
                      key={dateStr}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Card
                        className={`!p-2 text-center flex flex-col items-center gap-1 ${isToday ? '!border-[var(--accent)]/40' : ''}`}
                        style={isToday ? { background: 'rgba(0,120,212,0.08)' } : {}}
                      >
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">
                          {isToday ? 'Today' : format(new Date(dateStr + 'T12:00'), 'EEE')}
                        </span>
                        <span className="text-xl">{dayWeather.icon}</span>
                        <span className="text-sm font-semibold text-[var(--text)]">{fmt(data.daily.temperature_2m_max[i])}{unit}</span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">{fmt(data.daily.temperature_2m_min[i])}{unit}</span>
                        <div className="flex items-center gap-0.5 text-[9px] text-[var(--text-tertiary)]">
                          <Droplets size={8} />
                          {data.daily.precipitation_probability_max[i]}%
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
