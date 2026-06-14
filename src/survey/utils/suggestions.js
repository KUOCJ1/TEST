/**
 * 依評測結果與題庫設定，自動產生「優先強化」與「發揮優勢」建議。
 * 規則庫由各題庫的 DIMENSION_ADVICE 提供；無設定時回傳 null（該題庫不顯示建議）。
 *
 * @param {object} result buildResult() 的輸出（含 dimensions[].rating.tone / average）
 * @param {object} config 題庫設定（需含 DIMENSION_ADVICE）
 * @returns {{develop:Array, leverage:Array}|null}
 */
const DEVELOP_TONES = new Set(['weak', 'low', 'mid']);

export function buildSuggestions(result, config) {
  const advice = config?.DIMENSION_ADVICE;
  if (!advice || !Array.isArray(result?.dimensions)) return null;

  const byAvgAsc = [...result.dimensions].sort((a, b) => a.average - b.average);

  const develop = byAvgAsc
    .filter((d) => DEVELOP_TONES.has(d.rating?.tone))
    .slice(0, 3)
    .map((d) => ({ id: d.id, subtitle: d.subtitle, name: d.name, color: d.color, text: advice[d.id]?.develop }))
    .filter((x) => x.text);

  const leverage = [...byAvgAsc]
    .reverse()
    .filter((d) => !DEVELOP_TONES.has(d.rating?.tone))
    .slice(0, 2)
    .map((d) => ({ id: d.id, subtitle: d.subtitle, name: d.name, color: d.color, text: advice[d.id]?.leverage }))
    .filter((x) => x.text);

  if (develop.length === 0 && leverage.length === 0) return null;
  return { develop, leverage };
}
