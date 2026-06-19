import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, usersApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sg_token');
    if (!token) { setLoading(false); return; }
    usersApi.me().then(setUser).catch(() => localStorage.removeItem('sg_token')).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { token, user: u } = await authApi.login(email, password);
    localStorage.setItem('sg_token', token);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('sg_token');
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout, isAdmin: user?.role === 'ADMIN', isStaff: ['ADMIN', 'EMPLOYEE'].includes(user?.role) }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
