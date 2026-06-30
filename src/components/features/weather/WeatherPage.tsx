import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, LocateFixed, Search, Wind, Droplets, Thermometer, MapPin, RefreshCw, Radar } from 'lucide-react'
import { CENTRAL_FLORIDA_WEATHER_POINTS, useWeather, useGeocode, type WeatherLocation } from '../../../hooks/useWeather'
import { formatWeatherTimezone, getWeatherInfo, getWindDirection, type GeocodingResult } from '../../../lib/openMeteo'
import { useTempDisplay } from '../../../hooks/useTempDisplay'
import { format } from 'date-fns'
import { Input } from '../../ui/Input'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { getStoreWeatherLocation } from '../../../config/storeWeather'
import { type Theme, useUiStore } from '../../../store/uiStore'
import {
  RADAR_BASEMAP_ZOOM,
  RADAR_RADIUS_MILES,
  RADAR_TILE_SIZE,
  RADAR_VIEW_SCALE,
  fetchRainViewerMaps,
  latToTileY,
  lonToTileX,
  radarTileUrl,
  radarVisibleTiles,
  wrapTileX,
  clampTileY,
  type RadarFrame,
} from '../../../lib/radar'

const LIGHT_MAP_THEMES: Theme[] = ['light', 'mac', 'vista', 'mint', 'coral', 'iris', 'tide', 'citrus', 'highland']

function WeatherRadarMap({ lat, lon, frame, host, theme }: { lat: number; lon: number; frame: RadarFrame; host: string; theme: Theme }) {
  const lightMap = LIGHT_MAP_THEMES.includes(theme)
  const basemapStyle = lightMap ? 'light_all' : 'dark_all'
  const baseCenterX = lonToTileX(lon, RADAR_BASEMAP_ZOOM)
  const baseCenterY = latToTileY(lat, RADAR_BASEMAP_ZOOM)
  const baseTileX = Math.floor(baseCenterX)
  const baseTileY = Math.floor(baseCenterY)
  const baseCols = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
  const baseRows = [-3, -2, -1, 0, 1, 2, 3]
  const baseTiles = baseRows.flatMap((dy) => baseCols.map((dx) => {
    const rawX = baseTileX + dx
    const rawY = baseTileY + dy
    const x = wrapTileX(rawX, RADAR_BASEMAP_ZOOM)
    const y = clampTileY(rawY, RADAR_BASEMAP_ZOOM)
    return {
      key: `${rawX}:${rawY}`,
      x,
      y,
      left: (rawX - baseCenterX) * RADAR_TILE_SIZE,
      top: (rawY - baseCenterY) * RADAR_TILE_SIZE,
    }
  }))
  const radarTiles = radarVisibleTiles(lat, lon)

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className={lightMap ? 'absolute inset-0 bg-[#eef2f7]' : 'absolute inset-0 bg-[#09111a]'} />
      {baseTiles.map((tile) => (
        <img
          key={`base:${tile.key}`}
          alt=""
          src={`https://a.basemaps.cartocdn.com/${basemapStyle}/${RADAR_BASEMAP_ZOOM}/${tile.x}/${tile.y}.png`}
          className="absolute max-w-none select-none"
          draggable={false}
          style={{
            left: `calc(50% + ${tile.left}px)`,
            top: `calc(50% + ${tile.top}px)`,
            width: RADAR_TILE_SIZE,
            height: RADAR_TILE_SIZE,
          }}
        />
      ))}
      <div className={lightMap
        ? 'absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(255,255,255,0.05)_45%,rgba(226,232,240,0.46)_100%)]'
        : 'absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(7,9,15,0.08)_42%,rgba(7,9,15,0.58)_100%)]'
      } />
      <AnimatePresence initial={false}>
        <motion.div
          key={frame.time}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.72 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'linear' }}
          style={{ transform: `scale(${RADAR_VIEW_SCALE})`, transformOrigin: 'center', mixBlendMode: lightMap ? 'normal' : 'screen' }}
        >
          {radarTiles.map((tile) => (
            <img
              key={`radar:${frame.time}:${tile.key}`}
              alt=""
              src={radarTileUrl(host, frame.path, tile.x, tile.y)}
              className="absolute max-w-none select-none"
              draggable={false}
              style={{
                left: `calc(50% + ${tile.left}px)`,
                top: `calc(50% + ${tile.top}px)`,
                width: RADAR_TILE_SIZE,
                height: RADAR_TILE_SIZE,
              }}
            />
          ))}
        </motion.div>
      </AnimatePresence>
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow-[0_0_0_8px_rgba(226,0,116,0.2),0_0_24px_rgba(226,0,116,0.75)]" />
      <div className={`absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border ${lightMap ? 'border-slate-700/20' : 'border-white/20'}`} />
      <div className={lightMap
        ? 'absolute bottom-3 right-3 rounded-md bg-white/75 px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm'
        : 'absolute bottom-3 right-3 rounded-md bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/45'
      }>
        RainViewer | CARTO
      </div>
    </div>
  )
}

