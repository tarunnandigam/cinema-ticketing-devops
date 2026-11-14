import { Route, Routes } from 'react-router-dom'
import { Footer } from './components/layout/Footer'
import { Navbar } from './components/layout/Navbar'
import { BookingStep } from './pages/BookingStep'
import { ReservationConfirmation } from './pages/ReservationConfirmation'
import { Home } from './pages/Home'
import { MovieDetails } from './pages/MovieDetails'
import { Movies } from './pages/Movies'
import { MyBookings } from './pages/MyBookings'
import { SeatSelection } from './pages/SeatSelection'

export default function App() {
  return (
    <div className="app-shell min-h-screen">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:movieId" element={<MovieDetails />} />
          <Route path="/shows/:showId/seats" element={<SeatSelection />} />
          <Route path="/booking/review" element={<BookingStep />} />
          <Route path="/booking/confirmation/:bookingReference" element={<ReservationConfirmation />} />
          <Route path="/bookings" element={<MyBookings />} />
          <Route path="*" element={<Movies />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
