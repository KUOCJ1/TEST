import { useCallback, useMemo, useState } from 'react';
import * as authStore from './authStore';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
  // 惰性初始化：載入時確保管理員種子帳號存在，並還原既有登入狀態。
  const [user, setUser] = useState(() => {
    authStore.ensureSeed();
    return authStore.getSessionUser();
  });

  const register = useCallback((payload) => {
    const u = authStore.register(payload);
    setUser(u);
    return u;
  }, []);

  const login = useCallback((payload) => {
    const u = authStore.login(payload);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authStore.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready: true, isAdmin: user?.role === 'admin', register, login, logout }),
    [user, register, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
