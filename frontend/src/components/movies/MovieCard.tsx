import { ArrowUpRight, Clapperboard, MonitorPlay } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MovieGroup, MovieRouteState } from '../../types/movie'
import { formatShowDate, formatShowTime, moviePathSegment } from '../../utils/shows'

interface MovieCardProps {
  movie: MovieGroup
}

export function MovieCard({ movie }: MovieCardProps) {
  const moviePath = `/movies/${encodeURIComponent(moviePathSegment(movie.title))}`

  const movieLink = (show: MovieGroup['shows'][number]) => ({
    pathname: moviePath,
    search: `?showId=${encodeURIComponent(show.id)}`,
    state: {
      movieTitle: movie.title,
      showId: show.id,
      startsAt: show.starts_at,
      screenName: show.screen_name,
    } satisfies MovieRouteState,
  })

  return (
    <article className="movie-card">
      <div className="movie-card__art" aria-hidden="true">
        <div className="movie-card__reel"><Clapperboard size={35} strokeWidth={1.15} /></div>
        <span className="movie-card__index">NOW SHOWING</span>
        <span className="movie-card__frame-mark">CT&nbsp; / &nbsp;01</span>
      </div>
      <div className="movie-card__body">
        <Link className="movie-card__title" to={movieLink(movie.shows[0])}>
          <span>{movie.title}</span>
          <ArrowUpRight aria-hidden="true" size={18} />
        </Link>
        <div className="movie-card__showtimes">
          <p className="movie-card__showtimes-label">AVAILABLE SHOWTIMES</p>
          {movie.shows.map((show) => (
            <Link
              className="showtime-link"
              key={show.id}
              to={movieLink(show)}
              aria-label={`${movie.title}, ${formatShowDate(show.starts_at)} at ${formatShowTime(show.starts_at)}, ${show.screen_name}`}
            >
              <span className="showtime-link__when">
                <span>{formatShowDate(show.starts_at)}</span>
                <strong>{formatShowTime(show.starts_at)}</strong>
              </span>
              <span className="showtime-link__screen">
                <MonitorPlay size={13} aria-hidden="true" /> {show.screen_name}
              </span>
              <ArrowUpRight className="showtime-link__arrow" size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </article>
  )
}