function WeatherRadarCard({ location }: { location: WeatherLocation }) {
  const theme = useUiStore((state) => state.theme)
  const [frameIndex, setFrameIndex] = useState(0)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['rainviewer-maps'],
    queryFn: fetchRainViewerMaps,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })
  const frames = useMemo(() => data?.radar?.past ?? [], [data?.radar?.past])
  const frame = frames[frameIndex] ?? frames[frames.length - 1]

  useEffect(() => {
    if (frames.length === 0) return
    setFrameIndex(frames.length - 1)
  }, [frames.length])

  useEffect(() => {
    if (frames.length <= 1) return
    const id = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length)
    }, 900)
    return () => window.clearInterval(id)
  }, [frames.length])

  useEffect(() => {
    if (!data?.host || frames.length <= 1) return
    const tiles = radarVisibleTiles(location.lat, location.lon)
    const nextFrames = [1, 2]
      .map((offset) => frames[(frameIndex + offset) % frames.length])
      .filter(Boolean)
    nextFrames.forEach((nextFrame) => {
      tiles.forEach((tile) => {
        const image = new Image()
        image.src = radarTileUrl(data.host, nextFrame.path, tile.x, tile.y)
      })
    })
  }, [data?.host, frameIndex, frames, location.lat, location.lon])

  const frameDate = frame ? new Date(frame.time * 1000) : null

  return (
    <Card className="!p-0 overflow-hidden min-h-[360px] lg:min-h-[520px]">
      <div className="relative h-[360px] lg:h-full min-h-[360px] overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center bg-[var(--surface-2)] text-sm font-semibold text-[var(--text-secondary)]">
            Loading radar...
          </div>
        ) : isError || !data?.host || !frame ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[var(--surface-2)] text-center">
            <Radar size={28} className="text-[var(--text-tertiary)]" />
            <p className="text-sm font-semibold text-[var(--text)]">Radar unavailable</p>
            <p className="max-w-xs text-xs text-[var(--text-secondary)]">RainViewer map data could not be loaded right now.</p>
          </div>
        ) : (
          <WeatherRadarMap lat={location.lat} lon={location.lon} frame={frame} host={data.host} theme={theme} />
        )}
        <div className={`absolute left-4 top-4 rounded-lg px-3 py-2 shadow-lg ${
          LIGHT_MAP_THEMES.includes(theme)
            ? 'border border-slate-200/80 bg-white/80 text-slate-900'
            : 'border border-white/10 bg-black/45 text-white'
        }`}>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] ${
            LIGHT_MAP_THEMES.includes(theme) ? 'text-slate-500' : 'text-white/55'
          }`}>
            <Radar size={13} />
            Live radar
          </div>
          <div className="mt-1 text-lg font-semibold">{RADAR_RADIUS_MILES} mi radius</div>
          <div className={`text-xs ${LIGHT_MAP_THEMES.includes(theme) ? 'text-slate-500' : 'text-white/55'}`}>{frameDate ? format(frameDate, 'h:mm a') : location.name}</div>
        </div>
      </div>
    </Card>
  )
}

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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <WeatherRadarCard location={location} />

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
              <Card className="!p-5 relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-end gap-2">
                      <span className="text-6xl font-thin text-[var(--text)] tabular-nums">{fmt(cw.temperature)}</span>
                      <button
                        onClick={toggleTempUnit}
                        className="mb-2 text-xl font-medium text-[var(--accent)] hover:underline"
                        title="Toggle °F / °C"
                      >
                        {unit}
                      </button>
                    </div>
                    <p className="text-base font-medium text-[var(--text)]">{weather.label}</p>
                    <div className="mt-1 flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                      <MapPin size={13} />
                      <span className="truncate">{location.name}</span>
                    </div>
                  </div>
                  <motion.span className="text-6xl leading-none">
                    {weather.icon}
                  </motion.span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  {[
                    { icon: <Wind size={14} />, label: 'Wind', value: `${Math.round(cw.windspeed)} mph ${getWindDirection(cw.winddirection)}` },
                    { icon: <Droplets size={14} />, label: 'Precip.', value: `${data.daily.precipitation_probability_max[0]}%` },
                    { icon: <Thermometer size={14} />, label: 'High / Low', value: `${fmt(data.daily.temperature_2m_max[0])}${unit} / ${fmt(data.daily.temperature_2m_min[0])}${unit}` },
                    { icon: <MapPin size={14} />, label: 'Local Time', value: timezoneLabel },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-3)] p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-[var(--text-secondary)]">
                        {icon}
                        <span className="text-xs">{label}</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--text)]">{value}</div>
                    </div>
                  ))}
                </div>

                {data.alerts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {data.alerts.slice(0, 2).map((alert) => (
                      <div key={alert.id} className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="mt-0.5 text-red-400" />
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">{alert.event}</div>
                            <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{alert.headline}</div>
                            {alert.area && <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">{alert.area}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {data.alerts.length === 0 && !data.alertsUnavailable && (
                  <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-3)] p-3 text-xs text-[var(--text-secondary)]">
                    No active National Weather Service alerts for {location.name}. Expired alerts are not shown.
                  </div>
                )}

                {data.alertsUnavailable && (
                  <div className="mt-4 rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                    National Weather Service alerts could not be loaded for this location.
                  </div>
                )}
              </Card>

              <Card className="!p-4">
                <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">7-Day Forecast</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-1">
                  {data.daily.time.map((dateStr, i) => {
                    const dayWeather = getWeatherInfo(data.daily.weathercode[i])
                    const isToday = i === 0
                    return (
                      <motion.div
                        key={dateStr}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 ${
                          isToday
                            ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10'
                            : 'border-[var(--border)] bg-[var(--surface-3)]'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xl leading-none">{dayWeather.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                              {isToday ? 'Today' : format(new Date(dateStr + 'T12:00'), 'EEE')}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                              <Droplets size={8} />
                              {data.daily.precipitation_probability_max[i]}%
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-[var(--text)]">{fmt(data.daily.temperature_2m_max[i])}{unit}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)]">{fmt(data.daily.temperature_2m_min[i])}{unit}</div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
