export type StoreProfile = {
  storeId: string
  nickname: string
  location: string
  address: string
  city: string
  state: string
  zip: string
  lat: number
  lon: number
}

export const STORE_PROFILES: StoreProfile[] = [
  {
    storeId: '5733',
    nickname: 'Undefeated',
    location: 'Havendale Blvd',
    address: '997 Havendale Blvd NW, Winter Haven, FL 33881',
    city: 'Winter Haven',
    state: 'FL',
    zip: '33881',
    lat: 28.044264,
    lon: -81.7367143,
  },
  {
    storeId: '892E',
    nickname: 'Avengers',
    location: 'Windermere',
    address: '7782 Winter Garden Vineland Rd, Suite 120, Windermere, FL 34786',
    city: 'Windermere',
    state: 'FL',
    zip: '34786',
    lat: 28.4483858,
    lon: -81.5619311,
  },
  {
    storeId: '561D',
    nickname: 'Top Guns',
    location: 'Clermont S',
    address: '17445 US 192 Suite 14, Clermont, FL 34714',
    city: 'Clermont',
    state: 'FL',
    zip: '34714',
    lat: 28.347149,
    lon: -81.666616,
  },
  {
    storeId: '769D',
    nickname: 'Pink Mafia',
    location: 'Haines City',
    address: '35906 Highway 27, Haines City, FL 33844',
    city: 'Haines City',
    state: 'FL',
    zip: '33844',
    lat: 28.1232762,
    lon: -81.6398476,
  },
  {
    storeId: '843D',
    nickname: 'El Cartel',
    location: 'Kissimmee',
    address: '2538 Simpson Rd, Kissimmee, FL 34744',
    city: 'Kissimmee',
    state: 'FL',
    zip: '34744',
    lat: 28.3184163,
    lon: -81.3412892,
  },
  {
    storeId: '693D',
    nickname: 'GateWay',
    location: 'Champions Gate',
    address: '8286 Champions Gate Blvd, Davenport, FL 33896',
    city: 'Davenport',
    state: 'FL',
    zip: '33896',
    lat: 28.2615432,
    lon: -81.6183483,
  },
  {
    storeId: '697D',
    nickname: 'Wolfpack',
    location: 'Poinciana',
    address: '1082 Cypress Parkway, Kissimmee, FL 34759',
    city: 'Kissimmee',
    state: 'FL',
    zip: '34759',
    lat: 28.144568,
    lon: -81.4463012,
  },
  {
    storeId: '180E',
    nickname: 'Titans',
    location: 'Clermont N',
    address: '16526 E State Road 50, Clermont, FL 34711',
    city: 'Clermont',
    state: 'FL',
    zip: '34711',
    lat: 28.5458363,
    lon: -81.6803133,
  },
  {
    storeId: '5383',
    nickname: 'Pink Panthers',
    location: 'Davenport',
    address: '43386 Highway 27, Davenport, FL 33837',
    city: 'Davenport',
    state: 'FL',
    zip: '33837',
    lat: 28.2258735,
    lon: -81.646547,
  },
  {
    storeId: '886E',
    nickname: "D'Sharks",
    location: 'College Park',
    address: '2441 Edgewater Dr, Orlando, FL 32804',
    city: 'Orlando',
    state: 'FL',
    zip: '32804',
    lat: 28.573147,
    lon: -81.389159,
  },
  {
    storeId: '582D',
    nickname: 'Magenta Warriors',
    location: 'Lake Wales',
    address: '138 SR 60 E, Lake Wales, FL 33853',
    city: 'Lake Wales',
    state: 'FL',
    zip: '33853',
    lat: 27.8941866,
    lon: -81.5887488,
  },
]

export function getStoreProfile(storeId: string | null | undefined) {
  const normalized = (storeId ?? '').trim().toUpperCase()
  return STORE_PROFILES.find((profile) => profile.storeId === normalized) ?? null
}
