import { ArrowUpRight, Film } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <Link className="brand brand--footer" to="/">
          <span className="brand__mark"><Film size={17} /></span>
          <span>Cinema<span className="brand__accent">Ticket</span></span>
        </Link>
        <p>A little more magic in your movie night.</p>
        <Link className="footer-top" to="/movies">
          Explore films <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <span className="site-footer__legal">© {new Date().getFullYear()} CinemaTicket</span>
      </div>
    </footer>
  )
}
