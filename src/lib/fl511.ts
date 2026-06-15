const FL511_CAMERA_LAYER = 'https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/FL511_Traffic_Cameras/FeatureServer/0/query'
const FL511_TRAFFIC_EVENTS_DIRECT = 'https://fl511.com/List/GetData/traffic'
export const TRAFFIC_RADIUS_MILES = 20

interface Coords {
  lat: number
  lon: number
}

interface ArcGisCameraFeature {
  attributes?: {
    OBJECTID_1?: number
    ID?: string
    DESCRIPT?: string
    COUNTY?: string
    HIGHWAY?: string
    DIRECTION?: string
    LATITUDE?: number
    LONGITUDE?: number
    TIMESTAMP?: string
    IMAGE?: string
  }
  geometry?: {
    x?: number
    y?: number
  }
}

interface ArcGisCameraResponse {
  features?: ArcGisCameraFeature[]
  error?: { message?: string }
}

interface Fl511EventCamera {
  location?: string
  latLng?: {
    geography?: {
      wellKnownText?: string
    }
  }
}

interface Fl511TrafficEventRow {
  DT_RowId?: string
  id?: number
  type?: string
  layerName?: string
  roadwayName?: string
  description?: string
  startDate?: string
  lastUpdated?: string
  isFullClosure?: boolean
  severity?: string
  direction?: string
  laneDescription?: string
  county?: string
  region?: string
  cameras?: Fl511EventCamera[]
}

interface Fl511TrafficEventResponse {
  data?: Fl511TrafficEventRow[]
  recordsTotal?: number
}

export interface Fl511Camera {
  id: string
  title: string
  county: string
  highway: string
  direction: string
  lat: number
  lon: number
  imageUrl: string
  updatedAt: string
  distanceMiles: number
}

export interface Fl511TrafficEvent {
  id: string
  type: string
  roadway: string
  direction: string
  severity: string
  description: string
  county: string
  region: string
  laneDescription: string
  startDate: string
  lastUpdated: string
  lat: number
  lon: number
  distanceMiles: number
}

export function distanceMiles(a: Coords, b: Coords) {
  const earthRadiusMiles = 3958.8
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(h)))
}

function parseWellKnownPoint(value: string | undefined): Coords | null {
  if (!value) return null
  const match = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i)
  if (!match) return null
  const lon = Number(match[1])
  const lat = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

function eventCoords(event: Fl511TrafficEventRow): Coords | null {
  const points = (event.cameras ?? [])
    .map((camera) => parseWellKnownPoint(camera.latLng?.geography?.wellKnownText))
    .filter((point): point is Coords => Boolean(point))
  if (points.length === 0) return null
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length,
  }
}

function trafficEventsEndpoint() {
  if (typeof window === 'undefined') return FL511_TRAFFIC_EVENTS_DIRECT
  return window.location.protocol === 'file:' ? FL511_TRAFFIC_EVENTS_DIRECT : '/api/fl511-events'
}

const TRAFFIC_EVENT_COLUMNS = [
  ['region', false, false],
  ['county', false, false],
  ['roadwayName', false, true],
  ['direction', false, true],
  ['type', false, false],
  ['severity', false, true],
  ['description', false, false],
  ['startDate', false, true],
  ['lastUpdated', false, true],
] as const

function trafficEventsPayload(length: number) {
  return {
    draw: 1,
    columns: TRAFFIC_EVENT_COLUMNS.map(([data, searchable, orderable]) => ({
      data,
      name: data,
      searchable,
      orderable,
      search: { value: '', regex: false },
    })),
    order: [{ column: 8, dir: 'desc' }],
    start: 0,
    length,
    search: { value: '', regex: false },
  }
}

function bboxAround(center: Coords, radiusMiles: number) {
  const latDelta = radiusMiles / 69
  const lonDelta = radiusMiles / (Math.cos(center.lat * Math.PI / 180) * 69)
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLon: center.lon - lonDelta,
    maxLon: center.lon + lonDelta,
  }
}

