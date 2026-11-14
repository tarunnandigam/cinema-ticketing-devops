import { useMemo, useRef, useState } from 'react'
import { Armchair, ArrowLeft, CalendarDays, Check, Clapperboard, MonitorPlay, Ticket, XCircle } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import axios from 'axios'
import { Button } from '../components/common/Button'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { PageContainer } from '../components/common/PageContainer'
import { cancelReservation, getReservationError, getReservationRecord, saveCancellation } from '../services/reservations'
import type { CancellationResult, ReservationSessionRecord } from '../services/reservations'
import { formatFullShowDate, formatShowTime } from '../utils/shows'

interface ConfirmationState {
  reservation?: ReservationSessionRecord['reservation']
  show?: ReservationSessionRecord['show']
  seats?: ReservationSessionRecord['seats']
}

export function ReservationConfirmation() {
  const { bookingReference = '' } = useParams<{ bookingReference: string }>()
  const location = useLocation()
  const routeState = location.state as ConfirmationState | null
  const [record, setRecord] = useState<ReservationSessionRecord | undefined>(() => {
    const stored = getReservationRecord(bookingReference)
    if (stored) return stored
    if (routeState?.reservation && routeState.show && routeState.seats) {
      return { reservation: routeState.reservation, show: routeState.show, seats: routeState.seats, cancellations: {} }
    }
    return undefined
  })
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(() => new Set())
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({})
  const [cancelResults, setCancelResults] = useState<Record<string, CancellationResult>>({})
  const inFlight = useRef(new Set<string>())

  const bookings = useMemo(() => record?.reservation.bookings ?? [], [record])
  const isReservationReference = bookings.some((booking) => booking.booking_reference === bookingReference)

  function applyCancellation(bookingId: string, result: CancellationResult) {
    saveCancellation(bookingReference, bookingId, result)
    setRecord((current) => current ? {
      ...current,
      reservation: {
        ...current.reservation,
        bookings: current.reservation.bookings.map((item) => item.id === bookingId ? { ...item, status: 'cancelled' } : item),
      },
      cancellations: { ...current.cancellations, [bookingId]: result },
    } : current)
    setCancelResults((current) => ({ ...current, [bookingId]: result }))
    setCancelErrors((current) => {
      const next = { ...current }
      delete next[bookingId]
      return next
    })
  }

  async function cancelOne(bookingId: string): Promise<void> {
    if (inFlight.current.has(bookingId)) return
    inFlight.current.add(bookingId)
    setCancellingIds((current) => new Set(current).add(bookingId))
    setCancelErrors((current) => {
      const next = { ...current }
      delete next[bookingId]
      return next
    })
    try {
      const result = await cancelReservation(bookingId)
      if (result.booking.id !== bookingId || result.booking.status !== 'cancelled') {
        throw new Error('The cancellation response did not match this booking.')
      }
      applyCancellation(bookingId, result)
    } catch (error) {
      setCancelErrors((current) => ({
        ...current,
        [bookingId]: axios.isAxiosError(error)
          ? getReservationError(error, 'cancel')
          : 'The cancellation response could not be verified. Reload the booking details before trying again.',
      }))
    } finally {
      inFlight.current.delete(bookingId)
      setCancellingIds((current) => {
        const next = new Set(current)
        next.delete(bookingId)
        return next
      })
    }
  }

  function cancelSingle(bookingId: string, reference: string) {
    if (!window.confirm(`Cancel reservation ${reference}? This will release its seat if cancellation is allowed.`)) return
    void cancelOne(bookingId)
  }

  function cancelAll() {
    const activeBookings = bookings.filter((booking) => booking.status === 'pending' || booking.status === 'confirmed')
    if (activeBookings.length === 0) return
    if (!window.confirm(`Cancel all ${activeBookings.length} remaining seat reservation${activeBookings.length === 1 ? '' : 's'}? Each seat is cancelled separately.`)) return
    void Promise.all(activeBookings.map((booking) => cancelOne(booking.id)))
  }

  if (!record || !isReservationReference) {
    return (
      <PageContainer className="booking-step-page booking-confirmation-page">
        <p className="eyebrow eyebrow--muted">BOOKING DETAILS</p>
        <h1>This booking isn’t available <em>here.</em></h1>
        <ErrorMessage title="Details not stored in this browser session" message="The API does not provide a booking lookup or booking-history endpoint. Open the confirmation in the browser session where the reservation was created." />
        <Link className="button button--primary" to="/movies"><ArrowLeft size={15} /> Browse shows</Link>
      </PageContainer>
    )
  }

  const activeCount = bookings.filter((booking) => booking.status === 'pending' || booking.status === 'confirmed').length
  const cancelledCount = bookings.filter((booking) => booking.status === 'cancelled').length
  const cancellationFailed = Object.keys(cancelErrors).length > 0
  const allCancelled = activeCount === 0 && cancelledCount === bookings.length

  return (
    <PageContainer className="booking-step-page booking-confirmation-page">
      <p className="eyebrow eyebrow--muted">RESERVATION DETAILS</p>
      <div className="booking-confirmation-mark" aria-hidden="true"><Check size={27} /></div>
      <h1>{allCancelled ? <>Reservation <em>cancelled.</em></> : cancellationFailed && cancelledCount > 0 ? <>Partly <em>cancelled.</em></> : <>Your seats are <em>held.</em></>}</h1>
      <p className="booking-confirmation-lede">
        {allCancelled
          ? 'The server confirmed cancellation of every booking in this reservation.'
          : cancellationFailed && cancelledCount > 0
            ? `${cancelledCount} of ${bookings.length} booking${bookings.length === 1 ? '' : 's'} cancelled. The remaining booking status is shown below.`
            : 'The server created temporary holds. No payment has been taken and the bookings are not confirmed.'}
      </p>

      <section className="booking-confirmation-card" aria-label="Reservation summary">
        <div className="booking-review-card__heading"><span>RESERVATION · {bookings.length} {bookings.length === 1 ? 'SEAT' : 'SEATS'}</span><Ticket size={18} aria-hidden="true" /></div>
        <h2>{record.show.movieTitle}</h2>
        <div className="booking-confirmation-details booking-confirmation-details--group">
          <span><MonitorPlay size={15} aria-hidden="true" />{record.show.screenName}</span>
          <span><CalendarDays size={15} aria-hidden="true" />{formatFullShowDate(record.show.startsAt)} · {formatShowTime(record.show.startsAt)}</span>
        </div>
        <div className="booking-confirmation-bookings">
          {bookings.map((booking) => {
            const seat = record.seats.find((item) => item.id.toLowerCase() === booking.seat_id.toLowerCase())
            const cancellation = cancelResults[booking.id] ?? record.cancellations[booking.id]
            const isCancelling = cancellingIds.has(booking.id)
            const statusLabel = booking.status === 'pending' ? 'Temporary hold · pending' : booking.status
            return (
              <article className="booking-confirmation-seat" key={booking.id}>
                <div className="booking-confirmation-seat__heading">
                  <span><Armchair size={15} aria-hidden="true" />{seat?.number ?? 'Seat details unavailable'}</span>
                  <span className={`booking-status booking-status--${booking.status}`}>{statusLabel}</span>
                </div>
                <strong className="booking-confirmation-reference">{booking.booking_reference}</strong>
                <small>Booking ID: {booking.id}</small>
                {booking.status === 'pending' && record.reservation.expiresAt && (
                  <>
                    <small>Hold expires: {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.reservation.expiresAt))}</small>
                    {Date.parse(record.reservation.expiresAt) <= Date.now() && (
                      <small role="status">The hold window has passed. The backend has no separate expired status; cancellation is still verified by the server.</small>
                    )}
                  </>
                )}
                {cancellation && <p className="booking-cancellation-success" role="status"><Check size={16} /> Cancellation confirmed. Seat status: {cancellation.seat.status}.</p>}
                {cancelErrors[booking.id] && <ErrorMessage title="Cancellation not confirmed" message={cancelErrors[booking.id]} />}
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <Button variant="secondary" disabled={isCancelling} onClick={() => cancelSingle(booking.id, booking.booking_reference)}>
                    {isCancelling ? 'Cancelling…' : `Cancel seat ${seat?.number ?? ''}`} <XCircle size={15} aria-hidden="true" />
                  </Button>
                )}
              </article>
            )
          })}
        </div>
        {cancelledCount > 0 && activeCount > 0 && (
          <p className="booking-partial-status" role="status">Partial cancellation: {cancelledCount} cancelled, {activeCount} still active.</p>
        )}
        {activeCount > 1 && (
          <Button variant="secondary" disabled={cancellingIds.size > 0} onClick={cancelAll}>
            {cancellingIds.size > 0 ? 'Cancelling selected bookings…' : `Cancel all ${activeCount} remaining seats`}
          </Button>
        )}
      </section>

      <div className="booking-confirmation-links"><Link className="text-link" to="/"><ArrowLeft size={15} /> Back to home</Link><Link className="text-link" to="/movies"><Clapperboard size={15} /> View shows</Link></div>
    </PageContainer>
  )
}
