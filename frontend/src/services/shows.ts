import { api } from './api'
import type { Show, ShowsResponse } from '../types/movie'

const CACHE_DURATION_MS = 60_000

let cachedShows: { shows: Show[]; fetchedAt: number } | undefined
let inFlightRequest: Promise<Show[]> | undefined

export async function getShows(forceRefresh = false): Promise<Show[]> {
  if (
    !forceRefresh &&
    cachedShows &&
    Date.now() - cachedShows.fetchedAt < CACHE_DURATION_MS
  ) {
    return cachedShows.shows
  }

  if (!forceRefresh && inFlightRequest) {
    return inFlightRequest
  }

  inFlightRequest = api
    .get<ShowsResponse>('/shows')
    .then(({ data }) => {
      if (!data || !Array.isArray(data.shows)) {
        throw new Error('The shows service returned an unexpected response.')
      }

      cachedShows = { shows: data.shows, fetchedAt: Date.now() }
      return data.shows
    })
    .finally(() => {
      inFlightRequest = undefined
    })

  return inFlightRequest
}
