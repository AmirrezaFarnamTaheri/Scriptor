import { useEffect, useState } from 'react'
import { formatLocalDate, millisecondsUntilNextLocalDate, type Clock } from '@scriptor/core/date'

const systemClock: Clock = () => new Date()

export function useLocalDate(clock: Clock = systemClock): string {
  const [localDate, setLocalDate] = useState(() => formatLocalDate(clock()))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const scheduleRollover = () => {
      const now = clock()
      setLocalDate(formatLocalDate(now))
      timer = setTimeout(() => {
        if (!cancelled) scheduleRollover()
      }, millisecondsUntilNextLocalDate(now))
    }

    scheduleRollover()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [clock])

  return localDate
}
