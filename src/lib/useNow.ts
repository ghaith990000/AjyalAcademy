import { useEffect, useState } from 'react'

/** The current time, refreshed every `intervalMs` — so "5 minutes ago" keeps counting while a page stays open. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
