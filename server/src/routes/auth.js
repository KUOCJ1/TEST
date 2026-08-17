import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  validateRegistration,
  publicUser,
  MIN_PASSWORD_LENGTH,
} from '../auth.js';
import { asyncHandler, hashToken, revokeUserTokens } from '../lib/helpers.js';
import { findGroupByJoinCode, joinGroupByCode } from '../lib/joinCode.js';

// register/login 回傳的「剛加入的班級」只給前端導頁需要的最小資訊，不含成員、
// 成績或其他班級設定——這支 API 在使用者剛登入的當下就會被讀到。
function joinedGroupInfo(group) {
  if (!group) return null;
  return { id: group.id, name: group.name, companyName: group.companyName || '', assessmentId: group.assessmentId };
}

// 將使用者 email 比對各班別的待加入名單；命中則自動轉為正式成員。
function claimPendingGroups(db, user) {
  let changed = false;
  for (const g of db.data.groups ?? []) {
    const pending = g.pendingMembers ?? [];
    const idx = pending.findIndex((p) => p.email === user.email);
    if (idx >= 0) {
      if (!g.memberIds.includes(user.id)) g.memberIds.push(user.id);
      pending.splice(idx, 1);
      g.pendingMembers = pending;
      changed = true;
    }
  }
  if (changed) db.persist();
}

/** @param {{db, requireAuth, setAuthCookie, COOKIE_NAME}} deps */
export function createAuthRouter({ db, requireAuth, setAuthCookie, COOKIE_NAME }) {
  const router = Router();

  // Rate limit for auth endpoints — 10 attempts per 5 minutes per IP, or 100 when
  // the request carries a joinCode that actually matches an open class (QR報到情境：
  // 一整班學員很可能共用同一個 NAT/Wi-Fi 出口 IP，10 次的額度第 11 個人就會卡住)。
  // 放寬額度仍是有界的，且只有「持有教練發出、尚未撤銷的代碼」才適用，而代碼本身
  // 隨時可由教練撤銷。
  // Created fresh per router instance (not module-level) so each createApp()
  // call — notably each test's own app — gets an independent counter.
  const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: (req) => (findGroupByJoinCode(db, req.body?.joinCode) ? 100 : 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '請求過於頻繁，請稍後再試' },
  });

  // Hash password BEFORE checking for duplicate email so the synchronous
  // check+push+persist block has no await (atomic under Node.js single thread).
  router.post('/auth/register', authLimiter, asyncHandler(async (req, res) => {
    const { name, email, password, joinCode } = req.body || {};
    try {
      validateRegistration({ name, email, password });
    } catch (e) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: e.message });
    }
    const normEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    if (db.data.users.some((u) => u.email === normEmail)) {
      return res.status(409).json({ code: 'EMAIL_TAKEN', error: '此 Email 已被註冊' });
    }
    const user = {
      id: randomUUID(),
      name: name.trim(),
      email: normEmail,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    db.data.users.push(user);
    db.persist();
    claimPendingGroups(db, user);
    // QR 報到：帶著有效代碼註冊時，直接加入該班級，前端才能立刻導去對應的評量。
    const joinedGroup = joinCode ? joinGroupByCode(db, user, joinCode) : null;
    setAuthCookie(res, user);
    res.status(201).json({ user: publicUser(user), joinedGroup: joinedGroupInfo(joinedGroup) });
  }));

  router.post('/auth/login', authLimiter, asyncHandler(async (req, res) => {
    const { email, password, joinCode } = req.body || {};
    const user = db.data.users.find((u) => u.email === (email || '').trim().toLowerCase());
    if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Email 或密碼錯誤' });
    }
    claimPendingGroups(db, user);
    // 既有學員重新掃碼加入新的一梯（例如回鍋上下一期課程）同樣適用。
    const joinedGroup = joinCode ? joinGroupByCode(db, user, joinCode) : null;
    setAuthCookie(res, user);
    res.json({ user: publicUser(user), joinedGroup: joinedGroupInfo(joinedGroup) });
  }));

  router.post('/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  router.patch('/auth/profile', requireAuth, (req, res) => {
    const { name, preferences } = req.body ?? {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: '姓名不可為空' });
      req.user.name = name.trim();
    }
    if (preferences !== undefined && preferences && typeof preferences === 'object') {
      req.user.preferences = { ...(req.user.preferences ?? {}), ...preferences };
    }
    db.persist();
    res.json({ user: publicUser(req.user) });
  });

  router.post('/auth/password', requireAuth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if ((newPassword || '').length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `新密碼至少需 ${MIN_PASSWORD_LENGTH} 碼` });
    }
    if (!(await verifyPassword(currentPassword || '', req.user.passwordHash))) {
      return res.status(401).json({ error: '目前密碼不正確' });
    }
    req.user.passwordHash = await hashPassword(newPassword);
    // 撤銷這個帳號目前所有已簽發的登入 token（例如外流的舊 cookie），
    // 再馬上為「這次請求本身」重發一份新 cookie，使用者不會被自己的操作登出。
    revokeUserTokens(req.user);
    db.persist();
    setAuthCookie(res, req.user);
    res.json({ ok: true });
  }));

  router.post('/auth/reset-password', asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body ?? {};
    if (!token || (newPassword || '').length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: `重設連結或新密碼不正確（密碼至少 ${MIN_PASSWORD_LENGTH} 碼）` });
    }
    const h = hashToken(token);
    const user = db.data.users.find(
      (u) => u.resetTokenHash === h && (u.resetTokenExpires || 0) > Date.now(),
    );
    if (!user) return res.status(400).json({ code: 'INVALID_RESET_TOKEN', error: '重設連結無效或已過期，請向管理員重新索取' });
    user.passwordHash = await hashPassword(newPassword);
    delete user.resetTokenHash;
    delete user.resetTokenExpires;
    // 重設密碼代表原密碼可能已外洩，順便撤銷這個帳號現有的所有登入 session。
    revokeUserTokens(user);
    db.persist();
    res.json({ ok: true });
  }));

  return router;
}
