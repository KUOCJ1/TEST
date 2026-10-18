/**
 * 領導力羅盤（Leadership Compass）專用計分。
 *
 * 規格見 docs/leadership-new/04-platform-spec-v0.1.md 第 4、7 節。
 *
 * 為什麼不直接改 scoring.js：那份是 L9D／DISC／AI／識己共用的計分，L9D 要保持完全不變。
 * 這裡的計分需要「題集版本（完整／精簡）」「無法判斷」「張力指標」「自評與他評落差」，
 * 全部是純函式，不碰既有模組，也不動既有題庫的結果。
 *
 * 設定檔（config）形狀（S14 才會有實際題庫設定檔，這裡只依賴下列欄位）：
 *   SCALE_MIN / SCALE_MAX
 *   DIMENSIONS[{ id, index, name, subtitle, color, loop, subDimensions[{id,name}],
 *                questions[{ id, reversed, subId, forms?, observability?, pole? }] }]
 *   TENSIONS[{ id, dimensionId, poleA, poleB, nameA, nameB }]
 *   LOOPS[{ id, name, dimensionIds[] }]
 * 題目的 forms 預設為 ['full']；屬於精簡版的題目要含 'short'。
 *
 * ⚠️ 本檔所有切分點（等級、張力類型、落差、完成度）都是暫定值，等試測資料校準後再改；
 * 集中放在下面的常數，改這裡就好。
 */

export const NA_VALUE = 'na';

export const FORMS = ['full', 'short'];

/** 暫定切分點（⚠️ 待試測校準）。 */
export const THRESHOLDS = {
  // 構面等級（暫沿用 L9D 的結構，僅供試測）
  dimensionRating: [
    { min: 4.2, label: '精熟', tone: 'strong' },
    { min: 3.4, label: '熟練', tone: 'good' },
    { min: 2.6, label: '發展中', tone: 'mid' },
    { min: 1.8, label: '萌芽', tone: 'low' },
    { min: -Infinity, label: '待啟蒙', tone: 'weak' },
  ],
  tensionHigh: 3.5,
  tensionLow: 2.5,
  tensionSkew: 1.0,
  gap: 0.8,
  // 他評完成度：每個構面至少 60% 題目有有效分、整份至少 80%
  otherDimensionCoverage: 0.6,
  otherTotalCoverage: 0.8,
  // 匿名門檻
  minRatersPerType: 3,
  minRatersCombined: 3,
};

// ── 題集版本 ───────────────────────────────────────────────

function inForm(question, form) {
  const forms = Array.isArray(question.forms) && question.forms.length > 0 ? question.forms : ['full'];
  return forms.includes(form);
}

/**
 * 回傳只含指定版本題目的設定視圖。
 * 精簡版是完整版的子集（'full' 版含全部題目，'short' 只含標記為 short 的題）。
 * 不修改傳入的 config。
 */
export function selectForm(config, form = 'full') {
  if (!FORMS.includes(form)) throw new Error(`未知的題集版本：${form}`);
  // 完整版直接沿用原本的構面物件；精簡版用 Object.create 建立「讀得到原構面欄位、但題目被過濾」
  // 的視圖——後台覆寫（overrides.js）是就地修改原構面物件，這樣視圖不會讀到過期的名稱。
  const dimensions = form === 'full'
    ? config.DIMENSIONS
    : config.DIMENSIONS.map((d) => Object.create(d, {
      questions: { value: d.questions.filter((q) => inForm(q, form)), enumerable: true },
    }));
  const all = dimensions.flatMap((d) => d.questions);
  return {
    ...config,
    DIMENSIONS: dimensions,
    ALL_QUESTIONS: all,
    TOTAL_QUESTIONS: all.length,
    MIN_SCORE: all.length * config.SCALE_MIN,
    MAX_SCORE: all.length * config.SCALE_MAX,
    FORM: form,
  };
}

