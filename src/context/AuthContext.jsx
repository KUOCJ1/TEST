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

function randomSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(salt, password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  });

  const login = useCallback(async (email, password) => {
    const users = loadUsers();
    const user = users.find(u => u.email === email);
    if (!user) throw new Error('Email 或密碼錯誤');

    let valid = false;
    if (typeof user.password === 'string') {
      // Legacy plaintext — compare and migrate on success
      valid = user.password === password;
      if (valid) {
        const salt = randomSalt();
        const hash = await sha256(salt, password);
        saveUsers(users.map(u => u.id === user.id ? { ...u, password: { hash, salt } } : u));
      }
    } else {
      valid = (await sha256(user.password.salt, password)) === user.password.hash;
    }

    if (!valid) throw new Error('Email 或密碼錯誤');
    const session = { id: user.id, name: user.name, email: user.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCurrentUser(session);
  }, []);

  const register = useCallback(async (name, email, password) => {
    const users = loadUsers();
    if (users.find(u => u.email === email)) throw new Error('此 Email 已被使用');
    const salt = randomSalt();
    const hash = await sha256(salt, password);
    const newUser = { id: generateId(), name, email, password: { hash, salt }, createdAt: new Date().toISOString() };
    saveUsers([...users, newUser]);
    const session = { id: newUser.id, name: newUser.name, email: newUser.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCurrentUser(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }, []);

  const updateProfile = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('名稱不能為空');
    const users = loadUsers();
    saveUsers(users.map(u => u.id === currentUser.id ? { ...u, name: trimmed } : u));
    const session = { ...currentUser, name: trimmed };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCurrentUser(session);
  }, [currentUser]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const users = loadUsers();
    const user = users.find(u => u.id === currentUser.id);
    if (!user) throw new Error('找不到使用者');
    const valid = typeof user.password === 'string'
      ? user.password === currentPassword
      : (await sha256(user.password.salt, currentPassword)) === user.password.hash;
    if (!valid) throw new Error('目前密碼不正確');
    const salt = randomSalt();
    const hash = await sha256(salt, newPassword);
    saveUsers(users.map(u => u.id === currentUser.id ? { ...u, password: { hash, salt } } : u));
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
