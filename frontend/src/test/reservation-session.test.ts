import { beforeEach, describe, expect, it } from 'vitest'
import { getSavedReservations, saveCancellation, saveReservationRecord } from '../services/reservations'
import type { ReservationSessionRecord } from '../services/reservations'

const record: ReservationSessionRecord = {
  reservation: {
    showId: '11111111-1111-4111-8111-111111111111',
    customerName: 'Session Guest',
    expiresAt: '2026-11-14T11:00:00.000Z',
    bookings: [
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', booking_reference: 'TKT-A', show_id: '11111111-1111-4111-8111-111111111111', seat_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'pending', customer_name: 'Session Guest', created_at: '2026-11-14T10:00:00.000Z' },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', booking_reference: 'TKT-B', show_id: '11111111-1111-4111-8111-111111111111', seat_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'pending', customer_name: 'Session Guest', created_at: '2026-11-14T10:00:00.000Z' },
    ],
  },
  show: { movieTitle: 'The Last Horizon', screenName: 'Screen 1', startsAt: '2026-11-15T18:00:00.000Z' },
  seats: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', number: 'A1' }, { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', number: 'A2' }],
  cancellations: {},
}

beforeEach(() => sessionStorage.clear())

describe('reservation session storage', () => {
  it('deduplicates aliases for multiple booking references while preserving the saved reservation on reload', () => {
    saveReservationRecord(record)
    expect(getSavedReservations()).toHaveLength(1)
    expect(getSavedReservations()[0].reservation.bookings).toHaveLength(2)
    expect(getSavedReservations()[0].show.movieTitle).toBe('The Last Horizon')
  })

  it('persists server-confirmed cancellation status across page reloads', () => {
    saveReservationRecord(record)
    saveCancellation('TKT-A', record.reservation.bookings[0].id, {
      status: 'cancelled',
      booking: { ...record.reservation.bookings[0], status: 'cancelled', updated_at: '2026-11-14T10:02:00.000Z' },
      seat: { showId: record.reservation.showId, seatId: record.reservation.bookings[0].seat_id, status: 'available' },
    })
    const [restored] = getSavedReservations()
    expect(restored.reservation.bookings.map((booking) => booking.status)).toEqual(['cancelled', 'pending'])
    expect(restored.cancellations[record.reservation.bookings[0].id].seat.status).toBe('available')
  })
})
