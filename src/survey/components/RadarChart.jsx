import { Fragment, useId } from 'react';

/**
 * 純 SVG 六角雷達圖，無第三方相依。
 * @param {Array<{name,subtitle,percent,color}>} dimensions 各構面（百分比 0~100）
 * @param {number} size 畫布邊長 (px)
 * @param {Array<{id,percent}>} [compare] 對照數列（如全體 / 班級平均），以虛線疊加
 * @param {string} [compareLabel] 對照數列的圖例文字
 */
export default function RadarChart({ dimensions, size = 340, compare = null, compareLabel = '全體平均' }) {
  const gradientId = useId();
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const labelRadius = radius + 26;
  const n = dimensions.length;
  const rings = [0.25, 0.5, 0.75, 1];
  // 標籤（如 "Succession Readiness"）以 start/end 錨點向外延伸，
  // 這段寬度不在畫布邊界內，需另外留白避免被 SVG 邊界裁切。
  const padX = 130;
  const padY = 40;
  const viewBox = `${-padX} ${-padY} ${size + padX * 2} ${size + padY * 2}`;

  // 由 12 點鐘方向起算的各軸角度。
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const point = (i, ratio) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * radius * ratio, cy + Math.sin(a) * radius * ratio];
  };

  const toPath = (ratioFn) =>
    dimensions
      .map((_, i) => {
        const [x, y] = point(i, ratioFn(i));
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ') + ' Z';

  const dataPath = toPath((i) => Math.max(0, Math.min(1, dimensions[i].percent / 100)));

  const comparePct = (i) => {
    if (!compare) return null;
    const match = compare.find((c) => c.id === dimensions[i].id);
    return match ? Math.max(0, Math.min(1, match.percent / 100)) : 0;
  };
  const comparePath = compare ? toPath((i) => comparePct(i) ?? 0) : null;

  return (
    <Fragment>
    <svg
      viewBox={viewBox}
      width="100%"
      style={{ maxWidth: size + padX * 2, height: 'auto' }}
      role="img"
      aria-label={`${dimensions.length} 大構面能力雷達圖，各構面數值詳見下方表格`}
    >
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a9752e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6f5424" stopOpacity="0.32" />
        </radialGradient>
      </defs>

      {/* 背景同心多邊形 */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={dimensions.map((_, i) => point(i, r).join(',')).join(' ')}
          fill="none"
          stroke="#b6c2d1"
          strokeWidth="1"
        />
      ))}

      {/* 軸線 */}
      {dimensions.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#cbd5e1" strokeWidth="1" />;
      })}

      {/* 資料區塊 */}
      <path d={dataPath} fill={`url(#${gradientId})`} stroke="#8a6a2f" strokeWidth="2" />

      {/* 對照數列（虛線，疊加於資料區塊之上，並加白色描邊以維持可視度） */}
      {comparePath && (
        <path d={comparePath} fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="5 4" strokeOpacity="0.9" />
      )}
      {comparePath && (
        <path d={comparePath} fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="5 4" />
      )}

      {/* 圖例 */}
      {compare && (
        <g>
          <line x1={12} y1={size - 14} x2={32} y2={size - 14} stroke="#475569" strokeWidth="2" strokeDasharray="5 4" />
          <text x={36} y={size - 10} fontSize="11" fill="#475569" fontWeight="600">{compareLabel}</text>
        </g>
      )}

      {/* 資料頂點 */}
      {dimensions.map((d, i) => {
        const [x, y] = point(i, Math.max(0, Math.min(1, d.percent / 100)));
        return <circle key={i} cx={x} cy={y} r="4.5" fill={d.color} stroke="#fff" strokeWidth="1.75" />;
      })}

      {/* 構面標籤 */}
      {dimensions.map((d, i) => {
        const a = angleFor(i);
        const lx = cx + Math.cos(a) * labelRadius;
        const ly = cy + Math.sin(a) * labelRadius;
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        return (
          <g key={i}>
            <text
              x={lx}
              y={ly - 4}
              textAnchor={anchor}
              fontSize="12"
              fontWeight="600"
              fill="#2d3748"
            >
              {d.subtitle}
            </text>
            <text x={lx} y={ly + 11} textAnchor={anchor} fontSize="11" fill={d.color} fontWeight="700">
              {d.percent}%
            </text>
          </g>
        );
      })}
    </svg>

    {/* 圖表本身是純視覺 SVG，螢幕閱讀器讀不到座標與色塊代表的數值——用視覺隱藏
        的表格提供同一份資料的文字版本，讓輔助科技使用者也能取得雷達圖傳達的
        構面落點資訊。 */}
    <table className="sr-only">
      <caption>{dimensions.length} 大構面能力雷達圖數值</caption>
      <thead>
        <tr>
          <th scope="col">構面</th>
          <th scope="col">分數</th>
          {compare && <th scope="col">{compareLabel}</th>}
        </tr>
      </thead>
      <tbody>
        {dimensions.map((d, i) => (
          <tr key={d.id ?? i}>
            <th scope="row">{d.subtitle ?? d.name}</th>
            <td>{d.percent}%</td>
            {compare && <td>{Math.round(comparePct(i) * 100)}%</td>}
          </tr>
        ))}
      </tbody>
    </table>
    </Fragment>
  );
}
