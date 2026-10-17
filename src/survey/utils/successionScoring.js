// 接班準備度評測（succession-intent）的計分。不做總分分級與排名；每個面向只輸出平均與「傾向」描述。
// 規格：docs/leadership-new/06-succession-questionnaire-v0.1.md
// 「長期意向」面向的題目可選答（NA_VALUE），不影響完成度。

export const NA_VALUE = 'na';

/** 傾向的切分點（⚠️ 暫定，待試測校準）。 */
export const STANCE_BANDS = { clear: 4.0, open: 3.0 };

export function stanceOf(average) {
  if (average >= STANCE_BANDS.clear) return { label: '明確', tone: 'strong', band: 'high' };
  if (average >= STANCE_BANDS.open) return { label: '開放', tone: 'good', band: 'mid' };
  return { label: '保留', tone: 'mid', band: 'low' };
}

function effective(raw, q, cfg) {
  if (raw === NA_VALUE) return null;
  const n = Number(raw);
  if (raw === null || raw === undefined || raw === '' || !Number.isFinite(n)) return null;
  if (n < cfg.SCALE_MIN || n > cfg.SCALE_MAX) return null;
  return q.reversed ? cfg.SCALE_MAX + cfg.SCALE_MIN - n : n;
}

const state = (raw, q, cfg) => {
  if (raw === NA_VALUE) return q.optional ? 'na' : 'missing';
  return effective(raw, q, cfg) === null ? 'missing' : 'valid';
};

export function completeness(answers, cfg) {
  let valid = 0; let na = 0; let missing = 0;
  cfg.ALL_QUESTIONS.forEach((q) => {
    const s = state(answers[q.id], q, cfg);
    if (s === 'valid') valid += 1; else if (s === 'na') na += 1; else missing += 1;
  });
  return { valid, na, missing, complete: missing === 0 };
}

export function unansweredQuestionIds(answers, cfg) {
  return cfg.ALL_QUESTIONS.filter((q) => state(answers[q.id], q, cfg) === 'missing').map((q) => q.id);
}

export function buildResult(answers, cfg) {
  const dimensions = cfg.DIMENSIONS.map((d) => {
    const scores = d.questions.map((q) => effective(answers[q.id], q, cfg)).filter((v) => v !== null);
    const sum = scores.reduce((a, b) => a + b, 0);
    const average = scores.length ? sum / scores.length : 0;
    const max = scores.length * cfg.SCALE_MAX;
    const stance = stanceOf(average);
    return {
      id: d.id, index: d.index, name: d.name, subtitle: d.subtitle, color: d.color,
      score: sum, max, average, answered: scores.length,
      optionalSkipped: d.questions.filter((q) => q.optional && state(answers[q.id], q, cfg) === 'na').length,
      percent: max > 0 ? Math.round((sum / max) * 100) : 0,
      rating: { label: stance.label, tone: stance.tone },
      stance: stance.band,
    };
  });
  const total = dimensions.reduce((a, d) => a + d.score, 0);
  const maxScore = dimensions.reduce((a, d) => a + d.max, 0);
  const c = completeness(answers, cfg);
  return {
    total, minScore: cfg.MIN_SCORE, maxScore,
    percent: maxScore > 0 ? Math.round((total / maxScore) * 100) : 0,
    level: cfg.PROFILE_LEVEL,
    dimensions,
    strongest: dimensions[0], weakest: dimensions[0],
    answeredCount: c.valid, naCount: c.na, complete: c.complete,
    assessmentId: cfg.ID, assessmentName: cfg.NAME,
  };
}