export async function fetchFl511Cameras(center: Coords, radiusMiles = TRAFFIC_RADIUS_MILES): Promise<Fl511Camera[]> {
  const bbox = bboxAround(center, radiusMiles)
  const geometry = {
    xMin: bbox.minLon,
    yMin: bbox.minLat,
    xMax: bbox.maxLon,
    yMax: bbox.maxLat,
    spatialReference: { wkid: 4326 },
  }
  const url = new URL(FL511_CAMERA_LAYER)
  url.searchParams.set('where', '1=1')
  url.searchParams.set('outFields', 'OBJECTID_1,ID,DESCRIPT,COUNTY,HIGHWAY,DIRECTION,LATITUDE,LONGITUDE,TIMESTAMP,IMAGE')
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('geometry', JSON.stringify(geometry))
  url.searchParams.set('geometryType', 'esriGeometryEnvelope')
  url.searchParams.set('inSR', '4326')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  url.searchParams.set('f', 'json')
  url.searchParams.set('resultRecordCount', '100')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`FL511 cameras failed: ${res.status}`)
  const data = await res.json() as ArcGisCameraResponse
  if (data.error) throw new Error(data.error.message || 'FL511 cameras unavailable')

  return (data.features ?? [])
    .map((feature) => {
      const attrs = feature.attributes ?? {}
      const lat = attrs.LATITUDE ?? feature.geometry?.y
      const lon = attrs.LONGITUDE ?? feature.geometry?.x
      if (typeof lat !== 'number' || typeof lon !== 'number') return null
      const distance = distanceMiles(center, { lat, lon })
      if (distance > radiusMiles) return null
      return {
        id: String(attrs.ID || attrs.OBJECTID_1 || `${lat}:${lon}`),
        title: attrs.DESCRIPT || attrs.HIGHWAY || 'FL511 camera',
        county: attrs.COUNTY || '',
        highway: attrs.HIGHWAY || '',
        direction: attrs.DIRECTION || '',
        lat,
        lon,
        imageUrl: attrs.IMAGE || '',
        updatedAt: attrs.TIMESTAMP || '',
        distanceMiles: distance,
      }
    })
    .filter((camera): camera is Fl511Camera => Boolean(camera))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
}

export async function fetchFl511TrafficEvents(center: Coords, radiusMiles = TRAFFIC_RADIUS_MILES): Promise<Fl511TrafficEvent[]> {
  const res = await fetch(trafficEventsEndpoint(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify(trafficEventsPayload(300)),
  })
  if (!res.ok) throw new Error(`FL511 events failed: ${res.status}`)
  const data = await res.json() as Fl511TrafficEventResponse

  return (data.data ?? [])
    .map((event) => {
      const coords = eventCoords(event)
      if (!coords) return null
      const distance = distanceMiles(center, coords)
      if (distance > radiusMiles) return null
      return {
        id: String(event.id ?? event.DT_RowId ?? `${event.roadwayName}:${event.lastUpdated}`),
        type: event.type || event.layerName || 'Traffic event',
        roadway: event.roadwayName || '',
        direction: event.direction || '',
        severity: event.severity || 'Unknown',
        description: event.description || '',
        county: event.county || '',
        region: event.region || '',
        laneDescription: event.laneDescription || '',
        startDate: event.startDate || '',
        lastUpdated: event.lastUpdated || '',
        lat: coords.lat,
        lon: coords.lon,
        distanceMiles: distance,
      }
    })
    .filter((event): event is Fl511TrafficEvent => Boolean(event))
    .sort((a, b) => {
      const severityRank = (severity: string) => (
        /major/i.test(severity) ? 0
        : /intermediate/i.test(severity) ? 1
        : /minor/i.test(severity) ? 2
        : 3
      )
      return severityRank(a.severity) - severityRank(b.severity) || a.distanceMiles - b.distanceMiles
    })
}
