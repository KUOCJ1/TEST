// ─── Utility helpers shared across 分頁計算邏輯 ──────────

export function toneOf(avg) {
  if (avg >= 4.2) return 'strong';
  if (avg >= 3.4) return 'good';
  if (avg >= 2.6) return 'mid';
  if (avg >= 1.8) return 'low';
  return 'weak';
}

export function gapInfo(userAvg, benchAvg) {
  if (benchAvg == null) return null;
  const d = userAvg - benchAvg;
  if (d >= 0.5) return { symbol: '▲', label: `+${d.toFixed(1)} 顯著優勢`, color: '#059669' };
  if (d <= -0.5) return { symbol: '▽', label: `${d.toFixed(1)} 顯著差距`, color: '#ef4444' };
  return null;
}

export function layerBalance(result, benchmark, config) {
  if (!config?.LAYERS) return null;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  return config.LAYERS.map((layer) => {
    const dims = result.dimensions.filter((d) => layer.dimensions.includes(d.id));
    const userAvg = dims.reduce((s, d) => s + d.average, 0) / dims.length;
    let benchAvg = null;
    if (dimAvgs) {
      const bs = dims.map((d) => dimAvgs.find((b) => b.id === d.id)?.percent ?? null).filter((v) => v != null);
      if (bs.length) benchAvg = (bs.reduce((s, v) => s + v, 0) / bs.length) / 100 * 5;
    }
    return { id: layer.id, name: layer.name, desc: layer.desc, userAvg, benchAvg, tone: toneOf(userAvg) };
  });
}
