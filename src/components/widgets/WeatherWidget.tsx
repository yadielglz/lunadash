import { motion } from 'framer-motion'
import { AlertTriangle, Clock, Wind } from 'lucide-react'
import { Card } from '../ui/Card'
import { useWeather } from '../../hooks/useWeather'
import { formatWeatherTimezone, getWeatherInfo } from '../../lib/openMeteo'
import { useUiStore } from '../../store/uiStore'
import { useTempDisplay } from '../../hooks/useTempDisplay'

export function WeatherWidget() {
  const { data, isLoading, isError } = useWeather()
  const { setTab, setSettingsSection, toggleTempUnit } = useUiStore()
  const { fmt, unit } = useTempDisplay()
  const openWeatherSettings = () => {
    setSettingsSection('weather')
    setTab('settings')
  }

  return (
    <Card
      className="h-full flex flex-col justify-between cursor-pointer group !p-5"
      interactive
      onClick={openWeatherSettings}
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
            onClick={(e) => { e.stopPropagation(); openWeatherSettings() }}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-end gap-1.5">
                  <motion.span
                    className="text-6xl font-light text-[var(--text)] tabular-nums leading-none"
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    {temp}
                  </motion.span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTempUnit() }}
                    className="text-xl text-[var(--accent)] hover:underline mb-1.5 font-medium"
                    title="Toggle °F / °C"
                  >
                    {unit}
                  </button>
                </div>
                <p className="text-base font-medium text-[var(--text)] mt-2">{weather.label}</p>
              </div>
              <span className="text-5xl leading-none">{weather.icon}</span>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                <span>H:{high} L:{low}</span>
                <span>💧 {precip}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                <Wind size={12} />
                <span>{Math.round(cw.windspeed)} mph</span>
                <Clock size={12} className="ml-1" />
                <span className="truncate">{formatWeatherTimezone(data.timezone)}</span>
              </div>
              {data.alerts.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                  <AlertTriangle size={12} />
                  <span>{data.alerts.length} active alert{data.alerts.length === 1 ? '' : 's'}</span>
                </div>
              )}
              {data.alertsUnavailable && (
                <div className="text-[10px] text-[var(--text-tertiary)]">Alerts unavailable outside NWS coverage</div>
              )}
              </div>
          </>
        )
      })()}
    </Card>
  )
}
