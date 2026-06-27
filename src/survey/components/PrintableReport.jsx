import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import RadarChart from './RadarChart';
import { getAssessment } from '../data/assessments/index.js';
import { buildNarrative } from '../utils/narrative';
import { formatDate } from '../utils/format';

// ─── primitives ───────────────────────────────────────────────

function HBar({ userPct, benchPct, color, height = 12 }) {
  return (
    <div style={{ position: 'relative', height, borderRadius: height, overflow: 'hidden', background: '#f1f5f9' }}>
      <div style={{ width: `${Math.min(100, userPct ?? 0)}%`, background: color, height: '100%', borderRadius: height }} />
      {benchPct != null && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${Math.min(100, benchPct)}%`, width: 2,
          background: '#475569', opacity: 0.65,
        }} />
      )}
    </div>
  );
}

function RatingPill({ label, color }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 12,
      fontSize: 10, fontWeight: 700, color: '#fff',
      background: color ?? '#64748b', letterSpacing: '0.02em',
    }}>
      {label}
    </span>
  );
}

function SectionHeading({ children, sub }) {
  return (
    <div style={{ marginBottom: 22, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Cover page ───────────────────────────────────────────────

function ReportCover({ result, user, submittedAt, benchmark }) {
  const { total, maxScore, percent, level, dimensions, assessmentName } = result;
  return (
    <div style={{ pageBreakAfter: 'always' }}>
      {/* Gradient header */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)',
        padding: '40px 48px 36px', color: '#fff',
      }}>
        <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          L9D · {assessmentName}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          個人評測報告
        </div>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>
          Assessment Report · 評測日期 {formatDate(submittedAt)}
        </div>
      </div>

      {/* User block */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        padding: '24px 48px 20px', borderBottom: '1px solid #e2e8f0',
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>受測者</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{user?.name ?? '—'}</div>
        </div>
        {benchmark && (
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
            常模樣本：{benchmark.count} 人
          </div>
        )}
      </div>

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '20px 48px' }}>
        {[
          { label: '總得分', value: `${total}`, suffix: ` / ${maxScore}` },
          { label: '能力達成率', value: `${percent}`, suffix: '%' },
          { label: '整體落點', value: level.badge, bg: level.color, white: true },
        ].map(({ label, value, suffix, bg, white }) => (
          <div key={label} style={{
            background: bg ?? '#f8fafc', borderRadius: 12, padding: '14px 18px',
            border: `1px solid ${bg ? 'transparent' : '#e2e8f0'}`,
          }}>
            <div style={{ fontSize: 9, color: white ? 'rgba(255,255,255,0.75)' : '#94a3b8', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: white ? '#fff' : '#0f172a', lineHeight: 1 }}>
              {value}
              {suffix && <span style={{ fontSize: 13, fontWeight: 400, opacity: white ? 0.75 : 0.5 }}>{suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Dimension grid */}
      <div style={{ padding: '4px 48px 40px' }}>
        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
          九大構面快覽
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {dimensions.map((d) => (
            <div key={d.id} style={{ borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{d.subtitle}</span>
              </div>
              <HBar userPct={d.percent} color={d.color} height={6} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                  {d.average.toFixed(1)}
                  <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}> / 5</span>
                </span>
                <RatingPill label={d.rating.label} color={d.rating.color} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Overview: radar + bar comparison ─────────────────────────

function ReportOverview({ result, benchmark }) {
  const { dimensions } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const getBenchPct = (id) => dimAvgs?.find((b) => b.id === id)?.percent ?? null;
  const radarCompare = dimAvgs?.map((b) => ({ id: b.id, percent: b.percent })) ?? null;

  return (
    <div style={{ pageBreakAfter: 'always', padding: '32px 48px' }}>
      <SectionHeading sub="雷達圖與各構面得分對照（|＝全體平均）">
        構面落點分析
      </SectionHeading>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, alignItems: 'start' }}>
        {/* Left: Radar */}
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>
            雷達圖分析
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RadarChart dimensions={dimensions} compare={radarCompare} compareLabel="全體平均" size={260} />
          </div>
          {radarCompare && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, fontSize: 10, color: '#64748b' }}>
              <span>━ 您的得分</span>
              <span style={{ opacity: 0.6 }}>╌ 全體平均</span>
            </div>
          )}
        </div>

        {/* Right: Bars */}
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            構面得分對照
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {dimensions.map((d) => {
              const bp = getBenchPct(d.id);
              const benchAvg = bp != null ? (bp / 100 * 5) : null;
              return (
                <div key={d.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: '#334155' }}>{d.subtitle}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#475569' }}>
                      <span style={{ fontWeight: 700 }}>{d.average.toFixed(1)}</span>
                      {benchAvg != null && (
                        <span style={{ color: '#94a3b8' }}> / 均 {benchAvg.toFixed(1)}</span>
                      )}
                    </span>
                  </div>
                  <HBar userPct={d.percent} benchPct={bp} color={d.color} height={11} />
                </div>
              );
            })}
          </div>
          {dimAvgs && (
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 10 }}>
              樣本人數：{benchmark?.count ?? '?'} 人
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Single dimension block ────────────────────────────────────

function DimBlock({ dim, benchPct, config }) {
  const benchAvg = benchPct != null ? benchPct / 100 * 5 : null;
  const narrative = buildNarrative(dim, config, dim.id);

  return (
    <div style={{ marginBottom: 24, pageBreakInside: 'avoid' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 14px', borderRadius: 10, marginBottom: 10,
        background: dim.color + '12', borderLeft: `3px solid ${dim.color}`,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: dim.color }}>{dim.subtitle}</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{dim.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
            {dim.average.toFixed(1)}<span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}> / 5.0</span>
          </div>
          <RatingPill label={dim.rating.label} color={dim.rating.color} />
        </div>
      </div>

      {/* Score bar vs benchmark */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>
          <span>得分（滿分 5.0）</span>
          {benchAvg != null && <span>| 全體平均 {benchAvg.toFixed(1)}</span>}
        </div>
        <HBar userPct={dim.percent} benchPct={benchPct} color={dim.color} height={14} />
      </div>

      {/* Sub-dimensions */}
      {dim.subs?.length > 0 && (
        <div style={{ marginLeft: 4, marginBottom: narrative ? 10 : 0 }}>
          <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 7 }}>
            子能力分析
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dim.subs.map((sub) => (
              <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '88px 1fr 36px', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>{sub.name}</span>
                <HBar userPct={(sub.average / 5) * 100} color={dim.color} height={8} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                  {sub.average.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative */}
      {narrative && (
        <div style={{
          background: '#f8fafc', borderRadius: 8, padding: '10px 13px', marginTop: 8,
          fontSize: 11, color: '#334155', lineHeight: 1.8, borderLeft: `2px solid ${dim.color}40`,
        }}>
          {narrative}
        </div>
      )}
    </div>
  );
}

// ─── Dimension pages grouped by layer ─────────────────────────

function ReportDimensionPages({ result, benchmark, config }) {
  const { dimensions } = result;
  const dimAvgs = benchmark?.dimensionAverages ?? null;
  const getBenchPct = (id) => dimAvgs?.find((b) => b.id === id)?.percent ?? null;
  const layers = config?.LAYERS;

  if (layers) {
    return layers.map((layer) => {
      const layerDims = dimensions.filter((d) => layer.dimensions.includes(d.id));
      return (
        <div key={layer.id} style={{ pageBreakBefore: 'always', padding: '32px 48px' }}>
          <SectionHeading sub={layer.desc}>{layer.name}</SectionHeading>
          {layerDims.map((d) => (
            <DimBlock key={d.id} dim={d} benchPct={getBenchPct(d.id)} config={config} />
          ))}
        </div>
      );
    });
  }

  return (
    <div style={{ pageBreakBefore: 'always', padding: '32px 48px' }}>
      <SectionHeading>各構面詳細分析</SectionHeading>
      {dimensions.map((d) => (
        <DimBlock key={d.id} dim={d} benchPct={getBenchPct(d.id)} config={config} />
      ))}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────

export default function PrintableReport({ result, benchmark, user, submittedAt, onClose }) {
  const config = getAssessment(result.assessmentId);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const portal = document.getElementById('report-portal');
  if (!portal) return null;

  const handlePrint = () => window.print();

  return createPortal(
    <>
      {/* Toolbar — hidden on print */}
      <div className="report-toolbar">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>個人評測報告</span>
          <span style={{ fontSize: 12, opacity: 0.55, marginLeft: 10 }}>{result.assessmentName}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handlePrint}
            style={{
              background: '#7c3aed', color: '#fff', border: 'none',
              padding: '8px 18px', borderRadius: 8, fontWeight: 700,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            🖨️ 列印 / 存為 PDF
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '8px 14px', borderRadius: 8, fontWeight: 600,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            ✕ 關閉
          </button>
        </div>
      </div>

      {/* Report document */}
      <div style={{
        background: '#fff',
        fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
      }}>
        <ReportCover result={result} user={user} submittedAt={submittedAt} benchmark={benchmark} />
        <ReportOverview result={result} benchmark={benchmark} />
        <ReportDimensionPages result={result} benchmark={benchmark} config={config} />
      </div>
    </>,
    portal,
  );
}
