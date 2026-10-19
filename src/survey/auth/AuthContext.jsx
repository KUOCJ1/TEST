import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { AuthContext } from './useAuth';
import { readJSON, writeJSON, clearPersonalLocalData } from '../utils/storage';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // 初次載入時嘗試以既有 cookie 還原登入狀態。
  useEffect(() => {
    let active = true;
    api
      .session()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback(async (payload) => {
    const { user: u, joinedGroup } = await api.register(payload);
    setUser(u);
    return { user: u, joinedGroup: joinedGroup ?? null };
  }, []);

  const login = useCallback(async (payload) => {
    const { user: u, joinedGroup, inviteError } = await api.login(payload);
    setUser(u);
    // inviteError：帶邀請碼登入時邀請有問題（過期、Email 不符…）。登入本身成功，原因交給呼叫端顯示。
    return { user: u, joinedGroup: joinedGroup ?? null, inviteError: inviteError ?? null };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearPersonalLocalData();
      setUser(null);
    }
  }, []);

  const acceptPolicy = useCallback(async () => {
    const u = await api.acceptPolicy();
    setUser(u);
    return u;
  }, []);

  const setCompassManagerShare = useCallback(async (granted) => {
    const u = await api.setCompassManagerShare(granted);
    setUser(u);
    return u;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const u = await api.updateProfile(payload);
    setUser(u);
    return u;
  }, []);

  // 套用深色模式偏好（並在未登入時沿用上次設定）。
  useEffect(() => {
    // localStorage 在部分隱私模式／封鎖網站資料時會丟例外，這裡用安全包裝，避免整個 App 白屏。
    const dark = user?.preferences?.darkMode ?? String(readJSON('aiassess_dark', '0')) === '1';
    document.documentElement.classList.toggle('dark', Boolean(dark));
    if (user) writeJSON('aiassess_dark', dark ? '1' : '0');
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
      acceptPolicy,
      setCompassManagerShare,
    }),
    [user, ready, register, login, logout, updateProfile, acceptPolicy, setCompassManagerShare],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
