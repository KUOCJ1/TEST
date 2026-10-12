// 題庫內容覆寫（Sprint 10）：管理者在後台改的「文字層」欄位。
//
// 題庫本體仍寫在前端的 src/survey/data/assessments/*.js（程式碼是預設值），資料庫只存
// 「被改過的欄位」。伺服器不知道前端題庫有哪些 id，所以這裡只驗形狀、key 格式與字數上限；
// 指向不存在 id 的覆寫由前端套用時忽略。
//
// 刻意只收白名單欄位——題數、反向題、分數門檻等會影響計分的東西不在內，這支 API
// 就算被亂打也改不到計分口徑。

export const HISTORY_LIMIT = 20;
export const NOTE_MAX = 100;

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_ENTRIES = 300; // 單一群組（如 questions）最多幾筆；L9D 有 90 題，留足餘裕

// 群組 → 允許的欄位與字數上限。['*'] 表示值本身就是字串（questions: {id: text}）。
const SCHEMA = {
  dimensions: { name: 40, subtitle: 60 },
  subDimensions: { name: 40 },
  questions: { '*': 200 },
  commentary: { high: 300, mid: 300, low: 300 },
  levels: { desc: 600, advice: 600 },
};

const emptyOverrides = () => ({ dimensions: {}, subDimensions: {}, questions: {}, commentary: {}, levels: {} });
export const isEmptyOverrides = (o) => Object.values(o ?? {}).every((g) => !g || Object.keys(g).length === 0);

function cleanString(v, max, where) {
  if (typeof v !== 'string') throw new Error(`${where} 必須是文字`);
  const t = v.trim();
  if (t.length > max) throw new Error(`${where} 超過 ${max} 字上限`);
  return t;
}

/**
 * 把管理者送來的覆寫清洗成白名單內的乾淨物件。空字串＝「用內建原文」，直接丟掉。
 * 格式錯誤（不是物件、未知群組／欄位、key 不合法、超過字數）拋出 Error，訊息給管理者看。
 */
export function sanitizeOverrides(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('覆寫內容格式不正確');
  const out = emptyOverrides();
  for (const group of Object.keys(input)) {
    if (!SCHEMA[group]) throw new Error(`不支援的欄位群組：${group}`);
    const entries = input[group];
    if (entries === null || typeof entries !== 'object' || Array.isArray(entries)) throw new Error(`${group} 格式不正確`);
    const keys = Object.keys(entries);
    if (keys.length > MAX_ENTRIES) throw new Error(`${group} 項目過多`);
    for (const key of keys) {
      if (!ID_RE.test(key)) throw new Error(`${group} 含不合法的代碼：${key.slice(0, 20)}`);
      const value = entries[key];
      const fields = SCHEMA[group];
      if (fields['*']) {
        const t = cleanString(value, fields['*'], `${group}.${key}`);
        if (t) out[group][key] = t;
        continue;
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${group}.${key} 格式不正確`);
      const row = {};
      for (const field of Object.keys(value)) {
        if (!(field in fields)) throw new Error(`${group}.${key} 不支援欄位：${field}`);
        const t = cleanString(value[field], fields[field], `${group}.${key}.${field}`);
        if (t) row[field] = t;
      }
      if (Object.keys(row).length) out[group][key] = row;
    }
  }
  return out;
}

export function sanitizeNote(v) {
  if (typeof v !== 'string' || !v.trim()) throw new Error('請填寫發佈備註');
  const t = v.trim();
  if (t.length > NOTE_MAX) throw new Error(`備註不可超過 ${NOTE_MAX} 字`);
  return t;
}

/** 取得（或建立空的）某題庫內容紀錄；不會寫入資料庫，呼叫端決定要不要 persist。 */
export function getContentRecord(db, assessmentId) {
  const list = db.data.assessmentContent ?? (db.data.assessmentContent = []);
  let rec = list.find((r) => r.id === assessmentId);
  if (!rec) {
    rec = { id: assessmentId, draft: null, published: null, history: [] };
    list.push(rec);
  }
  return rec;
}

/** 把一份覆寫發佈成新版本（發佈草稿與還原共用）：版本號單調遞增，歷史最多留 HISTORY_LIMIT 筆。 */
export function publishOverrides(rec, { overrides, by, byName = '', note, kind, rolledBackTo = null }) {
  const nextVersion = Math.max(rec.published?.version ?? 0, ...rec.history.map((h) => h.version)) + 1;
  const entry = {
    version: nextVersion,
    overrides,
    publishedAt: new Date().toISOString(),
    publishedBy: by,
    publishedByName: byName,
    note,
    kind,
    ...(rolledBackTo !== null && { rolledBackTo }),
  };
  rec.published = entry;
  rec.history = [entry, ...rec.history].slice(0, HISTORY_LIMIT);
  return entry;
}
