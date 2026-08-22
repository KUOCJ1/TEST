import { Router } from 'express';
import { randomUUID } from 'node:crypto';

const MAX_ACTIONS = 5;
const MAX_TEXT = 500;
const MAX_GOALS_PER_USER = 50;

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
  };
}

/**
 * 個人發展目標 — 讓學員針對某個構面訂下目標與具體行動，下次回來可以打勾。
 * 目標屬於學員個人，只有本人讀得到、改得動（教練與管理者也看不到）。
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
    const { assessmentId, dimensionId, dimensionName, text, actions } = req.body ?? {};
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
    };
    db.data.goals.push(goal);
    db.persist();
    res.status(201).json({ goal: publicGoal(goal) });
  });

  router.patch('/goals/:id', requireAuth, (req, res) => {
    const goal = ownGoal(req);
    if (!goal) return res.status(404).json({ code: 'NOT_FOUND', error: '找不到這個目標' });

    const { text, actions, achieved } = req.body ?? {};
    if (text !== undefined) {
      const cleanText = sanitizeText(text);
      if (!cleanText) return res.status(400).json({ code: 'INVALID_GOAL', error: '請輸入目標內容' });
      goal.text = cleanText;
    }
    if (actions !== undefined) goal.actions = sanitizeActions(actions, goal.actions);
    if (achieved !== undefined) {
      goal.achievedAt = achieved ? (goal.achievedAt ?? new Date().toISOString()) : null;
    }
    goal.updatedAt = new Date().toISOString();
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
