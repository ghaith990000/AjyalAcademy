import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ActivityFilter } from './activity'
import { listActivity, type ActivityCursor } from './api'

export const ACTIVITY_KEY = ['activity'] as const

/** A quiet safety net in case the live connection is down; the live channel is what makes it feel instant. */
const REFRESH_MS = 60_000

let channelCounter = 0

export function useActivityFeed(filter: ActivityFilter) {
  const query = useInfiniteQuery({
    queryKey: [...ACTIVITY_KEY, 'feed', filter],
    queryFn: ({ pageParam }) => listActivity(filter, pageParam),
    initialPageParam: null as ActivityCursor | null,
    getNextPageParam: (last) => last.next,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
    meta: { silent: true }, // ActivityFeed renders its own load-error state
  })
  return { ...query, rows: query.data?.pages.flatMap((page) => page.rows) ?? [] }
}

/**
 * Listens for new `activity_log` rows over Supabase Realtime (row-level security applies: a coach is only sent
 * their own). Any new entry means something changed, so the feed and everything on the home screen that
 * depends on the same data is refreshed. Returns whether the live connection is up.
 */
export function useActivityRealtime(): boolean {
  const queryClient = useQueryClient()
  const [live, setLive] = useState(false)

  useEffect(() => {
    const channel = supabase
      .channel(`activity-feed-${++channelCounter}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
        for (const key of [ACTIVITY_KEY, ['home'], ['reports'], ['sessions'], ['applications']]) {
          void queryClient.invalidateQueries({ queryKey: key })
        }
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      setLive(false)
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return live
}
