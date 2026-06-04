import { useEffect, useRef } from 'react'
import { dbForceEodSnapshot } from '../lib/supabase'

const SNAPSHOT_HOURS = new Set([22, 23])
const CHECK_MS = 60_000

function newYorkParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    day: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
  }
}

export function useEodSnapshotScheduler(enabled: boolean) {
  const runningRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const runIfDue = async () => {
      const { day, hour } = newYorkParts()
      if (!SNAPSHOT_HOURS.has(hour)) return

      const key = `luna-eod-snapshot:${day}:${hour}`
      if (localStorage.getItem(key) === 'saved' || runningRef.current) return

      runningRef.current = true
      try {
        await dbForceEodSnapshot()
        localStorage.setItem(key, 'saved')
      } catch (error) {
        console.warn('Automatic EOD snapshot failed', error)
      } finally {
        runningRef.current = false
      }
    }

    runIfDue()
    const id = window.setInterval(runIfDue, CHECK_MS)
    return () => window.clearInterval(id)
  }, [enabled])
}
