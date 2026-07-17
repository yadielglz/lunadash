import { useEffect, useRef } from 'react'
import { dbForceEodSnapshot, dbGetEodSnapshotStatus, dbTriggerSupabaseEodSnapshot } from '../lib/supabase'

const SNAPSHOT_START_HOUR = 22
const SNAPSHOT_VERIFY_HOUR = 23
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
      if (hour < SNAPSHOT_START_HOUR) return

      if (runningRef.current) return

      runningRef.current = true
      try {
        const snapshotKey = `luna-eod-snapshot:${day}`
        if (localStorage.getItem(snapshotKey) !== 'saved') {
          try {
            await dbForceEodSnapshot()
            localStorage.setItem(snapshotKey, 'saved')
          } catch (error) {
            console.warn('Automatic EOD snapshot failed', error)
          }
        }

        if (hour >= SNAPSHOT_VERIFY_HOUR) {
          const verificationKey = `luna-eod-snapshot-verified:${day}`
          if (localStorage.getItem(verificationKey) !== 'saved') {
            try {
              const status = await dbGetEodSnapshotStatus(day)
              if (status.complete) {
                localStorage.setItem(verificationKey, 'saved')
              } else {
                console.warn(`EOD snapshot incomplete for ${day}; triggering Supabase snapshot.`, status)
                await dbTriggerSupabaseEodSnapshot(true)
                const refreshedStatus = await dbGetEodSnapshotStatus(day)
                if (refreshedStatus.complete) {
                  localStorage.setItem(verificationKey, 'saved')
                } else {
                  console.warn(`Supabase EOD snapshot finished but ${day} is still incomplete.`, refreshedStatus)
                }
              }
            } catch (error) {
              console.warn('Automatic EOD snapshot verification failed', error)
              try {
                await dbTriggerSupabaseEodSnapshot(true)
                const refreshedStatus = await dbGetEodSnapshotStatus(day)
                if (refreshedStatus.complete) {
                  localStorage.setItem(verificationKey, 'saved')
                } else {
                  console.warn(`Supabase EOD snapshot fallback finished but ${day} is still incomplete.`, refreshedStatus)
                }
              } catch (triggerError) {
                console.warn('Automatic Supabase EOD snapshot fallback failed', triggerError)
              }
            }
          }
        }
      } finally {
        runningRef.current = false
      }
    }

    runIfDue()
    const id = window.setInterval(runIfDue, CHECK_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runIfDue()
    }

    window.addEventListener('focus', runIfDue)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', runIfDue)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled])
}
