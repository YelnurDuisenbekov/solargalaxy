import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { USER_ROLE } from '../utils/crmLabels';
import { CLIENT_NAV, getNavGroupsForUser } from '../config/navLinks';
import './AppLayout.css';
import '../pages/app/app-pages.css';

export default function AppLayout() {
  const { user, logout, isClient, hasPerm, isAdmin } = useAuth();
  const navigate = useNavigate();
  const navGroups = isClient ? null : getNavGroupsForUser({ user, hasPerm, isAdmin });

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Link to="/" className="app-sidebar__brand" title="На сайт (кабинет останется открыт)">
          <span className="app-sidebar__brand-text">
            <span className="app-sidebar__brand-name">SENERGY</span>
            <span className="app-sidebar__brand-tagline">CLEAN ENERGY SOLUTIONS</span>
          </span>
        </Link>
        <p className="app-sidebar__user">{user?.fullName}</p>
        <span className="app-sidebar__role">{USER_ROLE[user?.role] || user?.role}</span>

        <nav className="app-sidebar__nav">
          {isClient ? (
            CLIENT_NAV.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `app-sidebar__link${isActive ? ' active' : ''}`}
              >
                {l.label}
              </NavLink>
            ))
          ) : (
            navGroups.map((group) => (
              <div key={group.id} className={`app-sidebar__group app-sidebar__group--${group.id}`}>
                <div className="app-sidebar__group-head">
                  <span className="app-sidebar__group-badge">{group.label}</span>
                  {group.hint && <span className="app-sidebar__group-hint">{group.hint}</span>}
                </div>
                <div className="app-sidebar__group-links">
                  {group.links.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      end={l.end}
                      className={({ isActive }) => `app-sidebar__link${isActive ? ' active' : ''}`}
                    >
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))
          )}
        </nav>

        <button type="button" className="app-sidebar__logout" onClick={() => { logout(); navigate('/'); }}>
          Выйти
        </button>
      </aside>
      <main className="app-main"><Outlet /></main>
    </div>
  );
}
