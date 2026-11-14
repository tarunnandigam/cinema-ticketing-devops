export interface Show {
  id: string
  movie_title: string
  screen_name: string
  starts_at: string
}

export interface ShowsResponse {
  shows: Show[]
}

export interface MovieGroup {
  title: string
  shows: Show[]
}

export interface MovieRouteState {
  movieTitle: string
  showId: string
  startsAt: string
  screenName: string
}
