import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureSeed,
  register,
  login,
  logout,
  getSessionUser,
  listUsers,
  DEMO_ADMIN_PASSWORD,
} from '../survey/auth/authStore';

beforeEach(() => {
  localStorage.clear();
});

describe('authStore', () => {
  it('ensureSeed 建立唯一的管理員帳號（可重複呼叫）', () => {
    ensureSeed();
    ensureSeed();
    const admins = listUsers().filter((u) => u.role === 'admin');
    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe('admin@demo.tw');
  });

  it('管理員可用示範密碼登入並帶有 admin 角色', () => {
    ensureSeed();
    const u = login({ email: 'admin@demo.tw', password: DEMO_ADMIN_PASSWORD });
    expect(u.role).toBe('admin');
    expect(u).not.toHaveProperty('password'); // 不外洩雜湊
  });

  it('註冊後即為登入狀態，且密碼以雜湊儲存', () => {
    const u = register({ name: '王小美', email: 'mei@example.com', password: 'secret1' });
    expect(u.role).toBe('user');
    expect(getSessionUser().email).toBe('mei@example.com');
    const stored = listUsers().find((x) => x.email === 'mei@example.com');
    expect(stored.password).not.toBe('secret1');
  });

  it('阻擋重複 Email、不合法 Email 與過短密碼', () => {
    register({ name: 'A', email: 'dup@example.com', password: 'abcdef' });
    expect(() => register({ name: 'B', email: 'dup@example.com', password: 'abcdef' })).toThrow(/已被註冊/);
    expect(() => register({ name: 'C', email: 'bad', password: 'abcdef' })).toThrow(/格式/);
    expect(() => register({ name: 'D', email: 'd@e.co', password: '123' })).toThrow(/至少/);
  });

  it('密碼錯誤無法登入；logout 清除 session', () => {
    register({ name: 'Z', email: 'z@example.com', password: 'abcdef' });
    logout();
    expect(getSessionUser()).toBeNull();
    expect(() => login({ email: 'z@example.com', password: 'wrong' })).toThrow(/錯誤/);
    expect(login({ email: 'z@example.com', password: 'abcdef' }).name).toBe('Z');
  });
});
