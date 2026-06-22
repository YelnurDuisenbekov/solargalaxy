import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isWarehouseStaff, WAREHOUSE_FORBIDDEN_PATHS } from '../config/navLinks';

export function WarehouseRouteGuard({ children }) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  if (isWarehouseStaff(user, isAdmin)) {
    const path = location.pathname;
    if (WAREHOUSE_FORBIDDEN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
      return <Navigate to="/app" replace />;
    }
  }

  return children;
}
