import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';
import Home from './pages/public/Home';
import About from './pages/public/About';
import Services from './pages/public/Services';
import Contact from './pages/public/Contact';
import Login from './pages/public/Login';
import Dashboard from './pages/app/Dashboard';
import CrmPage from './pages/app/CrmPage';
import WarehousePage from './pages/app/WarehousePage';
import UsersPage from './pages/app/UsersPage';
import ClientPortal from './pages/app/ClientPortal';

function ProtectedRoute({ children, staffOnly, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ padding: 40 }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/app" replace />;
  if (staffOnly && !['ADMIN', 'EMPLOYEE'].includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="services" element={<Services />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
      </Route>

      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="crm" element={<ProtectedRoute staffOnly><CrmPage /></ProtectedRoute>} />
        <Route path="warehouse" element={<ProtectedRoute staffOnly><WarehousePage /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        <Route path="portal" element={<ClientPortal />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
