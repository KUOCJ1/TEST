// 目前跑的是哪一版（Sprint 7 驗收條件 7.1）。
//
// deploy/deploy.sh 在同步後端之後寫入 build-info.json（commit、建置時間），這裡
// 讀出來給 GET /api/health 與管理後台「系統狀態」用。部署後不必再比對打包檔名，
// `curl /api/health` 就知道新版有沒有上去。
//
// 本機開發與測試沒有這個檔案（它不進 git），一律回傳 null，不當成錯誤。
// 讀一次就快取：檔案只在部署時改變，而部署一定會重啟服務。
import fs from 'node:fs';

const FILE = new URL('../../build-info.json', import.meta.url);
let cached;

/** 讀取並驗證 build-info.json；檔案不存在或格式不對時回傳全 null。 */
export function readBuildInfo(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      commit: typeof raw.commit === 'string' && raw.commit ? raw.commit : null,
      builtAt: typeof raw.builtAt === 'string' && raw.builtAt ? raw.builtAt : null,
    };
  } catch {
    return { commit: null, builtAt: null };
  }
}

export function getBuildInfo() {
  if (!cached) cached = readBuildInfo(FILE);
  return cached;
}
