import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const COLLECTIONS = ['users', 'submissions', 'assessments', 'groups', 'goals'];

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
  } catch {
    // 舊檔毀損或不是合法 JSON：視為沒有舊資料可遷移，走全新安裝流程。
    return null;
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

  const data = { users: [], submissions: [], assessments: [], groups: [], goals: [] };
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

  // 已知題庫 metadata：新增題庫時在這裡補一筆即可，不需要另外寫遷移腳本——
  // 全新安裝直接用這份清單當種子；既有資料庫（如正式站）assessments 已非空，
  // 下面會逐一補齊「已知但資料庫裡還沒有」的項目，讓新功能上線後既有資料庫也
  // 能自動長出新題庫。
  const KNOWN_ASSESSMENTS = [
    { id: 'ai-competency', name: 'AI 全方位職能實戰課前評測', description: '6 大構面、37 題李克特量表', enabled: true },
    { id: 'leadership-9d', name: '經贏® 領導力九大構面行為評量', description: '9 大構面、90 題，含反向題', enabled: true },
    { id: 'disc', name: 'DISC 行為風格評測', description: '4 大構面、32 題，風格輪廓型評量', enabled: true },
  ];
  if (data.assessments.length === 0) {
    data.assessments = KNOWN_ASSESSMENTS;
    freshlySeeded = true;
  } else {
    const existingIds = new Set(data.assessments.map((a) => a.id));
    const missing = KNOWN_ASSESSMENTS.filter((a) => !existingIds.has(a.id));
    if (missing.length > 0) {
      data.assessments.push(...missing);
      freshlySeeded = true;
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
