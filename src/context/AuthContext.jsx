import { createContext, useContext, useState, useCallback } from 'react';
import { generateId } from '../utils/calendar';

const AuthContext = createContext(null);

const USERS_KEY = 'cal_users';
const SESSION_KEY = 'cal_session';

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  });

  const login = useCallback((email, password) => {
    const user = loadUsers().find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Email 或密碼錯誤');
    const session = { id: user.id, name: user.name, email: user.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCurrentUser(session);
  }, []);

  const register = useCallback((name, email, password) => {
    const users = loadUsers();
    if (users.find(u => u.email === email)) throw new Error('此 Email 已被使用');
    const newUser = { id: generateId(), name, email, password, createdAt: new Date().toISOString() };
    saveUsers([...users, newUser]);
    const session = { id: newUser.id, name: newUser.name, email: newUser.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCurrentUser(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
