/**
 * Generic scoring utilities — work with any assessment config.
 * Config shape: { SCALE_MIN, SCALE_MAX, DIMENSIONS, ALL_QUESTIONS, TOTAL_QUESTIONS,
 *                 MIN_SCORE, MAX_SCORE, LEVELS, dimensionRating }
 * Questions may have `reversed: true` → score is inverted: (SCALE_MAX + SCALE_MIN - raw).
 *
 * PROFILE_MODE（選填，預設 false）：像 DISC 這種構面之間沒有優劣、不適合加總成單一
 * 總分的「風格輪廓」題庫可設為 true。設定後 buildResult() 的 level 改由
 * getProfileLevel() 依最高兩個構面的組合查 config.PROFILES 取得，而不是用 total
 * 對照 config.LEVELS。未設定時行為與過去完全相同。
 */

function toValidScore(raw, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function effectiveScore(raw, question, scaleMin, scaleMax) {
  const v = toValidScore(raw, scaleMin, scaleMax);
  if (v === null) return null;
  return question.reversed ? scaleMax + scaleMin - v : v;
}

export function answeredCount(answers = {}, config) {
  const { ALL_QUESTIONS, SCALE_MIN, SCALE_MAX } = config;
  return ALL_QUESTIONS.reduce(
    (n, q) => (effectiveScore(answers[q.id], q, SCALE_MIN, SCALE_MAX) !== null ? n + 1 : n),
    0,
  );
}

export function isComplete(answers = {}, config) {
  return answeredCount(answers, config) === config.TOTAL_QUESTIONS;
}

export function unansweredQuestionIds(answers = {}, config) {
  const { ALL_QUESTIONS, SCALE_MIN, SCALE_MAX } = config;
  return ALL_QUESTIONS
    .filter((q) => effectiveScore(answers[q.id], q, SCALE_MIN, SCALE_MAX) === null)
    .map((q) => q.id);
}

export function computeTotalScore(answers = {}, config) {
  const { ALL_QUESTIONS, SCALE_MIN, SCALE_MAX } = config;
  return ALL_QUESTIONS.reduce((sum, q) => {
    const v = effectiveScore(answers[q.id], q, SCALE_MIN, SCALE_MAX);
    return v === null ? sum : sum + v;
  }, 0);
}

export function getLevel(total, config) {
  const { LEVELS } = config;
  if (total <= LEVELS[0].max) return LEVELS[0];
  if (total >= LEVELS[LEVELS.length - 1].min) return LEVELS[LEVELS.length - 1];
  return LEVELS.find((l) => total >= l.min && total <= l.max) ?? LEVELS[0];
}

/**
 * PROFILE_MODE 專用：像 DISC 這類「風格輪廓」題庫，構面之間沒有優劣之分，把
 * 全部構面加總成一個「總分」再對照成熟度級距沒有心理計量意義（D+I+S+C 加起來
 * 不代表任何真實構念），也不該自動把某個構面標成「待強化」。
 *
 * 因此不用 getLevel(total) 的「總分 → 級距」邏輯，改成「分數最高的兩個構面
 * （不分順序）→ 查表對應的風格組合」，回傳形狀跟 LEVELS 條目完全一樣
 * （{badge, badgeEn, color, desc, advice}），讓 ResultPanel／PrintableReport／
 * GroupWorkspace 等既有元件不用另外判斷就能正常渲染 result.level。
 *
 * config.PROFILES 為物件，key 是排序後的構面 id 組合（如 'c1+c2'，字母序排列、
 * 用 '+' 相接），涵蓋任兩個構面的所有組合。
 */
export function getProfileLevel(dimensions, config) {
  const sorted = [...dimensions].sort((a, b) => b.average - a.average);
  const [top1, top2] = sorted;
  const key = [top1.id, top2.id].sort().join('+');
  return config.PROFILES[key] ?? config.PROFILES.default;
}

/**
 * 依子能力（question.subId）分組計算各子能力的平均分。
 * 僅在 dimension 設有 subDimensions 時回傳，否則回傳空陣列（向後相容）。
 */
function computeSubScores(dim, answers, scaleMin, scaleMax) {
  if (!Array.isArray(dim.subDimensions) || dim.subDimensions.length === 0) return [];
  return dim.subDimensions.map((sub) => {
    const qs = dim.questions.filter((q) => q.subId === sub.id);
    let sum = 0;
    let answered = 0;
    qs.forEach((q) => {
      const v = effectiveScore(answers[q.id], q, scaleMin, scaleMax);
      if (v !== null) { sum += v; answered += 1; }
    });
    return {
      id: sub.id,
      name: sub.name,
      count: qs.length,
      average: answered > 0 ? sum / answered : 0,
    };
  });
}

export function computeDimensionScores(answers = {}, config) {
  const { DIMENSIONS, SCALE_MIN, SCALE_MAX, dimensionRating } = config;
  return DIMENSIONS.map((dim) => {
    const max = dim.questions.length * SCALE_MAX;
    const score = dim.questions.reduce((sum, q) => {
      const v = effectiveScore(answers[q.id], q, SCALE_MIN, SCALE_MAX);
      return v === null ? sum : sum + v;
    }, 0);
    const answered = dim.questions.filter(
      (q) => effectiveScore(answers[q.id], q, SCALE_MIN, SCALE_MAX) !== null,
    ).length;
    const average = answered > 0 ? score / answered : 0;
    const percent = max > 0 ? Math.round((score / max) * 100) : 0;
    return {
      id: dim.id,
      index: dim.index,
      name: dim.name,
      subtitle: dim.subtitle,
      color: dim.color,
      score,
      max,
      average,
      percent,
      rating: dimensionRating(average),
      subs: computeSubScores(dim, answers, SCALE_MIN, SCALE_MAX),
    };
  });
}

export function buildResult(answers = {}, config) {
  const total = computeTotalScore(answers, config);
  const dimensions = computeDimensionScores(answers, config);
  const strongest = dimensions.reduce((a, b) => (b.average > a.average ? b : a), dimensions[0]);
  const weakest = dimensions.reduce((a, b) => (b.average < a.average ? b : a), dimensions[0]);
  const level = config.PROFILE_MODE ? getProfileLevel(dimensions, config) : getLevel(total, config);
  return {
    total,
    minScore: config.MIN_SCORE,
    maxScore: config.MAX_SCORE,
    percent: Math.round((total / config.MAX_SCORE) * 100),
    level,
    dimensions,
    strongest,
    weakest,
    complete: isComplete(answers, config),
    assessmentId: config.ID,
    assessmentName: config.NAME,
  };
}
