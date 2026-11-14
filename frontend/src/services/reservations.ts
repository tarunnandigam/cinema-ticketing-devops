import axios from 'axios'
import { api } from './api'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export interface ReservationBooking {
  id: string
  booking_reference: string
  show_id: string
  seat_id: string
  status: BookingStatus
  customer_name: string
  created_at: string
}

export interface ReservationResult {
  showId: string
  customerName: string
  expiresAt: string
  bookings: ReservationBooking[]
}

export interface CancellationResult {
  status: 'cancelled'
  booking: Pick<ReservationBooking, 'id' | 'booking_reference' | 'show_id' | 'seat_id' | 'status'> & { updated_at: string }
  seat: { showId: string; seatId: string; status: string }
}

export interface ReservationSessionRecord {
  reservation: ReservationResult
  show: { movieTitle: string; screenName: string; startsAt: string }
  seats: Array<{ id: string; number: string }>
  cancellations: Record<string, CancellationResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return value === 'pending' || value === 'confirmed' || value === 'cancelled'
}

function parseBooking(value: unknown): ReservationBooking {
  if (
    !isRecord(value) || typeof value.id !== 'string' ||
    typeof value.booking_reference !== 'string' || typeof value.show_id !== 'string' ||
    typeof value.seat_id !== 'string' || !isBookingStatus(value.status) ||
    typeof value.customer_name !== 'string' || typeof value.created_at !== 'string'
  ) throw new Error('The reservation response did not match the expected format.')
  return value as unknown as ReservationBooking
}

export function parseReservation(value: unknown): ReservationResult {
  if (!isRecord(value) || !isRecord(value.reservation)) {
    throw new Error('The reservation response did not match the expected format.')
  }
  const result = value.reservation
  if (
    typeof result.showId !== 'string' || typeof result.customerName !== 'string' ||
    typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt)) ||
    !Array.isArray(result.bookings) || result.bookings.length === 0
  ) throw new Error('The reservation response did not match the expected format.')
  return { showId: result.showId, customerName: result.customerName, expiresAt: result.expiresAt, bookings: result.bookings.map(parseBooking) }
}

export function parseCancellation(value: unknown): CancellationResult {
  if (!isRecord(value) || value.status !== 'cancelled' || !isRecord(value.booking) || !isRecord(value.seat)) {
    throw new Error('The cancellation response did not match the expected format.')
  }
  const booking = value.booking
  const seat = value.seat
  if (
    typeof booking.id !== 'string' || typeof booking.booking_reference !== 'string' ||
    typeof booking.show_id !== 'string' || typeof booking.seat_id !== 'string' ||
    booking.status !== 'cancelled' || typeof booking.updated_at !== 'string' ||
    typeof seat.showId !== 'string' || typeof seat.seatId !== 'string' || typeof seat.status !== 'string'
  ) throw new Error('The cancellation response did not match the expected format.')
  return { status: 'cancelled', booking: booking as CancellationResult['booking'], seat: seat as CancellationResult['seat'] }
}

export async function createReservation(showId: string, seatIds: string[], customerName: string): Promise<ReservationResult> {
  const { data } = await api.post<unknown>(`/shows/${encodeURIComponent(showId)}/reservations`, { seatIds, customerName })
  return parseReservation(data)
}

export async function cancelReservation(bookingId: string): Promise<CancellationResult> {
  const { data } = await api.delete<unknown>(`/reservations/${encodeURIComponent(bookingId)}`)
  return parseCancellation(data)
}

export function getReservationError(error: unknown, action: 'create' | 'cancel'): string {
  if (!axios.isAxiosError(error)) return 'The server returned an unexpected response. Please try again.'
  const status = error.response?.status
  if (status === 400) return action === 'create'
    ? 'The reservation details were not accepted. Review your selection and customer name.'
    : 'This booking reference is invalid.'
  if (status === 404) return action === 'create'
    ? 'This show or one of the selected seats could not be found. Return to the seat map and choose again.'
    : 'This booking could not be found.'
  if (status === 409) return action === 'create'
    ? 'One or more seats are no longer available. Return to the seat map and refresh your selection.'
    : 'This booking has already been cancelled or cannot be cancelled in its current state.'
  return action === 'create'
    ? 'We couldn’t create the reservation right now. Please try again.'
    : 'We couldn’t cancel this booking right now. Please try again.'
}

const SESSION_KEY = 'cinema-ticketing.reservations.v1'

function readSession(): Record<string, ReservationSessionRecord> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed as Record<string, ReservationSessionRecord> : {}
  } catch {
    return {}
  }
}

export function saveReservationRecord(record: ReservationSessionRecord): void {
  try {
    const records = readSession()
    for (const booking of record.reservation.bookings) records[booking.booking_reference] = record
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(records))
  } catch {
    // Confirmation remains available through navigation state for this page visit.
  }
}

export function getReservationRecord(reference: string): ReservationSessionRecord | undefined {
  return readSession()[reference]
}

export function getSavedReservations(): ReservationSessionRecord[] {
  const unique = new Map<string, ReservationSessionRecord>()
  for (const record of Object.values(readSession())) {
    const bookingIds = record.reservation?.bookings
      ?.map((booking) => booking.id)
      .filter((id): id is string => typeof id === 'string')
      .sort()
    if (!bookingIds?.length) continue
    const key = bookingIds.join(':')
    if (!unique.has(key)) unique.set(key, record)
  }
  return Array.from(unique.values()).sort((left, right) => {
    const leftCreated = Math.min(...left.reservation.bookings.map((booking) => Date.parse(booking.created_at)).filter(Number.isFinite))
    const rightCreated = Math.min(...right.reservation.bookings.map((booking) => Date.parse(booking.created_at)).filter(Number.isFinite))
    return rightCreated - leftCreated
  })
}

export function saveCancellation(reference: string, bookingId: string, result: CancellationResult): void {
  try {
    const records = readSession()
    const record = records[reference]
    if (!record) return
    record.cancellations[bookingId] = result
    const index = record.reservation.bookings.findIndex((booking) => booking.id === bookingId)
    if (index >= 0) record.reservation.bookings[index] = { ...record.reservation.bookings[index], status: 'cancelled' }
    for (const booking of record.reservation.bookings) records[booking.booking_reference] = record
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(records))
  } catch {
    // The current screen still reflects the confirmed cancellation response.
  }
}
