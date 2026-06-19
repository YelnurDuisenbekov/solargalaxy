import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './PublicLayout.css';

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="container public-header__inner">
          <Link to="/" className="public-logo">Solar <span>Galaxy</span></Link>
          <nav className="public-nav">
            <Link to="/about">О компании</Link>
            <Link to="/services">Услуги</Link>
            <Link to="/contact">Контакты</Link>
            {user ? (
              <>
                <Link to="/app" className="public-nav__app">Кабинет</Link>
                <button type="button" className="btn btn--dark" onClick={() => { logout(); navigate('/'); }}>Выйти</button>
              </>
            ) : (
              <Link to="/login" className="btn btn--primary">Войти</Link>
            )}
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="public-footer">
        <div className="container">© {new Date().getFullYear()} Solar Galaxy — солнечная энергетика Казахстана</div>
      </footer>
    </div>
  );
}
