import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { createDb } from './db.js';
import { hashPassword } from './auth.js';

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

const app = createApp({
  db,
  jwtSecret: JWT_SECRET,
  secureCookies: process.env.NODE_ENV === 'production',
});

app.listen(PORT, () => {
  console.log(`✓ AI 評測 API 已啟動，監聽 :${PORT}（資料檔：${DB_PATH}）`);
});
