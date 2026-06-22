import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authApi, usersApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(() => usersApi.me().then(setUser), []);

  useEffect(() => {
    const token = localStorage.getItem('sg_token');
    if (!token) { setLoading(false); return; }
    usersApi.me().then(setUser).catch(() => localStorage.removeItem('sg_token')).finally(() => setLoading(false));
  }, []);

  const login = async (loginName, password) => {
    const { token, user: u } = await authApi.login(loginName, password);
    if (!token || !u?.id) {
      throw new Error('Сервер API недоступен или вернул некорректный ответ');
    }
    localStorage.setItem('sg_token', token);
    setUser(u);
    return u;
  };

  const registerClient = async (body) => {
    const data = await authApi.registerClient(body);
    localStorage.setItem('sg_token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('sg_token');
    setUser(null);
  };

  const hasPerm = useCallback((key) => {
    if (!user?.permissions) return false;
    return user.permissions.includes('admin.full') || user.permissions.includes(key);
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    registerClient,
    logout,
    refreshUser,
    hasPerm,
    isAdmin: user?.role === 'ADMIN' || hasPerm('admin.full'),
    isDirector: user?.role === 'DIRECTOR',
    isManager: ['MANAGER', 'EMPLOYEE'].includes(user?.role),
    canClaimLeads: user?.role === 'MANAGER',
    isStaff: !['CLIENT', 'CONTRACTOR'].includes(user?.role) || user?.role === 'CONTRACTOR',
    isCrm: hasPerm('crm.view') || hasPerm('crm.view_all'),
    isErp: hasPerm('erp.view') || hasPerm('erp.view_all'),
    isWarehouse: hasPerm('warehouse.view') || hasPerm('warehouse.issue'),
    isWarehouseStaff: user?.role === 'WAREHOUSE' && !(user?.role === 'ADMIN' || hasPerm('admin.full')),
    isSupply: hasPerm('supply.view'),
    isAccountant: user?.role === 'ACCOUNTANT' || hasPerm('finance.view'),
    isContractor: user?.role === 'CONTRACTOR',
    isClient: user?.role === 'CLIENT',
    canManageUsers: hasPerm('users.view'),
    canManagePermissions: hasPerm('users.permissions'),
  }), [user, loading, hasPerm]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
