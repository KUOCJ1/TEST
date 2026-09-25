// 外部依賴健康檢查（Sprint 5 驗收條件 5.8）：GET /api/health?deep=1 額外回報
// 第二大腦（延伸閱讀）與 OpenRouter（AI 小幫手）這兩個外部依賴的狀態，供外部
// 監控服務（如 UptimeRobot、cron + curl）定期輪詢，及早發現「延伸閱讀一直查
// 不到文章」或「AI 小幫手一直 503」是不是這頭出了問題，而不必等使用者回報。
//
// 讀取環境變數時故意不 import 常數快取，而是在呼叫當下讀 process.env——這樣
// 測試裡用不同 env 值呼叫多次不會被模組載入時就固定住的舊值卡住。

const TIMEOUT_MS = 3000;

async function checkReachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // 只探測「連得到、有回應」，不驗證內容——內容正確性已經有
    // learning-resources 路由自己的快取與逾時保護，這裡只回答「這個服務現在
    // 看起來是活的嗎」。用 HEAD 避免真的產生一次查詢或耗用對方資源。
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function deepHealthCheck() {
  const brainBaseUrl = process.env.BRAIN_API_BASE_URL || 'https://brain.rong-rise.com';
  const secondBrain = await checkReachable(brainBaseUrl);

  // OpenRouter 是付費 API，深度健康檢查不該真的送一次對話請求去燒額度——
  // 只回報「有沒有設定金鑰」，這正是 chat.js 503 CONFIG_ERROR 的成因，最常見
  // 的「AI 小幫手掛了」原因就是忘記設這個環境變數。
  const openRouter = { configured: Boolean(process.env.OPENROUTER_API_KEY) };

  return {
    secondBrain: { baseUrl: brainBaseUrl, ...secondBrain },
    openRouter,
  };
}