// ── 單題有效分 ─────────────────────────────────────────────

function isNa(raw) {
  return raw === NA_VALUE;
}

/**
 * 回傳該題的有效分；未答、超出範圍、或（不允許時的）無法判斷皆為 null。
 * 反向題：有效分 = SCALE_MAX + SCALE_MIN − 原始分。
 * 'na'（無法判斷）一律不產生分數；它是否合法（他評版的低可觀察題）見 questionState。
 */
export function effectiveScore(raw, question, config) {
  if (isNa(raw)) return null; // 無法判斷不產生分數；是否算「缺漏」由 questionState 依評分者與題目判斷
  const n = Number(raw);
  if (raw === null || raw === undefined || raw === '' || !Number.isFinite(n)) return null;
  if (n < config.SCALE_MIN || n > config.SCALE_MAX) return null;
  return question.reversed ? config.SCALE_MAX + config.SCALE_MIN - n : n;
}

/** 這題是否允許被標為「無法判斷」。 */
export function allowsNa(question, rater) {
  return rater === 'other' && question.observability === 'low';
}

/** 一題的狀態：'valid'｜'na'（合法的無法判斷）｜'missing'（未答或不合法）。 */
export function questionState(raw, question, config, rater = 'self') {
  if (isNa(raw)) return allowsNa(question, rater) ? 'na' : 'missing';
  return effectiveScore(raw, question, config) === null ? 'missing' : 'valid';
}

// ── 完成度 ─────────────────────────────────────────────────

/**
 * 回傳完成度細節。
 *  - 自評（rater='self'）：所有題目都要有效；不允許 na。
 *  - 他評（rater='other'）：每個構面至少 otherDimensionCoverage 的題目有有效分，
 *    且整份至少 otherTotalCoverage；na 視為缺漏（不計入分子，也不算作答錯誤）。
 *    但仍需所有題目「有被回應」（有效分或合法的 na），避免漏填被當成 na。
 */
export function completeness(answers = {}, formConfig, rater = 'self') {
  let valid = 0;
  let na = 0;
  let missing = 0;
  const dimensions = formConfig.DIMENSIONS.map((d) => {
    let dv = 0;
    let dn = 0;
    let dm = 0;
    d.questions.forEach((q) => {
      const st = questionState(answers[q.id], q, formConfig, rater);
      if (st === 'valid') dv += 1;
      else if (st === 'na') dn += 1;
      else dm += 1;
    });
    valid += dv; na += dn; missing += dm;
    return { id: d.id, total: d.questions.length, valid: dv, na: dn, missing: dm };
  });
  const total = formConfig.TOTAL_QUESTIONS;
  let complete;
  if (rater === 'self') {
    complete = total > 0 && valid === total;
  } else {
    complete = total > 0 &&
      missing === 0 &&
      valid / total >= THRESHOLDS.otherTotalCoverage &&
      dimensions.every((d) => d.total === 0 || d.valid / d.total >= THRESHOLDS.otherDimensionCoverage);
  }
  return { complete, total, valid, na, missing, dimensions };
}

export function isCompassComplete(answers, formConfig, rater = 'self') {
  return completeness(answers, formConfig, rater).complete;
}

// ── 構面／環／子面向 ──────────────────────────────────────

export function dimensionRating(average) {
  const hit = THRESHOLDS.dimensionRating.find((r) => average >= r.min);
  return { label: hit.label, tone: hit.tone };
}

