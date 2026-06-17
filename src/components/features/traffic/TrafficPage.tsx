import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Camera, CarFront, ExternalLink, RefreshCw, TrafficCone, ZoomIn, ZoomOut } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { useWeather } from '../../../hooks/useWeather'
import { type Theme, useUiStore } from '../../../store/uiStore'
import {
  fetchFl511Cameras,
  fetchTomTomTrafficEvents,
  fetchTomTomTrafficFlow,
  hasTomTomTrafficKey,
  TRAFFIC_POLL_INTERVAL_MS,
  TRAFFIC_RADIUS_MILES,
  tomTomFlowTileUrl,
  type Fl511Camera,
  type Fl511TrafficEvent,
  type TomTomTrafficFlow,
} from '../../../lib/fl511'
import {
  RADAR_TILE_SIZE,
  clampTileY,
  latToTileY,
  lonToTileX,
  wrapTileX,
} from '../../../lib/radar'

const TRAFFIC_MAP_MIN_ZOOM = 10
const TRAFFIC_MAP_MAX_ZOOM = 17

function clampTrafficZoom(value: number) {
  return Math.min(TRAFFIC_MAP_MAX_ZOOM, Math.max(TRAFFIC_MAP_MIN_ZOOM, value))
}

function parseFl511Timestamp(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

function eventLevel(event: Fl511TrafficEvent): 'green' | 'yellow' | 'red' {
  const text = `${event.type} ${event.severity} ${event.description} ${event.laneDescription}`
  if (/major|closure|all lanes|closed|blocked/i.test(text)) return 'red'
  if (/minor|intermediate|crash|disabled|incident|construction|congestion|lane/i.test(text)) return 'yellow'
  return 'green'
}

function trafficStatus(events: Fl511TrafficEvent[]) {
  if (events.some((event) => eventLevel(event) === 'red')) {
    return {
      level: 'red' as const,
      label: 'Heavy',
      detail: 'Major incident or closure nearby',
      className: 'bg-red-500 text-white border-red-400/70',
      softClassName: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
  }
  if (events.length > 0) {
    return {
      level: 'yellow' as const,
      label: 'Caution',
      detail: 'Minor incident activity nearby',
      className: 'bg-amber-400 text-slate-950 border-amber-300/80',
      softClassName: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    }
  }
  return {
    level: 'green' as const,
    label: 'Clear',
    detail: 'No TomTom incidents in radius',
    className: 'bg-emerald-500 text-white border-emerald-400/70',
    softClassName: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
}

function TrafficSignalGrid({ events, loading }: { events: Fl511TrafficEvent[]; loading: boolean }) {
  const status = trafficStatus(events)
  const redCount = events.filter((event) => eventLevel(event) === 'red').length
  const yellowCount = events.filter((event) => eventLevel(event) === 'yellow').length
  const clear = !loading && events.length === 0
  const cells = [
    { key: 'green', label: 'Clear', active: clear, className: 'bg-emerald-500 text-white border-emerald-400/70', muted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { key: 'yellow', label: 'Caution', active: yellowCount > 0 && redCount === 0, count: yellowCount, className: 'bg-amber-400 text-slate-950 border-amber-300/80', muted: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { key: 'red', label: 'Heavy', active: redCount > 0, count: redCount, className: 'bg-red-500 text-white border-red-400/70', muted: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ]

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Store Area Traffic</p>
          <p className="text-xs text-[var(--text-secondary)]">{TRAFFIC_RADIUS_MILES}-mile TomTom incident scan</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${status.softClassName}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${status.level === 'red' ? 'bg-red-500' : status.level === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          {loading ? 'Checking...' : status.label}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className={`rounded-lg border px-3 py-4 text-center transition-colors ${cell.active ? cell.className : cell.muted}`}
          >
            <div className="mx-auto mb-2 h-4 w-4 rounded-full bg-current opacity-90" />
            <p className="text-sm font-bold">{cell.label}</p>
            <p className="mt-1 text-xs opacity-80">{loading ? '-' : cell.count ?? (cell.active ? 'OK' : '0')}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{loading ? 'Pulling TomTom traffic events...' : status.detail}</p>
    </Card>
  )
}

function TrafficMap({
  cameras,
  events,
  lat,
  lon,
  theme,
  zoom,
  onZoomChange,
}: {
  cameras: Fl511Camera[]
  events: Fl511TrafficEvent[]
  lat: number
  lon: number
  theme: Theme
  zoom: number
  onZoomChange: (zoom: number) => void
}) {
  const lightMap = theme === 'light' || theme === 'mac'
  const basemapStyle = lightMap ? 'light_all' : 'dark_all'
  const trafficFlowStyle = lightMap ? 'relative0' : 'relative0-dark'
  const showTrafficFlow = hasTomTomTrafficKey()
  const centerX = lonToTileX(lon, zoom)
  const centerY = latToTileY(lat, zoom)
  const baseTileX = Math.floor(centerX)
  const baseTileY = Math.floor(centerY)
  const baseCols = [-2, -1, 0, 1, 2]
  const baseRows = [-2, -1, 0, 1, 2]
  const baseTiles = baseRows.flatMap((dy) => baseCols.map((dx) => {
    const rawX = baseTileX + dx
    const rawY = baseTileY + dy
    return {
      key: `${rawX}:${rawY}`,
      x: wrapTileX(rawX, zoom),
      y: clampTileY(rawY, zoom),
      left: (rawX - centerX) * RADAR_TILE_SIZE,
      top: (rawY - centerY) * RADAR_TILE_SIZE,
    }
  }))

  const markers = cameras.slice(0, 24).map((camera) => ({
    ...camera,
    left: (lonToTileX(camera.lon, zoom) - centerX) * RADAR_TILE_SIZE,
    top: (latToTileY(camera.lat, zoom) - centerY) * RADAR_TILE_SIZE,
  }))
  const eventMarkers = events.slice(0, 3).map((event) => ({
    ...event,
    level: eventLevel(event),
    left: (lonToTileX(event.lon, zoom) - centerX) * RADAR_TILE_SIZE,
    top: (latToTileY(event.lat, zoom) - centerY) * RADAR_TILE_SIZE,
  }))

  const changeZoom = (nextZoom: number) => onZoomChange(clampTrafficZoom(nextZoom))

  return (
    <Card className="!p-0 overflow-hidden min-h-[320px]">
      <div
        className={`relative h-[320px] overflow-hidden ${lightMap ? 'bg-[#eef2f7]' : 'bg-[#09111a]'}`}
        onWheel={(event) => {
          event.preventDefault()
          changeZoom(zoom + (event.deltaY > 0 ? -1 : 1))
        }}
      >
        {baseTiles.map((tile) => (
          <img
            key={tile.key}
            alt=""
            src={`https://a.basemaps.cartocdn.com/${basemapStyle}/${zoom}/${tile.x}/${tile.y}.png`}
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
        {showTrafficFlow && baseTiles.map((tile) => (
          <img
            key={`flow:${tile.key}`}
            alt=""
            src={tomTomFlowTileUrl(tile.x, tile.y, zoom, trafficFlowStyle)}
            className="absolute max-w-none select-none opacity-95"
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
          ? 'absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0,rgba(255,255,255,0.04)_48%,rgba(226,232,240,0.38)_100%)]'
          : 'absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0,rgba(7,9,15,0.05)_45%,rgba(7,9,15,0.52)_100%)]'
        } />
        <div className={`absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border ${lightMap ? 'border-slate-700/20 bg-white/10' : 'border-white/20 bg-white/5'}`} />
        <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow-[0_0_0_8px_rgba(226,0,116,0.2),0_0_24px_rgba(226,0,116,0.75)]" />
        {markers.map((camera) => (
          <a
            key={camera.id}
            href={camera.imageUrl || 'https://fl511.com/'}
            target="_blank"
            rel="noreferrer"
            title={camera.title}
            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-sky-500 text-white shadow-lg transition-transform hover:scale-110"
            style={{
              left: `calc(50% + ${camera.left}px)`,
              top: `calc(50% + ${camera.top}px)`,
            }}
          >
            <Camera size={13} />
          </a>
        ))}
        {eventMarkers.map((event, index) => (
          <div
            key={`event:${event.id}`}
            title={`${event.type}: ${event.description}`}
            className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-sm font-black shadow-[0_10px_28px_rgba(0,0,0,0.38)] ${
              event.level === 'red' ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-950'
            }`}
            style={{
              left: `calc(50% + ${event.left}px)`,
              top: `calc(50% + ${event.top}px)`,
            }}
          >
            {index + 1}
          </div>
        ))}
        <div className={`absolute left-4 top-4 rounded-lg px-3 py-2 shadow-lg ${
          lightMap ? 'border border-slate-200/80 bg-white/80 text-slate-900' : 'border border-white/10 bg-black/45 text-white'
        }`}>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] ${lightMap ? 'text-slate-500' : 'text-white/55'}`}>
            <CarFront size={13} />
            Traffic
          </div>
          <div className="mt-1 text-lg font-semibold">{TRAFFIC_RADIUS_MILES} mi radius</div>
          <div className={`text-xs ${lightMap ? 'text-slate-500' : 'text-white/55'}`}>{eventMarkers.length} mapped incidents | {cameras.length} cameras</div>
        </div>
        <div className={`absolute right-4 top-4 flex flex-col overflow-hidden rounded-lg border shadow-lg ${
          lightMap ? 'border-slate-200/80 bg-white/85' : 'border-white/10 bg-black/50'
        }`}>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => changeZoom(zoom + 1)}
            disabled={zoom >= TRAFFIC_MAP_MAX_ZOOM}
            className={`flex h-9 w-9 items-center justify-center transition-colors disabled:opacity-35 ${
              lightMap ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'
            }`}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => changeZoom(zoom - 1)}
            disabled={zoom <= TRAFFIC_MAP_MIN_ZOOM}
            className={`flex h-9 w-9 items-center justify-center border-t transition-colors disabled:opacity-35 ${
              lightMap ? 'border-slate-200/80 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-white hover:bg-white/10'
            }`}
          >
            <ZoomOut size={16} />
          </button>
        </div>
        {showTrafficFlow && (
          <div className={`absolute bottom-4 left-4 rounded-lg px-3 py-2 shadow-lg ${
            lightMap ? 'border border-slate-200/80 bg-white/85 text-slate-900' : 'border border-white/10 bg-black/50 text-white'
          }`}>
            <div className={`mb-1 text-[10px] font-bold uppercase ${lightMap ? 'text-slate-500' : 'text-white/55'}`}>Flow</div>
            <div className="flex items-center gap-2 text-[10px] font-semibold">
              <span className="h-2 w-5 rounded-full bg-[#2eab30]" /> Clear
              <span className="h-2 w-5 rounded-full bg-[#f1bf40]" /> Busy
              <span className="h-2 w-5 rounded-full bg-[#e70704]" /> Slow
            </div>
          </div>
        )}
        <div className={`absolute bottom-4 right-4 rounded-md px-2 py-1 text-[10px] ${
          lightMap ? 'bg-white/75 text-slate-500' : 'bg-black/40 text-white/55'
        }`}>
          Flow by TomTom
        </div>
      </div>
    </Card>
  )
}

function TrafficFlowCard({ flow }: { flow: TomTomTrafficFlow | undefined }) {
  const label = !flow
    ? 'Pending'
    : flow.roadClosure
      ? 'Closed'
      : flow.congestionPct >= 35
        ? 'Slow'
        : flow.congestionPct >= 15
          ? 'Busy'
          : 'Normal'

  const speed = flow ? `${Math.round(flow.currentSpeed)} mph` : '-'
  const detail = flow ? `${flow.congestionPct}% below free flow` : 'TomTom flow'

  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
          <CarFront size={17} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">{label} · {speed}</p>
          <p className="text-xs text-[var(--text-secondary)]">{detail}</p>
        </div>
      </div>
    </Card>
  )
}

export function TrafficPage() {
  const theme = useUiStore((state) => state.theme)
  const [mapZoom, setMapZoom] = useState(TRAFFIC_MAP_MIN_ZOOM)
  const { location } = useWeather(undefined, { useGeolocation: false })
  const { data: cameras = [], isLoading: camerasLoading, isFetching: camerasFetching, refetch: refetchCameras } = useQuery({
    queryKey: ['fl511-cameras', location.lat, location.lon],
    queryFn: () => fetchFl511Cameras({ lat: location.lat, lon: location.lon }),
    staleTime: TRAFFIC_POLL_INTERVAL_MS,
    refetchInterval: TRAFFIC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const { data: events = [], isLoading: eventsLoading, isError: eventsError, isFetching: eventsFetching, refetch: refetchEvents } = useQuery({
    queryKey: ['tomtom-events', location.lat, location.lon],
    queryFn: () => fetchTomTomTrafficEvents({ lat: location.lat, lon: location.lon }),
    staleTime: TRAFFIC_POLL_INTERVAL_MS,
    refetchInterval: TRAFFIC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const { data: flow, isFetching: flowFetching, refetch: refetchFlow } = useQuery({
    queryKey: ['tomtom-flow', location.lat, location.lon],
    queryFn: () => fetchTomTomTrafficFlow({ lat: location.lat, lon: location.lon }),
    staleTime: TRAFFIC_POLL_INTERVAL_MS,
    refetchInterval: TRAFFIC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const isFetching = camerasFetching || eventsFetching || flowFetching

  const newestCamera = useMemo(() => {
    return cameras
      .map((camera) => ({ camera, date: parseFl511Timestamp(camera.updatedAt) }))
      .filter((item): item is { camera: Fl511Camera; date: Date } => Boolean(item.date))
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
  }, [cameras])

  const newestEvent = useMemo(() => {
    return events
      .map((event) => ({ event, date: parseFl511Timestamp(event.lastUpdated) }))
      .filter((item): item is { event: Fl511TrafficEvent; date: Date } => Boolean(item.date))
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
  }, [events])

  const refreshTraffic = () => {
    refetchCameras()
    refetchEvents()
    refetchFlow()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text)]">Traffic</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{location.name}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />}
            loading={isFetching}
            onClick={refreshTraffic}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="space-y-4">
          <TrafficSignalGrid events={events} loading={eventsLoading} />
          <TrafficMap
            cameras={cameras}
            events={events}
            lat={location.lat}
            lon={location.lon}
            theme={theme}
            zoom={mapZoom}
            onZoomChange={setMapZoom}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <Camera size={17} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-[var(--text)]">{camerasLoading ? '-' : cameras.length}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Cameras nearby</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <TrafficCone size={17} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-[var(--text)]">{eventsLoading ? '-' : events.length}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Incidents nearby</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <RefreshCw size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {newestEvent ? formatDistanceToNow(newestEvent.date, { addSuffix: true }) : newestCamera ? formatDistanceToNow(newestCamera.date, { addSuffix: true }) : 'Pending'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">Latest update</p>
                </div>
              </div>
            </Card>
            <TrafficFlowCard flow={flow} />
          </div>
        </div>

        <Card className="min-h-[320px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Nearby Incidents</h2>
              <p className="text-xs text-[var(--text-secondary)]">TomTom events sorted by severity and distance.</p>
            </div>
            <a
              href="https://www.tomtom.com/products/traffic-apis/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
            >
              TomTom
              <ExternalLink size={12} />
            </a>
          </div>

          {eventsLoading ? (
            <div className="flex h-48 items-center justify-center text-sm font-semibold text-[var(--text-secondary)]">Loading TomTom...</div>
          ) : eventsError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <TrafficCone size={26} className="text-[var(--text-tertiary)]" />
              <p className="text-sm font-semibold text-[var(--text)]">Traffic feed unavailable</p>
              <p className="max-w-xs text-xs text-[var(--text-secondary)]">TomTom event data could not be loaded right now.</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <CarFront size={26} className="text-emerald-400" />
              <p className="text-sm font-semibold text-[var(--text)]">No incidents nearby</p>
              <p className="max-w-xs text-xs text-[var(--text-secondary)]">No TomTom incidents with location data were found inside {TRAFFIC_RADIUS_MILES} miles of this point.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 10).map((event) => {
                const updated = parseFl511Timestamp(event.lastUpdated)
                const level = eventLevel(event)
                const levelClass = level === 'red'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : level === 'yellow'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                return (
                  <div
                    key={event.id}
                    className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5"
                  >
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border ${levelClass}`}>
                      {level === 'red' ? <AlertTriangle size={18} /> : <TrafficCone size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">{event.roadway || event.type}</p>
                        <span className="flex-shrink-0 text-xs font-semibold text-[var(--accent)]">{event.distanceMiles.toFixed(1)} mi</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                        {[event.type, event.severity, event.direction, event.county].filter(Boolean).join(' | ')}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{event.description}</p>
                      {updated && (
                        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                          Updated {formatDistanceToNow(updated, { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
