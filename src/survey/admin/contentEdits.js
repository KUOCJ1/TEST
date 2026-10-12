// 「題庫內容」編輯器用的純函式（Sprint 10）。與伺服器 lib/assessmentContent.js 的字數上限
// 保持一致——這裡是即時提示，伺服器那邊才是真正的把關。

export const LIMITS = {
  dimensionName: 40, dimensionSubtitle: 60, subDimensionName: 40,
  question: 200, commentary: 300, levelText: 600, note: 100,
};

export const emptyEdits = () => ({ dimensions: {}, subDimensions: {}, questions: {}, commentary: {}, levels: {} });

/** 補齊缺的群組，讓編輯器永遠可以安全地讀 edits.questions[id] 這種路徑。 */
export function normalizeEdits(edits) {
  const base = emptyEdits();
  for (const group of Object.keys(base)) base[group] = { ...(edits?.[group] ?? {}) };
  return base;
}

// `questions` 的值直接是字串；其他群組是 { 欄位: 字串 }。
export function getEdit(edits, group, id, field) {
  const entry = edits?.[group]?.[id];
  if (group === 'questions') return typeof entry === 'string' ? entry : undefined;
  return typeof entry?.[field] === 'string' ? entry[field] : undefined;
}

/**
 * 設定一個欄位。空白或「跟內建原文一樣」都視為沒有覆寫、直接移除——這樣「改回原文」
 * 不會留下一筆跟內建相同的覆寫，已修改計數也才準。回傳新物件，不改動傳入的。
 */
export function setEdit(edits, group, id, field, value, builtin) {
  const next = normalizeEdits(edits);
  const clean = typeof value === 'string' ? value : '';
  const remove = clean.trim() === '' || clean === builtin;
  if (group === 'questions') {
    if (remove) delete next.questions[id]; else next.questions[id] = clean;
    return next;
  }
  const row = { ...(next[group][id] ?? {}) };
  if (remove) delete row[field]; else row[field] = clean;
  if (Object.keys(row).length) next[group][id] = row; else delete next[group][id];
  return next;
}

/** 已修改的欄位數。 */
export function countEdits(edits) {
  let n = 0;
  for (const [group, entries] of Object.entries(edits ?? {})) {
    for (const value of Object.values(entries ?? {})) {
      n += group === 'questions' ? 1 : Object.keys(value ?? {}).length;
    }
  }
  return n;
}

const stable = (v) => {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
};
/** 兩份覆寫內容是否相同（不在乎 key 順序、也不在乎有沒有空群組）。 */
export const sameEdits = (a, b) => JSON.stringify(stable(normalizeEdits(a))) === JSON.stringify(stable(normalizeEdits(b)));

/** 有沒有欄位超過字數上限（有的話不能儲存）。回傳第一個超過的欄位描述，沒有則 null。 */
export function findOverLimit(edits) {
  const limitOf = (group, field) => {
    if (group === 'questions') return LIMITS.question;
    if (group === 'dimensions') return field === 'subtitle' ? LIMITS.dimensionSubtitle : LIMITS.dimensionName;
    if (group === 'subDimensions') return LIMITS.subDimensionName;
    if (group === 'commentary') return LIMITS.commentary;
    return LIMITS.levelText;
  };
  for (const [group, entries] of Object.entries(edits ?? {})) {
    for (const [id, value] of Object.entries(entries ?? {})) {
      if (group === 'questions') {
        if (value.length > limitOf(group)) return `題目 ${id}`;
        continue;
      }
      for (const [field, text] of Object.entries(value ?? {})) {
        if (text.length > limitOf(group, field)) return `${group}.${id}.${field}`;
      }
    }
  }
  return null;
}
