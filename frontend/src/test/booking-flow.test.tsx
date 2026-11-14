import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BookingStep } from '../pages/BookingStep'
import { ReservationConfirmation } from '../pages/ReservationConfirmation'
import type { ReservationSessionRecord } from '../services/reservations'

const mocks = vi.hoisted(() => ({
  createReservation: vi.fn(),
  cancelReservation: vi.fn(),
  saveReservationRecord: vi.fn(),
  saveCancellation: vi.fn(),
  apiGet: vi.fn(),
  seatMap: [] as Array<{ seat_id: string; seat_number: string; status: 'available' | 'held' | 'booked' }>,
}))

vi.mock('../hooks/useShows', () => ({
  useShows: () => ({
    shows: [{ id: '11111111-1111-4111-8111-111111111111', movie_title: 'The Last Horizon', screen_name: 'Screen 1', starts_at: '2026-11-15T18:00:00.000Z' }],
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}))

vi.mock('../hooks/useShowSeatMap', () => ({
  useShowSeatMap: () => ({ seats: mocks.seatMap, loading: false, error: null, retry: vi.fn() }),
}))

vi.mock('../services/api', () => ({ api: { get: mocks.apiGet } }))

vi.mock('../services/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/reservations')>()
  return {
    ...actual,
    createReservation: mocks.createReservation,
    cancelReservation: mocks.cancelReservation,
    saveReservationRecord: mocks.saveReservationRecord,
    saveCancellation: mocks.saveCancellation,
    getReservationRecord: () => undefined,
  }
})

const showId = '11111111-1111-4111-8111-111111111111'
const seatAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const seatBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const bookingAId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const bookingBId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const referenceA = 'TKT-AAAA'
const referenceB = 'TKT-BBBB'
const show = { movieTitle: 'The Last Horizon', screenName: 'Screen 1', startsAt: '2026-11-15T18:00:00.000Z' }
const booking = (id: string, reference: string, seatId: string) => ({
  id,
  booking_reference: reference,
  show_id: showId,
  seat_id: seatId,
  status: 'pending' as const,
  customer_name: 'Test Guest',
  created_at: '2026-11-14T10:00:00.000Z',
})
const reservation = {
  showId,
  customerName: 'Test Guest',
  expiresAt: '2026-11-14T10:15:00.000Z',
  bookings: [booking(bookingAId, referenceA, seatAId)],
}
const fullRecord: ReservationSessionRecord = {
  reservation: { ...reservation, bookings: [booking(bookingAId, referenceA, seatAId), booking(bookingBId, referenceB, seatBId)] },
  show,
  seats: [{ id: seatAId, number: 'A1' }, { id: seatBId, number: 'A2' }],
  cancellations: {},
}

