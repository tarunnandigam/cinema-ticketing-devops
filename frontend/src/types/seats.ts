export type SeatStatus = 'available' | 'held' | 'booked'

export interface ShowSeat {
  seat_id: string
  seat_number: string
  status: SeatStatus
}

export interface ShowSeatMap {
  showId: string
  seats: ShowSeat[]
}
