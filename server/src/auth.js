import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export function signToken(payload, secret) {
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/** 與前端一致的註冊驗證；不通過時 throw Error(message)。 */
export function validateRegistration({ name, email, password }) {
  if (!name || !name.trim()) throw new Error('請輸入姓名');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((email || '').trim().toLowerCase())) {
    throw new Error('Email 格式不正確');
  }
  if ((password || '').length < MIN_PASSWORD_LENGTH) throw new Error(`密碼至少需 ${MIN_PASSWORD_LENGTH} 碼`);
}

/** 移除敏感欄位（密碼雜湊）後的使用者物件。 */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    preferences: user.preferences ?? {},
    // 管理者停用的帳號（Sprint 11）：不能登入、不收通知信、不出現在教練的成員搜尋。
    disabled: Boolean(user.disabled),
    // 隱私權政策同意紀錄（Sprint 12）：沒有＝還沒同意過，登入後前端會先要求同意。
    consent: user.consent ? { version: user.consent.version, acceptedAt: user.consent.acceptedAt } : null,
  };
}
