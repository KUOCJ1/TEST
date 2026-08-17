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
/**
 * @param {{db, jwtSecret:string, secureCookies?:boolean, trustProxy?:number}} opts
 */
export function createApp({ db, jwtSecret, secureCookies = false, trustProxy = 0 }) {
  if (!jwtSecret) throw new Error('createApp 需要 jwtSecret');

  const app = express();

  // 本站架構為 Traefik → Nginx → 這支 Express（VPS 上兩層反向代理，皆走 loopback，
  // Nginx 用 $proxy_add_x_forwarded_for 把自己的位址「附加」在 X-Forwarded-For 後面）。
  // Express 預設完全不信任代理標頭，req.ip 會固定拿到 Nginx 自己的位址（127.0.0.1），
  // 讓所有請求在 rate limiter 眼中都是「同一個 IP」——註冊/登入的限流因此形同全站
  // 共用一份額度，而非每人一份。設成正確的信任層數，req.ip 才會是真實使用者位址。
  // 本機開發／測試沒有代理，預設 0（完全不信任，維持 Express 內建安全預設值）；
  // VPS 部署務必用 TRUST_PROXY 環境變數明確設定，且部署後要從外部網路實際驗證
  // 讀到的是使用者真實 IP——設太高會讓偽造的 X-Forwarded-For 被當真、形同繞過限流，
  // 設太低則限流仍然全站共用，兩者都不能單憑猜測層數就上線。
  app.set('trust proxy', trustProxy);

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
