import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getGroupPhase } from '../lib/helpers.js';
import { findGroupByJoinCode } from '../lib/joinCode.js';

/**
 * 完全不需要登入的公開查詢端點。QR 報到連結在使用者登入/註冊前就要先顯示
 * 「您正在加入哪個班級」，所以必須存在一個 requireAuth 之外的查詢路徑——
 * 但也因此格外要小心絕對不能洩漏成員名單、成績或任何非公開資訊，只回傳
 * 班級與評量的顯示用資訊。
 *
 * @param {{db}} deps
 */
export function createPublicRouter({ db }) {
  const router = Router();

  // 防止暴力枚舉報到代碼。每個 createApp() 各自建立一份，維持與其他 limiter
  // 一致的慣例（測試互不干擾）。
  const joinLookupLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '請求過於頻繁，請稍後再試' },
  });

  router.get('/join/:code', joinLookupLimiter, (req, res) => {
    const group = findGroupByJoinCode(db, req.params.code);
    if (!group) return res.status(404).json({ code: 'INVALID_CODE', error: '報到連結無效或已失效，請向講師確認' });
    const assessment = (db.data.assessments ?? []).find((a) => a.id === group.assessmentId);
    res.json({
      groupName: group.name,
      companyName: group.companyName || '',
      assessmentId: group.assessmentId,
      assessmentName: assessment?.name ?? group.assessmentId,
      phase: getGroupPhase(group),
    });
  });

  return router;
}
