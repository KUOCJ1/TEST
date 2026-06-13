import { readJSON, writeJSON, removeKey, uid } from '../utils/storage';

// ⚠️ 純前端展示用帳號系統：資料存於瀏覽器 localStorage，密碼僅做輕量雜湊，
//    不具真實資安強度。正式環境請改接後端 API 與安全的密碼儲存。

const USERS_KEY = 'aiassess_users_v1';
const SESSION_KEY = 'aiassess_session_v1';

const SEED_ADMIN = {
  id: 'admin',
  name: '系統管理員',
  email: 'admin@demo.tw',
  role: 'admin',
};
export const DEMO_ADMIN_PASSWORD = 'admin1234';

function hashPassword(pw) {
  // djb2 變體：僅用於前端 demo，避免明碼直接存放。
  let h = 5381;
  for (let i = 0; i < pw.length; i += 1) {
    h = (h * 33) ^ pw.charCodeAt(i);
  }
  return `h${(h >>> 0).toString(16)}`;
}

function sanitize(user) {
  if (!user) return null;
  const { password: _password, ...safe } = user;
  return safe;
}

export function listUsers() {
  return readJSON(USERS_KEY, []);
}

function persistUsers(users) {
  writeJSON(USERS_KEY, users);
}

/** 確保管理員種子帳號存在（首次載入時呼叫）。 */
export function ensureSeed() {
  const users = listUsers();
  if (!users.some((u) => u.role === 'admin')) {
    users.push({
      ...SEED_ADMIN,
      password: hashPassword(DEMO_ADMIN_PASSWORD),
      createdAt: new Date().toISOString(),
    });
    persistUsers(users);
  }
}

export function register({ name, email, password }) {
  const cleanName = (name || '').trim();
  const normEmail = (email || '').trim().toLowerCase();
  if (!cleanName) throw new Error('請輸入姓名');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail)) throw new Error('Email 格式不正確');
  if ((password || '').length < 6) throw new Error('密碼至少需 6 碼');

  const users = listUsers();
  if (users.some((u) => u.email === normEmail)) throw new Error('此 Email 已被註冊');

  const user = {
    id: uid('u'),
    name: cleanName,
    email: normEmail,
    password: hashPassword(password),
    role: 'user',
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  persistUsers(users);
  setSession(user.id);
  return sanitize(user);
}

export function login({ email, password }) {
  const normEmail = (email || '').trim().toLowerCase();
  const user = listUsers().find((u) => u.email === normEmail);
  if (!user || user.password !== hashPassword(password)) {
    throw new Error('Email 或密碼錯誤');
  }
  setSession(user.id);
  return sanitize(user);
}

export function setSession(id) {
  writeJSON(SESSION_KEY, id);
}

export function logout() {
  removeKey(SESSION_KEY);
}

export function getSessionUser() {
  const id = readJSON(SESSION_KEY, null);
  if (!id) return null;
  return sanitize(listUsers().find((u) => u.id === id));
}
