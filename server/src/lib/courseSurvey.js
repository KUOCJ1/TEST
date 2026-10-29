// 課後學習成效問卷（ai-course-post）：答案清洗、計分與班級彙總。
// 題目文字與解析在前端 src/survey/data/assessments/ai-course-post.js；這裡只放「伺服器需要信任的部分」：
// 欄位白名單與範圍、情境題標準答案、構面對應、結果組裝、彙總。前端的題目結構必須和這裡一致，
// 有測試檢查（src/test/course-survey-parity.test.js）。設計稿：docs/post-course-survey-design.md。

export const COURSE_SURVEY_ID = 'ai-course-post';
export const COURSE_SURVEY_NAME = 'AI 深度整合工作坊｜課後學習成效問卷';
export const COURSE_ITEM_VERSION = '2026-10-30';

/** 構面（沿用課前評測 ai-competency 的 id 與順序，才能在同一張圖比較）與各自對應的 B 題。 */
export const COURSE_DIMENSIONS = [
  { id: 'foundation', name: '工具認知與基礎操作', subtitle: '基礎力', color: '#2b6cb0', items: [1, 2] },
  { id: 'communication', name: '提示詞工程與脈絡設計', subtitle: '溝通力', color: '#2f855a', items: [3, 4] },
  { id: 'workflow', name: '工作流程整合與 AI 代理', subtitle: '應用力', color: '#dd6b20', items: [5, 6] },
  { id: 'collaboration', name: '生成物件精緻化與跨模態應用', subtitle: '協作力', color: '#805ad5', items: [9, 10] },
  { id: 'innovation', name: '專屬 AI 應用開發與品質驗證', subtitle: '創新力', color: '#d53f8c', items: [7, 8] },
  { id: 'safety', name: 'AI 資訊素養、風險與治理', subtitle: '安全思維力', color: '#319795', items: [11, 12] },
];

/** 情境檢核標準答案（選項順序刻意打散，避免答案總在同一個位置）。 */
export const SJT_KEY = { c1: 'b', c2: 'c', c3: 'a', c4: 'b', c5: 'c', c6: 'a' };
export const SJT_DIMENSION = { c1: 'workflow', c2: 'communication', c3: 'safety', c4: 'innovation', c5: 'foundation', c6: 'collaboration' };

export const BARRIER_CODES = ['time', 'license', 'policy', 'data', 'unsure', 'support', 'other'];
export const MODULE_COUNT = 6;
export const MAX_TEXT = { d6: 500, e1: 1000, e2: 1000, e3: 1000 };

/** 完成作答所必填的欄位（開放題與 D5、D6 可略過）。 */
export function requiredKeys() {
  const keys = [];
  for (let i = 1; i <= 9; i++) keys.push(`a${i}`);
  for (let i = 1; i <= MODULE_COUNT; i++) keys.push(`a10_${i}`);
  for (let i = 1; i <= 12; i++) keys.push(`b${i}_before`, `b${i}_now`);
  for (let i = 1; i <= 6; i++) keys.push(`c${i}`);
  for (let i = 1; i <= 4; i++) keys.push(`d${i}`);
  keys.push('d7');
  return keys;
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * 清洗並驗證答案：只留白名單欄位、檢查範圍、截斷文字。
 * @returns {{answers: object} | {error: string}}
 */
export function sanitizeCourseAnswers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: '缺少作答內容' };
  const out = {};
  const likert = (key) => {
    if (input[key] === undefined || input[key] === null || input[key] === '') return;
    if (!isInt(input[key], 1, 5)) throw new Error(`${key} 必須是 1 到 5 的整數`);
    out[key] = input[key];
  };
  try {
    for (let i = 1; i <= 8; i++) likert(`a${i}`);
    if (input.a9 !== undefined && input.a9 !== null && input.a9 !== '') {
      if (!isInt(input.a9, 0, 10)) throw new Error('a9 必須是 0 到 10 的整數');
      out.a9 = input.a9;
    }
    for (let i = 1; i <= MODULE_COUNT; i++) likert(`a10_${i}`);
    for (let i = 1; i <= 12; i++) { likert(`b${i}_before`); likert(`b${i}_now`); }
    for (let i = 1; i <= 6; i++) {
      const v = input[`c${i}`];
      if (v === undefined || v === null || v === '') continue;
      if (!['a', 'b', 'c'].includes(v)) throw new Error(`c${i} 的選項不正確`);
      out[`c${i}`] = v;
    }
    for (let i = 1; i <= 4; i++) likert(`d${i}`);
    if (input.d5 !== undefined && input.d5 !== null) {
      if (!Array.isArray(input.d5) || input.d5.length > BARRIER_CODES.length) throw new Error('d5 格式不正確');
      const picked = [...new Set(input.d5)];
      if (picked.some((c) => !BARRIER_CODES.includes(c))) throw new Error('d5 有不認得的選項');
      out.d5 = picked;
    }
    if (input.d7 !== undefined && input.d7 !== null && input.d7 !== '') {
      if (input.d7 !== 'yes' && input.d7 !== 'no') throw new Error('d7 必須是 yes 或 no');
      out.d7 = input.d7;
    }
    for (const [key, max] of Object.entries(MAX_TEXT)) {
      if (input[key] === undefined || input[key] === null) continue;
      if (typeof input[key] !== 'string') throw new Error(`${key} 必須是文字`);
      const text = input[key].trim().slice(0, max);
      if (text) out[key] = text;
    }
  } catch (e) {
    return { error: e.message };
  }
  const missing = requiredKeys().filter((k) => out[k] === undefined);
  if (missing.length > 0) return { error: `還有 ${missing.length} 題沒有作答`, missing };
  return { answers: out };
}

