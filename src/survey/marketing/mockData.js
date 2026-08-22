// 範例報告頁（ShowcasePage）專用的示意資料。刻意沿用 ai-competency 題庫實際的
// 構面命名與配色，讓範例看起來貼近真實報告，但數值全部是虛構的，不對應任何真人。

export const SHOWCASE_DIMENSIONS = [
  { id: 'foundation', name: '工具認知與基礎操作', subtitle: '基礎力', color: '#2b6cb0' },
  { id: 'communication', name: '提示詞工程與對話技巧', subtitle: '溝通力', color: '#2f855a' },
  { id: 'workflow', name: '工作流程整合與知識管理', subtitle: '應用力', color: '#dd6b20' },
  { id: 'collaboration', name: '生成物件精緻化與跨模態應用', subtitle: '協作力', color: '#805ad5' },
  { id: 'innovation', name: '專屬 AI 應用開發與客製化', subtitle: '創新力', color: '#d53f8c' },
  { id: 'safety', name: 'AI 資訊素養與風險管理', subtitle: '安全思維力', color: '#319795' },
];

const withPercent = (percents) =>
  SHOWCASE_DIMENSIONS.map((d, i) => ({ ...d, percent: percents[i] }));

// 個人雷達圖：實線（個人）vs 虛線（班級平均）。
export const SHOWCASE_SELF_DIMENSIONS = withPercent([82, 68, 74, 58, 46, 90]);
export const SHOWCASE_COHORT_COMPARE = withPercent([65, 60, 62, 55, 50, 70]).map((d) => ({
  id: d.id,
  percent: d.percent,
}));

// 歷次總分趨勢（課前 → 三次複測），滿分 185。
export const SHOWCASE_TREND_POINTS = [
  { label: '課前', value: 108 },
  { label: '複測一', value: 126 },
  { label: '複測二', value: 145 },
  { label: '複測三', value: 158 },
];
export const SHOWCASE_TREND_RANGE = { min: 37, max: 185 };

// 課前 → 最新一次的增益卡片。
export const SHOWCASE_GAIN = {
  pre: 108,
  post: 158,
  delta: 50,
  topDimension: '創新力',
  topDelta: 24,
};

// 構面 × 成員熱力圖：5 位示意學員，刻意讓「創新力」整體偏弱，展示教練能一眼
// 看出「這班哪個構面弱」的效果。
export const SHOWCASE_MEMBER_ROWS = [
  { userId: 'm1', name: '陳＊婷', percents: [92, 88, 85, 80, 75, 90] },
  { userId: 'm2', name: '林＊傑', percents: [65, 60, 55, 50, 45, 70] },
  { userId: 'm3', name: '王＊穎', percents: [78, 72, 68, 60, 55, 80] },
  { userId: 'm4', name: '張＊豪', percents: [55, 50, 48, 40, 35, 60] },
  { userId: 'm5', name: '李＊廷', percents: [88, 82, 79, 74, 68, 85] },
].map((m) => ({
  userId: m.userId,
  name: m.name,
  submission: {
    result: {
      dimensions: SHOWCASE_DIMENSIONS.map((d, i) => ({ id: d.id, percent: m.percents[i] })),
    },
  },
}));
