import { DIMENSION_INTRO, SUB_TEXT } from '../data/assessments/compass-narrative.js';

/** 敘事解讀的分段切分點（⚠️ 暫定，待試測校準；以頻率量表 1–5 的平均）。 */
export const NARRATIVE_BANDS = { high: 4.0, mid: 3.0 };

export function bandOf(average) {
  if (average >= NARRATIVE_BANDS.high) return 'high';
  if (average >= NARRATIVE_BANDS.mid) return 'mid';
  return 'low';
}

/** 與 narrative.js 同樣的概念：同一份報告每次選到同一段，不同人之間有變化。 */
export function hashSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

export function pickVariant(variants, seed) {
  return variants[seed % variants.length];
}

/**
 * 依結果組出各構面的敘事解讀。沒有撰寫文字的構面（或沒有有效作答的構面）一律略過，
 * 因此文字陸續補齊時，報告自動長出對應段落，不需要改程式。
 */
export function buildCompassNarrative(result, { intro = DIMENSION_INTRO, subs = SUB_TEXT } = {}) {
  const out = [];
  (result?.dimensions ?? []).forEach((d) => {
    if (!d.answered) return;
    const variants = intro[d.id]?.[bandOf(d.average)];
    if (!variants?.length) return;
    const seed = hashSeed(`${Math.round(result.total)}|${d.id}`);
    const subItems = (d.subs ?? [])
      .filter((s) => s.answered > 0 && subs[s.id])
      .map((s) => {
        const band = bandOf(s.average);
        return { id: s.id, name: s.name, band, average: s.average, text: subs[s.id][band] };
      });
    out.push({ id: d.id, name: d.name, band: bandOf(d.average), intro: pickVariant(variants, seed), subs: subItems });
  });
  return out;
}

export const BAND_LABEL = { high: '常展現', mid: '有時展現', low: '較少展現' };