const round1 = (n) => Math.round(n * 10) / 10;
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function dimensionRating(average) {
  if (average >= 4.2) return { label: '精熟', tone: 'strong' };
  if (average >= 3.4) return { label: '熟練', tone: 'good' };
  if (average >= 2.6) return { label: '發展中', tone: 'mid' };
  if (average >= 1.8) return { label: '萌芽', tone: 'low' };
  return { label: '待啟蒙', tone: 'weak' };
}

/** 由（已清洗的）答案組出結果快照。構面的 score 是「現在」的得分，before 是課前回溯。 */
export function buildCourseResult(a) {
  const dimensions = COURSE_DIMENSIONS.map((d) => {
    const nowVals = d.items.map((i) => a[`b${i}_now`]);
    const beforeVals = d.items.map((i) => a[`b${i}_before`]);
    const now = mean(nowVals);
    const before = mean(beforeVals);
    return {
      id: d.id, name: d.name, subtitle: d.subtitle, color: d.color,
      score: nowVals.reduce((s, x) => s + x, 0),
      max: d.items.length * 5,
      average: round1(now),
      percent: Math.round((now / 5) * 100),
      before: round1(before),
      gain: round1(now - before),
      rating: dimensionRating(now),
    };
  });
  const sjt = Object.keys(SJT_KEY).map((id) => ({
    id, dimensionId: SJT_DIMENSION[id], answer: a[id], correctAnswer: SJT_KEY[id], correct: a[id] === SJT_KEY[id],
  }));
  const correct = sjt.filter((s) => s.correct).length;
  return {
    assessmentId: COURSE_SURVEY_ID,
    assessmentName: COURSE_SURVEY_NAME,
    itemVersion: COURSE_ITEM_VERSION,
    total: correct,
    minScore: 0,
    maxScore: sjt.length,
    percent: Math.round((correct / sjt.length) * 100),
    level: {
      id: 'course-post', badge: '課後問卷已完成', badgeEn: 'Survey completed', color: '#2c5282',
      desc: '感謝填答。你的「課前 vs 現在」自評與情境檢核結果在下方；這不是考試，用來看見這一天的學習。',
      advice: '把你承諾的第一個一週衝刺訂成目標，下週五之前看見結果。',
    },
    dimensions,
    complete: true,
    course: {
      satisfaction: a.a8,
      recommend: a.a9,
      sjt,
      followUpConsent: a.d7 === 'yes',
    },
  };
}

// ── 班級彙總（只回彙總，不含姓名；少於 MIN_N 人的項目不顯示）─────────────────────────────────
export const MIN_N = 3;

const stat = (xs) => (xs.length >= MIN_N ? { n: xs.length, mean: round1(mean(xs)) } : { n: xs.length, hidden: true });

/**
 * @param {Array<{answers: object, createdAt: string}>} subs  每位學員最新一筆（已通過清洗）
 * @param {number} expected 應填人數（班級成員，不含被排除者）
 */
export function summarizeCourseSurvey(subs, expected) {
  const n = subs.length;
  const base = { expected, completed: n, completionRate: expected > 0 ? Math.round((n / expected) * 100) : 0, minN: MIN_N };
  if (n < MIN_N) return { ...base, hidden: true };
  const col = (key) => subs.map((s) => s.answers[key]).filter((v) => typeof v === 'number');
  const promoters = col('a9').filter((v) => v >= 9).length;
  const detractors = col('a9').filter((v) => v <= 6).length;
  const satisfaction = {};
  for (let i = 1; i <= 8; i++) satisfaction[`a${i}`] = stat(col(`a${i}`));
  const modules = [];
  for (let i = 1; i <= MODULE_COUNT; i++) modules.push(stat(col(`a10_${i}`)));
  const dimensions = COURSE_DIMENSIONS.map((d) => {
    const before = subs.map((s) => mean(d.items.map((i) => s.answers[`b${i}_before`])));
    const now = subs.map((s) => mean(d.items.map((i) => s.answers[`b${i}_now`])));
    return {
      id: d.id, name: d.name, subtitle: d.subtitle,
      before: round1(mean(before)), now: round1(mean(now)), gain: round1(mean(now) - mean(before)),
      improved: now.filter((v, idx) => v > before[idx]).length,
    };
  });
  const sjt = Object.keys(SJT_KEY).map((id) => ({
    id, dimensionId: SJT_DIMENSION[id], correct: subs.filter((s) => s.answers[id] === SJT_KEY[id]).length, n,
  }));
  const barriers = Object.fromEntries(BARRIER_CODES.map((c) => [c, subs.filter((s) => (s.answers.d5 ?? []).includes(c)).length]));
  const texts = (key) => subs.map((s) => s.answers[key]).filter(Boolean).sort((x, y) => x.localeCompare(y, 'zh-Hant'));
  return {
    ...base,
    hidden: false,
    satisfaction,
    nps: {
      n: col('a9').length,
      promoters, detractors,
      score: Math.round(((promoters - detractors) / n) * 100),
    },
    modules,
    dimensions,
    sjt,
    commitment: {
      d1: stat(col('d1')), d2: stat(col('d2')), d3: stat(col('d3')), d4: stat(col('d4')),
    },
    barriers,
    followUpConsent: subs.filter((s) => s.answers.d7 === 'yes').length,
    // 開放題：不附姓名、依文字排序（不洩漏作答先後）。
    openText: { d6: texts('d6'), e1: texts('e1'), e2: texts('e2'), e3: texts('e3') },
  };
}
