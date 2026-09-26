import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { createDb } from './db.js';
import { hashPassword } from './auth.js';
import { checkAndAlert } from './lib/health.js';
import { isMailConfigured } from './lib/mailer.js';
import { sendDueRetestReminders } from './lib/notifications.js';

const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const DB_PATH = process.env.DB_PATH || './data/db.json';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@demo.tw').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

if (!JWT_SECRET) {
  console.error('✗ 缺少必要環境變數 JWT_SECRET（請設定一段夠長的隨機字串）');
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.error('✗ JWT_SECRET 長度不足（至少需 32 個字元）');
  process.exit(1);
}

const db = createDb(DB_PATH);

// 首次啟動建立管理員種子帳號。
if (!db.data.users.some((u) => u.role === 'admin')) {
  db.data.users.push({
    id: randomUUID(),
    name: '系統管理員',
    email: ADMIN_EMAIL,
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    role: 'admin',
    createdAt: new Date().toISOString(),
  });
  db.persist();
  console.log(`✓ 已建立管理員帳號：${ADMIN_EMAIL}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️  正在使用預設管理員密碼 admin1234，正式環境請設定 ADMIN_PASSWORD！');
  }
}

const TRUST_PROXY = Number(process.env.TRUST_PROXY) || 0;

const app = createApp({
  db,
  jwtSecret: JWT_SECRET,
  secureCookies: process.env.NODE_ENV === 'production',
  trustProxy: TRUST_PROXY,
});

app.listen(PORT, () => {
  console.log(`✓ AI 評測 API 已啟動，監聽 :${PORT}（資料檔：${DB_PATH}）`);
  if (TRUST_PROXY === 0) {
    console.warn('⚠️  TRUST_PROXY 未設定（目前為 0，不信任任何代理標頭）。若部署在 Nginx/Traefik 等反向代理' +
      '之後，registration/login 的 rate limit 會把所有使用者算成同一個來源 IP。請在 .env 設定 TRUST_PROXY' +
      '（本站 Traefik→Nginx 兩層皆走 loopback，經確認應為 2），並於部署後從外部網路實測 req.ip 確為使用者真實位址。');
  }
});

// ── 外部依賴主動告警（Sprint 6 驗收條件 6.1、6.2）─────────────────
// 排程放在這裡而不是 createApp()：createApp() 同時給測試用，每個測試檔都會建一個
// app，排程放進去會在測試裡到處留下 setInterval。設成 0 可以關閉。
const HEALTH_CHECK_INTERVAL_MINUTES = Number(process.env.HEALTH_CHECK_INTERVAL_MINUTES ?? 5);
if (HEALTH_CHECK_INTERVAL_MINUTES > 0) {
  const runHealthWatch = () => {
    checkAndAlert(db, { adminEmail: ADMIN_EMAIL })
      .then(({ baseline, changes }) => {
        if (baseline) console.log('✓ 健康檢查：已記錄基準狀態');
        for (const c of changes) console.log(`[health-watch] ${c.label} → ${c.ok ? '恢復' : '異常'}`);
      })
      .catch((err) => console.error('[health-watch] 檢查失敗', err?.message ?? err));
  };
  runHealthWatch(); // 開機先跑一次，不必等第一個間隔
  setInterval(runHealthWatch, HEALTH_CHECK_INTERVAL_MINUTES * 60 * 1000).unref();
}
// ── 複測提醒信（Sprint 7 驗收條件 7.5）─────────────────────────
// 每個目標只寄一次（goal.reviewReminderSentAt），所以排程頻率只影響「到期後多快
// 寄出」，不會重複寄。預設每小時檢查一次，設成 0 可以關閉。
const NOTIFY_INTERVAL_MINUTES = Number(process.env.NOTIFY_INTERVAL_MINUTES ?? 60);
if (NOTIFY_INTERVAL_MINUTES > 0) {
  const runRetestReminders = () => {
    sendDueRetestReminders(db)
      .then(({ sent, failed }) => {
        if (sent || failed) console.log(`[notify] 複測提醒：寄出 ${sent} 封、失敗 ${failed} 封`);
      })
      .catch((err) => console.error('[notify] 複測提醒失敗', err?.message ?? err));
  };
  runRetestReminders();
  setInterval(runRetestReminders, NOTIFY_INTERVAL_MINUTES * 60 * 1000).unref();
}

if (!isMailConfigured()) {
  console.warn('⚠️  未設定 SMTP（SMTP_HOST／SMTP_USER／SMTP_PASS）：異常告警信、教練「寄送提醒信」、' +
    '學員的複測提醒與評語通知都會停用（其他功能不受影響）。');
}