function meanOf(values) {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

function scoreQuestions(questions, answers, config) {
  const scores = [];
  questions.forEach((q) => {
    const v = effectiveScore(answers[q.id], q, config);
    if (v !== null) scores.push(v);
  });
  return scores;
}

function computeSubs(dim, answers, config) {
  if (!Array.isArray(dim.subDimensions) || dim.subDimensions.length === 0) return [];
  return dim.subDimensions.map((sub) => {
    const qs = dim.questions.filter((q) => q.subId === sub.id);
    const scores = scoreQuestions(qs, answers, config);
    return { id: sub.id, name: sub.name, count: qs.length, answered: scores.length, average: meanOf(scores) ?? 0 };
  });
}

export function computeDimensions(answers = {}, formConfig) {
  return formConfig.DIMENSIONS.map((dim) => {
    const scores = scoreQuestions(dim.questions, answers, formConfig);
    const sum = scores.reduce((a, b) => a + b, 0);
    const average = meanOf(scores) ?? 0;
    // max 以「有效作答題數 × 滿分」計，這樣 na／缺漏不會拉低百分比
    const max = scores.length * formConfig.SCALE_MAX;
    return {
      id: dim.id,
      index: dim.index,
      name: dim.name,
      subtitle: dim.subtitle,
      color: dim.color,
      loop: dim.loop,
      score: sum,
      max,
      average,
      answered: scores.length,
      percent: max > 0 ? Math.round((sum / max) * 100) : 0,
      rating: dimensionRating(average),
      subs: computeSubs(dim, answers, formConfig),
    };
  });
}

export function computeLoops(dimensions, config) {
  return (config.LOOPS ?? []).map((loop) => {
    const avgs = dimensions
      .filter((d) => loop.dimensionIds.includes(d.id) && d.answered > 0)
      .map((d) => d.average);
    return { id: loop.id, name: loop.name, average: meanOf(avgs) ?? 0 };
  });
}

// ── 張力 ───────────────────────────────────────────────────

export function classifyTension(a, b) {
  const { tensionHigh, tensionLow, tensionSkew } = THRESHOLDS;
  if (a >= tensionHigh && b >= tensionHigh) return 'both_high';
  if (a < tensionLow && b < tensionLow) return 'both_low';
  if (Math.abs(a - b) >= tensionSkew) return a > b ? 'lean_a' : 'lean_b';
  return 'moderate';
}

export function computeTensions(answers = {}, formConfig) {
  const range = formConfig.SCALE_MAX - formConfig.SCALE_MIN;
  return (formConfig.TENSIONS ?? []).map((t) => {
    const dim = formConfig.DIMENSIONS.find((d) => d.id === t.dimensionId);
    const qs = dim ? dim.questions : [];
    const sa = scoreQuestions(qs.filter((q) => q.pole === t.poleA), answers, formConfig);
    const sb = scoreQuestions(qs.filter((q) => q.pole === t.poleB), answers, formConfig);
    const base = {
      id: t.id, dimensionId: t.dimensionId, poleA: t.poleA, poleB: t.poleB, nameA: t.nameA, nameB: t.nameB,
      countA: sa.length, countB: sb.length,
    };
    if (sa.length === 0 || sb.length === 0) {
      return { ...base, available: false, a: null, b: null, strength: null, skew: null, balance: null, type: null, lowConfidence: true };
    }
    const a = meanOf(sa);
    const b = meanOf(sb);
    const skew = a - b;
    return {
      ...base,
      available: true,
      a, b,
      strength: (a + b) / 2,
      skew,
      balance: 1 - Math.abs(skew) / range,
      type: classifyTension(a, b),
      // 任一端少於 2 題時，只能當參考（精簡版常見）
      lowConfidence: sa.length < 2 || sb.length < 2,
    };
  });
}

// ── 整份結果 ───────────────────────────────────────────────

/**
 * 計算一份作答的結果，形狀相容 server 的 validateResultShape
 * （total、dimensions[].id/score/max/rating.label），並附上 loops、tensions、完成度。
 * @param {object} answers
 * @param {object} config 完整設定檔（未過濾版本）
 * @param {{form?: 'full'|'short', rater?: 'self'|'other', itemVersion?: string}} opts
 */
export function buildCompassResult(answers = {}, config, { form = 'full', rater = 'self', itemVersion } = {}) {
  const fc = selectForm(config, form);
  const dimensions = computeDimensions(answers, fc);
  const answeredDims = dimensions.filter((d) => d.answered > 0);
  const total = dimensions.reduce((a, d) => a + d.score, 0);
  const maxScore = dimensions.reduce((a, d) => a + d.max, 0);
  const strongest = answeredDims.reduce((a, b) => (b.average > a.average ? b : a), answeredDims[0] ?? dimensions[0]);
  const weakest = answeredDims.reduce((a, b) => (b.average < a.average ? b : a), answeredDims[0] ?? dimensions[0]);
  const comp = completeness(answers, fc, rater);
  return {
    total,
    minScore: fc.MIN_SCORE,
    maxScore,
    percent: maxScore > 0 ? Math.round((total / maxScore) * 100) : 0,
    // 此評量不做總分分級；config.PROFILE_LEVEL 是固定的中性說明，讓共用的結果元件不必特判
    level: config.PROFILE_LEVEL ?? null,
    dimensions,
    strongest,
    weakest,
    loops: computeLoops(dimensions, fc),
    tensions: computeTensions(answers, fc),
    aiProfile: computeAiProfile(answers, fc),
    form,
    rater,
    answeredCount: comp.valid,
    naCount: comp.na,
    complete: comp.complete,
    itemVersion: itemVersion ?? config.ITEM_VERSION ?? null,
    assessmentId: config.ID,
    assessmentName: config.NAME,
  };
}

// ── 人機協作剖面 ───────────────────────────────────────────

/** 標記為 ai 的題目（散布在各構面）的整體與分構面平均；沒有有效題目時回傳 null。 */
export function computeAiProfile(answers = {}, formConfig) {
  const byDimension = [];
  const all = [];
  formConfig.DIMENSIONS.forEach((d) => {
    const scores = scoreQuestions(d.questions.filter((q) => q.ai), answers, formConfig);
    if (scores.length > 0) {
      byDimension.push({ id: d.id, name: d.name, average: meanOf(scores), count: scores.length });
      all.push(...scores);
    }
  });
  if (all.length === 0) return null;
  return { average: meanOf(all), count: all.length, byDimension };
}

// ── 自評與他評落差 ─────────────────────────────────────────

export function classifyGap(gap) {
  if (gap >= THRESHOLDS.gap) return 'blind_spot';
  if (gap <= -THRESHOLDS.gap) return 'hidden_strength';
  return 'aligned';
}

/**
 * 以同一個題集版本計算自評與他評的落差。
 * 兩邊版本不同時，呼叫端應傳 form='short'（兩版共有的子集）。
 * 他評者人數不足 minRaters 時 available=false，不給任何數字。
 * @param {{selfAnswers: object, othersAnswers: object[], config: object, form?: string, minRaters?: number}} p
 */
export function computeGaps({ selfAnswers, othersAnswers, config, form = 'full', minRaters = THRESHOLDS.minRatersCombined }) {
  const fc = selectForm(config, form);
  const usable = (othersAnswers ?? []).filter((a) => isCompassComplete(a, fc, 'other'));
  if (usable.length < minRaters) {
    return { available: false, reason: 'not_enough_raters', raters: usable.length, minRaters, dimensions: [], index: null };
  }
  const selfDims = computeDimensions(selfAnswers, fc);
  const otherDimsList = usable.map((a) => computeDimensions(a, fc));
  const dimensions = selfDims.map((sd, i) => {
    const avgs = otherDimsList.map((od) => od[i]).filter((d) => d.answered > 0).map((d) => d.average);
    if (sd.answered === 0 || avgs.length === 0) {
      return { id: sd.id, name: sd.name, self: sd.answered ? sd.average : null, others: null, gap: null, type: null };
    }
    const others = meanOf(avgs);
    const gap = sd.average - others;
    return { id: sd.id, name: sd.name, self: sd.average, others, gap, type: classifyGap(gap) };
  });
  const gaps = dimensions.filter((d) => d.gap !== null).map((d) => Math.abs(d.gap));
  return { available: true, raters: usable.length, minRaters, dimensions, index: meanOf(gaps) };
}

/**
 * 以「已彙整的構面平均」計算落差（給只拿得到彙整資料的畫面用，例如受評者端與教練端——
 * 後端不會回傳個別評分者的作答）。回傳形狀與 computeGaps 相同。
 * @param {{selfDimensions: Array<{id,name,average,answered?}>, otherDimensions: Array<{id,average}>, raters: number, minRaters?: number}} p
 */
export function gapsFromAverages({ selfDimensions, otherDimensions, raters, minRaters = THRESHOLDS.minRatersCombined }) {
  if (!Array.isArray(otherDimensions) || otherDimensions.length === 0 || raters < minRaters) {
    return { available: false, reason: 'not_enough_raters', raters: raters ?? 0, minRaters, dimensions: [], index: null };
  }
  const dimensions = (selfDimensions ?? []).map((sd) => {
    const od = otherDimensions.find((x) => x.id === sd.id);
    const selfOk = Number.isFinite(sd.average) && (sd.answered ?? 1) > 0;
    if (!selfOk || !od || !Number.isFinite(od.average)) {
      return { id: sd.id, name: sd.name, self: selfOk ? sd.average : null, others: null, gap: null, type: null };
    }
    const gap = sd.average - od.average;
    return { id: sd.id, name: sd.name, self: sd.average, others: od.average, gap, type: classifyGap(gap) };
  });
  const gaps = dimensions.filter((d) => d.gap !== null).map((d) => Math.abs(d.gap));
  return { available: true, raters, minRaters, dimensions, index: meanOf(gaps) };
}

// ── 評分者彙整與匿名門檻 ──────────────────────────────────

/**
 * 依評分者類型彙整他評，並套用匿名門檻（規格 7.2）。
 *  - peer／subordinate：該類 ≥ minRatersPerType 才單獨顯示；不足則併入「合計」。
 *  - 合計（peer+subordinate，若 includeManager 則含上級）≥ minRatersCombined 才顯示。
 *  - manager：永遠單獨列出，標記 requiresConsent（需受評者同意才可顯示）；預設不併入合計。
 * 回傳不含任何評分者身分。raters: [{ raterType, answers }]
 */
export function aggregateRaters(raters = [], config, { form = 'full', includeManager = false } = {}) {
  const fc = selectForm(config, form);
  const valid = raters.filter((r) => r && isCompassComplete(r.answers, fc, 'other'));
  const averageOf = (list) => {
    const dimsList = list.map((r) => computeDimensions(r.answers, fc));
    return fc.DIMENSIONS.map((d, i) => {
      const avgs = dimsList.map((x) => x[i]).filter((x) => x.answered > 0).map((x) => x.average);
      return { id: d.id, name: d.name, average: meanOf(avgs) };
    });
  };
  const byType = {};
  const pooled = [];
  ['peer', 'subordinate'].forEach((type) => {
    const list = valid.filter((r) => r.raterType === type);
    const shown = list.length >= THRESHOLDS.minRatersPerType;
    byType[type] = { count: list.length, shown, dimensions: shown ? averageOf(list) : null };
    pooled.push(...list);
  });
  const mgr = valid.filter((r) => r.raterType === 'manager');
  byType.manager = { count: mgr.length, shown: false, requiresConsent: true, dimensions: mgr.length ? averageOf(mgr) : null };
  if (includeManager) pooled.push(...mgr);
  const combinedShown = pooled.length >= THRESHOLDS.minRatersCombined;
  return {
    byType,
    combined: {
      count: pooled.length,
      shown: combinedShown,
      reason: combinedShown ? null : 'not_enough_raters',
      dimensions: combinedShown ? averageOf(pooled) : null,
    },
  };
}
