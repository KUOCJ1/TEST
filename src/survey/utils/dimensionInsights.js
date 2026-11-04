// 構面落差提示（純函式）：兩個構面的分數形成特定組合時，給一段說明與建議課程。
//
// 來源：領導力八大構面回饋語句 V5.0 的「特殊說明」（任務管理 vs 執行力）。
// 規則只看構面平均（1–5），不需要題庫設定：沒有對應構面的評量（AI 評測等）自然不會觸發。
// 門檻是暫定值，待實際施測資料累積後校準；提示文字給學員看，語氣是描述與建議，不是評斷。

export const INSIGHT_RULES = [
  {
    id: 'execution-over-task-management',
    title: '「執行力」明顯高於「任務管理」',
    // 任務管理 < 3.5、執行力 ≥ 3.5，且落差 ≥ 0.7。
    test: (a) => a['task-management'] != null && a.execution != null
      && a['task-management'] < 3.5 && a.execution >= 3.5 && a.execution - a['task-management'] >= 0.7,
    text: '您肯做事、有責任感、行動不拖延，這是很好的基礎；但任務前端的規劃——拆解、排程、資源配置與知識運用——還有空間。'
      + '常見的情形是出狀況時能迅速救火，但若前期規劃更到位，需要救火的次數會減少。'
      + '把「規劃」與「執行」串成一條完整的流程，成果會更穩定、也更有效率。',
    courses: [
      { name: '任務規劃與資源管理工作坊', purpose: '提升任務拆解、排程與資源配置能力', activity: '案例模擬、甘特圖實作、5W2H 工具應用' },
      { name: '執行效能與成果導向訓練', purpose: '強化從行動到成果的連貫性與效率', activity: '實務任務流程再設計練習' },
      { name: '任務管理＋執行力綜合演練', purpose: '模擬專案流程中的任務接手與行動實施', activity: '小組角色扮演任務、團隊衝刺任務競賽' },
    ],
  },
];

/**
 * @param {Array<{id: string, average: number}>} dimensions 構面平均（1–5）
 * @returns {Array<{id, title, text, courses}>} 觸發的提示；沒有則空陣列
 */
export function buildInsights(dimensions) {
  const avgs = {};
  for (const d of dimensions ?? []) {
    if (typeof d?.average === 'number' && d.average > 0) avgs[d.id] = d.average;
  }
  return INSIGHT_RULES.filter((r) => r.test(avgs)).map(({ id, title, text, courses }) => ({ id, title, text, courses }));
}
