// 在 VPS 本機重設管理員密碼（登不進去、也沒有其他管理員時使用）。
// 密碼用互動輸入（不顯示、不進指令列、不進日誌），不會出現在對話或版控裡。
//
// 用法（務必先停服務，否則服務記憶體裡的舊資料會在下次寫入時蓋掉這次的修改）：
//   cd /opt/ai-assessment/server
//   sudo systemctl stop ai-assessment-api
//   sudo -u www-data env $(grep -E '^DB_PATH=' .env | xargs) node scripts/reset-admin-password.mjs
//   sudo systemctl start ai-assessment-api
import readline from 'node:readline';
import { createDb } from '../src/db.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/auth.js';
import { revokeUserTokens } from '../src/lib/helpers.js';

const DB_PATH = process.env.DB_PATH;
if (!DB_PATH) {
  console.error('✗ 缺少 DB_PATH（請照檔頭的指令，從 .env 帶入）');
  process.exit(1);
}

const tty = Boolean(process.stdin.isTTY);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (hidden && tty) {
      rl._writeToOutput = (str) => { if (str.includes(question)) rl.output.write(str); };
    }
    rl.question(question, (answer) => {
      if (hidden && tty) { rl._writeToOutput = (str) => rl.output.write(str); process.stdout.write('\n'); }
      resolve(answer);
    });
  });
}

const db = createDb(DB_PATH);
const admins = db.data.users.filter((u) => u.role === 'admin');
if (admins.length === 0) {
  console.error('✗ 資料庫裡沒有管理員帳號。確認 DB_PATH 指向正確的檔案；若是全新安裝，改用 .env 的 ADMIN_EMAIL／ADMIN_PASSWORD 啟動即可建立。');
  process.exit(1);
}

console.log('資料庫裡的管理員帳號：');
admins.forEach((u, i) => console.log(`  ${i + 1}. ${u.email}${u.disabled ? '（已停用）' : ''}`));

let target = admins[0];
if (admins.length > 1) {
  const pick = Number(await ask('要重設第幾個？'));
  target = admins[pick - 1];
  if (!target) { console.error('✗ 選擇無效'); process.exit(1); }
}

const pw1 = await ask(`為 ${target.email} 輸入新密碼（至少 ${MIN_PASSWORD_LENGTH} 碼，不會顯示）：`, { hidden: true });
if (pw1.length < MIN_PASSWORD_LENGTH) { console.error(`✗ 密碼至少 ${MIN_PASSWORD_LENGTH} 碼`); process.exit(1); }
const pw2 = await ask('再輸入一次：', { hidden: true });
if (pw1 !== pw2) { console.error('✗ 兩次輸入不一致，未做任何修改'); process.exit(1); }

target.passwordHash = await hashPassword(pw1);
delete target.resetTokenHash;
delete target.resetTokenExpires;
target.disabled = false;
revokeUserTokens(target); // 撤銷這個帳號現有的所有登入
db.persist();
rl.close();
console.log(`✓ 已重設 ${target.email} 的密碼。請啟動服務後用新密碼登入。`);
