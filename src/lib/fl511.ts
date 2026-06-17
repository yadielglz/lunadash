const FL511_CAMERA_LAYER = 'https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/FL511_Traffic_Cameras/FeatureServer/0/query'
const FL511_TRAFFIC_EVENTS_DIRECT = 'https://fl511.com/List/GetData/traffic'
const TOMTOM_TRAFFIC_INCIDENTS = 'https://api.tomtom.com/traffic/services/5/incidentDetails'
const TOMTOM_TRAFFIC_FLOW = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json'
export const TRAFFIC_RADIUS_MILES = 20
export const TRAFFIC_POLL_INTERVAL_MS = 10 * 60 * 1000

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
  recordsFiltered?: number
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

interface TomTomIncidentResponse {
  incidents?: TomTomIncident[]
}

interface TomTomIncident {
  geometry?: {
    type?: 'Point' | 'LineString'
    coordinates?: number[] | number[][]
  }
  properties?: {
    id?: string
    iconCategory?: number
    magnitudeOfDelay?: number
    events?: Array<{
      description?: string
      code?: number
      iconCategory?: number
    }>
    startTime?: string
    endTime?: string
    from?: string
    to?: string
    length?: number
    delay?: number
    roadNumbers?: string[]
    timeValidity?: string
    lastReportTime?: string
  }
}

interface TomTomFlowResponse {
  flowSegmentData?: {
    frc?: string
    currentSpeed?: number
    freeFlowSpeed?: number
    currentTravelTime?: number
    freeFlowTravelTime?: number
    confidence?: number
    roadClosure?: boolean
  }
}

export interface TomTomTrafficFlow {
  currentSpeed: number
  freeFlowSpeed: number
  currentTravelTime: number
  freeFlowTravelTime: number
  confidence: number
  roadClosure: boolean
  congestionPct: number
  updatedAt: string
}

function tomTomApiKey() {
  return import.meta.env.VITE_TOMTOM_API_KEY as string | undefined
}

export function hasTomTomTrafficKey() {
  return Boolean(tomTomApiKey()?.trim())
}

export function tomTomTrafficConfigMessage() {
  return hasTomTomTrafficKey()
    ? ''
    : 'TomTom traffic is not configured for this build. Add VITE_TOMTOM_API_KEY to the production environment and redeploy.'
}

function requireTomTomApiKey() {
  const key = tomTomApiKey()?.trim()
  if (!key) throw new Error('TomTom traffic API key is missing. Add VITE_TOMTOM_API_KEY to the app environment.')
  return key
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

function bboxParam(center: Coords, radiusMiles: number) {
  const bbox = bboxAround(center, radiusMiles)
  return `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`
}

function tomTomCategoryLabel(category: number | undefined) {
  switch (category) {
    case 1: return 'Accident'
    case 2: return 'Fog'
    case 3: return 'Dangerous conditions'
    case 4: return 'Rain'
    case 5: return 'Ice'
    case 6: return 'Congestion'
    case 7: return 'Lane closed'
    case 8: return 'Road closed'
    case 9: return 'Road work'
    case 10: return 'Wind'
    case 11: return 'Flooding'
    case 14: return 'Disabled vehicle'
    default: return 'Traffic event'
  }
}

function tomTomSeverity(category: number | undefined, magnitude: number | undefined) {
  if (category === 8) return 'Critical'
  if ((magnitude ?? 0) >= 3) return 'Major'
  if ((magnitude ?? 0) >= 2) return 'Intermediate'
  return 'Minor'
}

function tomTomIncidentCoords(incident: TomTomIncident): Coords | null {
  const coords = incident.geometry?.coordinates
  if (!Array.isArray(coords)) return null

  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const lon = coords[0]
    const lat = coords[1]
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
  }

  const points = coords
    .filter((point): point is number[] => Array.isArray(point))
    .map((point) => ({ lon: Number(point[0]), lat: Number(point[1]) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))

  if (points.length === 0) return null
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length,
  }
}

