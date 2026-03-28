import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Wind, Droplets, Thermometer, MapPin } from 'lucide-react'
import { useWeather, useGeocode } from '../../../hooks/useWeather'
import { getWeatherInfo, getWindDirection } from '../../../lib/openMeteo'
import { useTempDisplay } from '../../../hooks/useTempDisplay'
import { format } from 'date-fns'
import { Input } from '../../ui/Input'
import { Card } from '../../ui/Card'

export function WeatherPage() {
  const [citySearch, setCitySearch] = useState('')
  const [manualCoords, setManualCoords] = useState<{ lat: number; lon: number } | undefined>()
  const [locationName, setLocationName] = useState<string | null>(null)
  const { data: geoResults } = useGeocode(citySearch)
  const { data, isLoading, isError } = useWeather(manualCoords)
  const { fmt, unit, toggleTempUnit } = useTempDisplay()

  const selectCity = (result: any) => {
    setManualCoords({ lat: result.latitude, lon: result.longitude })
    setLocationName(`${result.name}, ${result.country}`)
    setCitySearch('')
  }

  const cw = data?.current_weather
  const weather = cw ? getWeatherInfo(cw.weathercode, cw.is_day) : null
  const timezone = data?.timezone.split('/').pop()?.replace('_', ' ') ?? ''

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-xl font-semibold text-[var(--text)]">🌤️ Weather</h1>
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
        <div className="relative max-w-sm">
          <Input
            icon={<Search size={14} />}
            placeholder="Search city…"
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
          />
          {geoResults && geoResults.length > 0 && citySearch.length > 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 glass-strong rounded-xl border border-[var(--border)] overflow-hidden z-50 shadow-float">
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
            <div className="shimmer h-40 rounded-2xl" />
            <div className="shimmer h-24 rounded-2xl" />
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
              style={{
                background: cw.is_day
                  ? 'linear-gradient(135deg, rgba(0,120,212,0.15) 0%, rgba(0,183,195,0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(28,28,50,0.8) 0%, rgba(40,40,80,0.6) 100%)',
              }}
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
                    <span>{locationName ?? timezone}</span>
                  </div>
                </div>
                <motion.span
                  className="text-7xl leading-none"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {weather.icon}
                </motion.span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                {[
                  { icon: <Wind size={14} />, label: 'Wind', value: `${Math.round(cw.windspeed)} km/h ${getWindDirection(cw.winddirection)}` },
                  { icon: <Droplets size={14} />, label: 'Precip.', value: `${data.daily.precipitation_probability_max[0]}%` },
                  { icon: <Thermometer size={14} />, label: 'High / Low', value: `${fmt(data.daily.temperature_2m_max[0])}${unit} / ${fmt(data.daily.temperature_2m_min[0])}${unit}` },
                  { icon: <MapPin size={14} />, label: 'Timezone', value: timezone },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="glass rounded-xl p-3">
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
