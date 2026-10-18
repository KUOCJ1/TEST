import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../lib/helpers.js';

// ── AI 聊天代理（串流至 OpenRouter）──────────────────────────
// 使用者可以影響的欄位（評測摘要）要限制長度與型別：它們會被放進 system prompt。
const clip = (v, n = 80) => String(v ?? '').slice(0, n);

const MAX_MESSAGES = 30;
const MAX_CONTENT_CHARS = 4000;
const MAX_TOTAL_CHARS = 20000;
const UPSTREAM_TIMEOUT_MS = 90 * 1000;

/** 只接受 user／assistant 角色的純文字訊息（不能自帶 system 訊息去改寫小幫手的行為）。 */
export function validateChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const m of messages) {
    if (!m || typeof m !== 'object' || (m.role !== 'user' && m.role !== 'assistant')) return false;
    if (typeof m.content !== 'string' || !m.content.trim() || m.content.length > MAX_CONTENT_CHARS) return false;
    total += m.content.length;
  }
  return total <= MAX_TOTAL_CHARS;
}

function buildChatSystemPrompt(user, context) {
  const base = '你是「評測小幫手」，為職能評測平台提供智慧助理服務。以繁體中文回應，語氣親切專業，回答簡潔有重點。';
  const roleCtx = {
    admin: '你正在服務管理員，可解釋整體統計、分析填答趨勢。',
    coach: '你正在服務教練，協助撰寫學員評語與精進建議，以學員資料為依據。',
    user:  '你正在服務學員，協助解讀評測結果、了解構面意義、規劃學習方向。',
  }[user.role] ?? '';

  let resultCtx = '';
  if (context?.result) {
    const r = context.result;
    const dims = Array.isArray(r.dimensions)
      ? r.dimensions.slice(0, 20).map((d) => `${clip(d.subtitle)} ${clip(d.score, 8)}/${clip(d.max, 8)}`).join('、')
      : '';
    resultCtx = `\n\n【本次評測結果】\n評量：${clip(r.assessmentName)} | 總分：${clip(r.total, 8)}/${clip(r.maxScore, 8)}（${clip(r.percent, 6)}%）| 等級：${clip(r.level?.badge)}\n最強構面：${clip(r.strongest?.subtitle)} | 優先加強：${clip(r.weakest?.subtitle)}\n各構面：${dims}`;
  }
  return `${base}\n\n${roleCtx}${resultCtx}`;
}

/** @param {{requireAuth}} deps */
export function createChatRouter({ requireAuth }) {
  const router = Router();

  // Rate limit for AI chat — 20 messages per minute per IP.
  // Created fresh per router instance (not module-level) so each createApp()
  // call — notably each test's own app — gets an independent counter.
  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'RATE_LIMIT', error: '請求過於頻繁，請稍後再試。' },
  });

  // 每位使用者每日額度：註冊免審，只靠「每 IP 每分鐘」擋不住用大量帳號燒 AI 額度。
  // 記憶體內計數（重啟歸零，單機足夠）；管理員額度較高。可用 CHAT_DAILY_LIMIT 調整。
  const dailyLimit = Number(process.env.CHAT_DAILY_LIMIT) || 100;
  const daily = new Map();
  const today = () => new Date().toISOString().slice(0, 10);
  function takeQuota(user) {
    const day = today();
    const e = daily.get(user.id);
    const used = e && e.day === day ? e.count : 0;
    const limit = user.role === 'admin' ? dailyLimit * 5 : dailyLimit;
    if (used >= limit) return false;
    daily.set(user.id, { day, count: used + 1 });
    if (daily.size > 5000) for (const [k, v] of daily) if (v.day !== day) daily.delete(k);
    return true;
  }

  router.post('/chat', requireAuth, chatLimiter, asyncHandler(async (req, res) => {
    const { messages = [], context = {} } = req.body ?? {};
    if (!validateChatMessages(messages)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: '訊息格式錯誤，或內容太長（每則最多 4000 字）' });
    }
    if (!takeQuota(req.user)) {
      return res.status(429).json({ code: 'CHAT_DAILY_LIMIT', error: '今天的 AI 小幫手使用次數已達上限，請明天再試。' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ code: 'CONFIG_ERROR', error: 'AI 服務未設定，請聯絡管理員。' });
    }

    // 上游逾時，且使用者關掉頁面（連線中斷）時一併中止，不再空燒額度。
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    let orRes;
    try {
      orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://assess.rong-rise.com',
        'X-Title': 'AI Assessment Platform',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash',
        messages: [
          { role: 'system', content: buildChatSystemPrompt(req.user, context) },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
        max_tokens: 1024,
      }),
    });
    } catch (err) {
      clearTimeout(timer);
      if (controller.signal.aborted) return res.status(504).json({ code: 'AI_TIMEOUT', error: 'AI 服務沒有回應，請稍後再試。' });
      throw err;
    }

    if (!orRes.ok) {
      const errBody = await orRes.json().catch(() => ({}));
      console.error('[chat] OpenRouter error', orRes.status, JSON.stringify(errBody));
      if (orRes.status === 401)
        return res.status(502).json({ code: 'AI_AUTH_ERROR', error: 'AI 服務授權失敗，請聯絡管理員。' });
      if (orRes.status === 402)
        return res.status(502).json({ code: 'AI_CREDITS_ERROR', error: 'AI 服務帳戶餘額不足，請聯絡管理員。' });
      if (orRes.status === 429)
        return res.status(429).json({ code: 'AI_RATE_LIMIT', error: 'AI 服務請求過於頻繁，請稍後再試。' });
      return res.status(502).json({ code: 'AI_ERROR', error: 'AI 服務暫時無法使用，請稍後再試。' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of orRes.body) {
        res.write(chunk);
      }
    } catch (err) {
      // 串流中途斷線或逾時：結束回應即可（前端會用已收到的部分），不要讓例外往外冒。
      console.error('[chat] stream interrupted', err?.name ?? err?.message);
    } finally {
      clearTimeout(timer);
      res.end();
    }
  }));

  return router;
}
