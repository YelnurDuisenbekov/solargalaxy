import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { warmupApi } from '../api';
import FloatingQuoteButton from '../components/FloatingQuoteButton';
import './PublicLayout.css';

const NAV_LINKS = [
  { to: '/about', label: 'О компании' },
  { to: '/services', label: 'Услуги' },
  { to: '/contact', label: 'Контакты' },
];

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { warmupApi(); }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="container public-header__inner">
          <Link to="/" className="public-logo" onClick={closeMenu}>
            <span className="public-logo__text">
              <span className="public-logo__name">SENERGY</span>
              <span className="public-logo__tagline">CLEAN ENERGY SOLUTIONS</span>
            </span>
          </Link>

          <button
            type="button"
            className={`public-burger${menuOpen ? ' public-burger--open' : ''}`}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`public-nav${menuOpen ? ' public-nav--open' : ''}`}>
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={closeMenu}>{l.label}</Link>
            ))}
            {user ? (
              <>
                <Link to="/app" className="public-nav__app" onClick={closeMenu}>Кабинет</Link>
                <button
                  type="button"
                  className="btn btn--dark public-nav__btn"
                  onClick={() => { logout(); navigate('/'); closeMenu(); }}
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn--primary public-nav__btn" onClick={closeMenu}>
                Войти
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
      <FloatingQuoteButton />
      <footer className="public-footer">
        <div className="container public-footer__inner">
          <span>© {new Date().getFullYear()} Senergy — чистая энергия для Казахстана</span>
        </div>
      </footer>
    </div>
  );
}
