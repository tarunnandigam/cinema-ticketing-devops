import { useEffect, useState } from 'react'
import { getShows } from '../services/shows'
import type { Show } from '../types/movie'

interface ShowsState {
  shows: Show[]
  loading: boolean
  error: string | null
}

const initialState: ShowsState = {
  shows: [],
  loading: true,
  error: null,
}

export function useShows() {
  const [state, setState] = useState(initialState)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let isCurrent = true

    setState((current) => ({ ...current, loading: true, error: null }))

    getShows(refreshKey > 0)
      .then((shows) => {
        if (isCurrent) setState({ shows, loading: false, error: null })
      })
      .catch(() => {
        if (isCurrent) {
          setState({
            shows: [],
            loading: false,
            error: 'We couldn’t load the current showtimes. Please try again.',
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [refreshKey])

  return {
    ...state,
    retry: () => setRefreshKey((key) => key + 1),
  }
}
