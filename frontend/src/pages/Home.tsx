import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Clapperboard,
  MoveUpRight,
  Popcorn,
  Search,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { Loading } from '../components/common/Loading'
import { PageContainer } from '../components/common/PageContainer'
import { MovieCard } from '../components/movies/MovieCard'
import { ShowDateFilters } from '../components/movies/ShowDateFilters'
import { useShows } from '../hooks/useShows'
import { groupShowsByMovie, isShowOnDate } from '../utils/shows'

export function Home() {
  const { shows, loading, error, retry } = useShows()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const visibleShows = useMemo(
    () => shows.filter((show) => isShowOnDate(show, selectedDate)),
    [shows, selectedDate],
  )
  const movies = useMemo(() => groupShowsByMovie(visibleShows), [visibleShows])

  return (
    <>
      <section className="home-hero">
        <PageContainer className="home-hero__grid">
          <div className="home-hero__copy">
            <p className="eyebrow"><span className="eyebrow__dot" /> YOUR SEAT IS WAITING</p>
            <h1>Make a night<br />of <em>it.</em></h1>
            <p className="home-hero__lede">
              The lights go down. The world gets bigger. Find your next story on the big screen.
            </p>
            <div className="home-hero__actions">
              <Link className="button button--primary" to="/movies">
                Explore movies <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a className="text-link" href="#now-showing">
                Browse showtimes <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
            <div className="home-hero__note">
              <span className="home-hero__note-icon"><Popcorn size={17} /></span>
              <span>Good stories. Great company. No rush.</span>
            </div>
          </div>

          <div className="hero-art" aria-label="Abstract cinema-inspired artwork" role="img">
            <div className="hero-art__orbit hero-art__orbit--one" />
            <div className="hero-art__orbit hero-art__orbit--two" />
            <div className="hero-art__moon" />
            <div className="hero-art__beam" />
            <div className="hero-art__screen">
              <span className="hero-art__screen-label">A GOOD NIGHT OUT</span>
              <span className="hero-art__screen-title">The<br />big<br /><i>picture.</i></span>
              <Clapperboard className="hero-art__clapper" size={30} strokeWidth={1.1} />
            </div>
            <span className="hero-art__caption">EST. AFTER DARK&nbsp; · &nbsp;SEAT 01</span>
            <span className="hero-art__spark hero-art__spark--one">✳</span>
            <span className="hero-art__spark hero-art__spark--two">✳</span>
            <span className="hero-art__stamp">A STORY<br />WORTH<br />LEAVING<br />HOME FOR</span>
          </div>
          <div className="hero-side-note" aria-hidden="true"><span>THE SHOW STARTS HERE</span><MoveUpRight size={15} /></div>
        </PageContainer>
        <div className="home-hero__index" aria-hidden="true">01 / 04</div>
      </section>

      <section className="listing-section" id="now-showing">
        <PageContainer>
          <div className="listing-section__intro">
            <div>
              <p className="eyebrow"><span className="eyebrow__dot" /> ON THE BIG SCREEN</p>
              <h2>Now showing<span className="heading-period">.</span></h2>
            </div>
            <p>Real showtimes from the cinema schedule. Pick a date and see what’s playing.</p>
          </div>

          {!loading && !error && (
            <ShowDateFilters
              shows={shows}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}

          {loading && <Loading label="Finding what’s on…" />}
          {error && (
            <div className="listing-state">
              <ErrorMessage title="Showtimes didn’t load" message={error} />
              <Button variant="secondary" onClick={retry}>Try again</Button>
            </div>
          )}
          {!loading && !error && shows.length === 0 && (
            <div className="empty-listing">
              <CalendarDays size={23} aria-hidden="true" />
              <h3>No showtimes are listed right now.</h3>
              <p>Check back soon for the next screening schedule.</p>
            </div>
          )}
          {!loading && !error && shows.length > 0 && movies.length === 0 && (
            <div className="empty-listing">
              <CalendarDays size={23} aria-hidden="true" />
              <h3>No shows on this date.</h3>
              <p>Choose another date to see available listings.</p>
            </div>
          )}
          {!loading && !error && movies.length > 0 && (
            <div className="movie-grid" aria-live="polite">
              {movies.map((movie) => <MovieCard key={movie.title} movie={movie} />)}
            </div>
          )}
          {!loading && !error && movies.length > 0 && (
            <div className="listing-section__more">
              <span>{movies.length} {movies.length === 1 ? 'film' : 'films'} in this selection</span>
              <Link className="text-link" to="/movies">View all movies <ArrowRight size={15} /></Link>
            </div>
          )}
        </PageContainer>
      </section>

      <section className="experience-section" id="the-experience">
        <PageContainer>
          <div className="section-intro">
            <div>
              <p className="eyebrow eyebrow--muted">A BETTER WAY TO GO OUT</p>
              <h2>Leave the scrolling.<br /><em>Keep the feeling.</em></h2>
            </div>
            <p className="section-intro__aside">
              One place to browse the current schedule, compare showtimes, and make a plan for your movie night.
            </p>
          </div>
          <div className="experience-cards">
            <article className="experience-card experience-card--red">
              <span className="experience-card__number">01</span>
              <div className="experience-card__icon"><Search size={20} /></div>
              <h3>Find your film</h3>
              <p>Browse current listings and follow the story that catches your eye.</p>
            </article>
            <article className="experience-card experience-card--cream">
              <span className="experience-card__number">02</span>
              <div className="experience-card__icon"><CalendarDays size={20} /></div>
              <h3>Compare showtimes</h3>
              <p>See the scheduled dates, times, and screens in one clear view.</p>
            </article>
            <article className="experience-card experience-card--ink">
              <span className="experience-card__number">03</span>
              <div className="experience-card__icon"><Sparkles size={20} /></div>
              <h3>Make a night of it</h3>
              <p>Pick the showing that works for you and enjoy the big-screen moment.</p>
            </article>
          </div>
          <div className="section-action">
            <span>THE BEST PART STARTS BEFORE THE TRAILERS</span>
            <Button variant="quiet" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Back to the top <ArrowRight size={16} />
            </Button>
          </div>
        </PageContainer>
      </section>

      <section className="closing-band">
        <PageContainer className="closing-band__inner">
          <div>
            <p className="eyebrow">YOUR NEXT NIGHT OUT</p>
            <h2>Start with a <em>story.</em></h2>
          </div>
          <Link className="closing-band__link" to="/movies" aria-label="Browse movies">
            <ArrowRight size={22} />
          </Link>
        </PageContainer>
      </section>
    </>
  )
}
