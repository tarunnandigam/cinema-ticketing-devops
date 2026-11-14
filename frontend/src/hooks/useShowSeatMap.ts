import axios from 'axios'
import { useEffect, useState } from 'react'
import { getShowSeatMap } from '../services/seatMaps'
import type { ShowSeat } from '../types/seats'
import { isValidUuid } from '../utils/shows'

interface SeatMapState {
  seats: ShowSeat[]
  loading: boolean
  error: string | null
}

const initialState: SeatMapState = {
  seats: [],
  loading: true,
  error: null,
}

function getSeatMapError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return 'This show is not in the current schedule.'
  }

  return 'We couldn’t load this show’s seat map. Please try again.'
}

export function useShowSeatMap(showId: string) {
  const [state, setState] = useState(initialState)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let isCurrent = true

    if (!isValidUuid(showId)) {
      setState({ seats: [], loading: false, error: 'The show ID in this link is invalid.' })
      return () => {
        isCurrent = false
      }
    }

    setState((current) => ({ ...current, loading: true, error: null }))

    getShowSeatMap(showId)
      .then(({ seats }) => {
        if (isCurrent) setState({ seats, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (isCurrent) setState({ seats: [], loading: false, error: getSeatMapError(error) })
      })

    return () => {
      isCurrent = false
    }
  }, [showId, retryKey])

  return {
    ...state,
    retry: () => setRetryKey((key) => key + 1),
  }
}
