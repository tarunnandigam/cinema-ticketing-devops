import type { ShowSeat } from '../../types/seats'

interface SeatMapProps {
  seats: ShowSeat[]
  selectedSeatIds: ReadonlySet<string>
  onToggleSeat: (seat: ShowSeat) => void
}

interface SeatRow {
  label: string
  seats: ShowSeat[]
}

function groupSeatsByRow(seats: ShowSeat[]): SeatRow[] {
  const rows = new Map<string, ShowSeat[]>()

  for (const seat of seats) {
    const rowLabel = seat.seat_number.match(/^([a-z]+)/i)?.[1]?.toUpperCase() ?? ''
    const row = rows.get(rowLabel) ?? []
    row.push(seat)
    rows.set(rowLabel, row)
  }

  return Array.from(rows, ([label, rowSeats]) => ({ label, seats: rowSeats }))
}

function getSeatStatusLabel(status: ShowSeat['status']): string {
  switch (status) {
    case 'available':
      return 'Available'
    case 'held':
      return 'On hold'
    case 'booked':
      return 'Booked'
  }
}

export function SeatMap({ seats, selectedSeatIds, onToggleSeat }: SeatMapProps) {
  const rows = groupSeatsByRow(seats)

  return (
    <div className="seat-map" role="group" aria-label="Cinema seat map">
      <div className="seat-screen" aria-label="Screen at the front of the cinema">
        <span>SCREEN</span>
      </div>
      <div className="seat-map__rows">
        {rows.map((row, index) => (
          <div
            className="seat-row"
            key={row.label || `row-${index}`}
            role="group"
            aria-label={row.label ? `Row ${row.label}` : `Seat group ${index + 1}`}
          >
            <span className="seat-row__label" aria-hidden="true">{row.label}</span>
            <div className="seat-row__seats">
              {row.seats.map((seat) => {
                const selected = selectedSeatIds.has(seat.seat_id)
                const available = seat.status === 'available'
                const statusLabel = selected ? 'Selected' : getSeatStatusLabel(seat.status)

                return (
                  <button
                    className={`seat-button seat-button--${selected ? 'selected' : seat.status}`}
                    key={seat.seat_id}
                    type="button"
                    disabled={!available}
                    aria-pressed={selected}
                    aria-label={`Seat ${seat.seat_number}, ${statusLabel}`}
                    title={`${seat.seat_number} · ${statusLabel}`}
                    onClick={() => onToggleSeat(seat)}
                  >
                    <span>{seat.seat_number}</span>
                  </button>
                )
              })}
            </div>
            <span className="seat-row__label" aria-hidden="true">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
