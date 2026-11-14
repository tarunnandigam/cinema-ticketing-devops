import { useMemo, useState } from 'react'
import { CalendarDays, Search, X } from 'lucide-react'
import { Button } from '../components/common/Button'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { Loading } from '../components/common/Loading'
import { PageContainer } from '../components/common/PageContainer'
import { MovieCard } from '../components/movies/MovieCard'
import { ShowDateFilters } from '../components/movies/ShowDateFilters'
import { useShows } from '../hooks/useShows'
import { groupShowsByMovie, isShowOnDate } from '../utils/shows'

export function Movies() {
  const { shows, loading, error, retry } = useShows()
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const filteredMovies = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    const filteredShows = shows.filter((show) => isShowOnDate(show, selectedDate))

    return groupShowsByMovie(filteredShows).filter((movie) =>
      movie.title.toLocaleLowerCase().includes(normalizedSearch),
    )
  }, [shows, selectedDate, search])

  return (
    <PageContainer className="movies-page">
      <header className="movies-page__header">
        <div>
          <p className="eyebrow"><span className="eyebrow__dot" /> THE BIG SCREEN</p>
          <h1>Find your <em>film.</em></h1>
          <p className="movies-page__lede">Explore the current schedule and find a showing that fits your evening.</p>
        </div>
        <div className="movies-page__seal" aria-hidden="true">
          <span className="movies-page__seal-icon"><CalendarDays size={20} strokeWidth={1.2} /></span>
          <span>THE<br />CURRENT<br />PICTURE</span>
        </div>
      </header>

      <div className="movie-controls">
        <label className="movie-search">
          <Search size={17} aria-hidden="true" />
          <span className="visually-hidden">Search movies by title</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search movie titles"
            disabled={loading || Boolean(error)}
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </label>
        {!loading && !error && (
          <ShowDateFilters
            shows={shows}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
      </div>

      {loading && <Loading label="Loading current movie listings…" />}
      {error && (
        <div className="listing-state">
          <ErrorMessage title="We couldn’t load the movie listings" message={error} />
          <Button variant="secondary" onClick={retry}>Try again</Button>
        </div>
      )}
      {!loading && !error && shows.length === 0 && (
        <div className="empty-listing empty-listing--movies">
          <CalendarDays size={23} aria-hidden="true" />
          <h2>No showtimes are listed right now.</h2>
          <p>Check back soon for the next screening schedule.</p>
        </div>
      )}
      {!loading && !error && shows.length > 0 && filteredMovies.length === 0 && (
        <div className="empty-listing empty-listing--movies">
          <Search size={23} aria-hidden="true" />
          <h2>No films match those filters.</h2>
          <p>Try another title or choose a different date.</p>
          {(search || selectedDate) && (
            <Button
              variant="quiet"
              onClick={() => {
                setSearch('')
                setSelectedDate(null)
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
      {!loading && !error && filteredMovies.length > 0 && (
        <>
          <div className="movie-results-meta" aria-live="polite">
            <span>{filteredMovies.length} {filteredMovies.length === 1 ? 'film' : 'films'}</span>
            <span>SHOWTIMES FROM THE LIVE SCHEDULE</span>
          </div>
          <div className="movie-grid" aria-live="polite">
            {filteredMovies.map((movie) => <MovieCard key={movie.title} movie={movie} />)}
          </div>
        </>
      )}
    </PageContainer>
  )
}
