import { Router } from 'express';
import { randomUUID } from 'node:crypto';

// 課後四週微練習（Sprint 38）：學員自己開啟，每週一個 5 分鐘的小練習，做完勾選。
// 存在使用者自己的紀錄上（user.practice），同時只有一組進行中；只有本人讀得到，教練與管理者都不經這裡看。
// 任務文字由前端依題庫的起手行動組出來（data/goal-starters.js），這裡只做長度與數量的清理。

export const PRACTICE_WEEKS = 4;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TASK = 200;

/** 第幾週（1–4）；超過四週回 PRACTICE_WEEKS + 1 表示已結束。 */
export function practiceWeek(practice, now = Date.now()) {
  const start = new Date(practice.startedAt).getTime();
  return Math.min(PRACTICE_WEEKS + 1, Math.floor(Math.max(0, now - start) / WEEK_MS) + 1);
}

export function isPracticeActive(practice, now = Date.now()) {
  return Boolean(practice) && !practice.stoppedAt && practiceWeek(practice, now) <= PRACTICE_WEEKS;
}

export function publicPractice(p, now = Date.now()) {
  if (!p) return null;
  const week = practiceWeek(p, now);
  return {
    id: p.id,
    assessmentId: p.assessmentId,
    dimensionId: p.dimensionId,
    dimensionName: p.dimensionName,
    startedAt: p.startedAt,
    stoppedAt: p.stoppedAt ?? null,
    currentWeek: week,
    finished: week > PRACTICE_WEEKS,
    active: isPracticeActive(p, now),
    // 還沒到的週只給週次，不先給內容：一次看到四週的待辦會變成負擔。
    weeks: p.tasks.map((task, i) => ({
      week: i + 1,
      task: i + 1 <= week ? task : null,
      doneAt: p.done?.[i + 1] ?? null,
    })),
  };
}

const clean = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_TASK) : '');

export function createPracticeRouter({ db, requireAuth }) {
  const router = Router();
  const me = (req) => db.data.users.find((u) => u.id === req.user.id);

  router.get('/practice', requireAuth, (req, res) => {
    res.json({ practice: publicPractice(me(req)?.practice) });
  });

  router.post('/practice', requireAuth, (req, res) => {
    const user = me(req);
    if (!user) return res.status(404).json({ error: '找不到帳號' });
    if (isPracticeActive(user.practice)) {
      return res.status(409).json({ code: 'ALREADY_ACTIVE', error: '已經有一組進行中的微練習；要換主題請先結束目前這組。' });
    }
    const { assessmentId, dimensionId, dimensionName } = req.body ?? {};
    const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks.map(clean).filter(Boolean) : [];
    if (typeof assessmentId !== 'string' || !assessmentId || tasks.length !== PRACTICE_WEEKS) {
      return res.status(400).json({ error: `需要評量與 ${PRACTICE_WEEKS} 週的練習內容` });
    }
    user.practice = {
      id: randomUUID(),
      assessmentId: assessmentId.slice(0, 80),
      dimensionId: typeof dimensionId === 'string' ? dimensionId.slice(0, 80) : null,
      dimensionName: clean(dimensionName).slice(0, 40) || null,
      tasks,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      done: {},
      nudgesSent: [],
    };
    db.persist();
    res.status(201).json({ practice: publicPractice(user.practice) });
  });

  router.post('/practice/weeks/:week', requireAuth, (req, res) => {
    const user = me(req);
    const p = user?.practice;
    const week = Number(req.params.week);
    if (!p || p.stoppedAt) return res.status(404).json({ error: '沒有進行中的微練習' });
    if (!Number.isInteger(week) || week < 1 || week > PRACTICE_WEEKS || week > practiceWeek(p)) {
      return res.status(400).json({ error: '這一週還沒開始' });
    }
    p.done = { ...(p.done ?? {}) };
    if (req.body?.done === false) delete p.done[week];
    else p.done[week] = p.done[week] ?? new Date().toISOString();
    db.persist();
    res.json({ practice: publicPractice(p) });
  });

  router.delete('/practice', requireAuth, (req, res) => {
    const user = me(req);
    if (!user?.practice || user.practice.stoppedAt) return res.json({ practice: publicPractice(user?.practice) });
    user.practice.stoppedAt = new Date().toISOString();
    db.persist();
    res.json({ practice: publicPractice(user.practice) });
  });

  return router;
}
