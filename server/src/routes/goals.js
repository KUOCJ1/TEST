import { Router } from 'express';
import { randomUUID } from 'node:crypto';

const MAX_ACTIONS = 5;
const MAX_TEXT = 500;
const MAX_GOALS_PER_USER = 50;
const MAX_CHECKINS = 100;
const MAX_SNOOZE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function sanitizeText(v, max = MAX_TEXT) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// 行動項目一律重新組裝，不直接沿用前端送來的物件——避免夾帶額外欄位寫進資料庫。
function sanitizeActions(v, previous = []) {
  if (!Array.isArray(v)) return previous;
  const prevById = new Map(previous.map((a) => [a.id, a]));
  return v.slice(0, MAX_ACTIONS).map((a) => {
    const id = typeof a?.id === 'string' && prevById.has(a.id) ? a.id : randomUUID();
    const done = a?.done === true;
    const before = prevById.get(id);
    return {
      id,
      text: sanitizeText(a?.text, 200),
      done,
      // 已完成才記時間；重新勾選時保留原本的完成時間，取消勾選則清掉。
      doneAt: done ? (before?.done ? before.doneAt : new Date().toISOString()) : null,
    };
  }).filter((a) => a.text);
}

function publicGoal(g) {
  return {
    id: g.id,
    assessmentId: g.assessmentId,
    dimensionId: g.dimensionId,
    dimensionName: g.dimensionName,
    text: g.text,
    actions: g.actions,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    achievedAt: g.achievedAt,
    // 設定目標當下，該構面的平均分——用來在複測後顯示「設定時 → 最新」的變化，
    // 不必回頭比對歷史作答紀錄。沒有指定構面（dimensionId 為 null）時一併為 null。
    baselineAverage: typeof g.baselineAverage === 'number' ? g.baselineAverage : null,
    // 建議複測日：預設建立後 4 週，可由使用者建立時調整。用於首頁「下一步」
    // 提醒使用者該回來複測了（見 src/survey/utils/nextStep.js）。
    reviewDate: g.reviewDate ?? null,
    // 預設只有本人看得到；本人可以對「個別目標」選擇分享給教練（見 sharedGoalForCoach）。
    sharedWithCoach: g.sharedWithCoach === true,
    // 追蹤紀錄：每次一句話＋自評「這段時間有做嗎」(1–5)，讓過程看得見，不只剩勾選。
    checkins: (g.checkins ?? []).map((c) => ({ id: c.id, at: c.at, text: c.text, rating: c.rating ?? null })),
  };
}

/**
 * 給教練看的版本：只有本人明確分享的目標才會出現。追蹤筆記是最私人的內容，
 * 即使分享了目標也不給教練看，只給次數與最近一次的自評分數，讓教練知道有沒有在持續進行。
 */
export function sharedGoalForCoach(g, user) {
  const checkins = g.checkins ?? [];
  const last = checkins.at(-1);
  return {
    id: g.id,
    userId: g.userId,
    userName: user?.name ?? '',
    assessmentId: g.assessmentId,
    dimensionName: g.dimensionName,
    text: g.text,
    actions: (g.actions ?? []).map((a) => ({ text: a.text, done: a.done })),
    createdAt: g.createdAt,
    reviewDate: g.reviewDate ?? null,
    achievedAt: g.achievedAt,
    baselineAverage: typeof g.baselineAverage === 'number' ? g.baselineAverage : null,
    checkinCount: checkins.length,
    lastCheckin: last ? { at: last.at, rating: last.rating ?? null } : null,
  };
}

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

/**
 * 個人發展目標 — 讓學員針對某個構面訂下目標與具體行動，下次回來可以打勾。
 * 目標屬於學員個人，預設只有本人讀得到、改得動；本人可以對個別目標選擇「分享給教練」（見 sharedGoalForCoach）。
 * @param {{db, requireAuth}} deps
 */
