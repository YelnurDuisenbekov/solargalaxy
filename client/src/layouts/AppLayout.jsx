import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AppLayout.css';

const staffLinks = [
  { to: '/app', label: 'Обзор', end: true },
  { to: '/app/crm', label: 'CRM' },
  { to: '/app/warehouse', label: 'Склад' },
];

export default function AppLayout() {
  const { user, logout, isAdmin, isStaff } = useAuth();
  const navigate = useNavigate();

  const links = isStaff
    ? [...staffLinks, ...(isAdmin ? [{ to: '/app/users', label: 'Пользователи' }] : [])]
    : [{ to: '/app/portal', label: 'Мой кабинет', end: true }];

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">Solar<span>Galaxy</span></div>
        <p className="app-sidebar__user">{user?.fullName}</p>
        <span className="app-sidebar__role">{user?.role}</span>
        <nav className="app-sidebar__nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `app-sidebar__link${isActive ? ' active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="app-sidebar__logout" onClick={() => { logout(); navigate('/'); }}>Выйти</button>
      </aside>
      <main className="app-main"><Outlet /></main>
    </div>
  );
}
