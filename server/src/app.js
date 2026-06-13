import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  validateRegistration,
  publicUser,
} from './auth.js';

const COOKIE_NAME = 'aiassess_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * 建立 Express app（不啟動監聽），方便測試直接以 supertest 注入。
 * @param {{db, jwtSecret:string, secureCookies?:boolean}} opts
 */
export function createApp({ db, jwtSecret, secureCookies = false }) {
  if (!jwtSecret) throw new Error('createApp 需要 jwtSecret');

  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  function setAuthCookie(res, user) {
    res.cookie(COOKIE_NAME, signToken({ sub: user.id }, jwtSecret), {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      maxAge: COOKIE_MAX_AGE,
    });
  }

  function currentUser(req) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;
    const payload = verifyToken(token, jwtSecret);
    if (!payload) return null;
    return db.data.users.find((u) => u.id === payload.sub) || null;
  }

  function requireAuth(req, res, next) {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: '尚未登入' });
    req.user = user;
    next();
  }

  function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理員權限' });
    next();
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ── 認證 ────────────────────────────────────────────────
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    try {
      validateRegistration({ name, email, password });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const normEmail = email.trim().toLowerCase();
    if (db.data.users.some((u) => u.email === normEmail)) {
      return res.status(409).json({ error: '此 Email 已被註冊' });
    }
    const user = {
      id: randomUUID(),
      name: name.trim(),
      email: normEmail,
      passwordHash: await hashPassword(password),
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    db.data.users.push(user);
    db.persist();
    setAuthCookie(res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const user = db.data.users.find((u) => u.email === (email || '').trim().toLowerCase());
    if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Email 或密碼錯誤' });
    }
    setAuthCookie(res, user);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  // ── 作答 ────────────────────────────────────────────────
  app.post('/api/submissions', requireAuth, (req, res) => {
    const { answers, result } = req.body || {};
    if (!result || typeof result.total !== 'number' || !Array.isArray(result.dimensions)) {
      return res.status(400).json({ error: '作答結果格式不正確' });
    }
    const record = {
      id: randomUUID(),
      userId: req.user.id,
      userName: req.user.name,
      createdAt: new Date().toISOString(),
      answers: answers && typeof answers === 'object' ? answers : {},
      result,
    };
    db.data.submissions.push(record);
    db.persist();
    res.status(201).json({ submission: record });
  });

  app.get('/api/submissions/me', requireAuth, (req, res) => {
    const mine = db.data.submissions
      .filter((s) => s.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ submissions: mine });
  });

  // ── 管理後台 ────────────────────────────────────────────
  app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
    res.json({
      users: db.data.users.map(publicUser),
      submissions: db.data.submissions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: s.userName,
        createdAt: s.createdAt,
        result: s.result,
      })),
    });
  });

  return app;
}
