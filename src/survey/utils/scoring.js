/**
 * Generic scoring utilities — work with any assessment config.
 * Config shape: { SCALE_MIN, SCALE_MAX, DIMENSIONS, ALL_QUESTIONS, TOTAL_QUESTIONS,
 *                 MIN_SCORE, MAX_SCORE, LEVELS, dimensionRating }
 * Questions may have `reversed: true` → score is inverted: (SCALE_MAX + SCALE_MIN - raw).
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
  return {
    total,
    minScore: config.MIN_SCORE,
    maxScore: config.MAX_SCORE,
    percent: Math.round((total / config.MAX_SCORE) * 100),
    level: getLevel(total, config),
    dimensions,
    strongest,
    weakest,
    complete: isComplete(answers, config),
    assessmentId: config.ID,
    assessmentName: config.NAME,
  };
}
