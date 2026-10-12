import { REGISTRY } from './index.js';

// 作答結果（result）是送出當下算好存下來的快照，裡面帶著當時的構面名稱、副標、子能力名稱，
// 以及落點等級的說明文字。管理者改了題庫文字後（Sprint 10），舊報告若直接讀快照就會
// 看到舊字，而同一份報告裡「評語」又是從目前設定讀的——新舊並存、自相矛盾，而且「改錯字」
// 這個最常見的用途也傳不到既有報告。
//
// 所以從 API 拿到結果時，用目前的題庫文字把這些**顯示用字**更新一遍（以 id 對應）。
// 只換文字：分數、等級 id、落點、顏色、答案都不動，所以不影響任何計分。

function refreshResult(result, cfg) {
  for (const d of result.dimensions) {
    const cd = (cfg.DIMENSIONS ?? []).find((x) => x.id === d.id);
    if (!cd) continue;
    if (typeof cd.name === 'string') d.name = cd.name;
    if (typeof cd.subtitle === 'string') d.subtitle = cd.subtitle;
    for (const s of d.subs ?? []) {
      const sd = (cd.subDimensions ?? []).find((x) => x.id === s.id);
      if (sd && typeof sd.name === 'string') s.name = sd.name;
    }
  }
  // 風格型題庫的等級是從風格／原型內容衍生的，不在可編輯範圍，維持快照。
  if (result.level && !cfg.PROFILE_MODE) {
    const lv = (cfg.LEVELS ?? []).find((l) => l.id === result.level.id);
    if (lv) {
      if (typeof lv.desc === 'string') result.level.desc = lv.desc;
      if (typeof lv.advice === 'string') result.level.advice = lv.advice;
    }
  }
}

const isResult = (o) => o
  && typeof o === 'object'
  && Array.isArray(o.dimensions)
  && typeof o.total === 'number'
  && typeof o.assessmentId === 'string';

/**
 * 走過一份 API 回應，把裡面每一個「作答結果」的顯示用字換成目前題庫文字（就地修改，
 * 這份資料是剛從網路拿到的，沒有別人在用）。永遠不丟例外——更新不到就維持原樣。
 */
export function refreshResultsInPlace(data) {
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (isResult(node)) {
      const cfg = REGISTRY[node.assessmentId];
      if (cfg) { try { refreshResult(node, cfg); } catch { /* 維持快照 */ } }
      return;
    }
    for (const v of Array.isArray(node) ? node : Object.values(node)) walk(v);
  };
  walk(data);
  return data;
}
