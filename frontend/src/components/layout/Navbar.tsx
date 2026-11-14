import { useState } from 'react'
import { Film, Menu, TicketCheck, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'

const links = [
  { label: 'Home', to: '/' },
  { label: 'Movies', to: '/movies' },
  { label: 'My bookings', to: '/bookings' },
]

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>
          <span className="brand__mark"><Film size={18} strokeWidth={2.1} /></span>
          <span>Cinema<span className="brand__accent">Ticket</span></span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              end={link.to === '/'}
              to={link.to}
              className={({ isActive }) => cn('nav-link', isActive && 'nav-link--active')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <Link className="header-ticket" to="/movies">
          <TicketCheck size={16} aria-hidden="true" />
          <span>Find a film</span>
        </Link>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      <nav
        id="mobile-navigation"
        className={cn('mobile-nav', menuOpen && 'mobile-nav--open')}
        aria-label="Mobile navigation"
        hidden={!menuOpen}
      >
        {links.map((link) => (
          <NavLink
            key={link.to}
            end={link.to === '/'}
            to={link.to}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) => cn('mobile-nav__link', isActive && 'mobile-nav__link--active')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
