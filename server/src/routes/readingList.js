import { Router } from 'express';
import { randomUUID } from 'node:crypto';

const MAX_ITEMS_PER_USER = 200;

function sanitizeText(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function publicItem(item) {
  return {
    id: item.id,
    url: item.url,
    title: item.title,
    excerpt: item.excerpt,
    category: item.category,
    assessmentId: item.assessmentId,
    dimensionId: item.dimensionId,
    dimensionName: item.dimensionName,
    addedAt: item.addedAt,
    read: !!item.readAt,
    readAt: item.readAt,
  };
}

/**
 * 「我的學習清單」——學員把延伸閱讀文章加入清單、標記已讀。跟發展目標
 * （routes/goals.js）同樣的隱私設計：只有本人讀得到、改得動，教練與管理者都
 * 看不到個人清單內容（管理後台只看得到彙總的點擊/加入次數，見 routes/admin.js）。
 * @param {{db, requireAuth}} deps
 */
export function createReadingListRouter({ db, requireAuth }) {
  const router = Router();

  router.get('/reading-list', requireAuth, (req, res) => {
    const list = (db.data.readingList ?? [])
      .filter((i) => i.userId === req.user.id)
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    res.json({ items: list.map(publicItem) });
  });

  router.post('/reading-list', requireAuth, (req, res) => {
    const { url, title, excerpt, category, assessmentId, dimensionId, dimensionName } = req.body ?? {};
    const cleanUrl = sanitizeText(url, 500);
    const cleanTitle = sanitizeText(title, 300);
    if (!cleanUrl || !cleanTitle) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: '缺少文章連結或標題' });
    }
    db.data.readingList ??= [];
    // 同一篇文章重複加入視為冪等：直接回傳既有那筆，不建立重複項目，前端不必
    // 自己先查一次「是不是已經加過了」。
    const existing = db.data.readingList.find((i) => i.userId === req.user.id && i.url === cleanUrl);
    if (existing) return res.json({ item: publicItem(existing) });

    const mine = db.data.readingList.filter((i) => i.userId === req.user.id);
    if (mine.length >= MAX_ITEMS_PER_USER) {
      return res.status(400).json({ code: 'TOO_MANY_ITEMS', error: '學習清單已達上限，請先移除不需要的項目' });
    }
    const item = {
      id: randomUUID(),
      userId: req.user.id,
      url: cleanUrl,
      title: cleanTitle,
      excerpt: sanitizeText(excerpt, 500),
      category: sanitizeText(category, 60) || null,
      assessmentId: sanitizeText(assessmentId, 60) || null,
      dimensionId: sanitizeText(dimensionId, 60) || null,
      dimensionName: sanitizeText(dimensionName, 60) || null,
      addedAt: new Date().toISOString(),
      readAt: null,
    };
    db.data.readingList.push(item);
    db.persist();
    res.status(201).json({ item: publicItem(item) });
  });

  router.patch('/reading-list/:id', requireAuth, (req, res) => {
    const item = (db.data.readingList ?? []).find((i) => i.id === req.params.id && i.userId === req.user.id);
    if (!item) return res.status(404).json({ code: 'NOT_FOUND', error: '找不到這筆學習清單項目' });
    const { read } = req.body ?? {};
    if (read !== undefined) item.readAt = read ? (item.readAt ?? new Date().toISOString()) : null;
    db.persist();
    res.json({ item: publicItem(item) });
  });

  router.delete('/reading-list/:id', requireAuth, (req, res) => {
    const item = (db.data.readingList ?? []).find((i) => i.id === req.params.id && i.userId === req.user.id);
    if (!item) return res.status(404).json({ code: 'NOT_FOUND', error: '找不到這筆學習清單項目' });
    db.data.readingList = db.data.readingList.filter((i) => i.id !== item.id);
    db.persist();
    res.json({ ok: true });
  });

  return router;
}
