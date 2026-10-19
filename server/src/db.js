import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migratePendingMembers } from './lib/memberInvites.js';

const COLLECTIONS = ['users', 'submissions', 'assessments', 'groups', 'goals', 'readingList', 'learningResourceClicks', 'systemStatus', 'assessmentContent', 'raterInvites', 'groupInvites', 'auditLog', 'memberInvites'];

// 舊版 JSON 檔案型儲存遷移到 SQLite：把 DB_PATH 指向的舊檔（原本存純 JSON）解析後
// 灌進新的 `${file}.sqlite3` 檔案。遷移過程完全不動、不刪原檔——新資料寫進另一個
// 檔案，原檔自然成為一份遷移前快照，不需要額外的備份步驟，回退也只需要退版程式碼。
function migrateLegacyJsonIfPresent(legacyFile, sqliteFile) {
  if (fs.existsSync(sqliteFile) || !fs.existsSync(legacyFile)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
    const data = {};
    for (const key of COLLECTIONS) {
      data[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
    }
    return data;
  } catch (e) {
    // 舊檔存在但毀損或不是合法 JSON：不能當作「全新安裝」默默開一個空資料庫（管理員會被重新種入、
    // 舊資料看起來像不見了）。明確報錯並拒絕啟動，讓維運者先處理檔案。
    throw new Error(`舊版資料檔 ${legacyFile} 無法解析（${e.message}）。請確認或修復該檔案後再啟動；` +
      '若確定要全新安裝，請先把它移走或改名。');
  }
}

/**
 * 建立資料庫（SQLite 儲存，每個 collection 的每筆記錄以 JSON 字串存一個 row）：
 * 載入時整批讀進記憶體陣列，讀寫邏輯與呼叫端介面（db.data.*、db.persist()）維持
 * 不變；persist() 內部以單一交易整批覆寫，兼具原子性與遠優於整檔序列化寫入的效能。
 * 適合課程規模、低併發的使用情境，也為未來若需要逐筆增量寫入預留了升級空間。
 *
 * @param {string} file 資料檔路徑；傳入 ':memory:' 或空字串則為純記憶體模式（測試用）。
 */
export function createDb(file) {
  const memory = !file || file === ':memory:';
  const sqliteFile = memory ? ':memory:' : `${file}.sqlite3`;

  let legacyData = null;
  if (!memory) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    legacyData = migrateLegacyJsonIfPresent(file, sqliteFile);
  }

  const sqlite = new Database(sqliteFile);
  if (!memory) sqlite.pragma('journal_mode = WAL');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      json TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    )
  `);

  const data = { users: [], submissions: [], assessments: [], groups: [], goals: [], readingList: [], learningResourceClicks: [], systemStatus: [], raterInvites: [], groupInvites: [], auditLog: [], memberInvites: [] };
  let freshlySeeded = false;

  if (legacyData) {
    for (const key of COLLECTIONS) data[key] = legacyData[key];
    freshlySeeded = true;
  } else {
    const selectByCollection = sqlite.prepare('SELECT json FROM records WHERE collection = ?');
    for (const key of COLLECTIONS) {
      data[key] = selectByCollection.all(key).map((row) => JSON.parse(row.json));
    }
  }

  // Sprint 19：舊的「待加入名單」改成邀請制（見 docs/onboarding-invitations-spec.md）。
  if (migratePendingMembers(data) > 0) freshlySeeded = true;

  // 已知題庫 metadata：新增題庫時在這裡補一筆即可，不需要另外寫遷移腳本——
  // 全新安裝直接用這份清單當種子；既有資料庫（如正式站）assessments 已非空，
  // 下面會逐一補齊「已知但資料庫裡還沒有」的項目，讓新功能上線後既有資料庫也
  // 能自動長出新題庫。
  const KNOWN_ASSESSMENTS = [
    { id: 'ai-competency', name: 'AI 全方位職能實戰課前評測', description: '6 大構面、37 題李克特量表', enabled: true },
    { id: 'leadership-9d', name: '經贏® 領導力九大構面行為評量', description: '9 大構面、90 題，含反向題', enabled: true },
    { id: 'disc', name: 'DISC 行為風格評測', description: '4 大構面、32 題，風格輪廓型評量', enabled: true },
    { id: 'archetype', name: '識己®性格原型評測', description: '4 組性格光譜、40 題，16 種原創性格原型', enabled: true },
    // 領導力羅盤：預設停用，管理者在後台驗收後再啟用（enabled 只對「資料庫還沒有這筆」時作為初值）
    { id: 'leadership-compass', name: '領導力羅盤八向評測', renamedFrom: ['雙環領導羅盤', '雙環領導羅盤八大構面評測'], description: '8 構面、精簡版 32 題／完整版 69 題，含人機協作與張力指標', enabled: false },
    // 接班補充問卷：預設停用；涉及職涯與去留意向，啟用前須完成隱私政策更新與重新同意（見 docs/leadership-new/06）
    { id: 'succession-intent', name: '接班準備度評測', renamedFrom: ['接班補充問卷'], description: '4 面向、20 題，整理升任企圖、準備程度、可接受條件與長期意向（自評）', enabled: false },
  ];
  if (data.assessments.length === 0) {
    data.assessments = KNOWN_ASSESSMENTS.map(({ renamedFrom: _r, ...rest }) => rest);
    freshlySeeded = true;
  } else {
    const existingIds = new Set(data.assessments.map((a) => a.id));
    const missing = KNOWN_ASSESSMENTS.filter((a) => !existingIds.has(a.id));
    if (missing.length > 0) {
      data.assessments.push(...missing.map(({ renamedFrom: _r, ...rest }) => rest));
      freshlySeeded = true;
    }
    // 改名：資料庫裡已經有的題庫，若名稱還是「舊的預設名」就換成新名稱（管理者自己改過的名稱不動）。
    for (const known of KNOWN_ASSESSMENTS) {
      const existing = data.assessments.find((a) => a.id === known.id);
      if (existing && known.renamedFrom?.includes(existing.name)) {
        existing.name = known.name;
        freshlySeeded = true;
      }
    }
  }

  const deleteAll = sqlite.prepare('DELETE FROM records');
  const insertOne = sqlite.prepare('INSERT INTO records (collection, id, json) VALUES (?, ?, ?)');
  const persistTx = sqlite.transaction(() => {
    deleteAll.run();
    for (const key of COLLECTIONS) {
      for (const record of data[key]) {
        insertOne.run(key, String(record.id), JSON.stringify(record));
      }
    }
  });

  function persist() {
    persistTx();
  }

  // 剛完成遷移／全新安裝時立即落地一次，讓資料庫檔案從第一刻就反映記憶體內容
  // （含預設種子評量），不必等到第一次業務操作觸發 persist()。
  if (freshlySeeded) persist();

  return { data, persist };
}
