const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json'

export const RADAR_ZOOM = 7
export const RADAR_BASEMAP_ZOOM = 9
export const RADAR_TILE_SIZE = 256
export const RADAR_VIEW_SCALE = 2 ** (RADAR_BASEMAP_ZOOM - RADAR_ZOOM)
export const RADAR_RADIUS_MILES = 100

export type RadarFrame = {
  time: number
  path: string
}

export type RainViewerMaps = {
  generated: number
  host: string
  radar?: {
    past?: RadarFrame[]
    nowcast?: RadarFrame[]
  }
}

export function lonToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * 2 ** zoom
}

export function latToTileY(lat: number, zoom: number) {
  const rad = lat * Math.PI / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom
}

export function wrapTileX(x: number, zoom: number) {
  const max = 2 ** zoom
  return ((x % max) + max) % max
}

export function clampTileY(y: number, zoom: number) {
  const max = 2 ** zoom
  return Math.min(Math.max(y, 0), max - 1)
}

export async function fetchRainViewerMaps(): Promise<RainViewerMaps> {
  const res = await fetch(RAINVIEWER_API_URL)
  if (!res.ok) throw new Error('Could not load radar map data')
  return res.json()
}

export function radarTileUrl(host: string, framePath: string, x: number, y: number) {
  return `${host}${framePath}/${RADAR_TILE_SIZE}/${RADAR_ZOOM}/${x}/${y}/2/1_1.png`
}

export function radarVisibleTiles(lat: number, lon: number) {
  const radarCenterX = lonToTileX(lon, RADAR_ZOOM)
  const radarCenterY = latToTileY(lat, RADAR_ZOOM)
  const radarTileX = Math.floor(radarCenterX)
  const radarTileY = Math.floor(radarCenterY)
  const radarCols = [-2, -1, 0, 1, 2]
  const radarRows = [-2, -1, 0, 1, 2]
  return radarRows.flatMap((dy) => radarCols.map((dx) => {
    const rawX = radarTileX + dx
    const rawY = radarTileY + dy
    const x = wrapTileX(rawX, RADAR_ZOOM)
    const y = clampTileY(rawY, RADAR_ZOOM)
    return {
      key: `${rawX}:${rawY}`,
      x,
      y,
      left: (rawX - radarCenterX) * RADAR_TILE_SIZE,
      top: (rawY - radarCenterY) * RADAR_TILE_SIZE,
    }
  }))
}
