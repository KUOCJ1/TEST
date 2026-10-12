import { REGISTRY } from './index.js';

// 題庫內容覆寫的套用層（Sprint 10）。
//
// 題庫本體寫在各 <題庫>.js；管理者在後台改的「文字層」欄位存在資料庫，載入後由這裡
// **就地修改**那批設定物件（`ALL_QUESTIONS`、`COMMENTARY`、`LEVELS` 都跟 `DIMENSIONS` 共用
// 同一批物件，改一處全站一致）。第一次動手前先存一份原始快照，之後每次套用都先還原
// 成快照再套覆寫——所以可以重複套用（發佈、預覽、還原），也隨時能拿到「內建原文」給編輯器顯示。
//
// 只碰白名單欄位，而且只改「原本就存在的字串欄位」：不認得的 id、不存在的欄位一律忽略，
// 計分用的欄位（reversed、min、max、題數…）根本不在這份程式碼的視野內。

const snapshots = new Map(); // assessmentId -> 內建原文

// 風格型題庫（DISC、識己®）的 LEVELS 是從 PROFILES 衍生出來的副本，風格／原型的內容本 Sprint
// 不開放編輯；改副本也不會影響實際顯示的風格說明，只會讓兩邊不一致，所以乾脆不碰。
const levelsOf = (cfg) => (cfg.PROFILE_MODE ? [] : (cfg.LEVELS ?? []));

function snapshotOf(cfg) {
  const snap = { dimensions: {}, subDimensions: {}, questions: {}, commentary: {}, levels: {} };
  for (const d of cfg.DIMENSIONS ?? []) {
    snap.dimensions[d.id] = { name: d.name, subtitle: d.subtitle };
    for (const sd of d.subDimensions ?? []) snap.subDimensions[sd.id] = { name: sd.name };
    for (const q of d.questions ?? []) snap.questions[q.id] = q.text;
  }
  for (const [subId, row] of Object.entries(cfg.COMMENTARY ?? {})) {
    snap.commentary[subId] = { high: row.high, mid: row.mid, low: row.low };
  }
  for (const l of levelsOf(cfg)) snap.levels[l.id] = { desc: l.desc, advice: l.advice };
  return snap;
}

function ensureSnapshot(id) {
  if (!snapshots.has(id)) snapshots.set(id, snapshotOf(REGISTRY[id]));
  return snapshots.get(id);
}

/** 某題庫「程式碼內建」的可編輯文字（不受已套用的覆寫影響）；沒有這個題庫回 null。 */
export function getBuiltinContent(assessmentId) {
  return REGISTRY[assessmentId] ? ensureSnapshot(assessmentId) : null;
}

/** 把快照（可帶覆寫）寫回設定物件。回傳實際套用／忽略的覆寫筆數。 */
function writeBack(cfg, base, overrides) {
  const stats = { applied: 0, ignored: 0 };
  const put = (target, field, builtin, override) => {
    // 只改原本就是字串的欄位（回傳 null＝這個欄位不適用）；覆寫要是非空字串才算數。
    if (typeof builtin !== 'string') return null;
    const useOverride = typeof override === 'string' && override.trim() !== '';
    target[field] = useOverride ? override : builtin;
    return useOverride;
  };
  const ov = overrides ?? {};
  const seen = new Set();
  const count = (group, key, hit) => { if (hit === null) return; seen.add(`${group}.${key}`); if (hit) stats.applied += 1; };

  for (const d of cfg.DIMENSIONS ?? []) {
    for (const f of ['name', 'subtitle']) {
      count('dimensions', `${d.id}.${f}`, put(d, f, base.dimensions[d.id]?.[f], ov.dimensions?.[d.id]?.[f]));
    }
    for (const sd of d.subDimensions ?? []) {
      count('subDimensions', `${sd.id}.name`, put(sd, 'name', base.subDimensions[sd.id]?.name, ov.subDimensions?.[sd.id]?.name));
    }
    for (const q of d.questions ?? []) {
      count('questions', q.id, put(q, 'text', base.questions[q.id], ov.questions?.[q.id]));
    }
  }
  for (const [subId, row] of Object.entries(cfg.COMMENTARY ?? {})) {
    for (const f of ['high', 'mid', 'low']) {
      count('commentary', `${subId}.${f}`, put(row, f, base.commentary[subId]?.[f], ov.commentary?.[subId]?.[f]));
    }
  }
  for (const l of levelsOf(cfg)) {
    for (const f of ['desc', 'advice']) {
      count('levels', `${l.id}.${f}`, put(l, f, base.levels[l.id]?.[f], ov.levels?.[l.id]?.[f]));
    }
  }

  // 覆寫裡指向不存在的 id／欄位：忽略並計數（供除錯與測試）。
  for (const [group, entries] of Object.entries(ov)) {
    for (const [key, value] of Object.entries(entries ?? {})) {
      if (typeof value === 'string') { if (!seen.has(`${group}.${key}`)) stats.ignored += 1; continue; }
      for (const f of Object.keys(value ?? {})) if (!seen.has(`${group}.${key}.${f}`)) stats.ignored += 1;
    }
  }
  return stats;
}

/**
 * 套用一整批覆寫。`contentById` 形狀同 `GET /api/assessments/content` 的 `content`：
 * `{ [assessmentId]: { version, overrides } }`。沒出現在裡面的題庫會被還原成內建原文。
 * 永遠不丟例外（壞資料頂多被忽略），套用失敗不該讓畫面打不開。
 */
export function applyContentOverrides(contentById = {}) {
  const result = {};
  for (const id of Object.keys(REGISTRY)) {
    try {
      result[id] = writeBack(REGISTRY[id], ensureSnapshot(id), contentById?.[id]?.overrides);
    } catch {
      result[id] = { applied: 0, ignored: 0 };
    }
  }
  return result;
}
