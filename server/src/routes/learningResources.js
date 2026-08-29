import { Router } from 'express';
import { asyncHandler } from '../lib/helpers.js';
import { getTopicKeyword } from '../lib/learningResourceTopics.js';

// 可用環境變數覆寫，主要供本機測試指向假的第二大腦服務；正式站不設定時預設
// 打真正的 brain.rong-rise.com。
const BRAIN_BASE_URL = process.env.BRAIN_API_BASE_URL || 'https://brain.rong-rise.com';
const FETCH_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小時：外部內容變動不快，避免每次開報告都打第二大腦。
const MAX_RESULTS = 3;

// 只曝光這幾個分類給受測者——「國際視野」「政策與法規」「顧問專案」等偏內部
// 研究筆記或未必適合直接給學員看的分類會被過濾掉，即使 ?q= 關鍵字剛好命中。
// 「人資與組織發展」是實測 ?q=溝通 時才發現的分類（範例文章「人才培訓體系設計
// 框架」跟人才發展構面直接對應），原本不在畫面上看到的 15 個分類名單裡，一併
// 收進允許清單——若不想曝光這個分類，把它從這裡移除即可。
const ALLOWED_CATEGORIES = new Set(['技術深讀', '管理心理學', '人才策略', '人資與組織發展']);

// keyword -> { articles, expiresAt }。記憶體快取，比照 assessments.js 的
// benchmark 快取寫法；伺服器重啟即清空，可接受（外部內容本來就沒有「一定
// 要最新」的急迫性）。
const cache = new Map();

// 實測 GET /api/articles?q=<關鍵字> 的回應形狀：
// { articles: [{ slug, title, category, categoryIcon, tags, date, excerpt }] }
// 沒有 url 欄位。原本猜測單篇網址是 API 端點本身（/api/articles/{slug}），
// 但那其實是裸資料 API、瀏覽器打開只會看到原始 JSON，不是給人看的閱讀頁；
// 實際的閱讀頁網址是 /brain/{slug}/（注意跟 API 路徑不同、結尾有斜線，
// slug 可能是中文，需要 URL encode）。
function normalizeArticle(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.title || !raw.slug) return null;
  if (raw.category && !ALLOWED_CATEGORIES.has(raw.category)) return null;
  return {
    title: raw.title,
    url: `${BRAIN_BASE_URL}/brain/${encodeURIComponent(raw.slug)}/`,
    excerpt: raw.excerpt ?? '',
    category: raw.category ?? null,
  };
}

async function fetchArticles(keyword) {
  const cached = cache.get(keyword);
  if (cached && cached.expiresAt > Date.now()) return cached.articles;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BRAIN_BASE_URL}/api/articles?q=${encodeURIComponent(keyword)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`brain.rong-rise.com 回應 ${res.status}`);
    const payload = await res.json();
    const articles = (Array.isArray(payload?.articles) ? payload.articles : [])
      .map(normalizeArticle)
      .filter(Boolean)
      .slice(0, MAX_RESULTS);
    cache.set(keyword, { articles, expiresAt: Date.now() + CACHE_TTL_MS });
    return articles;
  } catch (err) {
    // 第二大腦掛了、逾時、或回應格式不如預期：報告頁面不能被這個非必要的
    // 附加功能卡住或壞掉，記一筆 log 方便事後排查，回空陣列讓前端自然不顯示
    // 「延伸閱讀」區塊即可。
    console.error('[learning-resources] fetch failed', keyword, err.message ?? err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** @param {{requireAuth}} deps */
export function createLearningResourcesRouter({ requireAuth }) {
  const router = Router();

  router.get('/learning-resources', requireAuth, asyncHandler(async (req, res) => {
    const { assessmentId, dimensionId } = req.query;
    if (typeof assessmentId !== 'string' || typeof dimensionId !== 'string') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: '缺少 assessmentId 或 dimensionId' });
    }
    const keyword = getTopicKeyword(assessmentId, dimensionId);
    if (!keyword) return res.json({ articles: [] });

    const articles = await fetchArticles(keyword);
    res.json({ articles });
  }));

  return router;
}