export function createGoalsRouter({ db, requireAuth }) {
  const router = Router();

  const ownGoal = (req) =>
    (db.data.goals ?? []).find((g) => g.id === req.params.id && g.userId === req.user.id);

  router.get('/goals', requireAuth, (req, res) => {
    const { assessmentId } = req.query;
    const list = (db.data.goals ?? [])
      .filter((g) => g.userId === req.user.id)
      .filter((g) => (assessmentId ? g.assessmentId === assessmentId : true))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ goals: list.map(publicGoal) });
  });

  router.post('/goals', requireAuth, (req, res) => {
    const { assessmentId, dimensionId, dimensionName, text, actions, baselineAverage, reviewDate } = req.body ?? {};
    const cleanText = sanitizeText(text);
    if (!cleanText) {
      return res.status(400).json({ code: 'INVALID_GOAL', error: '請輸入目標內容' });
    }
    db.data.goals ??= [];
    const mine = db.data.goals.filter((g) => g.userId === req.user.id);
    if (mine.length >= MAX_GOALS_PER_USER) {
      return res.status(400).json({ code: 'TOO_MANY_GOALS', error: '目標數量已達上限，請先刪除不再追蹤的目標' });
    }
    const now = new Date().toISOString();
    // 建立時前端可能算不出 baselineAverage（如目標沒有指定構面），或沒帶
    // reviewDate（用預設 4 週後）——兩者都做寬鬆檢查，不合法就退回安全預設值，
    // 而不是整個 400 拒絕（這兩個欄位都只是輔助資訊，不影響目標本身能不能建立）。
    const cleanBaseline = typeof baselineAverage === 'number' && Number.isFinite(baselineAverage) ? baselineAverage : null;
    const cleanReviewDate = typeof reviewDate === 'string' && !Number.isNaN(Date.parse(reviewDate))
      ? reviewDate
      : new Date(Date.now() + FOUR_WEEKS_MS).toISOString();
    const goal = {
      id: randomUUID(),
      userId: req.user.id,
      assessmentId: typeof assessmentId === 'string' ? assessmentId : 'ai-competency',
      dimensionId: typeof dimensionId === 'string' ? dimensionId : null,
      dimensionName: sanitizeText(dimensionName, 60) || null,
      text: cleanText,
      actions: sanitizeActions(actions, []),
      createdAt: now,
      updatedAt: now,
      achievedAt: null,
      baselineAverage: cleanBaseline,
      reviewDate: cleanReviewDate,
      sharedWithCoach: false,
      checkins: [],
    };
    db.data.goals.push(goal);
    db.persist();
    res.status(201).json({ goal: publicGoal(goal) });
  });

  router.patch('/goals/:id', requireAuth, (req, res) => {
    const goal = ownGoal(req);
    if (!goal) return res.status(404).json({ code: 'NOT_FOUND', error: '找不到這個目標' });

    const { text, actions, achieved, reviewDate, sharedWithCoach } = req.body ?? {};
    if (text !== undefined) {
      const cleanText = sanitizeText(text);
      if (!cleanText) return res.status(400).json({ code: 'INVALID_GOAL', error: '請輸入目標內容' });
      goal.text = cleanText;
    }
    if (actions !== undefined) goal.actions = sanitizeActions(actions, goal.actions);
    if (achieved !== undefined) {
      goal.achievedAt = achieved ? (goal.achievedAt ?? new Date().toISOString()) : null;
    }
    // 預計檢視日可以改（以前建立後就改不了）。改了之後提醒信要能再寄，所以清掉「已寄」記號。
    if (reviewDate !== undefined) {
      if (typeof reviewDate !== 'string' || Number.isNaN(Date.parse(reviewDate))) {
        return res.status(400).json({ code: 'INVALID_DATE', error: '預計檢視日格式不正確' });
      }
      goal.reviewDate = new Date(reviewDate).toISOString();
      delete goal.reviewReminderSentAt;
    }
    // 分享給教練：只接受明確的布林值；預設與取消都是私密。
    if (sharedWithCoach !== undefined) {
      if (typeof sharedWithCoach !== 'boolean') return res.status(400).json({ code: 'INVALID_SHARE', error: '分享設定格式不正確' });
      goal.sharedWithCoach = sharedWithCoach;
    }
    goal.updatedAt = new Date().toISOString();
    db.persist();
    res.json({ goal: publicGoal(goal) });
  });

  // 延後：把預計檢視日往後挪幾天（預設 7 天，從「今天與原定日期較晚者」起算），並讓提醒信可以再寄一次。
  router.post('/goals/:id/snooze', requireAuth, (req, res) => {
    const goal = ownGoal(req);
    if (!goal) return res.status(404).json({ code: 'NOT_FOUND', error: '找不到這個目標' });
    const days = Math.min(Math.max(Math.floor(Number(req.body?.days) || 7), 1), MAX_SNOOZE_DAYS);
    const base = Math.max(Date.now(), goal.reviewDate ? Date.parse(goal.reviewDate) : 0);
    goal.reviewDate = new Date(base + days * DAY_MS).toISOString();
    goal.snoozeCount = (goal.snoozeCount ?? 0) + 1;
    delete goal.reviewReminderSentAt;
    goal.updatedAt = new Date().toISOString();
    db.persist();
    res.json({ goal: publicGoal(goal) });
  });

  // 追蹤紀錄：一句話＋自評 1–5。內容只有本人看得到（分享目標時也不給教練）。
  router.post('/goals/:id/checkins', requireAuth, (req, res) => {
    const goal = ownGoal(req);
    if (!goal) return res.status(404).json({ code: 'NOT_FOUND', error: '找不到這個目標' });
    const text = sanitizeText(req.body?.text, 300);
    const rawRating = req.body?.rating;
    const rating = Number.isInteger(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : null;
    if (!text && rating === null) {
      return res.status(400).json({ code: 'INVALID_CHECKIN', error: '請寫一句話，或選擇這段時間的進行程度' });
    }
    goal.checkins ??= [];
    if (goal.checkins.length >= MAX_CHECKINS) {
      return res.status(400).json({ code: 'TOO_MANY_CHECKINS', error: '追蹤紀錄已達上限' });
    }
    goal.checkins.push({ id: randomUUID(), at: new Date().toISOString(), text, rating });
    goal.updatedAt = new Date().toISOString();
    db.persist();
    res.status(201).json({ goal: publicGoal(goal) });
  });

  router.delete('/goals/:id/checkins/:checkinId', requireAuth, (req, res) => {
    const goal = ownGoal(req);
    if (!goal) return res.status(404).json({ code: 'NOT_FOUND', error: '找不到這個目標' });
    goal.checkins = (goal.checkins ?? []).filter((c) => c.id !== req.params.checkinId);
    db.persist();
    res.json({ goal: publicGoal(goal) });
  });

  router.delete('/goals/:id', requireAuth, (req, res) => {
    const goal = ownGoal(req);
    if (!goal) return res.status(404).json({ code: 'NOT_FOUND', error: '找不到這個目標' });
    db.data.goals = db.data.goals.filter((g) => g.id !== goal.id);
    db.persist();
    res.json({ ok: true });
  });

  return router;
}
