import { useEffect, useMemo, useState } from 'react'
import { Armchair, ArrowLeft, ArrowRight, CalendarDays, Clapperboard, MonitorPlay } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { Loading } from '../components/common/Loading'
import { PageContainer } from '../components/common/PageContainer'
import { ShowDateFilters } from '../components/movies/ShowDateFilters'
import { useShows } from '../hooks/useShows'
import type { MovieRouteState, Show } from '../types/movie'
import {
  formatFullShowDate,
  formatShowTime,
  getShowDateKey,
  isValidUuid,
  moviePathSegment,
} from '../utils/shows'

export function MovieDetails() {
  const { movieId = '' } = useParams<{ movieId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { shows, loading, error, retry } = useShows()
  const navigationState = location.state as MovieRouteState | null
  const queryShowId = searchParams.get('showId')
  const selectedShowId = queryShowId ?? navigationState?.showId ?? null
  const [selectedDate, setSelectedDate] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    setSelectedDate(undefined)
  }, [movieId])

  useEffect(() => {
    if (!queryShowId && navigationState?.showId && isValidUuid(navigationState.showId)) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('showId', navigationState.showId)
      setSearchParams(nextParams, { replace: true })
    }
  }, [navigationState?.showId, queryShowId, searchParams, setSearchParams])

  const movieShows = useMemo(
    () => shows.filter((show) => moviePathSegment(show.movie_title) === movieId),
    [shows, movieId],
  )
  const availableDates = useMemo(
    () => Array.from(new Set(movieShows.map((show) => getShowDateKey(show.starts_at)).filter(Boolean))).sort(),
    [movieShows],
  )
  const selectedShow = useMemo(
    () => movieShows.find((show) => show.id === selectedShowId) ?? null,
    [movieShows, selectedShowId],
  )
  const effectiveDate =
    selectedDate !== undefined
      ? selectedDate
      : selectedShow
        ? getShowDateKey(selectedShow.starts_at)
        : availableDates[0] ?? null
  const visibleDates = effectiveDate ? [effectiveDate] : availableDates
  const dateGroups = visibleDates
    .map((date) => ({
      date,
      shows: movieShows.filter((show) => getShowDateKey(show.starts_at) === date),
    }))
    .filter((group) => group.shows.length > 0)

  const invalidSelection = queryShowId !== null && (
    !isValidUuid(queryShowId) ||
    (shows.length > 0 && !shows.some((show) => show.id === queryShowId)) ||
    (shows.some((show) => show.id === queryShowId) && !selectedShow)
  )

  function selectDate(date: string | null) {
    setSelectedDate(date)
    if (selectedShow && date !== null && getShowDateKey(selectedShow.starts_at) !== date) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('showId')
      setSearchParams(nextParams)
    }
  }

  function selectShow(show: Show) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('showId', show.id)
    setSearchParams(nextParams)
    setSelectedDate(getShowDateKey(show.starts_at))
  }

  function continueToSeats() {
    if (!selectedShow) return
    navigate(`/shows/${encodeURIComponent(selectedShow.id)}/seats`, {
      state: {
        movieTitle: selectedShow.movie_title,
        showId: selectedShow.id,
        startsAt: selectedShow.starts_at,
        screenName: selectedShow.screen_name,
      } satisfies MovieRouteState,
    })
  }

  return (
    <PageContainer className="movie-details-page">
      <Link className="text-link movie-details-back" to="/movies">
        <ArrowLeft size={15} aria-hidden="true" /> All movies
      </Link>

      {loading && <Loading label="Loading this movie’s showtimes…" />}
      {error && (
        <div className="listing-state">
          <ErrorMessage title="Showtimes didn’t load" message={error} />
          <Button variant="secondary" onClick={retry}>Try again</Button>
        </div>
      )}

      {!loading && !error && movieShows.length === 0 && (
        <div className="empty-listing details-empty">
          <Clapperboard size={25} aria-hidden="true" />
          <h1>This movie isn’t on the current schedule.</h1>
          <p>Choose a title from the available movie listings.</p>
          <Link className="button button--primary" to="/movies">Browse movies <ArrowRight size={16} /></Link>
        </div>
      )}

      {!loading && !error && movieShows.length > 0 && (
        <>
          <header className="movie-details-hero">
            <div className="movie-details-art" aria-hidden="true">
              <span className="movie-details-art__ring movie-details-art__ring--outer" />
              <span className="movie-details-art__ring movie-details-art__ring--inner" />
              <span className="movie-details-art__beam" />
              <span className="movie-details-art__symbol"><Clapperboard size={42} strokeWidth={1.1} /></span>
              <span className="movie-details-art__caption">CINEMATICKET · CURRENT SCHEDULE</span>
            </div>
            <div className="movie-details-title">
              <p className="eyebrow"><span className="eyebrow__dot" /> MOVIE DETAILS</p>
              <h1>{movieShows[0].movie_title}</h1>
              <p>Choose a date and screening from the published schedule.</p>
              <div className="movie-details-title__meta">
                <span><CalendarDays size={15} /> {movieShows.length} {movieShows.length === 1 ? 'showtime' : 'showtimes'}</span>
                <span><MonitorPlay size={15} /> {new Set(movieShows.map((show) => show.screen_name)).size} {new Set(movieShows.map((show) => show.screen_name)).size === 1 ? 'screen' : 'screens'}</span>
              </div>
            </div>
          </header>

          {invalidSelection && (
            <div className="selection-alert" role="alert">
              <strong>That showtime isn’t available.</strong>
              <span>The selected show ID is invalid or no longer belongs to this movie. Choose a current showtime below.</span>
            </div>
          )}
          {!selectedShow && !invalidSelection && (
            <div className="selection-alert selection-alert--info" role="status">
              <strong>No showtime selected.</strong>
              <span>Choose a scheduled showtime to continue to seat selection.</span>
            </div>
          )}

          <section className="movie-show-selection" aria-labelledby="show-selection-title">
            <div className="movie-show-selection__heading">
              <div>
                <p className="eyebrow eyebrow--muted">PLAN YOUR VISIT</p>
                <h2 id="show-selection-title">Choose a <em>showtime.</em></h2>
              </div>
              <span className="movie-show-selection__count">{availableDates.length} {availableDates.length === 1 ? 'DATE' : 'DATES'} LISTED</span>
            </div>

            <ShowDateFilters
              shows={movieShows}
              selectedDate={effectiveDate}
              onSelectDate={selectDate}
            />

            <div className="show-date-groups">
              {dateGroups.length > 0 ? (
                dateGroups.map(({ date, shows: dateShows }) => (
                  <section className="show-date-group" key={date} aria-label={`Showtimes for ${formatFullShowDate(dateShows[0].starts_at)}`}>
                    <div className="show-date-group__heading">
                      <CalendarDays size={16} aria-hidden="true" />
                      <h3>{formatFullShowDate(dateShows[0].starts_at)}</h3>
                    </div>
                    <div className="showtime-options" role="group" aria-label={`Select a showtime for ${formatFullShowDate(dateShows[0].starts_at)}`}>
                      {dateShows.map((show) => {
                        const isSelected = selectedShow?.id === show.id
                        return (
                          <button
                            className={`showtime-option${isSelected ? ' showtime-option--selected' : ''}`}
                            key={show.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => selectShow(show)}
                          >
                            <span className="showtime-option__time">{formatShowTime(show.starts_at)}</span>
                            <span className="showtime-option__screen"><MonitorPlay size={14} aria-hidden="true" /> {show.screen_name}</span>
                            <span className="showtime-option__choice">{isSelected ? 'Selected' : 'Select'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <div className="empty-listing details-empty-date">
                  <CalendarDays size={23} aria-hidden="true" />
                  <h3>No showtimes on this date.</h3>
                  <p>Choose another listed date to see its screenings.</p>
                </div>
              )}
            </div>

            <aside className="selected-show-panel" aria-live="polite">
              <div className="selected-show-panel__icon"><Armchair size={19} aria-hidden="true" /></div>
              <div className="selected-show-panel__copy">
                <span>YOUR SELECTED SHOW</span>
                {selectedShow ? (
                  <>
                    <strong>{selectedShow.movie_title}</strong>
                    <p>{formatFullShowDate(selectedShow.starts_at)} · {formatShowTime(selectedShow.starts_at)} · {selectedShow.screen_name}</p>
                  </>
                ) : (
                  <p>No showtime selected yet.</p>
                )}
              </div>
              <Button disabled={!selectedShow} onClick={continueToSeats}>
                Continue to seat selection <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </aside>
          </section>
        </>
      )}
    </PageContainer>
  )
}
