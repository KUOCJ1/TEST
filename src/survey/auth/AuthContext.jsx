import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // 初次載入時嘗試以既有 cookie 還原登入狀態。
  useEffect(() => {
    let active = true;
    api
      .me()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback(async (payload) => {
    const u = await api.register(payload);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(async (payload) => {
    const u = await api.login(payload);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const u = await api.updateProfile(payload);
    setUser(u);
    return u;
  }, []);

  // 套用深色模式偏好（並在未登入時沿用上次設定）。
  useEffect(() => {
    const dark = user?.preferences?.darkMode ?? (localStorage.getItem('aiassess_dark') === '1');
    document.documentElement.classList.toggle('dark', Boolean(dark));
    if (user) localStorage.setItem('aiassess_dark', dark ? '1' : '0');
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAdmin: user?.role === 'admin',
      isCoach: user?.role === 'coach' || user?.role === 'admin',
      register,
      login,
      logout,
      updateProfile,
    }),
    [user, ready, register, login, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
