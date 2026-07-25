import express from 'express';
import cookieParser from 'cookie-parser';
import { createAuthContext } from './lib/authContext.js';
import { createAssessmentsRouter } from './routes/assessments.js';
import { createAuthRouter } from './routes/auth.js';
import { createSubmissionsRouter } from './routes/submissions.js';
import { createAdminRouter } from './routes/admin.js';
import { createCoachRouter } from './routes/coach.js';
import { createGroupsRouter } from './routes/groups.js';
import { createChatRouter } from './routes/chat.js';

export {
  sanitizeFocusDimensionIds,
  sanitizeTargetHeadcount,
  sanitizeDimensionNotes,
} from './lib/helpers.js';

/**
 * 建立 Express app（不啟動監聽），方便測試直接以 supertest 注入。
 * @param {{db, jwtSecret:string, secureCookies?:boolean}} opts
 */
export function createApp({ db, jwtSecret, secureCookies = false }) {
  if (!jwtSecret) throw new Error('createApp 需要 jwtSecret');

  const app = express();
  app.use(express.json({ limit: '512kb' }));
  app.use(cookieParser());

  const { requireAuth, requireAdmin, requireCoach, setAuthCookie, COOKIE_NAME } =
    createAuthContext({ db, jwtSecret, secureCookies });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api', createAssessmentsRouter({ db, requireAuth }));
  app.use('/api', createAuthRouter({ db, requireAuth, setAuthCookie, COOKIE_NAME }));
  app.use('/api', createSubmissionsRouter({ db, requireAuth, requireCoach }));
  app.use('/api', createGroupsRouter({ db, requireAuth }));
  app.use('/api', createChatRouter({ requireAuth }));
  // admin/coach 各自的 router 用 router.use() 統一掛驗證中介層，故須掛在專屬前綴下，
  // 否則會攔截同樣掛在 /api 的其他路由（例如非 admin 使用者呼叫 /api/coach/* 會先被
  // admin router 的 requireAdmin 擋下）。
  app.use('/api/admin', createAdminRouter({ db, requireAuth, requireAdmin }));
  app.use('/api/coach', createCoachRouter({ db, requireAuth, requireCoach }));

  // ── 全域錯誤處理 ───────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err.stack ?? err.message ?? err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ code: err.code || 'SERVER_ERROR', error: err.message || '伺服器錯誤' });
  });

  return app;
}
