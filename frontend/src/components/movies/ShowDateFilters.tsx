import { CalendarDays } from 'lucide-react'
import { formatDateFilterLabel, getAvailableShowDates } from '../../utils/shows'

interface ShowDateFiltersProps {
  shows: Parameters<typeof getAvailableShowDates>[0]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

export function ShowDateFilters({
  shows,
  selectedDate,
  onSelectDate,
}: ShowDateFiltersProps) {
  const dates = getAvailableShowDates(shows)

  if (dates.length === 0) return null

  return (
    <div className="show-date-filters" aria-label="Filter shows by date">
      <span className="show-date-filters__label">
        <CalendarDays size={15} aria-hidden="true" />
        Browse by date
      </span>
      <div className="show-date-filters__options" role="group" aria-label="Show date">
        <button
          className={`date-chip${selectedDate === null ? ' date-chip--active' : ''}`}
          type="button"
          aria-pressed={selectedDate === null}
          onClick={() => onSelectDate(null)}
        >
          All dates
        </button>
        {dates.map((date) => (
          <button
            className={`date-chip${selectedDate === date ? ' date-chip--active' : ''}`}
            key={date}
            type="button"
            aria-pressed={selectedDate === date}
            onClick={() => onSelectDate(date)}
          >
            {formatDateFilterLabel(date)}
          </button>
        ))}
      </div>
    </div>
  )
}
