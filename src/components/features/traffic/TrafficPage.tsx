import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Camera, CarFront, ExternalLink, RefreshCw, TrafficCone } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { useWeather } from '../../../hooks/useWeather'
import { type Theme, useUiStore } from '../../../store/uiStore'
import { fetchFl511Cameras, TRAFFIC_RADIUS_MILES, type Fl511Camera } from '../../../lib/fl511'
import {
  RADAR_TILE_SIZE,
  clampTileY,
  latToTileY,
  lonToTileX,
  wrapTileX,
} from '../../../lib/radar'

const TRAFFIC_MAP_ZOOM = 10

function parseFl511Timestamp(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

function TrafficMap({ cameras, lat, lon, theme }: { cameras: Fl511Camera[]; lat: number; lon: number; theme: Theme }) {
  const lightMap = theme === 'light' || theme === 'mac'
  const basemapStyle = lightMap ? 'light_all' : 'dark_all'
  const centerX = lonToTileX(lon, TRAFFIC_MAP_ZOOM)
  const centerY = latToTileY(lat, TRAFFIC_MAP_ZOOM)
  const baseTileX = Math.floor(centerX)
  const baseTileY = Math.floor(centerY)
  const baseCols = [-2, -1, 0, 1, 2]
  const baseRows = [-2, -1, 0, 1, 2]
  const baseTiles = baseRows.flatMap((dy) => baseCols.map((dx) => {
    const rawX = baseTileX + dx
    const rawY = baseTileY + dy
    return {
      key: `${rawX}:${rawY}`,
      x: wrapTileX(rawX, TRAFFIC_MAP_ZOOM),
      y: clampTileY(rawY, TRAFFIC_MAP_ZOOM),
      left: (rawX - centerX) * RADAR_TILE_SIZE,
      top: (rawY - centerY) * RADAR_TILE_SIZE,
    }
  }))

  const markers = cameras.slice(0, 24).map((camera) => ({
    ...camera,
    left: (lonToTileX(camera.lon, TRAFFIC_MAP_ZOOM) - centerX) * RADAR_TILE_SIZE,
    top: (latToTileY(camera.lat, TRAFFIC_MAP_ZOOM) - centerY) * RADAR_TILE_SIZE,
  }))

  return (
    <Card className="!p-0 overflow-hidden min-h-[320px]">
      <div className={`relative h-[320px] overflow-hidden ${lightMap ? 'bg-[#eef2f7]' : 'bg-[#09111a]'}`}>
        {baseTiles.map((tile) => (
          <img
            key={tile.key}
            alt=""
            src={`https://a.basemaps.cartocdn.com/${basemapStyle}/${TRAFFIC_MAP_ZOOM}/${tile.x}/${tile.y}.png`}
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
          ? 'absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(255,255,255,0.04)_48%,rgba(226,232,240,0.5)_100%)]'
          : 'absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(7,9,15,0.1)_45%,rgba(7,9,15,0.64)_100%)]'
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
        <div className={`absolute left-4 top-4 rounded-lg px-3 py-2 shadow-lg ${
          lightMap ? 'border border-slate-200/80 bg-white/80 text-slate-900' : 'border border-white/10 bg-black/45 text-white'
        }`}>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] ${lightMap ? 'text-slate-500' : 'text-white/55'}`}>
            <CarFront size={13} />
            Traffic
          </div>
          <div className="mt-1 text-lg font-semibold">{TRAFFIC_RADIUS_MILES} mi radius</div>
          <div className={`text-xs ${lightMap ? 'text-slate-500' : 'text-white/55'}`}>{cameras.length} FL511 cameras</div>
        </div>
      </div>
    </Card>
  )
}

export function TrafficPage() {
  const theme = useUiStore((state) => state.theme)
  const { location } = useWeather(undefined, { useGeolocation: false })
  const { data: cameras = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['fl511-cameras', location.lat, location.lon],
    queryFn: () => fetchFl511Cameras({ lat: location.lat, lon: location.lon }),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })

  const newestCamera = useMemo(() => {
    return cameras
      .map((camera) => ({ camera, date: parseFl511Timestamp(camera.updatedAt) }))
      .filter((item): item is { camera: Fl511Camera; date: Date } => Boolean(item.date))
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
  }, [cameras])

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
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="space-y-4">
          <TrafficMap cameras={cameras} lat={location.lat} lon={location.lon} theme={theme} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <Camera size={17} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-[var(--text)]">{isLoading ? '-' : cameras.length}</p>
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
                  <p className="text-2xl font-semibold text-[var(--text)]">0</p>
                  <p className="text-xs text-[var(--text-secondary)]">Incidents wired</p>
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
                    {newestCamera ? formatDistanceToNow(newestCamera.date, { addSuffix: true }) : 'Pending'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">Latest camera</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Card className="min-h-[320px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Nearby FL511 Cameras</h2>
              <p className="text-xs text-[var(--text-secondary)]">Sorted by distance from the store point.</p>
            </div>
            <a
              href="https://fl511.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
            >
              FL511
              <ExternalLink size={12} />
            </a>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm font-semibold text-[var(--text-secondary)]">Loading FL511...</div>
          ) : isError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <TrafficCone size={26} className="text-[var(--text-tertiary)]" />
              <p className="text-sm font-semibold text-[var(--text)]">Traffic feed unavailable</p>
              <p className="max-w-xs text-xs text-[var(--text-secondary)]">FL511 camera data could not be loaded right now.</p>
            </div>
          ) : cameras.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <Camera size={26} className="text-[var(--text-tertiary)]" />
              <p className="text-sm font-semibold text-[var(--text)]">No cameras nearby</p>
              <p className="max-w-xs text-xs text-[var(--text-secondary)]">No FL511 cameras were found inside {TRAFFIC_RADIUS_MILES} miles of this point.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cameras.slice(0, 10).map((camera) => {
                const updated = parseFl511Timestamp(camera.updatedAt)
                return (
                  <a
                    key={camera.id}
                    href={camera.imageUrl || 'https://fl511.com/'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--surface)] text-sky-400">
                      {camera.imageUrl ? (
                        <img src={camera.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Camera size={18} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">{camera.title}</p>
                        <span className="flex-shrink-0 text-xs font-semibold text-[var(--accent)]">{camera.distanceMiles.toFixed(1)} mi</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                        {[camera.highway, camera.direction, camera.county].filter(Boolean).join(' | ')}
                      </p>
                      {updated && (
                        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                          Updated {formatDistanceToNow(updated, { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
