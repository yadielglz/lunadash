import { motion } from 'framer-motion'
import { MapPin, Wind } from 'lucide-react'
import { Card } from '../ui/Card'
import { useWeather } from '../../hooks/useWeather'
import { getWeatherInfo } from '../../lib/openMeteo'
import { useUiStore } from '../../store/uiStore'
import { useTempDisplay } from '../../hooks/useTempDisplay'

export function WeatherWidget() {
  const { data, isLoading, isError } = useWeather()
  const { setTab, toggleTempUnit } = useUiStore()
  const { fmt, unit } = useTempDisplay()

  return (
    <Card
      className="h-full flex flex-col justify-between cursor-pointer group"
      interactive
      onClick={() => setTab('weather')}
      style={{
        background: 'linear-gradient(135deg, rgba(0,183,195,0.10) 0%, rgba(0,120,212,0.08) 100%)',
        borderColor: 'rgba(0,183,195,0.2)',
      }}
    >
      {isLoading && (
        <div className="h-full flex flex-col gap-3">
          <div className="shimmer h-8 w-24 rounded-lg" />
          <div className="shimmer h-4 w-32 rounded-md" />
          <div className="shimmer h-3 w-20 rounded-md mt-auto" />
        </div>
      )}

      {isError && (
        <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
          <span className="text-2xl">📡</span>
          <p className="text-xs text-[var(--text-secondary)]">Allow location for weather</p>
          <button
            onClick={(e) => { e.stopPropagation(); setTab('weather') }}
            className="text-xs text-[var(--accent)] underline"
          >
            Set location
          </button>
        </div>
      )}

      {data && (() => {
        const cw = data.current_weather
        const weather = getWeatherInfo(cw.weathercode, cw.is_day)
        const todayIdx = 0
        const high   = fmt(data.daily.temperature_2m_max[todayIdx])
        const low    = fmt(data.daily.temperature_2m_min[todayIdx])
        const precip = data.daily.precipitation_probability_max[todayIdx]
        const temp   = fmt(cw.temperature)

        return (
          <>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-end gap-1">
                  <motion.span
                    className="text-4xl font-light text-[var(--text)] tabular-nums leading-none"
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    {temp}
                  </motion.span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTempUnit() }}
                    className="text-sm text-[var(--accent)] hover:underline mb-1 font-medium"
                    title="Toggle °F / °C"
                  >
                    {unit}
                  </button>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{weather.label}</p>
              </div>
              <span className="text-3xl">{weather.icon}</span>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>H:{high} L:{low}</span>
                <span>💧 {precip}%</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                <Wind size={10} />
                <span>{Math.round(cw.windspeed)} km/h</span>
                <MapPin size={10} className="ml-1" />
                <span className="truncate">{data.timezone.split('/').pop()?.replace('_', ' ')}</span>
              </div>
            </div>
          </>
        )
      })()}
    </Card>
  )
}
