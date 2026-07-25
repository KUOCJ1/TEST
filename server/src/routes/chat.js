import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../lib/helpers.js';

// ── AI 聊天代理（串流至 OpenRouter）──────────────────────────
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
      ? r.dimensions.map((d) => `${d.subtitle} ${d.score}/${d.max}`).join('、')
      : '';
    resultCtx = `\n\n【本次評測結果】\n評量：${r.assessmentName ?? ''} | 總分：${r.total}/${r.maxScore}（${r.percent}%）| 等級：${r.level?.badge ?? ''}\n最強構面：${r.strongest?.subtitle ?? ''} | 優先加強：${r.weakest?.subtitle ?? ''}\n各構面：${dims}`;
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

  router.post('/chat', requireAuth, chatLimiter, asyncHandler(async (req, res) => {
    const { messages = [], context = {} } = req.body;
    if (!Array.isArray(messages) || messages.length > 50) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: '訊息格式錯誤' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ code: 'CONFIG_ERROR', error: 'AI 服務未設定，請聯絡管理員。' });
    }

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://assess.rong-rise.com',
        'X-Title': 'AI Assessment Platform',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash',
        messages: [{ role: 'system', content: buildChatSystemPrompt(req.user, context) }, ...messages],
        stream: true,
        max_tokens: 1024,
      }),
    });

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

    for await (const chunk of orRes.body) {
      res.write(chunk);
    }
    res.end();
  }));

  return router;
}
