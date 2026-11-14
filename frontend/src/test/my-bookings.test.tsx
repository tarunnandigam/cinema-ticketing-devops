import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MyBookings } from '../pages/MyBookings'
import type { CancellationResult, ReservationSessionRecord } from '../services/reservations'

const mocks = vi.hoisted(() => ({
  cancelReservation: vi.fn(),
  getSavedReservations: vi.fn(),
  saveCancellation: vi.fn(),
}))

vi.mock('../services/reservations', () => ({
  cancelReservation: mocks.cancelReservation,
  getReservationError: () => 'The server could not cancel this booking.',
  getSavedReservations: mocks.getSavedReservations,
  saveCancellation: mocks.saveCancellation,
}))

const firstBooking = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  booking_reference: 'TKT-AAAA',
  show_id: '11111111-1111-4111-8111-111111111111',
  seat_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  status: 'pending' as const,
  customer_name: 'Test Guest',
  created_at: '2026-11-10T10:00:00.000Z',
}
const secondBooking = {
  ...firstBooking,
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  booking_reference: 'TKT-BBBB',
  seat_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
}
const record: ReservationSessionRecord = {
  reservation: {
    showId: firstBooking.show_id,
    customerName: 'Test Guest',
    expiresAt: '2026-11-10T10:15:00.000Z',
    bookings: [firstBooking, secondBooking],
  },
  show: { movieTitle: 'The Last Horizon', screenName: 'Screen 1', startsAt: '2026-11-15T18:00:00.000Z' },
  seats: [
    { id: firstBooking.seat_id, number: 'A1' },
    { id: secondBooking.seat_id, number: 'A2' },
  ],
  cancellations: {},
}

function renderPage() {
  return render(<MemoryRouter><MyBookings /></MemoryRouter>)
}

function cancellationFor(booking: typeof firstBooking): CancellationResult {
  return {
    status: 'cancelled',
    booking: {
      id: booking.id,
      booking_reference: booking.booking_reference,
      show_id: booking.show_id,
      seat_id: booking.seat_id,
      status: 'cancelled',
      updated_at: '2026-11-10T10:01:00.000Z',
    },
    seat: { showId: booking.show_id, seatId: booking.seat_id, status: 'available' },
  }
}

beforeEach(() => {
  mocks.getSavedReservations.mockReturnValue([record])
  mocks.cancelReservation.mockReset()
  mocks.saveCancellation.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('My Bookings', () => {
  it('shows the specified empty state when the session has no reservations', () => {
    mocks.getSavedReservations.mockReturnValueOnce([])
    renderPage()
    expect(screen.getByRole('heading', { name: /your cinema diary is waiting/i })).toBeInTheDocument()
    expect(screen.getByText('Your reservations will appear here after you book a show.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find a film/i })).toHaveAttribute('href', '/movies')
  })

  it('groups seat-level bookings and shows real reservation details and pending state', () => {
    renderPage()
    expect(screen.getByRole('region', { name: 'Reservation for The Last Horizon' })).toBeInTheDocument()
    expect(screen.getByText('TKT-AAAA')).toBeInTheDocument()
    expect(screen.getByText('TKT-BBBB')).toBeInTheDocument()
    expect(screen.getByText(/A1.*A2/)).toBeInTheDocument()
    expect(screen.getAllByText('pending')).toHaveLength(2)
    expect(screen.getAllByText(/hold window has passed/i)).toHaveLength(2)
    expect(screen.getByText('Booked by Test Guest')).toBeInTheDocument()
  })

  it('changes status only after the cancellation response is confirmed', async () => {
    let resolveCancellation: (result: CancellationResult) => void = () => undefined
    mocks.cancelReservation.mockReturnValue(new Promise((resolve) => { resolveCancellation = resolve }))
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /cancel seat/i })[0])
    expect(screen.getAllByText('pending')).toHaveLength(2)
    resolveCancellation(cancellationFor(firstBooking))
    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument())
    expect(mocks.saveCancellation).toHaveBeenCalledWith('TKT-AAAA', firstBooking.id, expect.objectContaining({ status: 'cancelled' }))
    expect(screen.getByText(/cancellation confirmed/i)).toBeInTheDocument()
  })

  it('represents partial cancellation when one seat succeeds and another fails', async () => {
    mocks.cancelReservation.mockImplementation((id: string) => id === firstBooking.id
      ? Promise.resolve(cancellationFor(firstBooking))
      : Promise.reject(Object.assign(new Error('conflict'), { isAxiosError: true, response: { status: 409 } })))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /cancel all 2 remaining seats/i }))
    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument())
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText('The server could not cancel this booking.')).toBeInTheDocument()
    expect(screen.getByText(/partial cancellation: each seat above shows its server-confirmed status/i)).toBeInTheDocument()
  })
})
