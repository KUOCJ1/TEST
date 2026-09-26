// 外部依賴健康檢查（Sprint 5 驗收條件 5.8）：GET /api/health?deep=1 額外回報
// 第二大腦（延伸閱讀）與 OpenRouter（AI 小幫手）這兩個外部依賴的狀態，供外部
// 監控服務（如 UptimeRobot、cron + curl）定期輪詢，及早發現「延伸閱讀一直查
// 不到文章」或「AI 小幫手一直 503」是不是這頭出了問題，而不必等使用者回報。
//
// 讀取環境變數時故意不 import 常數快取，而是在呼叫當下讀 process.env——這樣
// 測試裡用不同 env 值呼叫多次不會被模組載入時就固定住的舊值卡住。

import { sendMail } from './mailer.js';

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

// ── 主動告警（Sprint 6 驗收條件 6.1、6.2）──────────────────────
// 上面的 deepHealthCheck() 只在有人來問的時候回答；這裡由 server.js 的排程定期
// 呼叫，狀態「變化」時主動寄信給管理員。
//
// 只在變化時寄，不在「目前異常」時每次都寄：排程預設每 5 分鐘跑一次，第二大腦
// 掛一小時就會寄 12 封一樣的信，很快就會被當成雜訊忽略掉，真正重要的那封反而
// 沒人看。「已恢復」也寄，讓收件人知道不用再追了。
//
// 上次狀態存在資料庫（systemStatus collection）而不是記憶體：服務重啟後讀回來
// 接著比對，不會因為重啟就誤判成「狀態變化」多寄一封，也不會漏掉「重啟期間
// 剛好恢復」這種變化。

const STATUS_ID = 'deepHealth';

const DEPENDENCIES = [
  {
    key: 'secondBrainOk',
    label: '第二大腦 API（延伸閱讀）',
    read: (deps) => deps.secondBrain.ok,
    downText: (deps) => `目前無法連線（${deps.secondBrain.baseUrl}）。` +
      `錯誤：${deps.secondBrain.error ?? `HTTP ${deps.secondBrain.status}`}。` +
      '學員報告頁的「延伸閱讀」會暫時顯示空狀態，評測本身不受影響。',
    upText: (deps) => `已恢復連線（${deps.secondBrain.baseUrl}），延伸閱讀功能恢復正常。`,
  },
  {
    key: 'openRouterConfigured',
    label: 'OpenRouter（AI 小幫手）',
    read: (deps) => deps.openRouter.configured,
    downText: () => '後端目前沒有 OPENROUTER_API_KEY，AI 小幫手會對所有使用者回傳「AI 服務未設定」。' +
      '請檢查 VPS 上 server/.env 的設定。',
    upText: () => 'OPENROUTER_API_KEY 已設定，AI 小幫手恢復可用。',
  },
];

/**
 * 跑一次深度健康檢查，跟資料庫裡的上次狀態比對，有變化就寄告警信。
 * @param {{data:object, persist:Function}} db
 * @param {{adminEmail:string, check?:Function, send?:Function}} opts
 *   check/send 預設為 deepHealthCheck/sendMail，測試時可注入替身。
 * @returns {Promise<{baseline:boolean, changes:Array<{key, label, ok}>}>}
 */
export async function checkAndAlert(db, { adminEmail, check = deepHealthCheck, send = sendMail }) {
  const deps = await check();
  const current = Object.fromEntries(DEPENDENCIES.map((d) => [d.key, d.read(deps)]));
  const now = new Date().toISOString();

  if (!db.data.systemStatus) db.data.systemStatus = [];
  const prev = db.data.systemStatus.find((s) => s.id === STATUS_ID);

  // 第一次（全新安裝或資料庫剛升級）：只記錄基準狀態，不寄信——沒有「上一次」
  // 可以比，就談不上「變化」。
  if (!prev) {
    db.data.systemStatus.push({ id: STATUS_ID, ...current, checkedAt: now });
    db.persist();
    return { baseline: true, changes: [] };
  }

  const changes = DEPENDENCIES
    .filter((d) => prev[d.key] !== current[d.key])
    .map((d) => ({ key: d.key, label: d.label, ok: current[d.key], text: current[d.key] ? d.upText(deps) : d.downText(deps) }));

  if (changes.length > 0 && adminEmail) {
    const anyDown = changes.some((c) => !c.ok);
    const subject = anyDown
      ? `⚠️ [評測平台] ${changes.filter((c) => !c.ok).map((c) => c.label).join('、')} 異常`
      : `✅ [評測平台] ${changes.map((c) => c.label).join('、')} 已恢復`;
    const text = [
      ...changes.map((c) => `${c.ok ? '✅' : '⚠️'} ${c.label}：${c.text}`),
      '',
      `檢查時間：${now}`,
      '（這封信只在狀態變化時寄出；恢復時會再寄一封通知。）',
    ].join('\n');
    // 寄信失敗不影響狀態更新：否則 SMTP 一直壞，每一輪都會重新判定為「變化」
    // 而一直重試——那是另一個問題（寄信服務壞了），不該跟這裡的狀態追蹤混在一起。
    await send({ to: adminEmail, subject, text });
  }

  Object.assign(prev, current, { checkedAt: now });
  db.persist();
  return { baseline: false, changes: changes.map(({ key, label, ok }) => ({ key, label, ok })) };
}
