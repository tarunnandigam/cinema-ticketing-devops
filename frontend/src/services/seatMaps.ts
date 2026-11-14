import { api } from './api'
import type { SeatStatus, ShowSeat, ShowSeatMap } from '../types/seats'

const seatStatuses = new Set<SeatStatus>(['available', 'held', 'booked'])
const requestsInFlight = new Map<string, Promise<ShowSeatMap>>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSeatMap(value: unknown, expectedShowId: string): ShowSeatMap {
  if (!isRecord(value) || value.showId !== expectedShowId || !Array.isArray(value.seats)) {
    throw new Error('The seat map response did not match the expected format.')
  }

  const seatIds = new Set<string>()
  const seats: ShowSeat[] = value.seats.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.seat_id !== 'string' ||
      typeof item.seat_number !== 'string' ||
      typeof item.status !== 'string' ||
      !seatStatuses.has(item.status as SeatStatus) ||
      seatIds.has(item.seat_id)
    ) {
      throw new Error('The seat map contains an invalid seat record.')
    }

    seatIds.add(item.seat_id)
    return {
      seat_id: item.seat_id,
      seat_number: item.seat_number,
      status: item.status as SeatStatus,
    }
  })

  return { showId: expectedShowId, seats }
}

export function getShowSeatMap(showId: string): Promise<ShowSeatMap> {
  const existingRequest = requestsInFlight.get(showId)
  if (existingRequest) return existingRequest

  const request = api
    .get<unknown>(`/shows/${encodeURIComponent(showId)}/seats`)
    .then(({ data }) => parseSeatMap(data, showId))
    .finally(() => {
      if (requestsInFlight.get(showId) === request) {
        requestsInFlight.delete(showId)
      }
    })

  requestsInFlight.set(showId, request)
  return request
}
