// 構面 → 第二大腦（brain.rong-rise.com）搜尋關鍵字對照表。
//
// 範圍刻意限縮在使用者核准的「技術深讀／管理心理學／人才策略」三個分類——
// 第二大腦全庫還有「國際視野」「政策與法規」「顧問專案」等偏內部研究筆記或
// 未必適合直接曝光給受測者的內容，這裡只挑跟評測構面直接相關的關鍵字，不做
// 全庫檢索，避免意外推薦到不合適的文章。
//
// 部分構面（標 low confidence 的）在這三個分類裡不一定真的查得到對應文章；
// 查無結果時 /api/learning-resources 會回空陣列，前端「延伸閱讀」區塊也會
// 依平台既有慣例直接不顯示，不會出現空白區塊或錯誤。
//
// key 為 `${assessmentId}:${dimensionId}`。
export const DIMENSION_TOPICS = {
  // AI 全方位職能實戰評測
  'ai-competency:foundation': 'AI 工具',
  'ai-competency:communication': '提示詞',
  'ai-competency:workflow': '工作流',
  'ai-competency:collaboration': '多模態',
  'ai-competency:innovation': 'AI Agent',
  'ai-competency:safety': 'AI 風險', // low confidence：可能得跨「政策與法規」才查得到

  // 經贏® 領導力九大構面行為評量
  'leadership-9d:communication': '溝通',
  'leadership-9d:collaboration': '團隊信任',
  'leadership-9d:task-management': '時間管理', // low confidence
  'leadership-9d:execution': '執行力',
  'leadership-9d:self-development': '自我覺察',
  'leadership-9d:developing-others': '人才發展',
  'leadership-9d:leadership-impact': '領導風格',
  'leadership-9d:critical-thinking': '決策',
  'leadership-9d:succession-readiness': '接班',

  // DISC 行為風格評測
  'disc:dominance': '決斷力',
  'disc:influence': '影響力',
  'disc:steadiness': '團隊穩定', // low confidence
  'disc:conscientiousness': '邏輯分析',

  // 識己®性格原型評測
  'archetype:energy': '內向外向',
  'archetype:information': '思維模式', // low confidence
  'archetype:decision': '決策',
  'archetype:lifestyle': '習慣', // low confidence
};

export function getTopicKeyword(assessmentId, dimensionId) {
  return DIMENSION_TOPICS[`${assessmentId}:${dimensionId}`] ?? null;
}
