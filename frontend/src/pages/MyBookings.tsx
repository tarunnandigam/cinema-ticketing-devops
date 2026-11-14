import { useMemo, useRef, useState } from 'react'
import { Armchair, ArrowRight, CalendarDays, Check, Clock3, MonitorPlay, Ticket, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '../components/common/Button'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { PageContainer } from '../components/common/PageContainer'
import { cancelReservation, getReservationError, getSavedReservations, saveCancellation } from '../services/reservations'
import type { CancellationResult, ReservationBooking, ReservationSessionRecord } from '../services/reservations'
import { formatFullShowDate, formatShowTime } from '../utils/shows'

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function isActive(booking: ReservationBooking): boolean {
  return booking.status === 'pending' || booking.status === 'confirmed'
}

function reservationCreatedAt(record: ReservationSessionRecord): string {
  const created = record.reservation.bookings
    .map((booking) => Date.parse(booking.created_at))
    .filter(Number.isFinite)
  return created.length ? new Date(Math.min(...created)).toISOString() : ''
}

export function MyBookings() {
  const [records, setRecords] = useState(() => getSavedReservations())
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(() => new Set())
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({})
  const [cancelResults, setCancelResults] = useState<Record<string, CancellationResult>>({})
  const inFlight = useRef(new Set<string>())
  const sortedRecords = useMemo(() => records, [records])

  function applyCancellation(record: ReservationSessionRecord, bookingId: string, result: CancellationResult) {
    const reference = record.reservation.bookings[0]?.booking_reference
    if (reference) saveCancellation(reference, bookingId, result)
    setRecords((current) => current.map((item) => item === record || item.reservation.bookings.some((booking) => booking.id === bookingId)
      ? {
          ...item,
          reservation: {
            ...item.reservation,
            bookings: item.reservation.bookings.map((booking) => booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking),
          },
          cancellations: { ...item.cancellations, [bookingId]: result },
        }
      : item))
    setCancelResults((current) => ({ ...current, [bookingId]: result }))
    setCancelErrors((current) => {
      const next = { ...current }
      delete next[bookingId]
      return next
    })
  }

  async function cancelOne(record: ReservationSessionRecord, booking: ReservationBooking): Promise<void> {
    if (inFlight.current.has(booking.id) || !isActive(booking)) return
    inFlight.current.add(booking.id)
    setCancellingIds((current) => new Set(current).add(booking.id))
    setCancelErrors((current) => {
      const next = { ...current }
      delete next[booking.id]
      return next
    })
    try {
      const result = await cancelReservation(booking.id)
      if (
        result.booking.id !== booking.id || result.booking.status !== 'cancelled' ||
        result.booking.show_id !== booking.show_id || result.booking.seat_id !== booking.seat_id
      ) throw new Error('The cancellation response did not match this booking.')
      applyCancellation(record, booking.id, result)
    } catch (error) {
      setCancelErrors((current) => ({
        ...current,
        [booking.id]: axios.isAxiosError(error)
          ? getReservationError(error, 'cancel')
          : 'The cancellation response could not be verified. Its saved status has not changed.',
      }))
    } finally {
      inFlight.current.delete(booking.id)
      setCancellingIds((current) => {
        const next = new Set(current)
        next.delete(booking.id)
        return next
      })
    }
  }

  function cancelSingle(record: ReservationSessionRecord, booking: ReservationBooking, seatNumber: string) {
    if (!window.confirm(`Cancel booking ${booking.booking_reference}${seatNumber ? ` for seat ${seatNumber}` : ''}?`)) return
    void cancelOne(record, booking)
  }

  function cancelRemaining(record: ReservationSessionRecord) {
    const activeBookings = record.reservation.bookings.filter(isActive)
    if (!activeBookings.length) return
    if (!window.confirm(`Cancel all ${activeBookings.length} remaining seat bookings? Each booking is cancelled separately.`)) return
    void Promise.all(activeBookings.map((booking) => cancelOne(record, booking)))
  }

  if (sortedRecords.length === 0) {
    return (
      <PageContainer className="my-bookings-page">
        <p className="eyebrow eyebrow--muted">YOUR CINEMA DIARY</p>
        <div className="my-bookings-empty__mark" aria-hidden="true"><Ticket size={25} /></div>
        <h1>Your cinema diary <em>is waiting.</em></h1>
        <p className="my-bookings-intro">Your reservations will appear here after you book a show.</p>
        <Link className="button button--primary" to="/movies">Find a film <ArrowRight size={16} aria-hidden="true" /></Link>
        <p className="my-bookings-session-note">This list is saved for this browser session. It is not permanent account history.</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="my-bookings-page">
      <p className="eyebrow eyebrow--muted">YOUR CINEMA DIARY</p>
      <h1>Keep the <em>good nights.</em></h1>
      <p className="my-bookings-intro">Reservations saved in this browser session.</p>
      <p className="my-bookings-session-note">This is session history, not a permanent account record. It remains available in this browser session only.</p>
      <div className="my-bookings-list">
        {sortedRecords.map((record) => {
          const bookings = record.reservation.bookings
          const activeBookings = bookings.filter(isActive)
          const createdAt = reservationCreatedAt(record)
          return (
            <section className="my-booking-card" key={bookings.map((booking) => booking.id).sort().join('-')} aria-label={`Reservation for ${record.show.movieTitle}`}>
              <div className="my-booking-card__topline"><span><Ticket size={16} aria-hidden="true" />{bookings.length} {bookings.length === 1 ? 'SEAT BOOKING' : 'SEAT BOOKINGS'}</span><span>{createdAt ? `Created ${formatDateTime(createdAt)}` : 'Creation date unavailable'}</span></div>
              <h2>{record.show.movieTitle}</h2>
              <div className="my-booking-meta">
                <span><MonitorPlay size={15} aria-hidden="true" />{record.show.screenName}</span>
                <span><CalendarDays size={15} aria-hidden="true" />{formatFullShowDate(record.show.startsAt)} · {formatShowTime(record.show.startsAt)}</span>
                <span><Armchair size={15} aria-hidden="true" />{bookings.length} {bookings.length === 1 ? 'seat' : 'seats'} · {record.seats.map((seat) => seat.number).join(', ') || 'Seat details unavailable'}</span>
                {record.reservation.customerName && <span>Booked by {record.reservation.customerName}</span>}
              </div>
              <div className="my-booking-rows">
                {bookings.map((booking) => {
                  const seat = record.seats.find((item) => item.id.toLowerCase() === booking.seat_id.toLowerCase())
                  const cancellation = cancelResults[booking.id] ?? record.cancellations[booking.id]
                  const expiredHold = booking.status === 'pending' && Date.parse(record.reservation.expiresAt) <= Date.now()
                  return (
                    <article className="my-booking-row" key={booking.id}>
                      <div className="my-booking-row__details">
                        <span className="my-booking-seat">Seat {seat?.number ?? 'details unavailable'}</span>
                        <strong className="my-booking-reference">{booking.booking_reference}</strong>
                        <span className={`booking-status booking-status--${booking.status}`}>{booking.status}</span>
                        {booking.status === 'pending' && <span className="my-booking-hold"><Clock3 size={13} aria-hidden="true" />Hold expires {formatDateTime(record.reservation.expiresAt)}</span>}
                        {expiredHold && <small role="status" className="my-booking-expiry-note">The hold window has passed. The booking remains pending until the server confirms a status change.</small>}
                        {cancelErrors[booking.id] && <ErrorMessage title="Cancellation not confirmed" message={cancelErrors[booking.id]} />}
                        {cancellation && <p className="booking-cancellation-success" role="status"><Check size={15} />Cancellation confirmed. Seat status: {cancellation.seat.status}.</p>}
                      </div>
                      {isActive(booking) && <Button variant="secondary" disabled={cancellingIds.has(booking.id)} onClick={() => cancelSingle(record, booking, seat?.number ?? '')}>{cancellingIds.has(booking.id) ? 'Cancelling…' : 'Cancel seat'} <XCircle size={15} aria-hidden="true" /></Button>}
                    </article>
                  )
                })}
              </div>
              {activeBookings.length > 0 && <Button variant="secondary" className="my-booking-cancel-all" disabled={cancellingIds.size > 0} onClick={() => cancelRemaining(record)}>{cancellingIds.size > 0 ? 'Cancelling bookings…' : `Cancel all ${activeBookings.length} remaining seat${activeBookings.length === 1 ? '' : 's'}`}</Button>}
              {bookings.some((booking) => cancelErrors[booking.id]) && bookings.some((booking) => booking.status === 'cancelled') && <p className="booking-partial-status" role="status">Partial cancellation: each seat above shows its server-confirmed status.</p>}
            </section>
          )
        })}
      </div>
      <p className="my-bookings-session-note">Reservation history is stored in sessionStorage for this browser session. No account or permanent booking lookup is connected.</p>
    </PageContainer>
  )
}
