import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyPassword, publicUser } from '../auth.js';
import { auditLog, asyncHandler } from '../lib/helpers.js';
import { requestDeletion, cancelDeletion, exportUserData, SELF_SERVICE_ROLES, DELETION_GRACE_MS } from '../lib/accountDeletion.js';

// 本人的資料權利（Sprint 39）：下載我的資料、申請刪除帳號（7 天內可取消）。
export function createMeRouter({ db, requireAuth }) {
  const router = Router();
  // 申請刪除要輸入密碼：限制嘗試次數，避免被拿來猜密碼。
  const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.AUTH_RATE_LIMIT ? Number(process.env.AUTH_RATE_LIMIT) : 10, standardHeaders: true, legacyHeaders: false, message: { code: 'RATE_LIMIT', error: '請求過於頻繁，請稍後再試' } });

  router.get('/me/export', requireAuth, (req, res) => {
    const data = exportUserData(db, req.user);
    auditLog(req, 'export_my_data');
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="my-data-${day}.json"`);
    res.json(data);
  });

  router.post('/me/deletion', requireAuth, limit, asyncHandler(async (req, res) => {
    const user = req.user;
    if (user.deletionScheduledFor) return res.json({ user: publicUser(user) });
    if (!SELF_SERVICE_ROLES.has(user.role)) {
      return res.status(409).json({ code: 'ROLE_NOT_SELF_SERVICE', error: '教練與管理者的帳號牽涉班級資料，請聯絡平台管理者處理。' });
    }
    if (!(await verifyPassword(req.body?.password, user.passwordHash))) {
      return res.status(400).json({ code: 'WRONG_PASSWORD', error: '密碼不正確' });
    }
    requestDeletion(db, user);
    auditLog(req, 'request_account_deletion', { scheduledFor: user.deletionScheduledFor, graceDays: DELETION_GRACE_MS / 864e5 });
    res.json({ user: publicUser(user) });
  }));

  router.post('/me/deletion/cancel', requireAuth, (req, res) => {
    if (req.user.deletionScheduledFor) {
      cancelDeletion(db, req.user);
      auditLog(req, 'cancel_account_deletion');
    }
    res.json({ user: publicUser(req.user) });
  });

  return router;
}
