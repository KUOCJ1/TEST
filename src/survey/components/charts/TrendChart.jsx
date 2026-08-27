/**
 * 歷次總分趨勢折線圖（純 SVG）。
 * @param {Array<{label, value}>} points 依時間由舊到新
 * @param {number} min Y 軸下限（預設 31）
 * @param {number} max Y 軸上限（預設 155）
 */
export default function TrendChart({ points, min = 31, max = 155 }) {
  const width = 560;
  const height = 200;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (points.length === 0) return null;

  const x = (i) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - min) / (max - min)) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const gridVals = [min, Math.round((min + max) / 2), max];

  return (
    <>
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ height: 'auto' }}
      role="img"
      aria-label="歷次總分趨勢折線圖，各時間點分數詳見下方表格"
    >
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={width - padR} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
            {v}
          </text>
        </g>
      ))}

      <path d={line} fill="none" stroke="#8a6a2f" strokeWidth="2.5" strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="4" fill="#8a6a2f" stroke="#fff" strokeWidth="1.5" />
          <text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#6f5424">
            {p.value}
          </text>
          <text x={x(i)} y={height - 9} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {p.label}
          </text>
        </g>
      ))}
    </svg>

    {/* 折線圖是純視覺 SVG，螢幕閱讀器讀不到座標值——視覺隱藏的表格提供同一份
        資料的文字版本。 */}
    <table className="sr-only">
      <caption>歷次總分趨勢</caption>
      <thead>
        <tr>
          <th scope="col">時間點</th>
          <th scope="col">總分</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p, i) => (
          <tr key={i}>
            <th scope="row">{p.label}</th>
            <td>{p.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}
