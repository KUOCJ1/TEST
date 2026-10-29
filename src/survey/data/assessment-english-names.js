/**
 * 各評測的英文名稱（首頁與「我的評量」卡片顯示用）。
 *
 * 獨立成小檔：首頁與卡片都要用，但不該為了一行字把整包題庫設定拉進來。
 * 註：這些是對外說明用的英文名稱，不是商標註冊名稱；經贏®、識己® 的英文品牌用法
 * 待商標檢索後再確認。新增評測時要補一筆（assessment-summary 測試會檢查）。
 */
export const ENGLISH_NAMES = {
  'ai-competency': 'AI Competency Readiness Assessment',
  'leadership-9d': 'Leadership 9-Dimension Behavioral Assessment (L9D)',
  disc: 'DISC Behavioral Style Assessment',
  archetype: 'Personality Archetype Assessment',
  'leadership-compass': 'Leadership Compass Assessment',
  'succession-intent': 'Succession Readiness Assessment',
  'ai-course-post': 'Post-Workshop Learning Survey',
};

export const englishNameOf = (id) => ENGLISH_NAMES[id] ?? null;
