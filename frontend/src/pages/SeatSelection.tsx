import { useEffect, useMemo, useState } from 'react'
import { Armchair, ArrowLeft, ArrowRight, CalendarDays, MonitorPlay } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { Loading } from '../components/common/Loading'
import { PageContainer } from '../components/common/PageContainer'
import { SeatMap } from '../components/booking/SeatMap'
import { useShows } from '../hooks/useShows'
import { useShowSeatMap } from '../hooks/useShowSeatMap'
import type { MovieRouteState, Show } from '../types/movie'
import type { ShowSeat } from '../types/seats'
import { formatFullShowDate, formatShowTime, isValidUuid, moviePathSegment } from '../utils/shows'

export function SeatSelection() {
  const { showId = '' } = useParams<{ showId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as MovieRouteState | null
  const { shows, loading: showsLoading, error: showsError, retry: retryShows } = useShows()
  const { seats, loading, error, retry } = useShowSeatMap(showId)
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(() => new Set())

  const selectedShow = useMemo(() => {
    const fromSchedule = shows.find((show) => show.id === showId)
    if (fromSchedule) return fromSchedule

    if (routeState?.showId === showId) {
      return {
        id: routeState.showId,
        movie_title: routeState.movieTitle,
        screen_name: routeState.screenName,
        starts_at: routeState.startsAt,
      } satisfies Show
    }

    return undefined
  }, [shows, showId, routeState])

  const selectedSeats = useMemo(
    () => seats
      .filter((seat) => selectedSeatIds.has(seat.seat_id))
      .sort((left, right) => left.seat_number.localeCompare(right.seat_number, undefined, { numeric: true })),
    [seats, selectedSeatIds],
  )

  useEffect(() => {
    setSelectedSeatIds(new Set())
  }, [showId])

  useEffect(() => {
    const availableIds = new Set(
      seats.filter((seat) => seat.status === 'available').map((seat) => seat.seat_id),
    )
    setSelectedSeatIds((current) => {
      const next = new Set(Array.from(current).filter((seatId) => availableIds.has(seatId)))
      return next.size === current.size ? current : next
    })
  }, [seats])

  function toggleSeat(seat: ShowSeat) {
    if (seat.status !== 'available') return

    setSelectedSeatIds((current) => {
      const next = new Set(current)
      if (next.has(seat.seat_id)) next.delete(seat.seat_id)
      else next.add(seat.seat_id)
      return next
    })
  }

  function continueToBookingStep() {
    if (!isValidUuid(showId) || selectedSeats.length === 0) return

    const params = new URLSearchParams()
    params.set('showId', showId)
    selectedSeats.forEach((seat) => {
      params.append('seatIds', seat.seat_id)
      params.append('seatNumbers', seat.seat_number)
    })

    navigate(`/booking/review?${params.toString()}`)
  }

  const backToMovie = selectedShow
    ? `/movies/${encodeURIComponent(moviePathSegment(selectedShow.movie_title))}?showId=${encodeURIComponent(showId)}`
    : '/movies'

  return (
    <PageContainer className="seat-selection-page">
      <Link className="text-link seat-selection-page__back" to={backToMovie}>
        <ArrowLeft size={15} aria-hidden="true" /> Back to showtimes
      </Link>

      <header className="seat-selection-header">
        <div>
          <p className="eyebrow"><span className="eyebrow__dot" /> YOUR SEAT, YOUR VIEW</p>
          <h1>Choose your <em>seats.</em></h1>
          {selectedShow ? (
            <div className="seat-selection-header__details">
              <strong>{selectedShow.movie_title}</strong>
              <span><CalendarDays size={14} /> {formatFullShowDate(selectedShow.starts_at)} · {formatShowTime(selectedShow.starts_at)}</span>
            </div>
          ) : showsLoading ? (
            <p className="seat-selection-header__note">Loading show details…</p>
          ) : showsError ? (
            <p className="seat-selection-header__note">Show details are unavailable; the seat map will be loaded for this show ID.</p>
          ) : (
            <p className="seat-selection-header__note">Show details aren’t available in the current schedule.</p>
          )}
        </div>
        <div className="screen-indicator">
          <MonitorPlay size={18} aria-hidden="true" />
          <span>SCREEN</span>
          <strong>{selectedShow?.screen_name ?? 'Details unavailable'}</strong>
        </div>
      </header>

      {showsError && selectedShow && (
        <div className="seat-info-note" role="status">
          The show information is from the selected schedule entry. The seat map below is loaded separately.
          <button type="button" onClick={retryShows}>Refresh show details</button>
        </div>
      )}

      {loading && <Loading label="Loading the live seat map…" />}
      {error && (
        <div className="listing-state">
          <ErrorMessage
            title={isValidUuid(showId) ? 'Seat map unavailable' : 'Invalid show link'}
            message={error}
          />
          {isValidUuid(showId) && <Button variant="secondary" onClick={retry}>Try again</Button>}
        </div>
      )}
      {!loading && !error && seats.length === 0 && (
        <div className="empty-listing seat-empty-state">
          <Armchair size={24} aria-hidden="true" />
          <h2>No seats are listed for this show.</h2>
          <p>There isn’t a seat map available for this show at the moment.</p>
        </div>
      )}

      {!loading && !error && seats.length > 0 && (
        <>
          <section className="seat-map-panel" aria-labelledby="seat-map-title">
            <div className="seat-map-panel__heading">
              <div>
                <p className="eyebrow eyebrow--muted">LIVE SEAT MAP</p>
                <h2 id="seat-map-title">Find your <em>place.</em></h2>
              </div>
              <span>{seats.length} {seats.length === 1 ? 'seat' : 'seats'} on this map</span>
            </div>

            <SeatMap
              seats={seats}
              selectedSeatIds={selectedSeatIds}
              onToggleSeat={toggleSeat}
            />

            <div className="seat-legend" aria-label="Seat status legend">
              <span><i className="seat-legend__swatch seat-legend__swatch--available" /> Available</span>
              <span><i className="seat-legend__swatch seat-legend__swatch--selected" /> Selected</span>
              <span><i className="seat-legend__swatch seat-legend__swatch--held" /> On hold</span>
              <span><i className="seat-legend__swatch seat-legend__swatch--booked" /> Booked</span>
            </div>
            <p className="seat-map-panel__note">Only seats marked available can be selected. Selection does not reserve seats.</p>
          </section>

          <section className="seat-selection-summary" aria-live="polite">
            <div className="seat-selection-summary__icon"><Armchair size={19} aria-hidden="true" /></div>
            <div className="seat-selection-summary__content">
              <span>SELECTED SEATS <strong>{selectedSeats.length}</strong></span>
              {selectedSeats.length > 0 ? (
                <div className="seat-selection-summary__numbers">
                  {selectedSeats.map((seat) => <span key={seat.seat_id}>{seat.seat_number}</span>)}
                </div>
              ) : (
                <p>Choose one or more available seats to continue.</p>
              )}
            </div>
            <Button disabled={selectedSeats.length === 0 || !isValidUuid(showId)} onClick={continueToBookingStep}>
              Continue <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </section>
        </>
      )}
    </PageContainer>
  )
}
