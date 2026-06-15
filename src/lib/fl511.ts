const FL511_CAMERA_LAYER = 'https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/FL511_Traffic_Cameras/FeatureServer/0/query'
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
