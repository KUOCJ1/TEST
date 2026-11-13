// 落點徽章的顯示輔助（榕光視覺系統）：題庫設定裡的徽章文字帶 emoji（🌱 📈 🚀 👑…），
// 螢幕上改用 SVG 圖示＋「成長階段」配色，emoji 只在列印報告（固定版面）保留。
// 題庫設定檔本身不動（文字不影響結構指紋與計分）。

/** 去掉開頭的 emoji 與空白：'🚀 AI 數位高潛力股' → 'AI 數位高潛力股'。 */
export function badgeText(badge = '') {
  return String(badge).replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();
}

/**
 * 這個落點在題庫等級中的「成長階段」0–3（0 探索／萌芽、1 發展、2 精熟、3 卓越）。
 * 題庫沒有等級列表（如 DISC 風格型）或找不到時回傳 null，呼叫端改用題庫自己的顏色。
 */
export function stageOf(level, config) {
  const levels = config?.LEVELS;
  if (!Array.isArray(levels) || levels.length < 2 || !level) return null;
  const idx = levels.findIndex((l) => l.id === level.id || l.badge === level.badge);
  if (idx < 0) return null;
  return Math.round((idx / (levels.length - 1)) * 3);
}

export const STAGE_NAMES = ['探索期', '發展期', '精熟期', '卓越'];

// 結果頁主標語（一句人話，取代「分數」成為主角）。
export const STAGE_HEADLINES = [
  '種子已經埋下，接下來讓它發芽',
  '你已經長出穩定的枝幹',
  '枝葉茂盛，可以帶更多人一起長',
  '你已經長成一片森林',
];
