export type WeekdayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export type StoreDayHours = {
  open: boolean
  start: string
  end: string
}

export type StoreHours = Record<WeekdayKey, StoreDayHours>

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
}

export const WEEKDAY_KEYS: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const DEFAULT_STORE_HOURS: StoreHours = {
  sun: { open: true, start: '12:00', end: '18:00' },
  mon: { open: true, start: '10:00', end: '21:00' },
  tue: { open: true, start: '10:00', end: '21:00' },
  wed: { open: true, start: '10:00', end: '21:00' },
  thu: { open: true, start: '10:00', end: '21:00' },
  fri: { open: true, start: '10:00', end: '21:00' },
  sat: { open: true, start: '10:00', end: '21:00' },
}

export function normalizeStoreHours(value: unknown): StoreHours {
  const source = typeof value === 'object' && value !== null ? value as Partial<Record<WeekdayKey, Partial<StoreDayHours>>> : {}
  return WEEKDAY_KEYS.reduce((hours, day) => {
    const fallback = DEFAULT_STORE_HOURS[day]
    const candidate = source[day] ?? {}
    hours[day] = {
      open: typeof candidate.open === 'boolean' ? candidate.open : fallback.open,
      start: typeof candidate.start === 'string' && candidate.start ? candidate.start : fallback.start,
      end: typeof candidate.end === 'string' && candidate.end ? candidate.end : fallback.end,
    }
    return hours
  }, {} as StoreHours)
}

export function weekdayKeyForDate(date: Date): WeekdayKey {
  return WEEKDAY_KEYS[date.getDay()]
}
