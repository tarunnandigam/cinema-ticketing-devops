import type { MovieGroup, Show } from '../types/movie'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
})

export function getShowDateKey(startsAt: string): string {
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

export function formatShowDate(startsAt: string): string {
  const date = new Date(startsAt)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date)
}

export function formatShowTime(startsAt: string): string {
  const date = new Date(startsAt)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : timeFormatter.format(date)
}

export function formatFullShowDate(startsAt: string): string {
  const date = new Date(startsAt)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : fullDateFormatter.format(date)
}

export function groupShowsByMovie(shows: Show[]): MovieGroup[] {
  const groups = new Map<string, Show[]>()

  for (const show of shows) {
    const current = groups.get(show.movie_title) ?? []
    current.push(show)
    groups.set(show.movie_title, current)
  }

  return Array.from(groups, ([title, movieShows]) => ({
    title,
    shows: movieShows.sort(
      (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    ),
  })).sort((left, right) => left.title.localeCompare(right.title))
}

export function getAvailableShowDates(shows: Show[]): string[] {
  return Array.from(
    new Set(shows.map((show) => getShowDateKey(show.starts_at)).filter(Boolean)),
  ).sort()
}

export function formatDateFilterLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`)
  return Number.isNaN(date.getTime()) ? dateKey : dateFormatter.format(date)
}

export function moviePathSegment(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function isShowOnDate(show: Show, dateKey: string | null): boolean {
  return dateKey === null || getShowDateKey(show.starts_at) === dateKey
}

export { fullDateFormatter }
