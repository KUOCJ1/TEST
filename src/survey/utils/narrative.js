/**
 * 敘事評語組裝 — 把各子能力的單句評語，依連接詞模板串接成自然、富變化的完整段落。
 *
 * 設計重點：
 * - 分段門檻沿用評分標準對應表：平均 ≥4.5 → high；3.5–<4.5 → mid；<3.5 → low。
 * - 模板（開場句／連接詞／收尾句）預先備多組，以 seed 取模選用 →
 *   「同一份報告穩定不亂跳，但跨構面、跨受測者自然有變化」。
 * - 評語內容來自題庫設定的 config.COMMENTARY；無設定則回傳空字串（呼叫端不顯示）。
 */

export function bandOf(average) {
  if (average >= 4.5) return 'high';
  if (average >= 3.5) return 'mid';
  return 'low';
}

const TEMPLATES = {
  openers: {
    high: [
      (dim) => `在「${dim}」構面，您展現出相當成熟的行為樣貌——`,
      (dim) => `「${dim}」是您明顯的優勢所在。`,
      (dim) => `綜觀「${dim}」，您的整體表現相當亮眼：`,
    ],
    mid: [
      (dim) => `在「${dim}」構面，您已建立穩定的行為基礎。`,
      (dim) => `「${dim}」方面，您的整體表現穩健——`,
      (dim) => `就「${dim}」而言，您具備可靠的基本功：`,
    ],
    low: [
      (dim) => `「${dim}」是您目前最值得投入的成長區。`,
      (dim) => `在「${dim}」構面，仍有明顯的提升空間——`,
      (dim) => `「${dim}」方面，建議列為近期的優先發展重點：`,
    ],
  },
  // 相鄰子能力「同方向」時使用（皆為正向或皆為待強化）
  additive: ['同時，', '此外，', '不僅如此，', '與此呼應的是，', '另外，'],
  // 相鄰子能力「轉向」時使用（優勢 ↔ 待強化之間的轉折）
  contrast: ['相對地，', '另一方面，', '值得留意的是，', '不過，', '需要提醒的是，'],
  closers: {
    high: [
      '建議持續發揮這份優勢，並帶動團隊一同成長。',
      '若能將這份能力傳遞給團隊，影響力將更為深遠。',
      '保持下去，這會是您領導風格中最具辨識度的亮點。',
    ],
    mid: [
      '只要再深化幾個關鍵習慣，便能往精熟邁進。',
      '針對較弱的環節刻意練習，整體表現可望更上層樓。',
      '持續累積經驗，這個構面很快會成為您的強項。',
    ],
    low: [
      '不妨從一個小而具體的行動開始，將帶來明顯改變。',
      '建議搭配導師回饋與定期反思，加速這個構面的成長。',
      '優先投入這個區塊的練習，整體領導力將同步受益。',
    ],
  },
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

// 正向（high/mid）與待強化（low）視為不同方向，用以決定連接詞。
const isPositive = (band) => band !== 'low';

/**
 * 組出單一構面的敘事段落。
 * @param {object} dim    result.dimensions[i]（需含 name / average / subs[]）
 * @param {object} config 題庫設定（需含 COMMENTARY）
 * @param {number|string} seedBase 報告層級的種子（建議用 result.total）
 * @returns {string} 段落文字；資料不足時回傳空字串
 */
export function buildNarrative(dim, config, seedBase = 0) {
  const commentary = config?.COMMENTARY;
  const subs = Array.isArray(dim?.subs) ? dim.subs.filter((s) => commentary?.[s.id]) : [];
  if (!commentary || subs.length === 0) return '';

  const dimBand = bandOf(dim.average);
  const seed = hashStr(`${seedBase}|${dim.id}`);

  const opener = pick(TEMPLATES.openers[dimBand], seed)(dim.name);

  const clauses = subs.map((sub, i) => {
    const band = bandOf(sub.average);
    const text = commentary[sub.id][band];
    if (i === 0) return text;
    const prevBand = bandOf(subs[i - 1].average);
    const pool = isPositive(band) === isPositive(prevBand) ? TEMPLATES.additive : TEMPLATES.contrast;
    return pick(pool, seed + i * 7) + text;
  });

  const closer = pick(TEMPLATES.closers[dimBand], seed + 99);

  return `${opener}${clauses.join('。')}。${closer}`;
}

/**
 * 組出報告最上方的整體總評段落：點出落點等級、最強與最待強化構面，並給總結方向。
 */
export function buildOverallSummary(result, config, seedBase = 0) {
  if (!Array.isArray(result?.dimensions) || result.dimensions.length === 0) return '';
  const seed = hashStr(`${seedBase}|overall`);
  const sorted = [...result.dimensions].sort((a, b) => b.average - a.average);
  const tops = sorted.slice(0, 2).map((d) => d.name);
  const lows = sorted.slice(-2).map((d) => d.name).reverse();
  const badge = result.level?.badge ?? '';

  const templates = [
    () => `整體而言，您的領導行為落在「${badge}」。其中「${tops.join('」與「')}」是目前最突出的強項，展現了穩定而成熟的行為樣貌；而「${lows.join('」與「')}」則是當前最值得投入的成長區。`,
    () => `綜觀九大構面，您的整體表現屬於「${badge}」。「${tops.join('」、「')}」展現了明顯優勢，可作為帶動團隊的支點；同時，「${lows.join('」、「')}」仍有提升空間，是下一階段的關鍵發展方向。`,
    () => `從整體落點來看，您目前處於「${badge}」。最亮眼的是「${tops.join('」與「')}」，建議持續發揮；至於「${lows.join('」與「')}」，若能優先投入練習，將為整體領導力帶來最大的提升。`,
  ];

  return pick(templates, seed)();
}
