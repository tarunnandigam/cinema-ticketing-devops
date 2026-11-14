import { useMemo, useRef, useState } from 'react'
import { Armchair, ArrowLeft, ArrowRight, CalendarDays, Clapperboard, MonitorPlay } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Button } from '../components/common/Button'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { Loading } from '../components/common/Loading'
import { PageContainer } from '../components/common/PageContainer'
import { useShows } from '../hooks/useShows'
import { useShowSeatMap } from '../hooks/useShowSeatMap'
import { createReservation, getReservationError, saveReservationRecord } from '../services/reservations'
import type { Show } from '../types/movie'
import { formatFullShowDate, formatShowTime, isValidUuid, moviePathSegment } from '../utils/shows'

export function BookingStep() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const rawShowIds = searchParams.getAll('showId')
  const showId = rawShowIds[0] ?? ''
  const seatIds = searchParams.getAll('seatIds')
  const malformedSelection = rawShowIds.length !== 1 || seatIds.length === 0 || seatIds.some((id) => !isValidUuid(id))
  const duplicateSelection = new Set(seatIds.map((id) => id.toLowerCase())).size !== seatIds.length
  const validParams = isValidUuid(showId) && !malformedSelection && !duplicateSelection
  const { shows, loading: showsLoading, error: showsError, retry: retryShows } = useShows()
  const { seats, loading: seatsLoading, error: seatsError, retry: retrySeats } = useShowSeatMap(showId)
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submitLock = useRef(false)

  const show = useMemo(() => shows.find((item) => item.id.toLowerCase() === showId.toLowerCase()), [shows, showId])
  const seatLookup = useMemo(() => new Map(seats.map((seat) => [seat.seat_id.toLowerCase(), seat])), [seats])
  const selectedSeats = useMemo(() => seatIds.map((id) => seatLookup.get(id.toLowerCase())), [seatIds, seatLookup])
  const missingSeats = selectedSeats.some((seat) => !seat)
  const unavailableSeats = selectedSeats.filter((seat) => seat && seat.status !== 'available')
  const loading = showsLoading || seatsLoading
  const invalidRequest = !validParams
  const selectionReady = validParams && Boolean(show) && !missingSeats && unavailableSeats.length === 0
  const backPath = `/shows/${encodeURIComponent(showId)}/seats`

  async function submitReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = customerName.trim()
    if (submitLock.current || !selectionReady || trimmedName.length < 1 || trimmedName.length > 200) return
    submitLock.current = true
    setSubmitting(true)
    setSubmitError(null)

    try {
      const reservation = await createReservation(showId, seatIds, trimmedName)
      const returnedIds = reservation.bookings.map((booking) => booking.seat_id.toLowerCase())
      if (
        reservation.showId.toLowerCase() !== showId.toLowerCase() ||
        reservation.bookings.some((booking) => booking.status !== 'pending' || booking.show_id.toLowerCase() !== showId.toLowerCase()) ||
        returnedIds.length !== seatIds.length || new Set(returnedIds).size !== seatIds.length ||
        seatIds.some((id) => !returnedIds.includes(id.toLowerCase()))
      ) throw new Error('The reservation response did not match the selected show and seats.')

      const chosenShow = show as Show
      const bookingSeats = selectedSeats.flatMap((seat) => seat ? [{ id: seat.seat_id, number: seat.seat_number }] : [])
      saveReservationRecord({
        reservation,
        show: { movieTitle: chosenShow.movie_title, screenName: chosenShow.screen_name, startsAt: chosenShow.starts_at },
        seats: bookingSeats,
        cancellations: {},
      })
      navigate(`/booking/confirmation/${encodeURIComponent(reservation.bookings[0].booking_reference)}`, {
        state: { reservation, show: { movieTitle: chosenShow.movie_title, screenName: chosenShow.screen_name, startsAt: chosenShow.starts_at }, seats: bookingSeats },
      })
    } catch (error) {
      setSubmitError(axios.isAxiosError(error) ? getReservationError(error, 'create') : 'The reservation was created, but the response could not be verified. Check the booking details before retrying.')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <PageContainer className="booking-step-page booking-review-page">
      <Link className="text-link" to={isValidUuid(showId) ? backPath : '/movies'}>
        <ArrowLeft size={15} aria-hidden="true" /> Back to seat selection
      </Link>
      <div className="booking-step-art" aria-hidden="true"><Clapperboard size={31} strokeWidth={1.15} /></div>
      <p className="eyebrow eyebrow--muted">REVIEW YOUR SELECTION</p>
      <h1>Your cinema night, <em>held.</em></h1>

      {invalidRequest && <ErrorMessage title="Selection link is incomplete" message={duplicateSelection ? 'The link contains duplicate seat IDs. Return to the seat map and select your seats again.' : 'A valid show and one or more unique seat IDs are required. Return to a show and choose available seats.'} />}
      {loading && validParams && <Loading label="Rechecking show and seat availability…" />}
      {showsError && <div className="booking-review-state"><ErrorMessage title="Show schedule unavailable" message={showsError} /><Button variant="secondary" onClick={retryShows}>Try again</Button></div>}
      {seatsError && validParams && <div className="booking-review-state"><ErrorMessage title="Seat map unavailable" message={seatsError} /><Button variant="secondary" onClick={retrySeats}>Try again</Button></div>}
      {!loading && !showsError && !show && validParams && <ErrorMessage title="Show not found" message="This show is not in the current schedule. Browse the available shows to start again." />}

      {!loading && !seatsError && show && validParams && (
        <>
          {seats.length === 0 ? (
            <div className="booking-review-state"><div className="empty-listing"><Armchair size={24} /><h2>No seats are listed for this show.</h2><p>Return to the show schedule to choose another session.</p></div></div>
          ) : (
            <>
              {missingSeats && <div className="booking-review-state"><ErrorMessage title="Seat selection changed" message="One or more selected seats are no longer on this show’s seat map. Return and choose again." /></div>}
              {unavailableSeats.length > 0 && <div className="booking-review-state"><ErrorMessage title="Some seats are no longer available" message="Another guest may have taken a seat while you reviewed. Refresh the seat map and select available seats again." /></div>}
              <section className="booking-review-card" aria-label="Show and seat summary">
                <div className="booking-review-card__heading"><span>YOUR SHOW</span><Clapperboard size={18} aria-hidden="true" /></div>
                <h2>{show.movie_title}</h2>
                <div className="booking-review-meta">
                  <span><MonitorPlay size={15} aria-hidden="true" />{show.screen_name}</span>
                  <span><CalendarDays size={15} aria-hidden="true" />{formatFullShowDate(show.starts_at)} · {formatShowTime(show.starts_at)}</span>
                </div>
                <div className="booking-review-seats">
                  <div><Armchair size={17} aria-hidden="true" /><strong>{seatIds.length} {seatIds.length === 1 ? 'seat' : 'seats'}</strong></div>
                  <p>{selectedSeats.flatMap((seat) => seat ? [seat.seat_number] : []).join(' · ')}</p>
                </div>
                <p className="booking-review-note">Submitting creates a temporary seat hold. No payment is taken.</p>
              </section>

              <form className="booking-review-form" onSubmit={submitReservation}>
                <label htmlFor="customer-name">Name for this reservation</label>
                <input id="customer-name" name="customerName" autoComplete="name" maxLength={200} required value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                {submitError && <ErrorMessage title="Reservation not confirmed" message={submitError} />}
                <div className="booking-review-actions">
                  <Link className="button button--secondary" to={backPath}>Change seats</Link>
                  <Button type="submit" disabled={!selectionReady || submitting || customerName.trim().length === 0 || customerName.trim().length > 200}>
                    {submitting ? 'Creating hold…' : 'Create temporary hold'} <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              </form>
            </>
          )}
        </>
      )}
      {show && !loading && <span className="visually-hidden">Show: {moviePathSegment(show.movie_title)}</span>}
    </PageContainer>
  )
}
