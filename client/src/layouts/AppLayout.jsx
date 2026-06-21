import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { USER_ROLE } from '../utils/crmLabels';
import { APP_NAV_GROUPS, CLIENT_NAV } from '../config/navLinks';
import './AppLayout.css';
import '../pages/app/app-pages.css';

export default function AppLayout() {
  const { user, logout, isClient } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">Solar<span>Galaxy</span></div>
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
            APP_NAV_GROUPS.map((group) => (
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
