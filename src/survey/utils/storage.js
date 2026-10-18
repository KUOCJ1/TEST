// localStorage 安全讀寫小工具（SSR / 隱私模式 / 解析失敗皆容錯）。

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage 不可用時靜默忽略 */
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// 登出時清掉這台裝置上屬於「某個人」的資料（作答草稿、AI 小幫手對話、教練評語草稿），
// 避免共用電腦時下一位登入者看到上一位的內容。深色模式這類裝置偏好保留。
const PERSONAL_PREFIXES = ['aiassess_draft_', 'aiassess_chat_', 'aiassess_comment_draft_', 'aiassess_comment_templates'];
export function clearPersonalLocalData() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
    keys.filter((k) => k && PERSONAL_PREFIXES.some((p) => k.startsWith(p))).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* localStorage 不可用時略過 */
  }
}