function renderBooking(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/booking/review" element={<BookingStep />} />
        <Route path="/booking/confirmation/:bookingReference" element={<ReservationConfirmation />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderConfirmation(initialRecord = fullRecord) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/booking/confirmation/${referenceA}`, state: initialRecord }]}>
      <Routes><Route path="/booking/confirmation/:bookingReference" element={<ReservationConfirmation />} /></Routes>
    </MemoryRouter>,
  )
}

function axiosStatusError(status: number) {
  return Object.assign(new Error('request failed'), { isAxiosError: true, response: { status } })
}

function cancellation(bookingId: string, reference: string, seatId: string) {
  return {
    status: 'cancelled' as const,
    booking: { id: bookingId, booking_reference: reference, show_id: showId, seat_id: seatId, status: 'cancelled' as const, updated_at: '2026-11-14T10:01:00.000Z' },
    seat: { showId, seatId, status: 'available' },
  }
}

beforeEach(() => {
  mocks.seatMap = [
    { seat_id: seatAId, seat_number: 'A1', status: 'available' },
    { seat_id: seatBId, seat_number: 'A2', status: 'available' },
  ]
  mocks.createReservation.mockResolvedValue(reservation)
  mocks.cancelReservation.mockResolvedValue(cancellation(bookingAId, referenceA, seatAId))
  mocks.apiGet.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('seat selection', () => {
  it('toggles an available seat and permits multiple unique selections', async () => {
    const { SeatSelection } = await import('../pages/SeatSelection')
    render(
      <MemoryRouter initialEntries={[`/shows/${showId}/seats`]}>
        <Routes><Route path="/shows/:showId/seats" element={<SeatSelection />} /></Routes>
      </MemoryRouter>,
    )
    const seatA = screen.getByRole('button', { name: 'Seat A1, Available' })
    const seatB = screen.getByRole('button', { name: 'Seat A2, Available' })
    fireEvent.click(seatA)
    fireEvent.click(seatB)
    expect(screen.getByText('2', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seat A1, Selected' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Seat A1, Selected' }))
    expect(screen.getByText('1', { selector: 'strong' })).toBeInTheDocument()
  })

  it('keeps held and booked seats disabled', async () => {
    mocks.seatMap = [
      { seat_id: seatAId, seat_number: 'A1', status: 'held' },
      { seat_id: seatBId, seat_number: 'A2', status: 'booked' },
    ]
    const { SeatSelection } = await import('../pages/SeatSelection')
    render(<MemoryRouter initialEntries={[`/shows/${showId}/seats`]}><Routes><Route path="/shows/:showId/seats" element={<SeatSelection />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Seat A1, On hold' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Seat A2, Booked' })).toBeDisabled()
  })

  it('rejects duplicate seat identifiers in an API seat map', async () => {
    const { getShowSeatMap } = await import('../services/seatMaps')
    mocks.apiGet.mockResolvedValue({ data: { showId, seats: [
      { seat_id: seatAId, seat_number: 'A1', status: 'available' },
      { seat_id: seatAId, seat_number: 'A1 duplicate', status: 'available' },
    ] } })
    await expect(getShowSeatMap(showId)).rejects.toThrow('invalid seat record')
  })
})

describe('booking review and reservation', () => {
  it('rejects missing show and seat query parameters', () => {
    renderBooking('/booking/review')
    expect(screen.getByText(/valid show and one or more unique seat IDs/i)).toBeInTheDocument()
  })

  it('rejects duplicate seat IDs', () => {
    renderBooking(`/booking/review?showId=${showId}&seatIds=${seatAId}&seatIds=${seatAId}`)
    expect(screen.getByText(/duplicate seat IDs/i)).toBeInTheDocument()
  })

  it('prevents submission when a selected seat is unavailable', () => {
    mocks.seatMap[0].status = 'held'
    renderBooking(`/booking/review?showId=${showId}&seatIds=${seatAId}`)
    expect(screen.getByText(/Some seats are no longer available/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create temporary hold/i })).toBeDisabled()
    expect(mocks.createReservation).not.toHaveBeenCalled()
  })

  it('shows the actual booking reference and pending hold on success', async () => {
    renderBooking(`/booking/review?showId=${showId}&seatIds=${seatAId}`)
    fireEvent.change(screen.getByLabelText(/Name for this reservation/i), { target: { value: 'Test Guest' } })
    fireEvent.click(screen.getByRole('button', { name: /Create temporary hold/i }))
    expect(await screen.findByText(referenceA)).toBeInTheDocument()
    expect(screen.getByText(/Temporary hold · pending/i)).toBeInTheDocument()
    expect(screen.getByText(/Hold expires:/i)).toBeInTheDocument()
    expect(mocks.createReservation).toHaveBeenCalledWith(showId, [seatAId], 'Test Guest')
  })

  it('blocks duplicate submissions while a request is in flight', async () => {
    let resolveReservation: (value: typeof reservation) => void = () => undefined
    mocks.createReservation.mockReturnValue(new Promise((resolve) => { resolveReservation = resolve }))
    renderBooking(`/booking/review?showId=${showId}&seatIds=${seatAId}`)
    fireEvent.change(screen.getByLabelText(/Name for this reservation/i), { target: { value: 'Test Guest' } })
    const submit = screen.getByRole('button', { name: /Create temporary hold/i })
    fireEvent.click(submit)
    expect(await screen.findByRole('button', { name: /Creating hold/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Creating hold/i }))
    expect(mocks.createReservation).toHaveBeenCalledTimes(1)
    resolveReservation(reservation)
    expect(await screen.findByText(referenceA)).toBeInTheDocument()
  })

  it('shows a seat conflict response', async () => {
    mocks.createReservation.mockRejectedValue(axiosStatusError(409))
    renderBooking(`/booking/review?showId=${showId}&seatIds=${seatAId}`)
    fireEvent.change(screen.getByLabelText(/Name for this reservation/i), { target: { value: 'Test Guest' } })
    fireEvent.click(screen.getByRole('button', { name: /Create temporary hold/i }))
    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument()
    expect(screen.queryByText(referenceA)).not.toBeInTheDocument()
  })
})

describe('multi-seat cancellation', () => {
  it('updates an individual booking only after server confirmation', async () => {
    let resolveCancellation: (value: ReturnType<typeof cancellation>) => void = () => undefined
    mocks.cancelReservation.mockReturnValue(new Promise((resolve) => { resolveCancellation = resolve }))
    renderConfirmation()
    fireEvent.click(screen.getByRole('button', { name: /Cancel seat A1/i }))
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(screen.getAllByText(/Temporary hold · pending/i)).toHaveLength(2)
    expect(screen.queryByText(/Cancellation confirmed/i)).not.toBeInTheDocument()
    resolveCancellation(cancellation(bookingAId, referenceA, seatAId))
    expect(await screen.findByText(/Cancellation confirmed. Seat status: available/i)).toBeInTheDocument()
    expect(screen.getByText('cancelled')).toBeInTheDocument()
  })

  it('cancels booking rows separately and accurately displays partial failure', async () => {
    mocks.cancelReservation.mockImplementation((id: string) => id === bookingAId
      ? Promise.resolve(cancellation(bookingAId, referenceA, seatAId))
      : Promise.reject(axiosStatusError(409)))
    renderConfirmation()
    expect(screen.getByText(referenceA)).toBeInTheDocument()
    expect(screen.getByText(referenceB)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cancel all 2 remaining seats/i }))
    expect(await screen.findByText(/1 of 2 bookings cancelled/i)).toBeInTheDocument()
    expect(screen.getByText(/Partial cancellation: 1 cancelled, 1 still active/i)).toBeInTheDocument()
    expect(screen.getByText(/already been cancelled or cannot be cancelled/i)).toBeInTheDocument()
    expect(screen.getByText(referenceB).closest('article')).toHaveTextContent(/Temporary hold · pending/i)
  })

  it('does not invent an expired booking status when the hold expiry has passed', () => {
    const expiredRecord = {
      ...fullRecord,
      reservation: { ...fullRecord.reservation, expiresAt: '2020-01-01T00:00:00.000Z' },
    }
    renderConfirmation(expiredRecord)
    expect(screen.getAllByText(/Temporary hold · pending/i)).toHaveLength(2)
    expect(screen.getAllByText(/hold window has passed/i)).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Cancel seat A1/i })).toBeEnabled()
  })
})