function roadFromIncident(properties: TomTomIncident['properties']) {
  const road = properties?.roadNumbers?.find(Boolean)
  return road || properties?.from || properties?.to || ''
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

async function fetchTrafficEventsPage(start: number, length: number): Promise<Fl511TrafficEventResponse> {
  const res = await fetch(trafficEventsEndpoint(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify({ ...trafficEventsPayload(length), start }),
  })
  if (!res.ok) throw new Error(`FL511 events failed: ${res.status}`)
  return await res.json() as Fl511TrafficEventResponse
}

async function fetchTrafficEventRows(): Promise<Fl511TrafficEventRow[]> {
  const pageLength = 100
  const firstPage = await fetchTrafficEventsPage(0, pageLength)
  const rows = [...(firstPage.data ?? [])]
  const total = firstPage.recordsFiltered ?? firstPage.recordsTotal ?? rows.length

  for (let start = rows.length; start < total; start += pageLength) {
    const page = await fetchTrafficEventsPage(start, pageLength)
    const pageRows = page.data ?? []
    if (pageRows.length === 0) break
    rows.push(...pageRows)
  }

  return rows
}

export async function fetchFl511TrafficEvents(center: Coords, radiusMiles = TRAFFIC_RADIUS_MILES): Promise<Fl511TrafficEvent[]> {
  const rows = await fetchTrafficEventRows()

  return rows
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

export async function fetchTomTomTrafficEvents(center: Coords, radiusMiles = TRAFFIC_RADIUS_MILES): Promise<Fl511TrafficEvent[]> {
  const url = new URL(TOMTOM_TRAFFIC_INCIDENTS)
  url.searchParams.set('key', requireTomTomApiKey())
  url.searchParams.set('bbox', bboxParam(center, radiusMiles))
  url.searchParams.set('fields', '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity,lastReportTime}}}')
  url.searchParams.set('language', 'en-US')
  url.searchParams.set('timeValidityFilter', 'present')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TomTom traffic events failed: ${res.status}`)
  const data = await res.json() as TomTomIncidentResponse

  return (data.incidents ?? [])
    .map((incident) => {
      const coords = tomTomIncidentCoords(incident)
      if (!coords) return null
      const distance = distanceMiles(center, coords)
      if (distance > radiusMiles) return null

      const properties = incident.properties ?? {}
      const category = properties.events?.[0]?.iconCategory ?? properties.iconCategory
      const description = properties.events?.map((event) => event.description).filter(Boolean).join(' | ') || tomTomCategoryLabel(category)

      return {
        id: properties.id ?? `${coords.lat}:${coords.lon}:${properties.startTime ?? description}`,
        type: tomTomCategoryLabel(category),
        roadway: roadFromIncident(properties),
        direction: '',
        severity: tomTomSeverity(category, properties.magnitudeOfDelay),
        description,
        county: '',
        region: '',
        laneDescription: properties.delay ? `${Math.round(properties.delay / 60)} min delay` : '',
        startDate: properties.startTime ?? '',
        lastUpdated: properties.lastReportTime ?? properties.startTime ?? new Date().toISOString(),
        lat: coords.lat,
        lon: coords.lon,
        distanceMiles: distance,
      }
    })
    .filter((event): event is Fl511TrafficEvent => Boolean(event))
    .sort((a, b) => {
      const severityRank = (severity: string) => (
        /critical|major/i.test(severity) ? 0
        : /intermediate/i.test(severity) ? 1
        : /minor/i.test(severity) ? 2
        : 3
      )
      return severityRank(a.severity) - severityRank(b.severity) || a.distanceMiles - b.distanceMiles
    })
}

export async function fetchTomTomTrafficFlow(center: Coords): Promise<TomTomTrafficFlow> {
  const url = new URL(TOMTOM_TRAFFIC_FLOW)
  url.searchParams.set('key', requireTomTomApiKey())
  url.searchParams.set('point', `${center.lat},${center.lon}`)
  url.searchParams.set('unit', 'mph')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TomTom traffic flow failed: ${res.status}`)
  const data = await res.json() as TomTomFlowResponse
  const flow = data.flowSegmentData
  if (!flow) throw new Error('TomTom traffic flow unavailable')

  const currentSpeed = flow.currentSpeed ?? 0
  const freeFlowSpeed = flow.freeFlowSpeed ?? 0
  const congestionPct = freeFlowSpeed > 0
    ? Math.max(0, Math.min(100, Math.round((1 - currentSpeed / freeFlowSpeed) * 100)))
    : 0

  return {
    currentSpeed,
    freeFlowSpeed,
    currentTravelTime: flow.currentTravelTime ?? 0,
    freeFlowTravelTime: flow.freeFlowTravelTime ?? 0,
    confidence: flow.confidence ?? 0,
    roadClosure: Boolean(flow.roadClosure),
    congestionPct,
    updatedAt: new Date().toISOString(),
  }
}

export function tomTomFlowTileUrl(x: number, y: number, zoom: number, style = 'relative0') {
  const key = tomTomApiKey()?.trim()
  if (!key) return ''
  const url = new URL(`https://api.tomtom.com/traffic/map/4/tile/flow/${style}/${zoom}/${x}/${y}.png`)
  url.searchParams.set('key', key)
  url.searchParams.set('tileSize', '256')
  return url.toString()
}
