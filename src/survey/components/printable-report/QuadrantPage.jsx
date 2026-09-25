// ─── Page 4.5: Sub-competency quadrant ──────────────────────────
import { PageMeta, PageFooter, SectionTitle } from './primitives.jsx';

export default function QuadrantPage({ result, benchmark, user, date }) {
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const hasBench = dimAvgs != null;

  const allSubs = result.dimensions.flatMap((d) => {
    const bd = dimAvgs?.find((b) => b.id === d.id);
    const benchRef = bd ? bd.percent / 100 * 5 : d.average;
    return (d.subs ?? []).map((s) => ({
      id: s.id, name: s.name, average: s.average,
      dimId: d.id, dimSubtitle: d.subtitle,
      benchRef, yGap: s.average - benchRef,
    }));
  });

  if (allSubs.length === 0) return null;

  const X_SPLIT = 3.5;
  const gaps = allSubs.map((s) => s.yGap);
  const absMax = Math.max(Math.abs(Math.min(...gaps)), Math.abs(Math.max(...gaps)), 0.5);
  const yRange = Math.ceil(absMax * 4) / 4 + 0.25;

  const classified = allSubs.map((s, idx) => {
    const q = s.average >= X_SPLIT
      ? (s.yGap >= 0 ? 'core' : 'monitor')
      : (s.yGap >= 0 ? 'latent' : 'develop');
    return { ...s, quadrant: q, idx: idx + 1 };
  });

  const QMETA = {
    core:    { label: '核心優勢', sub: '高分・超越基準', color: '#059669', bg: '#ecfdf5' },
    latent:  { label: '潛力優勢', sub: '低分・超越基準', color: '#0284c7', bg: '#eff6ff' },
    develop: { label: '優先發展', sub: '低分・低於基準', color: '#dc2626', bg: '#fef2f2' },
    monitor: { label: '改善機會', sub: '高分・低於基準', color: '#d97706', bg: '#fffbeb' },
  };

  const W = 480, H = 330;
  const P = { t: 28, r: 28, b: 44, l: 52 };
  const pw = W - P.l - P.r;
  const ph = H - P.t - P.b;

  const xPx = (v) => P.l + ((v - 1) / 4) * pw;
  const yPx = (g) => P.t + ((yRange - g) / (2 * yRange)) * ph;
  const xMid = xPx(X_SPLIT);
  const yMid = yPx(0);

  const yLabel = hasBench ? '相較常模均值' : '相較構面均值';

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 52px' }}>
      <PageMeta name={user?.name ?? '—'} section="子能力四象限" date={date} assessmentName={result?.assessmentName} />
      <SectionTitle sub={`${allSubs.length} 項子能力依「得分高低」×「${yLabel}差距」四象限分佈，快速識別優勢與發展機會`}>
        子能力四象限分析
      </SectionTitle>

      {/* SVG quadrant chart */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <svg width={W} height={H} style={{ fontFamily: 'inherit', overflow: 'visible' }}>
          {/* Quadrant backgrounds */}
          <rect x={P.l} y={P.t} width={xMid - P.l} height={yMid - P.t} fill="#eff6ff" opacity=".7" />
          <rect x={xMid} y={P.t} width={W - P.r - xMid} height={yMid - P.t} fill="#ecfdf5" opacity=".7" />
          <rect x={P.l} y={yMid} width={xMid - P.l} height={H - P.b - yMid} fill="#fef2f2" opacity=".7" />
          <rect x={xMid} y={yMid} width={W - P.r - xMid} height={H - P.b - yMid} fill="#fffbeb" opacity=".7" />
          {/* Quadrant labels */}
          <text x={P.l + 6} y={P.t + 13} fontSize="8.5" fill="#0284c7" fontWeight="700">潛力優勢</text>
          <text x={xMid + 6} y={P.t + 13} fontSize="8.5" fill="#059669" fontWeight="700">核心優勢</text>
          <text x={P.l + 6} y={H - P.b - 6} fontSize="8.5" fill="#dc2626" fontWeight="700">優先發展</text>
          <text x={xMid + 6} y={H - P.b - 6} fontSize="8.5" fill="#d97706" fontWeight="700">改善機會</text>
          {/* Axes */}
          <line x1={P.l} y1={yMid} x2={W - P.r} y2={yMid} stroke="#475569" strokeWidth="1.3" />
          <line x1={xMid} y1={P.t} x2={xMid} y2={H - P.b} stroke="#475569" strokeWidth="1.3" />
          {/* X-axis ticks + labels */}
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={xPx(v)} y1={H - P.b} x2={xPx(v)} y2={H - P.b + 4} stroke="#cbd5e1" strokeWidth="1" />
              <text x={xPx(v)} y={H - P.b + 13} fontSize="7.5" fill={v === 3 || v === 4 ? '#475569' : '#64748b'} textAnchor="middle">{v}.0</text>
            </g>
          ))}
          <text x={xMid} y={H - P.b + 13} fontSize="7.5" fill="#dc2626" fontWeight="700" textAnchor="middle">3.5</text>
          <text x={(P.l + W - P.r) / 2} y={H - 4} fontSize="8" fill="#64748b" textAnchor="middle">子能力得分（1–5）</text>
          {/* Y-axis label */}
          <text x={12} y={(P.t + H - P.b) / 2} fontSize="8" fill="#64748b" textAnchor="middle"
            transform={`rotate(-90 12 ${(P.t + H - P.b) / 2})`}>{yLabel}（分）</text>
          {/* Y-axis ticks */}
          {[-0.5, 0, 0.5].map((g) => (
            <g key={g}>
              <line x1={P.l - 4} y1={yPx(g)} x2={P.l} y2={yPx(g)} stroke="#cbd5e1" strokeWidth="1" />
              <text x={P.l - 6} y={yPx(g) + 3} fontSize="7" fill="#64748b" textAnchor="end">
                {g === 0 ? '0' : (g > 0 ? '+' : '') + g.toFixed(1)}
              </text>
            </g>
          ))}
          {/* Data points */}
          {classified.map((s) => {
            const cx = xPx(s.average);
            const cy = yPx(s.yGap);
            const color = QMETA[s.quadrant].color;
            return (
              <g key={s.id}>
                <circle cx={cx} cy={cy} r={9} fill={color} opacity=".88" />
                <text x={cx} y={cy + 3.5} fontSize="7" fill="#fff" textAnchor="middle" fontWeight="700">{s.idx}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Quadrant legend / item lists */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {['core', 'latent', 'develop', 'monitor'].map((key) => {
          const meta = QMETA[key];
          const items = classified.filter((s) => s.quadrant === key);
          if (items.length === 0) return null;
          return (
            <div key={key} style={{ background: meta.bg, border: `1px solid ${meta.color}45`, borderRadius: 9, padding: '9px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: meta.color, marginBottom: 6 }}>
                {meta.label}
                <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 5, fontSize: 9 }}>· {meta.sub} · {items.length} 項</span>
              </div>
              {items.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', paddingTop: 3 }}>
                  <span>
                    <span style={{ color: meta.color, fontWeight: 700, fontSize: 9, marginRight: 4 }}>#{s.idx}</span>
                    <span style={{ color: '#64748b', fontSize: 9, marginRight: 3 }}>{s.dimSubtitle}·</span>
                    {s.name}
                  </span>
                  <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{s.average.toFixed(1)}</span>
                </div>
              ))}
            </div>
          );
        }).filter(Boolean)}
      </div>

      <div style={{ marginTop: 12, fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>
        * X 軸為子能力得分（分界線 3.5 = 熟練基準）；Y 軸為{yLabel}差距，正值代表超越基準、負值代表低於基準。{hasBench ? `常模樣本 ${benchmark?.count ?? '?'} 人。` : ''}
      </div>

      <PageFooter />
    </div>
  );
}
