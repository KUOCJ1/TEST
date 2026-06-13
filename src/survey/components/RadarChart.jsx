import { useId } from 'react';

/**
 * 純 SVG 六角雷達圖，無第三方相依。
 * @param {Array<{name,subtitle,percent,color}>} dimensions 各構面（百分比 0~100）
 * @param {number} size 畫布邊長 (px)
 */
export default function RadarChart({ dimensions, size = 340 }) {
  const gradientId = useId();
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const labelRadius = radius + 26;
  const n = dimensions.length;
  const rings = [0.25, 0.5, 0.75, 1];

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

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: size, height: 'auto' }}
      role="img"
      aria-label={`${dimensions.length} 大構面能力雷達圖`}
    >
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#319795" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2b6cb0" stopOpacity="0.35" />
        </radialGradient>
      </defs>

      {/* 背景同心多邊形 */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={dimensions.map((_, i) => point(i, r).join(',')).join(' ')}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1"
        />
      ))}

      {/* 軸線 */}
      {dimensions.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}

      {/* 資料區塊 */}
      <path d={dataPath} fill={`url(#${gradientId})`} stroke="#2c7a7b" strokeWidth="2" />

      {/* 資料頂點 */}
      {dimensions.map((d, i) => {
        const [x, y] = point(i, Math.max(0, Math.min(1, d.percent / 100)));
        return <circle key={i} cx={x} cy={y} r="3.5" fill={d.color} stroke="#fff" strokeWidth="1.5" />;
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
  );
}
