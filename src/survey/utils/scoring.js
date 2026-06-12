import {
  DIMENSIONS,
  ALL_QUESTIONS,
  TOTAL_QUESTIONS,
  MIN_TOTAL_SCORE,
  MAX_TOTAL_SCORE,
  SCALE_MIN,
  SCALE_MAX,
} from '../data/questions';
import { LEVELS, dimensionRating } from '../data/levels';

/**
 * answers 形如 { q1: 4, q2: 3, ... }，值為 1~5 的數字（或字串）。
 * 以下函式皆對「未作答 / 無效值」採容錯處理，視為未作答。
 */

function toValidScore(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < SCALE_MIN || n > SCALE_MAX) return null;
  return n;
}

/** 已作答的題數。 */
export function answeredCount(answers = {}) {
  return ALL_QUESTIONS.reduce(
    (count, q) => (toValidScore(answers[q.id]) !== null ? count + 1 : count),
    0,
  );
}

/** 是否所有題目皆已作答。 */
export function isComplete(answers = {}) {
  return answeredCount(answers) === TOTAL_QUESTIONS;
}

/** 回傳尚未作答的題目 id 陣列（依題序）。 */
export function unansweredQuestionIds(answers = {}) {
  return ALL_QUESTIONS.filter((q) => toValidScore(answers[q.id]) === null).map((q) => q.id);
}

/** 計算總分（僅加總有效作答）。 */
export function computeTotalScore(answers = {}) {
  return ALL_QUESTIONS.reduce((sum, q) => {
    const v = toValidScore(answers[q.id]);
    return v === null ? sum : sum + v;
  }, 0);
}

/** 依總分取得落點等級。低於下限回傳第一級，高於上限回傳最後一級。 */
export function getLevel(total) {
  if (total <= LEVELS[0].max) return LEVELS[0];
  if (total >= LEVELS[LEVELS.length - 1].min) return LEVELS[LEVELS.length - 1];
  return LEVELS.find((l) => total >= l.min && total <= l.max) ?? LEVELS[0];
}

/** 每個構面的得分、滿分、平均、百分比與評語。 */
export function computeDimensionScores(answers = {}) {
  return DIMENSIONS.map((dim) => {
    const max = dim.questions.length * SCALE_MAX;
    const score = dim.questions.reduce((sum, q) => {
      const v = toValidScore(answers[q.id]);
      return v === null ? sum : sum + v;
    }, 0);
    const answered = dim.questions.filter((q) => toValidScore(answers[q.id]) !== null).length;
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
    };
  });
}

/** 一次計算完整結果，供結果頁使用。 */
export function buildResult(answers = {}) {
  const total = computeTotalScore(answers);
  const dimensions = computeDimensionScores(answers);
  const strongest = dimensions.reduce((a, b) => (b.average > a.average ? b : a), dimensions[0]);
  const weakest = dimensions.reduce((a, b) => (b.average < a.average ? b : a), dimensions[0]);
  return {
    total,
    minScore: MIN_TOTAL_SCORE,
    maxScore: MAX_TOTAL_SCORE,
    percent: Math.round((total / MAX_TOTAL_SCORE) * 100),
    level: getLevel(total),
    dimensions,
    strongest,
    weakest,
    complete: isComplete(answers),
  };
}
